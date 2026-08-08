import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

const execFileAsync = promisify(execFile);

// Cloud Functions modules can be require()'d before functions/src/index.ts
// runs initializeApp() if imported at the top of that file — these are
// called lazily inside the handler instead of at module load time so
// admin is guaranteed to already be initialized by the time they run.
function db() {
  return getFirestore();
}
function bucket() {
  return getStorage().bucket();
}

export type VideoTransition = 'none' | 'fade' | 'zoom' | 'slide' | 'swipe' | 'blur' | 'flash' | 'spin' | 'morph';

// ffmpeg's xfade filter doesn't have a literal "spin" transition; circleopen
// is the closest built-in look. Everything else maps to a real xfade name.
const XFADE_TRANSITIONS: Record<Exclude<VideoTransition, 'none'>, string> = {
  fade: 'fade',
  zoom: 'zoomin',
  slide: 'slideleft',
  swipe: 'wipeleft',
  blur: 'hblur',
  flash: 'fadewhite',
  spin: 'circleopen',
  morph: 'dissolve',
};

type VideoClipEdit = {
  storagePath: string;
  trimStartSec: number;
  trimEndSec: number | null;
  speed: number;
  reversed: boolean;
  transitionToNext: VideoTransition;
};

type ColorAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  vignette: number;
  grain: number;
};

type VideoJobAudio = {
  keepOriginal: boolean;
  originalVolume: number;
  musicStoragePath: string | null;
  musicVolume: number;
  musicStartSec: number;
  voiceoverStoragePath: string | null;
  voiceoverVolume: number;
};

type CropAspect = '9:16' | '1:1' | '16:9' | '4:5' | 'original';

type VideoJobDoc = {
  uid: string;
  clips: VideoClipEdit[];
  rotationDeg: 0 | 90 | 180 | 270;
  cropAspect: CropAspect;
  color: ColorAdjustments;
  audio: VideoJobAudio;
};

const TARGET_FPS = 30;
const MAX_OUTPUT_WIDTH = 1080;
const TRANSITION_DURATION_SEC = 0.4;

async function runFfmpeg(args: string[]): Promise<void> {
  await execFileAsync(ffmpegPath as unknown as string, ['-y', '-loglevel', 'error', ...args], {
    maxBuffer: 1024 * 1024 * 32,
  });
}

async function probeDurationSec(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync(ffprobeStatic.path, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const seconds = parseFloat(stdout.trim());
  return Number.isFinite(seconds) ? seconds : 0;
}

function escapeExprCommas(expr: string): string {
  return expr.replace(/,/g, '\\,');
}

// atempo only accepts 0.5-2.0 per instance; chain multiple stages for
// speeds outside that range (e.g. 4x -> atempo=2.0,atempo=2.0).
function buildAtempoChain(speed: number): string {
  const stages: number[] = [];
  let remaining = speed;
  while (remaining > 2.0 + 1e-6) {
    stages.push(2.0);
    remaining /= 2.0;
  }
  while (remaining < 0.5 - 1e-6) {
    stages.push(0.5);
    remaining /= 0.5;
  }
  stages.push(remaining);
  return stages.map((s) => `atempo=${s.toFixed(6)}`).join(',');
}

function buildCropFilter(aspect: CropAspect): string | null {
  if (aspect === 'original') return null;
  const [wRatio, hRatio] = aspect.split(':').map(Number);
  const targetRatio = wRatio / hRatio;
  const w = escapeExprCommas(`if(gt(iw/ih,${targetRatio}),ih*${targetRatio},iw)`);
  const h = escapeExprCommas(`if(gt(iw/ih,${targetRatio}),ih,iw/${targetRatio})`);
  return `crop=${w}:${h}`;
}

function buildColorFilters(color: ColorAdjustments): string[] {
  const filters: string[] = [];
  const contrastValue = 1 + Math.max(-1, Math.min(1, color.contrast));
  const saturationValue = 1 + Math.max(-1, Math.min(1, color.saturation));
  const brightnessValue = Math.max(-1, Math.min(1, color.brightness));
  if (brightnessValue !== 0 || contrastValue !== 1 || saturationValue !== 1) {
    filters.push(`eq=brightness=${brightnessValue.toFixed(3)}:contrast=${contrastValue.toFixed(3)}:saturation=${saturationValue.toFixed(3)}`);
  }
  if (color.temperature !== 0) {
    // UI: -1 (cool) .. +1 (warm). Neutral is 6500K; warmer looks use a
    // lower correlated color temperature, cooler looks use a higher one.
    const kelvin = Math.round(6500 - Math.max(-1, Math.min(1, color.temperature)) * 3500);
    filters.push(`colortemperature=temperature=${kelvin}`);
  }
  if (color.vignette > 0) {
    const angle = (Math.PI / 5) * (1 - Math.min(1, color.vignette) * 0.6);
    filters.push(`vignette=${angle.toFixed(4)}`);
  }
  if (color.grain > 0) {
    const strength = Math.round(Math.min(1, color.grain) * 40);
    filters.push(`noise=alls=${strength}:allf=t+u`);
  }
  return filters;
}

function buildRotationFilter(rotationDeg: 0 | 90 | 180 | 270): string | null {
  switch (rotationDeg) {
    case 90:
      return 'transpose=1';
    case 180:
      return 'hflip,vflip';
    case 270:
      return 'transpose=2';
    default:
      return null;
  }
}

async function downloadFromStorage(storagePath: string, localPath: string): Promise<void> {
  await bucket().file(storagePath).download({ destination: localPath });
}

// Uploads with a firebaseStorageDownloadTokens metadata token so the
// resulting URL works exactly like a client-uploaded file's
// getDownloadURL() result — the app's <Video>/<Image> components already
// consume plain https download URLs in this format everywhere else.
async function uploadWithDownloadUrl(localPath: string, storagePath: string, contentType: string): Promise<string> {
  const token = randomUUID();
  const gcsBucket = bucket();
  await gcsBucket.upload(localPath, {
    destination: storagePath,
    metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } },
  });
  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${gcsBucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}

