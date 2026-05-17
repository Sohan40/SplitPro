import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { auth, db } from '../services/firebase';
import { userService } from '../services/userService';
import { pushNotificationService } from '../services/pushNotificationService';
import { signOutFromGoogle } from '../services/googleAuthService';
import {
  isFirestorePermissionDeniedAfterSignOut,
  setFirestoreSignOutInProgress,
} from '../services/firestoreErrorUtils';
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
  const profileUnsubscribeRef = useRef<(() => void) | null>(null);
  const authChangeVersionRef = useRef(0);

  const clearProfileSubscription = useCallback(() => {
    if (profileUnsubscribeRef.current) {
      profileUnsubscribeRef.current();
      profileUnsubscribeRef.current = null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      const authChangeVersion = authChangeVersionRef.current + 1;
      authChangeVersionRef.current = authChangeVersion;

      const isCurrentAuthChange = () => (
        authChangeVersionRef.current === authChangeVersion
        && auth.currentUser?.uid === firebaseUser?.uid
      );

      if (firebaseUser) {
        setFirestoreSignOutInProgress(false);
        const requiresEmailVerification = firebaseUser.providerData.some(
          provider => provider.providerId === 'password',
        );

        if (requiresEmailVerification && !firebaseUser.emailVerified) {
          clearProfileSubscription();
          if (pushUnsubscribeRef.current) {
            pushUnsubscribeRef.current();
            pushUnsubscribeRef.current = null;
          }
          setUser(null);
          setLoading(false);
          return;
        }

        try {
          const userRef = db.collection('users').doc(firebaseUser.uid);
          const existingUserDoc = await userRef.get();

          if (!isCurrentAuthChange()) {
            return;
          }

          if (!existingUserDoc.exists()) {
            const newProfile: User = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'User',
              email: firebaseUser.email?.toLowerCase() || '',
              photoUrl: firebaseUser.photoURL,
              createdAt: Date.now(),
            };
            await userService.saveUser(newProfile);

            if (!isCurrentAuthChange()) {
              return;
            }
          }

          // Subscribe to real-time user profile updates from Firestore
          clearProfileSubscription();
          profileUnsubscribeRef.current = userRef.onSnapshot(async (doc) => {
            if (!isCurrentAuthChange()) {
              return;
            }

            if (doc.exists()) {
              setUser(doc.data() as User);
              setLoading(false);
            } else {
              setUser(null);
              setLoading(false);
            }
          }, error => {
            if (!isCurrentAuthChange()) {
              return;
            }

            if (isFirestorePermissionDeniedAfterSignOut(error)) {
              setUser(null);
              setLoading(false);
              return;
            }
            console.warn("Error fetching user profile:", error);
            setUser(null);
            setLoading(false);
          });

          // Register device for push notifications
          try {
            const unsubPush = await pushNotificationService.registerDevice(firebaseUser.uid);
            if (!isCurrentAuthChange()) {
              unsubPush();
              return;
            }
            pushUnsubscribeRef.current = unsubPush;
          } catch (error) {
            if (isCurrentAuthChange()) {
              console.error('Failed to register for push notifications:', error);
            }
          }
        } catch (error) {
          if (authChangeVersionRef.current !== authChangeVersion) {
            return;
          }

          if (isFirestorePermissionDeniedAfterSignOut(error)) {
            setUser(null);
            setLoading(false);
            return;
          }
          console.warn('Error preparing user profile:', error);
          setUser(null);
          setLoading(false);
        }
      } else {
        setFirestoreSignOutInProgress(false);
        clearProfileSubscription();
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
      clearProfileSubscription();
      if (pushUnsubscribeRef.current) {
        pushUnsubscribeRef.current();
        pushUnsubscribeRef.current = null;
      }
    };
  }, [clearProfileSubscription]);

  const logout = async () => {
    try {
      authChangeVersionRef.current += 1;
      setFirestoreSignOutInProgress(true);

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
      clearProfileSubscription();

      // Clear user state BEFORE signing out so screens with Firestore
      // listeners unmount first, preventing permission-denied errors.
      setUser(null);

      // Wait for React to process the state update and unmount screens
      // (which triggers their useEffect cleanups and unsubscribes listeners)
      // before revoking the auth token.
      await new Promise<void>(resolve => setTimeout(() => resolve(), 500));

      try {
        await signOutFromGoogle();
      } catch (e) {
        console.warn('Failed to clear Google Sign-In session:', e);
      }

      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      if (auth.currentUser) {
        setFirestoreSignOutInProgress(false);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
