// Sync engine: mirrors the local change journal to the online backup in
// batches, and pulls only what changed elsewhere. Designed around the free
// Firestore quota: no listeners, one read to detect changes, media on demand.
import type { LocalRepository } from '../data/localRepository';
import type { ExerciseRecord, FamilyRecord, LibraryMeta, OutboxRecord, QuotaCounter, SheetRecord } from '../data/localDb';
import { base64ToBlob, blobToBase64 } from '../lib/images';
import { chunk, coalesceOutbox, mergeExercise, mergeFamily, mergeSheet } from './merge';
import { RemoteError, type RemoteCollection, type RemoteOp, type RemoteStore, type SyncStatus } from './types';

export interface EngineOptions {
  /** Delay after the last local change before sending (default 60 s). */
  flushDelayMs: number;
  /** A continuous editing session is still sent after this delay (default 5 min). */
  maxFlushDelayMs: number;
  /** Minimum interval between two sends (default 30 s). */
  minFlushIntervalMs: number;
  /** Minimum interval between two automatic checks for remote changes (default 15 min). */
  pullIntervalMs: number;
  /** Internal daily caps, well below the free quota. */
  readsCap: number;
  writesCap: number;
  /** Safety margin subtracted from the last pull timestamp (clock skew). */
  pullSkewMs: number;
  now: () => number;
  isOnline: () => boolean;
}

const DEFAULTS: EngineOptions = {
  flushDelayMs: 60_000,
  maxFlushDelayMs: 300_000,
  minFlushIntervalMs: 30_000,
  pullIntervalMs: 15 * 60_000,
  readsCap: 5000,
  writesCap: 3000,
  pullSkewMs: 5 * 60_000,
  now: () => Date.now(),
  isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
};

const BACKOFF_MS = [30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000];
const today = (now: number): string => new Date(now).toISOString().slice(0, 10);

type Listener = (status: SyncStatus) => void;

export class SyncEngine {
  readonly options: EngineOptions;
  private status: SyncStatus;
  private listeners = new Set<Listener>();
  private remoteListeners = new Set<() => void>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private firstChangeAt: number | null = null;
  private lastFlushAt = 0;
  private lastPullAt = 0;
  private failures = 0;
  private running: Promise<void> | null = null;
  private stopFns: Array<() => void> = [];

  constructor(
    private readonly local: LocalRepository,
    private readonly remote: RemoteStore,
    private libraryId: string,
    options: Partial<EngineOptions> = {},
  ) {
    this.options = { ...DEFAULTS, ...options };
    this.status = { state: 'idle', pending: 0, lastSuccessAt: null, lastError: null, readsToday: 0, writesToday: 0, libraryId, missingMedia: 0 };
  }

  // -------------------------------------------------------------- status ---

