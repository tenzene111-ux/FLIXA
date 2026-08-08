export type Notification = {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'battle_invite' | 'went_live';
  fromUid: string;
  fromUsername: string;
  postId?: string;
  postThumbnailUrl?: string;
  commentText?: string;
  battleStreamId?: string;
  battleDurationSec?: number;
  wentLiveStreamId?: string;
  read: boolean;
  createdAt: number;
};
