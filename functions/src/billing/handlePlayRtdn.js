const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { Buffer } = require("buffer");
const { createGooglePlayClient } = require("./googlePlayClient");
const { makeEventId, syncSubscriptionFromToken, writeAuditEvent } = require("./syncSubscriptionState");

const PLAY_RTDN_TOPIC = process.env.PLAY_RTDN_TOPIC || "splitpro-play-rtdn";

const SUBSCRIPTION_NOTIFICATION_TYPES = {
  1: "recovered",
  2: "renewed",
  3: "cancelled",
  4: "purchased",
  5: "on_hold",
  6: "grace_period",
  7: "restarted",
  8: "price_change_confirmed",
  9: "deferred",
  10: "paused",
  11: "pause_schedule_changed",
  12: "revoked",
  13: "expired",
  19: "price_step_up_consent_updated",
  20: "pending_purchase_cancelled",
};

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function decodePubSubPayload(message) {
  if (message?.json && typeof message.json === "object") {
    return message.json;
  }

  if (message?.data && typeof message.data === "object" && !Buffer.isBuffer(message.data)) {
    return message.data;
  }

  if (typeof message?.data !== "string") {
    return null;
  }

  const decoded = Buffer.from(message.data, "base64").toString("utf8");
  return safeJsonParse(decoded);
}

function getPubSubMessage(eventOrMessage) {
  return eventOrMessage?.data?.message || eventOrMessage?.message || eventOrMessage?.data || eventOrMessage;
}

function getMessageId(message, fallbackPayload) {
  return message?.messageId || message?.id || fallbackPayload?.eventTimeMillis || null;
}

function hasMessageData(message) {
  return Boolean(message?.data || message?.json);
}

function eventTypeForNotificationType(notificationType) {
  return SUBSCRIPTION_NOTIFICATION_TYPES[Number(notificationType)] || "unknown";
}

function extractRtdnSubscriptionEvent(payload) {
  const subscriptionNotification = payload?.subscriptionNotification;
  if (subscriptionNotification) {
    return {
      eventType: eventTypeForNotificationType(subscriptionNotification.notificationType),
      packageName: payload?.packageName || null,
      productId: subscriptionNotification.subscriptionId || subscriptionNotification.productId || null,
      purchaseToken: subscriptionNotification.purchaseToken || null,
      notificationType: subscriptionNotification.notificationType || null,
      hasPurchaseToken: Boolean(subscriptionNotification.purchaseToken),
    };
  }

  const voidedPurchaseNotification = payload?.voidedPurchaseNotification;
  if (voidedPurchaseNotification) {
    return {
      eventType: "revoked",
      packageName: payload?.packageName || null,
      productId: voidedPurchaseNotification.subscriptionId || voidedPurchaseNotification.productId || null,
      purchaseToken: voidedPurchaseNotification.purchaseToken || null,
      notificationType: "voided_purchase",
      hasPurchaseToken: Boolean(voidedPurchaseNotification.purchaseToken),
    };
  }

  return null;
}

async function handlePlayRtdnEvent({
  db,
  event,
  googlePlayClient = createGooglePlayClient(),
  nowMs = Date.now(),
}) {
  const message = getPubSubMessage(event);
  const payload = decodePubSubPayload(message);
  const messageId = getMessageId(message, payload);

  console.log("handlePlayRtdn received Pub/Sub message", {
    messageId,
    hasData: hasMessageData(message),
  });

  if (!payload) {
    console.log("handlePlayRtdn could not decode RTDN payload", {
      messageId,
      hasData: hasMessageData(message),
    });
    const eventId = makeEventId({ source: "rtdn", messageId, eventType: "invalid_payload" });
    await writeAuditEvent({
      db,
      eventId,
      eventType: "invalid_payload",
      result: "invalid_payload",
    });
    return { processed: false, reason: "invalid_payload" };
  }

  if (payload?.testNotification) {
    console.log("handlePlayRtdn test notification received", {
      messageId,
      packageName: payload?.packageName || null,
      version: payload.testNotification.version || null,
    });
    console.log("handlePlayRtdn ignored test notification safely", {
      messageId,
    });
    const eventId = makeEventId({ source: "rtdn", messageId, eventType: "test_notification" });
    await writeAuditEvent({
      db,
      eventId,
      eventType: "test_notification",
      result: "test_notification",
    });
    return { processed: false, reason: "test_notification" };
  }

  const subscriptionEvent = extractRtdnSubscriptionEvent(payload);
  if (!subscriptionEvent) {
    console.log("handlePlayRtdn decoded RTDN notification", {
      messageId,
      packageName: payload?.packageName || null,
      eventType: "unsupported_notification",
      hasPurchaseToken: false,
    });
    const eventId = makeEventId({ source: "rtdn", messageId, eventType: "unsupported_notification" });
    await writeAuditEvent({
      db,
      eventId,
      eventType: "unsupported_notification",
      result: "unsupported_notification",
    });
    return { processed: false, reason: "unsupported_notification" };
  }

  console.log("handlePlayRtdn decoded RTDN notification", {
    messageId,
    packageName: subscriptionEvent.packageName,
    productId: subscriptionEvent.productId,
    eventType: subscriptionEvent.eventType,
    notificationType: subscriptionEvent.notificationType,
    hasPurchaseToken: subscriptionEvent.hasPurchaseToken,
  });

  const eventId = makeEventId({
    source: "rtdn",
    messageId,
    eventType: subscriptionEvent.eventType,
  });

  return syncSubscriptionFromToken({
    db,
    productId: subscriptionEvent.productId,
    purchaseToken: subscriptionEvent.purchaseToken,
    source: "rtdn",
    eventType: subscriptionEvent.eventType,
    eventId,
    googlePlayClient,
    nowMs,
    requireLinkedUser: true,
  });
}

function createHandlePlayRtdnFunction(db, options = {}) {
  return onMessagePublished({
    topic: options.topic || PLAY_RTDN_TOPIC,
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
  }, async (event) => handlePlayRtdnEvent({
    db,
    event,
    googlePlayClient: options.googlePlayClient,
  }));
}

module.exports = {
  PLAY_RTDN_TOPIC,
  SUBSCRIPTION_NOTIFICATION_TYPES,
  createHandlePlayRtdnFunction,
  decodePubSubPayload,
  extractRtdnSubscriptionEvent,
  handlePlayRtdnEvent,
};
