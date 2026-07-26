export type UserProfile = {
  uid: string;
  email: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  likeCount: number;
  createdAt: number;
};

export type NotificationType = 'like' | 'comment' | 'follow' | 'system';

export type NotificationItem = {
  id: string;
  type: NotificationType;
  fromName: string;
  fromAvatar: string;
  message: string;
  read: boolean;
  createdAt: number;
};

export type WalletTransactionType = 'topup' | 'gift' | 'reward' | 'refund';

export type WalletTransaction = {
  id: string;
  type: WalletTransactionType;
  label: string;
  amount: number;
  createdAt: number;
};

export type Playlist = {
  id: string;
  name: string;
  coverUrl: string;
  videoCount: number;
  createdAt: number;
};

export type LiveStream = {
  id: string;
  hostName: string;
  hostAvatar: string;
  title: string;
  viewerCount: number;
  isLive: boolean;
};

export type LiveComment = {
  id: string;
  userName: string;
  text: string;
  createdAt: number;
};

export type TrendingHashtag = {
  id: string;
  tag: string;
  viewCount: number;
};

export type ExploreCreator = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
};
