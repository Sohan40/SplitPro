import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { auth, db } from '../services/firebase';
import { userService } from '../services/userService';
import { pushNotificationService } from '../services/pushNotificationService';
import type { User } from '../models/User';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pushUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | undefined;

    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const requiresEmailVerification = firebaseUser.providerData.some(
          provider => provider.providerId === 'password',
        );

        if (requiresEmailVerification && !firebaseUser.emailVerified) {
          if (profileUnsubscribe) {
            profileUnsubscribe();
            profileUnsubscribe = undefined;
          }
          if (pushUnsubscribeRef.current) {
            pushUnsubscribeRef.current();
            pushUnsubscribeRef.current = null;
          }
          setUser(null);
          setLoading(false);
          return;
        }

        const userRef = db.collection('users').doc(firebaseUser.uid);
        const existingUserDoc = await userRef.get();

        if (!existingUserDoc.exists()) {
          const newProfile: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'User',
            email: firebaseUser.email?.toLowerCase() || '',
            photoUrl: firebaseUser.photoURL,
            createdAt: Date.now(),
          };
          await userService.saveUser(newProfile);
        }

        // Subscribe to real-time user profile updates from Firestore
        profileUnsubscribe = userRef.onSnapshot(async (doc) => {
          if (doc.exists()) {
            setUser(doc.data() as User);
            setLoading(false);
          } else {
            setUser(null);
            setLoading(false);
          }
        }, error => {
          console.warn("Error fetching user profile:", error);
          setUser(null);
          setLoading(false);
        });

        // Register device for push notifications
        try {
          const unsubPush = await pushNotificationService.registerDevice(firebaseUser.uid);
          pushUnsubscribeRef.current = unsubPush;
        } catch (error) {
          console.error('Failed to register for push notifications:', error);
        }
      } else {
        if (profileUnsubscribe) profileUnsubscribe();
        if (pushUnsubscribeRef.current) {
          pushUnsubscribeRef.current();
          pushUnsubscribeRef.current = null;
        }
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
      if (pushUnsubscribeRef.current) {
        pushUnsubscribeRef.current();
        pushUnsubscribeRef.current = null;
      }
    };
  }, []);

  const logout = async () => {
    try {
      // Unregister device before signing out so we have the user ID
      const currentUserId = user?.id;
      if (currentUserId) {
        try {
          await pushNotificationService.unregisterDevice(currentUserId);
        } catch (e) {
          console.warn('Failed to unregister device:', e);
        }
      }
      if (pushUnsubscribeRef.current) {
        pushUnsubscribeRef.current();
        pushUnsubscribeRef.current = null;
      }

      // Clear user state BEFORE signing out so screens with Firestore
      // listeners unmount first, preventing permission-denied errors.
      setUser(null);

      // Wait for React to process the state update and unmount screens
      // (which triggers their useEffect cleanups and unsubscribes listeners)
      // before revoking the auth token.
      await new Promise<void>(resolve => setTimeout(() => resolve(), 500));

      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