  getStatus(): SyncStatus {
    return this.status;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  /** Called after remote changes were written locally: the UI should reload. */
  onRemoteApplied(listener: () => void): () => void {
    this.remoteListeners.add(listener);
    return () => this.remoteListeners.delete(listener);
  }

  private set(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((l) => l(this.status));
  }

  private async refreshCounts(): Promise<void> {
    const pending = coalesceOutbox(await this.local.listOutbox()).length;
    const missingMedia = (await this.local.listMissingMedia()).length;
    const quota = await this.quota();
    this.set({ pending, missingMedia, readsToday: quota.reads, writesToday: quota.writes, state: this.status.state === 'idle' && pending > 0 ? 'pending' : this.status.state });
  }

  private async quota(): Promise<QuotaCounter> {
    const stored = await this.local.getMeta<QuotaCounter>('quota');
    const day = today(this.options.now());
    return stored && stored.day === day ? stored : { day, reads: 0, writes: 0 };
  }

  private async count(kind: 'reads' | 'writes', n: number): Promise<void> {
    const quota = await this.quota();
    quota[kind] += n;
    await this.local.setMeta('quota', quota);
    this.set({ readsToday: quota.reads, writesToday: quota.writes });
  }

  // ----------------------------------------------------------- lifecycle ---

  async start(): Promise<void> {
    const savedSuccess = await this.local.getMeta<number>('lastSyncOk');
    this.set({ lastSuccessAt: savedSuccess ?? null });
    await this.refreshCounts();
    this.local.setMediaFetcher((id) => this.fetchMedia(id));
    this.stopFns.push(
      this.local.onChange((event) => {
        if (event.source === 'local') this.scheduleFlush();
      }),
    );
    if (typeof window !== 'undefined') {
      const onHide = () => {
        if (document.visibilityState === 'hidden') void this.flush('fermeture');
        else if (this.options.now() - this.lastPullAt > this.options.pullIntervalMs) void this.pull();
      };
      const onOnline = () => void this.flush('réseau');
      const onPageHide = () => void this.flush('fermeture');
      document.addEventListener('visibilitychange', onHide);
      window.addEventListener('pagehide', onPageHide);
      window.addEventListener('online', onOnline);
      this.stopFns.push(
        () => document.removeEventListener('visibilitychange', onHide),
        () => window.removeEventListener('pagehide', onPageHide),
        () => window.removeEventListener('online', onOnline),
      );
    }
    await this.pull();
    if (this.status.pending > 0) this.scheduleFlush(true);
  }

  stop(): void {
    this.stopFns.forEach((fn) => fn());
    this.stopFns = [];
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.local.setMediaFetcher(null);
  }

  private scheduleFlush(soon = false): void {
    const now = this.options.now();
    this.firstChangeAt ??= now;
    void this.refreshCounts();
    if (this.flushTimer) clearTimeout(this.flushTimer);
    const sinceFirst = now - this.firstChangeAt;
    const delay = soon ? 1000 : Math.max(1000, Math.min(this.options.flushDelayMs, this.options.maxFlushDelayMs - sinceFirst));
    this.flushTimer = setTimeout(() => void this.flush('minuterie'), delay);
  }

  // --------------------------------------------------------------- flush ---

  /** Sends the journal in one or more batches. Safe to call at any time. */
  flush(reason = 'manuel'): Promise<void> {
    if (this.running) return this.running;
    this.running = this.doFlush(reason).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async doFlush(reason: string): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const now = this.options.now();
    if (reason === 'minuterie' && now - this.lastFlushAt < this.options.minFlushIntervalMs) {
      this.flushTimer = setTimeout(() => void this.flush('minuterie'), this.options.minFlushIntervalMs);
      return;
    }
    const entries = coalesceOutbox(await this.local.listOutbox());
    const libraryNameDirty = Boolean(await this.local.getMeta<boolean>('libraryNameDirty'));
    if (entries.length === 0 && !libraryNameDirty) {
      this.firstChangeAt = null;
      this.set({ state: 'idle', pending: 0 });
      return;
    }
    if (!this.options.isOnline()) {
      this.set({ state: 'offline', pending: entries.length });
      return;
    }
    const quota = await this.quota();
    if (quota.writes + entries.length + 1 > this.options.writesCap) {
      this.set({ state: 'paused', pending: entries.length, lastError: 'Plafond d’écritures du jour atteint : la sauvegarde en ligne reprendra demain. Vos données restent sur cet appareil.' });
      return;
    }
    this.set({ state: 'syncing', pending: entries.length, lastError: null });
    try {
      const library = await this.local.ensureLibrary();
      const batches = chunk(entries, this.remote.maxBatch - 1);
      const token = crypto.randomUUID();
      for (const [index, batch] of batches.entries()) {
        const ops: RemoteOp[] = [];
        for (const entry of batch) ops.push(...(await this.opsFor(entry)));
        if (index === batches.length - 1) ops.push({ type: 'library', name: library.name, syncToken: token });
        if (ops.length > 0) {
          await this.remote.commit(this.libraryId, ops);
          await this.count('writes', ops.length);
        }
        for (const entry of batch) await this.local.markSynced(entry.collection, entry.id);
        await this.local.removeOutbox(batch);
      }
      if (batches.length === 0) {
        await this.remote.commit(this.libraryId, [{ type: 'library', name: library.name, syncToken: token }]);
        await this.count('writes', 1);
      }
      await this.local.setMeta('libraryNameDirty', false);
      await this.local.setMeta('syncToken', token);
      const stamp = this.options.now();
      this.lastFlushAt = stamp;
      this.firstChangeAt = null;
      this.failures = 0;
      await this.local.setMeta('lastSyncOk', stamp);
      this.set({ state: 'idle', lastSuccessAt: stamp, lastError: null });
      await this.refreshCounts();
      if (this.status.pending > 0) this.scheduleFlush();
    } catch (error) {
      this.handleError(error, entries.length);
    }
  }

  private async opsFor(entry: OutboxRecord): Promise<RemoteOp[]> {
    const deletedAt = this.options.now();
    switch (entry.collection) {
      case 'families': {
        const record = await this.local.getFamilyRecord(entry.id);
        if (!record || record.deletedAt !== null || entry.op === 'delete') return [{ type: 'tombstone', collection: 'families', id: entry.id, deletedAt: record?.deletedAt ?? deletedAt }];
        const { dirty: _d, updatedAt: _u, ...data } = record;
        return [{ type: 'set', collection: 'families', id: entry.id, data }];
      }
      case 'exercises': {
        const record = await this.local.getExerciseRecord(entry.id);
        if (!record || record.deletedAt !== null || entry.op === 'delete') return [{ type: 'tombstone', collection: 'exercises', id: entry.id, deletedAt: record?.deletedAt ?? deletedAt }];
        const { dirty: _d, updatedAt: _u, ...data } = record;
        return [{ type: 'set', collection: 'exercises', id: entry.id, data }];
      }
      case 'sheets': {
        const record = await this.local.getSheetRecord(entry.id);
        if (!record || record.deletedAt !== null || entry.op === 'delete') return [{ type: 'tombstone', collection: 'sheets', id: entry.id, deletedAt: record?.deletedAt ?? deletedAt }];
        const { dirty: _d, updatedAt: _u, ...data } = record;
        return [{ type: 'set', collection: 'sheets', id: entry.id, data }];
      }
      case 'media': {
        const record = await this.local.getMediaRecord(entry.id);
        if (!record || record.deletedAt !== null || entry.op === 'delete') return [{ type: 'tombstone', collection: 'media', id: entry.id, deletedAt: record?.deletedAt ?? deletedAt }];
        if (!record.blob || !record.remote) return [];
        return [{ type: 'setMedia', id: entry.id, data: { exerciseId: record.exerciseId, mimeType: record.mimeType, data: await blobToBase64(record.blob) } }];
      }
    }
  }

  private handleError(error: unknown, pending: number): void {
    const remoteError = error instanceof RemoteError ? error : new RemoteError(error instanceof Error ? error.message : String(error), 'other', error);
    if (remoteError.code === 'offline') {
      this.set({ state: 'offline', pending, lastError: null });
      return;
    }
    if (remoteError.code === 'quota') {
      this.set({ state: 'paused', pending, lastError: remoteError.message });
      return;
    }
    this.failures += 1;
    this.set({ state: 'error', pending, lastError: remoteError.message });
    if (remoteError.code !== 'denied') {
      const delay = BACKOFF_MS[Math.min(this.failures - 1, BACKOFF_MS.length - 1)];
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => void this.flush('nouvel essai'), delay);
    }
  }

