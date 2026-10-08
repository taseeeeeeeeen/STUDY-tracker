import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  FirestoreChallenge,
  ChallengeParticipant,
  ParticipantTopicProgress,
} from '../types/challenge';

const COLLECTION_NAME = 'challenges';

// Generate 6-char alphanumeric code like CH-9A2X7B
export function generateChallengeCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buffer = new Uint8Array(6);
    crypto.getRandomValues(buffer);
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(buffer[i] % chars.length);
    }
  } else {
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return `CH-${rand}`;
}

export async function createFirestoreChallenge(
  challenge: Omit<FirestoreChallenge, 'challenge_id' | 'code' | 'updatedAt'> & {
    challenge_id?: string;
    code?: string;
  }
): Promise<FirestoreChallenge> {
  const challengeId =
    challenge.challenge_id ||
    `ch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const maxRetries = 5;
  let attempts = 0;
  let code = challenge.code;

  while (attempts < maxRetries) {
    attempts++;

    // Generate a candidate code if not provided or if regenerating after a detected collision
    if (!code || attempts > 1) {
      let candidate = generateChallengeCode();
      let candidateAttempts = 0;
      while (candidateAttempts < 5) {
        candidateAttempts++;
        const existing = await findChallengeByCode(candidate);
        if (!existing || existing.challenge_id === challengeId) {
          break;
        }
        candidate = generateChallengeCode();
      }
      code = candidate;
    }

    const finalPayload: FirestoreChallenge = {
      ...challenge,
      challenge_id: challengeId,
      code,
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, COLLECTION_NAME, challengeId), finalPayload);

      // Verify write-time uniqueness:
      // Query for any other challenges sharing this exact code to catch concurrent race writes
      const q = query(
        collection(db, COLLECTION_NAME),
        where('code', '==', code)
      );
      const snap = await getDocs(q);

      // Check if any DIFFERENT challenge document shares this code
      const hasCollision = snap.docs.some((d) => d.id !== challengeId);

      if (!hasCollision) {
        return finalPayload;
      }

      console.warn(
        `Challenge code collision detected for "${code}" at write time (attempt ${attempts}/${maxRetries}). Retrying with a new code...`
      );
      code = undefined;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${COLLECTION_NAME}/${challengeId}`);
    }
  }

  throw new Error(`Failed to assign a unique challenge code after ${maxRetries} attempts.`);
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

export function subscribeChallenge(
  challengeId: string,
  onData: (challenge: FirestoreChallenge | null) => void,
  onError?: (err: unknown) => void
) {
  if (!auth.currentUser) {
    onData(null);
    return () => {};
  }

  return onSnapshot(
    doc(db, COLLECTION_NAME, challengeId),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as FirestoreChallenge);
      } else {
        onData(null);
      }
    },
    (err) => {
      if (onError) onError(err);
      logSnapshotError(err, OperationType.GET, `${COLLECTION_NAME}/${challengeId}`);
    }
  );
}

export async function findChallengeByCode(
  code: string
): Promise<FirestoreChallenge | null> {
  if (!auth.currentUser) return null;
  const cleanCode = code.toUpperCase().trim();
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('code', '==', cleanCode)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    if (snap.docs.length === 1) {
      return snap.docs[0].data() as FirestoreChallenge;
    }
    // If multiple documents match, prefer active challenge with the most recent update
    const all = snap.docs
      .map((d) => d.data() as FirestoreChallenge)
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    return all.find((c) => c.status !== 'archived') || all[0];
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
  }
}

export async function joinFirestoreChallenge(
  challengeId: string,
  user: { uid: string; name: string; email?: string; photoURL?: string }
): Promise<FirestoreChallenge> {
  const challengeRef = doc(db, COLLECTION_NAME, challengeId);
  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(challengeRef);
      if (!snap.exists()) {
        throw new Error(`Challenge with ID ${challengeId} not found.`);
      }

      const currentChallenge = snap.data() as FirestoreChallenge;
      const existingIndex = currentChallenge.participants.findIndex(
        (p) => p.uid === user.uid
      );

      if (existingIndex !== -1) {
        // User is already a participant (skip idempotently)
        return currentChallenge;
      }

      const initialTopicProgress: Record<string, ParticipantTopicProgress> = {};
      if (Array.isArray(currentChallenge.selected_syllabus)) {
        currentChallenge.selected_syllabus.forEach((s) => {
          if (s.id) {
            initialTopicProgress[s.id] = { theory: false, practice: false };
          }
        });
      }

      const newParticipant: ChallengeParticipant = {
        uid: user.uid,
        name: user.name,
        email: user.email,
        photoURL: user.photoURL,
        completed_topics: 0,
        total_challenge_topics: currentChallenge.selected_syllabus?.length || 0,
        last_completion_timestamp: Date.now(),
        topic_progress: initialTopicProgress,
        joined_at: new Date().toISOString(),
      };

      const updatedParticipants = [...currentChallenge.participants, newParticipant];

      transaction.update(challengeRef, {
        participants: updatedParticipants,
        updatedAt: new Date().toISOString(),
      });

      return {
        ...currentChallenge,
        participants: updatedParticipants,
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${challengeId}`);
  }
}

export async function updateChallengeDayAllocation(
  challengeId: string,
  dayWiseAllocation: Record<string, unknown[]>,
  startDate: string
): Promise<void> {
  const challengeRef = doc(db, COLLECTION_NAME, challengeId);
  try {
    await updateDoc(challengeRef, {
      day_wise_allocation: dayWiseAllocation,
      start_date: startDate,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${challengeId}`);
  }
}

