import { describe, expect, it } from 'vitest';
import { LocalRepository, MemoryStore } from '../../src/data/localRepository';
import { EMPTY_EXERCISE } from '../../src/data/types';

describe('LocalRepository', () => {
  it('starts completely empty', async () => {
    const repo = new LocalRepository(new MemoryStore());
    const [library] = await repo.listLibraries();
    const snapshot = await repo.loadSnapshot(library.id);
    expect(snapshot).toEqual({ families: [], tags: [], exercises: [], sheets: [] });
  });

  it('keeps tag associations consistent when tags or families are removed', async () => {
    const repo = new LocalRepository(new MemoryStore());
    const [library] = await repo.listLibraries();
    const family = await repo.createFamily(library.id, { name: 'Pratique', description: '', color: 'sable' });
    const sitting = await repo.createTag(family.id, 'Assis');
    const standing = await repo.createTag(family.id, 'Debout');
    const exercise = await repo.createExercise(library.id, { ...EMPTY_EXERCISE, name: 'Transfert', tagIds: [sitting.id, standing.id] });
    expect(exercise.tagIds).toHaveLength(2);

    await repo.deleteTag(sitting.id);
    let snapshot = await repo.loadSnapshot(library.id);
    expect(snapshot.exercises[0].tagIds).toEqual([standing.id]);

    const renamed = await repo.updateTag(standing.id, { name: 'Debout avec appui' });
    expect(renamed.name).toBe('Debout avec appui');

    await repo.deleteFamily(family.id);
    snapshot = await repo.loadSnapshot(library.id);
    expect(snapshot.tags).toHaveLength(0);
    expect(snapshot.exercises[0].tagIds).toEqual([]);
  });

  it('refuses duplicate names within a family and empty names', async () => {
    const repo = new LocalRepository(new MemoryStore());
    const [library] = await repo.listLibraries();
    const family = await repo.createFamily(library.id, { name: 'Objectifs', description: '', color: 'sable' });
    await repo.createTag(family.id, 'Équilibre');
    await expect(repo.createTag(family.id, 'equilibre')).rejects.toThrow(/existe déjà/);
    await expect(repo.createTag(family.id, '   ')).rejects.toThrow(/obligatoire/);
    await expect(repo.createFamily(library.id, { name: 'OBJECTIFS', description: '', color: 'sable' })).rejects.toThrow(/existe déjà/);
    await expect(repo.createExercise(library.id, { ...EMPTY_EXERCISE, name: '' })).rejects.toThrow(/obligatoire/);
  });

  it('duplicates an exercise with its media and removes media with the exercise', async () => {
    const repo = new LocalRepository(new MemoryStore());
    const [library] = await repo.listLibraries();
    const exercise = await repo.createExercise(library.id, { ...EMPTY_EXERCISE, name: 'Pont fessier', precautions: 'Douleur lombaire' });
    await repo.uploadMedia(exercise, new Blob(['img'], { type: 'image/png' }), 'image', 'vue de côté');
    const copy = await repo.duplicateExercise({ ...exercise, media: (await repo.loadSnapshot(library.id)).exercises[0].media }, 'Pont fessier (copie)');
    expect(copy.name).toBe('Pont fessier (copie)');
    expect(copy.precautions).toBe('Douleur lombaire');
    expect(copy.media).toHaveLength(1);
    expect(copy.media[0].caption).toBe('vue de côté');

    const sheet = await repo.saveSheet(library.id, { title: 'Fiche', subtitle: '', options: (await import('../../src/data/types')).DEFAULT_SHEET_OPTIONS, exerciseIds: [exercise.id, copy.id] });
    await repo.deleteExercise(copy);
    const snapshot = await repo.loadSnapshot(library.id);
    expect(snapshot.exercises).toHaveLength(1);
    expect(snapshot.sheets.find((s) => s.id === sheet.id)?.exerciseIds).toEqual([exercise.id]);
    await expect(repo.mediaBlob(copy.media[0])).rejects.toThrow(/introuvable/);
  });
});
