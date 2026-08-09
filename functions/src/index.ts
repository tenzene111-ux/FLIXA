import { initializeApp } from 'firebase-admin/app';
import { AggregateField, FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

initializeApp();
const db = getFirestore();

export { onVideoJobCreate } from './video';

// Wallets are server-authoritative (see firestore.rules), so the wallet
// document itself has to be created server-side too, the moment a user
// profile is created client-side.
export const initWalletOnUserCreate = onDocumentCreated('users/{uid}', async (event) => {
  const uid = event.params.uid;
  await db.doc(`wallets/${uid}`).set({ balance: 0, diamonds: 0 }, { merge: true });
});

// Like/comment counts are server-authoritative too, so a client can't
// inflate its own post's numbers directly — only by actually creating a
// like/comment doc, which these triggers turn into a count.
export const onLikeCreate = onDocumentCreated('videos/{videoId}/likes/{uid}', async (event) => {
  await db.doc(`videos/${event.params.videoId}`).update({ likeCount: FieldValue.increment(1) });
});

export const onLikeDelete = onDocumentDeleted('videos/{videoId}/likes/{uid}', async (event) => {
  await db.doc(`videos/${event.params.videoId}`).update({ likeCount: FieldValue.increment(-1) });
});

export const onCommentCreate = onDocumentCreated('videos/{videoId}/comments/{commentId}', async (event) => {
  await db.doc(`videos/${event.params.videoId}`).update({ commentCount: FieldValue.increment(1) });
});

export const onCommentDelete = onDocumentDeleted('videos/{videoId}/comments/{commentId}', async (event) => {
  await db.doc(`videos/${event.params.videoId}`).update({ commentCount: FieldValue.increment(-1) });
});

// saveCount mirrors likeCount's pattern, just derived from each user's own
// users/{uid}/savedVideos subcollection instead of a videos/{id} one.
export const onSavedVideoCreate = onDocumentCreated('users/{uid}/savedVideos/{videoId}', async (event) => {
  await db.doc(`videos/${event.params.videoId}`).update({ saveCount: FieldValue.increment(1) });
});

export const onSavedVideoDelete = onDocumentDeleted('users/{uid}/savedVideos/{videoId}', async (event) => {
  await db.doc(`videos/${event.params.videoId}`).update({ saveCount: FieldValue.increment(-1) });
});

// Creator analytics (see AnalyticsScreen) are built from batched watch
// sessions, not per-frame events: the client logs one 'video_watch' event
// per view when the viewer swipes away (see VideoCard.tsx), and this
// trigger folds it into aggregate counters on the video doc itself —
// the same server-authoritative-counter pattern as likeCount/commentCount
// above, just derived from analytics_events instead of a subcollection.
async function updateVideoWatchCounters(postId: string, data: FirebaseFirestore.DocumentData) {
  const watchedSec = Math.max(0, Number(data.watchedSec) || 0);
  const update: Record<string, ReturnType<typeof FieldValue.increment>> = {
    watchCount: FieldValue.increment(1),
    totalWatchedSec: FieldValue.increment(watchedSec),
  };
  if (data.completed) update.completedViews = FieldValue.increment(1);
  if (data.reached25) update.retain25 = FieldValue.increment(1);
  if (data.reached50) update.retain50 = FieldValue.increment(1);
  if (data.reached75) update.retain75 = FieldValue.increment(1);

  await db.doc(`videos/${postId}`).update(update).catch(() => {});
}

// ---- Personalized interest profile (drives the For You ranking in
// src/services/recommendations.ts on the client) ----
//
// A "topic" here is literally a hashtag — there's no separate taxonomy or
// ML content classifier behind this, so the tags a creator already writes
// on their caption are the whole content-understanding signal FLIXA has.
// Weights are simple additive increments with no periodic decay/clamping
// (a real production version would want a scheduled function to normalize
// them over time); this is the honest v1, not a claim of a trained model.
const MAX_TOPICS_PER_EVENT = 5;

function sanitizeProfileKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 80);
}

