import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Notification } from '../types/notification';

function notificationsRef(uid: string) {
  return collection(db, 'users', uid, 'notifications');
}

export async function createLikeNotification(params: {
  toUid: string;
  fromUid: string;
  fromUsername: string;
  postId: string;
  postThumbnailUrl: string;
}) {
  if (params.toUid === params.fromUid) return;
  await addDoc(notificationsRef(params.toUid), {
    type: 'like',
    fromUid: params.fromUid,
    fromUsername: params.fromUsername,
    postId: params.postId,
    postThumbnailUrl: params.postThumbnailUrl,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function createCommentNotification(params: {
  toUid: string;
  fromUid: string;
  fromUsername: string;
  postId: string;
  postThumbnailUrl: string;
  commentText: string;
}) {
  if (params.toUid === params.fromUid) return;
  await addDoc(notificationsRef(params.toUid), {
    type: 'comment',
    fromUid: params.fromUid,
    fromUsername: params.fromUsername,
    postId: params.postId,
    postThumbnailUrl: params.postThumbnailUrl,
    commentText: params.commentText,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function createFollowNotification(params: { toUid: string; fromUid: string; fromUsername: string }) {
  if (params.toUid === params.fromUid) return;
  await addDoc(notificationsRef(params.toUid), {
    type: 'follow',
    fromUid: params.fromUid,
    fromUsername: params.fromUsername,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToNotifications(uid: string, onChange: (notifications: Notification[]) => void) {
  const notificationsQuery = query(notificationsRef(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(notificationsQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          type: data.type ?? 'like',
          fromUid: data.fromUid,
          fromUsername: data.fromUsername,
          postId: data.postId,
          postThumbnailUrl: data.postThumbnailUrl,
          commentText: data.commentText,
          read: data.read ?? false,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
        };
      })
    );
  });
}

export async function markNotificationRead(uid: string, notificationId: string) {
  await updateDoc(doc(db, 'users', uid, 'notifications', notificationId), { read: true });
}
