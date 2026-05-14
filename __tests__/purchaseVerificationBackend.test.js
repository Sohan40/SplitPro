const {
  handleVerifyGooglePlayPurchaseRequest,
  normalizeGooglePlaySubscription,
} = require("../functions/src/billing/verifyGooglePlayPurchase");
const { hashPurchaseToken } = require("../functions/src/billing/hashPurchaseToken");

const ACTIVE_TOKEN = "purchase-token-active-1234567890";
const OTHER_TOKEN = "purchase-token-other-user-1234567890";
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
  constructor(data) {
    this._data = data;
    this.exists = data !== undefined;
  }

  data() {
    return this._data;
  }
}

class FakeDocRef {
  constructor(db, path) {
    this.db = db;
    this.path = path;
  }

  async get() {
    return new FakeDocSnapshot(this.db.store.get(this.path));
  }

  set(data, options = {}) {
    const existing = this.db.store.get(this.path) || {};
    this.db.store.set(this.path, options.merge ? deepMerge(existing, data) : data);
  }
}

class FakeDb {
  constructor() {
    this.store = new Map();
  }

  collection(name) {
    return {
      doc: (id) => new FakeDocRef(this, `${name}/${id}`),
    };
  }

  async runTransaction(callback) {
    return callback({
      get: (ref) => ref.get(),
      set: (ref, data, options) => ref.set(data, options),
    });
  }

  get(path) {
    return this.store.get(path);
  }

  dumpJson() {
    return JSON.stringify(Object.fromEntries(this.store.entries()));
  }
}

function activeSubscription(productId = "splitpro_ai_monthly") {
  return {
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    lineItems: [{
      productId,
      expiryTime: FUTURE_ISO,
      autoRenewingPlan: {
        autoRenewEnabled: true,
      },
    }],
  };
}

function expiredSubscription() {
  return {
    subscriptionState: "SUBSCRIPTION_STATE_EXPIRED",
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    lineItems: [{
      productId: "splitpro_ai_monthly",
      expiryTime: PAST_ISO,
    }],
  };
}

function makeGoogleClient(response) {
  return {
    getSubscriptionPurchase: jest.fn(async () => response),
    acknowledgeSubscription: jest.fn(async () => undefined),
  };
}

async function verify({
  db = new FakeDb(),
  uid = "uid-a",
  data = {
    productId: "splitpro_ai_monthly",
    purchaseToken: ACTIVE_TOKEN,
    platform: "android",
  },
  googlePlayClient = makeGoogleClient(activeSubscription()),
} = {}) {
  const result = await handleVerifyGooglePlayPurchaseRequest({
    db,
    request: {
      auth: { uid },
      data,
    },
    googlePlayClient,
    nowMs: NOW_MS,
  });

  return { db, result, googlePlayClient };
}

describe("Google Play purchase verification backend", () => {
  it("denies unauthenticated requests", async () => {
    await expect(handleVerifyGooglePlayPurchaseRequest({
      db: new FakeDb(),
      request: { data: {} },
      googlePlayClient: makeGoogleClient(activeSubscription()),
      nowMs: NOW_MS,
    })).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("denies unsupported product IDs", async () => {
    await expect(verify({
      data: {
        productId: "splitpro_ai_lifetime",
        purchaseToken: ACTIVE_TOKEN,
        platform: "android",
      },
    })).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("denies missing purchase tokens", async () => {
    await expect(verify({
      data: {
        productId: "splitpro_ai_monthly",
        purchaseToken: "",
        platform: "android",
      },
    })).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("denies invalid product data from Google Play", async () => {
    await expect(verify({
      googlePlayClient: makeGoogleClient(activeSubscription("some_other_product")),
    })).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("denies expired purchases", async () => {
    await expect(verify({
      googlePlayClient: makeGoogleClient(expiredSubscription()),
    })).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("maps cancelled but unexpired purchases to active access until expiry", () => {
    const normalized = normalizeGooglePlaySubscription({
      subscriptionState: "SUBSCRIPTION_STATE_CANCELED",
      lineItems: [{
        productId: "splitpro_ai_yearly",
        expiryTime: FUTURE_ISO,
      }],
    }, {
      productId: "splitpro_ai_yearly",
    }, NOW_MS);

    expect(normalized.status).toBe("active_until_expiry");
    expect(normalized.entitlementActive).toBe(true);
  });

  it("grants entitlement for active purchases and keeps subscription metadata hash-only", async () => {
    const { db, result, googlePlayClient } = await verify();
    const user = db.get("users/uid-a");
    const subscription = db.get("subscriptions/uid-a");
    const tokenHash = hashPurchaseToken(ACTIVE_TOKEN);

    expect(result).toMatchObject({
      success: true,
      entitlementActive: true,
      plan: "ai_monthly",
    });
    expect(user.entitlement.ai).toMatchObject({
      active: true,
      plan: "ai_monthly",
      status: "active",
      provider: "google_play",
    });
    expect(user.aiUsage.limit).toBe(100);
    expect(subscription).toMatchObject({
      provider: "google_play",
      productId: "splitpro_ai_monthly",
      packageName: "com.zyntaillabs.splitpro",
      status: "active",
      purchaseTokenHash: tokenHash,
    });
    expect(db.get(`subscriptionTokens/${tokenHash}`)).toMatchObject({
      uid: "uid-a",
      productId: "splitpro_ai_monthly",
      provider: "google_play",
      purchaseToken: ACTIVE_TOKEN,
    });
    expect(googlePlayClient.acknowledgeSubscription).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(subscription)).not.toContain(ACTIVE_TOKEN);
  });

  it("is idempotent for repeated verification by the same user", async () => {
    const db = new FakeDb();
    const googlePlayClient = makeGoogleClient(activeSubscription());

    await verify({ db, googlePlayClient });
    db.get("users/uid-a").aiUsage.used = 3;
    await verify({ db, googlePlayClient });

    expect(db.get("users/uid-a").aiUsage.used).toBe(3);
    expect(db.get("users/uid-a").aiUsage.limit).toBe(100);
    expect(googlePlayClient.getSubscriptionPurchase).toHaveBeenCalledTimes(2);
  });

  it("rejects token reuse by another user", async () => {
    const db = new FakeDb();
    const googlePlayClient = makeGoogleClient(activeSubscription());
    await verify({ db, uid: "uid-a", googlePlayClient });

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await expect(verify({
        db,
        uid: "uid-b",
        data: {
          productId: "splitpro_ai_monthly",
          purchaseToken: ACTIVE_TOKEN,
          platform: "android",
        },
        googlePlayClient,
      })).rejects.toMatchObject({ code: "permission-denied" });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does not store raw token for a different active token", async () => {
    const { db } = await verify({
      data: {
        productId: "splitpro_ai_yearly",
        purchaseToken: OTHER_TOKEN,
        platform: "android",
      },
      googlePlayClient: makeGoogleClient(activeSubscription("splitpro_ai_yearly")),
    });

    expect(db.get("users/uid-a").entitlement.ai.plan).toBe("ai_yearly");
    expect(db.get("users/uid-a").aiUsage.limit).toBe(150);
    expect(JSON.stringify(db.get("subscriptions/uid-a"))).not.toContain(OTHER_TOKEN);
  });
});
