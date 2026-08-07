import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { Draft } from '../types/draft';

function storageKey(uid: string) {
  return `flixa:drafts:${uid}`;
}

function draftsDir(uid: string) {
  return `${FileSystem.documentDirectory}drafts/${uid}/`;
}

async function ensureDir(uid: string): Promise<string> {
  const dir = draftsDir(uid);
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export async function listDrafts(uid: string): Promise<Draft[]> {
  const raw = await AsyncStorage.getItem(storageKey(uid));
  if (!raw) return [];
  const drafts = JSON.parse(raw) as Draft[];
  return drafts.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getDraft(uid: string, id: string): Promise<Draft | null> {
  const drafts = await listDrafts(uid);
  return drafts.find((draft) => draft.id === id) ?? null;
}

export async function saveDraft(
  uid: string,
  draft: Omit<Draft, 'id' | 'createdAt'>
): Promise<Draft> {
  const dir = await ensureDir(uid);
  const id = String(Date.now());
  const videoDest = `${dir}${id}.mp4`;
  const thumbDest = `${dir}${id}.jpg`;
  await FileSystem.copyAsync({ from: draft.videoUri, to: videoDest });
  await FileSystem.copyAsync({ from: draft.thumbnailUri, to: thumbDest });

  const newDraft: Draft = { ...draft, id, videoUri: videoDest, thumbnailUri: thumbDest, createdAt: Date.now() };
  const existing = await listDrafts(uid);
  await AsyncStorage.setItem(storageKey(uid), JSON.stringify([newDraft, ...existing]));
  return newDraft;
}

export async function deleteDraft(uid: string, id: string): Promise<void> {
  const existing = await listDrafts(uid);
  const target = existing.find((draft) => draft.id === id);
  const remaining = existing.filter((draft) => draft.id !== id);
  await AsyncStorage.setItem(storageKey(uid), JSON.stringify(remaining));
  if (target) {
    await FileSystem.deleteAsync(target.videoUri, { idempotent: true });
    await FileSystem.deleteAsync(target.thumbnailUri, { idempotent: true });
  }
}
