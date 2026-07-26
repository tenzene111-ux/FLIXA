import { collection, doc, getDoc, increment, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ExploreCreator, TrendingHashtag } from '../types/models';

export function subscribeTrendingHashtags(onChange: (items: TrendingHashtag[]) => void) {
  const q = query(collection(db, 'exploreHashtags'), orderBy('viewCount', 'desc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TrendingHashtag, 'id'>) })));
  });
}

export function subscribeExploreCreators(onChange: (items: ExploreCreator[]) => void) {
  const q = query(collection(db, 'exploreCreators'), orderBy('followerCount', 'desc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExploreCreator, 'id'>) })));
  });
}

export async function followExploreCreator(creatorId: string, currentUid: string): Promise<boolean> {
  const followRef = doc(db, 'exploreCreators', creatorId, 'followers', currentUid);
  const existing = await getDoc(followRef);
  if (existing.exists()) return false;

  await setDoc(followRef, { createdAt: Date.now() });
  await updateDoc(doc(db, 'exploreCreators', creatorId), { followerCount: increment(1) });
  return true;
}
