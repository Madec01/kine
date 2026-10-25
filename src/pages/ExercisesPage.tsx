import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLibrary } from '../state/LibraryProvider';
import { useSelection } from '../state/SelectionProvider';
import { EMPTY_FILTERS, hasActiveFilters, searchExercises, sortFamilies, type FamilyMode, type SearchFilters, type SortKey } from '../domain/search';
import { FilterPanel } from '../components/FilterPanel';
import { TagChip } from '../components/TagChip';
import { ExerciseThumb, hasThumb } from '../components/MediaThumb';
import { Dialog, Difficulty, EmptyState } from '../components/ui';
import { IconCheck, IconClose, IconExercises, IconFilter, IconGrid, IconList, IconPlus, IconSearch } from '../components/icons';
import { excerpt, plural } from '../lib/format';
import type { Exercise } from '../data/types';

type View = 'cards' | 'list';

function readFilters(params: URLSearchParams): SearchFilters {
  const modes: Record<string, FamilyMode> = {};
  for (const id of (params.get('tous') ?? '').split(',').filter(Boolean)) modes[id] = 'all';
  const diff = Number(params.get('diff'));
  return {
    query: params.get('q') ?? '',
    tagIds: (params.get('tags') ?? '').split(',').filter(Boolean),
    familyModes: modes,
    difficulty: diff >= 1 && diff <= 5 ? diff : null,
    untaggedOnly: params.get('sans') === '1',
  };
}

