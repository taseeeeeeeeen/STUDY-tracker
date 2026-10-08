import {
  doc,
  getDocFromCache,
  setDoc,
  onSnapshot,
  runTransaction,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';

function isConnectionError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    code === 'unavailable' ||
    msg.includes('connection failed') ||
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('failed to get document') ||
    msg.includes('deadline') ||
    msg.includes('backend')
  );
}

export interface UserTopicProgress {
  theory: boolean;
  practice: boolean;
}

export interface QuickStudyLogItem {
  id: string;
  subject: string;
  minutes: number;
  notes?: string;
  timestamp: number;
  createdAt: string;
}

export interface UserProgressDoc {
  uid: string;
  topicProgress: Record<string, UserTopicProgress>;
  activeChallengeId?: string | null;
  updatedAt: string;
  peerCode?: string;
  savedSyllabusIds?: string[];
  hiddenSubjectIds?: string[];
  completionLog?: Record<string, { theory: number | null; practice: number | null }>;
  quickLogs?: QuickStudyLogItem[];
}

const COLLECTION_NAME = 'user_progress';

export async function updateActiveChallengeId(uid: string, challengeId: string | null): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  try {
    await setDoc(
      docRef,
      {
        uid,
        activeChallengeId: challengeId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
  }
}

export async function addJoinedChallengeId(uid: string, challengeId: string): Promise<void> {
  const userDocRef = doc(db, 'users', uid);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userDocRef);
      if (!snap.exists()) {
        transaction.set(userDocRef, {
          uid,
          name: auth.currentUser?.displayName || 'Student',
          email: auth.currentUser?.email || '',
          role: 'user',
          joinedChallengeIds: [challengeId],
          lastLoginAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
        return;
      }
      const data = snap.data();
      const currentIds: string[] = Array.isArray(data.joinedChallengeIds) ? data.joinedChallengeIds : [];
      if (!currentIds.includes(challengeId)) {
        currentIds.push(challengeId);
        transaction.update(userDocRef, {
          joinedChallengeIds: currentIds,
          lastLoginAt: new Date().toISOString(),
        });
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

function logSnapshotError(error: unknown, operationType: OperationType, path: string) {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string })?.code;

  const errInfo = {
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

  if (code === 'unavailable' || message.includes('offline')) {
    console.warn('Firestore Connectivity Issue: ', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
}

export function subscribeUserProgress(
  uid: string,
  onData: (progress: UserProgressDoc | null) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!auth.currentUser) {
    onData(null);
    return () => {};
  }

  const docRef = doc(db, COLLECTION_NAME, uid);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as UserProgressDoc);
      } else {
        onData(null);
      }
    },
    (err) => {
      if (onError) onError(err);
      logSnapshotError(err, OperationType.GET, `${COLLECTION_NAME}/${uid}`);
    }
  );
}

/**
 * Explicit set with completion log maintenance:
 * - topicProgress[topicId][type] = value
 * - completionLog[topicId][type] = value ? Date.now() : null
 *
 * Uses setDoc with merge: true so that writes are queued into Firestore's offline cache
 * and synced automatically upon reconnect.
 */
export async function setUserTopicProgress(
  uid: string,
  topicId: string,
  type: 'theory' | 'practice',
  value: boolean
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  try {
    await setDoc(
      docRef,
      {
        uid,
        topicProgress: {
          [topicId]: {
            [type]: value,
          },
        },
        completionLog: {
          [topicId]: {
            [type]: value ? nowMs : null,
          },
        },
        updatedAt: nowIso,
      },
      { merge: true }
    );
  } catch (err) {
    if (isConnectionError(err)) {
      console.warn('setUserTopicProgress write queued offline:', err);
      return;
    }
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
  }
}

/**
 * Single-flag toggle with explicit value support or cache-derived flip:
 * If explicitValue is provided, uses that explicit value idempotently via setUserTopicProgress.
 * Otherwise, derives nextValue from local cached doc state (or fallback default),
 * and issues an explicit set-style write (setDoc merge) so offline writes queue properly.
 */
export async function toggleUserTopicProgress(
  uid: string,
  topicId: string,
  type: 'theory' | 'practice',
  explicitValue?: boolean
): Promise<void> {
  if (explicitValue !== undefined) {
    return setUserTopicProgress(uid, topicId, type, explicitValue);
  }

  const docRef = doc(db, COLLECTION_NAME, uid);
  const cachedSnap = await getDocFromCache(docRef).catch(() => null);
  const cachedData = cachedSnap && cachedSnap.exists() ? (cachedSnap.data() as UserProgressDoc) : null;
  const currentVal = Boolean(cachedData?.topicProgress?.[topicId]?.[type]);
  const nextValue = !currentVal;

  return setUserTopicProgress(uid, topicId, type, nextValue);
}

/**
 * Batch variant:
 * For each topicId in updates: sets topicProgress fields AND mirrors each flag PRESENT
 * into completionLog (true -> Date.now(), false -> null) via setDoc merge so offline writes queue properly.
 */
