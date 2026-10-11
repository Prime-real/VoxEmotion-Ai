'use client';

import { AudioTrackMetadata } from '@/components/AudioWorkstationPlayer';
import { VoiceOption } from './tts-constants';

const DB_NAME = 'voxemotion_studio_db';
const DB_VERSION = 1;
const TRACKS_STORE = 'audio_tracks';
const VOICES_STORE = 'cloned_voices';
const PREVIEWS_STORE = 'audition_previews';

// Open IndexedDB with automated schema upgrade
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(TRACKS_STORE)) {
        db.createObjectStore(TRACKS_STORE, { keyPath: 'timestamp' });
      }
      if (!db.objectStoreNames.contains(VOICES_STORE)) {
        db.createObjectStore(VOICES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PREVIEWS_STORE)) {
        db.createObjectStore(PREVIEWS_STORE, { keyPath: 'cacheKey' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// --- Audio Tracks (High Capacity Async Storage) ---
export async function dbSaveTrack(track: AudioTrackMetadata): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS_STORE, 'readwrite');
      const store = tx.objectStore(TRACKS_STORE);
      const req = store.put({
        ...track,
        timestamp: track.timestamp || Date.now(),
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Graceful fallback to localStorage
    try {
      const stored = localStorage.getItem('voxemotion_audio_history_v1');
      const list = stored ? JSON.parse(stored) : [];
      const updated = [track, ...list.filter((t: any) => t.timestamp !== track.timestamp)].slice(0, 15);
      localStorage.setItem('voxemotion_audio_history_v1', JSON.stringify(updated));
    } catch {
      // ignore
    }
  }
}

export async function dbGetTracks(): Promise<AudioTrackMetadata[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS_STORE, 'readonly');
      const store = tx.objectStore(TRACKS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result as AudioTrackMetadata[];
        results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(results.slice(0, 100)); // Up to 100 high-res tracks
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback
    try {
      const stored = localStorage.getItem('voxemotion_audio_history_v1');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
}

export async function dbDeleteTrack(timestamp: number): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS_STORE, 'readwrite');
      const store = tx.objectStore(TRACKS_STORE);
      const req = store.delete(timestamp);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const stored = localStorage.getItem('voxemotion_audio_history_v1');
      if (stored) {
        const list = JSON.parse(stored).filter((t: any) => t.timestamp !== timestamp);
        localStorage.setItem('voxemotion_audio_history_v1', JSON.stringify(list));
      }
    } catch {
      // ignore
    }
  }
}

export async function dbClearTracks(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS_STORE, 'readwrite');
      const store = tx.objectStore(TRACKS_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    localStorage.removeItem('voxemotion_audio_history_v1');
  }
}

// --- Cloned Voices Async Storage ---
export async function dbSaveClonedVoice(voice: VoiceOption): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VOICES_STORE, 'readwrite');
      const store = tx.objectStore(VOICES_STORE);
      const req = store.put(voice);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const stored = localStorage.getItem('voxemotion_cloned_voices_v1');
      const list = stored ? JSON.parse(stored) : [];
      const updated = [voice, ...list.filter((v: any) => v.id !== voice.id)];
      localStorage.setItem('voxemotion_cloned_voices_v1', JSON.stringify(updated));
    } catch {
      // ignore
    }
  }
}

export async function dbGetClonedVoices(): Promise<VoiceOption[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VOICES_STORE, 'readonly');
      const store = tx.objectStore(VOICES_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as VoiceOption[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const stored = localStorage.getItem('voxemotion_cloned_voices_v1');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
}

export async function dbDeleteClonedVoice(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VOICES_STORE, 'readwrite');
      const store = tx.objectStore(VOICES_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const stored = localStorage.getItem('voxemotion_cloned_voices_v1');
      if (stored) {
        const list = JSON.parse(stored).filter((v: any) => v.id !== id);
        localStorage.setItem('voxemotion_cloned_voices_v1', JSON.stringify(list));
      }
    } catch {
      // ignore
    }
  }
}

// --- Client-Side Audition Cache (0ms Instant Playback) ---
export async function dbGetCachedAudition(cacheKey: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(PREVIEWS_STORE, 'readonly');
      const store = tx.objectStore(PREVIEWS_STORE);
      const req = store.get(cacheKey);
      req.onsuccess = () => resolve(req.result ? req.result.audioBase64 : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function dbSaveCachedAudition(cacheKey: string, audioBase64: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(PREVIEWS_STORE, 'readwrite');
    const store = tx.objectStore(PREVIEWS_STORE);
    store.put({ cacheKey, audioBase64, timestamp: Date.now() });
  } catch {
    // ignore
  }
}

// --- Auto-Download Exported Voice Configuration & Trigger ---
export type ExportFormat = 'wav' | 'mp3' | 'aac' | 'flac' | 'ogg';

export interface AutoDownloadConfig {
  enabled: boolean;
  format: ExportFormat;
  bitrate: '128k' | '192k' | '256k' | '320k';
}

const DEFAULT_AUTO_DOWNLOAD_CONFIG: AutoDownloadConfig = {
  enabled: false,
  format: 'wav',
  bitrate: '192k',
};

export function getAutoDownloadConfig(): AutoDownloadConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_AUTO_DOWNLOAD_CONFIG;
  }
  try {
    const raw = localStorage.getItem('voxemotion_auto_download_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: Boolean(parsed.enabled),
        format: parsed.format || 'wav',
        bitrate: parsed.bitrate || '192k',
      };
    }
  } catch {
    // fallback
  }
  return DEFAULT_AUTO_DOWNLOAD_CONFIG;
}

export function saveAutoDownloadConfig(config: AutoDownloadConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('voxemotion_auto_download_v1', JSON.stringify(config));
  } catch {
    // ignore
  }
}

/**
 * Triggers an immediate browser file download for a synthesized voice track.
 * Supports zero-latency client-side WAV blob conversion or backend transcoding (MP3, AAC, FLAC, OGG).
 */
export async function triggerAudioDownload(
  track: {
    audioBase64: string;
    mimeType?: string;
    voice?: string;
    language?: string;
    timestamp?: number;
  },
  format: ExportFormat = 'wav',
  bitrate: '128k' | '192k' | '256k' | '320k' = '192k'
): Promise<string> {
  if (!track.audioBase64) {
    throw new Error('No audio data available for download.');
  }

  const sanitizedTitle = (track.voice || 'vox')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');
  const sanitizedLang = (track.language || 'audio')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');
  const baseFilename = `voxemotion-${sanitizedTitle}-${sanitizedLang}-${track.timestamp || Date.now()}`;

  // Instant 0ms Client-Side WAV Blob Download
  if (format === 'wav') {
    const byteCharacters = atob(track.audioBase64);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([byteNumbers], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseFilename}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return `${baseFilename}.wav`;
  }

  // Transcoding via backend ffmpeg
  const res = await fetch('/api/tts/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64: track.audioBase64,
      format,
      bitrate,
      filename: baseFilename,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `Failed to convert audio to ${format.toUpperCase()}`);
  }

  const byteCharacters = atob(data.audioBase64);
  const byteNumbers = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], {
    type: data.mimeType || `audio/${format}`,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const targetFilename = data.filename || `${baseFilename}.${format}`;
  a.download = targetFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return targetFilename;
}
