import { collection, doc, getDocs, increment, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';
import { createFollowNotification } from './notifications';

function followingRef(followerUid: string, followingUid: string) {
  return doc(db, 'users', followerUid, 'following', followingUid);
}

function followerRef(followingUid: string, followerUid: string) {
  return doc(db, 'users', followingUid, 'followers', followerUid);
}

export function subscribeToFollowState(
  followerUid: string,
  followingUid: string,
  onChange: (following: boolean) => void
) {
  return onSnapshot(followingRef(followerUid, followingUid), (snapshot) => onChange(snapshot.exists()));
}

export async function followUser(params: { followerUid: string; followerUsername: string; followingUid: string }) {
  const { followerUid, followerUsername, followingUid } = params;
  if (followerUid === followingUid) return;

  const followerUserRef = doc(db, 'users', followerUid);
  const followingUserRef = doc(db, 'users', followingUid);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(followingRef(followerUid, followingUid));
    if (existing.exists()) return;

    transaction.set(followingRef(followerUid, followingUid), { createdAt: Date.now() });
    transaction.set(followerRef(followingUid, followerUid), { createdAt: Date.now() });
    transaction.update(followerUserRef, { followingCount: increment(1) });
    transaction.update(followingUserRef, { followersCount: increment(1) });
  });

  await createFollowNotification({ toUid: followingUid, fromUid: followerUid, fromUsername: followerUsername }).catch(
    () => {}
  );
}

export async function unfollowUser(params: { followerUid: string; followingUid: string }) {
  const { followerUid, followingUid } = params;

  const followerUserRef = doc(db, 'users', followerUid);
  const followingUserRef = doc(db, 'users', followingUid);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(followingRef(followerUid, followingUid));
    if (!existing.exists()) return;

    transaction.delete(followingRef(followerUid, followingUid));
    transaction.delete(followerRef(followingUid, followerUid));
    transaction.update(followerUserRef, { followingCount: increment(-1) });
    transaction.update(followingUserRef, { followersCount: increment(-1) });
  });
}

export async function getFollowingUids(uid: string): Promise<string[]> {
  const snapshot = await getDocs(collection(db, 'users', uid, 'following'));
  return snapshot.docs.map((docSnap) => docSnap.id);
}

export function subscribeToFollowingUids(uid: string, onChange: (uids: Set<string>) => void) {
  return onSnapshot(collection(db, 'users', uid, 'following'), (snapshot) => {
    onChange(new Set(snapshot.docs.map((docSnap) => docSnap.id)));
  });
}
