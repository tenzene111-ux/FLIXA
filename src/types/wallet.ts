export type WalletTransactionType = 'topup' | 'gift' | 'reward' | 'refund';

export type WalletTransaction = {
  id: string;
  type: WalletTransactionType;
  label: string;
  amount: number;
  createdAt: number;
};
