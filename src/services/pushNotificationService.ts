import { Platform, PermissionsAndroid } from 'react-native';
import { messaging, db } from './firebase';
import firestore from '@react-native-firebase/firestore';

const USERS_COLLECTION = 'users';

export const pushNotificationService = {
  /**
   * Request push notification permissions.
   * - Android 13+ (API 33) requires runtime POST_NOTIFICATIONS permission.
   * - iOS always requires an explicit prompt.
   * Returns true if permission was granted.
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('Push notification permission denied');
        return false;
      }
    }

    const authStatus = await messaging.requestPermission();
    const enabled =
      authStatus === 1 || // AUTHORIZED
      authStatus === 2;   // PROVISIONAL
    if (!enabled) {
      console.warn('FCM permission not granted, authStatus:', authStatus);
    }
    return enabled;
  },

  /**
   * Get the current FCM device token.
   */
  async getToken(): Promise<string | null> {
    try {
      const token = await messaging.getToken();
      return token;
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      return null;
    }
  },

  /**
   * Save an FCM token to the user's Firestore document.
   * Uses arrayUnion so we don't overwrite tokens from other devices.
   */
  async saveTokenToFirestore(userId: string, token: string): Promise<void> {
    await db.collection(USERS_COLLECTION).doc(userId).update({
      fcmTokens: firestore.FieldValue.arrayUnion(token),
    });
  },

  /**
   * Remove an FCM token from the user's Firestore document.
   * Called on logout so the device stops receiving pushes for this user.
   */
  async removeTokenFromFirestore(userId: string, token: string): Promise<void> {
    await db.collection(USERS_COLLECTION).doc(userId).update({
      fcmTokens: firestore.FieldValue.arrayRemove(token),
    });
  },

  /**
   * Full registration flow:
   * 1. Request permissions
   * 2. Get FCM token
   * 3. Save token to Firestore
   * 4. Listen for token refresh
   *
   * Returns an unsubscribe function to stop listening for token refresh.
   */
  async registerDevice(userId: string): Promise<() => void> {
    const permitted = await this.requestPermission();
    if (!permitted) {
      return () => {};
    }

    const token = await this.getToken();
    if (token) {
      await this.saveTokenToFirestore(userId, token);
    }

    // Listen for token refresh (e.g. after app data clear, reinstall)
    const unsubscribe = messaging.onTokenRefresh(async (newToken: string) => {
      console.log('FCM token refreshed');
      await this.saveTokenToFirestore(userId, newToken);
    });

    return unsubscribe;
  },

  /**
   * Unregister the device on logout:
   * Remove the current token from Firestore so pushes stop.
   */
  async unregisterDevice(userId: string): Promise<void> {
    const token = await this.getToken();
    if (token) {
      await this.removeTokenFromFirestore(userId, token);
    }
  },
};
