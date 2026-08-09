import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getVideosByHashtag, getVideosByMusicTitle, searchUsersByUsername } from './explore';
import { getRecentPosts, getVideosByCaptionWord } from './posts';
import { getActiveLiveStreams } from './live';
import type { Post } from '../types/post';
import type { LiveStream } from '../types/liveStream';
import type { UserProfile } from '../types/userProfile';

// ---------------------------------------------------------------------
// FLIXA's Search + Explore engine.
//
// What this honestly is: prefix-range queries and array-contains word
// matching over Firestore, plus two small server-maintained stat
// collections (hashtagStats/soundStats/searchTrends, all written by
// functions/src/index.ts) that give real counts and day-over-day growth
// instead of scanning recent videos on every read.
//
// What this is NOT: a real search engine. There's no semantic/synonym/
// typo-correction matching (exact word only — see extractCaptionWords in
// posts.ts), no transliteration, no spam/bot/fake-engagement detection, no
// duplicate-content detection, no true GPS-based location search (no
// location capture exists in this app — "Bhutan Explore" and the
// dzongkhag list below are hashtag-driven, not geo-driven), no voice-to-
// text (the mic button in ExploreScreen is a UI affordance only — real
// speech recognition needs a native module this project doesn't have),
// and no Redis/caching layer (Firestore's own bounded queries serve this
// app's actual scale). Building any of those for real means integrating
// a dedicated service (Algolia/Typesense for search, a speech API for
// voice, a maps/geo SDK for location) — deliberately not faked here.
// ---------------------------------------------------------------------

export function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 80);
}

function dateKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayYesterdayKeys(): [string, string] {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return [dateKeyUTC(now), dateKeyUTC(yesterday)];
}

// "Velocity" here is literally today's count minus yesterday's, read from
// the day-bucketed history map each stat doc carries — not true minute-
// by-minute acceleration, which would need much finer-grained buckets
// than are practical to store per query/hashtag/sound.
function computeGrowth(history: Record<string, number> | undefined): number {
  if (!history) return 0;
  const [today, yesterday] = todayYesterdayKeys();
  return (history[today] ?? 0) - (history[yesterday] ?? 0);
}

function diversifyByCreator(posts: Post[]): Post[] {
  const remaining = [...posts];
  const result: Post[] = [];
  while (remaining.length > 0) {
    const lastUid = result[result.length - 1]?.uid;
    let pickIndex = remaining.findIndex((p) => p.uid !== lastUid);
    if (pickIndex === -1) pickIndex = 0;
    result.push(remaining[pickIndex]);
    remaining.splice(pickIndex, 1);
  }
  return result;
}

export type AutocompleteSuggestion = { id: string; label: string; kind: 'query' | 'hashtag' | 'sound' | 'creator' };

