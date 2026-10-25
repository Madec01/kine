import type {
  Exercise,
  ExerciseInput,
  Invitation,
  Library,
  Media,
  MediaKind,
  Member,
  Role,
  SessionUser,
  Sheet,
  SheetInput,
  Tag,
  TagFamily,
} from './types';

export interface AuthAdapter {
  getUser(): Promise<SessionUser | null>;
  onChange(callback: (user: SessionUser | null, event?: string) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
}

export interface LibrarySnapshot {
  families: TagFamily[];
  tags: Tag[];
  exercises: Exercise[];
  sheets: Sheet[];
}

/**
 * Every data operation of the application. Two implementations exist:
 * SupabaseRepository (production) and LocalRepository (local-only trial
 * mode and automated tests).
 */
export interface Repository {
  readonly mode: 'supabase' | 'local';
  readonly auth: AuthAdapter;

  listLibraries(): Promise<Library[]>;
  renameLibrary(libraryId: string, name: string): Promise<void>;
  loadSnapshot(libraryId: string): Promise<LibrarySnapshot>;

  createFamily(libraryId: string, input: Pick<TagFamily, 'name' | 'description' | 'color'>): Promise<TagFamily>;
  updateFamily(id: string, patch: Partial<Pick<TagFamily, 'name' | 'description' | 'color' | 'position'>>): Promise<TagFamily>;
  deleteFamily(id: string): Promise<void>;

  createTag(familyId: string, name: string): Promise<Tag>;
  updateTag(id: string, patch: Partial<Pick<Tag, 'name' | 'position' | 'familyId'>>): Promise<Tag>;
  deleteTag(id: string): Promise<void>;

  createExercise(libraryId: string, input: ExerciseInput): Promise<Exercise>;
  updateExercise(id: string, input: ExerciseInput): Promise<Exercise>;
  deleteExercise(exercise: Exercise): Promise<void>;
  /** Copies every field and media file into a new exercise. */
  duplicateExercise(exercise: Exercise, name: string): Promise<Exercise>;

  uploadMedia(exercise: Exercise, file: Blob, kind: MediaKind, caption?: string): Promise<Media>;
  updateMedia(id: string, patch: Partial<Pick<Media, 'caption' | 'position'>>): Promise<Media>;
  deleteMedia(media: Media): Promise<void>;
  /** A URL usable in <img>/<video>; may be temporary (signed). */
  mediaUrl(media: Media): Promise<string>;
  /** A URL meant to be printed (QR code); long-lived when possible. */
  mediaShareUrl(media: Media): Promise<string>;
  mediaBlob(media: Media): Promise<Blob>;

  saveSheet(libraryId: string, input: SheetInput, id?: string): Promise<Sheet>;
  deleteSheet(id: string): Promise<void>;

  listMembers(libraryId: string): Promise<Member[]>;
  listInvitations(libraryId: string): Promise<Invitation[]>;
  invite(libraryId: string, email: string, role: Exclude<Role, 'owner'>): Promise<Invitation>;
  cancelInvitation(id: string): Promise<void>;
  setMemberRole(libraryId: string, userId: string, role: Exclude<Role, 'owner'>): Promise<void>;
  removeMember(libraryId: string, userId: string): Promise<void>;

  /** Removes every exercise, tag, family and sheet of the library (import in replace mode). */
  clearLibrary(libraryId: string): Promise<void>;
}

export class RepositoryError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'RepositoryError';
  }
}
