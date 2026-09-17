import { unstable_cache, revalidateTag } from 'next/cache';
import { collect } from '../sources';
import type { Blob } from '../types';

export const BLOB_TAG = 'blob';
export const REVALIDATE_SECONDS = 300;

const cachedCollect = unstable_cache(collect, ['dashboard-blob'], { revalidate: REVALIDATE_SECONDS, tags: [BLOB_TAG] });

/** Five minutes old at most. `fresh` throws the cache away first. */
export async function getBlob(fresh = false): Promise<Blob> {
  if (fresh) revalidateTag(BLOB_TAG);
  return cachedCollect();
}
