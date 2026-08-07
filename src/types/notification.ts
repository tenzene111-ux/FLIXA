export type Notification = {
  id: string;
  type: 'like' | 'comment' | 'follow';
  fromUid: string;
  fromUsername: string;
  postId?: string;
  postThumbnailUrl?: string;
  commentText?: string;
  read: boolean;
  createdAt: number;
};
