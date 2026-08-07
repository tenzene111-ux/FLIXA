import {
  addDoc,
  collection,
  doc,
  DocumentData,
  increment,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import type { Post } from '../types/post';

const POSTS_COLLECTION = 'posts';

function mapSnapshotToPosts(snapshot: QuerySnapshot<DocumentData>): Post[] {
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
    return {
      id: docSnap.id,
      uid: data.uid,
      caption: data.caption ?? '',
      videoUrl: data.videoUrl,
      thumbnailUrl: data.thumbnailUrl,
      likesCount: data.likesCount ?? 0,
      createdAt,
    };
  });
}

export function subscribeToFeed(onChange: (posts: Post[]) => void, onError: (error: Error) => void) {
  const feedQuery = query(collection(db, POSTS_COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(feedQuery, (snapshot) => onChange(mapSnapshotToPosts(snapshot)), onError);
}

export function subscribeToUserPosts(
  uid: string,
  onChange: (posts: Post[]) => void,
  onError: (error: Error) => void
) {
  const userPostsQuery = query(
    collection(db, POSTS_COLLECTION),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(userPostsQuery, (snapshot) => onChange(mapSnapshotToPosts(snapshot)), onError);
}

async function uploadFile(localUri: string, storagePath: string, onProgress?: (pct: number) => void) {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, blob);

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
  onProgress?: (pct: number) => void;
}) {
  const timestamp = Date.now();

  const videoUrl = await uploadFile(
    params.videoUri,
    `videos/${params.uid}/${timestamp}.mp4`,
    (pct) => params.onProgress?.(pct * 0.85)
  );
  const thumbnailUrl = await uploadFile(
    params.thumbnailUri,
    `thumbnails/${params.uid}/${timestamp}.jpg`,
    (pct) => params.onProgress?.(0.85 + pct * 0.15)
  );

  await addDoc(collection(db, POSTS_COLLECTION), {
    uid: params.uid,
    caption: params.caption,
    videoUrl,
    thumbnailUrl,
    likesCount: 0,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToLikeState(postId: string, uid: string, onChange: (liked: boolean) => void) {
  const likeRef = doc(db, POSTS_COLLECTION, postId, 'likes', uid);
  return onSnapshot(likeRef, (snapshot) => onChange(snapshot.exists()));
}

export async function toggleLike(postId: string, uid: string) {
  const postRef = doc(db, POSTS_COLLECTION, postId);
  const likeRef = doc(db, POSTS_COLLECTION, postId, 'likes', uid);

  await runTransaction(db, async (transaction) => {
    const likeSnap = await transaction.get(likeRef);
    if (likeSnap.exists()) {
      transaction.delete(likeRef);
      transaction.update(postRef, { likesCount: increment(-1) });
    } else {
      transaction.set(likeRef, { createdAt: serverTimestamp() });
      transaction.update(postRef, { likesCount: increment(1) });
    }
  });
}

