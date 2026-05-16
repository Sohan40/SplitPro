import { callAuthenticatedFunction } from './callableService';

interface QrTokenResponse {
  token: string;
  expiresAt: string;
}

interface ResolvedUser {
  uid: string;
  displayName: string;
  email: string;
}

interface AddMemberResponse {
  success: boolean;
  displayName: string;
}

export const qrInviteService = {
  /**
   * Request a new QR invite token from the backend.
   * Returns the raw token (for QR encoding) and its expiry time.
   */
  async createToken(): Promise<QrTokenResponse> {
    return callAuthenticatedFunction<Record<string, never>, QrTokenResponse>('createQrInviteToken', {});
  },

  /**
   * Resolve a scanned QR token to safe user info for confirmation.
   */
  async resolveToken(token: string): Promise<ResolvedUser> {
    return callAuthenticatedFunction<{ token: string }, ResolvedUser>('resolveQrInviteToken', { token });
  },

  /**
   * Validate and add a user (by QR token) to a group. All checks server-side.
   */
  async addMemberByToken(token: string, groupId: string): Promise<AddMemberResponse> {
    return callAuthenticatedFunction<{ token: string; groupId: string }, AddMemberResponse>(
      'addMemberByQrToken',
      { token, groupId },
    );
  },
};
