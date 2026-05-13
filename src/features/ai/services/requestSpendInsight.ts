import firebase from '@react-native-firebase/app';
import { auth } from '../../../services/firebase';
import type {
  AiRequestErrorCode,
  RequestSpendInsightParams,
  RequestSpendInsightResult,
} from '../types';

type CallableErrorResponse = {
  error?: {
    code?: string;
    status?: string;
    message?: string;
  };
};

const REGION = 'us-central1';

const STATUS_TO_CODE: Record<string, AiRequestErrorCode> = {
  UNAUTHENTICATED: 'unauthenticated',
  PERMISSION_DENIED: 'permission-denied',
  FAILED_PRECONDITION: 'failed-precondition',
  RESOURCE_EXHAUSTED: 'resource-exhausted',
  INVALID_ARGUMENT: 'invalid-argument',
  UNAVAILABLE: 'unavailable',
  INTERNAL: 'internal',
};

export class AiInsightRequestError extends Error {
  code: AiRequestErrorCode;

  constructor(code: AiRequestErrorCode, message: string) {
    super(message);
    this.name = 'AiInsightRequestError';
    this.code = code;
  }
}

function getProjectId(): string {
  const projectId = firebase.app().options.projectId;

  if (!projectId) {
    throw new AiInsightRequestError('internal', 'Firebase project is not configured.');
  }

  return projectId;
}

function buildCallableUrl(projectId: string): string {
  return `https://${REGION}-${projectId}.cloudfunctions.net/requestSpendInsight`;
}

function normalizeCallableCode(error: CallableErrorResponse['error']): AiRequestErrorCode {
  const rawCode = (error?.status || error?.code || '').toUpperCase();
  return STATUS_TO_CODE[rawCode] || 'internal';
}

export async function requestSpendInsight(
  params: RequestSpendInsightParams,
): Promise<RequestSpendInsightResult> {
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new AiInsightRequestError('unauthenticated', 'Please sign in to request AI insights.');
  }

  let response: Response;

  try {
    response = await fetch(buildCallableUrl(getProjectId()), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: params }),
    });
  } catch {
    throw new AiInsightRequestError('unavailable', 'Network error. Please check your connection and retry.');
  }

  const payload = await response.json();

  if (!response.ok || payload.error) {
    const callableError = payload as CallableErrorResponse;
    const code = normalizeCallableCode(callableError.error);
    throw new AiInsightRequestError(code, callableError.error?.message || 'AI insight request failed.');
  }

  return payload.result as RequestSpendInsightResult;
}
