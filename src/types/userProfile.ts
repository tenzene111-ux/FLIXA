export type UserProfile = {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string | null;
  bio: string;
  followingCount: number;
  followersCount: number;
};
