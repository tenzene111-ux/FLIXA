import { collection, deleteDoc, doc, type DocumentData, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { EMPTY_INTEREST_PROFILE, type InterestProfile } from '../types/interestProfile';

function mapProfile(data: DocumentData | undefined): InterestProfile {
  if (!data) return EMPTY_INTEREST_PROFILE;
  return {
    topics: (data.topics as Record<string, number>) ?? {},
    creators: (data.creators as Record<string, number>) ?? {},
    sounds: (data.sounds as Record<string, number>) ?? {},
  };
}

// Server-authoritative — written only by onAnalyticsEventCreate as it folds
// in watch/like/comment/share/save/follow/search signals. The client only
// ever reads it, to drive candidate ranking in services/recommendations.ts.
export function subscribeToInterestProfile(uid: string, onChange: (profile: InterestProfile) => void) {
  return onSnapshot(doc(db, 'users', uid, 'meta', 'interestProfile'), (snapshot) => {
    onChange(mapProfile(snapshot.data()));
  });
}

export function soundIdFor(musicTitle: string): string {
  return musicTitle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 120) || 'sound';
}

// Unlike interestProfile's numeric weights, hidden creators/sounds are a
// direct personal preference the client acts on immediately — same
// ownership pattern as savedVideos, not routed through the Cloud Function.
export function subscribeToHiddenCreators(uid: string, onChange: (uids: Set<string>) => void) {
  return onSnapshot(collection(db, 'users', uid, 'hiddenCreators'), (snapshot) => {
    onChange(new Set(snapshot.docs.map((d) => d.id)));
  });
}

export function subscribeToHiddenSounds(uid: string, onChange: (soundIds: Set<string>) => void) {
  return onSnapshot(collection(db, 'users', uid, 'hiddenSounds'), (snapshot) => {
    onChange(new Set(snapshot.docs.map((d) => d.id)));
  });
}

export async function hideCreator(uid: string, creatorUid: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'hiddenCreators', creatorUid), { createdAt: serverTimestamp() });
}

export async function hideSound(uid: string, musicTitle: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'hiddenSounds', soundIdFor(musicTitle)), {
    musicTitle,
    createdAt: serverTimestamp(),
  });
}

export async function unhideCreator(uid: string, creatorUid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'hiddenCreators', creatorUid));
}
