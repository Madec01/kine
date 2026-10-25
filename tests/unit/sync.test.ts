import { describe, expect, it } from 'vitest';
import { LocalRepository } from '../../src/data/localRepository';
import { SyncEngine } from '../../src/sync/engine';
import { MemoryRemote } from '../../src/sync/memoryRemote';
import { RemoteError } from '../../src/sync/types';
import { coalesceOutbox, mergeEntity, mergeTags } from '../../src/sync/merge';
import { DEFAULT_SHEET_OPTIONS, EMPTY_EXERCISE } from '../../src/data/types';
import type { ExerciseRecord, OutboxRecord } from '../../src/data/localDb';

let n = 0;
const open = () => LocalRepository.open(`test-sync-${Date.now()}-${n++}`);
const KEY = 'abcdefghjkmnpqrstuvwxyz2';

async function device(remote: MemoryRemote, online = { value: true }) {
  const repo = await open();
  const engine = new SyncEngine(repo, remote, KEY, { isOnline: () => online.value, flushDelayMs: 1_000_000, minFlushIntervalMs: 0 });
  repo.setMediaFetcher((id) => engine.fetchMedia(id));
  return { repo, engine };
}

describe('SyncEngine', () => {
  it('sends only changed entities in one batch and clears the journal', async () => {
    const remote = new MemoryRemote();
    const a = await device(remote);
    const family = await a.repo.createFamily({ name: 'Objectifs', description: '', color: 'terre' });
    const tag = await a.repo.createTag(family.id, 'Équilibre');
    const exercise = await a.repo.createExercise({ ...EMPTY_EXERCISE, name: 'Unipodal', tagIds: [tag.id] });
    for (let i = 0; i < 10; i += 1) await a.repo.updateExercise(exercise.id, { ...EMPTY_EXERCISE, name: `Unipodal ${i}`, tagIds: [tag.id] });
    await a.repo.saveSheet({ title: 'Fiche', subtitle: '', options: DEFAULT_SHEET_OPTIONS, exerciseIds: [exercise.id] });

    await a.engine.flush();
    // family + exercise + sheet + library marker: 10 edits of the same exercise cost one write.
    expect(remote.writes).toBe(4);
    expect(remote.count(KEY, 'exercises')).toBe(1);
    expect(await a.repo.listOutbox()).toEqual([]);
    expect(a.engine.getStatus().state).toBe('idle');
    expect(a.engine.getStatus().writesToday).toBe(4);
    expect((await a.repo.getExerciseRecord(exercise.id))?.dirty).toBe(false);
  });

  it('a new device downloads everything once, then one read per check', async () => {
    const remote = new MemoryRemote();
    const a = await device(remote);
    const family = await a.repo.createFamily({ name: 'Objectifs', description: '', color: 'terre' });
    const tag = await a.repo.createTag(family.id, 'Équilibre');
    await a.repo.createExercise({ ...EMPTY_EXERCISE, name: 'Unipodal', tagIds: [tag.id] });
    await a.repo.createExercise({ ...EMPTY_EXERCISE, name: 'Tandem' });
    await a.engine.flush();

    const b = await device(remote);
    remote.reads = 0;
    await b.engine.pull();
    // 1 library read + 1 family + 2 exercises + 1 (empty sheet query minimum)
    expect(remote.reads).toBe(5);
    const snapshot = await b.repo.loadSnapshot();
    expect(snapshot.exercises.map((e) => e.name).sort()).toEqual(['Tandem', 'Unipodal']);
    expect(snapshot.tags).toHaveLength(1);
    expect(snapshot.exercises.find((e) => e.name === 'Unipodal')?.tagIds).toEqual([tag.id]);

    remote.reads = 0;
    await b.engine.pull();
    expect(remote.reads).toBe(1);
    expect(b.engine.getStatus().readsToday).toBe(6);
  });

  it('propagates an edit, a tag deletion and an exercise deletion between devices', async () => {
    const remote = new MemoryRemote();
    const a = await device(remote);
    const b = await device(remote);
    const family = await a.repo.createFamily({ name: 'Objectifs', description: '', color: 'terre' });
    const tag = await a.repo.createTag(family.id, 'Marche');
    const keep = await a.repo.createTag(family.id, 'Équilibre');
    const ex1 = await a.repo.createExercise({ ...EMPTY_EXERCISE, name: 'Un', tagIds: [tag.id, keep.id] });
    const ex2 = await a.repo.createExercise({ ...EMPTY_EXERCISE, name: 'Deux' });
    await a.engine.flush();
    await b.engine.pull();

    await a.repo.updateExercise(ex1.id, { ...EMPTY_EXERCISE, name: 'Un modifié', tagIds: [tag.id, keep.id] });
    await a.repo.deleteTag(tag.id);
    await a.repo.deleteExercise(ex2);
    await a.engine.flush();

    remote.reads = 0;
    await b.engine.pull();
    expect(remote.reads).toBe(1 + 1 + 2 + 1); // library, family, two exercises (edit + tombstone), empty sheets
    const snapshot = await b.repo.loadSnapshot();
    expect(snapshot.exercises.map((e) => e.name)).toEqual(['Un modifié']);
    expect(snapshot.tags.map((t) => t.name)).toEqual(['Équilibre']);
    expect(snapshot.exercises[0].tagIds).toEqual([keep.id]);
  });

  it('keeps a local edit that was not sent yet when a remote version arrives', async () => {
    const remote = new MemoryRemote();
    const a = await device(remote);
    const b = await device(remote);
    const ex = await a.repo.createExercise({ ...EMPTY_EXERCISE, name: 'Original' });
    await a.engine.flush();
    await b.engine.pull();

    await b.repo.updateExercise(ex.id, { ...EMPTY_EXERCISE, name: 'Version B (en cours)' });
    await a.repo.updateExercise(ex.id, { ...EMPTY_EXERCISE, name: 'Version A' });
    await a.engine.flush();
    await b.engine.pull(true);
    expect((await b.repo.loadSnapshot()).exercises[0].name).toBe('Version B (en cours)');
    await b.engine.flush();
    await a.engine.pull();
    expect((await a.repo.loadSnapshot()).exercises[0].name).toBe('Version B (en cours)');
  });

  it('sends images as separate documents and downloads them on demand only', async () => {
    const remote = new MemoryRemote();
    const a = await device(remote);
    const ex = await a.repo.createExercise({ ...EMPTY_EXERCISE, name: 'Avec image' });
    await a.repo.uploadMedia(ex, new Blob([Uint8Array.from([1, 2, 3, 4])], { type: 'image/png' }), 'image', 'départ');
    await a.repo.uploadMedia(ex, new Blob(['video'], { type: 'video/mp4' }), 'video');
    await a.engine.flush();
    expect(remote.count(KEY, 'media')).toBe(1); // the video stays on the device

    const b = await device(remote);
    await b.engine.pull();
    const [exercise] = (await b.repo.loadSnapshot()).exercises;
    expect(exercise.media).toHaveLength(2);
    const image = exercise.media.find((m) => m.kind === 'image')!;
    expect(image.available).toBe(false);
    expect(image.synced).toBe(true);
    expect(b.engine.getStatus().missingMedia).toBe(1);

    remote.reads = 0;
    const blob = await b.repo.mediaBlob(image);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(Uint8Array.from([1, 2, 3, 4]));
    expect(remote.reads).toBe(1);
    const again = await b.repo.mediaBlob(image);
    expect(again.size).toBe(4);
    expect(remote.reads).toBe(1); // cached on the device
  });

  it('keeps the journal while offline or on quota errors, and recovers', async () => {
    const remote = new MemoryRemote();
    const online = { value: false };
    const a = await device(remote, online);
    await a.repo.createExercise({ ...EMPTY_EXERCISE, name: 'Hors ligne' });
    await a.engine.flush();
    expect(a.engine.getStatus().state).toBe('offline');
    expect(remote.writes).toBe(0);
    expect(await a.repo.listOutbox()).toHaveLength(1);

    online.value = true;
    remote.failWith = new RemoteError('quota', 'quota');
    await a.engine.flush();
    expect(a.engine.getStatus().state).toBe('paused');
    expect(await a.repo.listOutbox()).toHaveLength(1);

    remote.failWith = null;
    await a.engine.flush();
    expect(a.engine.getStatus().state).toBe('idle');
    expect(remote.writes).toBe(2);
    expect(await a.repo.listOutbox()).toHaveLength(0);
  });

  it('respects the daily write cap', async () => {
    const remote = new MemoryRemote();
    const repo = await open();
    const engine = new SyncEngine(repo, remote, KEY, { isOnline: () => true, writesCap: 2, minFlushIntervalMs: 0 });
    await repo.createExercise({ ...EMPTY_EXERCISE, name: 'Un' });
    await repo.createExercise({ ...EMPTY_EXERCISE, name: 'Deux' });
    await engine.flush();
    expect(engine.getStatus().state).toBe('paused');
    expect(remote.writes).toBe(0);
  });

  it('adopting another key merges local data into that library', async () => {
    const remote = new MemoryRemote();
    const a = await device(remote);
    await a.repo.createExercise({ ...EMPTY_EXERCISE, name: 'De A' });
    await a.engine.flush();

    const b = await device(remote);
    await b.engine.adoptLibrary('zzzzzzzzzzzzzzzzzzzzzzzz');
    await b.repo.createExercise({ ...EMPTY_EXERCISE, name: 'De B' });
    await b.engine.flush();
    await b.engine.adoptLibrary(KEY);
    const names = (await b.repo.loadSnapshot()).exercises.map((e) => e.name).sort();
    expect(names).toEqual(['De A', 'De B']);
    await a.engine.pull();
    expect((await a.repo.loadSnapshot()).exercises.map((e) => e.name).sort()).toEqual(['De A', 'De B']);
  });
});

