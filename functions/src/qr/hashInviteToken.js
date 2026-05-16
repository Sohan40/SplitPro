const crypto = require("crypto");

/**
 * Hash a raw QR invite token with SHA-256.
 * Only the hash is stored in Firestore — the raw token never persists server-side.
 */
function hashInviteToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

module.exports = { hashInviteToken };
