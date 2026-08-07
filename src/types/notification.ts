export type Notification = {
  id: string;
  type: 'like';
  fromUid: string;
  fromUsername: string;
  postId: string;
  postThumbnailUrl: string;
  read: boolean;
  createdAt: number;
};
