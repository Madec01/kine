import { Link } from 'react-router-dom';
import type { Exercise, Tag, TagFamily } from '../data/types';
import { countExercisesByTag, sortFamilies, tagsOfFamily, type FamilyMode, type SearchFilters } from '../domain/search';
import { DIFFICULTY_LABELS } from '../lib/format';
import { TagChip } from './TagChip';

interface Props {
  families: TagFamily[];
  tags: Tag[];
  exercises: Exercise[];
  filters: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
}

export function FilterPanel({ families, tags, exercises, filters, onChange }: Props) {
  const counts = countExercisesByTag(exercises);
  const selected = new Set(filters.tagIds);

  const toggleTag = (id: string) => {
    onChange({ tagIds: selected.has(id) ? filters.tagIds.filter((x) => x !== id) : [...filters.tagIds, id] });
  };
  const setMode = (familyId: string, mode: FamilyMode) => onChange({ familyModes: { ...filters.familyModes, [familyId]: mode } });

  if (families.length === 0) {
    return (
      <div className="filters">
        <div className="notice">
          <div>
            <strong>Aucune famille de tags.</strong> Créez vos familles (objectifs, biomécanique, fonction, pratique…) dans l’onglet{' '}
            <Link to="/tags">Tags</Link> pour filtrer vos exercices.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="filters">
      {sortFamilies(families).map((family) => {
        const familyTags = tagsOfFamily(tags, family.id);
        const chosen = familyTags.filter((t) => selected.has(t.id)).length;
        const mode = filters.familyModes[family.id] ?? 'any';
        return (
          <section key={family.id} className="filters__group" data-color={family.color} aria-label={family.name}>
            <div className="filters__title">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="chip__dot" />
                {family.name}
              </span>
              {chosen >= 2 && (
                <span className="mode-toggle" role="group" aria-label={`Combinaison dans ${family.name}`}>
                  <button type="button" className={mode === 'any' ? 'is-active' : ''} onClick={() => setMode(family.id, 'any')} title="Au moins un des tags cochés">
                    OU
                  </button>
                  <button type="button" className={mode === 'all' ? 'is-active' : ''} onClick={() => setMode(family.id, 'all')} title="Tous les tags cochés">
                    ET
                  </button>
                </span>
              )}
            </div>
            {familyTags.length === 0 ? (
              <span className="small muted">Aucun tag dans cette famille.</span>
            ) : (
              <div className="chips">
                {familyTags.map((tag) => (
                  <TagChip key={tag.id} tag={tag} family={family} selected={selected.has(tag.id)} count={counts.get(tag.id) ?? 0} onClick={() => toggleTag(tag.id)} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <section className="filters__group" aria-label="Difficulté">
        <div className="filters__title">Difficulté</div>
        <div className="segmented segmented--diff" role="group">
          <button type="button" className={filters.difficulty === null ? 'is-active' : ''} onClick={() => onChange({ difficulty: null })}>
            Toutes
          </button>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={filters.difficulty === n ? 'is-active' : ''} onClick={() => onChange({ difficulty: filters.difficulty === n ? null : n })} title={DIFFICULTY_LABELS[n]}>
              {n}
            </button>
          ))}
        </div>
      </section>

      <label className="check">
        <input type="checkbox" checked={filters.untaggedOnly} onChange={(e) => onChange({ untaggedOnly: e.target.checked })} />
        <span>Seulement les exercices sans tag</span>
      </label>
    </div>
  );
}