  // ---------------------------------------------------------------- pull ---

  /** One read to detect changes; downloads only what changed since last time. */
  async pull(force = false): Promise<{ applied: number; checked: boolean }> {
    if (!this.options.isOnline()) {
      this.set({ state: this.status.pending > 0 ? 'offline' : this.status.state });
      return { applied: 0, checked: false };
    }
    const quota = await this.quota();
    if (quota.reads >= this.options.readsCap) {
      this.set({ state: 'paused', lastError: 'Plafond de lectures du jour atteint : la vérification en ligne reprendra demain.' });
      return { applied: 0, checked: false };
    }
    try {
      this.lastPullAt = this.options.now();
      const remoteLibrary = await this.remote.getLibrary(this.libraryId);
      await this.count('reads', 1);
      if (!remoteLibrary) return { applied: 0, checked: true };
      const knownToken = await this.local.getMeta<string>('syncToken');
      if (!force && remoteLibrary.syncToken === knownToken) return { applied: 0, checked: true };

      const lastPull = await this.local.getMeta<number>('lastPullAt');
      const since = lastPull ? lastPull - this.options.pullSkewMs : 0;
      let applied = 0;
      let maxUpdated = lastPull ?? 0;

      const families = await this.remote.queryChanged<Omit<FamilyRecord, 'dirty' | 'updatedAt'>>(this.libraryId, 'families', since);
      await this.count('reads', Math.max(1, families.length));
      for (const remoteDoc of families) {
        maxUpdated = Math.max(maxUpdated, remoteDoc.updatedAt);
        const decision = mergeFamily(await this.local.getFamilyRecord(remoteDoc.id), remoteDoc);
        if (decision.action === 'apply') {
          await this.local.applyRemote('families', decision.record);
          applied += 1;
        }
      }
      const exercises = await this.remote.queryChanged<Omit<ExerciseRecord, 'dirty' | 'updatedAt'>>(this.libraryId, 'exercises', since);
      await this.count('reads', Math.max(1, exercises.length));
      for (const remoteDoc of exercises) {
        maxUpdated = Math.max(maxUpdated, remoteDoc.updatedAt);
        const decision = mergeExercise(await this.local.getExerciseRecord(remoteDoc.id), remoteDoc);
        if (decision.action === 'apply') {
          await this.local.applyRemote('exercises', decision.record);
          applied += 1;
        }
      }
      const sheets = await this.remote.queryChanged<Omit<SheetRecord, 'dirty' | 'updatedAt'>>(this.libraryId, 'sheets', since);
      await this.count('reads', Math.max(1, sheets.length));
      for (const remoteDoc of sheets) {
        maxUpdated = Math.max(maxUpdated, remoteDoc.updatedAt);
        const decision = mergeSheet(await this.local.getSheetRecord(remoteDoc.id), remoteDoc);
        if (decision.action === 'apply') {
          await this.local.applyRemote('sheets', decision.record);
          applied += 1;
        }
      }

      const nameDirty = Boolean(await this.local.getMeta<boolean>('libraryNameDirty'));
      const library = await this.local.ensureLibrary();
      if (!nameDirty && remoteLibrary.name && remoteLibrary.name !== library.name) {
        await this.local.setMeta('library', { ...library, name: remoteLibrary.name } satisfies LibraryMeta);
        applied += 1;
      }
      await this.local.setMeta('lastPullAt', Math.max(maxUpdated, remoteLibrary.updatedAt));
      await this.local.setMeta('syncToken', remoteLibrary.syncToken);
      await this.refreshCounts();
      if (applied > 0) {
        this.local.notifyRemoteApplied();
        this.remoteListeners.forEach((l) => l());
      }
      if (this.status.state === 'error' || this.status.state === 'offline') this.set({ state: this.status.pending > 0 ? 'pending' : 'idle', lastError: null });
      return { applied, checked: true };
    } catch (error) {
      this.handleError(error, this.status.pending);
      return { applied: 0, checked: false };
    }
  }

