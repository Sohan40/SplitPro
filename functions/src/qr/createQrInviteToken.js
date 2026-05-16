const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { hashInviteToken } = require("./hashInviteToken");

const TOKEN_BYTES = 32;
const TOKEN_TTL_MINUTES = 15;

/**
 * Generate a cryptographically random invite token, store its hash in Firestore,
 * and return the raw token to the client for QR display.
 *
 * Only one active token per user — previous tokens are deleted.
 */
async function handleCreateQrInviteToken({ db, request }) {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to generate a QR invite.");
  }

  // Generate random token
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = hashInviteToken(rawToken);

  const now = Date.now();
  const expiresAtMs = now + TOKEN_TTL_MINUTES * 60 * 1000;

  // Delete any existing tokens for this user (one active at a time)
  const existingTokens = await db.collection("qrInvites")
    .where("uid", "==", uid)
    .get();

  const batch = db.batch();
  existingTokens.forEach((doc) => batch.delete(doc.ref));

  // Write new token
  const tokenRef = db.collection("qrInvites").doc(tokenHash);
  batch.set(tokenRef, {
    uid,
    tokenHash,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(expiresAtMs),
  });

  await batch.commit();

  return {
    token: rawToken,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

function createCreateQrInviteTokenFunction(db) {
  return onCall({
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "256MiB",
  }, async (request) => handleCreateQrInviteToken({ db, request }));
}

module.exports = {
  createCreateQrInviteTokenFunction,
  handleCreateQrInviteToken,
};
