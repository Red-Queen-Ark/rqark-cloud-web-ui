/** Shared limits for attachments; the server re-checks every one of them. */
export const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_MAX_PER_MESSAGE = 4;

/** Longest edge kept when downscaling: a phone photo is about 4000px wide. */
export const IMAGE_MAX_EDGE = 1600;
const IMAGE_QUALITY = 0.85;
/** Below this there is little to gain, and re-encoding only loses quality. */
const IMAGE_REENCODE_BYTES = 1 * 1024 * 1024;

export function readWithFileReader(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * A second way in, for the files FileReader refuses. `NotReadableError` is what
 * a browser raises when the platform will not hand over the bytes — a photo
 * that is still in iCloud, a file Drive has not synced, one another app holds
 * open. The byte read sometimes succeeds where the reader gave up.
 */
export async function readWithArrayBuffer(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return `data:${file.type};base64,${btoa(binary)}`;
}

/** Reads that start in the caller's own task, so no await can invalidate the file first. */
export function readImage(file: File): Promise<string> {
  return readWithFileReader(file).catch(() => readWithArrayBuffer(file));
}

/** The size of the bytes behind a base64 data URI, without decoding it. */
export function dataUriBytes(dataUri: string): number {
  const comma = dataUri.indexOf(',');
  if (comma < 0) {
    return dataUri.length;
  }
  const payload = dataUri.length - comma - 1;
  const padding = dataUri.endsWith('==') ? 2 : dataUri.endsWith('=') ? 1 : 0;
  return Math.floor((payload * 3) / 4) - padding;
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

/**
 * Decodes the photo so it can be drawn to a canvas. `imageOrientation: 'from-image'`
 * applies the EXIF rotation, which is what stops a phone photo from arriving
 * sideways once the re-encode drops the tag.
 */
async function decode(file: File): Promise<Decoded | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Fall through to the element, which some browsers prefer for odd formats.
    }
  }
  if (typeof Image === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return null;
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('decode failed'));
      image.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

/**
 * Shrinks a photo before it goes on the wire. A 4MB phone photo fits in a few
 * hundred kilobytes once it is 1600px on its long edge, which keeps the socket
 * frame and the session history small. Anything that cannot be decoded, and
 * every GIF (whose animation a canvas would flatten), is sent as it is.
 */
export async function shrinkImage(file: File): Promise<string> {
  const raw = file.size <= IMAGE_REENCODE_BYTES || file.type === 'image/gif' ? await readImage(file) : null;
  if (raw) {
    return raw;
  }
  // No canvas means no re-encode, so decode nothing: an `Image` that can never
  // load would otherwise leave the tile spinning for good.
  const context = document.createElement('canvas').getContext('2d');
  if (!context) {
    return readImage(file);
  }
  const decoded = await decode(file);
  if (!decoded) {
    return readImage(file);
  }
  try {
    const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(decoded.width, decoded.height));
    const canvas = context.canvas;
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const encoded = canvas.toDataURL(mime, IMAGE_QUALITY);
    if (!encoded || encoded === 'data:,') {
      return readImage(file);
    }
    const original = await readImage(file);
    // Never make the frame bigger than it has to be.
    return dataUriBytes(encoded) < dataUriBytes(original) ? encoded : original;
  } catch {
    return readImage(file);
  } finally {
    decoded.release();
  }
}

/** The bytes of every image on the clipboard that looks like a photo. */
export function clipboardImages(data: DataTransfer | null): File[] {
  if (!data) {
    return [];
  }
  const files = Array.from(data.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  if (files.length > 0) {
    return files;
  }
  return Array.from(data.files ?? []).filter((file) => file.type.startsWith('image/'));
}

/** The images carried by a drag and drop, which browsers put on `files` only. */
export function droppedImages(data: DataTransfer | null): File[] {
  if (!data) {
    return [];
  }
  return Array.from(data.files ?? []).filter((file) => file.type.startsWith('image/'));
}
