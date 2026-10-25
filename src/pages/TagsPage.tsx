import { useMemo, useState, type FormEvent } from 'react';
import { useLibrary } from '../state/LibraryProvider';
import { errorMessage, useToast } from '../state/ToastProvider';
import { ConfirmDialog, Dialog, EmptyState, Field } from '../components/ui';
import { TagChip } from '../components/TagChip';
import { IconDown, IconEdit, IconPlus, IconTags, IconTrash, IconUp } from '../components/icons';
import { countExercisesByTag, sortFamilies, tagsOfFamily } from '../domain/search';
import { plural } from '../lib/format';
import { FAMILY_COLORS, type FamilyColor, type Tag, type TagFamily } from '../data/types';

interface FamilyDraft {
  id: string | null;
  name: string;
  description: string;
  color: FamilyColor;
}

export function TagsPage() {
  const { families, tags, exercises, canEdit, createFamily, updateFamily, moveFamily, deleteFamily, createTag, updateTag, deleteTag } = useLibrary();
  const { notify } = useToast();
  const ordered = useMemo(() => sortFamilies(families), [families]);
  const counts = useMemo(() => countExercisesByTag(exercises), [exercises]);

  const [familyDraft, setFamilyDraft] = useState<FamilyDraft | null>(null);
  const [familyToDelete, setFamilyToDelete] = useState<TagFamily | null>(null);
  const [tagDraft, setTagDraft] = useState<{ tag: Tag; name: string; familyId: string } | null>(null);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [newTag, setNewTag] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await action();
      if (success) notify(success, 'ok');
      return true;
    } catch (e) {
      notify(errorMessage(e), 'danger');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitFamily = async (event: FormEvent) => {
    event.preventDefault();
    if (!familyDraft) return;
    const { id, ...input } = familyDraft;
    const ok = await run(() => (id ? updateFamily(id, input) : createFamily(input)), id ? 'Famille modifiée.' : 'Famille créée.');
    if (ok) setFamilyDraft(null);
  };

  const submitTag = async (event: FormEvent) => {
    event.preventDefault();
    if (!tagDraft) return;
    const patch: Partial<Pick<Tag, 'name' | 'familyId'>> = { name: tagDraft.name };
    if (tagDraft.familyId !== tagDraft.tag.familyId) patch.familyId = tagDraft.familyId;
    const ok = await run(() => updateTag(tagDraft.tag.id, patch), 'Tag modifié.');
    if (ok) setTagDraft(null);
  };

  const addTag = async (familyId: string) => {
    const name = (newTag[familyId] ?? '').trim();
    if (!name) return;
    const ok = await run(() => createTag(familyId, name));
    if (ok) setNewTag((m) => ({ ...m, [familyId]: '' }));
  };

  const familyUsage = (family: TagFamily) => {
    const ids = new Set(tagsOfFamily(tags, family.id).map((t) => t.id));
    return { tags: ids.size, exercises: exercises.filter((e) => e.tagIds.some((id) => ids.has(id))).length };
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <span className="eyebrow">Classement</span>
          <h1>Familles de tags</h1>
          <p className="lede small">Chaque famille est une dimension indépendante. Un exercice peut porter plusieurs tags d’une même famille et de familles différentes.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn--primary" onClick={() => setFamilyDraft({ id: null, name: '', description: '', color: FAMILY_COLORS[ordered.length % FAMILY_COLORS.length] })}>
            <IconPlus /> Nouvelle famille
          </button>
        )}
      </div>

      {ordered.length === 0 ? (
        <EmptyState
          icon={<IconTags />}
          title="Aucune famille pour l’instant"
          action={canEdit ? <button type="button" className="btn btn--primary" onClick={() => setFamilyDraft({ id: null, name: '', description: '', color: 'terre' })}><IconPlus /> Créer une famille</button> : undefined}
        >
          À titre d’illustration : « Objectifs structurels » (renforcement des membres inférieurs, mobilité de cheville…), « Biomécanique » (chaîne cinétique fermée, excentrique…), « Objectifs fonctionnels » (assis-debout, relevé du sol…), « Pratique » (assis, debout, avec appui…). Vous nommez librement vos familles et vos tags.
        </EmptyState>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {ordered.map((family, index) => {
            const list = tagsOfFamily(tags, family.id);
            return (
              <section key={family.id} className="family reveal" data-color={family.color} style={{ '--i': index } as React.CSSProperties}>
                <div className="family__head">
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div className="family__title">
                      <span className="chip__dot" style={{ width: 12, height: 12 }} />
                      <h2>{family.name}</h2>
                      <span className="badge">{plural(list.length, 'tag')}</span>
                    </div>
                    {family.description && <p className="small muted">{family.description}</p>}
                  </div>
                  {canEdit && (
                    <div className="btn-row">
                      <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => void run(() => moveFamily(family.id, -1))} disabled={index === 0 || busy} aria-label="Monter"><IconUp /></button>
                      <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => void run(() => moveFamily(family.id, 1))} disabled={index === ordered.length - 1 || busy} aria-label="Descendre"><IconDown /></button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFamilyDraft({ id: family.id, name: family.name, description: family.description, color: family.color })}><IconEdit /> Modifier</button>
                      <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={() => setFamilyToDelete(family)}><IconTrash /> Supprimer</button>
                    </div>
                  )}
                </div>
                <div className="chips" style={{ alignItems: 'center' }}>
                  {list.length === 0 && <span className="small muted">Aucun tag. Ajoutez-en ci-contre.</span>}
                  {list.map((tag) => (
                    <TagChip key={tag.id} tag={tag} family={family} count={counts.get(tag.id) ?? 0} onClick={canEdit ? () => setTagDraft({ tag, name: tag.name, familyId: tag.familyId }) : undefined} title={canEdit ? 'Renommer, déplacer ou supprimer' : undefined} />
                  ))}
                  {canEdit && (
                    <span className="inline-add">
                      <input
                        className="input"
                        placeholder="Nouveau tag"
                        aria-label={`Nouveau tag dans ${family.name}`}
                        value={newTag[family.id] ?? ''}
                        onChange={(e) => setNewTag((m) => ({ ...m, [family.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void addTag(family.id);
                          }
                        }}
                      />
                      <button type="button" className="btn btn--icon btn--sm" onClick={() => void addTag(family.id)} disabled={busy || !(newTag[family.id] ?? '').trim()} aria-label="Ajouter le tag"><IconPlus /></button>
                    </span>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(familyDraft)} onClose={() => setFamilyDraft(null)} title={familyDraft?.id ? 'Modifier la famille' : 'Nouvelle famille de tags'}>
        {familyDraft && (
          <form onSubmit={submitFamily} className="form-grid">
            <Field label="Nom *" htmlFor="family-name"><input id="family-name" className="input" required maxLength={80} value={familyDraft.name} onChange={(e) => setFamilyDraft({ ...familyDraft, name: e.target.value })} autoFocus placeholder="Ex. : Objectifs fonctionnels" /></Field>
            <Field label="Description" htmlFor="family-desc" hint="Facultatif : ce que regroupe cette dimension."><input id="family-desc" className="input" maxLength={200} value={familyDraft.description} onChange={(e) => setFamilyDraft({ ...familyDraft, description: e.target.value })} /></Field>
            <div className="field">
              <span className="field__label">Couleur</span>
              <div className="swatches">
                {FAMILY_COLORS.map((color) => (
                  <button key={color} type="button" className={`swatch ${familyDraft.color === color ? 'is-active' : ''}`} data-color={color} onClick={() => setFamilyDraft({ ...familyDraft, color })} aria-label={color} aria-pressed={familyDraft.color === color} />
                ))}
              </div>
            </div>
            <div className="dialog__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setFamilyDraft(null)}>Annuler</button>
              <button type="submit" className="btn btn--primary" disabled={busy || !familyDraft.name.trim()}>{familyDraft.id ? 'Enregistrer' : 'Créer'}</button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog open={Boolean(tagDraft)} onClose={() => setTagDraft(null)} title="Modifier le tag">
        {tagDraft && (
          <form onSubmit={submitTag} className="form-grid">
            <Field label="Nom *" htmlFor="tag-name"><input id="tag-name" className="input" required maxLength={80} value={tagDraft.name} onChange={(e) => setTagDraft({ ...tagDraft, name: e.target.value })} autoFocus /></Field>
            <Field label="Famille" htmlFor="tag-family">
              <select id="tag-family" className="select" value={tagDraft.familyId} onChange={(e) => setTagDraft({ ...tagDraft, familyId: e.target.value })}>
                {ordered.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
            <p className="small muted">Utilisé par {plural(counts.get(tagDraft.tag.id) ?? 0, 'exercice')}. Renommer ou déplacer le tag met à jour toutes ses associations.</p>
            <div className="dialog__foot" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="btn btn--ghost btn--danger" onClick={() => { setTagToDelete(tagDraft.tag); setTagDraft(null); }}><IconTrash /> Supprimer</button>
              <span className="btn-row">
                <button type="button" className="btn btn--ghost" onClick={() => setTagDraft(null)}>Annuler</button>
                <button type="submit" className="btn btn--primary" disabled={busy || !tagDraft.name.trim()}>Enregistrer</button>
              </span>
            </div>
          </form>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(tagToDelete)}
        title={`Supprimer le tag « ${tagToDelete?.name ?? ''} » ?`}
        message={<>Il sera retiré de {plural(counts.get(tagToDelete?.id ?? '') ?? 0, 'exercice')}. Les exercices eux-mêmes sont conservés.</>}
        confirmLabel="Supprimer"
        danger
        busy={busy}
        onConfirm={() => { const t = tagToDelete; if (t) void run(() => deleteTag(t.id), 'Tag supprimé.').then(() => setTagToDelete(null)); }}
        onClose={() => setTagToDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(familyToDelete)}
        title={`Supprimer la famille « ${familyToDelete?.name ?? ''} » ?`}
        message={familyToDelete ? (() => { const u = familyUsage(familyToDelete); return <>Ses {plural(u.tags, 'tag')} seront supprimés et retirés de {plural(u.exercises, 'exercice')}. Les exercices eux-mêmes sont conservés.</>; })() : null}
        confirmLabel="Supprimer la famille"
        danger
        busy={busy}
        onConfirm={() => { const f = familyToDelete; if (f) void run(() => deleteFamily(f.id), 'Famille supprimée.').then(() => setFamilyToDelete(null)); }}
        onClose={() => setFamilyToDelete(null)}
      />
    </>
  );
}
