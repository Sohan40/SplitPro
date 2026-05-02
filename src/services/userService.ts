import { db } from './firebase';
import type { User } from '../models/User';

const USERS_COLLECTION = 'users';

export const userService = {
  /**
   * Create or update a user profile in Firestore
   */
  async saveUser(user: User): Promise<void> {
    await db.collection(USERS_COLLECTION).doc(user.id).set(user, { merge: true });
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
};
