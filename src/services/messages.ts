import {
  addDoc,
  collection,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ChatMessage, Conversation } from '../types/message';

function conversationId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

export async function getOrCreateConversation(uidA: string, uidB: string): Promise<string> {
  const id = conversationId(uidA, uidB);
  const ref = doc(db, 'conversations', id);
  // Only initialize on first creation — a plain merge-write here would
  // otherwise reset lastMessage/lastMessageAt (and now readAt) to blank
  // every time someone taps "Message" on a profile they already have a
  // conversation with, wiping the preview text in ConversationsScreen.
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      participants: [uidA, uidB].sort(),
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      lastMessageSenderUid: null,
      readAt: {},
    });
  }
  return id;
}

function mapConversations(snapshot: QuerySnapshot<DocumentData>): Conversation[] {
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      participants: data.participants ?? [],
      lastMessage: data.lastMessage ?? '',
      lastMessageAt: data.lastMessageAt instanceof Timestamp ? data.lastMessageAt.toMillis() : Date.now(),
      lastMessageSenderUid: data.lastMessageSenderUid ?? null,
      readAt: data.readAt ?? {},
    };
  });
}

export function subscribeToConversations(uid: string, onChange: (conversations: Conversation[]) => void) {
  const conversationsQuery = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', uid),
    orderBy('lastMessageAt', 'desc')
  );
  return onSnapshot(conversationsQuery, (snapshot) => onChange(mapConversations(snapshot)));
}

export function subscribeToMessages(convId: string, onChange: (messages: ChatMessage[]) => void) {
  const messagesQuery = query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(messagesQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          senderUid: data.senderUid,
          kind: data.kind ?? 'text',
          text: data.text ?? '',
          postId: data.postId,
          postThumbnailUrl: data.postThumbnailUrl,
          postCaption: data.postCaption,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
        };
      })
    );
  });
}

export async function sendMessage(convId: string, senderUid: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;

  await addDoc(collection(db, 'conversations', convId, 'messages'), {
    senderUid,
    kind: 'text',
    text: trimmed,
    createdAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, 'conversations', convId),
    { lastMessage: trimmed, lastMessageAt: serverTimestamp(), lastMessageSenderUid: senderUid },
    { merge: true }
  );
}

// "Send to" a video/photo post directly into a chat — mirrors TikTok's
// share-into-DM flow. The recipient sees a tappable-looking preview card
// (see ChatScreen) built from the post's thumbnail/caption.
export async function sendPostShare(
  convId: string,
  senderUid: string,
  post: { id: string; thumbnailUrl: string; caption: string }
) {
  await addDoc(collection(db, 'conversations', convId, 'messages'), {
    senderUid,
    kind: 'post_share',
    text: '',
    postId: post.id,
    postThumbnailUrl: post.thumbnailUrl,
    postCaption: post.caption,
    createdAt: serverTimestamp(),
  });

  const preview = post.caption ? `Sent a video: ${post.caption}` : 'Sent a video';
  await setDoc(
    doc(db, 'conversations', convId),
    { lastMessage: preview, lastMessageAt: serverTimestamp(), lastMessageSenderUid: senderUid },
    { merge: true }
  );
}

// Dot-path field update so only this participant's readAt entry changes —
// a plain `{ readAt: { [uid]: ... } }` merge would replace the whole map
// and wipe the other participant's entry.
export async function markConversationRead(convId: string, uid: string) {
  await updateDoc(doc(db, 'conversations', convId), { [`readAt.${uid}`]: Date.now() });
}

export function isConversationUnread(conversation: Conversation, myUid: string): boolean {
  if (!conversation.lastMessageSenderUid || conversation.lastMessageSenderUid === myUid) return false;
  return conversation.lastMessageAt > (conversation.readAt[myUid] ?? 0);
}

export function getOtherParticipant(conversation: Conversation, myUid: string): string | undefined {
  return conversation.participants.find((uid) => uid !== myUid);
}
