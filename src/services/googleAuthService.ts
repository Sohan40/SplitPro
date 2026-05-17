import { GoogleSignin } from '@react-native-google-signin/google-signin';
import authModule from '@react-native-firebase/auth';
import { auth } from './firebase';
import { userService } from './userService';
import type { User } from '../models/User';

// Web Client ID from google-services.json (oauth_client type 3)
const WEB_CLIENT_ID =
  '98378274298-ghfeoooulmjah82jdqi02o8tf09ip1q8.apps.googleusercontent.com';

/**
 * Configure Google Sign-In.
 * Call once at app startup (e.g. in App.tsx or AuthContext).
 */
export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    offlineAccess: false,
  });
}

/**
 * Clears the selected Google account for normal logout.
 * Firebase sign-out should still complete if this cleanup fails.
 */
export async function signOutFromGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.warn('Failed to sign out from Google:', error);
  }
}

/**
 * Revokes Google access for destructive disconnect/delete-account flows.
 */
export async function revokeGoogleAccess(): Promise<void> {
  try {
    await GoogleSignin.revokeAccess();
  } catch (error) {
    console.warn('Failed to revoke Google access:', error);
  }
}

/**
 * Sign in with Google and authenticate with Firebase.
 * Creates a Firestore user profile if one doesn't already exist.
 */
export async function signInWithGoogle(): Promise<void> {
  // 1. Check Play Services
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // 2. Trigger Google Sign-In flow
  const signInResult = await GoogleSignin.signIn();

  // idToken may be nested under .data in newer versions of the library
  const idToken =
    (signInResult as any).data?.idToken ?? (signInResult as any).idToken;

  if (!idToken) {
    throw new Error('Google Sign-In failed — no ID token returned.');
  }

  // 3. Create Firebase credential & sign in
  const googleCredential = authModule.GoogleAuthProvider.credential(idToken);
  const userCredential = await auth.signInWithCredential(googleCredential);

  const firebaseUser = userCredential.user;

  // 4. Ensure a Firestore user profile exists (first-time Google sign-in)
  const existingProfile = await userService.getUser(firebaseUser.uid);
  if (!existingProfile) {
    const newProfile: User = {
      id: firebaseUser.uid,
      name: firebaseUser.displayName || 'User',
      email: (firebaseUser.email || '').toLowerCase(),
      photoUrl: firebaseUser.photoURL,
      createdAt: Date.now(),
    };
    await userService.saveUser(newProfile);
  }
}
