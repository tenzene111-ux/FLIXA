import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import type { FeedVideo, VideoComment } from '../types/models';

const FEED_PAGE_SIZE = 8;
const USER_VIDEOS_LIMIT = 60;

export type FeedPage = {
  videos: FeedVideo[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
};

/**
 * The feed is paginated (fetch, not a live listener) on purpose: an
 * unbounded onSnapshot over the whole `videos` collection would sync every
 * video ever posted to every open app, forever — invisible with a handful
 * of test videos, but it's real cost and a slow/broken feed once there are
 * thousands of posts. Real short-video feeds work the same way: fetched in
 * pages, refreshed on pull/focus, not live-pushed.
 */
export async function fetchFeedVideosPage(cursor?: QueryDocumentSnapshot<DocumentData>): Promise<FeedPage> {
  const q = cursor
    ? query(collection(db, 'videos'), orderBy('createdAt', 'desc'), startAfter(cursor), limit(FEED_PAGE_SIZE))
    : query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(FEED_PAGE_SIZE));

  const snap = await getDocs(q);
  const videos = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeedVideo, 'id'>) }));
  const nextCursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { videos, cursor: nextCursor, hasMore: snap.docs.length === FEED_PAGE_SIZE };
}

// A single creator's own post count is naturally bounded for a profile grid;
// still capped so a prolific poster can't pull an unbounded live listener.
export function subscribeUserVideos(uid: string, onChange: (videos: FeedVideo[]) => void) {
  const q = query(
    collection(db, 'videos'),
    where('uploaderId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(USER_VIDEOS_LIMIT)
  );
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
  const q = query(collection(db, 'videos', videoId, 'comments'), orderBy('createdAt', 'asc'), limit(200));
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
