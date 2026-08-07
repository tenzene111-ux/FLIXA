export type PollOption = {
  id: string;
  text: string;
};

export type Poll = {
  question: string;
  options: PollOption[];
};
