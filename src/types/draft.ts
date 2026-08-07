import type { VideoOverlay } from './post';

export type Draft = {
  id: string;
  videoUri: string;
  thumbnailUri: string;
  caption: string;
  trimStart: number;
  trimEnd: number | null;
  overlays: VideoOverlay[];
  musicTitle: string;
  createdAt: number;
};