export async function updateChallengeSyllabus(
  challengeId: string,
  selectedSyllabus: FirestoreChallenge['selected_syllabus'],
  participants: ChallengeParticipant[],
  dayWiseAllocation?: Record<string, unknown[]>
): Promise<void> {
  const challengeRef = doc(db, COLLECTION_NAME, challengeId);
  try {
    const updateData: Record<string, unknown> = {
      selected_syllabus: selectedSyllabus,
      participants,
      updatedAt: new Date().toISOString(),
    };
    if (dayWiseAllocation) {
      updateData.day_wise_allocation = dayWiseAllocation;
    }
    await updateDoc(challengeRef, updateData);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${challengeId}`);
  }
}

export async function removeTopicFromChallenge(
  challengeId: string,
  topicId: string,
  currentSyllabus: FirestoreChallenge['selected_syllabus'],
  currentParticipants: ChallengeParticipant[],
  dayWiseAllocation?: Record<string, unknown[]>
): Promise<void> {
  const updatedSyllabus = currentSyllabus.filter((item) => item.id !== topicId);
  const updatedParticipants = currentParticipants.map((p) => ({
    ...p,
    total_challenge_topics: updatedSyllabus.length,
  }));
  return updateChallengeSyllabus(
    challengeId,
    updatedSyllabus,
    updatedParticipants,
    dayWiseAllocation
  );
}

export async function restartChallengeClock(
  challengeId: string,
  isoStartDate: string
): Promise<void> {
  const challengeRef = doc(db, COLLECTION_NAME, challengeId);
  try {
    await updateDoc(challengeRef, {
      start_date: isoStartDate,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${challengeId}`);
  }
}

export function getChallengeEndDate(challenge: { start_date: string; duration: number }): Date {
  if (!challenge || !challenge.start_date) return new Date(NaN);
  const parts = challenge.start_date.split('T')[0].split('-');
  let startObj: Date;
  if (parts.length === 3) {
    startObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  } else {
    startObj = new Date(challenge.start_date);
  }
  if (isNaN(startObj.getTime())) return new Date(NaN);

  const duration = Math.max(1, challenge.duration);
  const endObj = new Date(startObj.getTime());
  endObj.setDate(endObj.getDate() + (duration - 1));
  endObj.setHours(23, 59, 59, 999);
  return endObj;
}

export function isChallengeActive(
  challenge: { start_date: string; duration: number; status?: string } | null,
  nowMs?: number
): boolean {
  if (!challenge) return false;
  if (challenge.status === 'archived') return false;
  if (!challenge.start_date) return false;
  if (challenge.duration <= 0) return false;

  const endDate = getChallengeEndDate(challenge);
  if (isNaN(endDate.getTime())) return false;

  const parts = challenge.start_date.split('T')[0].split('-');
  let startObj: Date;
  if (parts.length === 3) {
    startObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  } else {
    startObj = new Date(challenge.start_date);
  }
  if (isNaN(startObj.getTime())) return false;
  startObj.setHours(0, 0, 0, 0);

  const current = nowMs !== undefined ? nowMs : Date.now();
  return current >= startObj.getTime() && current <= endDate.getTime();
}

/**
 * Finds the currently active personal challenge created by the user, if one exists.
 */
export async function findActivePersonalChallenge(
  uid: string
): Promise<FirestoreChallenge | null> {
  if (!auth.currentUser || !uid) return null;
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('created_by', '==', uid)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;

    // Filter in-memory for active status to avoid composite index requirements
    const active = snap.docs
      .map((d) => d.data() as FirestoreChallenge)
      .filter((c) => c.status !== 'archived' && isChallengeActive(c));

    return active.length > 0 ? active[0] : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
  }
}

/**
 * Retires / archives an existing challenge so the user can start a new sprint.
 */
export async function archiveChallenge(challengeId: string): Promise<void> {
  const challengeRef = doc(db, COLLECTION_NAME, challengeId);
  try {
    await updateDoc(challengeRef, {
      status: 'archived',
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${challengeId}`);
  }
}

/**
 * Deletes a challenge document created by the user.
 */
export async function deleteFirestoreChallenge(challengeId: string): Promise<void> {
  const challengeRef = doc(db, COLLECTION_NAME, challengeId);
  try {
    await deleteDoc(challengeRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTION_NAME}/${challengeId}`);
  }
}


