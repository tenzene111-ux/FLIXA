export type Conversation = {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: number;
  lastMessageSenderUid: string | null;
  // Per-participant "I've seen messages up to this time" — keyed by uid
  // rather than a single flag so it works for both people independently.
  readAt: Record<string, number>;
};

export type ChatMessageKind = 'text' | 'post_share';

export type ChatMessage = {
  id: string;
  senderUid: string;
  kind: ChatMessageKind;
  text: string;
  postId?: string;
  postThumbnailUrl?: string;
  postCaption?: string;
  createdAt: number;
};
