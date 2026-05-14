const { google } = require("googleapis");
const { GOOGLE_PLAY_PACKAGE_NAME } = require("./productConfig");

const ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

async function getAndroidPublisher() {
  const auth = await google.auth.getClient({
    scopes: [ANDROID_PUBLISHER_SCOPE],
  });

  return {
    androidpublisher: google.androidpublisher("v3"),
    auth,
  };
}

function createGooglePlayClient() {
  return {
    async getSubscriptionPurchase({ packageName = GOOGLE_PLAY_PACKAGE_NAME, purchaseToken }) {
      const { androidpublisher, auth } = await getAndroidPublisher();
      const response = await androidpublisher.purchases.subscriptionsv2.get({
        auth,
        packageName,
        token: purchaseToken,
      });

      return response.data;
    },

    async acknowledgeSubscription({ packageName = GOOGLE_PLAY_PACKAGE_NAME, productId, purchaseToken }) {
      const { androidpublisher, auth } = await getAndroidPublisher();
      await androidpublisher.purchases.subscriptions.acknowledge({
        auth,
        packageName,
        subscriptionId: productId,
        token: purchaseToken,
        requestBody: {},
      });
    },
  };
}

module.exports = {
  ANDROID_PUBLISHER_SCOPE,
  createGooglePlayClient,
};