async function bumpInterestProfile(
  uid: string,
  postId: string | undefined,
  weight: { topic: number; creator: number; sound: number }
) {
  if (!postId) return;
  const postSnap = await db.doc(`videos/${postId}`).get();
  if (!postSnap.exists) return;
  const post = postSnap.data()!;

  const update: Record<string, ReturnType<typeof FieldValue.increment>> = {};
  const hashtags = ((post.hashtags as string[] | undefined) ?? []).slice(0, MAX_TOPICS_PER_EVENT);
  hashtags.forEach((tag) => {
    update[`topics.${sanitizeProfileKey(tag)}`] = FieldValue.increment(weight.topic);
  });
  if (post.uploaderId && post.uploaderId !== uid) {
    update[`creators.${post.uploaderId}`] = FieldValue.increment(weight.creator);
  }
  const musicTitle = ((post.musicTitle as string | undefined) ?? '').trim();
  if (musicTitle) {
    update[`sounds.${sanitizeProfileKey(musicTitle)}`] = FieldValue.increment(weight.sound);
  }
  if (Object.keys(update).length === 0) return;

  await db.doc(`users/${uid}/meta/interestProfile`).set(update, { merge: true }).catch(() => {});
}

async function bumpCreatorAffinity(uid: string, creatorUid: string | undefined, delta: number) {
  if (!creatorUid || creatorUid === uid) return;
  await db
    .doc(`users/${uid}/meta/interestProfile`)
    .set({ [`creators.${creatorUid}`]: FieldValue.increment(delta) }, { merge: true })
    .catch(() => {});
}

// Search has no real content index behind it (no Algolia/Typesense in this
// project), so this is a deliberately modest approximation: treat the
// searched words themselves as topic keys, the same way a hashtag is one.
async function bumpSearchTopics(uid: string, rawQuery: string) {
  const words = rawQuery
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3)
    .slice(0, 4);
  if (words.length === 0) return;
  const update: Record<string, ReturnType<typeof FieldValue.increment>> = {};
  words.forEach((word) => {
    update[`topics.${sanitizeProfileKey(word)}`] = FieldValue.increment(0.2);
  });
  await db.doc(`users/${uid}/meta/interestProfile`).set(update, { merge: true }).catch(() => {});
}

export const onAnalyticsEventCreate = onDocumentCreated('analytics_events/{eventId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;
  const uid = data.uid as string | undefined;
  if (!uid) return;
  // poll_vote logs videoId instead of postId (see PollCard.tsx) — same
  // underlying video either way.
  const postId = (data.postId as string | undefined) ?? (data.videoId as string | undefined);

  if (data.type === 'video_watch' && postId) {
    await updateVideoWatchCounters(postId, data);
  }

  switch (data.type) {
    case 'video_watch': {
      const durationSec = Math.max(0, Number(data.durationSec) || 0);
      const watchedSec = Math.max(0, Number(data.watchedSec) || 0);
      const completionRatio = durationSec > 0 ? Math.min(1.5, watchedSec / durationSec) : 0;
      // A near-instant skip (<15% watched) is a weak negative signal; a
      // real watch is a positive one that scales with how much of the
      // video was seen, plus a bonus for actually finishing it.
      const delta =
        completionRatio < 0.15 ? -0.05 : 0.05 + completionRatio * 0.15 + (data.completed ? 0.15 : 0);
      await bumpInterestProfile(uid, postId, { topic: delta, creator: delta * 0.6, sound: delta * 0.5 });
      break;
    }
    case 'like':
      await bumpInterestProfile(uid, postId, { topic: 0.35, creator: 0.35, sound: 0.2 });
      break;
    case 'unlike':
      await bumpInterestProfile(uid, postId, { topic: -0.2, creator: -0.2, sound: -0.1 });
      break;
    case 'comment':
      await bumpInterestProfile(uid, postId, { topic: 0.4, creator: 0.4, sound: 0.2 });
      break;
    case 'share':
      await bumpInterestProfile(uid, postId, { topic: 0.5, creator: 0.5, sound: 0.25 });
      break;
    case 'save':
      await bumpInterestProfile(uid, postId, { topic: 0.45, creator: 0.45, sound: 0.2 });
      break;
    case 'unsave':
      await bumpInterestProfile(uid, postId, { topic: -0.15, creator: -0.15, sound: -0.05 });
      break;
    case 'gift_sent':
      await bumpInterestProfile(uid, postId, { topic: 0.6, creator: 0.6, sound: 0.3 });
      break;
    case 'poll_vote':
      await bumpInterestProfile(uid, postId, { topic: 0.15, creator: 0.15, sound: 0.05 });
      break;
    case 'not_interested':
      await bumpInterestProfile(uid, postId, { topic: -0.6, creator: -0.4, sound: -0.3 });
      break;
    case 'follow':
      await bumpCreatorAffinity(uid, data.targetUid as string | undefined, 1.0);
      break;
    case 'profile_visit':
      await bumpCreatorAffinity(uid, data.targetUid as string | undefined, 0.15);
      break;
    case 'search':
      await bumpSearchTopics(uid, (data.query as string | undefined) ?? '');
      break;
    default:
      break;
  }
});