export async function setUserTopicProgressBatch(
  uid: string,
  updates: Record<string, UserTopicProgress>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  const topicProgressPayload: Record<string, any> = {};
  const completionLogPayload: Record<string, any> = {};

  for (const [topicId, prog] of Object.entries(updates)) {
    topicProgressPayload[topicId] = {};
    completionLogPayload[topicId] = {};

    if (prog.theory !== undefined) {
      topicProgressPayload[topicId].theory = prog.theory;
      completionLogPayload[topicId].theory = prog.theory ? nowMs : null;
    }

    if (prog.practice !== undefined) {
      topicProgressPayload[topicId].practice = prog.practice;
      completionLogPayload[topicId].practice = prog.practice ? nowMs : null;
    }
  }

  try {
    await setDoc(
      docRef,
      {
        uid,
        topicProgress: topicProgressPayload,
        completionLog: completionLogPayload,
        updatedAt: nowIso,
      },
      { merge: true }
    );
  } catch (err) {
    if (isConnectionError(err)) {
      console.warn('setUserTopicProgressBatch write queued offline:', err);
      return;
    }
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
  }
}

/**
 * Live-read subscription for ROOM displays (any signed-in member's doc).
 */
export function subscribeMemberProgress(
  uid: string,
  onData: (doc: UserProgressDoc | null) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!auth.currentUser) {
    onData(null);
    return () => {};
  }

  const docRef = doc(db, COLLECTION_NAME, uid);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as UserProgressDoc);
      } else {
        onData(null);
      }
    },
    (err) => {
      if (onError) onError(err);
      logSnapshotError(err, OperationType.GET, `${COLLECTION_NAME}/${uid}`);
    }
  );
}

/**
 * Reset helper for challenge scope:
 * Deletes topicProgress[topicId] and completionLog[topicId] for every id in topicIds.
 */
export async function resetTopicsProgress(
  uid: string,
  topicIds: string[]
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) return;

      const data = snap.data() as UserProgressDoc;
      const currentProgress = { ...(data.topicProgress || {}) };
      const currentLog = { ...(data.completionLog || {}) };

      for (const topicId of topicIds) {
        delete currentProgress[topicId];
        delete currentLog[topicId];
      }

      transaction.update(docRef, {
        topicProgress: currentProgress,
        completionLog: currentLog,
        updatedAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
  }
}

/**
 * PER-USER ISOLATION GUARANTEE:
 * This function writes ONLY to the specific document `user_progress/${uid}`,
 * where `uid` MUST match `auth.currentUser.uid`. It never queries the collection,
 * never performs collection scans, and never touches any other user's document.
 * In a single atomic operation, it clears `topicProgress` and `completionLog` (setting both to `{}`),
 * while strictly PRESERVING all other fields (uid, peerCode, hiddenSubjectIds, savedSyllabusIds, activeChallengeId, quickLogs).
 */
export async function resetAllHscProgress(uid: string): Promise<void> {
  if (!uid || (auth.currentUser && auth.currentUser.uid !== uid)) {
    throw new Error('Unauthorized or invalid UID for HSC progress reset.');
  }

  const docRef = doc(db, COLLECTION_NAME, uid);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      const nowIso = new Date().toISOString();
      if (!snap.exists()) {
        const initialDoc: UserProgressDoc = {
          uid,
          topicProgress: {},
          completionLog: {},
          updatedAt: nowIso,
        };
        transaction.set(docRef, initialDoc);
        return;
      }

      transaction.update(docRef, {
        topicProgress: {},
        completionLog: {},
        updatedAt: nowIso,
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
    throw err;
  }
}

/**
 * Toggles hiding a master subject for the current user in user_progress
 */
export async function toggleHideSubject(uid: string, subjectId: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      const nowIso = new Date().toISOString();
      if (!snap.exists()) {
        const initialDoc: UserProgressDoc = {
          uid,
          topicProgress: {},
          hiddenSubjectIds: [subjectId],
          updatedAt: nowIso,
        };
        transaction.set(docRef, initialDoc);
        return;
      }

      const data = snap.data() as UserProgressDoc;
      const currentHidden = Array.isArray(data.hiddenSubjectIds) ? data.hiddenSubjectIds : [];
      const nextHidden = currentHidden.includes(subjectId)
        ? currentHidden.filter((id) => id !== subjectId)
        : [...currentHidden, subjectId];

      transaction.update(docRef, {
        hiddenSubjectIds: nextHidden,
        updatedAt: nowIso,
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
  }
}

/**
 * Sets the complete list of hidden subject IDs for the user in user_progress
 */
export async function setHiddenSubjectIds(uid: string, hiddenIds: string[]): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  try {
    await setDoc(
      docRef,
      {
        uid,
        hiddenSubjectIds: hiddenIds,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
  }
}

/**
 * Appends a quick study session log entry to the user's progress document in user_progress
 */
export async function addQuickStudyLog(
  uid: string,
  entry: { subject: string; minutes: number; notes?: string }
): Promise<QuickStudyLogItem> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  const now = new Date();
  const logItem: QuickStudyLogItem = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    subject: entry.subject,
    minutes: Math.max(1, entry.minutes),
    notes: entry.notes?.trim() || '',
    timestamp: now.getTime(),
    createdAt: now.toISOString(),
  };

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) {
        const initialDoc: UserProgressDoc = {
          uid,
          topicProgress: {},
          quickLogs: [logItem],
          updatedAt: now.toISOString(),
        };
        transaction.set(docRef, initialDoc);
      } else {
        const data = snap.data() as UserProgressDoc;
        const currentLogs = Array.isArray(data.quickLogs) ? data.quickLogs : [];
        const updatedLogs = [logItem, ...currentLogs].slice(0, 100);
        transaction.update(docRef, {
          quickLogs: updatedLogs,
          updatedAt: now.toISOString(),
        });
      }
    });
    return logItem;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
  }
}

