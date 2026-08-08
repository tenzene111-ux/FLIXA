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

// Battle score: diamonds gifted to each side since the battle started.
// Filters the same gifts subcollection client-side by createdAt/toUid
// rather than a separate query, so no new index is needed.
export function subscribeToBattleScores(
  streamId: string,
  hostUid: string,
  opponentUid: string,
  sinceMs: number,
  onChange: (scores: { hostTotal: number; opponentTotal: number }) => void
) {
  const giftsQuery = query(collection(db, 'liveStreams', streamId, 'gifts'), orderBy('createdAt', 'desc'));
  return onSnapshot(giftsQuery, (snapshot) => {
    let hostTotal = 0;
    let opponentTotal = 0;
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const createdAt = (data.createdAt as number) ?? 0;
      if (createdAt < sinceMs) return;
      const toUid = data.toUid as string | undefined;
      const amount = (data.amount as number) ?? 0;
      if (toUid === hostUid) hostTotal += amount;
      else if (toUid === opponentUid) opponentTotal += amount;
    });
    onChange({ hostTotal, opponentTotal });
  });
}
