import { db } from './firebase';
import type { User } from '../models/User';

const USERS_COLLECTION = 'users';

type ClientWritableUserProfile = Pick<
  User,
  'id' | 'name' | 'email' | 'photoUrl' | 'createdAt'
> &
  Partial<Pick<User, 'updatedAt' | 'fcmTokens'>>;

const toClientWritableUserProfile = (user: User): ClientWritableUserProfile => {
  const profile: ClientWritableUserProfile = {
    id: user.id,
    name: user.name,
    email: user.email,
    photoUrl: user.photoUrl,
    createdAt: user.createdAt,
  };

  if (user.updatedAt !== undefined) {
    profile.updatedAt = user.updatedAt;
  }

  if (user.fcmTokens !== undefined) {
    profile.fcmTokens = user.fcmTokens;
  }

  return profile;
};

export const userService = {
  /**
   * Create or update the client-writable profile fields in Firestore.
   * Entitlement and AI usage fields are intentionally omitted because they are
   * server-owned and protected by Firestore Security Rules.
   */
  async saveUser(user: User): Promise<void> {
    await db.collection(USERS_COLLECTION).doc(user.id).set(
      toClientWritableUserProfile(user),
      { merge: true },
    );
  },

  /**
   * Get a user profile by ID
   */
  async getUser(id: string): Promise<User | null> {
    const doc = await db.collection(USERS_COLLECTION).doc(id).get();
    if (!doc.exists()) return null;
    return doc.data() as User;
  },

  /**
   * Search users by email (exact match for MVP)
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as User;
  },

  /**
   * Delete a user profile from Firestore
   */
  async deleteUser(id: string): Promise<void> {
    await db.collection(USERS_COLLECTION).doc(id).delete();
  },

  /**
   * Update a user's display name and propagate changes to groups and expenses
   */
  async updateUserName(id: string, name: string): Promise<void> {
    const batch = db.batch();

    // 1. Update User Profile
    const userRef = db.collection(USERS_COLLECTION).doc(id);
    batch.update(userRef, { name, updatedAt: Date.now() });

    // 2. Update all Groups where user is a member
    const groupsSnapshot = await db.collection('groups')
      .where('memberIds', 'array-contains', id)
      .get();

    groupsSnapshot.forEach(groupDoc => {
      const groupData = groupDoc.data();
      const updatedMembers = groupData.members.map((m: any) => 
        m.uid === id ? { ...m, name } : m
      );
      batch.update(groupDoc.ref, { members: updatedMembers, updatedAt: Date.now() });
    });

    // 3. Update all Expenses where user is a payer or participant
    // Firestore security rules require querying expenses by groupId.
    for (const groupDoc of groupsSnapshot.docs) {
      const expensesInGroup = await db.collection('expenses')
        .where('groupId', '==', groupDoc.id)
        .get();

      expensesInGroup.forEach(expenseDoc => {
        const expenseData = expenseDoc.data();
        let changed = false;
        const updateData: Record<string, any> = {};

        // Check if user is the payer
        if (expenseData.paidBy?.uid === id && expenseData.paidBy?.name !== name) {
          changed = true;
          updateData['paidBy.name'] = name;
        }

        // Check if user is a participant
        let participantsChanged = false;
        const updatedParticipants = expenseData.participants.map((p: any) => {
          if (p.uid === id && p.name !== name) {
            participantsChanged = true;
            changed = true;
            return { ...p, name };
          }
          return p;
        });

        if (changed) {
          if (participantsChanged) {
             updateData.participants = updatedParticipants;
          }
          updateData.updatedAt = Date.now();
          batch.update(expenseDoc.ref, updateData);
        }
      });
    }

    await batch.commit();
  },
};
