#!/usr/bin/env node

const {
  buildGrantPayload,
  getUserRef,
  initializeAdmin,
  parseArgs,
} = require("./adminTestEntitlementUtils");

async function main() {
  const { uid, hours } = parseArgs(
    process.argv.slice(2),
    "admin:grant-ai-test",
    { allowHours: true },
  );
  const db = initializeAdmin();
  const userRef = getUserRef(db, uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new Error("User document does not exist. Create the SplitPro profile before granting test entitlement.");
  }

  await userRef.set(buildGrantPayload(hours), { merge: true });

  console.log(`Granted temporary AI test entitlement to UID ${uid} for ${hours} hour(s).`);
  console.log("This is an Admin SDK-only test entitlement. No client code can grant it.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
