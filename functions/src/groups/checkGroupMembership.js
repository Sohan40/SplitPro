const { HttpsError } = require("firebase-functions/v2/https");

async function getGroupForMember(db, groupId, uid) {
  const groupDoc = await db.collection("groups").doc(groupId).get();
  if (!groupDoc.exists) {
    throw new HttpsError("permission-denied", "You do not have access to this group.");
  }

  const group = { id: groupDoc.id, ...groupDoc.data() };
  if (!Array.isArray(group.memberIds) || !group.memberIds.includes(uid)) {
    throw new HttpsError("permission-denied", "You do not have access to this group.");
  }

  return group;
}

module.exports = {
  getGroupForMember,
};
