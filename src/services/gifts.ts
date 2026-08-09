import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
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

export type LiveGiftEvent = {
  id: string;
  giftId: string;
  fromUsername: string;
  toUid: string;
  createdAt: number;
};

// Drives the on-screen gift animation for *every* viewer, not just the
// sender — watches for the newest gift doc and fires only on genuinely
// new arrivals. The first snapshot after subscribing just records
// whatever's already there as a baseline (so re-opening a screen doesn't
// replay an old gift's animation); every snapshot after that with a
// different top doc id is a real new gift.
export function subscribeToLatestGift(
  contextType: 'video' | 'liveStream',
  contextId: string,
  onNewGift: (gift: LiveGiftEvent) => void
) {
  const collectionName = contextType === 'video' ? 'videos' : 'liveStreams';
  const latestQuery = query(collection(db, collectionName, contextId, 'gifts'), orderBy('createdAt', 'desc'), limit(1));
  let hydrated = false;
  let lastSeenId: string | null = null;
  return onSnapshot(latestQuery, (snapshot) => {
    const docSnap = snapshot.docs[0];
    if (!docSnap) {
      hydrated = true;
      return;
    }
    if (!hydrated) {
      hydrated = true;
      lastSeenId = docSnap.id;
      return;
    }
    if (docSnap.id === lastSeenId) return;
    lastSeenId = docSnap.id;
    const data = docSnap.data();
    onNewGift({
      id: docSnap.id,
      giftId: (data.giftId as string) ?? '',
      fromUsername: (data.fromUsername as string) ?? 'Someone',
      toUid: data.toUid as string,
      createdAt: (data.createdAt as number) ?? Date.now(),
    });
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
