import { describe, expect, it } from 'vitest';
import { buildExport, parseExport, summarizeExport, dataUrlToBlob, ImportFormatError } from '../../src/domain/exportImport';
import { importExport } from '../../src/domain/importer';
import { LocalRepository } from '../../src/data/localRepository';
import { DEFAULT_SHEET_OPTIONS, EMPTY_EXERCISE } from '../../src/data/types';

let n = 0;
const open = () => LocalRepository.open(`test-export-${Date.now()}-${n++}`);

async function seededRepository() {
  const repo = await open();
  const library = await repo.getLibrary();
  const structural = await repo.createFamily({ name: 'Objectifs structurels', description: '', color: 'terre' });
  const functional = await repo.createFamily({ name: 'Objectifs fonctionnels', description: 'Gestes de la vie quotidienne', color: 'olive' });
  const renfo = await repo.createTag(structural.id, 'Renforcement MI');
  const sitStand = await repo.createTag(functional.id, 'Assis-debout');
  const exercise = await repo.createExercise({
    ...EMPTY_EXERCISE,
    name: 'Lever de chaise',
    description: 'Se lever sans les mains',
    dosage: { sets: '3', reps: '8', duration: '', rest: '1 min' },
    difficulty: 2,
    tagIds: [renfo.id, sitStand.id],
  });
  const png = new Blob([Uint8Array.from([137, 80, 78, 71])], { type: 'image/png' });
  await repo.uploadMedia(exercise, png, 'image', 'Position de départ');
  await repo.saveSheet({ title: 'Séance équilibre', subtitle: '', options: { ...DEFAULT_SHEET_OPTIONS }, exerciseIds: [exercise.id] });
  return { repo, library };
}

describe('export / import round trip', () => {
  it('exports the whole library and re-imports it into an empty one', async () => {
    const { repo, library } = await seededRepository();
    const snapshot = await repo.loadSnapshot();
    const mediaData = new Map<string, string>();
    for (const exercise of snapshot.exercises) {
      for (const media of exercise.media) {
        const blob = await repo.mediaBlob(media);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        mediaData.set(media.id, `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`);
      }
    }
    const file = buildExport(library, snapshot, mediaData);
    expect(summarizeExport(file)).toEqual({ families: 2, tags: 2, exercises: 1, media: 1, embeddedMedia: 1, sheets: 1 });

    const json = JSON.parse(JSON.stringify(file));
    const parsed = parseExport(json);

    const target = await open();
    const report = await importExport(target, parsed, 'merge', await target.loadSnapshot());
    expect(report).toMatchObject({ families: 2, tags: 2, exercises: 1, media: 1, sheets: 1, skippedMedia: 0 });

    const imported = await target.loadSnapshot();
    expect(imported.exercises[0].name).toBe('Lever de chaise');
    expect(imported.exercises[0].tagIds).toHaveLength(2);
    expect(imported.exercises[0].media[0].caption).toBe('Position de départ');
    expect(imported.sheets[0].exerciseIds).toEqual([imported.exercises[0].id]);
    const blob = await target.mediaBlob(imported.exercises[0].media[0]);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(Uint8Array.from([137, 80, 78, 71]));
  });

  it('merges tags by name instead of duplicating them', async () => {
    const { repo, library } = await seededRepository();
    const snapshot = await repo.loadSnapshot();
    const file = parseExport(JSON.parse(JSON.stringify(buildExport(library, snapshot, new Map()))));
    const report = await importExport(repo, file, 'merge', snapshot);
    expect(report.families).toBe(0);
    expect(report.tags).toBe(0);
    expect(report.exercises).toBe(1);
    expect(report.skippedMedia).toBe(1);
    const after = await repo.loadSnapshot();
    expect(after.tags).toHaveLength(2);
    expect(after.exercises).toHaveLength(2);
  });

  it('replace mode empties the library first', async () => {
    const { repo, library } = await seededRepository();
    const snapshot = await repo.loadSnapshot();
    const file = parseExport(JSON.parse(JSON.stringify(buildExport(library, snapshot, new Map()))));
    await importExport(repo, file, 'replace', snapshot);
    const after = await repo.loadSnapshot();
    expect(after.exercises).toHaveLength(1);
    expect(after.families).toHaveLength(2);
    expect(after.exercises[0].media).toHaveLength(0);
  });
});

describe('parseExport', () => {
  it('rejects foreign files with a clear message', () => {
    expect(() => parseExport({ hello: 'world' })).toThrow(ImportFormatError);
    expect(() => parseExport({ format: 'kine-bibliotheque', version: 99, families: [], exercises: [] })).toThrow(/Version/);
    expect(() => parseExport({ format: 'kine-bibliotheque', version: 1, families: [{ name: '' }], exercises: [] })).toThrow(/Famille/);
  });

  it('drops dangling tag and exercise references', () => {
    const parsed = parseExport({
      format: 'kine-bibliotheque',
      version: 1,
      families: [{ id: 'f', name: 'F', tags: [{ id: 't', name: 'T' }] }],
      exercises: [{ id: 'e', name: 'E', tags: ['t', 'ghost'], difficulty: 9 }],
      sheets: [{ id: 's', title: 'S', exerciseIds: ['e', 'nope'] }],
    });
    expect(parsed.exercises[0].tags).toEqual(['t']);
    expect(parsed.exercises[0].difficulty).toBeNull();
    expect(parsed.sheets[0].exerciseIds).toEqual(['e']);
    expect(parsed.families[0].color).toBe('sable');
  });

  it('decodes data URLs', async () => {
    const { blob, mimeType } = dataUrlToBlob('data:text/plain;base64,' + Buffer.from('bonjour').toString('base64'));
    expect(mimeType).toBe('text/plain');
    expect(await blob.text()).toBe('bonjour');
  });
});
