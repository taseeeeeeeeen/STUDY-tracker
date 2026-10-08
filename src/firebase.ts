import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, setLogLevel, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Silence internal Firestore verbose connection messages
try {
  setLogLevel('silent');
} catch {
  // Ignore in environments where setLogLevel is unavailable
}

// Convert any uncaught internal Firestore backend connection timeout logs from error to warning
if (typeof console !== 'undefined' && console.error) {
  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const fullLog = args
      .map((a) => {
        if (typeof a === 'string') return a;
        if (a && typeof a === 'object' && 'message' in a && typeof (a as { message?: unknown }).message === 'string') {
          return (a as { message: string }).message;
        }
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ')
      .toLowerCase();

    if (
      fullLog.includes('could not reach cloud firestore backend') ||
      fullLog.includes('@firebase/firestore') ||
      fullLog.includes("backend didn't respond within") ||
      fullLog.includes('client will operate in offline mode') ||
      fullLog.includes('connection failed') ||
      fullLog.includes('failed to get document') ||
      fullLog.includes('failed to set chapter progress batch') ||
      fullLog.includes('failed to sync') ||
      fullLog.includes('firestore connectivity issue')
    ) {
      console.warn(...args);
      return;
    }
    originalConsoleError(...args);
  };
}

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with forced long polling and ignore undefined properties
// Force long polling to bypass WebSocket handshake latency and proxy timeouts in iframe/cloud sandbox environments
export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true,
  },
  firebaseConfig.firestoreDatabaseId
);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Google Auth Provider configured for Google Sign-In
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Bootstrap convenience: Client-side auto-elevation for initial admin setup.
// NOTE: Firestore security rules NEVER trust this client-side list; admin authority comes only
// from users/{uid}.data.role in the Firestore database.
// Once roles are managed in the console, this hardcoded list can be removed.
export const ADMIN_EMAILS = ['ahmedtaseen008@gmail.com', 'ahmedmubintaseen@gmail.com'];

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.some((admin) => admin.toLowerCase() === email.toLowerCase().trim());
};

// Error handling types and helper as required by Firestore integration specifications
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string })?.code;

  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };

  const lowerMsg = message.toLowerCase();
  const isConnErr =
    code === 'unavailable' ||
    lowerMsg.includes('offline') ||
    lowerMsg.includes('connection failed') ||
    lowerMsg.includes('failed to get document') ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('backend') ||
    lowerMsg.includes('deadline');

  // If it's a connectivity issue, log as warning instead of error to reduce noise
  if (isConnErr) {
    console.warn('Firestore Connectivity Issue: ', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot - silent check that allows offline operation
export async function testConnection(): Promise<void> {
  try {
    if (auth.currentUser) {
      await getDoc(doc(db, 'users', auth.currentUser.uid));
    }
  } catch {
    // Client will operate in offline/cached mode until connection is re-established
  }
}
