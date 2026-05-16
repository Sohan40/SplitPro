const {
  handleAddMemberByEmail,
  handleResolveUserByEmail,
} = require("../functions/src/groups/userEmailLookup");

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
  constructor(db, path) {
    this.db = db;
    this.path = path;
  }

  async get() {
    const id = this.path.split("/").pop();
    return new FakeDocSnapshot(id, this.db.store.get(this.path));
  }

  async update(data) {
    const existing = this.db.store.get(this.path);
    if (!existing) {
      throw new Error(`Missing document: ${this.path}`);
    }

    this.db.store.set(this.path, {
      ...existing,
      ...data,
    });
  }
}

class FakeQuery {
  constructor(db, collectionName, field, value) {
    this.db = db;
    this.collectionName = collectionName;
    this.field = field;
    this.value = value;
  }

  limit() {
    return this;
  }

  async get() {
    const docs = [];
    for (const [path, data] of this.db.store.entries()) {
      if (
        path.startsWith(`${this.collectionName}/`) &&
        !path.slice(this.collectionName.length + 1).includes("/") &&
        data?.[this.field] === this.value
      ) {
        docs.push(new FakeDocSnapshot(path.split("/").pop(), data));
      }
    }

    return {
      docs,
      empty: docs.length === 0,
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

class FakeDb {
  constructor() {
    this.store = new Map();
    this.nextId = 1;
  }

  collection(name) {
    return new FakeCollectionRef(this, name);
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

describe("email member invite backend", () => {
  it("requires authentication for email lookup", async () => {
    await expect(handleResolveUserByEmail({
      db: seedDb(),
      request: { data: { email: "bob@example.com" } },
    })).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("resolves an exact email without client Firestore profile reads", async () => {
    const result = await handleResolveUserByEmail({
      db: seedDb(),
      request: {
        auth: { uid: "alice" },
        data: { email: " BOB@example.com " },
      },
    });

    expect(result).toEqual({
      uid: "bob",
      name: "Bob",
      email: "bob@example.com",
      photoUrl: "https://example.com/bob.png",
    });
  });

  it("adds a matched user only when the caller is already a group member", async () => {
    const db = seedDb();

    await expect(handleAddMemberByEmail({
      db,
      request: {
        auth: { uid: "charlie" },
        data: { groupId: "group-1", email: "bob@example.com" },
      },
    })).rejects.toMatchObject({ code: "permission-denied" });

    const result = await handleAddMemberByEmail({
      db,
      request: {
        auth: { uid: "alice" },
        data: { groupId: "group-1", email: "bob@example.com" },
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
  });
});
