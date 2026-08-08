export const LIVE_CATEGORIES = [
  'Music',
  'Gaming',
  'Education',
  'Comedy',
  'Sports',
  'Cooking',
  'Talk',
  'Technology',
  'Lifestyle',
  'Other',
] as const;
export type LiveCategory = (typeof LIVE_CATEGORIES)[number];

export type LiveStream = {
  id: string;
  hostUid: string;
  hostUsername: string;
  title: string;
  coverUrl: string | null;
  category: LiveCategory;
  hashtags: string[];
  allowComments: boolean;
  allowGifts: boolean;
  pinnedMessage: string | null;
  goalTarget: number | null;
  highlightedQuestionId: string | null;
  likeCount: number;
  isLive: boolean;
  createdAt: number;
};

export type LiveComment = {
  id: string;
  uid: string;
  username: string;
  text: string;
  createdAt: number;
};

export type LiveQuestion = {
  id: string;
  uid: string;
  username: string;
  text: string;
  upvoteCount: number;
  createdAt: number;
};
