jest.mock(
  "firebase-admin/firestore",
  () => ({
    FieldValue: {
      arrayUnion: (...values) => ({ __op: "arrayUnion", values }),
      serverTimestamp: () => ({ __op: "serverTimestamp" }),
    },
    Timestamp: {
      fromMillis: (ms) => ({
        __op: "timestamp",
        ms,
        toMillis: () => ms,
      }),
    },
  }),
  { virtual: true },
);

const { handleCreateQrInviteToken } = require("../functions/src/qr/createQrInviteToken");
const { handleResolveQrInviteToken } = require("../functions/src/qr/resolveQrInviteToken");
const { handleAddMemberByQrToken } = require("../functions/src/qr/addMemberByQrToken");
const { hashInviteToken } = require("../functions/src/qr/hashInviteToken");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setByPath(target, path, value) {
  const parts = path.split(".");
  let current = target;

  for (const part of parts.slice(0, -1)) {
    current[part] = current[part] || {};
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

function applyUpdate(existing, updates) {
  const next = clone(existing);

  Object.entries(updates).forEach(([key, value]) => {
    let nextValue = value;
    if (value?.__op === "arrayUnion") {
      const current = Array.isArray(next[key]) ? next[key] : [];
      nextValue = [...current];
      value.values.forEach((item) => {
        const itemJson = JSON.stringify(item);
        if (!nextValue.some((existingItem) => JSON.stringify(existingItem) === itemJson)) {
          nextValue.push(item);
        }
      });
    }

    if (key.includes(".")) {
      setByPath(next, key, nextValue);
    } else {
      next[key] = nextValue;
    }
  });

  return next;
}

class FakeDocSnapshot {
  constructor(id, data, ref) {
    this.id = id;
    this._data = data;
    this.exists = data !== undefined;
    this.ref = ref;
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
    const id = this.path.split("/").pop();
    return new FakeDocSnapshot(id, this.db.store.get(this.path), this);
  }

  async set(data) {
    this.db.store.set(this.path, data);
  }

  async update(data) {
    const existing = this.db.store.get(this.path);
    if (!existing) {
      throw new Error(`Missing document: ${this.path}`);
    }

    this.db.store.set(this.path, applyUpdate(existing, data));
  }

  async delete() {
    this.db.store.delete(this.path);
  }
}

class FakeQuery {
  constructor(db, collectionName, field, value) {
    this.db = db;
    this.collectionName = collectionName;
    this.field = field;
    this.value = value;
  }

  async get() {
    const docs = [];
    for (const [path, data] of this.db.store.entries()) {
      const relativePath = path.slice(this.collectionName.length + 1);
      if (
        path.startsWith(`${this.collectionName}/`) &&
        !relativePath.includes("/") &&
        data?.[this.field] === this.value
      ) {
        docs.push(new FakeDocSnapshot(path.split("/").pop(), data, new FakeDocRef(this.db, path)));
      }
    }

    return {
      docs,
      empty: docs.length === 0,
      forEach: (callback) => docs.forEach(callback),
    };
  }
}

class FakeCollectionRef {
  constructor(db, name) {
    this.db = db;
    this.name = name;
  }

  doc(id) {
    return new FakeDocRef(this.db, `${this.name}/${id}`);
  }

  where(field, op, value) {
    if (op !== "==") {
      throw new Error(`Unsupported fake query op: ${op}`);
    }

    return new FakeQuery(this.db, this.name, field, value);
  }

  async add(data) {
    const id = `auto-${this.db.nextId++}`;
    this.db.store.set(`${this.name}/${id}`, { id, ...data });
    return this.doc(id);
  }
}

class FakeBatch {
  constructor() {
    this.operations = [];
  }

  set(ref, data) {
    this.operations.push(() => ref.set(data));
  }

  delete(ref) {
    this.operations.push(() => ref.delete());
  }

  async commit() {
    for (const operation of this.operations) {
      await operation();
    }
  }
}

class FakeDb {
  constructor() {
    this.store = new Map();
    this.nextId = 1;
  }

  collection(name) {
    return new FakeCollectionRef(this, name);
  }

  batch() {
    return new FakeBatch();
  }

  set(path, data) {
    this.store.set(path, data);
  }

  get(path) {
    return this.store.get(path);
  }
}

function seedDb() {
  const db = new FakeDb();
  db.set("users/alice", {
    name: "Alice",
    email: "alice@example.com",
    photoUrl: null,
  });
  db.set("users/bob", {
    name: "Bob",
    email: "bob@example.com",
    photoUrl: "https://example.com/bob.png",
  });
  db.set("groups/group-1", {
    id: "group-1",
    name: "Apartment",
    memberIds: ["alice"],
    members: [{ uid: "alice", name: "Alice", email: "alice@example.com", photoUrl: null }],
    balances: { alice: 0 },
    updatedAt: 1710000000000,
  });
  return db;
}

function seedToken(db, rawToken, uid, expiresAtMs = Date.now() + 60000) {
  const tokenHash = hashInviteToken(rawToken);
  db.set(`qrInvites/${tokenHash}`, {
    uid,
    tokenHash,
    createdAt: { __op: "serverTimestamp" },
    expiresAt: {
      toMillis: () => expiresAtMs,
    },
  });
  return tokenHash;
}

describe("QR invite backend", () => {
  it("creates a single active token per authenticated user", async () => {
    const db = seedDb();
    seedToken(db, "old-token", "bob");

    const result = await handleCreateQrInviteToken({
      db,
      request: { auth: { uid: "bob" }, data: {} },
    });

    expect(result.token).toHaveLength(64);
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const qrInvitePaths = Array.from(db.store.keys()).filter((path) => path.startsWith("qrInvites/"));
    expect(qrInvitePaths).toHaveLength(1);
    expect(db.get(`qrInvites/${hashInviteToken(result.token)}`)).toMatchObject({
      uid: "bob",
      tokenHash: hashInviteToken(result.token),
    });
  });

  it("resolves a valid QR token to safe user info", async () => {
    const db = seedDb();
    seedToken(db, "bob-token", "bob");

    const result = await handleResolveQrInviteToken({
      db,
      request: {
        auth: { uid: "alice" },
        data: { token: "bob-token" },
      },
    });

    expect(result).toEqual({
      uid: "bob",
      displayName: "Bob",
      email: "bob@example.com",
    });
  });

  it("adds the QR owner to the caller's group when the caller is a member", async () => {
    const db = seedDb();
    seedToken(db, "bob-token", "bob");

    const result = await handleAddMemberByQrToken({
      db,
      request: {
        auth: { uid: "alice" },
        data: { groupId: "group-1", token: "bob-token" },
      },
    });

    expect(result).toEqual({ success: true, displayName: "Bob" });
    expect(db.get("groups/group-1")).toMatchObject({
      memberIds: ["alice", "bob"],
      balances: { alice: 0, bob: 0 },
    });
    expect(db.get("groups/group-1").members).toContainEqual({
      uid: "bob",
      name: "Bob",
      email: "bob@example.com",
      photoUrl: "https://example.com/bob.png",
    });
    expect(Array.from(db.store.keys()).some((path) => path.startsWith("notifications/"))).toBe(true);
  });

  it("blocks non-members, duplicate members, expired tokens, and missing auth", async () => {
    const db = seedDb();
    seedToken(db, "bob-token", "bob");

    await expect(handleResolveQrInviteToken({
      db,
      request: { data: { token: "bob-token" } },
    })).rejects.toMatchObject({ code: "unauthenticated" });

    await expect(handleAddMemberByQrToken({
      db,
      request: {
        auth: { uid: "charlie" },
        data: { groupId: "group-1", token: "bob-token" },
      },
    })).rejects.toMatchObject({ code: "permission-denied" });

    await handleAddMemberByQrToken({
      db,
      request: {
        auth: { uid: "alice" },
        data: { groupId: "group-1", token: "bob-token" },
      },
    });

    await expect(handleAddMemberByQrToken({
      db,
      request: {
        auth: { uid: "alice" },
        data: { groupId: "group-1", token: "bob-token" },
      },
    })).rejects.toMatchObject({ code: "already-exists" });

    seedToken(db, "expired-token", "bob", Date.now() - 1000);
    await expect(handleResolveQrInviteToken({
      db,
      request: {
        auth: { uid: "alice" },
        data: { token: "expired-token" },
      },
    })).rejects.toMatchObject({ code: "failed-precondition" });
  });
});