export async function getAutocompleteSuggestions(prefix: string): Promise<AutocompleteSuggestion[]> {
  const normalized = prefix.trim().toLowerCase().replace(/^[#@]/, '');
  if (!normalized) return [];
  const end = normalized + '';

  const [trendSnap, hashtagSnap, soundSnap, users] = await Promise.all([
    getDocs(query(collection(db, 'searchTrends'), orderBy('query'), where('query', '>=', normalized), where('query', '<=', end), limit(5))),
    getDocs(query(collection(db, 'hashtagStats'), orderBy('tag'), where('tag', '>=', normalized), where('tag', '<=', end), limit(5))),
    getDocs(
      query(collection(db, 'soundStats'), orderBy('titleLower'), where('titleLower', '>=', normalized), where('titleLower', '<=', end), limit(5))
    ),
    searchUsersByUsername(normalized),
  ]);

  const suggestions: AutocompleteSuggestion[] = [];
  trendSnap.docs.forEach((d) => suggestions.push({ id: `q:${d.id}`, label: (d.data().query as string) ?? d.id, kind: 'query' }));
  hashtagSnap.docs.forEach((d) => suggestions.push({ id: `h:${d.id}`, label: `#${(d.data().tag as string) ?? d.id}`, kind: 'hashtag' }));
  soundSnap.docs.forEach((d) => suggestions.push({ id: `s:${d.id}`, label: (d.data().musicTitle as string) ?? d.id, kind: 'sound' }));
  users.slice(0, 5).forEach((u) => suggestions.push({ id: `c:${u.uid}`, label: `@${u.username}`, kind: 'creator' }));

  return suggestions.slice(0, 14);
}

export type TrendingSearchItem = { query: string; totalCount: number; growth: number };

export async function getTrendingSearches(limitN = 10): Promise<TrendingSearchItem[]> {
  const snapshot = await getDocs(query(collection(db, 'searchTrends'), orderBy('totalCount', 'desc'), limit(50)));
  const items = snapshot.docs.map((d) => {
    const data = d.data();
    return {
      query: (data.query as string) ?? d.id,
      totalCount: (data.totalCount as number) ?? 0,
      growth: computeGrowth(data.history as Record<string, number>),
    };
  });
  return items.sort((a, b) => b.growth - a.growth || b.totalCount - a.totalCount).slice(0, limitN);
}

export type HashtagStat = { tag: string; count: number; growth: number };
export type SoundStat = { musicTitle: string; count: number; growth: number };

export async function getTopHashtags(limitN = 10): Promise<HashtagStat[]> {
  const snapshot = await getDocs(query(collection(db, 'hashtagStats'), orderBy('count', 'desc'), limit(limitN)));
  return snapshot.docs.map((d) => {
    const data = d.data();
    return { tag: (data.tag as string) ?? d.id, count: (data.count as number) ?? 0, growth: computeGrowth(data.history) };
  });
}

// "Rising Fast" (spec §16/§17): the same bounded pool as getTopHashtags,
// re-ranked by growth instead of raw count, so a hashtag that's spiking
// today can surface even if its all-time total is still small.
export async function getRisingHashtags(limitN = 8): Promise<HashtagStat[]> {
  const snapshot = await getDocs(query(collection(db, 'hashtagStats'), orderBy('count', 'desc'), limit(40)));
  const items = snapshot.docs.map((d) => {
    const data = d.data();
    return { tag: (data.tag as string) ?? d.id, count: (data.count as number) ?? 0, growth: computeGrowth(data.history) };
  });
  return items
    .filter((i) => i.growth > 0)
    .sort((a, b) => b.growth - a.growth)
    .slice(0, limitN);
}

export async function getTopSounds(limitN = 10): Promise<SoundStat[]> {
  const snapshot = await getDocs(query(collection(db, 'soundStats'), orderBy('count', 'desc'), limit(limitN)));
  return snapshot.docs.map((d) => {
    const data = d.data();
    return { musicTitle: (data.musicTitle as string) ?? d.id, count: (data.count as number) ?? 0, growth: computeGrowth(data.history) };
  });
}

export type RisingCreator = { uid: string; recentEngagement: number; postCount: number };

// Favors engagement RATE over raw volume, so a small creator with a few
// strong posts can outrank someone huge coasting on one old viral video —
// same spirit as the staged-distribution idea in recommendations.ts, just
// aggregated per-creator instead of per-post.
export async function getRisingCreators(limitN = 8): Promise<RisingCreator[]> {
  const recent = await getRecentPosts(100);
  const byCreator = new Map<string, { engagement: number; views: number; postCount: number }>();
  recent.forEach((p) => {
    const entry = byCreator.get(p.uid) ?? { engagement: 0, views: 0, postCount: 0 };
    entry.engagement += p.likesCount * 3 + p.commentsCount * 5 + p.shareCount * 4;
    entry.views += p.viewCount;
    entry.postCount += 1;
    byCreator.set(p.uid, entry);
  });

  return Array.from(byCreator.entries())
    .map(([uid, stats]) => ({
      uid,
      recentEngagement: stats.engagement,
      postCount: stats.postCount,
      rate: stats.engagement / Math.max(stats.views, 1),
    }))
    .sort((a, b) => b.rate - a.rate || b.recentEngagement - a.recentEngagement)
    .slice(0, limitN)
    .map(({ uid, recentEngagement, postCount }) => ({ uid, recentEngagement, postCount }));
}

export type SearchResults = {
  videos: Post[];
  creators: UserProfile[];
  live: LiveStream[];
  sounds: SoundStat[];
  hashtags: HashtagStat[];
};

export async function searchAll(rawQuery: string): Promise<SearchResults> {
  const trimmed = rawQuery.trim();
  const normalized = trimmed.toLowerCase().replace(/^[#@]/, '');
  if (!normalized) return { videos: [], creators: [], live: [], sounds: [], hashtags: [] };

  const words = normalized.split(/\s+/).filter(Boolean);
  const firstWord = words[0];
  const end = normalized + '';

  const [hashtagVideos, captionVideos, exactSoundVideos, creators, liveStreams, hashtagSnap, soundSnap] = await Promise.all([
    getVideosByHashtag(normalized),
    firstWord ? getVideosByCaptionWord(firstWord) : Promise.resolve([] as Post[]),
    // A direct exact-title sound match (searching the full sound name)
    // widens the video pool too, not just the Sounds tab.
    normalized.length > 2 ? getVideosByMusicTitle(trimmed).catch(() => [] as Post[]) : Promise.resolve([] as Post[]),
    searchUsersByUsername(normalized),
    getActiveLiveStreams(40),
    getDocs(query(collection(db, 'hashtagStats'), orderBy('tag'), where('tag', '>=', normalized), where('tag', '<=', end), limit(8))),
    getDocs(
      query(collection(db, 'soundStats'), orderBy('titleLower'), where('titleLower', '>=', normalized), where('titleLower', '<=', end), limit(8))
    ),
  ]);

  // "AND" the remaining words against the caption text — the array-contains
  // query above only guarantees the first word matched.
  const relevantCaptionVideos =
    words.length > 1 ? captionVideos.filter((p) => words.every((w) => p.caption.toLowerCase().includes(w))) : captionVideos;

  const videoPool = new Map<string, Post>();
  [...hashtagVideos, ...relevantCaptionVideos, ...exactSoundVideos].forEach((p) => videoPool.set(p.id, p));
  const videos = diversifyByCreator(Array.from(videoPool.values()).sort((a, b) => b.createdAt - a.createdAt));

  const live = liveStreams.filter((s) => {
    const haystack = `${s.title} ${s.hostUsername} ${s.category} ${s.hashtags.join(' ')}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });

  const hashtags: HashtagStat[] = hashtagSnap.docs.map((d) => {
    const data = d.data();
    return { tag: (data.tag as string) ?? d.id, count: (data.count as number) ?? 0, growth: computeGrowth(data.history) };
  });
  const sounds: SoundStat[] = soundSnap.docs.map((d) => {
    const data = d.data();
    return { musicTitle: (data.musicTitle as string) ?? d.id, count: (data.count as number) ?? 0, growth: computeGrowth(data.history) };
  });

  return { videos, creators, live, sounds, hashtags };
}

// ---- Curated, hashtag-driven discovery (not geo/GPS-based — see the
// module doc comment above) ----

export const BHUTAN_REGIONS = [
  'Thimphu',
  'Paro',
  'Punakha',
  'Phuentsholing',
  'Wangdue',
  'Bumthang',
  'Trashigang',
  'Mongar',
  'Samdrup Jongkhar',
];

export const EXPLORE_CATEGORIES: { label: string; hashtags: string[] }[] = [
  { label: 'Music', hashtags: ['music', 'song', 'singer'] },
  { label: 'Comedy', hashtags: ['comedy', 'funny'] },
  { label: 'Food', hashtags: ['food', 'momo', 'recipe'] },
  { label: 'Travel', hashtags: ['travel', 'bhutan', 'hiking'] },
  { label: 'Sports', hashtags: ['sports', 'football', 'archery'] },
  { label: 'Gaming', hashtags: ['gaming', 'game'] },
  { label: 'Education', hashtags: ['education', 'learning'] },
  { label: 'Business', hashtags: ['business', 'entrepreneur'] },
  { label: 'Art', hashtags: ['art', 'artist'] },
];

export async function getCategoryVideos(label: string): Promise<Post[]> {
  const config = EXPLORE_CATEGORIES.find((c) => c.label === label);
  if (!config) return [];
  const results = await Promise.all(config.hashtags.map((tag) => getVideosByHashtag(tag)));
  const pool = new Map<string, Post>();
  results.flat().forEach((p) => pool.set(p.id, p));
  return Array.from(pool.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30);
}
