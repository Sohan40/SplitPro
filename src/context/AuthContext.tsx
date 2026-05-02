import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth, db } from '../services/firebase';
import { userService } from '../services/userService';
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

  useEffect(() => {
    let profileUnsubscribe: (() => void) | undefined;

    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // Subscribe to real-time user profile updates from Firestore
        profileUnsubscribe = db.collection('users').doc(firebaseUser.uid).onSnapshot(async (doc) => {
          if (doc.exists()) {
            setUser(doc.data() as User);
            setLoading(false);
          } else {
            // Auto-heal logic if doc doesn't exist yet
            // Wait a brief moment to see if SignUpScreen creates it
            setTimeout(async () => {
              const checkDoc = await db.collection('users').doc(firebaseUser.uid).get();
              if (!checkDoc.exists()) {
                const newProfile: User = {
                  id: firebaseUser.uid,
                  name: firebaseUser.displayName || 'User',
                  email: firebaseUser.email?.toLowerCase() || '',
                  photoUrl: firebaseUser.photoURL,
                  createdAt: Date.now(),
                };
                await userService.saveUser(newProfile);
                // The snapshot will trigger again automatically when this saves
              }
            }, 2000);
          }
        }, error => {
          console.error("Error fetching user profile:", error);
          setUser(null);
          setLoading(false);
        });
      } else {
        if (profileUnsubscribe) profileUnsubscribe();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
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
