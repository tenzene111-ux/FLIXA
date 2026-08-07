import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { createCommentNotification } from './notifications';
import type { Comment } from '../types/comment';

function commentsRef(postId: string) {
  return collection(db, 'videos', postId, 'comments');
}

export function subscribeToComments(postId: string, onChange: (comments: Comment[]) => void) {
  const commentsQuery = query(commentsRef(postId), orderBy('createdAt', 'asc'));
  return onSnapshot(commentsQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          uid: data.uid,
          // Comments from the other app on this shared project don't
          // always carry a username field — fall back rather than crash.
          username: data.username ?? 'user',
          text: data.text,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
        };
      })
    );
  });
}

export async function addComment(params: {
  postId: string;
  postOwnerUid: string;
  postThumbnailUrl: string;
  uid: string;
  username: string;
  text: string;
}) {
  const { postId, postOwnerUid, postThumbnailUrl, uid, username, text } = params;
  const trimmed = text.trim();
  if (!trimmed) return;

  // commentCount is updated server-side by the onCommentCreate Cloud
  // Function trigger (see functions/src/index.ts) — the client only ever
  // writes the comment doc itself.
  await addDoc(commentsRef(postId), { uid, username, text: trimmed, createdAt: serverTimestamp() });

  await createCommentNotification({
    toUid: postOwnerUid,
    fromUid: uid,
    fromUsername: username,
    postId,
    postThumbnailUrl,
    commentText: trimmed,
  }).catch(() => {});
}
