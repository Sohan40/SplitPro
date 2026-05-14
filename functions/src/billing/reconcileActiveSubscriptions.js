const { onSchedule } = require("firebase-functions/v2/scheduler");
const { createGooglePlayClient } = require("./googlePlayClient");
const { reconcileActiveSubscriptions } = require("./syncSubscriptionState");

function createReconcileActiveSubscriptionsFunction(db, options = {}) {
  return onSchedule({
    schedule: options.schedule || "every 24 hours",
    timeZone: "Asia/Kolkata",
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "256MiB",
  }, async () => reconcileActiveSubscriptions({
    db,
    googlePlayClient: options.googlePlayClient || createGooglePlayClient(),
    limit: options.limit || 200,
  }));
}

module.exports = {
  createReconcileActiveSubscriptionsFunction,
};
