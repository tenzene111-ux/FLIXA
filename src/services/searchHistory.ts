import { collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { normalizeKey } from './search';

export type SearchHistoryItem = {
  id: string;
  query: string;
  lastSearchedAt: number;
};

function historyRef(uid: string) {
  return collection(db, 'users', uid, 'searchHistory');
}

// Owner-writable, like savedVideos — unlike searchTrends (server-only,
// global), this is purely a personal "what did I search recently" list.
export function subscribeToSearchHistory(uid: string, onChange: (items: SearchHistoryItem[]) => void) {
  return onSnapshot(historyRef(uid), (snapshot) => {
    const items = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        query: (data.query as string) ?? docSnap.id,
        lastSearchedAt: data.lastSearchedAt instanceof Timestamp ? data.lastSearchedAt.toMillis() : Date.now(),
      };
    });
    items.sort((a, b) => b.lastSearchedAt - a.lastSearchedAt);
    onChange(items);
  });
}

export async function recordSearchHistory(uid: string, rawQuery: string): Promise<void> {
  const trimmed = rawQuery.trim();
  if (trimmed.length < 2) return;
  const id = normalizeKey(trimmed);
  if (!id) return;
  await setDoc(doc(historyRef(uid), id), { query: trimmed, lastSearchedAt: serverTimestamp() }, { merge: true });
}

export async function removeSearchHistoryItem(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(historyRef(uid), id));
}

export async function clearSearchHistory(uid: string): Promise<void> {
  const snapshot = await getDocs(historyRef(uid));
  await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
}
