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
import { RepositoryError, type AuthAdapter, type LibrarySnapshot, type Repository } from './repository';

/** Minimal key/value persistence; IndexedDB in the browser, a Map in tests. */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
}

export class MemoryStore implements KeyValueStore {
  private map = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, structuredClone(value));
  }
  async del(key: string): Promise<void> {
    this.map.delete(key);
  }
}

interface LocalDb {
  library: { id: string; name: string; createdAt: string };
  families: TagFamily[];
  tags: Tag[];
  exercises: Omit<Exercise, 'media'>[];
  media: Media[];
  sheets: Sheet[];
}

const DB_KEY = 'kine-local-db-v2';
const LOCAL_USER: SessionUser = { id: 'local-user', email: 'Cet appareil (mode local)' };

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
const now = (): string => new Date().toISOString();

class LocalAuth implements AuthAdapter {
  async getUser(): Promise<SessionUser | null> {
    return LOCAL_USER;
  }
  onChange(): () => void {
    return () => {};
  }
  async signIn(): Promise<void> {
    throw new RepositoryError('Le mode local ne demande pas de connexion.');
  }
  async signUp(): Promise<{ needsConfirmation: boolean }> {
    throw new RepositoryError('Le mode local ne demande pas de compte.');
  }
  async signOut(): Promise<void> {}
  async resetPassword(): Promise<void> {
    throw new RepositoryError('Indisponible en mode local.');
  }
  async updatePassword(): Promise<void> {
    throw new RepositoryError('Indisponible en mode local.');
  }
}

/**
 * Single-user repository persisted on the device. Used when Supabase is not
 * configured (trial / offline use) and by the automated tests. No access
 * control: the data belongs to whoever uses the browser profile.
 */
export class LocalRepository implements Repository {
  readonly mode = 'local' as const;
  readonly auth: AuthAdapter = new LocalAuth();
  private cache: LocalDb | null = null;
  private objectUrls = new Map<string, string>();

  constructor(private store: KeyValueStore) {}

  private async db(): Promise<LocalDb> {
    if (this.cache) return this.cache;
    const stored = await this.store.get<LocalDb>(DB_KEY);
    this.cache = stored ?? {
      library: { id: newId(), name: 'Ma bibliothèque', createdAt: now() },
      families: [],
      tags: [],
      exercises: [],
      media: [],
      sheets: [],
    };
    if (!stored) await this.store.set(DB_KEY, this.cache);
    return this.cache;
  }

  private async save(db: LocalDb): Promise<void> {
    this.cache = db;
    await this.store.set(DB_KEY, db);
  }

  private assemble(db: LocalDb, exercise: Omit<Exercise, 'media'>): Exercise {
    return {
      ...exercise,
      dosage: { ...exercise.dosage },
      tagIds: [...exercise.tagIds],
      media: db.media.filter((m) => m.exerciseId === exercise.id).sort((a, b) => a.position - b.position),
    };
  }

  async listLibraries(): Promise<Library[]> {
    const db = await this.db();
    return [{ id: db.library.id, name: db.library.name, ownerId: LOCAL_USER.id, role: 'owner', createdAt: db.library.createdAt }];
  }

  async renameLibrary(_libraryId: string, name: string): Promise<void> {
    const db = await this.db();
    await this.save({ ...db, library: { ...db.library, name } });
  }

  async loadSnapshot(_libraryId?: string): Promise<LibrarySnapshot> {
    const db = await this.db();
    return {
      families: structuredClone(db.families),
      tags: structuredClone(db.tags),
      exercises: db.exercises.map((e) => this.assemble(db, e)),
      sheets: structuredClone(db.sheets),
    };
  }

  async createFamily(libraryId: string, input: Pick<TagFamily, 'name' | 'description' | 'color'>): Promise<TagFamily> {
    const db = await this.db();
    const name = input.name.trim();
    if (!name) throw new RepositoryError('Le nom de la famille est obligatoire.');
    if (db.families.some((f) => f.name.localeCompare(name, 'fr', { sensitivity: 'base' }) === 0)) {
      throw new RepositoryError(`La famille « ${name} » existe déjà.`);
    }
    const family: TagFamily = {
      id: newId(),
      libraryId,
      name,
      description: input.description,
      color: input.color,
      position: db.families.length,
      createdAt: now(),
    };
    await this.save({ ...db, families: [...db.families, family] });
    return family;
  }

  async updateFamily(id: string, patch: Partial<Pick<TagFamily, 'name' | 'description' | 'color' | 'position'>>): Promise<TagFamily> {
    const db = await this.db();
    const current = db.families.find((f) => f.id === id);
    if (!current) throw new RepositoryError('Famille introuvable.');
    const name = patch.name !== undefined ? patch.name.trim() : current.name;
    if (!name) throw new RepositoryError('Le nom de la famille est obligatoire.');
    if (db.families.some((f) => f.id !== id && f.name.localeCompare(name, 'fr', { sensitivity: 'base' }) === 0)) {
      throw new RepositoryError(`La famille « ${name} » existe déjà.`);
    }
    const updated = { ...current, ...patch, name };
    await this.save({ ...db, families: db.families.map((f) => (f.id === id ? updated : f)) });
    return updated;
  }

