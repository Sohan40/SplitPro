const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { createGooglePlayClient } = require("./googlePlayClient");
const { hashPurchaseToken } = require("./hashPurchaseToken");
const {
  GOOGLE_PLAY_PACKAGE_NAME,
  GOOGLE_PLAY_PROVIDER,
  getProductConfig,
} = require("./productConfig");

const MIN_PURCHASE_TOKEN_LENGTH = 20;
const GRANTING_STATUSES = new Set(["active", "grace_period", "active_until_expiry"]);

function validateInput(data) {
  const productId = typeof data?.productId === "string" ? data.productId.trim() : "";
  const purchaseToken = typeof data?.purchaseToken === "string" ? data.purchaseToken.trim() : "";
  const platform = typeof data?.platform === "string" ? data.platform.trim().toLowerCase() : "android";
  const productConfig = getProductConfig(productId);

  if (!productConfig) {
    throw new HttpsError("invalid-argument", "Unsupported subscription product.");
  }

  if (platform !== "android") {
    throw new HttpsError("invalid-argument", "Only Android purchases can be verified here.");
  }

  if (!purchaseToken || purchaseToken.length < MIN_PURCHASE_TOKEN_LENGTH) {
    throw new HttpsError("invalid-argument", "A valid purchase token is required.");
  }

  return {
    productId,
    purchaseToken,
    platform,
    productConfig,
  };
}

function parseExpiryMillis(value) {
  if (!value) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/u.test(value)) return Number(value);

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findLineItem(subscription, productId) {
  if (!Array.isArray(subscription?.lineItems)) {
    return null;
  }

  return subscription.lineItems.find((item) => item?.productId === productId) || null;
}

function getAutoRenewing(subscription, lineItem) {
  if (typeof lineItem?.autoRenewingPlan?.autoRenewEnabled === "boolean") {
    return lineItem.autoRenewingPlan.autoRenewEnabled;
  }

  if (typeof subscription?.autoRenewing === "boolean") {
    return subscription.autoRenewing;
  }

  return null;
}

function getAcknowledgementState(subscription) {
  const state = subscription?.acknowledgementState;
  if (state === "ACKNOWLEDGEMENT_STATE_PENDING" || state === 0) {
    return "pending";
  }
  if (state === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" || state === 1) {
    return "acknowledged";
  }
  return "unknown";
}

function mapSubscriptionStatus(subscriptionState, expiryTimeMs, nowMs) {
  const isExpired = !expiryTimeMs || expiryTimeMs <= nowMs;

  switch (subscriptionState) {
    case "SUBSCRIPTION_STATE_ACTIVE":
      return isExpired ? "expired" : "active";
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return isExpired ? "expired" : "grace_period";
    case "SUBSCRIPTION_STATE_CANCELED":
      return isExpired ? "expired" : "active_until_expiry";
    case "SUBSCRIPTION_STATE_ON_HOLD":
      return "on_hold";
    case "SUBSCRIPTION_STATE_PAUSED":
      return "paused";
    case "SUBSCRIPTION_STATE_EXPIRED":
      return "expired";
    case "SUBSCRIPTION_STATE_PENDING":
      return "pending";
    case "SUBSCRIPTION_STATE_UNSPECIFIED":
    default:
      return "unknown";
  }
}

function normalizeGooglePlaySubscription(subscription, input, nowMs = Date.now()) {
  const lineItem = findLineItem(subscription, input.productId);
  const responsePackageName = subscription?.packageName || GOOGLE_PLAY_PACKAGE_NAME;

  if (responsePackageName !== GOOGLE_PLAY_PACKAGE_NAME) {
    return {
      valid: false,
      reason: "package_mismatch",
    };
  }

  if (!lineItem) {
    return {
      valid: false,
      reason: "product_mismatch",
    };
  }

  const expiryTimeMs = parseExpiryMillis(lineItem.expiryTime || subscription?.expiryTimeMillis);
  const status = mapSubscriptionStatus(subscription?.subscriptionState, expiryTimeMs, nowMs);
  const entitlementActive = GRANTING_STATUSES.has(status);

  return {
    valid: true,
    productId: lineItem.productId,
    packageName: responsePackageName,
    status,
    entitlementActive,
    expiryTimeMs,
    autoRenewing: getAutoRenewing(subscription, lineItem),
    acknowledgementState: getAcknowledgementState(subscription),
    rawState: subscription?.subscriptionState || "SUBSCRIPTION_STATE_UNSPECIFIED",
  };
}

async function acknowledgeIfNeeded(googlePlayClient, input, normalized) {
  if (!normalized.entitlementActive || normalized.acknowledgementState !== "pending") {
    return false;
  }

  try {
    await googlePlayClient.acknowledgeSubscription({
      packageName: GOOGLE_PLAY_PACKAGE_NAME,
      productId: input.productId,
      purchaseToken: input.purchaseToken,
    });
    return true;
  } catch (error) {
    console.warn("Google Play acknowledgement failed:", {
      productId: input.productId,
      status: normalized.status,
      errorCode: error?.code || error?.status || "unknown",
    });
    return false;
  }
}

