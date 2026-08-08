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

export async function createBattleInviteNotification(params: {
  toUid: string;
  fromUid: string;
  fromUsername: string;
  battleStreamId: string;
  battleDurationSec: number;
}) {
  if (params.toUid === params.fromUid) return;
  await addDoc(notificationsRef(params.toUid), {
    type: 'battle_invite',
    fromUid: params.fromUid,
    fromUsername: params.fromUsername,
    battleStreamId: params.battleStreamId,
    battleDurationSec: params.battleDurationSec,
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
        // Notifications are shared with another app on this Firebase
        // project, which writes a different shape (fromName/message
        // instead of fromUsername, plus a 'system' type this app doesn't
        // render) — normalize rather than let an unrecognized doc crash.
        const knownTypes: Notification['type'][] = ['like', 'comment', 'follow', 'battle_invite'];
        return {
          id: docSnap.id,
          type: knownTypes.includes(data.type) ? data.type : 'like',
          fromUid: data.fromUid,
          fromUsername: data.fromUsername ?? data.fromName ?? 'user',
          postId: data.postId,
          postThumbnailUrl: data.postThumbnailUrl,
          commentText: data.commentText,
          battleStreamId: data.battleStreamId,
          battleDurationSec: data.battleDurationSec,
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
