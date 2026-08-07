import {
  addDoc,
  collection,
  doc,
  DocumentData,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ChatMessage, Conversation } from '../types/message';

function conversationId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

export async function getOrCreateConversation(uidA: string, uidB: string): Promise<string> {
  const id = conversationId(uidA, uidB);
  await setDoc(
    doc(db, 'conversations', id),
    {
      participants: [uidA, uidB].sort(),
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
    },
    { merge: true }
  );
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
          text: data.text,
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
    text: trimmed,
    createdAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, 'conversations', convId),
    { lastMessage: trimmed, lastMessageAt: serverTimestamp() },
    { merge: true }
  );
}

export function getOtherParticipant(conversation: Conversation, myUid: string): string | undefined {
  return conversation.participants.find((uid) => uid !== myUid);
}
