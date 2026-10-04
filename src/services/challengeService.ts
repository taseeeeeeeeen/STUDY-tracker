import {
  collection,
  doc,
  getDoc,
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
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
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

  // Generate a unique code if one isn't provided
  let code = challenge.code;
  if (!code) {
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 5) {
      const candidate = generateChallengeCode();
      const existing = await findChallengeByCode(candidate);
      if (!existing) {
        code = candidate;
        isUnique = true;
      }
      attempts++;
    }
    // Fallback if somehow collisions persist
    if (!code) code = generateChallengeCode();
  }

  const finalPayload: FirestoreChallenge = {
    ...challenge,
    challenge_id: challengeId,
    code,
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, COLLECTION_NAME, challengeId), finalPayload);
    return finalPayload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTION_NAME}/${challengeId}`);
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
      handleFirestoreError(err, OperationType.GET, `${COLLECTION_NAME}/${challengeId}`);
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
    return snap.docs[0].data() as FirestoreChallenge;
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
    const snap = await getDoc(challengeRef);
    if (!snap.exists()) {
      throw new Error(`Challenge with ID ${challengeId} not found.`);
    }

    const currentChallenge = snap.data() as FirestoreChallenge;
    const existingIndex = currentChallenge.participants.findIndex(
      (p) => p.uid === user.uid
    );

    if (existingIndex !== -1) {
      // User is already a participant
      return currentChallenge;
    }

    // Initialize progress for all topics in the challenge
    const initialProgress: Record<string, ParticipantTopicProgress> = {};
    currentChallenge.selected_syllabus.forEach((top) => {
      initialProgress[top.id] = { theory: false, practice: false };
    });

    const newParticipant: ChallengeParticipant = {
      uid: user.uid,
      name: user.name,
      email: user.email,
      photoURL: user.photoURL,
      completed_topics: 0,
      total_challenge_topics: currentChallenge.selected_syllabus.length,
      last_completion_timestamp: Date.now(),
      topic_progress: initialProgress,
      joined_at: new Date().toISOString(),
    };

    const updatedParticipants = [...currentChallenge.participants, newParticipant];

    await updateDoc(challengeRef, {
      participants: updatedParticipants,
      updatedAt: new Date().toISOString(),
    });

    return {
      ...currentChallenge,
      participants: updatedParticipants,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${challengeId}`);
  }
}

export async function toggleTopicProgressInChallenge(
  challengeId: string,
  uid: string,
  topicId: string,
  type: 'theory' | 'practice'
): Promise<void> {
  const challengeRef = doc(db, COLLECTION_NAME, challengeId);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(challengeRef);
      if (!snap.exists()) return;

      const challengeData = snap.data() as FirestoreChallenge;
      const participants = [...challengeData.participants];
      let participantIndex = participants.findIndex((p) => p.uid === uid);

      if (participantIndex === -1) {
        // If user wasn't registered in participants array yet, create initial entry
        const initialProgress: Record<string, ParticipantTopicProgress> = {};
        challengeData.selected_syllabus.forEach((top) => {
          initialProgress[top.id] = { theory: false, practice: false };
        });

        const newPart: ChallengeParticipant = {
          uid,
          name: 'Student',
          completed_topics: 0,
          total_challenge_topics: challengeData.selected_syllabus.length,
          last_completion_timestamp: Date.now(),
          topic_progress: initialProgress,
          joined_at: new Date().toISOString(),
        };
        participants.push(newPart);
        participantIndex = participants.length - 1;
      }

      const participant = { ...participants[participantIndex] };
      const currentProgress = { ...(participant.topic_progress || {}) };
      const topicState = currentProgress[topicId] || { theory: false, practice: false };

      // Toggle target state
      const nextState = {
        ...topicState,
        [type]: !topicState[type],
      };
      currentProgress[topicId] = nextState;
      participant.topic_progress = currentProgress;

      // Recalculate completed topics count
      // Each topic has weight 2: Theory = 1 pt, Practice = 1 pt (Total 2 pts)
      let totalPoints = 0;
      Object.values(currentProgress).forEach((prog) => {
        if (prog.theory) totalPoints += 1;
        if (prog.practice) totalPoints += 1;
      });

      participant.completed_topics = totalPoints / 2;
      participant.last_completion_timestamp = Date.now();
      participants[participantIndex] = participant;

      transaction.update(challengeRef, {
        participants,
        updatedAt: new Date().toISOString(),
      });
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


