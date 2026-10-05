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
      logSnapshotError(err, OperationType.LIST, COLLECTION_NAME);
    }
  );
}
