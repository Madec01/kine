import { get as kvGet, del as kvDel } from 'idb-keyval';
import type { Exercise, ExerciseInput, Library, Media, MediaKind, Sheet, SheetInput, Tag, TagFamily } from './types';
import { RepositoryError, type LibrarySnapshot, type MediaFetcher, type Repository } from './repository';
import {
  newId,
  openKineDb,
  TOMBSTONE_TTL_MS,
  type ExerciseRecord,
  type FamilyRecord,
  type KineDatabase,
  type LibraryMeta,
  type MediaMeta,
  type MediaRecord,
  type OutboxCollection,
  type OutboxRecord,
  type SheetRecord,
  type TagRecord,
} from './localDb';
import { makeThumb } from '../lib/images';

/** Images above this size (after compression) stay on the device only. */
export const MAX_SYNCED_IMAGE_BYTES = 700_000;

export type ChangeListener = (event: { source: 'local' | 'remote'; collection: OutboxCollection | 'library' }) => void;

const now = (): number => Date.now();
const iso = (): string => new Date().toISOString();
const sameName = (a: string, b: string): boolean => a.localeCompare(b, 'fr', { sensitivity: 'base' }) === 0;
const alive = <T extends { deletedAt: number | null }>(record: T | undefined): record is T => Boolean(record && record.deletedAt === null);

/**
 * Device store (IndexedDB), source of truth for the UI. Every mutation is
 * written immediately and journaled in `outbox` so the sync engine can send
 * only what changed. Nothing here talks to the network.
 */
export class LocalRepository implements Repository {
  private objectUrls = new Map<string, string>();
  private listeners = new Set<ChangeListener>();
  private fetcher: MediaFetcher | null = null;

  private constructor(readonly db: KineDatabase) {}

  static async open(dbName?: string): Promise<LocalRepository> {
    const repo = new LocalRepository(await openKineDb(dbName));
    await repo.ensureLibrary();
    await repo.migrateFromV2();
    await repo.purgeTombstones();
    return repo;
  }

  // ---------------------------------------------------------------- meta ---

  async getMeta<T>(key: string): Promise<T | undefined> {
    return (await this.db.get('meta', key)) as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.db.put('meta', value, key);
  }

