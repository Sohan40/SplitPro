import firestore from '@react-native-firebase/firestore';
import authModule from '@react-native-firebase/auth';
import messagingModule from '@react-native-firebase/messaging';

// Firebase services are initialized automatically from google-services.json
export const db = firestore();
export const auth = authModule();
export const messaging = messagingModule();
