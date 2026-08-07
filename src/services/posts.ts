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
import type { Post, VideoOverlay } from '../types/post';
import type { Poll } from '../types/poll';

const VIDEOS_COLLECTION = 'videos';

function mapSnapshotToPosts(snapshot: QuerySnapshot<DocumentData>): Post[] {
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
    return {
      id: docSnap.id,
      uid: data.uploaderId,
      caption: data.caption ?? '',
      videoUrl: data.videoUrl,
      thumbnailUrl: data.thumbnailUrl,
      likesCount: data.likeCount ?? 0,
      commentsCount: data.commentCount ?? 0,
      viewCount: data.viewCount ?? 0,
      createdAt,
      trimStart: data.trimStart ?? 0,
      trimEnd: data.trimEnd ?? null,
      overlays: data.overlays ?? [],
      musicTitle: data.musicTitle ?? '',
      poll: data.poll ?? null,
    };
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
    poll: params.poll ?? null,
    createdAt: serverTimestamp(),
  });
}

// viewCount is a low-stakes counter (like shareCount) that the client is
// allowed to bump directly — it only feeds the staged-distribution ranking
// in HomeScreen, nothing security- or money-sensitive.
export function incrementView(postId: string) {
  updateDoc(doc(db, VIDEOS_COLLECTION, postId), { viewCount: increment(1) }).catch(() => {});
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
