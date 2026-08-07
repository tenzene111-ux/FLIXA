import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export function subscribeIsSaved(uid: string, videoId: string, onChange: (saved: boolean) => void) {
  return onSnapshot(doc(db, 'users', uid, 'savedVideos', videoId), (snapshot) => onChange(snapshot.exists()));
}

export async function toggleSave(uid: string, videoId: string, saved: boolean): Promise<void> {
  const savedRef = doc(db, 'users', uid, 'savedVideos', videoId);
  if (saved) {
    await deleteDoc(savedRef);
  } else {
    await setDoc(savedRef, { createdAt: Date.now() });
  }
}

export function subscribeSavedVideoIds(uid: string, onChange: (ids: string[]) => void) {
  return onSnapshot(collection(db, 'users', uid, 'savedVideos'), (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => docSnap.id));
  });
}
