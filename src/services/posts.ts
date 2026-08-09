import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { createLikeNotification } from './notifications';
import type { CommentsSetting, Post, PostPrivacy, VideoOverlay } from '../types/post';
import type { Poll } from '../types/poll';

const VIDEOS_COLLECTION = 'videos';

function mapDocDataToPost(id: string, data: DocumentData): Post {
  const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
  return {
    id,
    uid: data.uploaderId,
    caption: data.caption ?? '',
    videoUrl: data.videoUrl,
    thumbnailUrl: data.thumbnailUrl,
    likesCount: data.likeCount ?? 0,
    commentsCount: data.commentCount ?? 0,
    viewCount: data.viewCount ?? 0,
    shareCount: data.shareCount ?? 0,
    saveCount: data.saveCount ?? 0,
    watchCount: data.watchCount ?? 0,
    totalWatchedSec: data.totalWatchedSec ?? 0,
    completedViews: data.completedViews ?? 0,
    retain25: data.retain25 ?? 0,
    retain50: data.retain50 ?? 0,
    retain75: data.retain75 ?? 0,
    createdAt,
    trimStart: data.trimStart ?? 0,
    trimEnd: data.trimEnd ?? null,
    overlays: data.overlays ?? [],
    musicTitle: data.musicTitle ?? '',
    hashtags: data.hashtags ?? [],
    poll: data.poll ?? null,
    privacy: data.privacy ?? 'everyone',
    commentsSetting: data.commentsSetting ?? 'everyone',
    allowDownloads: data.allowDownloads ?? true,
  };
}

// Shared with services/explore.ts so every place that reads a videos doc
// into a Post agrees on field defaults instead of hand-duplicating this
// mapping (which had already drifted once before this was extracted).
export function mapSnapshotToPosts(snapshot: QuerySnapshot<DocumentData>): Post[] {
  return snapshot.docs.map((docSnap) => mapDocDataToPost(docSnap.id, docSnap.data()));
}

// Powers SingleVideoScreen — opening one video directly (from a Sound/
// Hashtag grid, a shared-video chat card, or a profile grid) rather than
// through the swipeable feed.
export function subscribeToPost(postId: string, onChange: (post: Post | null) => void) {
  return onSnapshot(doc(db, VIDEOS_COLLECTION, postId), (snapshot) => {
    onChange(snapshot.exists() ? mapDocDataToPost(snapshot.id, snapshot.data()) : null);
  });
}

export function subscribeToFeed(onChange: (posts: Post[]) => void, onError: (error: Error) => void) {
  const feedQuery = query(collection(db, VIDEOS_COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(feedQuery, (snapshot) => onChange(mapSnapshotToPosts(snapshot)), onError);
}

export function subscribeToUserPosts(
  uid: string,
  onChange: (posts: Post[]) => void,
  onError: (error: Error) => void
) {
  const userPostsQuery = query(
    collection(db, VIDEOS_COLLECTION),
    where('uploaderId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(userPostsQuery, (snapshot) => onChange(mapSnapshotToPosts(snapshot)), onError);
}

export async function getPostsByIds(ids: string[]): Promise<Post[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) {
    chunks.push(ids.slice(i, i + 10));
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, VIDEOS_COLLECTION), where(documentId(), 'in', chunk)))
    )
  );
  return results.flatMap((snapshot) => mapSnapshotToPosts(snapshot));
}

// ---- Bounded candidate queries for the For You feed (services/recommendations.ts)
// — replaces the old subscribeToFeed-loads-everything approach with several
// small, capped queries instead of one unbounded collection listener.

export async function getPostsByCreators(uids: string[], perCreatorLimit = 12): Promise<Post[]> {
  if (uids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 10) {
    chunks.push(uids.slice(i, i + 10));
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, VIDEOS_COLLECTION), where('uploaderId', 'in', chunk), limit(chunk.length * perCreatorLimit)))
    )
  );
  return results.flatMap((snapshot) => mapSnapshotToPosts(snapshot)).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getRecentPosts(count: number): Promise<Post[]> {
  const postsQuery = query(collection(db, VIDEOS_COLLECTION), orderBy('createdAt', 'desc'), limit(count));
  const snapshot = await getDocs(postsQuery);
  return mapSnapshotToPosts(snapshot);
}

async function uploadFile(
  localUri: string,
  storagePath: string,
  contentType: string,
  onProgress?: (pct: number) => void
) {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, blob, { contentType });

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes);
      },
      reject,
      () => resolve()
    );
  });

  return getDownloadURL(uploadTask.snapshot.ref);
}

