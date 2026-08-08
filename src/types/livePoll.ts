import type { PollOption } from './poll';

export type LivePoll = {
  id: string;
  question: string;
  options: PollOption[];
  active: boolean;
  createdAt: number;
};
