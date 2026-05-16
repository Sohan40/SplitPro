const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { hashInviteToken } = require("./hashInviteToken");

/**
 * Resolve a raw QR invite token to safe user info.
 * Does NOT add to any group — just returns identity for confirmation UI.
 */
async function handleResolveQrInviteToken({ db, request }) {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to scan QR codes.");
  }

  const rawToken = typeof request.data?.token === "string"
    ? request.data.token.trim()
    : "";

  if (!rawToken) {
    throw new HttpsError("invalid-argument", "A valid QR token is required.");
  }

  const tokenHash = hashInviteToken(rawToken);
  const tokenDoc = await db.collection("qrInvites").doc(tokenHash).get();

  if (!tokenDoc.exists) {
    throw new HttpsError("not-found", "This QR code is invalid or has expired.");
  }

  const tokenData = tokenDoc.data();

  // Check expiry
  const expiresAtMs = tokenData.expiresAt?.toMillis?.() || 0;
  if (Date.now() > expiresAtMs) {
    throw new HttpsError(
      "failed-precondition",
      "This QR code has expired. Ask the user to generate a new one."
    );
  }

  // Look up target user
  const targetUserDoc = await db.collection("users").doc(tokenData.uid).get();
  if (!targetUserDoc.exists) {
    throw new HttpsError("not-found", "The user associated with this QR code was not found.");
  }

  const targetUser = targetUserDoc.data();

  return {
    uid: tokenData.uid,
    displayName: targetUser.name || "Unknown",
    email: targetUser.email || "",
  };
}

function createResolveQrInviteTokenFunction(db) {
  return onCall({
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "256MiB",
  }, async (request) => handleResolveQrInviteToken({ db, request }));
}

module.exports = {
  createResolveQrInviteTokenFunction,
  handleResolveQrInviteToken,
};
