import { collection, doc, setDoc, onSnapshot, query, where, Unsubscribe } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { WeeklySnapshot } from '../types/weeklySnapshot';

const COLLECTION_NAME = 'weekly_snapshots';

export function snapshotDocId(uid: string, weekKey: string): string {
  return `${uid}_${weekKey}`;
}

export async function upsertMyWeeklySnapshot(snapshot: WeeklySnapshot): Promise<void> {
  const docId = snapshotDocId(snapshot.uid, snapshot.weekKey);
  const docRef = doc(db, COLLECTION_NAME, docId);
  
  try {
    await setDoc(docRef, {
      ...snapshot,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTION_NAME}/${docId}`);
  }
}

export function subscribeWeeklySnapshots(
  weekKey: string,
  onData: (snapshots: WeeklySnapshot[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!auth.currentUser) {
    onData([]);
    return () => {};
  }

  const q = query(collection(db, COLLECTION_NAME), where('weekKey', '==', weekKey));
  
  return onSnapshot(
    q,
    (snap) => {
      const snapshots: WeeklySnapshot[] = [];
      snap.forEach((doc) => {
        snapshots.push(doc.data() as WeeklySnapshot);
      });
      onData(snapshots);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
    }
  );
}
