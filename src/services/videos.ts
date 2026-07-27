import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import type { FeedVideo, VideoComment } from '../types/models';

export function subscribeFeedVideos(onChange: (videos: FeedVideo[]) => void) {
  const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeedVideo, 'id'>) })));
  });
}

export function subscribeUserVideos(uid: string, onChange: (videos: FeedVideo[]) => void) {
  const q = query(collection(db, 'videos'), where('uploaderId', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeedVideo, 'id'>) })));
  });
}

export async function uploadVideoFile(uid: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const fileRef = ref(storage, `videos/${uid}/${Date.now()}.mp4`);
  await uploadBytes(fileRef, blob, { contentType: 'video/mp4' });
  return getDownloadURL(fileRef);
}

export async function createVideoPost(params: {
  uploaderId: string;
  username: string;
  userAvatar: string;
  videoUrl: string;
  caption: string;
  song: string;
}): Promise<void> {
  await addDoc(collection(db, 'videos'), {
    ...params,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    createdAt: Date.now(),
  });
}

export function subscribeIsLiked(videoId: string, uid: string, onChange: (liked: boolean) => void) {
  return onSnapshot(doc(db, 'videos', videoId, 'likes', uid), (snap) => onChange(snap.exists()));
}

export async function toggleLike(videoId: string, uid: string, liked: boolean): Promise<void> {
  const likeRef = doc(db, 'videos', videoId, 'likes', uid);
  if (liked) {
    await deleteDoc(likeRef);
  } else {
    await setDoc(likeRef, { createdAt: Date.now() });
  }
}

export function subscribeComments(videoId: string, onChange: (comments: VideoComment[]) => void) {
  const q = query(collection(db, 'videos', videoId, 'comments'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VideoComment, 'id'>) })));
  });
}

export async function addComment(videoId: string, uid: string, username: string, text: string): Promise<void> {
  await addDoc(collection(db, 'videos', videoId, 'comments'), { uid, username, text, createdAt: Date.now() });
}

export async function incrementShareCount(videoId: string): Promise<void> {
  await updateDoc(doc(db, 'videos', videoId), { shareCount: increment(1) });
}

// Firestore's "in" filter caps at 30 values, which is plenty for a
// saved-videos list rendered on one profile screen.
export function subscribeVideosByIds(ids: string[], onChange: (videos: FeedVideo[]) => void) {
  if (ids.length === 0) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, 'videos'), where(documentId(), 'in', ids.slice(0, 30)));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeedVideo, 'id'>) })));
  });
}
