import type { Exercise, ExerciseInput, Library, Media, MediaKind, Sheet, SheetInput, Tag, TagFamily } from './types';

export interface LibrarySnapshot {
  families: TagFamily[];
  tags: Tag[];
  exercises: Exercise[];
  sheets: Sheet[];
}

/** Downloads a media file from the online backup; null when unavailable. */
export type MediaFetcher = (mediaId: string) => Promise<Blob | null>;

/**
 * Every data operation of the application. The single implementation stores
 * everything in IndexedDB on the device (source of truth); the sync engine
 * mirrors the change journal to Firestore when a backup is configured.
 */
export interface Repository {
  getLibrary(): Promise<Library>;
  renameLibrary(name: string): Promise<void>;
  loadSnapshot(): Promise<LibrarySnapshot>;

  createFamily(input: Pick<TagFamily, 'name' | 'description' | 'color'>): Promise<TagFamily>;
  updateFamily(id: string, patch: Partial<Pick<TagFamily, 'name' | 'description' | 'color' | 'position'>>): Promise<TagFamily>;
  deleteFamily(id: string): Promise<void>;

  createTag(familyId: string, name: string): Promise<Tag>;
  updateTag(id: string, patch: Partial<Pick<Tag, 'name' | 'position' | 'familyId'>>): Promise<Tag>;
  deleteTag(id: string): Promise<void>;

  createExercise(input: ExerciseInput): Promise<Exercise>;
  updateExercise(id: string, input: ExerciseInput): Promise<Exercise>;
  deleteExercise(exercise: Exercise): Promise<void>;
  /** Copies every field and media file into a new exercise. */
  duplicateExercise(exercise: Exercise, name: string): Promise<Exercise>;

  uploadMedia(exercise: Exercise, file: Blob, kind: MediaKind, caption?: string): Promise<Media>;
  updateMedia(id: string, patch: Partial<Pick<Media, 'caption' | 'position'>>): Promise<Media>;
  deleteMedia(media: Media): Promise<void>;
  /** Object URL of the file; downloads it first when it is only online. */
  mediaUrl(media: Media): Promise<string>;
  mediaBlob(media: Media): Promise<Blob>;
  /** Installed by the sync engine so missing files can be fetched on demand. */
  setMediaFetcher(fetcher: MediaFetcher | null): void;

  saveSheet(input: SheetInput, id?: string): Promise<Sheet>;
  deleteSheet(id: string): Promise<void>;

  /** Removes every exercise, tag, family and sheet (import in replace mode). */
  clearLibrary(): Promise<void>;
}

export class RepositoryError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'RepositoryError';
  }
}
