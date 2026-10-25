// In-memory RemoteStore used by the unit tests (and usable as a reference
// for the expected backend behaviour). Counts reads and writes like Firestore.
import { RemoteError, type RemoteCollection, type RemoteDoc, type RemoteLibrary, type RemoteMediaDoc, type RemoteOp, type RemoteStore } from './types';

interface StoredDoc {
  updatedAt: number;
  deletedAt: number | null;
  data: Record<string, unknown> | null;
}

export class MemoryRemote implements RemoteStore {
  readonly maxBatch = 450;
  reads = 0;
  writes = 0;
  /** When set, every call fails with this error (to simulate offline/quota). */
  failWith: RemoteError | null = null;
  private clock = 1_000_000;
  libraries = new Map<string, RemoteLibrary>();
  docs = new Map<string, Map<string, StoredDoc>>();

  private tick(): number {
    this.clock += 1000;
    return this.clock;
  }

  private bucket(libraryId: string, collection: string): Map<string, StoredDoc> {
    const key = `${libraryId}/${collection}`;
    let map = this.docs.get(key);
    if (!map) {
      map = new Map();
      this.docs.set(key, map);
    }
    return map;
  }

  private guard(): void {
    if (this.failWith) throw this.failWith;
  }

  async getLibrary(libraryId: string): Promise<RemoteLibrary | null> {
    this.guard();
    this.reads += 1;
    return this.libraries.get(libraryId) ?? null;
  }

  async queryChanged<T>(libraryId: string, collection: RemoteCollection, sinceMs: number): Promise<RemoteDoc<T>[]> {
    this.guard();
    const result: RemoteDoc<T>[] = [];
    for (const [id, stored] of this.bucket(libraryId, collection)) {
      if (stored.updatedAt > sinceMs) {
        result.push({ id, updatedAt: stored.updatedAt, deletedAt: stored.deletedAt, data: stored.deletedAt !== null ? null : ({ id, ...stored.data } as T) });
      }
    }
    this.reads += Math.max(1, result.length);
    return result;
  }

  async getMedia(libraryId: string, mediaId: string): Promise<RemoteMediaDoc | null> {
    this.guard();
    this.reads += 1;
    const stored = this.bucket(libraryId, 'media').get(mediaId);
    if (!stored || stored.deletedAt !== null || !stored.data) return null;
    return stored.data as unknown as RemoteMediaDoc;
  }

  async commit(libraryId: string, ops: RemoteOp[]): Promise<void> {
    this.guard();
    if (ops.length > this.maxBatch) throw new RemoteError('Lot trop volumineux.', 'other');
    const stamp = this.tick();
    for (const op of ops) {
      this.writes += 1;
      switch (op.type) {
        case 'set':
          this.bucket(libraryId, op.collection).set(op.id, { updatedAt: stamp, deletedAt: null, data: { ...op.data } });
          break;
        case 'setMedia':
          this.bucket(libraryId, 'media').set(op.id, { updatedAt: stamp, deletedAt: null, data: { ...op.data } });
          break;
        case 'tombstone':
          this.bucket(libraryId, op.collection).set(op.id, { updatedAt: stamp, deletedAt: op.deletedAt, data: null });
          break;
        case 'purge':
          this.bucket(libraryId, op.collection).delete(op.id);
          break;
        case 'library': {
          const current = this.libraries.get(libraryId);
          this.libraries.set(libraryId, { name: op.name, syncToken: op.syncToken, updatedAt: stamp, ...(current ? {} : {}) });
          break;
        }
      }
    }
  }

  /** Test helper: number of live documents in a collection. */
  count(libraryId: string, collection: string): number {
    return [...this.bucket(libraryId, collection).values()].filter((d) => d.deletedAt === null).length;
  }
}
