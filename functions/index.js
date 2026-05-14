const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { createRequestSpendInsightFunction } = require("./src/ai/requestSpendInsight");
const { createHandlePlayRtdnFunction } = require("./src/billing/handlePlayRtdn");
const { createReconcileActiveSubscriptionsFunction } = require("./src/billing/reconcileActiveSubscriptions");
const { createVerifyGooglePlayPurchaseFunction } = require("./src/billing/verifyGooglePlayPurchase");

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

exports.requestSpendInsight = createRequestSpendInsightFunction(db);
exports.verifyGooglePlayPurchase = createVerifyGooglePlayPurchaseFunction(db);
exports.handlePlayRtdn = createHandlePlayRtdnFunction(db);
exports.reconcileActiveSubscriptions = createReconcileActiveSubscriptionsFunction(db);

/**
 * Cloud Function: sendPushOnNotificationCreate
 *
 * Triggers whenever a new document is created in the `notifications` collection.
 * Reads the target user's FCM tokens from their Firestore user document,
 * then sends a push notification via FCM v1 API.
 *
 * Notification doc shape (from the app):
 * {
 *   id, userId, title, body, type, read, createdAt,
 *   data?: { groupId?, expenseId? }
 * }
 */
exports.sendPushOnNotificationCreate = onDocumentCreated(
  "notifications/{notificationId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data in event, skipping.");
      return;
    }

    const notification = snapshot.data();
    const { userId, title, body, type, data } = notification;

    if (!userId) {
      console.error("Notification missing userId, skipping.");
      return;
    }

    // Look up the target user's FCM tokens
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.log(`User ${userId} not found, skipping push.`);
      return;
    }

    const userData = userDoc.data();
    const fcmTokens = userData.fcmTokens;

    if (!fcmTokens || fcmTokens.length === 0) {
      console.log(`User ${userId} has no FCM tokens, skipping push.`);
      return;
    }

    // Build the FCM message payload
    const payload = {
      notification: {
        title: title || "SplitPro",
        body: body || "You have a new notification",
      },
      data: {
        type: type || "general",
        notificationId: event.params.notificationId,
        ...(data?.groupId ? { groupId: data.groupId } : {}),
        ...(data?.expenseId ? { expenseId: data.expenseId } : {}),
      },
      android: {
        notification: {
          channelId: "splitpro_default",
          priority: "high",
          defaultSound: true,
        },
      },
    };

    // Send to all of the user's devices
    const tokensToRemove = [];

    const sendPromises = fcmTokens.map(async (token) => {
      try {
        await messaging.send({ ...payload, token });
        console.log(`Push sent to token: ${token.substring(0, 10)}...`);
      } catch (error) {
        console.error(`Error sending to token ${token.substring(0, 10)}...:`, error.code);

        // Clean up invalid/expired tokens
        if (
          error.code === "messaging/invalid-registration-token" ||
          error.code === "messaging/registration-token-not-registered"
        ) {
          tokensToRemove.push(token);
        }
      }
    });

    await Promise.all(sendPromises);

    // Remove any stale tokens from Firestore
    if (tokensToRemove.length > 0) {
      const { FieldValue } = require("firebase-admin/firestore");
      await db
        .collection("users")
        .doc(userId)
        .update({
          fcmTokens: FieldValue.arrayRemove(...tokensToRemove),
        });
      console.log(`Removed ${tokensToRemove.length} stale token(s) for user ${userId}`);
    }
  }
);
