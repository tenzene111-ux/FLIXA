export type Conversation = {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: number;
};

export type ChatMessage = {
  id: string;
  senderUid: string;
  text: string;
  createdAt: number;
};
