import { useEffect, useState } from 'react';
import type { Exercise, Media } from '../data/types';
import { useRepo } from '../state/RepositoryProvider';
import { IconImage, IconVideo } from './icons';

/**
 * Resolves the object URL of a media file. When the file is only in the
 * online backup, it is downloaded once (one Firestore read) and kept locally.
 */
export function useMediaUrl(media: Media | undefined): { url: string | null; error: string | null } {
  const repo = useRepo();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);
    if (!media) return;
    repo
      .mediaUrl(media)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [repo, media]);
  return { url, error };
}

export function MediaThumb({ media, alt = '' }: { media: Media | undefined; alt?: string }) {
  const { url } = useMediaUrl(media);
  if (!media) return <IconImage />;
  if (media.kind === 'video') return url ? <video src={url} muted playsInline preload="metadata" /> : <IconVideo />;
  return url ? <img src={url} alt={alt} loading="lazy" decoding="async" /> : <IconImage />;
}

/** Thumbnail for lists: never triggers a download (uses the embedded thumb or a local file). */
export function ExerciseThumb({ exercise }: { exercise: Exercise }) {
  const image = exercise.media.find((m) => m.kind === 'image');
  if (exercise.thumb) return <img src={exercise.thumb} alt="" loading="lazy" decoding="async" />;
  if (image?.available) return <MediaThumb media={image} />;
  return <IconImage />;
}

export function hasThumb(exercise: Exercise): boolean {
  return Boolean(exercise.thumb) || exercise.media.some((m) => m.kind === 'image' && m.available);
}
