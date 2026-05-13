const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const DEFAULT_TEST_HOURS = 24;
const MAX_TEST_HOURS = 24 * 14;
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;

function usage(commandName, allowHours = false) {
  return [
    allowHours
      ? `Usage: npm run ${commandName} -- <firebase-auth-uid> [--hours <1-${MAX_TEST_HOURS}>]`
      : `Usage: npm run ${commandName} -- <firebase-auth-uid>`,
    "",
    "Authentication:",
    "- Use Firebase Admin SDK credentials from your local terminal.",
    "- For production/staging, use Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS.",
    "- For emulator testing, set FIRESTORE_EMULATOR_HOST and a project id env var.",
    "",
    "Project selection:",
    "- Set one of GCLOUD_PROJECT, GOOGLE_CLOUD_PROJECT, or FIREBASE_PROJECT_ID.",
    "- The scripts do not hardcode project ids, UIDs, API keys, or service account paths.",
  ].join("\n");
}

function parseArgs(argv, commandName, options = {}) {
  const args = [...argv];
  const uid = args.shift();
  const allowHours = options.allowHours === true;

  if (!uid || uid === "--help" || uid === "-h") {
    throw new Error(usage(commandName, allowHours));
  }

  if (!UID_PATTERN.test(uid)) {
    throw new Error("Invalid Firebase Auth UID. Pass a UID with 1-128 URL-safe characters.");
  }

  let hours = DEFAULT_TEST_HOURS;
  while (args.length > 0) {
    const key = args.shift();
    const value = args.shift();

    if (!allowHours || key !== "--hours" || !value) {
      throw new Error(usage(commandName, allowHours));
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_TEST_HOURS) {
      throw new Error(`--hours must be an integer from 1 to ${MAX_TEST_HOURS}.`);
    }
    hours = parsed;
  }

  return { uid, hours };
}

function getProjectId() {
  return process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT
    || process.env.FIREBASE_PROJECT_ID
    || null;
}

function initializeAdmin() {
  if (getApps().length === 0) {
    const projectId = getProjectId();
    initializeApp(projectId ? { projectId } : undefined);
  }

  return getFirestore();
}

function getUserRef(db, uid) {
  return db.collection("users").doc(uid);
}

function buildGrantPayload(hours, now = new Date()) {
  const nowTimestamp = Timestamp.fromDate(now);
  const expiresAt = Timestamp.fromMillis(now.getTime() + hours * 60 * 60 * 1000);

  return {
    entitlement: {
      ai: {
        active: true,
        plan: "test",
        status: "active",
        provider: "manual_test",
        expiresAt,
        updatedAt: nowTimestamp,
      },
    },
  };
}

function buildRevokePayload(now = new Date()) {
  const nowTimestamp = Timestamp.fromDate(now);

  return {
    entitlement: {
      ai: {
        active: false,
        plan: "free",
        status: "revoked",
        provider: "none",
        expiresAt: nowTimestamp,
        updatedAt: nowTimestamp,
      },
    },
  };
}

module.exports = {
  buildGrantPayload,
  buildRevokePayload,
  getUserRef,
  initializeAdmin,
  parseArgs,
};
