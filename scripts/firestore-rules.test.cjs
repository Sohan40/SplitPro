/* eslint-env node, es2020 */

const fs = require('fs');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} = require('firebase/firestore');

const PROJECT_ID = 'demo-splitpro-rules';

const group = {
  id: 'group-1',
  name: 'Apartment',
  createdBy: 'alice',
  members: [
    { uid: 'alice', name: 'Alice', email: 'alice@example.com', photoUrl: null },
    { uid: 'bob', name: 'Bob', email: 'bob@example.com', photoUrl: null },
  ],
  memberIds: ['alice', 'bob'],
  balances: { alice: 0, bob: 0 },
  createdAt: 1710000000000,
  updatedAt: 1710000000000,
};

const expense = {
  id: 'expense-1',
  groupId: 'group-1',
  description: 'Dinner',
  amount: 120,
  category: 'food',
  paidBy: { uid: 'alice', name: 'Alice' },
  splitType: 'equal',
  participants: [
    { uid: 'alice', name: 'Alice', amount: 60 },
    { uid: 'bob', name: 'Bob', amount: 60 },
  ],
  createdBy: 'alice',
  createdAt: 1710000000000,
};

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

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });

  try {
    await testEnv.clearFirestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users/alice'), {
        id: 'alice',
        name: 'Alice',
        email: 'alice@example.com',
        photoUrl: null,
        createdAt: 1710000000000,
      });
      await setDoc(doc(db, 'groups/group-1'), group);
      await setDoc(doc(db, 'expenses/expense-1'), expense);
    });

    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const charlieDb = testEnv.authenticatedContext('charlie').firestore();

    await runTest('user can read own profile', async () => {
      await assertSucceeds(getDoc(doc(aliceDb, 'users/alice')));
    });

    await runTest('user cannot read another profile', async () => {
      await assertFails(getDoc(doc(bobDb, 'users/alice')));
    });

    await runTest('safe profile update is allowed', async () => {
      await assertSucceeds(updateDoc(doc(aliceDb, 'users/alice'), {
        name: 'Alice Updated',
        updatedAt: 1710000001000,
      }));
    });

    await runTest('client entitlement update is denied', async () => {
      await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
        entitlement: {
          ai: {
            active: true,
            plan: 'test',
            status: 'active',
            provider: 'manual_test',
            expiresAt: null,
            updatedAt: 1710000001000,
          },
        },
      }));
    });

    await runTest('client aiUsage update is denied', async () => {
      await assertFails(updateDoc(doc(aliceDb, 'users/alice'), {
        aiUsage: {
          periodKey: '2026-05',
          used: 0,
          limit: 100,
          resetAt: 1710000001000,
          updatedAt: 1710000001000,
        },
      }));
    });

    await runTest('subscription writes are denied', async () => {
      await assertFails(setDoc(doc(aliceDb, 'subscriptions/alice'), {
        uid: 'alice',
        provider: 'manual_test',
        productId: null,
        purchaseTokenHash: null,
        status: 'active',
        expiryTime: null,
        lastVerifiedAt: null,
        createdAt: 1710000000000,
        updatedAt: 1710000000000,
      }));
    });

    await runTest('ai usage event writes are denied', async () => {
      await assertFails(setDoc(doc(aliceDb, 'aiUsageEvents/event-1'), {
        uid: 'alice',
        groupId: 'group-1',
        feature: 'monthly_summary',
        periodKey: '2026-05',
        status: 'success',
        createdAt: 1710000000000,
      }));
    });

    await runTest('group member can read group', async () => {
      await assertSucceeds(getDoc(doc(aliceDb, 'groups/group-1')));
    });

    await runTest('non-member cannot read group', async () => {
      await assertFails(getDoc(doc(charlieDb, 'groups/group-1')));
    });

    await runTest('member can create valid expense', async () => {
      await assertSucceeds(setDoc(doc(aliceDb, 'expenses/expense-2'), {
        ...expense,
        id: 'expense-2',
      }));
    });

    await runTest('invalid expense amount is denied', async () => {
      await assertFails(setDoc(doc(aliceDb, 'expenses/expense-invalid'), {
        ...expense,
        id: 'expense-invalid',
        amount: 0,
      }));
    });

    await runTest('non-member cannot create group expense', async () => {
      await assertFails(setDoc(doc(charlieDb, 'expenses/expense-3'), {
        ...expense,
        id: 'expense-3',
        createdBy: 'charlie',
      }));
    });

    await runTest('group AI insight read is member-only', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'groups/group-1/aiInsights/insight-1'), {
          groupId: 'group-1',
          feature: 'monthly_summary',
          summaryHash: 'hash',
          generatedBy: 'server',
          content: 'Summary',
          createdAt: 1710000000000,
          expiresAt: 1710000000000,
        });
      });

      await assertSucceeds(getDoc(doc(bobDb, 'groups/group-1/aiInsights/insight-1')));
      await assertFails(getDoc(doc(charlieDb, 'groups/group-1/aiInsights/insight-1')));
    });

    await runTest('client cannot write group AI insight', async () => {
      await assertFails(setDoc(doc(aliceDb, 'groups/group-1/aiInsights/insight-2'), {
        groupId: 'group-1',
        feature: 'monthly_summary',
        summaryHash: 'hash',
        generatedBy: 'alice',
        content: 'Client summary',
        createdAt: 1710000000000,
        expiresAt: 1710000000000,
      }));
    });

    await runTest('member can delete expense', async () => {
      await assertSucceeds(deleteDoc(doc(bobDb, 'expenses/expense-1')));
    });
  } finally {
    await testEnv.cleanup();
  }
}

main().catch(() => {
  process.exit(1);
});