// Live Q&A questions are sorted by upvoteCount, which has to be a real
// queryable field rather than client-tallied — same server-authoritative
// counter pattern as video likes/comments above.
export const onLiveQuestionUpvoteCreate = onDocumentCreated(
  'liveStreams/{streamId}/questions/{questionId}/upvotes/{uid}',
  async (event) => {
    await db
      .doc(`liveStreams/${event.params.streamId}/questions/${event.params.questionId}`)
      .update({ upvoteCount: FieldValue.increment(1) });
  }
);

export const onLiveQuestionUpvoteDelete = onDocumentDeleted(
  'liveStreams/{streamId}/questions/{questionId}/upvotes/{uid}',
  async (event) => {
    await db
      .doc(`liveStreams/${event.params.streamId}/questions/${event.params.questionId}`)
      .update({ upvoteCount: FieldValue.increment(-1) });
  }
);

// viewerCount is re-derived from the viewers subcollection's real size
// (not just incremented/decremented) so it can never drift — the client
// already does the same thing for the single stream it's watching (see
// subscribeToViewerCount), this just also denormalizes it onto the
// stream doc itself so the browse list (LiveListScreen) can sort/filter
// by popularity without opening one listener per card. peakViewers and
// totalUniqueViewers only ever go up, which is what a post-stream
// analytics summary needs even after everyone's left.
async function recomputeViewerCount(streamId: string, isJoin: boolean) {
  const viewersRef = db.collection(`liveStreams/${streamId}/viewers`);
  const countSnap = await viewersRef.count().get();
  const viewerCount = countSnap.data().count;

  const streamRef = db.doc(`liveStreams/${streamId}`);
  const streamSnap = await streamRef.get();
  if (!streamSnap.exists) return;
  const peakViewers = (streamSnap.data()?.peakViewers as number) ?? 0;

  const update: Record<string, unknown> = { viewerCount, peakViewers: Math.max(peakViewers, viewerCount) };
  if (isJoin) update.totalUniqueViewers = FieldValue.increment(1);
  await streamRef.update(update);
}

export const onLiveViewerJoin = onDocumentCreated('liveStreams/{streamId}/viewers/{uid}', async (event) => {
  await recomputeViewerCount(event.params.streamId, true);
});

export const onLiveViewerLeave = onDocumentDeleted('liveStreams/{streamId}/viewers/{uid}', async (event) => {
  await recomputeViewerCount(event.params.streamId, false);
});

