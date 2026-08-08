import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, functions, storage } from '../firebase/config';
import type { LiveCategory, LiveComment, LiveQuestion, LiveStream } from '../types/liveStream';
import type { LivePoll } from '../types/livePoll';
import type { Poll } from '../types/poll';

const LIVE_STREAMS_COLLECTION = 'liveStreams';

function mapLiveStream(id: string, data: DocumentData): LiveStream {
  const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
  return {
    id,
    hostUid: data.hostUid,
    hostUsername: data.hostUsername ?? 'Someone',
    title: data.title ?? '',
    coverUrl: data.coverUrl ?? null,
    category: data.category ?? 'Other',
    hashtags: data.hashtags ?? [],
    allowComments: data.allowComments ?? true,
    allowGifts: data.allowGifts ?? true,
    pinnedMessage: data.pinnedMessage ?? null,
    goalTarget: data.goalTarget ?? null,
    highlightedQuestionId: data.highlightedQuestionId ?? null,
    likeCount: data.likeCount ?? 0,
    isLive: data.isLive ?? false,
    createdAt,
  };
}

export async function uploadLiveCover(uid: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const coverRef = ref(storage, `liveCovers/${uid}/${Date.now()}.jpg`);
  await uploadBytes(coverRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(coverRef);
}

export async function createLiveStream(
  hostUid: string,
  hostUsername: string,
  config: {
    title: string;
    coverUrl: string | null;
    category: LiveCategory;
    hashtags: string[];
    allowComments: boolean;
    allowGifts: boolean;
    goalTarget: number | null;
  }
): Promise<string> {
  const streamRef = await addDoc(collection(db, LIVE_STREAMS_COLLECTION), {
    hostUid,
    hostUsername,
    title: config.title,
    coverUrl: config.coverUrl,
    category: config.category,
    hashtags: config.hashtags,
    allowComments: config.allowComments,
    allowGifts: config.allowGifts,
    pinnedMessage: null,
    goalTarget: config.goalTarget,
    highlightedQuestionId: null,
    likeCount: 0,
    isLive: true,
    createdAt: serverTimestamp(),
  });
  return streamRef.id;
}

export async function endLiveStream(streamId: string): Promise<void> {
  await updateDoc(doc(db, LIVE_STREAMS_COLLECTION, streamId), { isLive: false });
}

export async function setLivePinnedMessage(streamId: string, message: string | null): Promise<void> {
  await updateDoc(doc(db, LIVE_STREAMS_COLLECTION, streamId), { pinnedMessage: message });
}

export async function setHighlightedQuestion(streamId: string, questionId: string | null): Promise<void> {
  await updateDoc(doc(db, LIVE_STREAMS_COLLECTION, streamId), { highlightedQuestionId: questionId });
}

export function subscribeToLiveStreams(onChange: (streams: LiveStream[]) => void) {
  const liveQuery = query(collection(db, LIVE_STREAMS_COLLECTION), where('isLive', '==', true));
  return onSnapshot(liveQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => mapLiveStream(docSnap.id, docSnap.data())));
  });
}

export function subscribeToLiveStream(streamId: string, onChange: (stream: LiveStream | null) => void) {
  return onSnapshot(doc(db, LIVE_STREAMS_COLLECTION, streamId), (snapshot) => {
    onChange(snapshot.exists() ? mapLiveStream(snapshot.id, snapshot.data()) : null);
  });
}

// Viewer count is derived live from the viewers subcollection's size rather
// than a stored counter — one presence doc per viewer (id = uid), created
// on join and deleted on leave.
export function subscribeToViewerCount(streamId: string, onChange: (count: number) => void) {
  return onSnapshot(collection(db, LIVE_STREAMS_COLLECTION, streamId, 'viewers'), (snapshot) => {
    onChange(snapshot.size);
  });
}

export async function joinAsViewer(streamId: string, uid: string): Promise<void> {
  await setDoc(doc(db, LIVE_STREAMS_COLLECTION, streamId, 'viewers', uid), { joinedAt: serverTimestamp() });
}

export async function leaveAsViewer(streamId: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, LIVE_STREAMS_COLLECTION, streamId, 'viewers', uid));
}

function liveCommentsRef(streamId: string) {
  return collection(db, LIVE_STREAMS_COLLECTION, streamId, 'comments');
}

export function subscribeToLiveComments(streamId: string, onChange: (comments: LiveComment[]) => void) {
  const commentsQuery = query(liveCommentsRef(streamId), orderBy('createdAt', 'asc'));
  return onSnapshot(commentsQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          uid: data.uid,
          username: data.username ?? 'Someone',
          text: data.text,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
        };
      })
    );
  });
}

export async function sendLiveComment(streamId: string, uid: string, username: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(liveCommentsRef(streamId), { uid, username, text: trimmed, createdAt: serverTimestamp() });
}

