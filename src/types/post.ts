import type { Poll } from './poll';

export type VideoOverlay = {
  id: string;
  kind: 'text' | 'sticker';
  content: string;
  x: number; // 0..1 fraction of video width
  y: number; // 0..1 fraction of video height
};

export type PostPrivacy = 'everyone' | 'followers' | 'friends' | 'onlyMe';
export type CommentsSetting = 'everyone' | 'followers' | 'friends' | 'nobody';

export type Post = {
  id: string;
  uid: string;
  caption: string;
  videoUrl: string;
  thumbnailUrl: string;
  likesCount: number;
  commentsCount: number;
  viewCount: number;
  shareCount: number;
  saveCount: number;
  watchCount: number;
  totalWatchedSec: number;
  completedViews: number;
  retain25: number;
  retain50: number;
  retain75: number;
  createdAt: number;
  trimStart: number;
  trimEnd: number | null;
  overlays: VideoOverlay[];
  musicTitle: string;
  hashtags: string[];
  poll: Poll | null;
  privacy: PostPrivacy;
  commentsSetting: CommentsSetting;
  allowDownloads: boolean;
};
