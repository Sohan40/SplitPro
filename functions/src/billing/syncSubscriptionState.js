const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { createHash } = require("crypto");
const { createGooglePlayClient } = require("./googlePlayClient");
const { hashPurchaseToken } = require("./hashPurchaseToken");
const {
  GOOGLE_PLAY_PACKAGE_NAME,
  GOOGLE_PLAY_PROVIDER,
  getProductConfig,
} = require("./productConfig");
const { normalizeGooglePlaySubscription } = require("./verifyGooglePlayPurchase");

const REVOKED_ERROR_CODES = new Set([404, 410, "404", "410"]);
const FINAL_STATUSES = new Set(["expired", "revoked", "invalid"]);

function timestampFromMillisOrNull(millis) {
  return millis ? Timestamp.fromMillis(millis) : null;
}

function accessIsActive(normalized, nowMs) {
  return Boolean(
    normalized.entitlementActive &&
    normalized.expiryTimeMs &&
    normalized.expiryTimeMs > nowMs
  );
}

function makeEventId({ source = "manual", messageId, tokenHash, eventType = "unknown" }) {
  if (messageId) {
    return `${source}_${String(messageId).replace(/[^A-Za-z0-9_-]/gu, "_")}`;
  }

  const digest = createHash("sha256")
    .update(`${source}:${tokenHash || "no-token"}:${eventType}`)
    .digest("hex")
    .slice(0, 24);
  return `${source}_${digest}`;
}

