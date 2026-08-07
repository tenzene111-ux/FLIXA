export type LiveStream = {
  id: string;
  hostUid: string;
  hostUsername: string;
  title: string;
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
