import { db } from './firebase';
import type { Group } from '../models/Group';

const GROUPS_COLLECTION = 'groups';

export const groupService = {
  /**
   * Create a new group
   */
  async createGroup(groupData: Omit<Group, 'id'>): Promise<string> {
    const docRef = db.collection(GROUPS_COLLECTION).doc();
    const group: Group = {
      ...groupData,
      id: docRef.id,
    };
    await docRef.set(group);
    return docRef.id;
  },

  async getUserGroups(userId: string): Promise<Group[]> {
    const snapshot = await db
      .collection(GROUPS_COLLECTION)
      .where('memberIds', 'array-contains', userId)
      .get();

    // Sort in memory to avoid requiring a composite index in Firestore
    const groups = snapshot.docs.map(doc => doc.data() as Group);
    return groups.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  /**
   * Subscribe to all groups for a specific user
   */
  subscribeToUserGroups(userId: string, callback: (groups: Group[]) => void): () => void {
    return db.collection(GROUPS_COLLECTION)
      .where('memberIds', 'array-contains', userId)
      .onSnapshot(snapshot => {
        const groups = snapshot.docs.map(doc => doc.data() as Group);
        const sorted = groups.sort((a, b) => b.updatedAt - a.updatedAt);
        callback(sorted);
      }, error => {
        console.warn("Error fetching user groups:", error);
      });
  },

  /**
   * Get a specific group by ID
   */
  async getGroup(groupId: string): Promise<Group | null> {
    const doc = await db.collection(GROUPS_COLLECTION).doc(groupId).get();
    if (!doc.exists()) return null;
    return doc.data() as Group;
  },

  /**
   * Subscribe to real-time updates for a specific group
   */
  subscribeToGroup(groupId: string, callback: (group: Group | null) => void): () => void {
    return db.collection(GROUPS_COLLECTION).doc(groupId).onSnapshot(doc => {
      if (doc.exists()) {
        callback(doc.data() as Group);
      } else {
        callback(null);
      }
    }, error => {
      console.warn("Error fetching group:", error);
    });
  },

  /**
   * Update a group's data (e.g., when balances change)
   */
  /**
   * Update a group's data (e.g., when balances change)
   */
  async updateGroup(groupId: string, data: Partial<Group>): Promise<void> {
    await db.collection(GROUPS_COLLECTION).doc(groupId).update({
      ...data,
      updatedAt: Date.now(),
    });
  },

  /**
   * Add a member to a group
   */
  async addMemberToGroup(groupId: string, user: { uid: string, name: string, email: string }): Promise<void> {
    const groupDoc = db.collection(GROUPS_COLLECTION).doc(groupId);
    const groupData = (await groupDoc.get()).data() as Group;

    if (groupData.memberIds.includes(user.uid)) {
      throw new Error('User is already a member of this group');
    }

    await groupDoc.update({
      memberIds: [...groupData.memberIds, user.uid],
      members: [...groupData.members, user],
      [`balances.${user.uid}`]: 0,
      updatedAt: Date.now(),
    });
  },

  /**
   * Remove a member from a group
   */
  async removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
    const groupDoc = db.collection(GROUPS_COLLECTION).doc(groupId);
    const groupData = (await groupDoc.get()).data() as Group;

    // Filter out the user from arrays
    const newMemberIds = groupData.memberIds.filter(id => id !== userId);
    const newMembers = groupData.members.filter(m => m.uid !== userId);
    
    // Remove balance entry
    const newBalances = { ...groupData.balances };
    delete newBalances[userId];

    await groupDoc.update({
      memberIds: newMemberIds,
      members: newMembers,
      balances: newBalances,
      updatedAt: Date.now(),
    });
  },

  /**
   * Delete an entire group
   */
  async deleteGroup(groupId: string): Promise<void> {
    // Note: In a production app, you should also query and delete 
    // all expenses where groupId === groupId to avoid orphaned records.
    await db.collection(GROUPS_COLLECTION).doc(groupId).delete();
  },
};