// Fan out a "went live" notification to every follower the moment a
// stream doc is created (createLiveStream always creates it with
// isLive: true — there's no "scheduled" state — so doc-create is exactly
// the "went live" event). Batched in chunks of 500 (Firestore's
// per-batch write limit) since a popular creator could have thousands.
export const onLiveStreamCreate = onDocumentCreated('liveStreams/{streamId}', async (event) => {
  const stream = event.data?.data();
  if (!stream) return;
  const { hostUid, hostUsername } = stream as { hostUid: string; hostUsername: string };

  const followersSnap = await db.collection(`users/${hostUid}/followers`).get();
  const followerUids = followersSnap.docs.map((docSnap) => docSnap.id);

  for (let i = 0; i < followerUids.length; i += 500) {
    const batch = db.batch();
    for (const followerUid of followerUids.slice(i, i + 500)) {
      const notificationRef = db.collection(`users/${followerUid}/notifications`).doc();
      batch.set(notificationRef, {
        type: 'went_live',
        fromUid: hostUid,
        fromUsername: hostUsername ?? 'Someone',
        wentLiveStreamId: event.params.streamId,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
});

// When a host ends a stream (isLive true -> false), compute a
// post-stream summary once, server-side, and attach it to the same doc.
// Diamonds/gift/comment totals use aggregate count()/sum() queries
// (one read each, regardless of collection size) rather than pulling
// every document — the per-gifter leaderboard itself is still served by
// the existing client-side subscribeToGiftLeaderboard, which keeps
// working after the stream ends since the gifts subcollection isn't
// deleted.
export const onLiveStreamEnded = onDocumentUpdated('liveStreams/{streamId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.isLive !== true || after.isLive !== false) return;

  const streamId = event.params.streamId;
  const createdAtMs =
    typeof after.createdAt?.toMillis === 'function' ? after.createdAt.toMillis() : Date.now();

  const [giftAgg, commentAgg] = await Promise.all([
    db
      .collection(`liveStreams/${streamId}/gifts`)
      .aggregate({ totalDiamonds: AggregateField.sum('amount'), giftCount: AggregateField.count() })
      .get(),
    db.collection(`liveStreams/${streamId}/comments`).count().get(),
  ]);

  await db.doc(`liveStreams/${streamId}`).update({
    analytics: {
      durationSec: Math.max(0, Math.round((Date.now() - createdAtMs) / 1000)),
      peakViewers: (after.peakViewers as number) ?? 0,
      totalUniqueViewers: (after.totalUniqueViewers as number) ?? 0,
      totalDiamonds: giftAgg.data().totalDiamonds ?? 0,
      giftCount: giftAgg.data().giftCount ?? 0,
      commentCount: commentAgg.data().count ?? 0,
    },
  });
});

async function applyWalletDelta(
  uid: string,
  amount: number,
  type: 'topup' | 'gift' | 'reward' | 'refund',
  label: string
): Promise<{ balance: number }> {
  const walletRef = db.doc(`wallets/${uid}`);
  const txRef = db.collection(`wallets/${uid}/transactions`).doc();

  return db.runTransaction(async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const currentBalance = walletSnap.exists ? (walletSnap.data()?.balance as number) ?? 0 : 0;
    const nextBalance = currentBalance + amount;
    if (nextBalance < 0) {
      throw new HttpsError('failed-precondition', 'Insufficient balance.');
    }
    tx.set(walletRef, { balance: nextBalance }, { merge: true });
    tx.set(txRef, { type, label, amount, createdAt: Date.now() });
    return { balance: nextBalance };
  });
}

// Fixed, server-known reward amounts. Never trust an amount the client sends.
const REWARD_CATALOG: Record<string, { amount: number; label: string }> = {
  creator_reward: { amount: 1000, label: 'Creator Rewards' },
  referral_bonus: { amount: 500, label: 'Referral Bonus' },
  refund: { amount: 200, label: 'Refund' },
};

export const claimReward = onCall<{ reason: keyof typeof REWARD_CATALOG }>(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const entry = REWARD_CATALOG[request.data.reason];
  if (!entry) throw new HttpsError('invalid-argument', 'Unknown reward reason.');
  return applyWalletDelta(request.auth.uid, entry.amount, 'reward', entry.label);
});

// Fixed, server-known spend costs.
const SPEND_CATALOG: Record<string, { cost: number; label: string }> = {
  live_gift: { cost: 500, label: 'LIVE Gift' },
  video_boost: { cost: 200, label: 'Video Boost' },
};

export const spendCoins = onCall<{ item: keyof typeof SPEND_CATALOG }>(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const entry = SPEND_CATALOG[request.data.item];
  if (!entry) throw new HttpsError('invalid-argument', 'Unknown spend item.');
  return applyWalletDelta(request.auth.uid, -entry.cost, 'gift', entry.label);
});

