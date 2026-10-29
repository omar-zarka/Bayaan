import sharp from 'sharp';
import {rgbaToThumbHash} from 'thumbhash';

// The files a reciter photo upload consists of (see bayaan-backend
// docs/uploads.md): a 512 px and a 160 px square WebP, plus a ThumbHash the
// app shows while the photo loads or when it is offline.

export const FULL_SIZE = 512;
export const THUMB_SIZE = 160;
const QUALITY = 80;
// ThumbHash works on images of at most 100 × 100
const HASH_SIZE = 100;

export interface PhotoVariants {
  full: Buffer;
  thumb: Buffer;
  placeholder: string;
}

/** A centred square crop of any image, as the two WebP files and the placeholder. */
export async function makeVariants(source: Buffer): Promise<PhotoVariants> {
  // Normalise once: honour EXIF rotation, drop metadata, flatten transparency
  const square = sharp(source)
    .rotate()
    .flatten({background: '#ffffff'})
    .resize(FULL_SIZE, FULL_SIZE, {fit: 'cover', position: 'centre'});

  const [full, thumb, hashPixels] = await Promise.all([
    square.clone().webp({quality: QUALITY}).toBuffer(),
    square
      .clone()
      .resize(THUMB_SIZE, THUMB_SIZE)
      .webp({quality: QUALITY})
      .toBuffer(),
    square.clone().resize(HASH_SIZE, HASH_SIZE).ensureAlpha().raw().toBuffer(),
  ]);
  const hash = rgbaToThumbHash(HASH_SIZE, HASH_SIZE, hashPixels);
  return {full, thumb, placeholder: Buffer.from(hash).toString('base64')};
}
