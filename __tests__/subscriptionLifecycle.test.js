const { handlePlayRtdnEvent } = require("../functions/src/billing/handlePlayRtdn");
const { reconcileActiveSubscriptions } = require("../functions/src/billing/syncSubscriptionState");
const { hashPurchaseToken } = require("../functions/src/billing/hashPurchaseToken");
const { Buffer } = require("buffer");

const ACTIVE_TOKEN = "purchase-token-lifecycle-active-1234567890";
const EXPIRED_TOKEN = "purchase-token-lifecycle-expired-1234567890";
const NOW_MS = Date.UTC(2026, 4, 14, 10, 0, 0);
const FUTURE_ISO = new Date(NOW_MS + 30 * 24 * 60 * 60 * 1000).toISOString();
const PAST_ISO = new Date(NOW_MS - 24 * 60 * 60 * 1000).toISOString();

function deepMerge(target, source) {
  const output = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(typeof value.toMillis === "function") &&
      !(value.constructor && value.constructor.name.includes("FieldValue"))
    ) {
      output[key] = deepMerge(output[key] || {}, value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

class FakeDocSnapshot {
  constructor(id, data) {
    this.id = id;
    this._data = data;
    this.exists = data !== undefined;
  }

  data() {
    return this._data;
  }
}

class FakeDocRef {
  constructor(db, collectionName, id) {
    this.db = db;
    this.collectionName = collectionName;
    this.id = id;
    this.path = `${collectionName}/${id}`;
  }

  async get() {
    return new FakeDocSnapshot(this.id, this.db.store.get(this.path));
  }

  set(data, options = {}) {
    const existing = this.db.store.get(this.path) || {};
    this.db.store.set(this.path, options.merge ? deepMerge(existing, data) : data);
  }
}

class FakeQuery {
  constructor(db, collectionName, filters = [], queryLimit = null) {
    this.db = db;
    this.collectionName = collectionName;
    this.filters = filters;
    this.queryLimit = queryLimit;
  }

  where(field, operator, value) {
    return new FakeQuery(this.db, this.collectionName, [...this.filters, { field, operator, value }], this.queryLimit);
  }

  limit(value) {
    return new FakeQuery(this.db, this.collectionName, this.filters, value);
  }

  async get() {
    const prefix = `${this.collectionName}/`;
    let docs = Array.from(this.db.store.entries())
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
      .map(([path, data]) => new FakeDocSnapshot(path.slice(prefix.length), data));

    for (const filter of this.filters) {
      docs = docs.filter((doc) => {
        if (filter.operator !== "==") return false;
        return doc.data()?.[filter.field] === filter.value;
      });
    }

    if (this.queryLimit !== null) {
      docs = docs.slice(0, this.queryLimit);
    }

    return { docs, empty: docs.length === 0 };
  }
}

class FakeDb {
  constructor() {
    this.store = new Map();
  }

  collection(name) {
    const query = new FakeQuery(this, name);
    return {
      doc: (id) => new FakeDocRef(this, name, id),
      where: (...args) => query.where(...args),
      limit: (...args) => query.limit(...args),
    };
  }

  async runTransaction(callback) {
    return callback({
      get: (ref) => ref.get(),
      set: (ref, data, options) => ref.set(data, options),
    });
  }

  set(path, data) {
    this.store.set(path, data);
  }

  get(path) {
    return this.store.get(path);
  }

  dumpJson() {
    return JSON.stringify(Object.fromEntries(this.store.entries()));
  }
}

function subscription({ state, productId = "splitpro_ai_monthly", expiryTime = FUTURE_ISO }) {
  return {
    subscriptionState: state,
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    lineItems: [{
      productId,
      expiryTime,
      autoRenewingPlan: {
        autoRenewEnabled: state === "SUBSCRIPTION_STATE_ACTIVE",
      },
    }],
  };
}

function googleClientFor(responseByToken) {
  return {
    getSubscriptionPurchase: jest.fn(async ({ purchaseToken }) => {
      const response = responseByToken[purchaseToken];
      if (response instanceof Error) {
        throw response;
      }
      return response;
    }),
    acknowledgeSubscription: jest.fn(async () => undefined),
  };
}

function seedLinkedToken(db, { uid = "uid-a", token = ACTIVE_TOKEN, productId = "splitpro_ai_monthly" } = {}) {
  const tokenHash = hashPurchaseToken(token);
  db.set(`subscriptionTokens/${tokenHash}`, {
    uid,
    productId,
    provider: "google_play",
    purchaseToken: token,
  });
  db.set(`subscriptions/${uid}`, {
    uid,
    provider: "google_play",
    productId,
    status: "active",
    purchaseTokenHash: tokenHash,
  });
  db.set(`users/${uid}`, {
    entitlement: {
      ai: {
        active: true,
        plan: "ai_monthly",
        status: "active",
        provider: "google_play",
      },
    },
  });
  return tokenHash;
}

function rtdnMessage({ token = ACTIVE_TOKEN, productId = "splitpro_ai_monthly", type = 2, messageId = "msg-1" } = {}) {
  const payload = {
    version: "1.0",
    packageName: "com.zyntaillabs.splitpro",
    eventTimeMillis: String(NOW_MS),
    subscriptionNotification: {
      version: "1.0",
      notificationType: type,
      purchaseToken: token,
      subscriptionId: productId,
    },
  };

  return {
    data: {
      message: {
        messageId,
        data: Buffer.from(JSON.stringify(payload), "utf8").toString("base64"),
      },
    },
  };
}

function testRtdnMessage({ messageId = "msg-test" } = {}) {
  const payload = {
    version: "1.0",
    packageName: "com.zyntaillabs.splitpro",
    eventTimeMillis: String(NOW_MS),
    testNotification: {
      version: "1.0",
    },
  };

  return {
    data: {
      message: {
        messageId,
        data: Buffer.from(JSON.stringify(payload), "utf8").toString("base64"),
      },
    },
  };
}

describe("Google Play subscription lifecycle sync", () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("uses RTDN as a trigger and re-verifies active state with Google Play", async () => {
    const db = new FakeDb();
    const tokenHash = seedLinkedToken(db);
    const googlePlayClient = googleClientFor({
      [ACTIVE_TOKEN]: subscription({ state: "SUBSCRIPTION_STATE_ACTIVE" }),
    });

    const result = await handlePlayRtdnEvent({
      db,
      event: rtdnMessage(),
      googlePlayClient,
      nowMs: NOW_MS,
    });

    expect(result).toMatchObject({
      processed: true,
      status: "active",
      entitlementActive: true,
    });
    expect(googlePlayClient.getSubscriptionPurchase).toHaveBeenCalledWith({
      packageName: "com.zyntaillabs.splitpro",
      purchaseToken: ACTIVE_TOKEN,
    });
    expect(db.get("users/uid-a").entitlement.ai).toMatchObject({
      active: true,
      status: "active",
    });
    expect(db.get("subscriptionEvents/rtdn_msg-1")).toMatchObject({
      eventType: "renewed",
      purchaseTokenHash: tokenHash,
      newStatus: "active",
      rawEventStored: false,
    });
    expect(JSON.stringify(db.get("subscriptionEvents/rtdn_msg-1"))).not.toContain(ACTIVE_TOKEN);
    expect(JSON.stringify(db.get("subscriptions/uid-a"))).not.toContain(ACTIVE_TOKEN);
    expect(logSpy).toHaveBeenCalledWith("handlePlayRtdn received Pub/Sub message", expect.objectContaining({
      messageId: "msg-1",
      hasData: true,
    }));
    expect(logSpy).toHaveBeenCalledWith("handlePlayRtdn decoded RTDN notification", expect.objectContaining({
      eventType: "renewed",
      notificationType: 2,
      packageName: "com.zyntaillabs.splitpro",
      productId: "splitpro_ai_monthly",
      hasPurchaseToken: true,
    }));
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain(ACTIVE_TOKEN);
  });

  it("logs and safely ignores Play Console test notifications", async () => {
    const db = new FakeDb();
    const googlePlayClient = googleClientFor({});

    const result = await handlePlayRtdnEvent({
      db,
      event: testRtdnMessage(),
      googlePlayClient,
      nowMs: NOW_MS,
    });

    expect(result).toMatchObject({
      processed: false,
      reason: "test_notification",
    });
    expect(googlePlayClient.getSubscriptionPurchase).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("handlePlayRtdn test notification received", expect.objectContaining({
      messageId: "msg-test",
      packageName: "com.zyntaillabs.splitpro",
      version: "1.0",
    }));
    expect(logSpy).toHaveBeenCalledWith("handlePlayRtdn ignored test notification safely", expect.objectContaining({
      messageId: "msg-test",
    }));
    expect(db.get("subscriptionEvents/rtdn_msg-test")).toMatchObject({
      eventType: "test_notification",
      result: "test_notification",
      rawEventStored: false,
    });
  });

  it("revokes entitlement when Google Play reports expired", async () => {
    const db = new FakeDb();
    seedLinkedToken(db, { token: EXPIRED_TOKEN });
    const googlePlayClient = googleClientFor({
      [EXPIRED_TOKEN]: subscription({
        state: "SUBSCRIPTION_STATE_EXPIRED",
        expiryTime: PAST_ISO,
      }),
    });

    await handlePlayRtdnEvent({
      db,
      event: rtdnMessage({ token: EXPIRED_TOKEN, type: 13, messageId: "msg-expired" }),
      googlePlayClient,
      nowMs: NOW_MS,
    });

    expect(db.get("users/uid-a").entitlement.ai).toMatchObject({
      active: false,
      status: "expired",
      provider: "google_play",
    });
    expect(db.get("subscriptions/uid-a")).toMatchObject({
      status: "expired",
      provider: "google_play",
    });
  });

  it("keeps grace period access active according to policy", async () => {
    const db = new FakeDb();
    seedLinkedToken(db);
    const googlePlayClient = googleClientFor({
      [ACTIVE_TOKEN]: subscription({ state: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" }),
    });

    await handlePlayRtdnEvent({
      db,
      event: rtdnMessage({ type: 6, messageId: "msg-grace" }),
      googlePlayClient,
      nowMs: NOW_MS,
    });

    expect(db.get("users/uid-a").entitlement.ai).toMatchObject({
      active: true,
      status: "grace_period",
    });
  });

  it("does not update entitlement for an unlinked RTDN token", async () => {
    const db = new FakeDb();
    const googlePlayClient = googleClientFor({
      [ACTIVE_TOKEN]: subscription({ state: "SUBSCRIPTION_STATE_ACTIVE" }),
    });

    const result = await handlePlayRtdnEvent({
      db,
      event: rtdnMessage(),
      googlePlayClient,
      nowMs: NOW_MS,
    });

    expect(result).toMatchObject({
      processed: false,
      reason: "unlinked_purchase_token",
    });
    expect(googlePlayClient.getSubscriptionPurchase).not.toHaveBeenCalled();
    expect(db.dumpJson()).not.toContain(ACTIVE_TOKEN);
  });

  it("reconciles linked subscription tokens on the schedule path", async () => {
    const db = new FakeDb();
    seedLinkedToken(db, { token: ACTIVE_TOKEN });
    seedLinkedToken(db, { uid: "uid-b", token: EXPIRED_TOKEN });
    const googlePlayClient = googleClientFor({
      [ACTIVE_TOKEN]: subscription({ state: "SUBSCRIPTION_STATE_ACTIVE" }),
      [EXPIRED_TOKEN]: subscription({
        state: "SUBSCRIPTION_STATE_EXPIRED",
        expiryTime: PAST_ISO,
      }),
    });

    const result = await reconcileActiveSubscriptions({
      db,
      googlePlayClient,
      nowMs: NOW_MS,
    });

    expect(result).toMatchObject({
      checked: 2,
      processed: 2,
      skipped: 0,
    });
    expect(db.get("users/uid-a").entitlement.ai.active).toBe(true);
    expect(db.get("users/uid-b").entitlement.ai).toMatchObject({
      active: false,
      status: "expired",
    });
  });

  it("handles revoked notification after Google Play confirms the token is gone", async () => {
    const db = new FakeDb();
    seedLinkedToken(db);
    const notFound = new Error("gone");
    notFound.code = 410;
    const googlePlayClient = googleClientFor({
      [ACTIVE_TOKEN]: notFound,
    });

    await handlePlayRtdnEvent({
      db,
      event: rtdnMessage({ type: 12, messageId: "msg-revoked" }),
      googlePlayClient,
      nowMs: NOW_MS,
    });

    expect(db.get("users/uid-a").entitlement.ai).toMatchObject({
      active: false,
      status: "revoked",
    });
    expect(JSON.stringify(db.get("subscriptionEvents/rtdn_msg-revoked"))).not.toContain(ACTIVE_TOKEN);
  });
});
