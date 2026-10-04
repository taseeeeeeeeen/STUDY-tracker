import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
  runTransaction,
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
) {
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

export async function toggleUserTopicProgress(
  uid: string,
  topicId: string,
  type: 'theory' | 'practice'
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      const now = new Date().toISOString();

      if (!snap.exists()) {
        const initialDoc: UserProgressDoc = {
          uid,
          topicProgress: {
            [topicId]: {
              theory: type === 'theory',
              practice: type === 'practice',
            },
          },
          updatedAt: now,
        };
        transaction.set(docRef, initialDoc);
      } else {
        const data = snap.data() as UserProgressDoc;
        const currentTopicProg = (data.topicProgress || {})[topicId] || {
          theory: false,
          practice: false,
        };

        const updatedTopicProg = {
          ...currentTopicProg,
          [type]: !currentTopicProg[type],
        };

        transaction.update(docRef, {
          [`topicProgress.${topicId}`]: updatedTopicProg,
          updatedAt: now,
        });
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
  }
}

export async function saveBatchUserTopicProgress(
  uid: string,
  updates: Record<string, UserTopicProgress>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      const now = new Date().toISOString();

      if (!snap.exists()) {
        const initialDoc: UserProgressDoc = {
          uid,
          topicProgress: updates,
          updatedAt: now,
        };
        transaction.set(docRef, initialDoc);
      } else {
        const data = snap.data() as UserProgressDoc;
        const mergedProgress = {
          ...(data.topicProgress || {}),
          ...updates,
        };

        transaction.update(docRef, {
          topicProgress: mergedProgress,
          updatedAt: now,
        });
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${uid}`);
  }
}