  async deleteFamily(id: string): Promise<void> {
    const db = await this.db();
    const removedTags = new Set(db.tags.filter((t) => t.familyId === id).map((t) => t.id));
    await this.save({
      ...db,
      families: db.families.filter((f) => f.id !== id),
      tags: db.tags.filter((t) => t.familyId !== id),
      exercises: db.exercises.map((e) => ({ ...e, tagIds: e.tagIds.filter((tagId) => !removedTags.has(tagId)) })),
    });
  }

  async createTag(familyId: string, rawName: string): Promise<Tag> {
    const db = await this.db();
    const family = db.families.find((f) => f.id === familyId);
    if (!family) throw new RepositoryError('Famille introuvable.');
    const name = rawName.trim();
    if (!name) throw new RepositoryError('Le nom du tag est obligatoire.');
    if (db.tags.some((t) => t.familyId === familyId && t.name.localeCompare(name, 'fr', { sensitivity: 'base' }) === 0)) {
      throw new RepositoryError(`Le tag « ${name} » existe déjà dans cette famille.`);
    }
    const tag: Tag = {
      id: newId(),
      libraryId: family.libraryId,
      familyId,
      name,
      position: db.tags.filter((t) => t.familyId === familyId).length,
      createdAt: now(),
    };
    await this.save({ ...db, tags: [...db.tags, tag] });
    return tag;
  }

  async updateTag(id: string, patch: Partial<Pick<Tag, 'name' | 'position' | 'familyId'>>): Promise<Tag> {
    const db = await this.db();
    const current = db.tags.find((t) => t.id === id);
    if (!current) throw new RepositoryError('Tag introuvable.');
    const name = patch.name !== undefined ? patch.name.trim() : current.name;
    const familyId = patch.familyId ?? current.familyId;
    if (!name) throw new RepositoryError('Le nom du tag est obligatoire.');
    if (db.tags.some((t) => t.id !== id && t.familyId === familyId && t.name.localeCompare(name, 'fr', { sensitivity: 'base' }) === 0)) {
      throw new RepositoryError(`Le tag « ${name} » existe déjà dans cette famille.`);
    }
    const updated = { ...current, ...patch, name, familyId };
    await this.save({ ...db, tags: db.tags.map((t) => (t.id === id ? updated : t)) });
    return updated;
  }

  async deleteTag(id: string): Promise<void> {
    const db = await this.db();
    await this.save({
      ...db,
      tags: db.tags.filter((t) => t.id !== id),
      exercises: db.exercises.map((e) => ({ ...e, tagIds: e.tagIds.filter((tagId) => tagId !== id) })),
    });
  }

  private cleanInput(db: LocalDb, input: ExerciseInput): ExerciseInput {
    const name = input.name.trim();
    if (!name) throw new RepositoryError('Le nom de l’exercice est obligatoire.');
    const known = new Set(db.tags.map((t) => t.id));
    return { ...input, name, dosage: { ...input.dosage }, tagIds: [...new Set(input.tagIds)].filter((id) => known.has(id)) };
  }

  async createExercise(libraryId: string, input: ExerciseInput): Promise<Exercise> {
    const db = await this.db();
    const stamp = now();
    const exercise: Omit<Exercise, 'media'> = { ...this.cleanInput(db, input), id: newId(), libraryId, createdAt: stamp, updatedAt: stamp };
    await this.save({ ...db, exercises: [...db.exercises, exercise] });
    return this.assemble(db, exercise);
  }

  async updateExercise(id: string, input: ExerciseInput): Promise<Exercise> {
    const db = await this.db();
    const current = db.exercises.find((e) => e.id === id);
    if (!current) throw new RepositoryError('Exercice introuvable.');
    const updated: Omit<Exercise, 'media'> = { ...current, ...this.cleanInput(db, input), updatedAt: now() };
    await this.save({ ...db, exercises: db.exercises.map((e) => (e.id === id ? updated : e)) });
    return this.assemble(this.cache!, updated);
  }

  async deleteExercise(exercise: Exercise): Promise<void> {
    const db = await this.db();
    for (const media of db.media.filter((m) => m.exerciseId === exercise.id)) {
      await this.store.del(`media-blob:${media.id}`);
      this.revoke(media.id);
    }
    await this.save({
      ...db,
      exercises: db.exercises.filter((e) => e.id !== exercise.id),
      media: db.media.filter((m) => m.exerciseId !== exercise.id),
      sheets: db.sheets.map((s) => ({ ...s, exerciseIds: s.exerciseIds.filter((eid) => eid !== exercise.id) })),
    });
  }

