import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
  runTransaction,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';

export interface UserTopicProgress {
  theory: boolean;
  practice: boolean;
}

export interface UserProgressDoc {
  uid: string;
  topicProgress: Record<string, UserTopicProgress>;
  activeChallengeId?: string | null;
  updatedAt: string;
  peerCode?: string;
  savedSyllabusIds?: string[];
  completionLog?: Record<string, { theory: number | null; practice: number | null }>;
}

const COLLECTION_NAME = 'user_progress';

export async function updateActiveChallengeId(uid: string, challengeId: string | null): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  try {
    await updateDoc(docRef, {
      activeChallengeId: challengeId,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // If doc doesn't exist, create it
    try {
      await setDoc(docRef, {
        uid,
        topicProgress: {},
        activeChallengeId: challengeId,
        updatedAt: new Date().toISOString(),
      });
    } catch (innerErr) {
      handleFirestoreError(innerErr, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
    }
  }
}

export async function addJoinedChallengeId(uid: string, challengeId: string): Promise<void> {
  const userDocRef = doc(db, 'users', uid);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userDocRef);
      if (!snap.exists()) return;
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
      handleFirestoreError(err, OperationType.GET, `${COLLECTION_NAME}/${uid}`);
    }
  );
}

/**
 * Explicit set with completion log maintenance:
 * - topicProgress[topicId][type] = value
 * - completionLog[topicId][type] = value ? Date.now() : null
 */
export async function setUserTopicProgress(
  uid: string,
  topicId: string,
  type: 'theory' | 'practice',
  value: boolean
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      const nowIso = new Date().toISOString();
      const nowMs = Date.now();

      if (!snap.exists()) {
        const initialDoc: UserProgressDoc = {
          uid,
          topicProgress: {
            [topicId]: {
              theory: type === 'theory' ? value : false,
              practice: type === 'practice' ? value : false,
            },
          },
          completionLog: {
            [topicId]: {
              theory: type === 'theory' && value ? nowMs : null,
              practice: type === 'practice' && value ? nowMs : null,
            },
          },
          updatedAt: nowIso,
        };
        transaction.set(docRef, initialDoc);
      } else {
        const data = snap.data() as UserProgressDoc;
        const currentTopicProg = data.topicProgress?.[topicId] || {
          theory: false,
          practice: false,
        };
        const currentLog = data.completionLog?.[topicId] || {
          theory: null,
          practice: null,
        };

        const updatedTopicProg = {
          ...currentTopicProg,
          [type]: value,
        };

        const updatedLog = {
          ...currentLog,
          [type]: value ? nowMs : null,
        };

        transaction.update(docRef, {
          [`topicProgress.${topicId}`]: updatedTopicProg,
          [`completionLog.${topicId}`]: updatedLog,
          updatedAt: nowIso,
        });
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
  }
}

/**
 * Backward-compatible wrapper calling setUserTopicProgress with !current value.
 */
export async function toggleUserTopicProgress(
  uid: string,
  topicId: string,
  type: 'theory' | 'practice'
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  try {
    const snap = await getDoc(docRef);
    const data = snap.exists() ? (snap.data() as UserProgressDoc) : null;
    const currentVal = Boolean(data?.topicProgress?.[topicId]?.[type]);
    await setUserTopicProgress(uid, topicId, type, !currentVal);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
  }
}

/**
 * Batch variant:
 * For each topicId in updates: set topicProgress fields AND mirror each flag PRESENT
 * into completionLog (true -> Date.now(), false -> null).
 */
export async function setUserTopicProgressBatch(
  uid: string,
  updates: Record<string, UserTopicProgress>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      const nowIso = new Date().toISOString();
      const nowMs = Date.now();

      if (!snap.exists()) {
        const initialTopicProgress: Record<string, UserTopicProgress> = {};
        const initialCompletionLog: Record<string, { theory: number | null; practice: number | null }> = {};

        for (const [topicId, prog] of Object.entries(updates)) {
          initialTopicProgress[topicId] = { ...prog };
          initialCompletionLog[topicId] = {
            theory: prog.theory ? nowMs : null,
            practice: prog.practice ? nowMs : null,
          };
        }

        const initialDoc: UserProgressDoc = {
          uid,
          topicProgress: initialTopicProgress,
          completionLog: initialCompletionLog,
          updatedAt: nowIso,
        };
        transaction.set(docRef, initialDoc);
      } else {
        const data = snap.data() as UserProgressDoc;
        const currentProgress = { ...(data.topicProgress || {}) };
        const currentLog = { ...(data.completionLog || {}) };

        for (const [topicId, prog] of Object.entries(updates)) {
          const existingProg = currentProgress[topicId] || { theory: false, practice: false };
          const existingLog = currentLog[topicId] || { theory: null, practice: null };

          currentProgress[topicId] = {
            ...existingProg,
            ...prog,
          };

          currentLog[topicId] = {
            theory: prog.theory !== undefined ? (prog.theory ? (existingLog.theory && existingProg.theory ? existingLog.theory : nowMs) : null) : existingLog.theory,
            practice: prog.practice !== undefined ? (prog.practice ? (existingLog.practice && existingProg.practice ? existingLog.practice : nowMs) : null) : existingLog.practice,
          };
        }

        transaction.update(docRef, {
          topicProgress: currentProgress,
          completionLog: currentLog,
          updatedAt: nowIso,
        });
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
  }
}

/**
 * Refactored saveBatchUserTopicProgress pointing to setUserTopicProgressBatch.
 */
export async function saveBatchUserTopicProgress(
  uid: string,
  updates: Record<string, UserTopicProgress>
): Promise<void> {
  return setUserTopicProgressBatch(uid, updates);
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
      handleFirestoreError(err, OperationType.GET, `${COLLECTION_NAME}/${uid}`);
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
