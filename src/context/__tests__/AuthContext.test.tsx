import React from 'react';
import { Text } from 'react-native';
import renderer from 'react-test-renderer';
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

const TestComponent = () => {
  const { user, loading } = useAuth();
  if (loading) return <Text>Loading...</Text>;
  return <Text>{user ? 'Logged In' : 'Logged Out'}</Text>;
};

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