  async duplicateExercise(exercise: Exercise, name: string): Promise<Exercise> {
    const { id: _id, libraryId, media, createdAt: _c, updatedAt: _u, ...fields } = exercise;
    const created = await this.createExercise(libraryId, { ...fields, name });
    for (const item of media) {
      const blob = await this.store.get<Blob>(`media-blob:${item.id}`);
      if (blob) await this.uploadMedia(created, blob, item.kind, item.caption);
    }
    const db = await this.db();
    return this.assemble(db, db.exercises.find((e) => e.id === created.id)!);
  }

  async uploadMedia(exercise: Exercise, file: Blob, kind: MediaKind, caption = ''): Promise<Media> {
    const db = await this.db();
    const id = newId();
    const media: Media = {
      id,
      libraryId: exercise.libraryId,
      exerciseId: exercise.id,
      kind,
      storagePath: `local/${exercise.id}/${id}`,
      mimeType: file.type,
      caption,
      position: db.media.filter((m) => m.exerciseId === exercise.id).length,
      createdAt: now(),
    };
    await this.store.set(`media-blob:${id}`, file);
    await this.save({ ...db, media: [...db.media, media] });
    return media;
  }

  async updateMedia(id: string, patch: Partial<Pick<Media, 'caption' | 'position'>>): Promise<Media> {
    const db = await this.db();
    const current = db.media.find((m) => m.id === id);
    if (!current) throw new RepositoryError('Média introuvable.');
    const updated = { ...current, ...patch };
    await this.save({ ...db, media: db.media.map((m) => (m.id === id ? updated : m)) });
    return updated;
  }

  async deleteMedia(media: Media): Promise<void> {
    const db = await this.db();
    await this.store.del(`media-blob:${media.id}`);
    this.revoke(media.id);
    await this.save({ ...db, media: db.media.filter((m) => m.id !== media.id) });
  }

  private revoke(id: string): void {
    const url = this.objectUrls.get(id);
    if (url && typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(url);
    this.objectUrls.delete(id);
  }

  async mediaBlob(media: Media): Promise<Blob> {
    const blob = await this.store.get<Blob>(`media-blob:${media.id}`);
    if (!blob) throw new RepositoryError('Fichier média introuvable sur cet appareil.');
    return blob;
  }

  async mediaUrl(media: Media): Promise<string> {
    const cached = this.objectUrls.get(media.id);
    if (cached) return cached;
    const blob = await this.mediaBlob(media);
    const url = URL.createObjectURL(blob);
    this.objectUrls.set(media.id, url);
    return url;
  }

  async mediaShareUrl(_media: Media): Promise<string> {
    // A file stored on the device has no address another device could open.
    return '';
  }

  async saveSheet(libraryId: string, input: SheetInput, id?: string): Promise<Sheet> {
    const db = await this.db();
    const title = input.title.trim() || 'Fiche sans titre';
    const stamp = now();
    const existing = id ? db.sheets.find((s) => s.id === id) : undefined;
    const sheet: Sheet = {
      id: existing?.id ?? newId(),
      libraryId,
      title,
      subtitle: input.subtitle,
      options: { ...input.options },
      exerciseIds: [...input.exerciseIds],
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
    };
    await this.save({ ...db, sheets: existing ? db.sheets.map((s) => (s.id === sheet.id ? sheet : s)) : [...db.sheets, sheet] });
    return sheet;
  }

  async deleteSheet(id: string): Promise<void> {
    const db = await this.db();
    await this.save({ ...db, sheets: db.sheets.filter((s) => s.id !== id) });
  }

  async listMembers(_libraryId: string): Promise<Member[]> {
    return [{ userId: LOCAL_USER.id, email: LOCAL_USER.email, role: 'owner', isOwner: true }];
  }
  async listInvitations(_libraryId: string): Promise<Invitation[]> {
    return [];
  }
  async invite(): Promise<Invitation> {
    throw new RepositoryError('Le partage nécessite le mode Supabase (compte en ligne).');
  }
  async cancelInvitation(): Promise<void> {}
  async setMemberRole(): Promise<void> {
    throw new RepositoryError('Le partage nécessite le mode Supabase.');
  }
  async removeMember(): Promise<void> {
    throw new RepositoryError('Le partage nécessite le mode Supabase.');
  }

  async clearLibrary(_libraryId?: string): Promise<void> {
    const db = await this.db();
    for (const media of db.media) {
      await this.store.del(`media-blob:${media.id}`);
      this.revoke(media.id);
    }
    await this.save({ ...db, families: [], tags: [], exercises: [], media: [], sheets: [] });
  }
}

export type { Role };
