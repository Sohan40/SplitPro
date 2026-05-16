const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getGroupForMember } = require("./checkGroupMembership");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function assertValidEmail(email) {
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new HttpsError("invalid-argument", "Enter a valid email address.");
  }
}

async function findUserByEmail(db, email) {
  const snapshot = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();
  return {
    uid: doc.id,
    name: data.name || "Unknown",
    email: data.email || email,
    photoUrl: data.photoUrl || null,
  };
}

async function handleResolveUserByEmail({ db, request }) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in to search for members.");
  }

  const email = normalizeEmail(request.data?.email);
  assertValidEmail(email);

  const user = await findUserByEmail(db, email);
  if (!user) {
    throw new HttpsError("not-found", "No user found with this email address.");
  }

  return user;
}

async function handleAddMemberByEmail({ db, request }) {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Sign in to add members.");
  }

  const groupId = typeof request.data?.groupId === "string"
    ? request.data.groupId.trim()
    : "";
  const email = normalizeEmail(request.data?.email);

  if (!groupId) {
    throw new HttpsError("invalid-argument", "A group ID is required.");
  }
  assertValidEmail(email);

  const group = await getGroupForMember(db, groupId, callerUid);
  const targetUser = await findUserByEmail(db, email);
  if (!targetUser) {
    throw new HttpsError("not-found", "No user found with this email address.");
  }

  if (Array.isArray(group.memberIds) && group.memberIds.includes(targetUser.uid)) {
    throw new HttpsError("already-exists", "This user is already a member of the group.");
  }

  const nextMembers = Array.isArray(group.members)
    ? [...group.members, targetUser]
    : [targetUser];
  const nextMemberIds = Array.isArray(group.memberIds)
    ? [...group.memberIds, targetUser.uid]
    : [targetUser.uid];
  const nextBalances = {
    ...(group.balances || {}),
    [targetUser.uid]: 0,
  };

  await db.collection("groups").doc(groupId).update({
    memberIds: nextMemberIds,
    members: nextMembers,
    balances: nextBalances,
    updatedAt: Date.now(),
  });

  try {
    const callerDoc = await db.collection("users").doc(callerUid).get();
    const callerName = callerDoc.exists ? callerDoc.data().name : "Someone";

    await db.collection("notifications").add({
      userId: targetUser.uid,
      title: "Added to Group",
      body: `${callerName} added you to ${group.name}`,
      type: "group_add",
      read: false,
      createdAt: Date.now(),
      data: { groupId },
    });
  } catch (notifError) {
    console.warn("Failed to create notification for email invite:", notifError.message);
  }

  return {
    success: true,
    displayName: targetUser.name,
  };
}

function createResolveUserByEmailFunction(db) {
  return onCall({
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "256MiB",
  }, async (request) => handleResolveUserByEmail({ db, request }));
}

function createAddMemberByEmailFunction(db) {
  return onCall({
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "256MiB",
  }, async (request) => handleAddMemberByEmail({ db, request }));
}

module.exports = {
  createAddMemberByEmailFunction,
  createResolveUserByEmailFunction,
  findUserByEmail,
  handleAddMemberByEmail,
  handleResolveUserByEmail,
  normalizeEmail,
};
