import type { Exercise, Tag, TagFamily } from '../data/types';

/** Lowercase, accent-insensitive form used for all text matching. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .trim();
}

/** Within one family: match exercises having ANY selected tag, or ALL of them. */
export type FamilyMode = 'any' | 'all';

export interface SearchFilters {
  query: string;
  /** Selected tag ids, in any family. */
  tagIds: string[];
  /** Per-family combination mode; families absent default to 'any'. */
  familyModes: Record<string, FamilyMode>;
  difficulty: number | null;
  /** Only exercises without any tag (useful while classifying). */
  untaggedOnly: boolean;
}

export const EMPTY_FILTERS: SearchFilters = {
  query: '',
  tagIds: [],
  familyModes: {},
  difficulty: null,
  untaggedOnly: false,
};

export type SortKey = 'name' | 'updated' | 'created';

export function hasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.tagIds.length > 0 ||
    filters.difficulty !== null ||
    filters.untaggedOnly
  );
}

/** Groups the selected tag ids by family id, ignoring ids that no longer exist. */
export function groupSelectionByFamily(tagIds: string[], tags: Tag[]): Map<string, string[]> {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const groups = new Map<string, string[]>();
  for (const id of tagIds) {
    const tag = byId.get(id);
    if (!tag) continue;
    const list = groups.get(tag.familyId) ?? [];
    list.push(id);
    groups.set(tag.familyId, list);
  }
  return groups;
}

function matchesText(exercise: Exercise, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = normalize(`${exercise.name} ${exercise.description}`);
  return tokens.every((token) => haystack.includes(token));
}

/**
 * Multi-criteria search: text tokens must all appear in the name or
 * description; families are combined with AND; inside a family the mode is
 * 'any' (OR, default) or 'all' (AND).
 */
export function searchExercises(
  exercises: Exercise[],
  tags: Tag[],
  filters: SearchFilters,
  sort: SortKey = 'name',
): Exercise[] {
  const tokens = normalize(filters.query).split(/\s+/).filter(Boolean);
  const groups = groupSelectionByFamily(filters.tagIds, tags);

  const result = exercises.filter((exercise) => {
    if (!matchesText(exercise, tokens)) return false;
    if (filters.difficulty !== null && exercise.difficulty !== filters.difficulty) return false;
    if (filters.untaggedOnly && exercise.tagIds.length > 0) return false;
    const owned = new Set(exercise.tagIds);
    for (const [familyId, selected] of groups) {
      const mode = filters.familyModes[familyId] ?? 'any';
      const ok = mode === 'all' ? selected.every((id) => owned.has(id)) : selected.some((id) => owned.has(id));
      if (!ok) return false;
    }
    return true;
  });

  return sortExercises(result, sort);
}

export function sortExercises(exercises: Exercise[], sort: SortKey): Exercise[] {
  const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
  const copy = [...exercises];
  switch (sort) {
    case 'updated':
      copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || collator.compare(a.name, b.name));
      break;
    case 'created':
      copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || collator.compare(a.name, b.name));
      break;
    default:
      copy.sort((a, b) => collator.compare(a.name, b.name));
  }
  return copy;
}

/** Number of exercises carrying each tag (for counters in the UI). */
export function countExercisesByTag(exercises: Exercise[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const exercise of exercises) {
    for (const id of exercise.tagIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Tags of a family, in display order. */
export function tagsOfFamily(tags: Tag[], familyId: string): Tag[] {
  const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
  return tags
    .filter((t) => t.familyId === familyId)
    .sort((a, b) => a.position - b.position || collator.compare(a.name, b.name));
}

export function sortFamilies(families: TagFamily[]): TagFamily[] {
  const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
  return [...families].sort((a, b) => a.position - b.position || collator.compare(a.name, b.name));
}

/** Suggests the next free name when duplicating ("Nom (copie)", "Nom (copie 2)"…). */
export function duplicateName(name: string, existing: string[]): string {
  const taken = new Set(existing.map(normalize));
  let candidate = `${name} (copie)`;
  let n = 2;
  while (taken.has(normalize(candidate))) {
    candidate = `${name} (copie ${n})`;
    n += 1;
  }
  return candidate;
}
