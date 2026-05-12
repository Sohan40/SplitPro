import { AuthProvider, useAuth } from '../AuthContext';

// Mock dependencies
jest.mock('../../services/firebase', () => ({
  auth: {
    onAuthStateChanged: jest.fn(() => jest.fn()), // returns unsubscribe fn
    signOut: jest.fn(),
  },
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        onSnapshot: jest.fn(() => jest.fn()),
        get: jest.fn(),
      })),
    })),
  },
}));

jest.mock('../../services/userService', () => ({
  userService: {
    saveUser: jest.fn(),
  },
}));

jest.mock('../../services/pushNotificationService', () => ({
  pushNotificationService: {
    registerDevice: jest.fn(),
    unregisterDevice: jest.fn(),
  },
}));

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provides AuthContext', () => {
    // Basic verification that the context provider can be imported
    expect(AuthProvider).toBeDefined();
    expect(useAuth).toBeDefined();
  });
});
