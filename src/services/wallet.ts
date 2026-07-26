import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import type { WalletTransaction } from '../types/models';

function walletRef(uid: string) {
  return doc(db, 'wallets', uid);
}

export function subscribeWalletBalance(uid: string, onChange: (balance: number) => void) {
  return onSnapshot(walletRef(uid), (snap) => {
    onChange(snap.exists() ? (snap.data().balance as number) : 0);
  });
}

export function subscribeWalletTransactions(uid: string, onChange: (items: WalletTransaction[]) => void) {
  const q = query(collection(db, 'wallets', uid, 'transactions'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WalletTransaction, 'id'>) })));
  });
}

/**
 * Wallet balance is server-authoritative: the client can only read it.
 * Every credit/debit is a Cloud Function callable so a user can never
 * write their own balance directly through Firestore rules.
 */
export const claimReward = httpsCallable<{ reason: 'creator_reward' | 'referral_bonus' | 'refund' }, { balance: number }>(
  functions,
  'claimReward'
);

export const spendCoins = httpsCallable<{ item: 'live_gift' | 'video_boost' }, { balance: number }>(
  functions,
  'spendCoins'
);

export const verifyTopupPurchase = httpsCallable<
  { platform: 'ios' | 'android'; productId: string; purchaseToken: string },
  { balance: number }
>(functions, 'verifyTopupPurchase');
