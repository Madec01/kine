import { describe, expect, it } from 'vitest';
import { LocalRepository } from '../../src/data/localRepository';
import { EMPTY_EXERCISE, DEFAULT_SHEET_OPTIONS } from '../../src/data/types';

let n = 0;
const open = () => LocalRepository.open(`test-local-${Date.now()}-${n++}`);

describe('LocalRepository', () => {
  it('starts completely empty with a library', async () => {
    const repo = await open();
    const library = await repo.getLibrary();
    expect(library.name).toBe('Ma bibliothèque');
    expect(await repo.loadSnapshot()).toEqual({ families: [], tags: [], exercises: [], sheets: [] });
    expect(await repo.listOutbox()).toEqual([]);
  });

  it('journals every change once per entity', async () => {
    const repo = await open();
    const family = await repo.createFamily({ name: 'Pratique', description: '', color: 'sable' });
    await repo.createTag(family.id, 'Assis');
    await repo.createTag(family.id, 'Debout');
    const exercise = await repo.createExercise({ ...EMPTY_EXERCISE, name: 'Transfert' });
    await repo.updateExercise(exercise.id, { ...EMPTY_EXERCISE, name: 'Transfert lit-fauteuil' });
    const outbox = await repo.listOutbox();
    expect(outbox.map((o) => o.key).sort()).toEqual([`exercises/${exercise.id}`, `families/${family.id}`]);
    expect(outbox.every((o) => o.op === 'upsert')).toBe(true);
  });

  it('keeps tag associations consistent when tags or families are removed', async () => {
    const repo = await open();
    const family = await repo.createFamily({ name: 'Pratique', description: '', color: 'sable' });
    const sitting = await repo.createTag(family.id, 'Assis');
    const standing = await repo.createTag(family.id, 'Debout');
    const exercise = await repo.createExercise({ ...EMPTY_EXERCISE, name: 'Transfert', tagIds: [sitting.id, standing.id] });
    expect(exercise.tagIds).toHaveLength(2);

    await repo.deleteTag(sitting.id);
    let snapshot = await repo.loadSnapshot();
    expect(snapshot.tags.map((t) => t.id)).toEqual([standing.id]);
    expect(snapshot.exercises[0].tagIds).toEqual([standing.id]);
    // The exercise itself was not rewritten (no extra write online).
    expect((await repo.listOutbox()).filter((o) => o.collection === 'exercises')).toHaveLength(1);

    const renamed = await repo.updateTag(standing.id, { name: 'Debout avec appui' });
    expect(renamed.name).toBe('Debout avec appui');

    await repo.deleteFamily(family.id);
    snapshot = await repo.loadSnapshot();
    expect(snapshot.families).toHaveLength(0);
    expect(snapshot.tags).toHaveLength(0);
    expect(snapshot.exercises[0].tagIds).toEqual([]);
    expect((await repo.listOutbox()).find((o) => o.key === `families/${family.id}`)?.op).toBe('delete');
  });

  it('moves a tag to another family keeping its id', async () => {
    const repo = await open();
    const a = await repo.createFamily({ name: 'A', description: '', color: 'sable' });
    const b = await repo.createFamily({ name: 'B', description: '', color: 'terre' });
    const tag = await repo.createTag(a.id, 'Marche');
    const exercise = await repo.createExercise({ ...EMPTY_EXERCISE, name: 'X', tagIds: [tag.id] });
    const moved = await repo.updateTag(tag.id, { familyId: b.id });
    expect(moved.familyId).toBe(b.id);
    const snapshot = await repo.loadSnapshot();
    expect(snapshot.tags).toEqual([expect.objectContaining({ id: tag.id, familyId: b.id })]);
    expect(snapshot.exercises.find((e) => e.id === exercise.id)?.tagIds).toEqual([tag.id]);
  });

  it('refuses duplicate names within a family and empty names', async () => {
    const repo = await open();
    const family = await repo.createFamily({ name: 'Objectifs', description: '', color: 'sable' });
    await repo.createTag(family.id, 'Équilibre');
    await expect(repo.createTag(family.id, 'equilibre')).rejects.toThrow(/existe déjà/);
    await expect(repo.createTag(family.id, '   ')).rejects.toThrow(/obligatoire/);
    await expect(repo.createFamily({ name: 'OBJECTIFS', description: '', color: 'sable' })).rejects.toThrow(/existe déjà/);
    await expect(repo.createExercise({ ...EMPTY_EXERCISE, name: '' })).rejects.toThrow(/obligatoire/);
  });

  it('stores media on the device, duplicates them and removes them with the exercise', async () => {
    const repo = await open();
    const exercise = await repo.createExercise({ ...EMPTY_EXERCISE, name: 'Pont fessier', precautions: 'Douleur lombaire' });
    const media = await repo.uploadMedia(exercise, new Blob(['img'], { type: 'image/png' }), 'image', 'vue de côté');
    expect(media.available).toBe(true);
    expect(media.synced).toBe(true);
    const video = await repo.uploadMedia(exercise, new Blob(['vid'], { type: 'video/mp4' }), 'video');
    expect(video.synced).toBe(false);
    expect((await repo.listOutbox()).filter((o) => o.collection === 'media')).toHaveLength(1);

    const withMedia = (await repo.loadSnapshot()).exercises[0];
    const copy = await repo.duplicateExercise(withMedia, 'Pont fessier (copie)');
    expect(copy.name).toBe('Pont fessier (copie)');
    expect(copy.precautions).toBe('Douleur lombaire');
    expect(copy.media).toHaveLength(2);
    expect(copy.media[0].caption).toBe('vue de côté');

    const sheet = await repo.saveSheet({ title: 'Fiche', subtitle: '', options: DEFAULT_SHEET_OPTIONS, exerciseIds: [exercise.id, copy.id] });
    await repo.deleteExercise(copy);
    const snapshot = await repo.loadSnapshot();
    expect(snapshot.exercises).toHaveLength(1);
    expect(snapshot.sheets.find((s) => s.id === sheet.id)?.exerciseIds).toEqual([exercise.id]);
    await expect(repo.mediaBlob(copy.media[0])).rejects.toThrow(/introuvable/);
  });

  it('persists across re-opening the same database', async () => {
    const name = `test-persist-${Date.now()}`;
    const repo = await LocalRepository.open(name);
    await repo.createExercise({ ...EMPTY_EXERCISE, name: 'Persisté' });
    repo.db.close();
    const again = await LocalRepository.open(name);
    expect((await again.loadSnapshot()).exercises.map((e) => e.name)).toEqual(['Persisté']);
  });
});