function buildSafeSubscriptionMetadata({ uid, input, tokenHash, normalized, acknowledged }) {
  const expiryTimestamp = normalized.expiryTimeMs
    ? Timestamp.fromMillis(normalized.expiryTimeMs)
    : null;

  return {
    uid,
    provider: GOOGLE_PLAY_PROVIDER,
    productId: input.productId,
    packageName: normalized.packageName,
    status: normalized.status,
    rawProviderState: normalized.rawState,
    expiryTime: expiryTimestamp,
    autoRenewing: normalized.autoRenewing,
    purchaseTokenHash: tokenHash,
    acknowledgementState: acknowledged ? "acknowledged" : normalized.acknowledgementState,
    lastVerifiedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function writeVerifiedSubscription({ db, uid, input, tokenHash, normalized, acknowledged }) {
  const userRef = db.collection("users").doc(uid);
  const subscriptionRef = db.collection("subscriptions").doc(uid);
  const tokenRef = db.collection("subscriptionTokens").doc(tokenHash);
  const productConfig = input.productConfig;
  const expiryTimestamp = Timestamp.fromMillis(normalized.expiryTimeMs);
  const metadata = buildSafeSubscriptionMetadata({
    uid,
    input,
    tokenHash,
    normalized,
    acknowledged,
  });

  await db.runTransaction(async (transaction) => {
    const tokenDoc = await transaction.get(tokenRef);
    if (tokenDoc.exists && tokenDoc.data()?.uid !== uid) {
      console.warn("Rejected Google Play token reuse attempt:", {
        tokenHashPrefix: tokenHash.slice(0, 12),
        existingUid: tokenDoc.data()?.uid,
        requestUid: uid,
      });
      throw new HttpsError("permission-denied", "This purchase is already linked to another account.");
    }

    transaction.set(tokenRef, {
      uid,
      productId: input.productId,
      provider: GOOGLE_PLAY_PROVIDER,
      createdAt: tokenDoc.exists ? tokenDoc.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.set(subscriptionRef, metadata, { merge: true });

    transaction.set(userRef, {
      entitlement: {
        ai: {
          active: true,
          plan: productConfig.plan,
          status: normalized.status,
          provider: GOOGLE_PLAY_PROVIDER,
          expiresAt: expiryTimestamp,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      aiUsage: {
        limit: productConfig.monthlyLimit,
        updatedAt: FieldValue.serverTimestamp(),
      },
    }, { merge: true });
  });
}

async function verifyPurchaseForUser({
  db,
  uid,
  data,
  googlePlayClient = createGooglePlayClient(),
  nowMs = Date.now(),
}) {
  const input = validateInput(data);
  const tokenHash = hashPurchaseToken(input.purchaseToken);

  let subscription;
  try {
    subscription = await googlePlayClient.getSubscriptionPurchase({
      packageName: GOOGLE_PLAY_PACKAGE_NAME,
      purchaseToken: input.purchaseToken,
    });
  } catch (error) {
    console.warn("Google Play purchase verification failed:", {
      productId: input.productId,
      errorCode: error?.code || error?.status || "unknown",
    });
    throw new HttpsError("failed-precondition", "Purchase could not be verified.");
  }

  const normalized = normalizeGooglePlaySubscription(subscription, input, nowMs);
  if (!normalized.valid) {
    throw new HttpsError("failed-precondition", "Purchase could not be verified.");
  }

  if (!normalized.entitlementActive || !normalized.expiryTimeMs || normalized.expiryTimeMs <= nowMs) {
    throw new HttpsError("failed-precondition", "Subscription is not active.");
  }

  const acknowledged = await acknowledgeIfNeeded(googlePlayClient, input, normalized);
  await writeVerifiedSubscription({
    db,
    uid,
    input,
    tokenHash,
    normalized,
    acknowledged,
  });

  return {
    success: true,
    entitlementActive: true,
    plan: input.productConfig.plan,
    expiresAt: new Date(normalized.expiryTimeMs).toISOString(),
  };
}

async function handleVerifyGooglePlayPurchaseRequest({
  db,
  request,
  googlePlayClient = createGooglePlayClient(),
  nowMs = Date.now(),
}) {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to verify purchases.");
  }

  return verifyPurchaseForUser({
    db,
    uid,
    data: request.data,
    googlePlayClient,
    nowMs,
  });
}

function createVerifyGooglePlayPurchaseFunction(db, options = {}) {
  return onCall({
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    enforceAppCheck: process.env.SPLITPRO_ENFORCE_APP_CHECK === "true",
    consumeAppCheckToken: process.env.SPLITPRO_CONSUME_APP_CHECK_TOKEN === "true",
  }, async (request) => handleVerifyGooglePlayPurchaseRequest({
    db,
    request,
    googlePlayClient: options.googlePlayClient,
  }));
}

module.exports = {
  GRANTING_STATUSES,
  createVerifyGooglePlayPurchaseFunction,
  handleVerifyGooglePlayPurchaseRequest,
  mapSubscriptionStatus,
  normalizeGooglePlaySubscription,
  validateInput,
  verifyPurchaseForUser,
};
