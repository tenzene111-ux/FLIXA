// Mirrors users/{uid}/meta/interestProfile, written server-side by
// onAnalyticsEventCreate (functions/src/index.ts). A "topic" is literally a
// hashtag key — there's no separate taxonomy or ML classifier behind this.
export type InterestProfile = {
  topics: Record<string, number>;
  creators: Record<string, number>;
  sounds: Record<string, number>;
};

export const EMPTY_INTEREST_PROFILE: InterestProfile = { topics: {}, creators: {}, sounds: {} };
