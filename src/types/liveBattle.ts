export type LiveBattleStatus = 'inviting' | 'active' | 'ended';

export type LiveBattle = {
  opponentUid: string;
  opponentUsername: string;
  status: LiveBattleStatus;
  durationSec: number;
  startedAt: number | null;
  endsAt: number | null;
  winnerUid: string | null;
};
