import { describe, expect, it } from 'vitest';
import { countExercisesByTag, duplicateName, normalize, searchExercises, type SearchFilters } from '../../src/domain/search';
import { EMPTY_FILTERS } from '../../src/domain/search';
import type { Exercise, Tag } from '../../src/data/types';

const tag = (id: string, familyId: string): Tag => ({ id, familyId, name: id, position: 0, createdAt: '' });
const tags: Tag[] = [
  tag('renfo-mi', 'structurel'),
  tag('equilibre', 'structurel'),
  tag('ccf', 'biomeca'),
  tag('excentrique', 'biomeca'),
  tag('assis-debout', 'fonctionnel'),
  tag('marche', 'fonctionnel'),
];

const exercise = (id: string, name: string, tagIds: string[], extra: Partial<Exercise> = {}): Exercise => ({
  id,
  name,
  description: '',
  instructions: '',
  startPosition: '',
  equipment: '',
  dosage: { sets: '', reps: '', duration: '', rest: '' },
  difficulty: null,
  variants: '',
  progressions: '',
  precautions: '',
  notes: '',
  videoUrl: '',
  tagIds,
  media: [],
  thumb: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

const exercises: Exercise[] = [
  exercise('1', 'Lever de chaise', ['renfo-mi', 'ccf', 'assis-debout'], { difficulty: 2 }),
  exercise('2', 'Montée de marche', ['renfo-mi', 'ccf', 'marche'], { difficulty: 3 }),
  exercise('3', 'Équilibre unipodal', ['equilibre', 'marche']),
  exercise('4', 'Presse à cuisses', ['renfo-mi', 'excentrique']),
  exercise('5', 'Sans classement', []),
];

const filters = (patch: Partial<SearchFilters>): SearchFilters => ({ ...EMPTY_FILTERS, ...patch });

describe('normalize', () => {
  it('ignores case and accents', () => {
    expect(normalize('Équilibre Unipodal')).toBe('equilibre unipodal');
  });
});

describe('searchExercises', () => {
  it('returns everything sorted by name without filters', () => {
    expect(searchExercises(exercises, tags, EMPTY_FILTERS).map((e) => e.name)).toEqual([
      'Équilibre unipodal',
      'Lever de chaise',
      'Montée de marche',
      'Presse à cuisses',
      'Sans classement',
    ]);
  });

  it('matches text without accents', () => {
    expect(searchExercises(exercises, tags, filters({ query: 'equilibre' })).map((e) => e.id)).toEqual(['3']);
  });

  it('combines families with AND (structural + biomechanical + functional)', () => {
    const result = searchExercises(exercises, tags, filters({ tagIds: ['renfo-mi', 'ccf', 'assis-debout'] }));
    expect(result.map((e) => e.id)).toEqual(['1']);
  });

  it('uses OR inside a family by default', () => {
    const result = searchExercises(exercises, tags, filters({ tagIds: ['assis-debout', 'marche'] }));
    expect(result.map((e) => e.id).sort()).toEqual(['1', '2', '3']);
  });

  it('can require every tag of a family', () => {
    const result = searchExercises(exercises, tags, filters({ tagIds: ['renfo-mi', 'equilibre'], familyModes: { structurel: 'all' } }));
    expect(result).toHaveLength(0);
    const any = searchExercises(exercises, tags, filters({ tagIds: ['renfo-mi', 'equilibre'] }));
    expect(any).toHaveLength(4);
  });

  it('ignores selected tags that no longer exist', () => {
    const result = searchExercises(exercises, tags, filters({ tagIds: ['deleted-tag'] }));
    expect(result).toHaveLength(5);
  });

  it('filters by difficulty and untagged', () => {
    expect(searchExercises(exercises, tags, filters({ difficulty: 3 })).map((e) => e.id)).toEqual(['2']);
    expect(searchExercises(exercises, tags, filters({ untaggedOnly: true })).map((e) => e.id)).toEqual(['5']);
  });
});

describe('helpers', () => {
  it('counts exercises per tag', () => {
    const counts = countExercisesByTag(exercises);
    expect(counts.get('renfo-mi')).toBe(3);
    expect(counts.get('excentrique')).toBe(1);
    expect(counts.get('missing')).toBeUndefined();
  });

  it('suggests a free duplicate name', () => {
    expect(duplicateName('Pont', ['Pont'])).toBe('Pont (copie)');
    expect(duplicateName('Pont', ['Pont', 'pont (COPIE)'])).toBe('Pont (copie 2)');
  });
});
