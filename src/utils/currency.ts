// FLIXA's in-app coin is pegged 1:1 to the Bhutanese Ngultrum (Nu.),
// which itself is pegged 1:1 to the Indian Rupee. Keep this the single
// place that defines the rate so wallet/gift screens never disagree.
export const COIN_VALUE_NGULTRUM = 1;

export function coinsToNgultrum(coins: number): number {
  return coins * COIN_VALUE_NGULTRUM;
}

export function formatNgultrum(coins: number): string {
  return `Nu. ${coinsToNgultrum(coins).toLocaleString()}`;
}