function extractHashtags(caption: string): string[] {
  const matches = caption.match(/#[a-zA-Z0-9_]+/g) ?? [];
  return Array.from(new Set(matches.map((tag) => tag.slice(1).toLowerCase())));
}

export async function createPost(params: {
  uid: string;
  caption: string;
  videoUri: string;
  thumbnailUri: string;
  trimStart?: number;
  trimEnd?: number | null;
  overlays?: VideoOverlay[];
  musicTitle?: string;
  poll?: Poll | null;
  privacy?: PostPrivacy;
  commentsSetting?: CommentsSetting;
  allowDownloads?: boolean;
  onProgress?: (pct: number) => void;
}) {
  const timestamp = Date.now();

  const videoUrl = await uploadFile(
    params.videoUri,
    `videos/${params.uid}/${timestamp}.mp4`,
    'video/mp4',
    (pct) => params.onProgress?.(pct * 0.85)
  );
  const thumbnailUrl = await uploadFile(
    params.thumbnailUri,
    `thumbnails/${params.uid}/${timestamp}.jpg`,
    'image/jpeg',
    (pct) => params.onProgress?.(0.85 + pct * 0.15)
  );

  await addDoc(collection(db, VIDEOS_COLLECTION), {
    uploaderId: params.uid,
    caption: params.caption,
    videoUrl,
    thumbnailUrl,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    viewCount: 0,
    trimStart: params.trimStart ?? 0,
    trimEnd: params.trimEnd ?? null,
    overlays: params.overlays ?? [],
    musicTitle: params.musicTitle ?? '',
    hashtags: extractHashtags(params.caption),
    poll: params.poll ?? null,
    privacy: params.privacy ?? 'everyone',
    commentsSetting: params.commentsSetting ?? 'everyone',
    allowDownloads: params.allowDownloads ?? true,
    createdAt: serverTimestamp(),
  });
}

// For videos that already went through the server-side ffmpeg pipeline
// (functions/src/video.ts): the video file is already hosted in Storage
// with a real download URL, so only the chosen cover image needs
// uploading here — re-fetching and re-uploading the processed video would
// just waste bandwidth and time.
export async function createPostFromProcessedVideo(params: {
  uid: string;
  caption: string;
  videoUrl: string;
  thumbnailUri: string;
  privacy?: PostPrivacy;
  commentsSetting?: CommentsSetting;
  allowDownloads?: boolean;
  onProgress?: (pct: number) => void;
}) {
  const timestamp = Date.now();

  const thumbnailUrl = await uploadFile(
    params.thumbnailUri,
    `thumbnails/${params.uid}/${timestamp}.jpg`,
    'image/jpeg',
    (pct) => params.onProgress?.(pct)
  );

  await addDoc(collection(db, VIDEOS_COLLECTION), {
    uploaderId: params.uid,
    caption: params.caption,
    videoUrl: params.videoUrl,
    thumbnailUrl,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    viewCount: 0,
    trimStart: 0,
    trimEnd: null,
    overlays: [],
    musicTitle: '',
    hashtags: extractHashtags(params.caption),
    poll: null,
    privacy: params.privacy ?? 'everyone',
    commentsSetting: params.commentsSetting ?? 'everyone',
    allowDownloads: params.allowDownloads ?? true,
    createdAt: serverTimestamp(),
  });
}

// viewCount is a low-stakes counter (like shareCount) that the client is
// allowed to bump directly — it only feeds the staged-distribution ranking
// in HomeScreen, nothing security- or money-sensitive.
export function incrementView(postId: string) {
  updateDoc(doc(db, VIDEOS_COLLECTION, postId), { viewCount: increment(1) }).catch(() => {});
}

export function incrementShare(postId: string) {
  updateDoc(doc(db, VIDEOS_COLLECTION, postId), { shareCount: increment(1) }).catch(() => {});
}

export function subscribeToLikeState(postId: string, uid: string, onChange: (liked: boolean) => void) {
  const likeRef = doc(db, VIDEOS_COLLECTION, postId, 'likes', uid);
  return onSnapshot(likeRef, (snapshot) => onChange(snapshot.exists()));
}

export async function toggleLike(params: {
  postId: string;
  postOwnerUid: string;
  postThumbnailUrl: string;
  likerUid: string;
  likerUsername: string;
}) {
  const { postId, postOwnerUid, postThumbnailUrl, likerUid, likerUsername } = params;
  const likeRef = doc(db, VIDEOS_COLLECTION, postId, 'likes', likerUid);

  // likeCount itself is updated server-side by the onLikeCreate/onLikeDelete
  // Cloud Function triggers (see functions/src/index.ts) — the client only
  // ever creates or deletes its own like doc.
  const likeSnap = await getDoc(likeRef);
  const didLike = !likeSnap.exists();

  if (didLike) {
    await setDoc(likeRef, { createdAt: serverTimestamp() });
    await createLikeNotification({
      toUid: postOwnerUid,
      fromUid: likerUid,
      fromUsername: likerUsername,
      postId,
      postThumbnailUrl,
    }).catch(() => {});
  } else {
    await deleteDoc(likeRef);
  }
}