  async ensureLibrary(): Promise<LibraryMeta> {
    let library = await this.getMeta<LibraryMeta>('library');
    if (!library) {
      library = { id: newId(), name: 'Ma bibliothèque', createdAt: iso() };
      await this.setMeta('library', library);
    }
    return library;
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(source: 'local' | 'remote', collection: OutboxCollection | 'library'): void {
    this.listeners.forEach((l) => l({ source, collection }));
  }

  // -------------------------------------------------------------- outbox ---

  private async journal(collection: OutboxCollection, id: string, op: 'upsert' | 'delete'): Promise<void> {
    const key = `${collection}/${id}`;
    const previous = await this.db.get('outbox', key);
    await this.db.put('outbox', { key, collection, id, op: previous?.op === 'delete' ? 'delete' : op, changedAt: now() });
  }

  listOutbox(): Promise<OutboxRecord[]> {
    return this.db.getAll('outbox');
  }

  /** Removes journal entries, unless the entity changed again since they were read. */
  async removeOutbox(entries: OutboxRecord[]): Promise<void> {
    const tx = this.db.transaction('outbox', 'readwrite');
    for (const entry of entries) {
      const current = await tx.store.get(entry.key);
      if (current && current.changedAt <= entry.changedAt) await tx.store.delete(entry.key);
    }
    await tx.done;
  }

  async markSynced(collection: OutboxCollection, id: string): Promise<void> {
    const record = await this.db.get(collection, id);
    if (record && record.dirty) await this.db.put(collection, { ...record, dirty: false } as never);
  }

  // ------------------------------------------------------------- records ---

  getFamilyRecord(id: string): Promise<FamilyRecord | undefined> {
    return this.db.get('families', id);
  }
  getExerciseRecord(id: string): Promise<ExerciseRecord | undefined> {
    return this.db.get('exercises', id);
  }
  getSheetRecord(id: string): Promise<SheetRecord | undefined> {
    return this.db.get('sheets', id);
  }
  getMediaRecord(id: string): Promise<MediaRecord | undefined> {
    return this.db.get('media', id);
  }

  /** Applies a record coming from the online backup (no journal entry). */
  async applyRemote(collection: 'families', record: FamilyRecord): Promise<void>;
  async applyRemote(collection: 'exercises', record: ExerciseRecord): Promise<void>;
  async applyRemote(collection: 'sheets', record: SheetRecord): Promise<void>;
  async applyRemote(collection: 'families' | 'exercises' | 'sheets', record: FamilyRecord | ExerciseRecord | SheetRecord): Promise<void> {
    await this.db.put(collection, record as never);
    if (collection === 'exercises') await this.reconcileMediaMeta(record as ExerciseRecord);
  }

  /** Keeps the media store aligned with the metadata embedded in a remote exercise. */
  private async reconcileMediaMeta(exercise: ExerciseRecord): Promise<void> {
    const existing = await this.db.getAllFromIndex('media', 'byExercise', exercise.id);
    const known = new Map(existing.map((m) => [m.id, m]));
    const tx = this.db.transaction('media', 'readwrite');
    const wanted = exercise.deletedAt === null ? exercise.media : [];
    for (const meta of wanted) {
      const current = known.get(meta.id);
      if (current && current.dirty) continue;
      await tx.store.put({
        ...meta,
        exerciseId: exercise.id,
        blob: current?.blob,
        remote: meta.kind === 'image',
        updatedAt: exercise.updatedAt,
        deletedAt: null,
        dirty: false,
      });
    }
    const wantedIds = new Set(wanted.map((m) => m.id));
    for (const current of existing) {
      if (!wantedIds.has(current.id) && !current.dirty && current.deletedAt === null) {
        this.revoke(current.id);
        await tx.store.put({ ...current, blob: undefined, deletedAt: exercise.updatedAt, updatedAt: exercise.updatedAt });
      }
    }
    await tx.done;
  }

  async storeMediaBlob(id: string, blob: Blob): Promise<void> {
    const record = await this.db.get('media', id);
    if (!record) return;
    await this.db.put('media', { ...record, blob, bytes: record.bytes || blob.size });
  }

  async listMissingMedia(): Promise<MediaRecord[]> {
    const all = await this.db.getAll('media');
    return all.filter((m) => m.deletedAt === null && m.remote && !m.blob && m.kind === 'image');
  }

  notifyRemoteApplied(): void {
    this.emit('remote', 'library');
  }

  async purgeTombstones(): Promise<void> {
    const limit = now() - TOMBSTONE_TTL_MS;
    for (const collection of ['families', 'exercises', 'sheets', 'media'] as const) {
      const all = await this.db.getAll(collection);
      for (const record of all) {
        if (record.deletedAt !== null && !record.dirty && record.deletedAt < limit) await this.db.delete(collection, record.id);
      }
    }
    for (const family of await this.db.getAll('families')) {
      const tags = family.tags.filter((t) => t.deletedAt === null || t.deletedAt >= limit || family.dirty);
      if (tags.length !== family.tags.length) await this.db.put('families', { ...family, tags });
    }
  }

  // ----------------------------------------------------------- migration ---

  /** Imports the data of the previous local mode (one big document in idb-keyval). */
  private async migrateFromV2(): Promise<void> {
    if (await this.getMeta<boolean>('migratedFromV2')) return;
    type OldDb = {
      library: { id: string; name: string; createdAt: string };
      families: Array<{ id: string; name: string; description: string; color: FamilyRecord['color']; position: number; createdAt: string }>;
      tags: Array<{ id: string; familyId: string; name: string; position: number; createdAt: string }>;
      exercises: Array<Omit<ExerciseRecord, 'media' | 'thumb' | 'updatedAt' | 'deletedAt' | 'dirty'> & { updatedAt: string; libraryId?: string }>;
      media: Array<{ id: string; exerciseId: string; kind: MediaKind; mimeType: string; caption: string; position: number; createdAt: string }>;
      sheets: Array<Omit<SheetRecord, 'updatedAt' | 'deletedAt' | 'dirty'> & { updatedAt: string; libraryId?: string }>;
    };
    let old: OldDb | undefined;
    try {
      old = await kvGet<OldDb>('kine-local-db-v2');
    } catch {
      old = undefined;
    }
    if (old) {
      const stamp = now();
      if (old.library?.name) {
        const library = await this.ensureLibrary();
        await this.setMeta('library', { ...library, name: old.library.name });
      }
      for (const f of old.families ?? []) {
        const tags: TagRecord[] = (old.tags ?? [])
          .filter((t) => t.familyId === f.id)
          .map((t) => ({ id: t.id, name: t.name, position: t.position, createdAt: t.createdAt, updatedAt: stamp, deletedAt: null }));
        await this.db.put('families', { id: f.id, name: f.name, description: f.description, color: f.color, position: f.position, tags, createdAt: f.createdAt, updatedAt: stamp, deletedAt: null, dirty: true });
        await this.journal('families', f.id, 'upsert');
      }
      for (const m of old.media ?? []) {
        let blob: Blob | undefined;
        try {
          blob = await kvGet<Blob>(`media-blob:${m.id}`);
        } catch {
          blob = undefined;
        }
        if (!blob) continue;
        const remote = m.kind === 'image' && blob.size <= MAX_SYNCED_IMAGE_BYTES;
        await this.db.put('media', { id: m.id, exerciseId: m.exerciseId, kind: m.kind, mimeType: m.mimeType || blob.type, caption: m.caption, position: m.position, bytes: blob.size, createdAt: m.createdAt, blob, remote, updatedAt: stamp, deletedAt: null, dirty: remote });
        if (remote) await this.journal('media', m.id, 'upsert');
        await kvDel(`media-blob:${m.id}`).catch(() => {});
      }
      for (const e of old.exercises ?? []) {
        const { libraryId: _l, updatedAt: _u, ...fields } = e;
        const media = await this.mediaMetaOf(e.id);
        const first = media.find((m) => m.kind === 'image');
        const firstRecord = first ? await this.db.get('media', first.id) : undefined;
        const thumb = firstRecord?.blob ? await makeThumb(firstRecord.blob) : null;
        await this.db.put('exercises', { ...fields, media, thumb, updatedAt: stamp, deletedAt: null, dirty: true });
        await this.journal('exercises', e.id, 'upsert');
      }
      for (const s of old.sheets ?? []) {
        const { libraryId: _l, updatedAt: _u, ...fields } = s;
        await this.db.put('sheets', { ...fields, updatedAt: stamp, deletedAt: null, dirty: true });
        await this.journal('sheets', s.id, 'upsert');
      }
      await kvDel('kine-local-db-v2').catch(() => {});
    }
    await this.setMeta('migratedFromV2', true);
  }

  // ------------------------------------------------------------ mapping ---

  private toFamily(record: FamilyRecord): TagFamily {
    return { id: record.id, name: record.name, description: record.description, color: record.color, position: record.position, createdAt: record.createdAt };
  }

  private toTags(record: FamilyRecord): Tag[] {
    return record.tags.filter((t) => t.deletedAt === null).map((t) => ({ id: t.id, familyId: record.id, name: t.name, position: t.position, createdAt: t.createdAt }));
  }

  private toMedia(record: MediaRecord): Media {
    return {
      id: record.id,
      exerciseId: record.exerciseId,
      kind: record.kind,
      mimeType: record.mimeType,
      caption: record.caption,
      position: record.position,
      bytes: record.bytes,
      available: Boolean(record.blob),
      synced: record.remote,
      createdAt: record.createdAt,
    };
  }

  private async mediaOf(exerciseId: string): Promise<Media[]> {
    const records = await this.db.getAllFromIndex('media', 'byExercise', exerciseId);
    return records.filter(alive).sort((a, b) => a.position - b.position).map((m) => this.toMedia(m));
  }

  private async mediaMetaOf(exerciseId: string): Promise<MediaMeta[]> {
    const records = await this.db.getAllFromIndex('media', 'byExercise', exerciseId);
    return records
      .filter(alive)
      .sort((a, b) => a.position - b.position)
      .map(({ id, kind, mimeType, caption, position, bytes, createdAt }) => ({ id, kind, mimeType, caption, position, bytes, createdAt }));
  }

  private async toExercise(record: ExerciseRecord): Promise<Exercise> {
    const { dirty: _d, deletedAt: _x, media: _m, updatedAt, ...fields } = record;
    return { ...fields, dosage: { ...record.dosage }, tagIds: [...record.tagIds], media: await this.mediaOf(record.id), updatedAt: new Date(updatedAt).toISOString() };
  }

  private toSheet(record: SheetRecord): Sheet {
    const { dirty: _d, deletedAt: _x, updatedAt, ...fields } = record;
    return { ...fields, options: { ...record.options }, exerciseIds: [...record.exerciseIds], updatedAt: new Date(updatedAt).toISOString() };
  }

  // ------------------------------------------------------------ library ---

  async getLibrary(): Promise<Library> {
    return this.ensureLibrary();
  }

  async renameLibrary(name: string): Promise<void> {
    const library = await this.ensureLibrary();
    await this.setMeta('library', { ...library, name: name.trim() || library.name });
    await this.setMeta('libraryNameDirty', true);
    this.emit('local', 'library');
  }

  async loadSnapshot(): Promise<LibrarySnapshot> {
    const [familyRecords, exerciseRecords, sheetRecords] = await Promise.all([this.db.getAll('families'), this.db.getAll('exercises'), this.db.getAll('sheets')]);
    const families = familyRecords.filter(alive);
    const exercises = await Promise.all(exerciseRecords.filter(alive).map((e) => this.toExercise(e)));
    const knownTags = new Set(families.flatMap((f) => f.tags.filter((t) => t.deletedAt === null).map((t) => t.id)));
    const knownExercises = new Set(exercises.map((e) => e.id));
    return {
      families: families.map((f) => this.toFamily(f)),
      tags: families.flatMap((f) => this.toTags(f)),
      exercises: exercises.map((e) => ({ ...e, tagIds: e.tagIds.filter((id) => knownTags.has(id)) })),
      sheets: sheetRecords
        .filter(alive)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((s) => this.toSheet(s))
        .map((s) => ({ ...s, exerciseIds: s.exerciseIds.filter((id) => knownExercises.has(id)) })),
    };
  }

  // ----------------------------------------------------------- families ---

  private async liveFamilies(): Promise<FamilyRecord[]> {
    return (await this.db.getAll('families')).filter(alive);
  }

  private async putFamily(record: FamilyRecord): Promise<void> {
    await this.db.put('families', { ...record, updatedAt: now(), dirty: true });
    await this.journal('families', record.id, record.deletedAt === null ? 'upsert' : 'delete');
    this.emit('local', 'families');
  }

  async createFamily(input: Pick<TagFamily, 'name' | 'description' | 'color'>): Promise<TagFamily> {
    const name = input.name.trim();
    if (!name) throw new RepositoryError('Le nom de la famille est obligatoire.');
    const families = await this.liveFamilies();
    if (families.some((f) => sameName(f.name, name))) throw new RepositoryError(`La famille « ${name} » existe déjà.`);
    const record: FamilyRecord = { id: newId(), name, description: input.description, color: input.color, position: families.length, tags: [], createdAt: iso(), updatedAt: now(), deletedAt: null, dirty: true };
    await this.putFamily(record);
    return this.toFamily(record);
  }

  async updateFamily(id: string, patch: Partial<Pick<TagFamily, 'name' | 'description' | 'color' | 'position'>>): Promise<TagFamily> {
    const current = await this.db.get('families', id);
    if (!alive(current)) throw new RepositoryError('Famille introuvable.');
    const name = patch.name !== undefined ? patch.name.trim() : current.name;
    if (!name) throw new RepositoryError('Le nom de la famille est obligatoire.');
    const others = (await this.liveFamilies()).filter((f) => f.id !== id);
    if (others.some((f) => sameName(f.name, name))) throw new RepositoryError(`La famille « ${name} » existe déjà.`);
    const record: FamilyRecord = { ...current, ...patch, name };
    await this.putFamily(record);
    return this.toFamily(record);
  }

  async deleteFamily(id: string): Promise<void> {
    const current = await this.db.get('families', id);
    if (!current) return;
    // Exercises keep dangling tag ids: they are ignored when read and dropped at their next save.
    await this.putFamily({ ...current, deletedAt: now() });
  }

  // --------------------------------------------------------------- tags ---

  async createTag(familyId: string, rawName: string): Promise<Tag> {
    const family = await this.db.get('families', familyId);
    if (!alive(family)) throw new RepositoryError('Famille introuvable.');
    const name = rawName.trim();
    if (!name) throw new RepositoryError('Le nom du tag est obligatoire.');
    const live = family.tags.filter((t) => t.deletedAt === null);
    if (live.some((t) => sameName(t.name, name))) throw new RepositoryError(`Le tag « ${name} » existe déjà dans cette famille.`);
    const tag: TagRecord = { id: newId(), name, position: live.length, createdAt: iso(), updatedAt: now(), deletedAt: null };
    await this.putFamily({ ...family, tags: [...family.tags, tag] });
    return { id: tag.id, familyId, name, position: tag.position, createdAt: tag.createdAt };
  }

  private async familyOfTag(tagId: string): Promise<{ family: FamilyRecord; tag: TagRecord } | undefined> {
    for (const family of await this.liveFamilies()) {
      const tag = family.tags.find((t) => t.id === tagId && t.deletedAt === null);
      if (tag) return { family, tag };
    }
    return undefined;
  }

  async updateTag(id: string, patch: Partial<Pick<Tag, 'name' | 'position' | 'familyId'>>): Promise<Tag> {
    const found = await this.familyOfTag(id);
    if (!found) throw new RepositoryError('Tag introuvable.');
    const { family, tag } = found;
    const name = patch.name !== undefined ? patch.name.trim() : tag.name;
    if (!name) throw new RepositoryError('Le nom du tag est obligatoire.');
    const targetId = patch.familyId ?? family.id;
    const target = targetId === family.id ? family : await this.db.get('families', targetId);
    if (!alive(target)) throw new RepositoryError('Famille cible introuvable.');
    if (target.tags.some((t) => t.id !== id && t.deletedAt === null && sameName(t.name, name))) {
      throw new RepositoryError(`Le tag « ${name} » existe déjà dans cette famille.`);
    }
    const updated: TagRecord = { ...tag, name, position: patch.position ?? tag.position, updatedAt: now() };
    if (target.id === family.id) {
      await this.putFamily({ ...family, tags: family.tags.map((t) => (t.id === id ? updated : t)) });
    } else {
      await this.putFamily({ ...family, tags: family.tags.map((t) => (t.id === id ? { ...t, deletedAt: now(), updatedAt: now() } : t)) });
      await this.putFamily({ ...target, tags: [...target.tags.filter((t) => t.id !== id), { ...updated, position: target.tags.filter((t) => t.deletedAt === null).length }] });
    }
    return { id, familyId: target.id, name, position: updated.position, createdAt: tag.createdAt };
  }

  async deleteTag(id: string): Promise<void> {
    const found = await this.familyOfTag(id);
    if (!found) return;
    const stamp = now();
    await this.putFamily({ ...found.family, tags: found.family.tags.map((t) => (t.id === id ? { ...t, deletedAt: stamp, updatedAt: stamp } : t)) });
  }

  // ---------------------------------------------------------- exercises ---

  private async knownTagIds(): Promise<Set<string>> {
    return new Set((await this.liveFamilies()).flatMap((f) => f.tags.filter((t) => t.deletedAt === null).map((t) => t.id)));
  }

  private async cleanInput(input: ExerciseInput): Promise<ExerciseInput> {
    const name = input.name.trim();
    if (!name) throw new RepositoryError('Le nom de l’exercice est obligatoire.');
    const known = await this.knownTagIds();
    return { ...input, name, dosage: { ...input.dosage }, tagIds: [...new Set(input.tagIds)].filter((id) => known.has(id)) };
  }

  private async putExercise(record: ExerciseRecord): Promise<ExerciseRecord> {
    const saved: ExerciseRecord = { ...record, updatedAt: now(), dirty: true };
    await this.db.put('exercises', saved);
    await this.journal('exercises', record.id, record.deletedAt === null ? 'upsert' : 'delete');
    this.emit('local', 'exercises');
    return saved;
  }

  async createExercise(input: ExerciseInput): Promise<Exercise> {
    const clean = await this.cleanInput(input);
    const record: ExerciseRecord = { ...clean, id: newId(), media: [], thumb: null, createdAt: iso(), updatedAt: now(), deletedAt: null, dirty: true };
    return this.toExercise(await this.putExercise(record));
  }

  async updateExercise(id: string, input: ExerciseInput): Promise<Exercise> {
    const current = await this.db.get('exercises', id);
    if (!alive(current)) throw new RepositoryError('Exercice introuvable.');
    const clean = await this.cleanInput(input);
    return this.toExercise(await this.putExercise({ ...current, ...clean, media: await this.mediaMetaOf(id) }));
  }

  async deleteExercise(exercise: Exercise): Promise<void> {
    const current = await this.db.get('exercises', exercise.id);
    if (!current) return;
    const stamp = now();
    for (const media of await this.db.getAllFromIndex('media', 'byExercise', exercise.id)) {
      if (media.deletedAt !== null) continue;
      this.revoke(media.id);
      await this.db.put('media', { ...media, blob: undefined, deletedAt: stamp, updatedAt: stamp, dirty: media.remote });
      if (media.remote) await this.journal('media', media.id, 'delete');
    }
    // Sheets keep the id: it is ignored when read and dropped at their next save.
    await this.putExercise({ ...current, deletedAt: stamp });
  }

  async duplicateExercise(exercise: Exercise, name: string): Promise<Exercise> {
    const { id: _id, media, thumb: _t, createdAt: _c, updatedAt: _u, ...fields } = exercise;
    const created = await this.createExercise({ ...fields, name });
    let result = created;
    for (const item of media) {
      const source = await this.db.get('media', item.id);
      if (!source?.blob) continue;
      await this.uploadMedia(result, source.blob, item.kind, item.caption);
      result = (await this.toExercise((await this.db.get('exercises', created.id))!)) as Exercise;
    }
    return result;
  }

  // -------------------------------------------------------------- media ---

  async uploadMedia(exercise: Exercise, file: Blob, kind: MediaKind, caption = ''): Promise<Media> {
    const current = await this.db.get('exercises', exercise.id);
    if (!alive(current)) throw new RepositoryError('Exercice introuvable.');
    const existing = (await this.db.getAllFromIndex('media', 'byExercise', exercise.id)).filter(alive);
    const remote = kind === 'image' && file.size <= MAX_SYNCED_IMAGE_BYTES;
    const record: MediaRecord = {
      id: newId(),
      exerciseId: exercise.id,
      kind,
      mimeType: file.type,
      caption,
      position: existing.length,
      bytes: file.size,
      createdAt: iso(),
      blob: file,
      remote,
      updatedAt: now(),
      deletedAt: null,
      dirty: remote,
    };
    await this.db.put('media', record);
    if (remote) await this.journal('media', record.id, 'upsert');
    const thumb = current.thumb ?? (kind === 'image' ? await makeThumb(file) : null);
    await this.putExercise({ ...current, media: await this.mediaMetaOf(exercise.id), thumb });
    return this.toMedia(record);
  }

  async updateMedia(id: string, patch: Partial<Pick<Media, 'caption' | 'position'>>): Promise<Media> {
    const current = await this.db.get('media', id);
    if (!alive(current)) throw new RepositoryError('Média introuvable.');
    const updated: MediaRecord = { ...current, ...patch, updatedAt: now() };
    await this.db.put('media', updated);
    const exercise = await this.db.get('exercises', current.exerciseId);
    if (alive(exercise)) await this.putExercise({ ...exercise, media: await this.mediaMetaOf(exercise.id) });
    return this.toMedia(updated);
  }

  async deleteMedia(media: Media): Promise<void> {
    const current = await this.db.get('media', media.id);
    if (!current) return;
    const stamp = now();
    this.revoke(media.id);
    await this.db.put('media', { ...current, blob: undefined, deletedAt: stamp, updatedAt: stamp, dirty: current.remote });
    if (current.remote) await this.journal('media', media.id, 'delete');
    const exercise = await this.db.get('exercises', current.exerciseId);
    if (alive(exercise)) {
      const meta = await this.mediaMetaOf(exercise.id);
      let thumb = exercise.thumb;
      if (current.kind === 'image') {
        const nextImage = meta.find((m) => m.kind === 'image');
        const nextRecord = nextImage ? await this.db.get('media', nextImage.id) : undefined;
        thumb = nextRecord?.blob ? await makeThumb(nextRecord.blob) : null;
      }
      await this.putExercise({ ...exercise, media: meta, thumb });
    }
  }

  setMediaFetcher(fetcher: MediaFetcher | null): void {
    this.fetcher = fetcher;
  }

  async mediaBlob(media: Media): Promise<Blob> {
    const record = await this.db.get('media', media.id);
    if (record?.blob) return record.blob;
    if (record && record.remote && this.fetcher) {
      const blob = await this.fetcher(media.id);
      if (blob) {
        await this.storeMediaBlob(media.id, blob);
        return blob;
      }
      throw new RepositoryError('Image indisponible hors connexion : elle sera téléchargée dès que le réseau sera de retour.');
    }
    throw new RepositoryError('Fichier média introuvable sur cet appareil.');
  }

  async mediaUrl(media: Media): Promise<string> {
    const cached = this.objectUrls.get(media.id);
    if (cached) return cached;
    const blob = await this.mediaBlob(media);
    const url = URL.createObjectURL(blob);
    this.objectUrls.set(media.id, url);
    return url;
  }

  private revoke(id: string): void {
    const url = this.objectUrls.get(id);
    if (url && typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(url);
    this.objectUrls.delete(id);
  }

  // ------------------------------------------------------------- sheets ---

  async saveSheet(input: SheetInput, id?: string): Promise<Sheet> {
    const existing = id ? await this.db.get('sheets', id) : undefined;
    const liveExercises = new Set((await this.db.getAll('exercises')).filter(alive).map((e) => e.id));
    const record: SheetRecord = {
      id: existing?.id ?? newId(),
      title: input.title.trim() || 'Fiche sans titre',
      subtitle: input.subtitle,
      options: { ...input.options },
      exerciseIds: [...new Set(input.exerciseIds)].filter((eid) => liveExercises.has(eid)),
      createdAt: existing?.createdAt ?? iso(),
      updatedAt: now(),
      deletedAt: null,
      dirty: true,
    };
    await this.db.put('sheets', record);
    await this.journal('sheets', record.id, 'upsert');
    this.emit('local', 'sheets');
    return this.toSheet(record);
  }

  async deleteSheet(id: string): Promise<void> {
    const current = await this.db.get('sheets', id);
    if (!current) return;
    const stamp = now();
    await this.db.put('sheets', { ...current, deletedAt: stamp, updatedAt: stamp, dirty: true });
    await this.journal('sheets', id, 'delete');
    this.emit('local', 'sheets');
  }

  // -------------------------------------------------------------- clear ---

  async clearLibrary(): Promise<void> {
    const stamp = now();
    for (const collection of ['families', 'exercises', 'sheets'] as const) {
      for (const record of await this.db.getAll(collection)) {
        if (record.deletedAt !== null) continue;
        await this.db.put(collection, { ...record, deletedAt: stamp, updatedAt: stamp, dirty: true } as never);
        await this.journal(collection, record.id, 'delete');
      }
    }
    for (const media of await this.db.getAll('media')) {
      if (media.deletedAt !== null) continue;
      this.revoke(media.id);
      await this.db.put('media', { ...media, blob: undefined, deletedAt: stamp, updatedAt: stamp, dirty: media.remote });
      if (media.remote) await this.journal('media', media.id, 'delete');
    }
    this.emit('local', 'library');
  }
}
