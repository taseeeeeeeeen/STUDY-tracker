import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { FirestoreChallenge } from '../types/challenge';
import { getChallengeEndDate, isChallengeActive } from './challengeService';

const COLLECTION_NAME = 'challenges';

/**
 * Fetches challenges created by the user that are archived or expired.
 * Note: Only queries created_by == uid, so joined contender rooms never appear
 * (per design, the archive exclusively covers the user's own study sprints).
 *
 * Filtering rules:
 * - Excludes the currently active challenge id passed as activeChallengeId.
 * - Includes a document iff:
 *     (a) its status === 'archived', OR
 *     (b) it has start_date and duration and isChallengeActive(doc) is false as of now.
 * - Sorts by computed end date, newest first.
 * - Never mutates the documents.
 */
export async function fetchArchivedChallenges(
  uid: string,
  activeChallengeId?: string | null
): Promise<FirestoreChallenge[]> {
  if (!uid) return [];

  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('created_by', '==', uid)
    );
    const snap = await getDocs(q);
    if (snap.empty) return [];

    const now = Date.now();
    const archivedList: FirestoreChallenge[] = [];

    snap.docs.forEach((docSnap) => {
      const challenge = docSnap.data() as FirestoreChallenge;

      // Skip invalid / deleted documents
      if (!challenge || !challenge.challenge_id) return;

      // Exclude the currently active personal sprint
      if (activeChallengeId && challenge.challenge_id === activeChallengeId) {
        return;
      }

      // Check archived status or past/expired timeframe
      const isArchived = challenge.status === 'archived';
      const hasDateAndDuration = Boolean(challenge.start_date && challenge.duration > 0);
      const isExpiredOrInactive =
        hasDateAndDuration && !isChallengeActive(challenge, now);

      if (isArchived || isExpiredOrInactive) {
        archivedList.push(challenge);
      }
    });

    // Sort by computed local end date, newest first
    archivedList.sort((a, b) => {
      const endA = getChallengeEndDate(a).getTime();
      const endB = getChallengeEndDate(b).getTime();
      const validEndA = isNaN(endA) ? 0 : endA;
      const validEndB = isNaN(endB) ? 0 : endB;
      return validEndB - validEndA;
    });

    return archivedList;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
    return [];
  }
}