function buildMetadata({ uid, productId, tokenHash, normalized, source }) {
  return {
    uid,
    provider: GOOGLE_PLAY_PROVIDER,
    productId,
    packageName: normalized.packageName || GOOGLE_PLAY_PACKAGE_NAME,
    status: normalized.status,
    rawProviderState: normalized.rawState,
    expiryTime: timestampFromMillisOrNull(normalized.expiryTimeMs),
    autoRenewing: normalized.autoRenewing,
    purchaseTokenHash: tokenHash,
    acknowledgementState: normalized.acknowledgementState || "unknown",
    lastLifecycleSource: source,
    lastVerifiedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function buildEntitlement({ productConfig, normalized, active }) {
  return {
    active,
    plan: productConfig.plan,
    status: normalized.status,
    provider: GOOGLE_PLAY_PROVIDER,
    expiresAt: timestampFromMillisOrNull(normalized.expiryTimeMs),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function buildRevokedState(productId) {
  return {
    valid: true,
    productId,
    packageName: GOOGLE_PLAY_PACKAGE_NAME,
    status: "revoked",
    entitlementActive: false,
    expiryTimeMs: null,
    autoRenewing: false,
    acknowledgementState: "unknown",
    rawState: "REVOKED_OR_NOT_FOUND",
  };
}

async function writeAuditEvent({
  db,
  eventId,
  uid = null,
  productId = null,
  tokenHash = null,
  eventType,
  oldStatus = null,
  newStatus = null,
  entitlementActive = null,
  result = "processed",
}) {
  await db.collection("subscriptionEvents").doc(eventId).set({
    provider: GOOGLE_PLAY_PROVIDER,
    uid,
    productId,
    purchaseTokenHash: tokenHash,
    eventType,
    oldStatus,
    newStatus,
    entitlementActive,
    result,
    processedAt: FieldValue.serverTimestamp(),
    rawEventStored: false,
  }, { merge: true });
}

async function writeSubscriptionLifecycleState({
  db,
  uid,
  productId,
  purchaseToken,
  tokenHash,
  normalized,
  source,
  nowMs,
}) {
  const productConfig = getProductConfig(productId);
  if (!productConfig) {
    throw new HttpsError("invalid-argument", "Unsupported subscription product.");
  }

  const active = accessIsActive(normalized, nowMs);
  const userRef = db.collection("users").doc(uid);
  const subscriptionRef = db.collection("subscriptions").doc(uid);
  const tokenRef = db.collection("subscriptionTokens").doc(tokenHash);
  const metadata = buildMetadata({ uid, productId, tokenHash, normalized, source });
  const entitlement = buildEntitlement({ productConfig, normalized, active });

  await db.runTransaction(async (transaction) => {
    const tokenDoc = await transaction.get(tokenRef);
    const tokenData = tokenDoc.exists ? tokenDoc.data() : {};
    if (tokenDoc.exists && tokenData?.uid && tokenData.uid !== uid) {
      throw new HttpsError("permission-denied", "This purchase is already linked to another account.");
    }

    transaction.set(tokenRef, {
      uid,
      productId,
      provider: GOOGLE_PLAY_PROVIDER,
      purchaseToken,
      createdAt: tokenDoc.exists ? tokenData?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.set(subscriptionRef, metadata, { merge: true });

    const userPatch = {
      entitlement: {
        ai: entitlement,
      },
    };

    if (active) {
      userPatch.aiUsage = {
        limit: productConfig.monthlyLimit,
        updatedAt: FieldValue.serverTimestamp(),
      };
    }

    transaction.set(userRef, userPatch, { merge: true });
  });

  return {
    active,
    status: normalized.status,
  };
}

async function syncSubscriptionFromToken({
  db,
  productId,
  purchaseToken,
  source,
  eventType,
  eventId,
  googlePlayClient = createGooglePlayClient(),
  nowMs = Date.now(),
  requireLinkedUser = true,
}) {
  const productConfig = getProductConfig(productId);
  const tokenHash = purchaseToken ? hashPurchaseToken(purchaseToken) : null;
  const safeEventId = eventId || makeEventId({ source, tokenHash, eventType });

  if (!productConfig || !purchaseToken || !tokenHash) {
    await writeAuditEvent({
      db,
      eventId: safeEventId,
      productId,
      tokenHash,
      eventType,
      result: "invalid_payload",
    });
    return { processed: false, reason: "invalid_payload" };
  }

  const tokenRef = db.collection("subscriptionTokens").doc(tokenHash);
  const tokenDoc = await tokenRef.get();
  const tokenData = tokenDoc.exists ? tokenDoc.data() : null;
  const uid = tokenData?.uid || null;

  if (requireLinkedUser && !uid) {
    await writeAuditEvent({
      db,
      eventId: safeEventId,
      productId,
      tokenHash,
      eventType,
      result: "unlinked_purchase_token",
    });
    return { processed: false, reason: "unlinked_purchase_token" };
  }

  const subscriptionRef = uid ? db.collection("subscriptions").doc(uid) : null;
  const oldSubscription = subscriptionRef ? await subscriptionRef.get() : null;
  const oldStatus = oldSubscription?.exists ? oldSubscription.data()?.status || null : null;

  let subscription;
  let normalized;
  try {
    subscription = await googlePlayClient.getSubscriptionPurchase({
      packageName: GOOGLE_PLAY_PACKAGE_NAME,
      purchaseToken,
    });
    normalized = normalizeGooglePlaySubscription(subscription, { productId }, nowMs);
  } catch (error) {
    const errorCode = error?.code || error?.status || error?.response?.status || "unknown";
    if (uid && eventType === "revoked" && REVOKED_ERROR_CODES.has(errorCode)) {
      normalized = buildRevokedState(productId);
    } else {
      console.warn("Google Play lifecycle verification failed:", {
        productId,
        eventType,
        errorCode,
      });
      throw error;
    }
  }

  if (!normalized.valid) {
    await writeAuditEvent({
      db,
      eventId: safeEventId,
      uid,
      productId,
      tokenHash,
      eventType,
      oldStatus,
      result: normalized.reason || "provider_mismatch",
    });
    return { processed: false, reason: normalized.reason || "provider_mismatch" };
  }

  let syncResult = { active: false, status: normalized.status };
  if (uid) {
    syncResult = await writeSubscriptionLifecycleState({
      db,
      uid,
      productId,
      purchaseToken,
      tokenHash,
      normalized,
      source,
      nowMs,
    });
  }

  await writeAuditEvent({
    db,
    eventId: safeEventId,
    uid,
    productId,
    tokenHash,
    eventType,
    oldStatus,
    newStatus: normalized.status,
    entitlementActive: syncResult.active,
  });

  return {
    processed: Boolean(uid),
    uid,
    productId,
    status: normalized.status,
    entitlementActive: syncResult.active,
  };
}

async function reconcileTokenSnapshot({
  db,
  tokenSnapshot,
  googlePlayClient,
  nowMs,
}) {
  const tokenData = tokenSnapshot.data();
  if (!tokenData?.uid || !tokenData?.productId || !tokenData?.purchaseToken) {
    await writeAuditEvent({
      db,
      eventId: makeEventId({
        source: "reconcile",
        messageId: `missing_${tokenSnapshot.id}`,
        tokenHash: tokenSnapshot.id,
        eventType: "reconcile_skipped",
      }),
      uid: tokenData?.uid || null,
      productId: tokenData?.productId || null,
      tokenHash: tokenSnapshot.id,
      eventType: "reconcile_skipped",
      result: "missing_purchase_token",
    });
    return { processed: false, reason: "missing_purchase_token" };
  }

  return syncSubscriptionFromToken({
    db,
    productId: tokenData.productId,
    purchaseToken: tokenData.purchaseToken,
    source: "reconcile",
    eventType: "reconcile",
    eventId: makeEventId({
      source: "reconcile",
      messageId: tokenSnapshot.id,
      tokenHash: tokenSnapshot.id,
      eventType: "reconcile",
    }),
    googlePlayClient,
    nowMs,
    requireLinkedUser: true,
  });
}

async function reconcileActiveSubscriptions({
  db,
  googlePlayClient = createGooglePlayClient(),
  nowMs = Date.now(),
  limit = 200,
}) {
  const snapshot = await db
    .collection("subscriptionTokens")
    .where("provider", "==", GOOGLE_PLAY_PROVIDER)
    .limit(limit)
    .get();

  const results = [];
  for (const tokenSnapshot of snapshot.docs) {
    const result = await reconcileTokenSnapshot({
      db,
      tokenSnapshot,
      googlePlayClient,
      nowMs,
    });
    results.push(result);
  }

  return {
    checked: snapshot.docs.length,
    processed: results.filter((result) => result.processed).length,
    skipped: results.filter((result) => !result.processed).length,
  };
}

module.exports = {
  FINAL_STATUSES,
  accessIsActive,
  makeEventId,
  reconcileActiveSubscriptions,
  syncSubscriptionFromToken,
  writeAuditEvent,
  writeSubscriptionLifecycleState,
};
