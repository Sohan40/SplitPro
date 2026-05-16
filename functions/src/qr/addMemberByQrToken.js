const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { hashInviteToken } = require("./hashInviteToken");
const { getGroupForMember } = require("../groups/checkGroupMembership");

/**
 * Validate a QR invite token and add the target user to a group.
 *
 * Security checks:
 *  1. Scanner is authenticated
 *  2. Token exists and is not expired
 *  3. Scanner is a member of the target group
 *  4. Target user exists
 *  5. Target user is not already a group member
 */
async function handleAddMemberByQrToken({ db, request }) {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Sign in to add members.");
  }

  const rawToken = typeof request.data?.token === "string"
    ? request.data.token.trim()
    : "";
  const groupId = typeof request.data?.groupId === "string"
    ? request.data.groupId.trim()
    : "";

  if (!rawToken) {
    throw new HttpsError("invalid-argument", "A valid QR token is required.");
  }
  if (!groupId) {
    throw new HttpsError("invalid-argument", "A group ID is required.");
  }

  // 1. Validate token
  const tokenHash = hashInviteToken(rawToken);
  const tokenDoc = await db.collection("qrInvites").doc(tokenHash).get();

  if (!tokenDoc.exists) {
    throw new HttpsError("not-found", "This QR code is invalid or has expired.");
  }

  const tokenData = tokenDoc.data();
  const expiresAtMs = tokenData.expiresAt?.toMillis?.() || 0;
  if (Date.now() > expiresAtMs) {
    throw new HttpsError(
      "failed-precondition",
      "This QR code has expired. Ask the user to generate a new one."
    );
  }

  const targetUid = tokenData.uid;

  // 2. Verify caller is a group member (reuse existing helper)
  const group = await getGroupForMember(db, groupId, callerUid);

  // 3. Check target user is not already a member
  if (Array.isArray(group.memberIds) && group.memberIds.includes(targetUid)) {
    throw new HttpsError(
      "already-exists",
      "This user is already a member of the group."
    );
  }

  // 4. Look up target user profile
  const targetUserDoc = await db.collection("users").doc(targetUid).get();
  if (!targetUserDoc.exists) {
    throw new HttpsError("not-found", "The invited user's account was not found.");
  }

  const targetUser = targetUserDoc.data();

  // 5. Add member to group
  const groupRef = db.collection("groups").doc(groupId);
  await groupRef.update({
    memberIds: FieldValue.arrayUnion(targetUid),
    members: FieldValue.arrayUnion({
      uid: targetUid,
      name: targetUser.name || "Unknown",
      email: targetUser.email || "",
      photoUrl: targetUser.photoUrl || null,
    }),
    [`balances.${targetUid}`]: 0,
    updatedAt: Date.now(),
  });

  // 6. Create notification for the added user (fire-and-forget)
  try {
    const callerDoc = await db.collection("users").doc(callerUid).get();
    const callerName = callerDoc.exists ? callerDoc.data().name : "Someone";

    await db.collection("notifications").add({
      userId: targetUid,
      title: "Added to Group",
      body: `${callerName} added you to ${group.name}`,
      type: "group_add",
      read: false,
      createdAt: Date.now(),
      data: { groupId },
    });
  } catch (notifError) {
    // Non-critical — log but don't fail the operation
    console.warn("Failed to create notification for QR invite:", notifError.message);
  }

  return {
    success: true,
    displayName: targetUser.name || "Unknown",
  };
}

function createAddMemberByQrTokenFunction(db) {
  return onCall({
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "256MiB",
  }, async (request) => handleAddMemberByQrToken({ db, request }));
}

module.exports = {
  createAddMemberByQrTokenFunction,
  handleAddMemberByQrToken,
};
