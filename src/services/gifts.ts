import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';

export type GiftLeaderboardEntry = {
  uid: string;
  username: string;
  totalDiamonds: number;
};

// Aggregated client-side from a live subscription rather than a
// denormalized counter — gift volume per video/stream is small enough at
// MVP scale that this stays cheap and can never drift out of sync.
export function subscribeToGiftLeaderboard(
  contextType: 'video' | 'liveStream',
  contextId: string,
  onChange: (entries: GiftLeaderboardEntry[]) => void
) {
  const collectionName = contextType === 'video' ? 'videos' : 'liveStreams';
  const giftsQuery = query(collection(db, collectionName, contextId, 'gifts'), orderBy('createdAt', 'desc'));
  return onSnapshot(giftsQuery, (snapshot) => {
    const totals = new Map<string, GiftLeaderboardEntry>();
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const uid = data.fromUid as string;
      const amount = (data.amount as number) ?? 0;
      const existing = totals.get(uid);
      if (existing) {
        existing.totalDiamonds += amount;
      } else {
        totals.set(uid, { uid, username: (data.fromUsername as string) ?? 'Someone', totalDiamonds: amount });
      }
    });
    onChange(Array.from(totals.values()).sort((a, b) => b.totalDiamonds - a.totalDiamonds));
  });
}
