// IndexedDB schema of the device store. Each entity is one record carrying
// its own modification metadata, so that the sync engine can send only what
// changed and merge what other devices changed.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Dosage, FamilyColor, MediaKind, SheetOptions } from './types';

export interface TagRecord {
  id: string;
  name: string;
  position: number;
  createdAt: string;
  /** Milliseconds since epoch; server time once synced, local time otherwise. */
  updatedAt: number;
  deletedAt: number | null;
}

export interface FamilyRecord {
  id: string;
  name: string;
  description: string;
  color: FamilyColor;
  position: number;
  tags: TagRecord[];
  createdAt: string;
  updatedAt: number;
  deletedAt: number | null;
  /** Changed on this device and not yet sent to the online backup. */
  dirty: boolean;
}

export interface MediaMeta {
  id: string;
  kind: MediaKind;
  mimeType: string;
  caption: string;
  position: number;
  bytes: number;
  createdAt: string;
}

export interface ExerciseRecord {
  id: string;
  name: string;
  description: string;
  instructions: string;
  startPosition: string;
  equipment: string;
  dosage: Dosage;
  difficulty: number | null;
  variants: string;
  progressions: string;
  precautions: string;
  notes: string;
  videoUrl: string;
  tagIds: string[];
  /** Metadata of the media files, mirrored online inside the exercise document. */
  media: MediaMeta[];
  thumb: string | null;
  createdAt: string;
  updatedAt: number;
  deletedAt: number | null;
  dirty: boolean;
}

export interface MediaRecord extends MediaMeta {
  exerciseId: string;
  /** The file itself; absent when only known from the online backup. */
  blob?: Blob;
  /** Present (or queued) in the online backup. Videos are never sent. */
  remote: boolean;
  updatedAt: number;
  deletedAt: number | null;
  dirty: boolean;
}

export interface SheetRecord {
  id: string;
  title: string;
  subtitle: string;
  options: SheetOptions;
  exerciseIds: string[];
  createdAt: string;
  updatedAt: number;
  deletedAt: number | null;
  dirty: boolean;
}

export type OutboxCollection = 'families' | 'exercises' | 'media' | 'sheets';

export interface OutboxRecord {
  /** `${collection}/${id}` */
  key: string;
  collection: OutboxCollection;
  id: string;
  op: 'upsert' | 'delete';
  changedAt: number;
}

export interface LibraryMeta {
  id: string;
  name: string;
  createdAt: string;
}

export interface QuotaCounter {
  day: string;
  reads: number;
  writes: number;
}

export interface KineDB extends DBSchema {
  families: { key: string; value: FamilyRecord };
  exercises: { key: string; value: ExerciseRecord };
  media: { key: string; value: MediaRecord; indexes: { byExercise: string } };
  sheets: { key: string; value: SheetRecord };
  outbox: { key: string; value: OutboxRecord; indexes: { byCollection: string } };
  meta: { key: string; value: unknown };
}

export type KineDatabase = IDBPDatabase<KineDB>;

export const DB_NAME = 'kine-v3';

export function openKineDb(name = DB_NAME): Promise<KineDatabase> {
  return openDB<KineDB>(name, 1, {
    upgrade(db) {
      db.createObjectStore('families', { keyPath: 'id' });
      db.createObjectStore('exercises', { keyPath: 'id' });
      const media = db.createObjectStore('media', { keyPath: 'id' });
      media.createIndex('byExercise', 'exerciseId');
      db.createObjectStore('sheets', { keyPath: 'id' });
      const outbox = db.createObjectStore('outbox', { keyPath: 'key' });
      outbox.createIndex('byCollection', 'collection');
      db.createObjectStore('meta');
    },
  });
}

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

/** Tombstones older than this are purged once they have been sent. */
export const TOMBSTONE_TTL_MS = 60 * 24 * 60 * 60 * 1000;