// Sending a gift (on a video, or in a live stream) is the one spend that
// has a recipient: unlike spendCoins above (which only debits the caller),
// this debits the sender's coin balance AND credits the recipient's
// diamond balance in the same transaction, then records the gift so a
// leaderboard can be built from it (clients can only read the gifts
// subcollection, never write it — every entry here is backed by a real
// coin movement). Costs are looked up here, server-side, from giftId —
// never trusted from the client — mirroring src/types/gift.ts on the
// client, which is display-only.
// Currency: 1 Coin = Nu. 1 (Bhutanese Ngultrum). Costs are capped at
// 100,000 coins (Nu. 100,000) for the top gift — mirrors src/types/gift.ts.
const GIFT_CATALOG: Record<string, { name: string; cost: number }> = {
  blue_poppy: { name: 'Blue Poppy', cost: 5 },
  butter_lamp: { name: 'Butter Lamp', cost: 10 },
  prayer_flag: { name: 'Prayer Flag', cost: 15 },
  prayer_wheel: { name: 'Prayer Wheel', cost: 20 },
  white_scarf: { name: 'White Scarf', cost: 30 },
  happiness_bell: { name: 'Happiness Bell', cost: 40 },
  lucky_knot: { name: 'Lucky Knot', cost: 50 },
  bamboo_arrow: { name: 'Bamboo Arrow', cost: 75 },
  golden_bow: { name: 'Golden Bow', cost: 120 },
  yak_caravan: { name: 'Yak Caravan', cost: 180 },
  takin_spirit: { name: 'Takin Spirit', cost: 250 },
  raven_guardian: { name: 'Raven Guardian', cost: 350 },
  mini_dzong: { name: 'Mini Dzong', cost: 500 },
  dochula_blessing: { name: 'Dochula Blessing', cost: 750 },
  festival_mask_dance: { name: 'Festival Mask Dance', cost: 1000 },
  punakha_fortress: { name: 'Punakha Fortress', cost: 1500 },
  tigers_nest: { name: "Tiger's Nest", cost: 2000 },
  royal_throne: { name: 'Royal Throne', cost: 3000 },
  golden_dragon: { name: 'Golden Dragon', cost: 5000 },
  himalayan_palace: { name: 'Himalayan Palace', cost: 8000 },
  kingdom_crown: { name: 'Kingdom Crown', cost: 12000 },
  dragon_emperor: { name: 'Dragon Emperor', cost: 18000 },
  druk_kingdom: { name: 'Druk Kingdom', cost: 25000 },
  golden_himalaya: { name: 'Golden Himalaya', cost: 40000 },
  sky_dragon: { name: 'Sky Dragon', cost: 55000 },
  eternal_bhutan: { name: 'Eternal Bhutan', cost: 75000 },
  druk_universe: { name: 'Druk Universe', cost: 100000 },
};

