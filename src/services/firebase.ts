import firestore from '@react-native-firebase/firestore';
import authModule from '@react-native-firebase/auth';

// Firebase services are initialized automatically from google-services.json
export const db = firestore();
export const auth = authModule();
