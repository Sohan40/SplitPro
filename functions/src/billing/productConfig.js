const GOOGLE_PLAY_PACKAGE_NAME = "com.zyntaillabs.splitpro";
const GOOGLE_PLAY_PROVIDER = "google_play";

const ALLOWED_PRODUCTS = {
  splitpro_ai_monthly: {
    plan: "ai_monthly",
    monthlyLimit: 100,
  },
  splitpro_ai_yearly: {
    plan: "ai_yearly",
    monthlyLimit: 150,
  },
};

function getProductConfig(productId) {
  return ALLOWED_PRODUCTS[productId] || null;
}

module.exports = {
  ALLOWED_PRODUCTS,
  GOOGLE_PLAY_PACKAGE_NAME,
  GOOGLE_PLAY_PROVIDER,
  getProductConfig,
};
