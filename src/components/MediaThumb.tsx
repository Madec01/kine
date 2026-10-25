import { useEffect, useState } from 'react';
import type { Media } from '../data/types';
import { useRepo } from '../state/AuthProvider';
import { IconImage, IconVideo } from './icons';

/** Resolves the (possibly signed) URL of a media file. */
export function useMediaUrl(media: Media | undefined): string | null {
  const repo = useRepo();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!media) return;
    repo
      .mediaUrl(media)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [repo, media]);
  return url;
}

export function MediaThumb({ media, alt = '' }: { media: Media | undefined; alt?: string }) {
  const url = useMediaUrl(media);
  if (!media) return <IconImage />;
  if (media.kind === 'video') return url ? <video src={url} muted playsInline preload="metadata" /> : <IconVideo />;
  return url ? <img src={url} alt={alt} loading="lazy" decoding="async" /> : <IconImage />;
}
