import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import type { LiveComment, LiveStream } from '../types/liveStream';

const LIVE_STREAMS_COLLECTION = 'liveStreams';

function mapLiveStream(id: string, data: DocumentData): LiveStream {
  const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
  return {
    id,
    hostUid: data.hostUid,
    hostUsername: data.hostUsername ?? 'Someone',
    title: data.title ?? '',
    isLive: data.isLive ?? false,
    createdAt,
  };
}

export async function createLiveStream(hostUid: string, hostUsername: string, title: string): Promise<string> {
  const streamRef = await addDoc(collection(db, LIVE_STREAMS_COLLECTION), {
    hostUid,
    hostUsername,
    title,
    isLive: true,
    createdAt: serverTimestamp(),
  });
  return streamRef.id;
}

export async function endLiveStream(streamId: string): Promise<void> {
  await updateDoc(doc(db, LIVE_STREAMS_COLLECTION, streamId), { isLive: false });
}

export function subscribeToLiveStreams(onChange: (streams: LiveStream[]) => void) {
  const liveQuery = query(collection(db, LIVE_STREAMS_COLLECTION), where('isLive', '==', true));
  return onSnapshot(liveQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => mapLiveStream(docSnap.id, docSnap.data())));
  });
}

export function subscribeToLiveStream(streamId: string, onChange: (stream: LiveStream | null) => void) {
  return onSnapshot(doc(db, LIVE_STREAMS_COLLECTION, streamId), (snapshot) => {
    onChange(snapshot.exists() ? mapLiveStream(snapshot.id, snapshot.data()) : null);
  });
}

// Viewer count is derived live from the viewers subcollection's size rather
// than a stored counter — one presence doc per viewer (id = uid), created
// on join and deleted on leave.
export function subscribeToViewerCount(streamId: string, onChange: (count: number) => void) {
  return onSnapshot(collection(db, LIVE_STREAMS_COLLECTION, streamId, 'viewers'), (snapshot) => {
    onChange(snapshot.size);
  });
}

export async function joinAsViewer(streamId: string, uid: string): Promise<void> {
  await setDoc(doc(db, LIVE_STREAMS_COLLECTION, streamId, 'viewers', uid), { joinedAt: serverTimestamp() });
}

export async function leaveAsViewer(streamId: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, LIVE_STREAMS_COLLECTION, streamId, 'viewers', uid));
}

function liveCommentsRef(streamId: string) {
  return collection(db, LIVE_STREAMS_COLLECTION, streamId, 'comments');
}

export function subscribeToLiveComments(streamId: string, onChange: (comments: LiveComment[]) => void) {
  const commentsQuery = query(liveCommentsRef(streamId), orderBy('createdAt', 'asc'));
  return onSnapshot(commentsQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          uid: data.uid,
          username: data.username ?? 'Someone',
          text: data.text,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
        };
      })
    );
  });
}

export async function sendLiveComment(streamId: string, uid: string, username: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(liveCommentsRef(streamId), { uid, username, text: trimmed, createdAt: serverTimestamp() });
}

// LiveKit credentials never reach the client — this calls the
// getLiveKitToken Cloud Function, which mints a short-lived join token
// server-side (see functions/src/index.ts).
export const getLiveKitToken = httpsCallable<
  { roomName: string; canPublish: boolean },
  { token: string; serverUrl: string }
>(functions, 'getLiveKitToken');
