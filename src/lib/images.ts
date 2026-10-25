export const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp,image/gif';
export const ACCEPTED_VIDEOS = 'video/mp4,video/webm,video/quicktime';
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export const isImageFile = (file: Blob): boolean => file.type.startsWith('image/');
export const isVideoFile = (file: Blob): boolean => file.type.startsWith('video/');

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* fall through to <img> decoding */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible.'));
    };
    img.src = url;
  });
}

/**
 * Downscales an image so its longest side is at most `maxSize` pixels and
 * re-encodes it (JPEG by default, PNG kept for PNG sources). Returns the
 * original file when it is already small or cannot be decoded.
 */
export async function prepareImage(
  file: Blob,
  { maxSize = 1600, quality = 0.86, forceType }: { maxSize?: number; quality?: number; forceType?: 'image/jpeg' | 'image/png' } = {},
): Promise<Blob> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    return file;
  }
  const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const type = forceType ?? (file.type === 'image/png' ? 'image/png' : 'image/jpeg');
  const unchanged = scale === 1 && file.type === type && file.size < 900_000;
  if (unchanged) return file;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ('close' in source) source.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  return blob ?? file;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(blob);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Small JPEG data URL for lists; null when the image cannot be decoded (e.g. in Node). */
export async function makeThumb(file: Blob, size = 160): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  try {
    const small = await prepareImage(file, { maxSize: size, quality: 0.7, forceType: 'image/jpeg' });
    if (small === file && file.size > 40_000) return null;
    return await blobToDataUrl(small);
  } catch {
    return null;
  }
}

/** Base64 payload without the data URL prefix. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(binary);
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
