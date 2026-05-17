import { auth } from './firebase';

let firestoreSignOutInProgress = false;

export function setFirestoreSignOutInProgress(isInProgress: boolean): void {
  firestoreSignOutInProgress = isInProgress;
}

export function isFirestorePermissionDenied(error: unknown): boolean {
  const code = String((error as { code?: unknown })?.code ?? '').toLowerCase();
  const message = String((error as { message?: unknown })?.message ?? '').toLowerCase();

  return (
    code.includes('permission-denied') ||
    message.includes('permission denied') ||
    message.includes('insufficient permissions')
  );
}

export function isFirestorePermissionDeniedAfterSignOut(error: unknown): boolean {
  return (firestoreSignOutInProgress || !auth.currentUser) && isFirestorePermissionDenied(error);
}

export function warnUnlessPermissionDeniedAfterSignOut(message: string, error: unknown): void {
  if (isFirestorePermissionDeniedAfterSignOut(error)) {
    return;
  }

  console.warn(message, error);
}