describe('merge rules', () => {
  const base: ExerciseRecord = { ...EMPTY_EXERCISE, id: 'x', media: [], thumb: null, createdAt: '', updatedAt: 100, deletedAt: null, dirty: false };

  it('applies a newer remote version and keeps a dirty local one', () => {
    const remote = { id: 'x', updatedAt: 200, deletedAt: null, data: { ...base, name: 'distant' } };
    expect(mergeEntity(base, remote)).toMatchObject({ action: 'apply', record: { name: 'distant', dirty: false } });
    expect(mergeEntity({ ...base, dirty: true, updatedAt: 300 }, remote)).toEqual({ action: 'keep-local' });
    expect(mergeEntity(base, { id: 'x', updatedAt: 200, deletedAt: 150, data: null })).toMatchObject({ action: 'apply', record: { deletedAt: 150 } });
    expect(mergeEntity(undefined, { id: 'x', updatedAt: 200, deletedAt: 150, data: null })).toEqual({ action: 'keep-local' });
  });

  it('merges tags by id', () => {
    const merged = mergeTags(
      [{ id: 'a', name: 'A', position: 0, createdAt: '', updatedAt: 10, deletedAt: null }],
      [
        { id: 'a', name: 'A renommé', position: 0, createdAt: '', updatedAt: 20, deletedAt: null },
        { id: 'b', name: 'B', position: 1, createdAt: '', updatedAt: 20, deletedAt: null },
      ],
    );
    expect(merged.map((t) => t.name)).toEqual(['A renommé', 'B']);
  });

  it('coalesces the journal', () => {
    const entries: OutboxRecord[] = [
      { key: 'exercises/1', collection: 'exercises', id: '1', op: 'upsert', changedAt: 1 },
      { key: 'exercises/1', collection: 'exercises', id: '1', op: 'delete', changedAt: 2 },
      { key: 'exercises/2', collection: 'exercises', id: '2', op: 'upsert', changedAt: 3 },
    ];
    expect(coalesceOutbox(entries)).toEqual([
      { key: 'exercises/1', collection: 'exercises', id: '1', op: 'delete', changedAt: 2 },
      { key: 'exercises/2', collection: 'exercises', id: '2', op: 'upsert', changedAt: 3 },
    ]);
  });
});
