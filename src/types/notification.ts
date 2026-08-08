export type Notification = {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'battle_invite';
  fromUid: string;
  fromUsername: string;
  postId?: string;
  postThumbnailUrl?: string;
  commentText?: string;
  battleStreamId?: string;
  battleDurationSec?: number;
  read: boolean;
  createdAt: number;
};
