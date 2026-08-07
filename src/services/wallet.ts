import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import type { WalletTransaction } from '../types/wallet';

const TRANSACTIONS_LIMIT = 100;

function walletRef(uid: string) {
  return doc(db, 'wallets', uid);
}

export function subscribeToWalletBalance(uid: string, onChange: (balance: number) => void) {
  return onSnapshot(walletRef(uid), (snapshot) => {
    onChange(snapshot.exists() ? ((snapshot.data().balance as number) ?? 0) : 0);
  });
}

export function subscribeToWalletTransactions(uid: string, onChange: (items: WalletTransaction[]) => void) {
  const transactionsQuery = query(
    collection(db, 'wallets', uid, 'transactions'),
    orderBy('createdAt', 'desc'),
    limit(TRANSACTIONS_LIMIT)
  );
  return onSnapshot(transactionsQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<WalletTransaction, 'id'>) })));
  });
}

// Wallet balance is server-authoritative — Firestore rules block any client
// write to `wallets/*`. Every credit/debit goes through one of these
// Cloud Function callables (see functions/src/index.ts), which enforce
// fixed amounts a client can't self-report.
export const claimReward = httpsCallable<
  { reason: 'creator_reward' | 'referral_bonus' | 'refund' },
  { balance: number }
>(functions, 'claimReward');

export const spendCoins = httpsCallable<{ item: 'live_gift' | 'video_boost' }, { balance: number }>(
  functions,
  'spendCoins'
);