export const sendGift = onCall<{
  contextType: 'video' | 'liveStream';
  contextId: string;
  toUid: string;
  fromUsername: string;
  giftId: string;
}>(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const { contextType, contextId, toUid, fromUsername, giftId } = request.data;
  const fromUid = request.auth.uid;
  if (!contextId || !toUid) throw new HttpsError('invalid-argument', 'Missing contextId or toUid.');
  if (contextType !== 'video' && contextType !== 'liveStream') {
    throw new HttpsError('invalid-argument', 'Unknown contextType.');
  }
  if (fromUid === toUid) throw new HttpsError('failed-precondition', "Can't gift yourself.");
  const gift = GIFT_CATALOG[giftId];
  if (!gift) throw new HttpsError('invalid-argument', 'Unknown giftId.');

  const collectionName = contextType === 'video' ? 'videos' : 'liveStreams';
  const senderWalletRef = db.doc(`wallets/${fromUid}`);
  const recipientWalletRef = db.doc(`wallets/${toUid}`);
  const senderTxRef = db.collection(`wallets/${fromUid}/transactions`).doc();
  const giftRef = db.collection(`${collectionName}/${contextId}/gifts`).doc();

  return db.runTransaction(async (tx) => {
    const senderSnap = await tx.get(senderWalletRef);
    const currentBalance = senderSnap.exists ? (senderSnap.data()?.balance as number) ?? 0 : 0;
    const nextBalance = currentBalance - gift.cost;
    if (nextBalance < 0) {
      throw new HttpsError('failed-precondition', 'Insufficient balance.');
    }

    const recipientSnap = await tx.get(recipientWalletRef);
    const currentDiamonds = recipientSnap.exists ? (recipientSnap.data()?.diamonds as number) ?? 0 : 0;

    tx.set(senderWalletRef, { balance: nextBalance }, { merge: true });
    tx.set(senderTxRef, { type: 'gift', label: `Sent ${gift.name}`, amount: -gift.cost, createdAt: Date.now() });
    tx.set(recipientWalletRef, { diamonds: currentDiamonds + gift.cost }, { merge: true });
    tx.set(giftRef, {
      fromUid,
      fromUsername: fromUsername || 'Someone',
      toUid,
      giftId,
      giftName: gift.name,
      amount: gift.cost,
      createdAt: Date.now(),
    });

    return { balance: nextBalance };
  });
});

// Maps App Store / Play Console product IDs to the coin amount they grant.
// 1 Coin = Nu. 1 (Bhutanese Ngultrum), so e.g. 'com.flixa.coins.1000' should
// be priced at Nu. 1,000 in App Store Connect / Play Console. Configure
// matching products with these IDs there, or edit this map to match the
// IDs you create there.
const TOPUP_PRODUCTS: Record<string, number> = {
  'com.flixa.coins.1000': 1000,
  'com.flixa.coins.5000': 5000,
  'com.flixa.coins.12000': 12000,
};

/**
 * Credits a wallet after a real in-app purchase. This is a structural stub:
 * it enforces the one-purchase-token-used-once invariant and the
 * product -> coin-amount mapping, but the actual signature/receipt
 * verification calls against Apple's App Store Server API and Google's
 * Play Developer API are not implemented here — they need this project's
 * App Store Connect / Google Cloud service-account credentials, which
 * only the app owner can provision (see functions/README.md).
 */
export const verifyTopupPurchase = onCall<{
  platform: 'ios' | 'android';
  productId: string;
  purchaseToken: string;
}>(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const { platform, productId, purchaseToken } = request.data;

  const coinAmount = TOPUP_PRODUCTS[productId];
  if (!coinAmount) throw new HttpsError('invalid-argument', 'Unknown product ID.');

  const processedRef = db.doc(`processedPurchases/${purchaseToken}`);
  const alreadyProcessed = await processedRef.get();
  if (alreadyProcessed.exists) {
    throw new HttpsError('already-exists', 'This purchase was already credited.');
  }

  // TODO: verify `purchaseToken` against Apple's App Store Server API
  // (platform === 'ios') or Google's Play Developer API
  // (platform === 'android') before crediting. Without this call, any
  // client could fabricate a purchaseToken and grant itself coins.
  throw new HttpsError(
    'unimplemented',
    'Receipt verification is not configured yet — see functions/README.md.'
  );

  // Once verification is wired up, the flow is:
  // await processedRef.set({ uid: request.auth.uid, productId, createdAt: Date.now() });
  // return applyWalletDelta(request.auth.uid, coinAmount, 'topup', `Top Up (${coinAmount})`);
});

