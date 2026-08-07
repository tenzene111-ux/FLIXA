import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';

initializeApp();
const db = getFirestore();

// Wallets are server-authoritative (see firestore.rules), so the wallet
// document itself has to be created server-side too, the moment a user
// profile is created client-side.
export const initWalletOnUserCreate = onDocumentCreated('users/{uid}', async (event) => {
  const uid = event.params.uid;
  await db.doc(`wallets/${uid}`).set({ balance: 0 }, { merge: true });
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
