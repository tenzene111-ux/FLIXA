import { getVideosByHashtag, getVideosByMusicTitle } from './explore';
import { getPostsByCreators, getRecentPosts } from './posts';
import type { InterestProfile } from '../types/interestProfile';
import type { Post } from '../types/post';

// ---------------------------------------------------------------------
// FLIXA's For You candidate generation + ranking.
//
// What this honestly is: a heuristic pipeline over the data FLIXA already
// has — hashtags-as-topics, sound titles, follower graph, and engagement
// counters — combined with a per-user interest profile that the
// onAnalyticsEventCreate Cloud Function builds from real watch/like/
// comment/share/save/follow/search signals (functions/src/index.ts).
//
// What this is NOT: a trained ML model. There's no video-content
// understanding (resolution/audio-quality/visual-similarity analysis),
// no cross-user collaborative filtering ("people who liked X also liked
// Y" would need a similarity index this project doesn't have), no GPS-
// based regional layer (no location capture exists), no ads auction (no
// ad network integrated), and no duplicate/copyright detection. Those are
// deliberately left out rather than faked — see the "explicitly out of
// scope" note wherever a spec'd behavior isn't implementable honestly.
// ---------------------------------------------------------------------

export type CandidateSource = 'following' | 'topic' | 'sound' | 'trending' | 'recent' | 'newCreator' | 'exploration';

export type RankedPost = {
  post: Post;
  sources: CandidateSource[];
  score: number;
};

// A creator's video is still in its small initial test audience below this
// view count — mirrors the staged-distribution idea (small sample first,
// wider distribution only if it performs) without requiring a large
// existing follower base.
const NEW_CREATOR_VIEW_CAP = 50;
const GOOD_ENGAGEMENT_RATE = 0.05;

function topEntries(weights: Record<string, number>, count: number): string[] {
  return Object.entries(weights)
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([key]) => key);
}

function ageHours(post: Post): number {
  return Math.max(0.1, (Date.now() - post.createdAt) / (1000 * 60 * 60));
}

