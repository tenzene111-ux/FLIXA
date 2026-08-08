export type NotificationType = 'like' | 'comment' | 'follow' | 'battle_invite' | 'went_live';

export type Notification = {
  id: string;
  type: NotificationType;
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

// How InboxScreen groups notifications into TikTok-style summary rows
// (New followers / Likes / Comments / Live & Battles) before drilling
// into a per-group ActivityFeedScreen.
export type ActivityGroup = 'follow' | 'like' | 'comment' | 'live';

export const ACTIVITY_GROUP_TYPES: Record<ActivityGroup, NotificationType[]> = {
  follow: ['follow'],
  like: ['like'],
  comment: ['comment'],
  live: ['battle_invite', 'went_live'],
};

export const ACTIVITY_GROUP_ORDER: ActivityGroup[] = ['follow', 'like', 'comment', 'live'];

export const ACTIVITY_GROUP_LABEL: Record<ActivityGroup, string> = {
  follow: 'New followers',
  like: 'Likes',
  comment: 'Comments',
  live: 'Live & Battles',
};
