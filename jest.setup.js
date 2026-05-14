/* eslint-env jest */

jest.mock('@react-native-async-storage/async-storage', () => (
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
  },
}));

jest.mock('@react-native-firebase/app', () => {
  const firebaseApp = {
    app: jest.fn(() => ({
      options: {
        projectId: 'splitpro-test',
      },
    })),
  };

  return {
    __esModule: true,
    default: firebaseApp,
    ...firebaseApp,
  };
});

jest.mock('@react-native-firebase/auth', () => {
  const auth = jest.fn(() => ({
    currentUser: null,
    onAuthStateChanged: jest.fn(callback => {
      callback(null);
      return jest.fn();
    }),
    signInWithCredential: jest.fn(),
    signOut: jest.fn(),
  }));

  auth.GoogleAuthProvider = {
    credential: jest.fn(),
  };

  return auth;
});

jest.mock('@react-native-firebase/firestore', () => jest.fn(() => ({
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      get: jest.fn(),
      onSnapshot: jest.fn(() => jest.fn()),
      set: jest.fn(),
      update: jest.fn(),
    })),
    where: jest.fn(() => ({
      orderBy: jest.fn(() => ({
        onSnapshot: jest.fn(() => jest.fn()),
      })),
    })),
  })),
})));

jest.mock('@react-native-firebase/messaging', () => jest.fn(() => ({
  getToken: jest.fn(),
  requestPermission: jest.fn(),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn(),
})));

jest.mock('react-native-iap', () => ({
  ErrorCode: {
    UserCancelled: 'user-cancelled',
    BillingUnavailable: 'billing-unavailable',
    IapNotAvailable: 'iap-not-available',
    ItemUnavailable: 'item-unavailable',
    SkuNotFound: 'sku-not-found',
    SkuOfferMismatch: 'sku-offer-mismatch',
    NetworkError: 'network-error',
    ServiceDisconnected: 'service-disconnected',
    ServiceTimeout: 'service-timeout',
    AlreadyOwned: 'already-owned',
    Pending: 'pending',
    DeferredPayment: 'deferred-payment',
  },
  initConnection: jest.fn(async () => true),
  endConnection: jest.fn(async () => undefined),
  fetchProducts: jest.fn(async () => []),
  requestPurchase: jest.fn(async () => undefined),
  restorePurchases: jest.fn(async () => undefined),
  getAvailablePurchases: jest.fn(async () => []),
  finishTransaction: jest.fn(async () => undefined),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
}));