// Floating-heart taps are batched into one Firestore write per stream every
// couple of seconds instead of a write per tap — the local animation plays
// immediately regardless, this only affects when the shared count updates.
const pendingLikes = new Map<string, number>();
const likeFlushTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function bumpLiveLike(streamId: string) {
  pendingLikes.set(streamId, (pendingLikes.get(streamId) ?? 0) + 1);
  if (likeFlushTimers.has(streamId)) return;
  const timer = setTimeout(() => {
    const count = pendingLikes.get(streamId) ?? 0;
    pendingLikes.delete(streamId);
    likeFlushTimers.delete(streamId);
    if (count > 0) {
      updateDoc(doc(db, LIVE_STREAMS_COLLECTION, streamId), { likeCount: increment(count) }).catch(() => {});
    }
  }, 2000);
  likeFlushTimers.set(streamId, timer);
}

// ---- Live polls: a subcollection of docs (not one mutable field) so a
// host can run several polls across one broadcast without losing history.
function livePollsRef(streamId: string) {
  return collection(db, LIVE_STREAMS_COLLECTION, streamId, 'polls');
}

export async function createLivePoll(streamId: string, poll: Poll): Promise<string> {
  const pollRef = await addDoc(livePollsRef(streamId), {
    question: poll.question,
    options: poll.options,
    active: true,
    createdAt: serverTimestamp(),
  });
  return pollRef.id;
}

export async function endLivePoll(streamId: string, pollId: string): Promise<void> {
  await updateDoc(doc(db, LIVE_STREAMS_COLLECTION, streamId, 'polls', pollId), { active: false });
}

// Assumes at most one active poll at a time (enforced by convention in the
// host UI, not the database) — takes the first match if that's ever
// violated rather than requiring a composite index for ordering.
export function subscribeToActiveLivePoll(streamId: string, onChange: (poll: LivePoll | null) => void) {
  const activeQuery = query(livePollsRef(streamId), where('active', '==', true));
  return onSnapshot(activeQuery, (snapshot) => {
    const docSnap = snapshot.docs[0];
    if (!docSnap) {
      onChange(null);
      return;
    }
    const data = docSnap.data();
    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
    onChange({ id: docSnap.id, question: data.question, options: data.options ?? [], active: data.active, createdAt });
  });
}

export function subscribeToLivePollVotes(
  streamId: string,
  pollId: string,
  onChange: (countsByOptionId: Record<string, number>) => void
) {
  return onSnapshot(collection(db, LIVE_STREAMS_COLLECTION, streamId, 'polls', pollId, 'votes'), (snapshot) => {
    const counts: Record<string, number> = {};
    snapshot.docs.forEach((docSnap) => {
      const optionId = docSnap.data().optionId as string;
      counts[optionId] = (counts[optionId] ?? 0) + 1;
    });
    onChange(counts);
  });
}

export function subscribeToMyLivePollVote(
  streamId: string,
  pollId: string,
  uid: string,
  onChange: (optionId: string | null) => void
) {
  return onSnapshot(doc(db, LIVE_STREAMS_COLLECTION, streamId, 'polls', pollId, 'votes', uid), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data().optionId as string) : null);
  });
}

export async function castLivePollVote(streamId: string, pollId: string, uid: string, optionId: string): Promise<void> {
  await setDoc(doc(db, LIVE_STREAMS_COLLECTION, streamId, 'polls', pollId, 'votes', uid), {
    optionId,
    createdAt: serverTimestamp(),
  });
}

// ---- Live Q&A ----
function liveQuestionsRef(streamId: string) {
  return collection(db, LIVE_STREAMS_COLLECTION, streamId, 'questions');
}

export function subscribeToQuestions(streamId: string, onChange: (questions: LiveQuestion[]) => void) {
  const questionsQuery = query(liveQuestionsRef(streamId), orderBy('upvoteCount', 'desc'));
  return onSnapshot(questionsQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          uid: data.uid,
          username: data.username ?? 'Someone',
          text: data.text,
          upvoteCount: data.upvoteCount ?? 0,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
        };
      })
    );
  });
}

export async function submitQuestion(streamId: string, uid: string, username: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(liveQuestionsRef(streamId), { uid, username, text: trimmed, upvoteCount: 0, createdAt: serverTimestamp() });
}

export function subscribeToMyQuestionUpvote(
  streamId: string,
  questionId: string,
  uid: string,
  onChange: (upvoted: boolean) => void
) {
  return onSnapshot(doc(db, LIVE_STREAMS_COLLECTION, streamId, 'questions', questionId, 'upvotes', uid), (snapshot) => {
    onChange(snapshot.exists());
  });
}

export async function toggleQuestionUpvote(
  streamId: string,
  questionId: string,
  uid: string,
  currentlyUpvoted: boolean
): Promise<void> {
  const upvoteRef = doc(db, LIVE_STREAMS_COLLECTION, streamId, 'questions', questionId, 'upvotes', uid);
  if (currentlyUpvoted) {
    await deleteDoc(upvoteRef);
  } else {
    await setDoc(upvoteRef, { createdAt: serverTimestamp() });
  }
}

// LiveKit credentials never reach the client — this calls the
// getLiveKitToken Cloud Function, which mints a short-lived join token
// server-side (see functions/src/index.ts).
export const getLiveKitToken = httpsCallable<
  { roomName: string; canPublish: boolean },
  { token: string; serverUrl: string }
>(functions, 'getLiveKitToken');
