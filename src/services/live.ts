import { addDoc, collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { LiveComment, LiveStream } from '../types/models';

export function subscribeActiveLiveStream(onChange: (stream: LiveStream | null) => void) {
  const q = query(collection(db, 'liveStreams'), where('isLive', '==', true), limit(1));
  return onSnapshot(q, (snap) => {
    const d = snap.docs[0];
    onChange(d ? ({ id: d.id, ...(d.data() as Omit<LiveStream, 'id'>) }) : null);
  });
}

export function subscribeLiveComments(streamId: string, onChange: (items: LiveComment[]) => void) {
  const q = query(collection(db, 'liveStreams', streamId, 'comments'), orderBy('createdAt', 'asc'), limit(100));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LiveComment, 'id'>) })));
  });
}

export async function postLiveComment(streamId: string, userName: string, text: string): Promise<void> {
  await addDoc(collection(db, 'liveStreams', streamId, 'comments'), {
    userName,
    text,
    createdAt: Date.now(),
  });
}
