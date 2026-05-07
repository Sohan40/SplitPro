/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Handle background/quit-state push notifications
// This must be set in the entry file (not a component) so it runs even when the app is killed.
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('Background push received:', remoteMessage.messageId);
  // No processing needed — the notification is auto-displayed by the system,
  // and the Firestore notification doc (created by the Cloud Function trigger source)
  // serves as the source of truth for notification history.
});

AppRegistry.registerComponent(appName, () => App);
