import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Meal photos live in a private Supabase Storage bucket, one folder per
 * user. A meal's `imageDatas` holds small references ("sb:<path>") instead
 * of the multi-KB base64 images that used to be stored inline (and made
 * every load download every photo). Inline data URLs are still understood
 * everywhere: older rows not migrated yet, photos taken offline that haven't
 * been uploaded, and backups.
 */
export const PHOTO_BUCKET = 'meal-photos';
const REF_PREFIX = 'sb:';

export const isStorageRef = (s: string) => s.startsWith(REF_PREFIX);
export const isDataUrl = (s: string) => s.startsWith('data:');
const refToPath = (ref: string) => ref.slice(REF_PREFIX.length);

const bucket = () => supabase.storage.from(PHOTO_BUCKET);

// Set once the bucket turns out not to exist (schema.sql not re-run yet):
// photos then stay inline, exactly as before.
let bucketMissing = false;
export const photoStorageAvailable = () => !bucketMissing;
/** For tests. */
export function resetPhotoStorageState() {
  bucketMissing = false;
  urlCache = null;
}

function isBucketMissing(error: unknown): boolean {
  const e = error as { message?: string; statusCode?: string; status?: number } | null;
  return !!e && /bucket not found/i.test(e.message ?? '');
}

function randomId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string } {
  const comma = dataUrl.indexOf(',');
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? 'image/jpeg';
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mime }), mime };
}

type UploadResult = { ok: true; ref: string } | { ok: false; reason: 'unavailable' | 'failed' };

export async function uploadPhoto(userId: string, dataUrl: string): Promise<UploadResult> {
  if (bucketMissing) return { ok: false, reason: 'unavailable' };
  const { blob, mime } = dataUrlToBlob(dataUrl);
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const path = `${userId}/${randomId()}.${ext}`;
  // Paths are never reused, so the image can be cached for good.
  const { error } = await bucket().upload(path, blob, { contentType: mime, cacheControl: '31536000', upsert: false });
  if (!error) return { ok: true, ref: REF_PREFIX + path };
  if (isBucketMissing(error)) {
    bucketMissing = true;
    return { ok: false, reason: 'unavailable' };
  }
  console.error('Failed to upload meal photo', error);
  return { ok: false, reason: 'failed' };
}

/**
 * Uploads any inline photos and returns the list with references in their
 * place. Without the bucket they stay inline. Returns null if an upload
 * failed (e.g. offline) so the save can be retried — unless
 * `keepInlineOnFailure`, which keeps that photo inline instead.
 */
export async function storeInlinePhotos(
  userId: string,
  photos: string[],
  { keepInlineOnFailure = false } = {},
): Promise<string[] | null> {
  const out: string[] = [];
  for (const p of photos) {
    if (!isDataUrl(p)) { out.push(p); continue; }
    const res = await uploadPhoto(userId, p);
    if (res.ok) out.push(res.ref);
    else if (res.reason === 'unavailable' || keepInlineOnFailure) out.push(p);
    else return null;
  }
  return out;
}

/** Removes every photo in the user's folder (for "Clear all data"). */
export async function deleteAllPhotos(userId: string): Promise<boolean> {
  if (bucketMissing) return true;
  for (;;) {
    const { data, error } = await bucket().list(userId, { limit: 100 });
    if (error) {
      if (isBucketMissing(error)) { bucketMissing = true; return true; }
      console.error('Failed to list meal photos', error);
      return false;
    }
    if (!data || data.length === 0) return true;
    const { error: rmError } = await bucket().remove(data.map((f) => `${userId}/${f.name}`));
    if (rmError) {
      console.error('Failed to delete meal photos', rmError);
      return false;
    }
    if (data.length < 100) return true;
  }
}

// ---- Display: short-lived signed URLs, cached so the browser's image cache
// (keyed by the full URL) keeps working across launches.

const URL_CACHE_KEY = 'calorie_tracker_photo_urls';
const SIGNED_URL_SECONDS = 7 * 24 * 3600;
const REUSE_MARGIN_MS = 24 * 3600 * 1000;
const MAX_CACHED_URLS = 3000;

let urlCache: Map<string, { url: string; exp: number }> | null = null;

function cache() {
  if (urlCache) return urlCache;
  urlCache = new Map();
  try {
    const raw = localStorage.getItem(URL_CACHE_KEY);
    const entries = raw ? (JSON.parse(raw) as [string, { url: string; exp: number }][]) : [];
    const now = Date.now();
    for (const [ref, v] of entries) if (v.exp - REUSE_MARGIN_MS > now) urlCache.set(ref, v);
  } catch {
    // start empty
  }
  return urlCache;
}

function persistCache() {
  try {
    const entries = [...cache().entries()].slice(-MAX_CACHED_URLS);
    localStorage.setItem(URL_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // best-effort
  }
}

export function cachedPhotoUrl(src: string): string | null {
  if (!isStorageRef(src)) return src;
  const hit = cache().get(src);
  return hit && hit.exp - REUSE_MARGIN_MS > Date.now() ? hit.url : null;
}

// Thumbnails asking at the same time are signed in one request.
let pending = new Map<string, ((url: string | null) => void)[]>();
let flushScheduled = false;

async function flushPending() {
  flushScheduled = false;
  const batch = pending;
  pending = new Map();
  const refs = [...batch.keys()];
  for (let i = 0; i < refs.length; i += 100) {
    const chunk = refs.slice(i, i + 100);
    const { data, error } = await bucket().createSignedUrls(chunk.map(refToPath), SIGNED_URL_SECONDS);
    const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
    const exp = Date.now() + SIGNED_URL_SECONDS * 1000;
    for (const ref of chunk) {
      const url = error ? null : byPath.get(refToPath(ref)) ?? null;
      if (url) cache().set(ref, { url, exp });
      batch.get(ref)?.forEach((cb) => cb(url));
    }
  }
  persistCache();
}

export function requestPhotoUrl(src: string): Promise<string | null> {
  const hit = cachedPhotoUrl(src);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    pending.set(src, [...(pending.get(src) ?? []), resolve]);
    if (!flushScheduled) {
      flushScheduled = true;
      setTimeout(() => { void flushPending(); }, 0);
    }
  });
}

/** A displayable URL for a photo (data URL or storage reference). */
export function usePhotoUrl(src: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (src ? cachedPhotoUrl(src) : null));
  useEffect(() => {
    if (!src) { setUrl(null); return; }
    const hit = cachedPhotoUrl(src);
    setUrl(hit);
    if (hit) return;
    let active = true;
    void requestPhotoUrl(src).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [src]);
  return url;
}

/** The photo as a data URL — for backups and for sending to Gemini. */
export async function photoToDataUrl(src: string): Promise<string | null> {
  if (isDataUrl(src)) return src;
  const url = await requestPhotoUrl(src);
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
