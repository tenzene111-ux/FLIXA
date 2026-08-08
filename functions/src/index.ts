import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

initializeApp();
const db = getFirestore();

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
// coin movement).
const GIFT_COST = 500;
const GIFT_DIAMONDS = 500; // 1:1 coins-to-diamonds; real platforms take a cut, this doesn't yet.

export const sendGift = onCall<{
  contextType: 'video' | 'liveStream';
  contextId: string;
  toUid: string;
  fromUsername: string;
}>(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const { contextType, contextId, toUid, fromUsername } = request.data;
  const fromUid = request.auth.uid;
  if (!contextId || !toUid) throw new HttpsError('invalid-argument', 'Missing contextId or toUid.');
  if (contextType !== 'video' && contextType !== 'liveStream') {
    throw new HttpsError('invalid-argument', 'Unknown contextType.');
  }
  if (fromUid === toUid) throw new HttpsError('failed-precondition', "Can't gift yourself.");

  const collectionName = contextType === 'video' ? 'videos' : 'liveStreams';
  const senderWalletRef = db.doc(`wallets/${fromUid}`);
  const recipientWalletRef = db.doc(`wallets/${toUid}`);
  const senderTxRef = db.collection(`wallets/${fromUid}/transactions`).doc();
  const giftRef = db.collection(`${collectionName}/${contextId}/gifts`).doc();

  return db.runTransaction(async (tx) => {
    const senderSnap = await tx.get(senderWalletRef);
    const currentBalance = senderSnap.exists ? (senderSnap.data()?.balance as number) ?? 0 : 0;
    const nextBalance = currentBalance - GIFT_COST;
    if (nextBalance < 0) {
      throw new HttpsError('failed-precondition', 'Insufficient balance.');
    }

    const recipientSnap = await tx.get(recipientWalletRef);
    const currentDiamonds = recipientSnap.exists ? (recipientSnap.data()?.diamonds as number) ?? 0 : 0;

    tx.set(senderWalletRef, { balance: nextBalance }, { merge: true });
    tx.set(senderTxRef, { type: 'gift', label: 'Gift Sent', amount: -GIFT_COST, createdAt: Date.now() });
    tx.set(recipientWalletRef, { diamonds: currentDiamonds + GIFT_DIAMONDS }, { merge: true });
    tx.set(giftRef, {
      fromUid,
      fromUsername: fromUsername || 'Someone',
      amount: GIFT_DIAMONDS,
      createdAt: Date.now(),
    });

    return { balance: nextBalance };
  });
});

// Maps App Store / Play Console product IDs to the coin amount they grant.
// Configure matching products with these IDs in App Store Connect and the
// Play Console, or edit this map to match the IDs you create there.
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
