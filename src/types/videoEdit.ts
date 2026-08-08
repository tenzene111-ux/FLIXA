export type VideoTransition = 'none' | 'fade' | 'zoom' | 'slide' | 'swipe' | 'blur' | 'flash' | 'spin' | 'morph';

export const VIDEO_TRANSITIONS: VideoTransition[] = ['none', 'fade', 'zoom', 'slide', 'swipe', 'blur', 'flash', 'spin', 'morph'];

export type ClipKind = 'video' | 'image';

export type VideoClipEdit = {
  kind: ClipKind;
  storagePath: string;
  trimStartSec: number;
  trimEndSec: number | null;
  // Only meaningful for kind: 'image' — how long the still frame is shown
  // before the server turns it into a synthetic clip. Ignored for video.
  durationSec?: number;
  // Only meaningful for kind: 'image' — applies a slow zoom over the
  // still's display duration.
  kenBurns?: boolean;
  speed: number;
  reversed: boolean;
  transitionToNext: VideoTransition;
};

export function defaultClipEdit(storagePath: string): VideoClipEdit {
  return {
    kind: 'video',
    storagePath,
    trimStartSec: 0,
    trimEndSec: null,
    speed: 1,
    reversed: false,
    transitionToNext: 'none',
  };
}

export function defaultImageClipEdit(storagePath: string, durationSec: number, transitionToNext: VideoTransition = 'fade'): VideoClipEdit {
  return {
    kind: 'image',
    storagePath,
    trimStartSec: 0,
    trimEndSec: durationSec,
    durationSec,
    kenBurns: true,
    speed: 1,
    reversed: false,
    transitionToNext,
  };
}

// What VideoEditorScreen accepts as raw input, before any per-clip edit
// decisions exist yet — satisfied directly by MultiClipCamera's
// RecordedClip (kind/kenBurns default to 'video'/false) and by the
// clip lists PhotoModeScreen builds from picked photos.
export type EditorInputClip = {
  uri: string;
  durationSec: number;
  speed: number;
  kind?: ClipKind;
  kenBurns?: boolean;
  transitionToNext?: VideoTransition;
};

export type ColorAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  vignette: number;
  grain: number;
};

export const DEFAULT_COLOR_ADJUSTMENTS: ColorAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  vignette: 0,
  grain: 0,
};

export type VideoJobAudio = {
  keepOriginal: boolean;
  originalVolume: number;
  musicStoragePath: string | null;
  musicVolume: number;
  musicStartSec: number;
  voiceoverStoragePath: string | null;
  voiceoverVolume: number;
};

export const DEFAULT_JOB_AUDIO: VideoJobAudio = {
  keepOriginal: true,
  originalVolume: 1,
  musicStoragePath: null,
  musicVolume: 0.6,
  musicStartSec: 0,
  voiceoverStoragePath: null,
  voiceoverVolume: 1,
};

export type CropAspect = '9:16' | '1:1' | '16:9' | '4:5' | 'original';

export type VideoJobStatus = 'queued' | 'processing' | 'complete' | 'failed';

export type VideoJob = {
  id: string;
  uid: string;
  status: VideoJobStatus;
  clips: VideoClipEdit[];
  rotationDeg: 0 | 90 | 180 | 270;
  cropAspect: CropAspect;
  color: ColorAdjustments;
  audio: VideoJobAudio;
  outputStoragePath: string | null;
  outputUrl: string | null;
  outputDurationSec: number | null;
  error: string | null;
  createdAt: number;
};

export type VideoEditDecisionList = {
  clips: VideoClipEdit[];
  rotationDeg: 0 | 90 | 180 | 270;
  cropAspect: CropAspect;
  color: ColorAdjustments;
  audio: VideoJobAudio;
};
