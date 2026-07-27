import { collection, doc, getDoc, increment, limit, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ExploreCreator, TrendingHashtag } from '../types/models';

// These are curated/admin-managed lists (see functions/src/seed.ts), not
// user-generated, so they grow slowly — a generous cap is enough for now
// rather than full "See all" pagination.
const EXPLORE_LIST_LIMIT = 50;

export function subscribeTrendingHashtags(onChange: (items: TrendingHashtag[]) => void) {
  const q = query(collection(db, 'exploreHashtags'), orderBy('viewCount', 'desc'), limit(EXPLORE_LIST_LIMIT));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TrendingHashtag, 'id'>) })));
  });
}

export function subscribeExploreCreators(onChange: (items: ExploreCreator[]) => void) {
  const q = query(collection(db, 'exploreCreators'), orderBy('followerCount', 'desc'), limit(EXPLORE_LIST_LIMIT));
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
