import { db } from './firebase';
import type { Expense } from '../models/Expense';

const EXPENSES_COLLECTION = 'expenses';

export const expenseService = {
  /**
   * Add a new expense
   */
  async addExpense(expenseData: Omit<Expense, 'id'>): Promise<string> {
    const docRef = db.collection(EXPENSES_COLLECTION).doc();
    const expense: Expense = {
      ...expenseData,
      id: docRef.id,
    };
    await docRef.set(expense);
    return docRef.id;
  },

  /**
   * Update an existing expense
   */
  async updateExpense(id: string, expenseData: Omit<Expense, 'id'>): Promise<void> {
    await db.collection(EXPENSES_COLLECTION).doc(id).set(expenseData, { merge: true });
  },

  /**
   * Delete an expense
   */
  async deleteExpense(id: string): Promise<void> {
    await db.collection(EXPENSES_COLLECTION).doc(id).delete();
  },

  /**
   * Get all expenses for a specific group
   */
  async getGroupExpenses(groupId: string): Promise<Expense[]> {
    const snapshot = await db
      .collection(EXPENSES_COLLECTION)
      .where('groupId', '==', groupId)
      .get();

    const expenses = snapshot.docs.map(doc => doc.data() as Expense);
    return expenses.sort((a, b) => b.createdAt - a.createdAt);
  },

  /**
   * Subscribe to real-time expense updates for a specific group
   */
  subscribeToGroupExpenses(groupId: string, callback: (expenses: Expense[]) => void): () => void {
    return db.collection(EXPENSES_COLLECTION)
      .where('groupId', '==', groupId)
      .onSnapshot(snapshot => {
        const expenses = snapshot.docs.map(doc => doc.data() as Expense);
        const sorted = expenses.sort((a, b) => b.createdAt - a.createdAt);
        callback(sorted);
      }, error => {
        console.warn("Error fetching group expenses:", error);
      });
  },

  async getExpense(expenseId: string): Promise<Expense | null> {
    const doc = await db.collection(EXPENSES_COLLECTION).doc(expenseId).get();
    if (!doc.exists()) return null;
    return doc.data() as Expense;
  },

  /**
   * Subscribe to a specific expense
   */
  subscribeToExpense(expenseId: string, callback: (expense: Expense | null) => void): () => void {
    return db.collection(EXPENSES_COLLECTION).doc(expenseId).onSnapshot(doc => {
      if (doc.exists()) {
        callback(doc.data() as Expense);
      } else {
        callback(null);
      }
    }, error => {
      console.warn("Error fetching expense:", error);
    });
  },

  async getUserExpenses(groupIds: string[]): Promise<Expense[]> {
    if (groupIds.length === 0) return [];

    const snapshot = await db
      .collection(EXPENSES_COLLECTION)
      .where('groupId', 'in', groupIds.slice(0, 30))
      .get();

    const expenses = snapshot.docs.map(doc => doc.data() as Expense);
    return expenses.sort((a, b) => {
      const timeA = a.updatedAt || a.createdAt;
      const timeB = b.updatedAt || b.createdAt;
      return timeB - timeA;
    });
  },

  /**
   * Subscribe to recent expenses across multiple groups
   */
  subscribeToUserExpenses(groupIds: string[], callback: (expenses: Expense[]) => void): () => void {
    if (groupIds.length === 0) {
      // Async callback execution to match typical behavior
      setTimeout(() => callback([]), 0);
      return () => {};
    }

    return db.collection(EXPENSES_COLLECTION)
      .where('groupId', 'in', groupIds.slice(0, 30))
      .onSnapshot(snapshot => {
        const expenses = snapshot.docs.map(doc => doc.data() as Expense);
        const sorted = expenses.sort((a, b) => {
          const timeA = a.updatedAt || a.createdAt;
          const timeB = b.updatedAt || b.createdAt;
          return timeB - timeA;
        });
        callback(sorted);
      }, error => {
        console.warn("Error fetching user expenses:", error);
      });
  },
};
