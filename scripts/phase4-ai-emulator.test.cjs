/* eslint-env node, es2020 */

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const {
  assertFails,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  updateDoc,
} = require('firebase/firestore');

const functionsRequire = createRequire(path.resolve(__dirname, '..', 'functions', 'index.js'));
const { initializeApp, getApps } = functionsRequire('firebase-admin/app');
const { getFirestore, Timestamp } = functionsRequire('firebase-admin/firestore');

const PROJECT_ID = 'demo-splitpro-phase4-ai';
const FIRESTORE_HOST = '127.0.0.1:8085';
const AUTH_HOST = '127.0.0.1:9099';
const FUNCTIONS_URL = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/requestSpendInsight`;
const MONTH_KEY = '2026-05';

process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.GOOGLE_CLOUD_PROJECT = PROJECT_ID;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    throw error;
  }
}

async function createAuthUser(email) {
  const response = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'TestPassw0rd!',
      returnSecureToken: true,
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Auth emulator signUp failed for ${email}: ${JSON.stringify(body)}`);
  }

  return {
    uid: body.localId,
    idToken: body.idToken,
  };
}

async function callRequestSpendInsight(idToken, data) {
  const response = await fetch(FUNCTIONS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : {},
  };
}

async function seedFirestore(db, users) {
  const now = Date.UTC(2026, 4, 13, 10, 0, 0);
  const expiresAt = Timestamp.fromMillis(now + 24 * 60 * 60 * 1000);
  const updatedAt = Timestamp.fromMillis(now);

  await db.collection('users').doc(users.free.uid).set({
    id: users.free.uid,
    name: 'Free Member',
    email: 'free@example.com',
    photoUrl: null,
    createdAt: now,
    entitlement: {
      ai: {
        active: false,
        plan: 'free',
        status: 'inactive',
        provider: 'none',
        expiresAt: null,
        updatedAt,
      },
    },
  });

  await db.collection('users').doc(users.entitled.uid).set({
    id: users.entitled.uid,
    name: 'Entitled Member',
    email: 'entitled@example.com',
    photoUrl: null,
    createdAt: now,
    entitlement: {
      ai: {
        active: true,
        plan: 'test',
        status: 'active',
        provider: 'manual_test',
        expiresAt,
        updatedAt,
      },
    },
  });

  await db.collection('users').doc(users.nonMember.uid).set({
    id: users.nonMember.uid,
    name: 'Non Member',
    email: 'nonmember@example.com',
    photoUrl: null,
    createdAt: now,
    entitlement: {
      ai: {
        active: true,
        plan: 'test',
        status: 'active',
        provider: 'manual_test',
        expiresAt,
        updatedAt,
      },
    },
  });

  await db.collection('groups').doc('group-ai-test').set({
    id: 'group-ai-test',
    name: 'AI Test Group',
    createdBy: users.free.uid,
    members: [
      { uid: users.free.uid, name: 'Free Member', email: 'free@example.com', photoUrl: null },
      { uid: users.entitled.uid, name: 'Entitled Member', email: 'entitled@example.com', photoUrl: null },
    ],
    memberIds: [users.free.uid, users.entitled.uid],
    balances: {
      [users.free.uid]: -500,
      [users.entitled.uid]: 500,
    },
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('expenses').doc('expense-ai-1').set({
    id: 'expense-ai-1',
    groupId: 'group-ai-test',
    description: 'Dinner',
    amount: 1200,
    category: 'food',
    paidBy: { uid: users.entitled.uid, name: 'Entitled Member' },
    splitType: 'equal',
    participants: [
      { uid: users.free.uid, name: 'Free Member', amount: 600 },
      { uid: users.entitled.uid, name: 'Entitled Member', amount: 600 },
    ],
    createdBy: users.entitled.uid,
    createdAt: Date.UTC(2026, 4, 4, 12, 0, 0),
    updatedAt: Date.UTC(2026, 4, 4, 12, 0, 0),
  });

  await db.collection('expenses').doc('expense-ai-2').set({
    id: 'expense-ai-2',
    groupId: 'group-ai-test',
    description: 'Groceries',
    amount: 800,
    category: 'groceries',
    paidBy: { uid: users.free.uid, name: 'Free Member' },
    splitType: 'equal',
    participants: [
      { uid: users.free.uid, name: 'Free Member', amount: 400 },
      { uid: users.entitled.uid, name: 'Entitled Member', amount: 400 },
    ],
    createdBy: users.free.uid,
    createdAt: Date.UTC(2026, 4, 6, 12, 0, 0),
    updatedAt: Date.UTC(2026, 4, 6, 12, 0, 0),
  });
}

function getResult(call) {
  return call.body.result || call.body;
}

function getErrorStatus(call) {
  return call.body.error?.status || call.body.error?.message || '';
}

async function main() {
  if (getApps().length === 0) {
    initializeApp({ projectId: PROJECT_ID });
  }

  const db = getFirestore();
  const [freeUser, entitledUser, nonMemberUser] = await Promise.all([
    createAuthUser('free@example.com'),
    createAuthUser('entitled@example.com'),
    createAuthUser('nonmember@example.com'),
  ]);
  const users = {
    free: freeUser,
    entitled: entitledUser,
    nonMember: nonMemberUser,
  };

  await seedFirestore(db, users);

  await runTest('free group member is denied AI access', async () => {
    const call = await callRequestSpendInsight(users.free.idToken, {
      groupId: 'group-ai-test',
      feature: 'monthly_summary',
      monthKey: MONTH_KEY,
    });
    assert(call.status === 400 || call.status === 403, `Expected denial, got ${call.status}`);
    assert(/FAILED_PRECONDITION|PERMISSION_DENIED|AI entitlement/i.test(getErrorStatus(call)), 'Expected entitlement denial');
    const usageDoc = await db.collection('users').doc(users.free.uid).get();
    assert(!usageDoc.data().aiUsage, 'Free member usage should not increment');
  });

  await runTest('test-entitled group member gets mocked AI response', async () => {
    const call = await callRequestSpendInsight(users.entitled.idToken, {
      groupId: 'group-ai-test',
      feature: 'monthly_summary',
      monthKey: MONTH_KEY,
    });
    assert(call.status === 200, `Expected success, got ${call.status}`);
    const result = getResult(call);
    assert(result.cached === false, 'First response should not be cached');
    assert(result.source === 'openai', `Expected mocked OpenAI path, got ${result.source}`);
    assert(result.structured?.title === 'Mock AI spend insight', 'Expected mocked structured response');
    assert(result.usage.used === 1, `Expected usage used=1, got ${result.usage.used}`);
  });

  await runTest('non-member is denied before AI generation', async () => {
    const call = await callRequestSpendInsight(users.nonMember.idToken, {
      groupId: 'group-ai-test',
      feature: 'monthly_summary',
      monthKey: MONTH_KEY,
    });
    assert(call.status === 400 || call.status === 403, `Expected denial, got ${call.status}`);
    assert(/PERMISSION_DENIED|access to this group/i.test(getErrorStatus(call)), 'Expected non-member denial');
    const usageDoc = await db.collection('users').doc(users.nonMember.uid).get();
    assert(!usageDoc.data().aiUsage, 'Non-member usage should not increment');
  });

  await runTest('usage increments only for successful AI generation', async () => {
    const entitledDoc = await db.collection('users').doc(users.entitled.uid).get();
    assert(entitledDoc.data().aiUsage.used === 1, 'Entitled member should have exactly one used credit');

    const usageEvents = await db.collection('aiUsageEvents')
      .where('uid', '==', users.entitled.uid)
      .get();
    assert(usageEvents.size === 1, `Expected one usage event, got ${usageEvents.size}`);
  });

  await runTest('repeated request uses cache and does not increment usage', async () => {
    const call = await callRequestSpendInsight(users.entitled.idToken, {
      groupId: 'group-ai-test',
      feature: 'monthly_summary',
      monthKey: MONTH_KEY,
    });
    assert(call.status === 200, `Expected success, got ${call.status}`);
    const result = getResult(call);
    assert(result.cached === true, 'Second response should come from cache');

    const entitledDoc = await db.collection('users').doc(users.entitled.uid).get();
    assert(entitledDoc.data().aiUsage.used === 1, 'Cached request should not increment usage');
  });

  await runTest('client cannot write entitlement fields', async () => {
    const testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: '127.0.0.1',
        port: 8085,
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
    });

    try {
      const clientDb = testEnv.authenticatedContext(users.free.uid).firestore();
      await assertFails(updateDoc(doc(clientDb, `users/${users.free.uid}`), {
        entitlement: {
          ai: {
            active: true,
            plan: 'test',
            status: 'active',
            provider: 'manual_test',
            expiresAt: null,
            updatedAt: Date.now(),
          },
        },
      }));
    } finally {
      await testEnv.cleanup();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
