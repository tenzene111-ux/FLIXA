import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

function pollVotesRef(videoId: string) {
  return collection(db, 'videos', videoId, 'pollVotes');
}

export function subscribeToPollVotes(videoId: string, onChange: (countsByOptionId: Record<string, number>) => void) {
  return onSnapshot(pollVotesRef(videoId), (snapshot) => {
    const counts: Record<string, number> = {};
    snapshot.docs.forEach((docSnap) => {
      const optionId = docSnap.data().optionId as string;
      counts[optionId] = (counts[optionId] ?? 0) + 1;
    });
    onChange(counts);
  });
}

export function subscribeToMyVote(videoId: string, uid: string, onChange: (optionId: string | null) => void) {
  return onSnapshot(doc(db, 'videos', videoId, 'pollVotes', uid), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data().optionId as string) : null);
  });
}

export async function castVote(videoId: string, uid: string, optionId: string): Promise<void> {
  // A poll vote doc is created once per user (doc id = uid) and Firestore
  // rules forbid updating it afterward, so this naturally blocks changing
  // your vote or double-voting — no extra client bookkeeping needed.
  await setDoc(doc(db, 'videos', videoId, 'pollVotes', uid), { optionId, createdAt: serverTimestamp() });
}