// LiveKit credentials never reach the client — they're bound to this
// function via secrets (set with `firebase functions:secrets:set`) and
// used here to mint a short-lived, per-user join token. The room name is
// the liveStreams/{id} document id, so one Firestore doc maps to one
// LiveKit room.
const livekitApiKey = defineSecret('LIVEKIT_API_KEY');
const livekitApiSecret = defineSecret('LIVEKIT_API_SECRET');
const livekitUrl = defineSecret('LIVEKIT_URL');

export const getLiveKitToken = onCall<{ roomName: string; canPublish: boolean }>(
  { secrets: [livekitApiKey, livekitApiSecret, livekitUrl] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    const { roomName, canPublish } = request.data;
    if (!roomName) throw new HttpsError('invalid-argument', 'Missing roomName.');

    // A client can ask for a publish-capable token, but only the stream's
    // host or an accepted co-host actually gets one — otherwise anyone
    // signed in could self-grant camera/mic publish into someone else's
    // room. Membership in the coHosts subcollection is exactly what the
    // host grants by accepting a guestRequests doc (see firestore.rules).
    let grantPublish = false;
    if (canPublish) {
      const streamSnap = await db.doc(`liveStreams/${roomName}`).get();
      const hostUid = streamSnap.exists ? (streamSnap.data()?.hostUid as string | undefined) : undefined;
      if (hostUid === request.auth.uid) {
        grantPublish = true;
      } else {
        const coHostSnap = await db.doc(`liveStreams/${roomName}/coHosts/${request.auth.uid}`).get();
        grantPublish = coHostSnap.exists;
      }
      if (!grantPublish) {
        throw new HttpsError('permission-denied', 'Not authorized to publish in this stream.');
      }
    }

    const at = new AccessToken(livekitApiKey.value(), livekitApiSecret.value(), {
      identity: request.auth.uid,
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: grantPublish, canSubscribe: true });
    const token = await at.toJwt();

    return { token, serverUrl: livekitUrl.value() };
  }
);

// Ends a guest's on-stage connection at the LiveKit (SFU) level, not just
// in Firestore — without this, removing the coHosts doc alone would stop
// new tokens from granting publish, but wouldn't disconnect a track the
// guest is already sending. Callable by the host (kicking someone) or by
// the guest themselves (leaving); either way the coHosts doc is cleaned
// up here too so both sides of the app state stay in sync.
export const removeLiveGuest = onCall<{ roomName: string; uid: string }>(
  { secrets: [livekitApiKey, livekitApiSecret, livekitUrl] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    const { roomName, uid } = request.data;
    if (!roomName || !uid) throw new HttpsError('invalid-argument', 'Missing roomName or uid.');

    const streamSnap = await db.doc(`liveStreams/${roomName}`).get();
    if (!streamSnap.exists) throw new HttpsError('not-found', 'Stream not found.');
    const hostUid = streamSnap.data()?.hostUid as string | undefined;
    if (request.auth.uid !== hostUid && request.auth.uid !== uid) {
      throw new HttpsError('permission-denied', 'Only the host or the guest themselves can do this.');
    }

    const roomService = new RoomServiceClient(livekitUrl.value(), livekitApiKey.value(), livekitApiSecret.value());
    await roomService.removeParticipant(roomName, uid).catch(() => {
      // Already disconnected (e.g. they left on their own) — not an error.
    });
    await db.doc(`liveStreams/${roomName}/coHosts/${uid}`).delete();
  }
);
