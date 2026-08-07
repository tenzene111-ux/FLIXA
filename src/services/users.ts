import { doc, DocumentData, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import type { UserProfile } from '../types/userProfile';

const USERS_COLLECTION = 'users';

// The users collection is shared with another app on this Firebase project,
// which writes accounts with a different field set (handle/avatarUrl/
// followerCount instead of username/photoURL/followersCount). Normalize
// either shape into this app's UserProfile so a cross-app account never
// renders with an undefined username.
function mapDocToProfile(uid: string, data: DocumentData): UserProfile {
  const username = (data.username ?? (data.handle as string | undefined)?.replace(/^@/, '') ?? 'user') as string;
  return {
    uid,
    username,
    displayName: data.displayName ?? username,
    photoURL: data.photoURL ?? data.avatarUrl ?? null,
    bio: data.bio ?? '',
    followingCount: data.followingCount ?? 0,
    followersCount: data.followersCount ?? data.followerCount ?? 0,
  };
}

export async function ensureUserProfile(uid: string, username: string): Promise<void> {
  const profileRef = doc(db, USERS_COLLECTION, uid);
  const existing = await getDoc(profileRef);
  if (existing.exists()) return;
  // Creating this doc also triggers initWalletOnUserCreate server-side
  // (see functions/src/index.ts), which sets up wallets/{uid}.
  await setDoc(profileRef, {
    username,
    displayName: username,
    photoURL: null,
    bio: '',
    followingCount: 0,
    followersCount: 0,
  });
}

export function subscribeToUserProfile(uid: string, onChange: (profile: UserProfile | null) => void) {
  return onSnapshot(doc(db, USERS_COLLECTION, uid), (snapshot) => {
    onChange(snapshot.exists() ? mapDocToProfile(uid, snapshot.data()) : null);
  });
}

export async function updateUserProfile(
  uid: string,
  updates: { displayName?: string; photoURL?: string; bio?: string }
) {
  await updateDoc(doc(db, USERS_COLLECTION, uid), updates);
}

export async function uploadAvatar(uid: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const avatarRef = ref(storage, `avatars/${uid}/photo.jpg`);
  await uploadBytes(avatarRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(avatarRef);
}
