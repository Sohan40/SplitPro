import { useEffect, useRef } from 'react';

import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { navigateFromPush } from '../navigation/navigationRef';

/**
 * Processes notification data and navigates to the appropriate screen.
 */
function handleNotificationNavigation(data: Record<string, string> | undefined) {
  if (!data) return;

  const { type, groupId, expenseId } = data;

  if (type === 'expense' && groupId && expenseId) {
    navigateFromPush('Main', {
      screen: 'Groups',
      params: {
        screen: 'ExpenseDetail',
        params: { groupId, expenseId },
      },
    });
  } else if (type === 'group_add' && groupId) {
    navigateFromPush('Main', {
      screen: 'Groups',
      params: {
        screen: 'GroupDetail',
        params: { groupId, groupName: 'Group' },
      },
    });
  }
}

/**
 * Hook that handles push notification events:
 *
 * 1. **Background tap**: Navigates to the relevant screen when the user
 *    taps a notification while the app is in the background.
 * 3. **Quit-state tap**: Navigates when the app was opened from a killed
 *    state via a notification tap.
 *
 * Must be used inside a component that is a child of NavigationContainer.
 */
export function useNotificationHandler() {
  const initialNotificationHandled = useRef(false);

  useEffect(() => {
    // ---------------------------------------------------------------
    // 2. Background tap — user tapped notification while app was in bg
    // ---------------------------------------------------------------
    const unsubscribeBackground = messaging().onNotificationOpenedApp(
      (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
        handleNotificationNavigation(remoteMessage.data as Record<string, string>);
      },
    );

    // ---------------------------------------------------------------
    // 3. Quit-state tap — app was killed, user tapped notification
    // ---------------------------------------------------------------
    if (!initialNotificationHandled.current) {
      initialNotificationHandled.current = true;
      messaging()
        .getInitialNotification()
        .then((remoteMessage) => {
          if (remoteMessage) {
            handleNotificationNavigation(remoteMessage.data as Record<string, string>);
          }
        });
    }

    return () => {
      unsubscribeBackground();
    };
  }, []);
}
