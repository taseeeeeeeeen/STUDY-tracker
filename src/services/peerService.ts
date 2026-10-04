import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProgressDoc } from './userProgressService';
import { PeerLink } from '../types/peerLink';
import { computeWeeklyCompletion, computeOverallPercent } from '../lib/progressMath';

const PEER_LINKS_COLLECTION = 'peer_links';
const USER_PROGRESS_COLLECTION = 'user_progress';

/**
 * Standard utility to produce a deterministic, sorted pair key: sortedUidA_sortedUidB.
 */
export function getPeerLinkId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

/**
 * Generates a stable 6-char peer code using the same character set as challenge codes.
 */
export function generatePeerCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Reads user_progress/{uid}.peerCode; if absent, generates a 6-character alphanumeric code,
 * saves it to the document, and returns it.
 */
export async function getOrCreatePeerCode(uid: string): Promise<string> {
  const docRef = doc(db, USER_PROGRESS_COLLECTION, uid);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as UserProgressDoc;
      if (data.peerCode) {
        return data.peerCode;
      }
    }

    const newCode = generatePeerCode();
    await setDoc(
      docRef,
      {
        uid,
        peerCode: newCode,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return newCode;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${USER_PROGRESS_COLLECTION}/${uid}`);
  }
}

/**
 * Resolves the peerCode to a uid by querying user_progress where peerCode == code.
 * If found and not self: creates/merges peer_links/{sortedUidA_sortedUidB} with status: 'requested',
 * requestedBy: requesterUid, unless a doc already exists (returning its status; if status is 'active' returns 'active').
 */
export async function requestPeerLink(
  requesterUid: string,
  requesterName: string,
  peerCode: string
): Promise<'sent' | 'active' | 'not_found'> {
  const cleanCode = peerCode.toUpperCase().trim();
  try {
    const q = query(
      collection(db, USER_PROGRESS_COLLECTION),
      where('peerCode', '==', cleanCode)
    );
    const querySnap = await getDocs(q);

    if (querySnap.empty) {
      return 'not_found';
    }

    const targetDoc = querySnap.docs[0];
    const targetUid = targetDoc.id;

    if (!targetUid || targetUid === requesterUid) {
      return 'not_found';
    }

    const pairId = getPeerLinkId(requesterUid, targetUid);
    const linkRef = doc(db, PEER_LINKS_COLLECTION, pairId);
    const linkSnap = await getDoc(linkRef);

    if (linkSnap.exists()) {
      const data = linkSnap.data() as PeerLink;
      if (data.status === 'active') {
        return 'active';
      }
      return 'sent';
    }

    const newLink: PeerLink = {
      id: pairId,
      uids: [requesterUid, targetUid].sort(),
      status: 'requested',
      requestedBy: requesterUid,
      requesterName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(linkRef, newLink, { merge: true });
    return 'sent';
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, PEER_LINKS_COLLECTION);
  }
}

/**
 * Sets status: 'active' on the pair doc between uid and otherUid.
 */
export async function acceptPeerLink(uid: string, otherUid: string): Promise<void> {
  const pairId = getPeerLinkId(uid, otherUid);
  const linkRef = doc(db, PEER_LINKS_COLLECTION, pairId);
  try {
    await updateDoc(linkRef, {
      status: 'active',
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${PEER_LINKS_COLLECTION}/${pairId}`);
  }
}

/**
 * Queries peer_links where uids array-contains uid and status == 'active'.
 */
export async function listActivePeers(uid: string): Promise<PeerLink[]> {
  try {
    const q = query(
      collection(db, PEER_LINKS_COLLECTION),
      where('uids', 'array-contains', uid),
      where('status', '==', 'active')
    );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => docSnap.data() as PeerLink);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, PEER_LINKS_COLLECTION);
  }
}

/**
 * One getDoc on user_progress/{uid} used for the linked peer's numbers.
 */
export async function fetchUserProgressSnapshot(uid: string): Promise<UserProgressDoc | null> {
  const docRef = doc(db, USER_PROGRESS_COLLECTION, uid);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as UserProgressDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${USER_PROGRESS_COLLECTION}/${uid}`);
  }
}

/**
 * Computes weekly completion and overall percent comparison between two user snapshots.
 */
export function computePeerComparison(
  mySnapshot: UserProgressDoc | null,
  peerSnapshot: UserProgressDoc | null,
  nowMs: number
): {
  myWeek: { topicsDone: number; topicsTotal: number; percent: number };
  peerWeek: { topicsDone: number; topicsTotal: number; percent: number };
  myOverallPercent: number;
  peerOverallPercent: number;
} {
  const computeSide = (snapshot: UserProgressDoc | null) => {
    if (!snapshot) {
      return {
        week: { topicsDone: 0, topicsTotal: 0, percent: 0 },
        overallPercent: 0,
      };
    }

    const allowList =
      snapshot.savedSyllabusIds && snapshot.savedSyllabusIds.length > 0
        ? snapshot.savedSyllabusIds
        : null;

    const topicProgress = snapshot.topicProgress || {};
    const week = computeWeeklyCompletion(
      topicProgress,
      snapshot.completionLog,
      allowList,
      nowMs
    );

    const candidateIds = allowList !== null ? allowList : Object.keys(topicProgress);
    const mappedTopics = candidateIds.map((id) => ({
      is_theory_done: Boolean(topicProgress[id]?.theory),
      is_practice_done: Boolean(topicProgress[id]?.practice),
    }));

    const overallPercent = computeOverallPercent(mappedTopics);

    return { week, overallPercent };
  };

  const my = computeSide(mySnapshot);
  const peer = computeSide(peerSnapshot);

  return {
    myWeek: my.week,
    peerWeek: peer.week,
    myOverallPercent: my.overallPercent,
    peerOverallPercent: peer.overallPercent,
  };
}