  // --------------------------------------------------------------- media ---

  async fetchMedia(mediaId: string): Promise<Blob | null> {
    if (!this.options.isOnline()) return null;
    const quota = await this.quota();
    if (quota.reads >= this.options.readsCap) return null;
    try {
      const remoteDoc = await this.remote.getMedia(this.libraryId, mediaId);
      await this.count('reads', 1);
      if (!remoteDoc) return null;
      return base64ToBlob(remoteDoc.data, remoteDoc.mimeType);
    } catch (error) {
      this.handleError(error, this.status.pending);
      return null;
    }
  }

  /** Downloads every image known online but missing here; returns how many were fetched. */
  async downloadAllMedia(onProgress?: (done: number, total: number) => void): Promise<number> {
    const missing = await this.local.listMissingMedia();
    let done = 0;
    for (const media of missing) {
      const blob = await this.fetchMedia(media.id);
      if (!blob) break;
      await this.local.storeMediaBlob(media.id, blob);
      done += 1;
      onProgress?.(done, missing.length);
    }
    await this.refreshCounts();
    if (done > 0) {
      this.local.notifyRemoteApplied();
      this.remoteListeners.forEach((l) => l());
    }
    return done;
  }

  // ------------------------------------------------------------- library ---

  /**
   * Switches this device to another library key: local data is kept and will
   * be merged into that library at the next send; its content is downloaded.
   */
  async adoptLibrary(libraryId: string): Promise<void> {
    this.libraryId = libraryId;
    await this.local.setMeta('libraryId', libraryId);
    await this.local.setMeta('syncToken', null);
    await this.local.setMeta('lastPullAt', null);
    for (const collection of ['families', 'exercises', 'sheets', 'media'] as const) {
      for (const record of await this.local.db.getAll(collection)) {
        if (record.deletedAt !== null) continue;
        if (collection === 'media' && !(record as { remote: boolean }).remote) continue;
        await this.local.db.put(collection, { ...record, dirty: true } as never);
        await this.local.db.put('outbox', { key: `${collection}/${record.id}`, collection, id: record.id, op: 'upsert', changedAt: this.options.now() });
      }
    }
    await this.local.setMeta('libraryNameDirty', false);
    this.set({ libraryId, lastSuccessAt: null });
    await this.pull(true);
    await this.flush('changement de clé');
  }

  static collections(): RemoteCollection[] {
    return ['families', 'exercises', 'sheets'];
  }
}
