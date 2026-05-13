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
