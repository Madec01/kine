import type { Exercise, FamilyColor, Library, Media, Sheet, SheetOptions, Tag, TagFamily } from '../data/types';
import { DEFAULT_SHEET_OPTIONS, FAMILY_COLORS } from '../data/types';
import type { LibrarySnapshot } from '../data/repository';

export const EXPORT_FORMAT = 'kine-bibliotheque';
export const EXPORT_VERSION = 1;

export interface ExportMedia {
  kind: 'image' | 'video';
  caption: string;
  position: number;
  mimeType: string;
  /** Base64 data URL when the file was embedded in the export. */
  dataUrl?: string;
  /** Original storage path, kept for reference when the file is not embedded. */
  storagePath?: string;
}

export interface ExportTag {
  id: string;
  name: string;
  position: number;
}

export interface ExportFamily {
  id: string;
  name: string;
  description: string;
  color: FamilyColor;
  position: number;
  tags: ExportTag[];
}

export interface ExportExercise {
  id: string;
  name: string;
  description: string;
  instructions: string;
  startPosition: string;
  equipment: string;
  dosage: { sets: string; reps: string; duration: string; rest: string };
  difficulty: number | null;
  variants: string;
  progressions: string;
  precautions: string;
  notes: string;
  videoUrl: string;
  /** Tag ids, resolved against `families[].tags[].id`. */
  tags: string[];
  media: ExportMedia[];
  createdAt: string;
  updatedAt: string;
}

export interface ExportSheet {
  id: string;
  title: string;
  subtitle: string;
  options: SheetOptions;
  exerciseIds: string[];
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  library: { name: string };
  families: ExportFamily[];
  exercises: ExportExercise[];
  sheets: ExportSheet[];
}

export interface ExportSummary {
  families: number;
  tags: number;
  exercises: number;
  media: number;
  embeddedMedia: number;
  sheets: number;
}

export function buildExport(
  library: Pick<Library, 'name'>,
  snapshot: LibrarySnapshot,
  mediaData: Map<string, string>,
): ExportFile {
  const families: ExportFamily[] = [...snapshot.families]
    .sort((a, b) => a.position - b.position)
    .map((family) => ({
      id: family.id,
      name: family.name,
      description: family.description,
      color: family.color,
      position: family.position,
      tags: snapshot.tags
        .filter((tag) => tag.familyId === family.id)
        .sort((a, b) => a.position - b.position)
        .map((tag) => ({ id: tag.id, name: tag.name, position: tag.position })),
    }));

  const exercises: ExportExercise[] = snapshot.exercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    description: exercise.description,
    instructions: exercise.instructions,
    startPosition: exercise.startPosition,
    equipment: exercise.equipment,
    dosage: { ...exercise.dosage },
    difficulty: exercise.difficulty,
    variants: exercise.variants,
    progressions: exercise.progressions,
    precautions: exercise.precautions,
    notes: exercise.notes,
    videoUrl: exercise.videoUrl,
    tags: [...exercise.tagIds],
    media: [...exercise.media]
      .sort((a, b) => a.position - b.position)
      .map((media) => exportMedia(media, mediaData.get(media.id))),
    createdAt: exercise.createdAt,
    updatedAt: exercise.updatedAt,
  }));

  const sheets: ExportSheet[] = snapshot.sheets.map((sheet) => ({
    id: sheet.id,
    title: sheet.title,
    subtitle: sheet.subtitle,
    options: { ...sheet.options },
    exerciseIds: [...sheet.exerciseIds],
  }));

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    library: { name: library.name },
    families,
    exercises,
    sheets,
  };
}

function exportMedia(media: Media, dataUrl: string | undefined): ExportMedia {
  const entry: ExportMedia = {
    kind: media.kind,
    caption: media.caption,
    position: media.position,
    mimeType: media.mimeType,
  };
  if (dataUrl) entry.dataUrl = dataUrl;
  else entry.storagePath = media.storagePath;
  return entry;
}

export function summarizeExport(file: ExportFile): ExportSummary {
  const media = file.exercises.flatMap((e) => e.media);
  return {
    families: file.families.length,
    tags: file.families.reduce((n, f) => n + f.tags.length, 0),
    exercises: file.exercises.length,
    media: media.length,
    embeddedMedia: media.filter((m) => m.dataUrl).length,
    sheets: file.sheets.length,
  };
}

export class ImportFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportFormatError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const num = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const strList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

