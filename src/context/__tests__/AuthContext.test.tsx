import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { auth } from '../../services/firebase';
import { signOutFromGoogle } from '../../services/googleAuthService';
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

jest.mock('../../services/googleAuthService', () => ({
  signOutFromGoogle: jest.fn(),
}));

describe('AuthContext', () => {
  const originalConsoleWarn = console.warn;
  let capturedLogout: (() => Promise<void>) | null = null;

  function LogoutProbe() {
    const { logout } = useAuth();
    capturedLogout = logout;
    return null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    capturedLogout = null;
    console.warn = jest.fn();
    (signOutFromGoogle as jest.Mock).mockResolvedValue(undefined);
    (auth.signOut as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    console.warn = originalConsoleWarn;
  });

  it('provides AuthContext', () => {
    // Basic verification that the context provider can be imported
    expect(AuthProvider).toBeDefined();
    expect(useAuth).toBeDefined();
  });

  it('clears Google session before Firebase logout', async () => {
    await act(async () => {
      TestRenderer.create(
        <AuthProvider>
          <LogoutProbe />
        </AuthProvider>,
      );
    });

    expect(capturedLogout).toBeTruthy();

    let logoutPromise!: Promise<void>;
    await act(async () => {
      logoutPromise = capturedLogout!();
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await logoutPromise;
    });

    expect(signOutFromGoogle).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect((signOutFromGoogle as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((auth.signOut as jest.Mock).mock.invocationCallOrder[0]);
  });

  it('still signs out of Firebase when Google cleanup fails', async () => {
    (signOutFromGoogle as jest.Mock).mockRejectedValueOnce(new Error('Google cleanup failed'));

    await act(async () => {
      TestRenderer.create(
        <AuthProvider>
          <LogoutProbe />
        </AuthProvider>,
      );
    });

    expect(capturedLogout).toBeTruthy();

    let logoutPromise!: Promise<void>;
    await act(async () => {
      logoutPromise = capturedLogout!();
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await logoutPromise;
    });

    expect(signOutFromGoogle).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});
