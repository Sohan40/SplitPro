#!/usr/bin/env node

const {
  buildRevokePayload,
  getUserRef,
  initializeAdmin,
  parseArgs,
} = require("./adminTestEntitlementUtils");

async function main() {
  const { uid } = parseArgs(process.argv.slice(2), "admin:revoke-ai-test");
  const db = initializeAdmin();
  const userRef = getUserRef(db, uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new Error("User document does not exist. Nothing was revoked.");
  }

  await userRef.set(buildRevokePayload(), { merge: true });

  console.log(`Revoked AI test entitlement for UID ${uid}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
