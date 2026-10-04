import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { MasterSubject } from '../types/syllabus';
import { DEFAULT_HSC_SYLLABUS, parseAndNormalizeSyllabus } from '../data/defaultSyllabusSeed';

const COLLECTION_NAME = 'master_syllabus';

export async function fetchMasterSyllabus(): Promise<MasterSubject[]> {
  if (!auth.currentUser) {
    return DEFAULT_HSC_SYLLABUS;
  }
  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    const subjects: MasterSubject[] = [];
    snap.forEach((d) => {
      subjects.push(d.data() as MasterSubject);
    });
    return subjects.sort((a, b) => a.order - b.order);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
  }
}

export function subscribeMasterSyllabus(
  onData: (subjects: MasterSubject[]) => void,
  onError?: (err: unknown) => void
) {
  if (!auth.currentUser) {
    onData(DEFAULT_HSC_SYLLABUS);
    return () => {};
  }

  return onSnapshot(
    collection(db, COLLECTION_NAME),
    (snap) => {
      const subjects: MasterSubject[] = [];
      snap.forEach((d) => {
        subjects.push(d.data() as MasterSubject);
      });
      subjects.sort((a, b) => a.order - b.order);
      onData(subjects);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
    }
  );
}

export async function saveSubject(subject: MasterSubject, adminUid?: string): Promise<void> {
  try {
    const payload = {
      ...subject,
      updatedAt: new Date().toISOString(),
      updatedBy: adminUid || 'admin',
    };
    await setDoc(doc(db, COLLECTION_NAME, subject.id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTION_NAME}/${subject.id}`);
  }
}

export async function deleteSubject(subjectId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, subjectId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTION_NAME}/${subjectId}`);
  }
}

/**
 * Seeds or imports the default official HSC syllabus into Firestore
 */
export async function seedDefaultSyllabus(adminUid?: string): Promise<void> {
  try {
    for (const sub of DEFAULT_HSC_SYLLABUS) {
      await saveSubject(sub, adminUid);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTION_NAME);
  }
}

/**
 * Validates and imports arbitrary raw HSC syllabus JSON or MasterSubject[] into Firestore
 * Uses deterministic stable IDs so re-importing is idempotent and updates existing records.
 */
export async function importSyllabusJson(
  jsonData: unknown,
  adminUid?: string
): Promise<{ count: number; subjects: MasterSubject[] }> {
  try {
    let parsedData = jsonData;
    if (typeof jsonData === 'string') {
      parsedData = JSON.parse(jsonData);
    }

    const normalizedSubjects = parseAndNormalizeSyllabus(parsedData);

    if (normalizedSubjects.length === 0) {
      throw new Error('No valid subjects or chapters found in the provided JSON.');
    }

    for (const sub of normalizedSubjects) {
      await saveSubject(sub, adminUid);
    }

    return {
      count: normalizedSubjects.length,
      subjects: normalizedSubjects,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTION_NAME);
    throw err;
  }
}
