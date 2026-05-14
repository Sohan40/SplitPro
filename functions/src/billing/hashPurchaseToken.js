const crypto = require("crypto");

function hashPurchaseToken(purchaseToken) {
  return crypto
    .createHash("sha256")
    .update(purchaseToken, "utf8")
    .digest("hex");
}

module.exports = {
  hashPurchaseToken,
};