/** Validates and normalizes a JSON document produced by `buildExport`. */
export function parseExport(raw: unknown): ExportFile {
  if (!isRecord(raw)) throw new ImportFormatError('Le fichier ne contient pas un objet JSON.');
  if (raw.format !== EXPORT_FORMAT) {
    throw new ImportFormatError('Ce fichier n’est pas un export de la bibliothèque Kiné (champ « format » absent ou différent).');
  }
  const version = num(raw.version, 0);
  if (version < 1 || version > EXPORT_VERSION) {
    throw new ImportFormatError(`Version d’export ${version} non prise en charge (attendue : ${EXPORT_VERSION}).`);
  }
  if (!Array.isArray(raw.families) || !Array.isArray(raw.exercises)) {
    throw new ImportFormatError('Le fichier doit contenir les listes « families » et « exercises ».');
  }

  const families: ExportFamily[] = raw.families.map((item, index) => {
    if (!isRecord(item) || !str(item.name).trim()) {
      throw new ImportFormatError(`Famille n°${index + 1} invalide : nom manquant.`);
    }
    const tags: ExportTag[] = Array.isArray(item.tags)
      ? item.tags.map((tag, tagIndex) => {
          if (!isRecord(tag) || !str(tag.name).trim()) {
            throw new ImportFormatError(`Tag n°${tagIndex + 1} de la famille « ${str(item.name)} » invalide : nom manquant.`);
          }
          return { id: str(tag.id, `tag-${index}-${tagIndex}`), name: str(tag.name).trim(), position: num(tag.position, tagIndex) };
        })
      : [];
    const color = FAMILY_COLORS.includes(item.color as FamilyColor) ? (item.color as FamilyColor) : 'sable';
    return {
      id: str(item.id, `family-${index}`),
      name: str(item.name).trim(),
      description: str(item.description),
      color,
      position: num(item.position, index),
      tags,
    };
  });

  const knownTagIds = new Set(families.flatMap((f) => f.tags.map((t) => t.id)));

  const exercises: ExportExercise[] = raw.exercises.map((item, index) => {
    if (!isRecord(item) || !str(item.name).trim()) {
      throw new ImportFormatError(`Exercice n°${index + 1} invalide : nom manquant.`);
    }
    const dosage = isRecord(item.dosage) ? item.dosage : {};
    const media: ExportMedia[] = Array.isArray(item.media)
      ? item.media
          .filter(isRecord)
          .map((m, mediaIndex) => ({
            kind: m.kind === 'video' ? 'video' : 'image',
            caption: str(m.caption),
            position: num(m.position, mediaIndex),
            mimeType: str(m.mimeType),
            dataUrl: typeof m.dataUrl === 'string' && m.dataUrl.startsWith('data:') ? m.dataUrl : undefined,
            storagePath: str(m.storagePath) || undefined,
          }))
      : [];
    const difficulty = typeof item.difficulty === 'number' && item.difficulty >= 1 && item.difficulty <= 5 ? Math.round(item.difficulty) : null;
    return {
      id: str(item.id, `exercise-${index}`),
      name: str(item.name).trim(),
      description: str(item.description),
      instructions: str(item.instructions),
      startPosition: str(item.startPosition),
      equipment: str(item.equipment),
      dosage: { sets: str(dosage.sets), reps: str(dosage.reps), duration: str(dosage.duration), rest: str(dosage.rest) },
      difficulty,
      variants: str(item.variants),
      progressions: str(item.progressions),
      precautions: str(item.precautions),
      notes: str(item.notes),
      videoUrl: str(item.videoUrl),
      tags: strList(item.tags).filter((id) => knownTagIds.has(id)),
      media,
      createdAt: str(item.createdAt),
      updatedAt: str(item.updatedAt),
    };
  });

  const knownExerciseIds = new Set(exercises.map((e) => e.id));
  const sheets: ExportSheet[] = Array.isArray(raw.sheets)
    ? raw.sheets.filter(isRecord).map((item, index) => ({
        id: str(item.id, `sheet-${index}`),
        title: str(item.title, 'Fiche sans titre'),
        subtitle: str(item.subtitle),
        options: { ...DEFAULT_SHEET_OPTIONS, ...(isRecord(item.options) ? (item.options as Partial<SheetOptions>) : {}) },
        exerciseIds: strList(item.exerciseIds).filter((id) => knownExerciseIds.has(id)),
      }))
    : [];

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: str(raw.exportedAt),
    library: { name: isRecord(raw.library) ? str(raw.library.name, 'Ma bibliothèque') : 'Ma bibliothèque' },
    families,
    exercises,
    sheets,
  };
}

/** Converts a data URL to a Blob (browser and Node ≥ 18). */
export function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new ImportFormatError('Média intégré illisible.');
  const mimeType = match[1] || 'application/octet-stream';
  const payload = match[3];
  const bytes = match[2]
    ? Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(payload));
  return { blob: new Blob([bytes], { type: mimeType }), mimeType };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Helpers exposed for the UI: are these two names the same tag / family? */
export function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().trim();
  return norm(a) === norm(b);
}

export type { Exercise, Tag, TagFamily, Sheet };
