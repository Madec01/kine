import type { Repository } from '../data/repository';
import type { Exercise, SheetOptions, Tag, TagFamily } from '../data/types';
import { sortFamilies, tagsOfFamily } from '../domain/search';
import { prepareImage, blobToDataUrl } from '../lib/images';
import { pdfSafe } from '../lib/format';
import type { ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import type { PdfExercise, PdfSheet } from './SheetDocument';

export interface GenerateArgs {
  title: string;
  subtitle: string;
  options: SheetOptions;
  exercises: Exercise[];
  families: TagFamily[];
  tags: Tag[];
  repo: Repository;
  maxImagesPerExercise?: number;
  onProgress?: (message: string) => void;
}

const MAX_URL_LENGTH = 1800;

/**
 * Builds the printable A4 sheet. Heavy modules (react-pdf, qrcode) are loaded
 * on demand so the rest of the application stays light.
 */
export async function generateSheetPdf(args: GenerateArgs): Promise<Blob> {
  const { repo, options, onProgress, maxImagesPerExercise = 3 } = args;
  const [{ pdf }, { SheetDocument }, { createElement }, QRCode] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./SheetDocument'),
    import('react'),
    import('qrcode'),
  ]);

  const orderedFamilies = sortFamilies(args.families);
  const exercises: PdfExercise[] = [];

  for (const [index, exercise] of args.exercises.entries()) {
    onProgress?.(`Préparation de « ${exercise.name} » (${index + 1}/${args.exercises.length})…`);

    const images: string[] = [];
    if (options.images) {
      for (const media of exercise.media.filter((m) => m.kind === 'image').slice(0, maxImagesPerExercise)) {
        try {
          const blob = await repo.mediaBlob(media);
          const prepared = await prepareImage(blob, { maxSize: 900, quality: 0.82, forceType: 'image/jpeg' });
          images.push(await blobToDataUrl(prepared));
        } catch {
          /* an unreadable image is simply skipped */
        }
      }
    }

    const owned = new Set(exercise.tagIds);
    const tagGroups = orderedFamilies
      .map((family) => ({ family: pdfSafe(family.name), tags: tagsOfFamily(args.tags, family.id).filter((t) => owned.has(t.id)).map((t) => pdfSafe(t.name)) }))
      .filter((g) => g.tags.length > 0);

    let video: PdfExercise['video'];
    if (options.video) {
      const uploaded = exercise.media.find((m) => m.kind === 'video');
      let url = exercise.videoUrl.trim();
      let label = 'Vidéo de démonstration';
      if (!url && uploaded) {
        try {
          url = await repo.mediaShareUrl(uploaded);
          label = url ? 'Vidéo jointe (lien valable un an)' : '';
        } catch {
          url = '';
        }
      }
      if (url) {
        let qr: string | undefined;
        if (url.length <= MAX_URL_LENGTH) {
          try {
            qr = await QRCode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: 'M' });
          } catch {
            qr = undefined;
          }
        }
        video = { url: url.length > 220 ? `${url.slice(0, 217)}…` : url, qr, label };
      }
    }

    exercises.push({
      name: pdfSafe(exercise.name),
      difficulty: exercise.difficulty,
      description: pdfSafe(exercise.description),
      instructions: pdfSafe(exercise.instructions),
      startPosition: pdfSafe(exercise.startPosition),
      equipment: pdfSafe(exercise.equipment),
      dosage: {
        sets: pdfSafe(exercise.dosage.sets),
        reps: pdfSafe(exercise.dosage.reps),
        duration: pdfSafe(exercise.dosage.duration),
        rest: pdfSafe(exercise.dosage.rest),
      },
      variants: pdfSafe(exercise.variants),
      progressions: pdfSafe(exercise.progressions),
      precautions: pdfSafe(exercise.precautions),
      notes: pdfSafe(exercise.notes),
      images,
      tagGroups,
      video,
    });
  }

  const sheet: PdfSheet = {
    title: pdfSafe(args.title.trim() || 'Fiche d’exercices'),
    subtitle: pdfSafe(args.subtitle),
    date: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()),
    options,
    exercises,
  };

  onProgress?.('Mise en page du PDF…');
  const element = createElement(SheetDocument, { sheet }) as unknown as ReactElement<DocumentProps>;
  const blob = await pdf(element).toBlob();
  onProgress?.('');
  return blob;
}
