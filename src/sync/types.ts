// Contract between the sync engine and the online backend. The Firestore
// implementation lives in firestore.ts; tests use an in-memory one.
import type { ExerciseRecord, FamilyRecord, SheetRecord } from '../data/localDb';

export type RemoteCollection = 'families' | 'exercises' | 'sheets';

export interface RemoteLibrary {
  name: string;
  /** Changes whenever a device commits a batch; equal tokens mean nothing new. */
  syncToken: string;
  updatedAt: number;
}

/** Payload of an entity document as stored online (no local-only flags). */
export type RemoteFamily = Omit<FamilyRecord, 'dirty' | 'updatedAt'>;
export type RemoteExercise = Omit<ExerciseRecord, 'dirty' | 'updatedAt'>;
export type RemoteSheet = Omit<SheetRecord, 'dirty' | 'updatedAt'>;

export interface RemoteDoc<T> {
  id: string;
  /** Server timestamp of the last write, in milliseconds. */
  updatedAt: number;
  /** Null for a tombstone (deleted entity). */
  data: T | null;
  deletedAt: number | null;
}

export interface RemoteMediaDoc {
  exerciseId: string;
  mimeType: string;
  /** Base64 payload (no data URL prefix). */
  data: string;
}

export type RemoteOp =
  | { type: 'set'; collection: RemoteCollection; id: string; data: Record<string, unknown> }
  | { type: 'setMedia'; id: string; data: RemoteMediaDoc }
  | { type: 'tombstone'; collection: RemoteCollection | 'media'; id: string; deletedAt: number }
  | { type: 'purge'; collection: RemoteCollection | 'media'; id: string }
  | { type: 'library'; name: string; syncToken: string };

export interface RemoteStore {
  /** One read. Null when the library does not exist yet. */
  getLibrary(libraryId: string): Promise<RemoteLibrary | null>;
  /** Documents (including tombstones) changed strictly after `sinceMs`. */
  queryChanged<T>(libraryId: string, collection: RemoteCollection, sinceMs: number): Promise<RemoteDoc<T>[]>;
  /** One read. */
  getMedia(libraryId: string, mediaId: string): Promise<RemoteMediaDoc | null>;
  /** Atomic batch of at most `maxBatch` operations. */
  commit(libraryId: string, ops: RemoteOp[]): Promise<void>;
  readonly maxBatch: number;
}

export class RemoteError extends Error {
  constructor(message: string, readonly code: 'offline' | 'quota' | 'denied' | 'other', readonly cause?: unknown) {
    super(message);
    this.name = 'RemoteError';
  }
}

export type SyncState = 'disabled' | 'idle' | 'pending' | 'syncing' | 'offline' | 'error' | 'paused';

export interface SyncStatus {
  state: SyncState;
  pending: number;
  lastSuccessAt: number | null;
  lastError: string | null;
  readsToday: number;
  writesToday: number;
  libraryId: string | null;
  /** Images known online but not present on this device. */
  missingMedia: number;
}
