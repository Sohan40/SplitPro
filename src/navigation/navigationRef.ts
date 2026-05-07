import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * A root-level navigation ref that can be used outside of React components
 * (e.g., push notification handlers).
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Navigate from anywhere (including push notification handlers).
 * Safely checks if navigation is ready before navigating.
 */
export function navigateFromPush(name: string, params?: any) {
  if (navigationRef.isReady()) {
    // @ts-ignore — dynamic navigation from push data
    navigationRef.navigate(name, params);
  } else {
    // If navigation isn't ready yet (app just launched from killed state),
    // retry after a short delay
    setTimeout(() => {
      if (navigationRef.isReady()) {
        // @ts-ignore
        navigationRef.navigate(name, params);
      }
    }, 1000);
  }
}
