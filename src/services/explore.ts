import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Post } from '../types/post';
import type { UserProfile } from '../types/userProfile';

// The users collection is shared with another app on this Firebase project,
// which writes accounts with a different field set (handle/avatarUrl/
// followerCount instead of username/photoURL/followersCount). Normalize
// either shape so a cross-app account never renders with an undefined
// username.
function mapUserDoc(uid: string, data: Record<string, unknown>): UserProfile {
  const username = ((data.username as string | undefined) ??
    (data.handle as string | undefined)?.replace(/^@/, '') ??
    'user') as string;
  return {
    uid,
    username,
    displayName: (data.displayName as string) ?? username,
    photoURL: (data.photoURL as string) ?? (data.avatarUrl as string) ?? null,
    bio: (data.bio as string) ?? '',
    followingCount: (data.followingCount as number) ?? 0,
    followersCount: (data.followersCount as number) ?? (data.followerCount as number) ?? 0,
  };
}

export async function searchUsersByUsername(term: string): Promise<UserProfile[]> {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return [];

  const usersQuery = query(
    collection(db, 'users'),
    orderBy('username'),
    where('username', '>=', normalized),
    where('username', '<=', normalized + ''),
    limit(20)
  );
  const snapshot = await getDocs(usersQuery);
  return snapshot.docs.map((docSnap) => mapUserDoc(docSnap.id, docSnap.data()));
}

export type TrendingHashtag = { tag: string; count: number };

export async function getTrendingHashtags(): Promise<TrendingHashtag[]> {
  const postsQuery = query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(100));
  const snapshot = await getDocs(postsQuery);

  const counts = new Map<string, number>();
  snapshot.docs.forEach((docSnap) => {
    const caption = (docSnap.data().caption as string) ?? '';
    const tags = caption.match(/#[a-zA-Z0-9_]+/g) ?? [];
    tags.forEach((tag) => {
      const key = tag.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export type PopularCreator = UserProfile & { totalLikes: number };

export async function getPopularCreators(): Promise<PopularCreator[]> {
  const postsQuery = query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(100));
  const postsSnapshot = await getDocs(postsQuery);

  const likesByUid = new Map<string, number>();
  postsSnapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() as { uploaderId: string; likeCount?: number };
    likesByUid.set(data.uploaderId, (likesByUid.get(data.uploaderId) ?? 0) + (data.likeCount ?? 0));
  });

  const topUids = Array.from(likesByUid.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const creators = await Promise.all(
    topUids.map(async ([uid, totalLikes]) => {
      const snapshot = await getDoc(doc(db, 'users', uid));
      if (!snapshot.exists()) return null;
      return { ...mapUserDoc(uid, snapshot.data()), totalLikes };
    })
  );

  return creators.filter((creator): creator is PopularCreator => creator !== null);
}

export async function getTopPost(): Promise<Post | null> {
  const postsQuery = query(collection(db, 'videos'), orderBy('likeCount', 'desc'), limit(1));
  const snapshot = await getDocs(postsQuery);
  const docSnap = snapshot.docs[0];
  if (!docSnap) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    uid: data.uploaderId,
    caption: data.caption ?? '',
    videoUrl: data.videoUrl,
    thumbnailUrl: data.thumbnailUrl,
    likesCount: data.likeCount ?? 0,
    commentsCount: data.commentCount ?? 0,
    viewCount: data.viewCount ?? 0,
    createdAt: Date.now(),
    trimStart: data.trimStart ?? 0,
    trimEnd: data.trimEnd ?? null,
    overlays: data.overlays ?? [],
    musicTitle: data.musicTitle ?? '',
    poll: data.poll ?? null,
    privacy: data.privacy ?? 'everyone',
    commentsSetting: data.commentsSetting ?? 'everyone',
    allowDownloads: data.allowDownloads ?? true,
  };
}
