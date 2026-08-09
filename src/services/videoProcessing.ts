import { addDoc, collection, doc, DocumentData, onSnapshot, Timestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import type { VideoEditDecisionList, VideoJob } from '../types/videoEdit';

const VIDEO_JOBS_COLLECTION = 'videoJobs';

async function uploadFile(
  localUri: string,
  storagePath: string,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, blob, { contentType });

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes),
      reject,
      () => resolve()
    );
  });

  return storagePath;
}

// Returns the Storage *path* (not a download URL) — the video-processing
// Cloud Function downloads inputs via the Admin SDK using this path
// directly (see functions/src/video.ts), it never needs a signed URL.
export async function uploadRawClip(uid: string, localUri: string, onProgress?: (pct: number) => void): Promise<string> {
  return uploadFile(localUri, `rawClips/${uid}/${Date.now()}-${Math.round(Math.random() * 1e6)}.mp4`, 'video/mp4', onProgress);
}

// For Photo Mode / Templates clips — the onVideoJobCreate Cloud Function
// turns these into short synthetic video segments (see materializeImageClip
// in functions/src/video.ts) before the rest of its pipeline runs.
export async function uploadRawPhoto(uid: string, localUri: string, onProgress?: (pct: number) => void): Promise<string> {
  return uploadFile(localUri, `rawPhotos/${uid}/${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`, 'image/jpeg', onProgress);
}

export async function uploadSoundFile(
  uid: string,
  localUri: string,
  contentType: string,
  extension: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  return uploadFile(localUri, `soundUploads/${uid}/${Date.now()}.${extension}`, contentType, onProgress);
}

export async function createVideoJob(uid: string, edl: VideoEditDecisionList): Promise<string> {
  const jobRef = await addDoc(collection(db, VIDEO_JOBS_COLLECTION), {
    uid,
    status: 'queued',
    clips: edl.clips,
    rotationDeg: edl.rotationDeg,
    cropAspect: edl.cropAspect,
    color: edl.color,
    audio: edl.audio,
    outputStoragePath: null,
    outputUrl: null,
    outputDurationSec: null,
    error: null,
    createdAt: Date.now(),
  });
  return jobRef.id;
}

function mapVideoJob(id: string, data: DocumentData): VideoJob {
  return {
    id,
    uid: data.uid,
    status: data.status ?? 'queued',
    clips: data.clips ?? [],
    rotationDeg: data.rotationDeg ?? 0,
    cropAspect: data.cropAspect ?? '9:16',
    color: data.color,
    audio: data.audio,
    outputStoragePath: data.outputStoragePath ?? null,
    outputUrl: data.outputUrl ?? null,
    outputDurationSec: data.outputDurationSec ?? null,
    error: data.error ?? null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : (data.createdAt ?? Date.now()),
  };
}

export function subscribeToVideoJob(jobId: string, onChange: (job: VideoJob | null) => void) {
  return onSnapshot(doc(db, VIDEO_JOBS_COLLECTION, jobId), (snapshot) => {
    onChange(snapshot.exists() ? mapVideoJob(snapshot.id, snapshot.data()) : null);
  });
}

// Firebase Storage download URLs already work as plain fetchable https
// URLs (the Cloud Function mints one in the same format on completion —
// see uploadWithDownloadUrl in functions/src/video.ts), so this is only
// needed if a client ever has a Storage ref and wants the URL directly.
export async function getStorageDownloadUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath));
}
