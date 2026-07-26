import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { User } from 'firebase/auth';
import type { UserProfile } from '../types/models';

function profileRef(uid: string) {
  return doc(db, 'users', uid);
}

export async function ensureUserProfile(user: User): Promise<void> {
  const ref = profileRef(user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const emailPrefix = user.email?.split('@')[0] ?? 'flixa.user';
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email ?? '',
    handle: `@${emailPrefix}`,
    displayName: emailPrefix,
    bio: 'Musician | Creator | Dreamer',
    avatarUrl: `https://i.pravatar.cc/150?u=${user.uid}`,
    followerCount: 0,
    followingCount: 0,
    likeCount: 0,
    createdAt: Date.now(),
  };
  await setDoc(ref, profile);
}

export function subscribeUserProfile(uid: string, onChange: (profile: UserProfile | null) => void) {
  return onSnapshot(profileRef(uid), (snap) => {
    onChange(snap.exists() ? (snap.data() as UserProfile) : null);
  });
}

export async function updateUserProfile(uid: string, changes: Partial<UserProfile>): Promise<void> {
  await updateDoc(profileRef(uid), changes);
}
