export type LiveGuestRequestStatus = 'pending' | 'accepted' | 'rejected';

export type LiveGuestRequest = {
  uid: string;
  username: string;
  status: LiveGuestRequestStatus;
  createdAt: number;
};

export type LiveCoHost = {
  uid: string;
  username: string;
  joinedAt: number;
};

export type LiveModerator = {
  uid: string;
  username: string;
  addedAt: number;
};

export type LiveBlockedUser = {
  uid: string;
  username: string;
  blockedAt: number;
};
