import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export function subscribeIsSaved(uid: string, videoId: string, onChange: (saved: boolean) => void) {
  return onSnapshot(doc(db, 'users', uid, 'savedVideos', videoId), (snap) => onChange(snap.exists()));
}

export async function toggleSave(uid: string, videoId: string, saved: boolean): Promise<void> {
  const ref = doc(db, 'users', uid, 'savedVideos', videoId);
  if (saved) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, { createdAt: Date.now() });
  }
}

export function subscribeSavedVideoIds(uid: string, onChange: (ids: string[]) => void) {
  return onSnapshot(collection(db, 'users', uid, 'savedVideos'), (snap) => {
    onChange(snap.docs.map((d) => d.id));
  });
}
