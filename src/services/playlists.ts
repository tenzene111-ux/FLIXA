import { addDoc, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Playlist } from '../types/models';

export function subscribePlaylists(uid: string, onChange: (items: Playlist[]) => void) {
  const q = query(collection(db, 'users', uid, 'playlists'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Playlist, 'id'>) })));
  });
}

export async function createPlaylist(uid: string, name: string, coverUrl: string): Promise<void> {
  await addDoc(collection(db, 'users', uid, 'playlists'), {
    name,
    coverUrl,
    videoCount: 0,
    createdAt: Date.now(),
  });
}
