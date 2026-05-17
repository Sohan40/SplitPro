import { db } from './firebase';
import type { Notification } from '../models/Notification';
import { warnUnlessPermissionDeniedAfterSignOut } from './firestoreErrorUtils';

const NOTIFICATIONS_COLLECTION = 'notifications';

export const notificationService = {
  /**
   * Create a new notification for a specific user
   */
  async createNotification(notificationData: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<string> {
    const docRef = db.collection(NOTIFICATIONS_COLLECTION).doc();
    const notification: Notification = {
      ...notificationData,
      id: docRef.id,
      read: false,
      createdAt: Date.now(),
    };
    await docRef.set(notification);
    return docRef.id;
  },

  /**
   * Create notifications for multiple users
   */
  async createNotificationsForUsers(
    userIds: string[], 
    notificationData: Omit<Notification, 'id' | 'createdAt' | 'read' | 'userId'>
  ): Promise<void> {
    const batch = db.batch();
    
    userIds.forEach(userId => {
      const docRef = db.collection(NOTIFICATIONS_COLLECTION).doc();
      const notification: Notification = {
        ...notificationData,
        userId,
        id: docRef.id,
        read: false,
        createdAt: Date.now(),
      };
      batch.set(docRef, notification);
    });

    await batch.commit();
  },

  /**
   * Subscribe to unread notifications for a user
   */
  subscribeToUnreadNotifications(userId: string, callback: (notifications: Notification[]) => void): () => void {
    return db.collection(NOTIFICATIONS_COLLECTION)
      .where('userId', '==', userId)
      .where('read', '==', false)
      .onSnapshot(snapshot => {
        const notifications = snapshot.docs.map(doc => doc.data() as Notification);
        // Sort descending by time
        const sorted = notifications.sort((a, b) => b.createdAt - a.createdAt);
        callback(sorted);
      }, error => {
        warnUnlessPermissionDeniedAfterSignOut('Error fetching notifications:', error);
      });
  },

  /**
   * Subscribe to all notifications for a user
   */
  subscribeToUserNotifications(userId: string, callback: (notifications: Notification[]) => void): () => void {
    return db.collection(NOTIFICATIONS_COLLECTION)
      .where('userId', '==', userId)
      .onSnapshot(snapshot => {
        const notifications = snapshot.docs.map(doc => doc.data() as Notification);
        const sorted = notifications.sort((a, b) => b.createdAt - a.createdAt);
        callback(sorted);
      }, error => {
        warnUnlessPermissionDeniedAfterSignOut('Error fetching notifications:', error);
      });
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId).update({ read: true });
  },

  /**
   * Mark all unread notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    const snapshot = await db.collection(NOTIFICATIONS_COLLECTION)
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();
  }
};