async function processVideoJob(jobId: string, job: VideoJobDoc): Promise<{ outputStoragePath: string; outputUrl: string; durationSec: number }> {
  const workDir = path.join(os.tmpdir(), `videojob-${jobId}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    if (job.clips.length === 0) throw new Error('No clips in job.');

    // 1. Download + probe every raw clip.
    const clipFiles = await Promise.all(
      job.clips.map(async (clip, index) => {
        const localPath = path.join(workDir, `clip${index}.mp4`);
        await downloadFromStorage(clip.storagePath, localPath);
        const sourceDuration = await probeDurationSec(localPath);
        return { clip, localPath, sourceDuration };
      })
    );

    // 2. Per-clip filter chains (trim, reverse, speed, lock to constant
    // frame rate — required by xfade/concat downstream).
    const filterLines: string[] = [];
    const clipOutputDurations: number[] = [];
    clipFiles.forEach(({ clip, sourceDuration }, index) => {
      const start = Math.max(0, Math.min(clip.trimStartSec, sourceDuration));
      const end = Math.max(start + 0.05, Math.min(clip.trimEndSec ?? sourceDuration, sourceDuration));
      const speed = Math.max(0.25, Math.min(4, clip.speed || 1));
      const outputDuration = (end - start) / speed;
      clipOutputDurations.push(outputDuration);

      const videoOps = [`trim=start=${start.toFixed(3)}:end=${end.toFixed(3)}`, 'setpts=PTS-STARTPTS'];
      const audioOps = [`atrim=start=${start.toFixed(3)}:end=${end.toFixed(3)}`, 'asetpts=PTS-STARTPTS'];
      if (clip.reversed) {
        videoOps.push('reverse');
        audioOps.push('areverse');
      }
      if (Math.abs(speed - 1) > 1e-3) {
        videoOps.push(`setpts=${(1 / speed).toFixed(6)}*PTS`);
        audioOps.push(buildAtempoChain(speed));
      }
      videoOps.push(`fps=${TARGET_FPS}`);
      filterLines.push(`[${index}:v]${videoOps.join(',')}[v${index}]`);
      filterLines.push(`[${index}:a]${audioOps.join(',')}[a${index}]`);
    });

    // 3. Join clips: a plain concat if nobody asked for a transition,
    // otherwise a chained xfade/acrossfade with a clamped crossfade
    // duration so short clips can't make the filter error out.
    const hasTransitions = job.clips.slice(0, -1).some((clip) => clip.transitionToNext !== 'none');
    let videoOutLabel: string;
    let audioOutLabel: string;
    // Tracks the real, running output duration as clips are joined — used
    // below to know how much of the music/voiceover track to grab. For the
    // plain-concat path this is just the sum of every clip's duration.
    let totalOutputDuration = clipOutputDurations.reduce((sum, d) => sum + d, 0);

    if (!hasTransitions) {
      const n = clipFiles.length;
      const pairs = clipFiles.map((_, i) => `[v${i}][a${i}]`).join('');
      filterLines.push(`${pairs}concat=n=${n}:v=1:a=1[vconcat][aconcat]`);
      videoOutLabel = 'vconcat';
      audioOutLabel = 'aconcat';
    } else {
      let cumulative = clipOutputDurations[0];
      let prevV = 'v0';
      let prevA = 'a0';
      for (let i = 0; i < clipFiles.length - 1; i++) {
        const transition = job.clips[i].transitionToNext;
        const xfadeName = transition === 'none' ? 'fade' : XFADE_TRANSITIONS[transition];
        const dur = Math.max(0.05, Math.min(TRANSITION_DURATION_SEC, clipOutputDurations[i] * 0.4, clipOutputDurations[i + 1] * 0.4));
        const offset = Math.max(0, cumulative - dur);
        const outV = i === clipFiles.length - 2 ? 'vconcat' : `vx${i}`;
        const outA = i === clipFiles.length - 2 ? 'aconcat' : `ax${i}`;
        filterLines.push(`[${prevV}][v${i + 1}]xfade=transition=${xfadeName}:duration=${dur.toFixed(3)}:offset=${offset.toFixed(3)}[${outV}]`);
        filterLines.push(`[${prevA}][a${i + 1}]acrossfade=d=${dur.toFixed(3)}[${outA}]`);
        cumulative = cumulative - dur + clipOutputDurations[i + 1];
        prevV = outV;
        prevA = outA;
      }
      videoOutLabel = 'vconcat';
      audioOutLabel = 'aconcat';
      totalOutputDuration = cumulative;
    }

    // 4. Global video chain: rotation -> crop -> color -> scale.
    const globalOps: string[] = [];
    const rotationFilter = buildRotationFilter(job.rotationDeg);
    if (rotationFilter) globalOps.push(rotationFilter);
    const cropFilter = buildCropFilter(job.cropAspect);
    if (cropFilter) globalOps.push(cropFilter);
    globalOps.push(...buildColorFilters(job.color));
    globalOps.push(`scale='min(${MAX_OUTPUT_WIDTH},iw)':-2`, 'setsar=1');
    filterLines.push(`[${videoOutLabel}]${globalOps.join(',')}[vfinal]`);

    // 5. Audio mix: concatenated original (optional) + music (optional) +
    // voiceover (optional). Extra ffmpeg inputs start after the clips.
    const extraInputs: { path: string; kind: 'music' | 'voiceover' }[] = [];
    if (job.audio.musicStoragePath) extraInputs.push({ path: job.audio.musicStoragePath, kind: 'music' });
    if (job.audio.voiceoverStoragePath) extraInputs.push({ path: job.audio.voiceoverStoragePath, kind: 'voiceover' });

    const extraLocalFiles = await Promise.all(
      extraInputs.map(async (input, i) => {
        const localPath = path.join(workDir, `extra${i}.m4a`);
        await downloadFromStorage(input.path, localPath);
        return { ...input, localPath, inputIndex: clipFiles.length + i };
      })
    );

    const mixInputs: string[] = [];
    if (job.audio.keepOriginal || extraLocalFiles.length === 0) {
      const vol = Math.max(0, Math.min(2, job.audio.originalVolume ?? 1));
      filterLines.push(`[${audioOutLabel}]volume=${vol.toFixed(3)}[origvol]`);
      mixInputs.push('origvol');
    }
    for (const extra of extraLocalFiles) {
      const label = extra.kind;
      const vol = Math.max(0, Math.min(2, extra.kind === 'music' ? job.audio.musicVolume : job.audio.voiceoverVolume));
      const startSec = extra.kind === 'music' ? Math.max(0, job.audio.musicStartSec || 0) : 0;
      const endSec = startSec + Math.max(0.1, totalOutputDuration);
      filterLines.push(
        `[${extra.inputIndex}:a]atrim=start=${startSec.toFixed(3)}:end=${endSec.toFixed(3)},asetpts=PTS-STARTPTS,volume=${vol.toFixed(3)}[${label}]`
      );
      mixInputs.push(label);
    }

    let audioFinalLabel: string;
    if (mixInputs.length <= 1) {
      audioFinalLabel = mixInputs[0] ?? audioOutLabel;
    } else {
      filterLines.push(`${mixInputs.map((l) => `[${l}]`).join('')}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=0[afinal]`);
      audioFinalLabel = 'afinal';
    }

    // 6. Run ffmpeg.
    const inputArgs: string[] = [];
    clipFiles.forEach(({ localPath }) => inputArgs.push('-i', localPath));
    extraLocalFiles.forEach(({ localPath }) => inputArgs.push('-i', localPath));

    const outputPath = path.join(workDir, 'output.mp4');
    const filterComplex = filterLines.join(';\n');
    await runFfmpeg([
      ...inputArgs,
      '-filter_complex',
      filterComplex,
      '-map',
      '[vfinal]',
      '-map',
      `[${audioFinalLabel}]`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      '-r',
      String(TARGET_FPS),
      outputPath,
    ]);

    const durationSec = await probeDurationSec(outputPath);
    const outputStoragePath = `processedVideos/${job.uid}/${jobId}.mp4`;
    const outputUrl = await uploadWithDownloadUrl(outputPath, outputStoragePath, 'video/mp4');

    return { outputStoragePath, outputUrl, durationSec };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export const onVideoJobCreate = onDocumentCreated(
  { document: 'videoJobs/{jobId}', memory: '2GiB', timeoutSeconds: 540 },
  async (event) => {
    const jobId = event.params.jobId;
    const job = event.data?.data() as VideoJobDoc | undefined;
    if (!job) return;

    const jobRef = db().doc(`videoJobs/${jobId}`);
    await jobRef.update({ status: 'processing' });

    try {
      const result = await processVideoJob(jobId, job);
      await jobRef.update({
        status: 'complete',
        outputStoragePath: result.outputStoragePath,
        outputUrl: result.outputUrl,
        outputDurationSec: result.durationSec,
        processedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      logger.error('Video job failed', { jobId, error });
      await jobRef.update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Processing failed.',
      });
    }
  }
);
