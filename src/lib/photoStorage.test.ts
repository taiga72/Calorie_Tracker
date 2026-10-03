import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const bucket = {
  upload: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  createSignedUrls: vi.fn(async (paths: string[]) => ({
    data: paths.map((p) => ({ path: p, signedUrl: `https://cdn.test/${p}?token=1`, error: null })),
    error: null,
  })),
};
vi.mock('@/lib/supabaseClient', () => ({ supabase: { storage: { from: () => bucket } } }));

const {
  storeInlinePhotos, requestPhotoUrl, usePhotoUrl, cachedPhotoUrl, photoToDataUrl, resetPhotoStorageState, photoStorageAvailable,
} = await import('@/lib/photoStorage');

const PHOTO = 'data:image/png;base64,' + btoa('png-bytes');

beforeEach(() => {
  localStorage.clear();
  resetPhotoStorageState();
  bucket.upload.mockReset().mockResolvedValue({ error: null });
  bucket.createSignedUrls.mockClear();
});

describe('storeInlinePhotos', () => {
  it('uploads data URLs with the right type and keeps references as they are', async () => {
    const out = await storeInlinePhotos('u1', [PHOTO, 'sb:u1/old.jpg']);
    expect(out?.[0]).toMatch(/^sb:u1\/.+\.png$/);
    expect(out?.[1]).toBe('sb:u1/old.jpg');
    const [, blob, opts] = bucket.upload.mock.calls[0];
    expect((blob as Blob).type).toBe('image/png');
    expect(opts).toMatchObject({ contentType: 'image/png', cacheControl: '31536000', upsert: false });
  });

  it('returns null on a failed upload so the save is retried', async () => {
    bucket.upload.mockResolvedValue({ error: { message: 'Failed to fetch' } });
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    expect(await storeInlinePhotos('u1', [PHOTO])).toBeNull();
  });

  it('can keep a failed photo inline instead', async () => {
    bucket.upload.mockResolvedValue({ error: { message: 'Failed to fetch' } });
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    expect(await storeInlinePhotos('u1', [PHOTO], { keepInlineOnFailure: true })).toEqual([PHOTO]);
  });

  it('falls back to inline photos (and stops trying) when the bucket does not exist', async () => {
    bucket.upload.mockResolvedValue({ error: { message: 'Bucket not found' } });
    expect(await storeInlinePhotos('u1', [PHOTO])).toEqual([PHOTO]);
    expect(photoStorageAvailable()).toBe(false);
    await storeInlinePhotos('u1', [PHOTO]);
    expect(bucket.upload).toHaveBeenCalledTimes(1);
  });
});

describe('signed URLs for display', () => {
  it('signs many photos in one request and caches the result across launches', async () => {
    const urls = await Promise.all(['sb:u1/a.jpg', 'sb:u1/b.jpg'].map(requestPhotoUrl));
    expect(urls).toEqual(['https://cdn.test/u1/a.jpg?token=1', 'https://cdn.test/u1/b.jpg?token=1']);
    expect(bucket.createSignedUrls).toHaveBeenCalledTimes(1);

    // Same URL next launch, so the browser's image cache is reused.
    resetPhotoStorageState();
    expect(cachedPhotoUrl('sb:u1/a.jpg')).toBe('https://cdn.test/u1/a.jpg?token=1');
  });

  it('passes data URLs straight through', () => {
    expect(cachedPhotoUrl(PHOTO)).toBe(PHOTO);
  });

  it('usePhotoUrl resolves a reference for an <img>', async () => {
    const { result } = renderHook(() => usePhotoUrl('sb:u1/c.jpg'));
    await waitFor(() => expect(result.current).toBe('https://cdn.test/u1/c.jpg?token=1'));
  });
});

describe('photoToDataUrl', () => {
  it('downloads a stored photo back into a data URL (for backups and Gemini)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['img'], { type: 'image/jpeg' }) } as Response);
    const out = await photoToDataUrl('sb:u1/d.jpg');
    expect(out).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('returns null when the download fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    expect(await photoToDataUrl('sb:u1/e.jpg')).toBeNull();
  });
});