function engagementRate(post: Post): number {
  const denominator = Math.max(post.viewCount, 1);
  return (post.likesCount * 3 + post.commentsCount * 5 + post.shareCount * 4 + post.saveCount * 3) / denominator;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type CandidatePool = Map<string, { post: Post; sources: Set<CandidateSource> }>;

// Pulls from several independent, bounded sources rather than one big
// query, then merges/dedupes into one candidate pool tagged with which
// source(s) surfaced each post (used later for "Why am I seeing this?").
export async function buildForYouCandidates(params: {
  followingUids: string[];
  profile: InterestProfile;
  isExcluded: (post: Post) => boolean;
}): Promise<CandidatePool> {
  const { followingUids, profile, isExcluded } = params;
  const topTopics = topEntries(profile.topics, 5);
  const topSounds = topEntries(profile.sounds, 2);

  const [followingPosts, topicResults, soundResults, recentPosts] = await Promise.all([
    followingUids.length ? getPostsByCreators(followingUids, 8) : Promise.resolve([] as Post[]),
    Promise.all(topTopics.map((tag) => getVideosByHashtag(tag))),
    Promise.all(topSounds.map((sound) => getVideosByMusicTitle(sound))),
    getRecentPosts(60),
  ]);

  const pool: CandidatePool = new Map();
  const add = (post: Post, source: CandidateSource) => {
    if (isExcluded(post)) return;
    const existing = pool.get(post.id);
    if (existing) existing.sources.add(source);
    else pool.set(post.id, { post, sources: new Set([source]) });
  };

  followingPosts.forEach((p) => add(p, 'following'));
  topicResults.flat().forEach((p) => add(p, 'topic'));
  soundResults.flat().forEach((p) => add(p, 'sound'));

  // Trending is a lens on the recent pool (engagement velocity), not a
  // separate collection/query.
  [...recentPosts]
    .filter((p) => ageHours(p) <= 72)
    .sort((a, b) => engagementRate(b) / ageHours(b) - engagementRate(a) / ageHours(a))
    .slice(0, 15)
    .forEach((p) => add(p, 'trending'));

  recentPosts.filter((p) => p.viewCount < NEW_CREATOR_VIEW_CAP).slice(0, 15).forEach((p) => add(p, 'newCreator'));
  recentPosts.slice(0, 20).forEach((p) => add(p, 'recent'));

  // Exploration: a random slice deliberately outside the user's top
  // topics, so the feed doesn't calcify around yesterday's interests.
  const outsideTopTopics = recentPosts.filter((p) => !p.hashtags.some((h) => topTopics.includes(h)));
  shuffle(outsideTopTopics).slice(0, 8).forEach((p) => add(p, 'exploration'));

  return pool;
}

const SOURCE_WEIGHT: Record<CandidateSource, number> = {
  following: 6,
  topic: 5,
  trending: 4,
  sound: 3,
  exploration: 1.5,
  newCreator: 2,
  recent: 1,
};

// The recommendation score. Deliberately not a made-up "sum of ten
// probabilities" — those numbers wouldn't be backed by anything. This
// combines what FLIXA can actually compute: interest-topic/creator/sound
// affinity from the profile, real engagement rate, recency, a staged-
// distribution multiplier for unproven new creators, and a small random
// jitter on exploration candidates so ranking isn't perfectly repeatable.
function scoreCandidate(post: Post, sources: Set<CandidateSource>, profile: InterestProfile): number {
  const topicAffinity = post.hashtags.reduce((sum, tag) => sum + (profile.topics[tag] ?? 0), 0);
  const creatorAffinity = profile.creators[post.uid] ?? 0;
  const soundAffinity = post.musicTitle ? profile.sounds[post.musicTitle] ?? 0 : 0;

  const freshnessBonus = Math.max(0, 48 - ageHours(post)) * 0.08;
  const engagement = engagementRate(post);
  const isNewCreator = post.viewCount < NEW_CREATOR_VIEW_CAP;
  const stagedMultiplier = isNewCreator ? 1 : engagement >= GOOD_ENGAGEMENT_RATE ? 1.6 : 0.6;
  const sourceBonus = Math.max(...Array.from(sources).map((s) => SOURCE_WEIGHT[s]));
  const explorationJitter = sources.has('exploration') || sources.has('newCreator') ? Math.random() * 1.5 : 0;

  const base = topicAffinity * 2 + creatorAffinity * 1.5 + soundAffinity + engagement * 3 + freshnessBonus + sourceBonus;
  return base * stagedMultiplier + explorationJitter;
}

// Prevents long runs from the same creator/sound: walks the score-sorted
// list and, whenever the best remaining candidate would repeat a creator
// or sound used in the last few slots, defers it in favor of the next-best
// diverse option instead of dropping it outright.
const DIVERSITY_WINDOW = 3;

function diversify(ranked: RankedPost[]): RankedPost[] {
  const remaining = [...ranked];
  const result: RankedPost[] = [];

  while (remaining.length > 0) {
    const recentCreators = result.slice(-DIVERSITY_WINDOW).map((r) => r.post.uid);
    const recentSounds = result.slice(-DIVERSITY_WINDOW).map((r) => r.post.musicTitle).filter(Boolean);

    let pickIndex = remaining.findIndex(
      (r) => !recentCreators.includes(r.post.uid) && !(r.post.musicTitle && recentSounds.includes(r.post.musicTitle))
    );
    if (pickIndex === -1) pickIndex = 0;

    result.push(remaining[pickIndex]);
    remaining.splice(pickIndex, 1);
  }

  return result;
}

export async function getForYouFeed(params: {
  followingUids: string[];
  profile: InterestProfile;
  isExcluded: (post: Post) => boolean;
}): Promise<RankedPost[]> {
  const pool = await buildForYouCandidates(params);
  const ranked: RankedPost[] = [];

  pool.forEach(({ post, sources }) => {
    ranked.push({ post, sources: Array.from(sources), score: scoreCandidate(post, sources, params.profile) });
  });

  ranked.sort((a, b) => b.score - a.score);
  return diversify(ranked);
}

// Real reasons generated from the signals that actually contributed —
// exactly the "Why am I seeing this?" transparency the spec asks for,
// without exposing raw weights/scores.
export function explainRecommendation(post: Post, sources: CandidateSource[], profile: InterestProfile): string[] {
  const sourceSet = new Set(sources);
  const reasons: string[] = [];

  const matchedTopic = post.hashtags.find((tag) => (profile.topics[tag] ?? 0) > 0.3);
  if (matchedTopic) reasons.push(`You often watch #${matchedTopic} content`);

  if ((profile.creators[post.uid] ?? 0) > 0.3) reasons.push("You've engaged with this creator before");

  if (post.musicTitle && (profile.sounds[post.musicTitle] ?? 0) > 0.2) {
    reasons.push('You often watch videos with this sound');
  }

  if (sourceSet.has('following')) reasons.push('You follow this creator');
  if (sourceSet.has('trending')) reasons.push('This video is trending right now');
  if (sourceSet.has('newCreator')) reasons.push("FLIXA is testing this video with a small audience, including you");
  if (sourceSet.has('exploration')) reasons.push('FLIXA mixes in videos outside your usual interests to help you discover more');

  if (reasons.length === 0) reasons.push('This video is popular with viewers who watch similar content');
  return reasons.slice(0, 3);
}
