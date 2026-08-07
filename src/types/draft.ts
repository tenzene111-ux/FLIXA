import type { VideoOverlay } from './post';
import type { Poll } from './poll';

export type Draft = {
  id: string;
  videoUri: string;
  thumbnailUri: string;
  caption: string;
  trimStart: number;
  trimEnd: number | null;
  overlays: VideoOverlay[];
  musicTitle: string;
  poll: Poll | null;
  createdAt: number;
};
