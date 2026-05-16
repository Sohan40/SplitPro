import firebaseApp from '@react-native-firebase/app';
import { auth } from './firebase';

const REGION = 'us-central1';

type CallableErrorBody = {
  error?: {
    code?: string;
    status?: string;
    message?: string;
  };
};

export class CallableRequestError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CallableRequestError';
    this.code = code;
  }
}

function getProjectId(): string {
  const projectId = firebaseApp.app().options.projectId;

  if (!projectId) {
    throw new CallableRequestError('internal', 'Firebase project is not configured.');
  }

  return projectId;
}

function buildCallableUrl(name: string): string {
  return `https://${REGION}-${getProjectId()}.cloudfunctions.net/${name}`;
}

function normalizeCode(error: CallableErrorBody['error']): string {
  const rawCode = (error?.status || error?.code || 'internal').toLowerCase();
  return rawCode.replace(/_/g, '-');
}

export async function callAuthenticatedFunction<TInput, TOutput>(
  name: string,
  data: TInput,
): Promise<TOutput> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new CallableRequestError('unauthenticated', 'Please sign in again before continuing.');
  }

  const idToken = await currentUser.getIdToken(true);
  let response: Response;

  try {
    response = await fetch(buildCallableUrl(name), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data }),
    });
  } catch {
    throw new CallableRequestError('unavailable', 'Network error. Please check your connection and retry.');
  }

  const body = await response.json().catch(() => null);

  if (!response.ok || body?.error) {
    const errorBody = body as CallableErrorBody | null;
    const code = normalizeCode(errorBody?.error);
    throw new CallableRequestError(code, errorBody?.error?.message || 'Request failed.');
  }

  if (!body?.result) {
    throw new CallableRequestError('internal', 'The server returned an invalid response.');
  }

  return body.result as TOutput;
}