export function ExercisesPage() {
  const { exercises, tags, families, tagById, familyById, canEdit } = useLibrary();
  const selection = useSelection();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const sort = (params.get('tri') as SortKey) || 'name';
  const [view, setView] = useState<View>(() => (localStorage.getItem('kine-view') as View) || 'cards');
  const [query, setQuery] = useState(filters.query);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('kine-view', view);
  }, [view]);

  // Always derived from the latest URL state (functional update), so a debounced
  // text search never overwrites a tag clicked in the meantime.
  const update = (patch: Partial<SearchFilters>, nextSort?: SortKey) => {
    setParams(
      (previous) => {
        const next = { ...readFilters(previous), ...patch };
        const out = new URLSearchParams();
        if (next.query.trim()) out.set('q', next.query.trim());
        if (next.tagIds.length) out.set('tags', next.tagIds.join(','));
        const all = Object.entries(next.familyModes).filter(([, m]) => m === 'all').map(([id]) => id);
        if (all.length) out.set('tous', all.join(','));
        if (next.difficulty) out.set('diff', String(next.difficulty));
        if (next.untaggedOnly) out.set('sans', '1');
        const s = nextSort ?? ((previous.get('tri') as SortKey) || 'name');
        if (s !== 'name') out.set('tri', s);
        return out;
      },
      { replace: true },
    );
  };

  // Debounced free-text search.
  useEffect(() => {
    if (query === filters.query) return;
    const handle = window.setTimeout(() => update({ query }), 180);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  useEffect(() => {
    setQuery(filters.query);
  }, [filters.query]);

  const results = useMemo(() => searchExercises(exercises, tags, filters, sort), [exercises, tags, filters, sort]);
  const active = hasActiveFilters(filters);
  const activeCount = filters.tagIds.length + (filters.difficulty ? 1 : 0) + (filters.untaggedOnly ? 1 : 0);
  const familyOrder = useMemo(() => new Map(sortFamilies(families).map((f, i) => [f.id, i])), [families]);

  const orderedTags = (exercise: Exercise) =>
    exercise.tagIds
      .map((id) => tagById.get(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .sort((a, b) => (familyOrder.get(a.familyId) ?? 0) - (familyOrder.get(b.familyId) ?? 0) || a.position - b.position);

  const allInSelection = results.length > 0 && results.every((e) => selection.has(e.id));

  if (exercises.length === 0) {
    return (
      <>
        <PageHead canEdit={canEdit} total={0} />
        <EmptyState
          icon={<IconExercises />}
          title="Votre bibliothèque est vide"
          action={
            canEdit ? (
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                <Link to="/exercices/nouveau" className="btn btn--primary">
                  <IconPlus /> Créer mon premier exercice
                </Link>
                <Link to="/tags" className="btn">
                  Préparer mes familles de tags
                </Link>
              </div>
            ) : undefined
          }
        >
          Créez vos propres exercices, puis classez-les avec des tags organisés en familles indépendantes (objectifs structurels, biomécanique, objectifs fonctionnels, caractéristiques pratiques…).
        </EmptyState>
      </>
    );
  }

  const filterPanel = <FilterPanel families={families} tags={tags} exercises={exercises} filters={filters} onChange={update} />;

  return (
    <>
      <PageHead canEdit={canEdit} total={exercises.length} />

      <div className="toolbar">
        <div className="search">
          <IconSearch />
          <input className="input" type="search" placeholder="Rechercher par nom…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Rechercher un exercice" />
          {query && (
            <button type="button" className="btn btn--ghost btn--icon btn--sm search__clear" onClick={() => setQuery('')} aria-label="Effacer la recherche">
              <IconClose />
            </button>
          )}
        </div>
        <button type="button" className="btn hide-desktop" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
          <IconFilter /> Filtres{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
        <select className="select" style={{ width: 'auto', minHeight: 44 }} value={sort} onChange={(e) => update({}, e.target.value as SortKey)} aria-label="Trier">
          <option value="name">Nom A→Z</option>
          <option value="updated">Dernière modification</option>
          <option value="created">Dernière création</option>
        </select>
        <div className="segmented" role="group" aria-label="Affichage">
          <button type="button" className={view === 'cards' ? 'is-active' : ''} onClick={() => setView('cards')} aria-label="Cartes" title="Cartes">
            <IconGrid width={18} height={18} />
          </button>
          <button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')} aria-label="Liste" title="Liste">
            <IconList width={18} height={18} />
          </button>
        </div>
      </div>

      {active && (
        <div className="active-filters" style={{ marginBottom: 12 }}>
          {filters.tagIds.map((id) => {
            const tag = tagById.get(id);
            if (!tag) return null;
            return (
              <button key={id} type="button" className="chip chip--btn chip--sm" data-color={familyById.get(tag.familyId)?.color} onClick={() => update({ tagIds: filters.tagIds.filter((x) => x !== id) })} aria-label={`Retirer le filtre ${tag.name}`}>
                {tag.name} <IconClose width={14} height={14} />
              </button>
            );
          })}
          {filters.difficulty && (
            <button type="button" className="chip chip--btn chip--sm" onClick={() => update({ difficulty: null })}>
              Difficulté {filters.difficulty} <IconClose width={14} height={14} />
            </button>
          )}
          {filters.untaggedOnly && (
            <button type="button" className="chip chip--btn chip--sm" onClick={() => update({ untaggedOnly: false })}>
              Sans tag <IconClose width={14} height={14} />
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setQuery(''); update({ ...EMPTY_FILTERS }); }}>
            Tout effacer
          </button>
        </div>
      )}

      <div className="layout-filters">
        <aside className="filters--rail hide-mobile" aria-label="Filtres">{filterPanel}</aside>

        <section aria-live="polite">
          <div className="results-head">
            <span>
              {plural(results.length, 'exercice')}
              {active ? ' correspondant aux critères' : ''}
            </span>
            {results.length > 0 && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => (allInSelection ? results.forEach((e) => selection.remove(e.id)) : selection.add(results.map((e) => e.id)))}
              >
                {allInSelection ? 'Retirer ces résultats de la sélection' : 'Tout ajouter à la sélection'}
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <EmptyState title="Aucun exercice ne correspond" action={<button type="button" className="btn" onClick={() => { setQuery(''); update({ ...EMPTY_FILTERS }); }}>Réinitialiser les filtres</button>}>
              Essayez un autre terme ou retirez un tag. Entre familles, les critères se cumulent (ET).
            </EmptyState>
          ) : view === 'cards' ? (
            <div className="cards">
              {results.map((exercise, i) => {
                const selected = selection.has(exercise.id);
                const chips = orderedTags(exercise);
                return (
                  <article key={exercise.id} className={`card card--link reveal ${selected ? 'card--selected' : ''}`} style={{ '--i': Math.min(i, 12) } as React.CSSProperties}>
                    {hasThumb(exercise) && (
                      <div className="card__thumb">
                        <ExerciseThumb exercise={exercise} />
                      </div>
                    )}
                    <h2 className="card__title">
                      <Link to={`/exercices/${exercise.id}`}>{exercise.name}</Link>
                    </h2>
                    <Difficulty value={exercise.difficulty} />
                    {exercise.description && <p className="card__excerpt">{excerpt(exercise.description)}</p>}
                    {chips.length > 0 && (
                      <div className="chips">
                        {chips.slice(0, 6).map((tag) => (
                          <TagChip key={tag.id} tag={tag} family={familyById.get(tag.familyId)} small />
                        ))}
                        {chips.length > 6 && <span className="chip chip--sm">+{chips.length - 6}</span>}
                      </div>
                    )}
                    <div className="card__foot">
                      <span className="small muted">{exercise.media.length > 0 ? plural(exercise.media.length, 'média') : ''}</span>
                      <button type="button" className={`btn btn--sm ${selected ? 'btn--soft' : ''}`} onClick={() => selection.toggle(exercise.id)} aria-pressed={selected}>
                        {selected ? <><IconCheck /> Sélectionné</> : <><IconPlus /> Sélectionner</>}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rows">
              {results.map((exercise, i) => {
                const selected = selection.has(exercise.id);
                const chips = orderedTags(exercise);
                return (
                  <div key={exercise.id} className={`row reveal ${selected ? 'row--selected' : ''}`} style={{ '--i': Math.min(i, 12) } as React.CSSProperties}>
                    <div className="row__thumb">
                      <ExerciseThumb exercise={exercise} />
                    </div>
                    <div className="row__body">
                      <Link to={`/exercices/${exercise.id}`} className="row__title">{exercise.name}</Link>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <Difficulty value={exercise.difficulty} />
                        {chips.slice(0, 4).map((tag) => (
                          <TagChip key={tag.id} tag={tag} family={familyById.get(tag.familyId)} small />
                        ))}
                        {chips.length > 4 && <span className="small muted">+{chips.length - 4}</span>}
                      </div>
                    </div>
                    <div className="row__actions">
                      <button type="button" className={`btn btn--icon btn--sm ${selected ? 'btn--soft' : ''}`} onClick={() => selection.toggle(exercise.id)} aria-pressed={selected} aria-label={selected ? 'Retirer de la sélection' : 'Ajouter à la sélection'}>
                        {selected ? <IconCheck /> : <IconPlus />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtres" sheet footer={<button type="button" className="btn btn--primary" onClick={() => setFiltersOpen(false)}>Voir {plural(results.length, 'exercice')}</button>}>
        {filterPanel}
      </Dialog>
    </>
  );
}

function PageHead({ canEdit, total }: { canEdit: boolean; total: number }) {
  return (
    <div className="page-head">
      <div className="page-head__text">
        <span className="eyebrow">Bibliothèque</span>
        <h1>Exercices</h1>
        {total > 0 && <p className="lede small">{plural(total, 'exercice')} au total.</p>}
      </div>
      {canEdit && (
        <Link to="/exercices/nouveau" className="btn btn--primary">
          <IconPlus /> Nouvel exercice
        </Link>
      )}
    </div>
  );
}
