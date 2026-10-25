import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthProvider';
import { useLibrary } from '../state/LibraryProvider';
import { useSelection } from '../state/SelectionProvider';
import { errorMessage, useToast } from '../state/ToastProvider';
import { ConfirmDialog, EmptyState, Field } from '../components/ui';
import { MediaThumb } from '../components/MediaThumb';
import { TagChip } from '../components/TagChip';
import { IconClose, IconDown, IconDownload, IconExternal, IconPlus, IconSheet, IconTrash, IconUp } from '../components/icons';
import { generateSheetPdf } from '../pdf/generate';
import { downloadBlob, openBlob, safeFilename } from '../lib/download';
import { formatDate, plural } from '../lib/format';
import type { Sheet, SheetOptions } from '../data/types';

const OPTION_LABELS: Array<[keyof SheetOptions, string]> = [
  ['description', 'Description'],
  ['instructions', 'Consignes'],
  ['startPosition', 'Position de départ'],
  ['equipment', 'Matériel'],
  ['dosage', 'Dosage'],
  ['images', 'Images'],
  ['precautions', 'Précautions'],
  ['tags', 'Tags'],
  ['variants', 'Variantes et progressions'],
  ['video', 'Lien vidéo + QR code'],
  ['notes', 'Notes personnelles'],
];

export function SelectionPage() {
  const { repo } = useAuth();
  const { exercises, families, tags, tagById, familyById, sheets, canEdit, saveSheet, deleteSheet } = useLibrary();
  const selection = useSelection();
  const { notify } = useToast();
  const [progress, setProgress] = useState('');
  const [lastPdf, setLastPdf] = useState<Blob | null>(null);
  const [sheetToDelete, setSheetToDelete] = useState<Sheet | null>(null);
  const [saving, setSaving] = useState(false);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const selected = useMemo(() => selection.ids.map((id) => byId.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e)), [selection.ids, byId]);

  // Drop ids of exercises deleted elsewhere.
  useEffect(() => {
    if (selected.length !== selection.ids.length) selection.setIds(selected.map((e) => e.id));
  }, [selected, selection]);

  const draft = selection.draft;
  const setOption = (key: keyof SheetOptions, value: boolean) => selection.setDraft({ options: { ...draft.options, [key]: value } });

  const generate = async () => {
    if (selected.length === 0) return;
    setLastPdf(null);
    try {
      const blob = await generateSheetPdf({
        title: draft.title,
        subtitle: draft.subtitle,
        options: draft.options,
        exercises: selected,
        families,
        tags,
        repo,
        onProgress: setProgress,
      });
      setLastPdf(blob);
      downloadBlob(blob, safeFilename(draft.title || 'fiche-exercices', 'pdf'));
      notify('PDF généré.', 'ok');
    } catch (e) {
      notify(`Génération impossible : ${errorMessage(e)}`, 'danger');
    } finally {
      setProgress('');
    }
  };

  const save = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      const sheet = await saveSheet({ title: draft.title.trim() || 'Fiche sans titre', subtitle: draft.subtitle, options: draft.options, exerciseIds: selected.map((e) => e.id) }, draft.sheetId ?? undefined);
      selection.setDraft({ sheetId: sheet.id, title: sheet.title });
      notify(draft.sheetId ? 'Fiche mise à jour.' : 'Fiche enregistrée.', 'ok');
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <span className="eyebrow">Fiche PDF</span>
          <h1>Sélection</h1>
          <p className="lede small">Ordonnez les exercices, choisissez les informations à imprimer, puis générez une fiche A4.</p>
        </div>
        <div className="btn-row">
          <Link to="/exercices" className="btn"><IconPlus /> Ajouter des exercices</Link>
          {selected.length > 0 && <button type="button" className="btn btn--ghost" onClick={() => selection.clear()}>Vider</button>}
        </div>
      </div>

      <div className="layout-split">
        <section aria-label="Exercices sélectionnés" style={{ display: 'grid', gap: 8 }}>
          {selected.length === 0 ? (
            <EmptyState icon={<IconSheet />} title="Aucun exercice sélectionné" action={<Link to="/exercices" className="btn btn--primary">Parcourir les exercices</Link>}>
              Depuis la liste des exercices, utilisez « Sélectionner » (ou « Tout ajouter ») pour composer votre fiche.
            </EmptyState>
          ) : (
            selected.map((exercise, index) => {
              const chips = exercise.tagIds.map((id) => tagById.get(id)).filter((t): t is NonNullable<typeof t> => Boolean(t)).slice(0, 4);
              return (
                <div key={exercise.id} className="sel-row reveal" style={{ '--i': index } as React.CSSProperties}>
                  <span className="sel-row__num">{index + 1}</span>
                  <div className="sel-row__thumb"><MediaThumb media={exercise.media.find((m) => m.kind === 'image')} /></div>
                  <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                    <Link to={`/exercices/${exercise.id}`} style={{ color: 'inherit', fontWeight: 700, textDecoration: 'none' }}>{exercise.name}</Link>
                    {chips.length > 0 && <div className="chips">{chips.map((t) => <TagChip key={t.id} tag={t} family={familyById.get(t.familyId)} small />)}</div>}
                  </div>
                  <div className="sel-row__actions">
                    <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => selection.move(index, -1)} disabled={index === 0} aria-label="Monter"><IconUp /></button>
                    <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => selection.move(index, 1)} disabled={index === selected.length - 1} aria-label="Descendre"><IconDown /></button>
                    <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => selection.remove(exercise.id)} aria-label="Retirer"><IconClose /></button>
                  </div>
                </div>
              );
            })
          )}

          {sheets.length > 0 && (
            <section className="form-section" style={{ marginTop: 10 }}>
              <h2>Fiches enregistrées</h2>
              <div className="rows">
                {sheets.map((sheet) => (
                  <div key={sheet.id} className="member">
                    <span className="member__mail">
                      <strong>{sheet.title}</strong>
                      <span className="small muted"> · {plural(sheet.exerciseIds.filter((id) => byId.has(id)).length, 'exercice')} · {formatDate(sheet.updatedAt)}</span>
                    </span>
                    <button type="button" className="btn btn--sm" onClick={() => { selection.loadSheet(sheet); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Charger</button>
                    {canEdit && <button type="button" className="btn btn--ghost btn--icon btn--sm btn--danger" onClick={() => setSheetToDelete(sheet)} aria-label="Supprimer la fiche"><IconTrash /></button>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>

        <aside className="form-section" aria-label="Paramètres de la fiche">
          <h2>{draft.sheetId ? 'Fiche enregistrée' : 'Nouvelle fiche'}</h2>
          <Field label="Titre de la fiche" htmlFor="sheet-title"><input id="sheet-title" className="input" value={draft.title} onChange={(e) => selection.setDraft({ title: e.target.value })} placeholder="Ex. : Programme équilibre — semaine 1" /></Field>
          <Field label="Sous-titre ou remarques" htmlFor="sheet-subtitle" hint="Imprimé sous le titre. Pas de nom de résident."><input id="sheet-subtitle" className="input" value={draft.subtitle} onChange={(e) => selection.setDraft({ subtitle: e.target.value })} /></Field>
          <div className="field">
            <span className="field__label">Informations à afficher</span>
            <div className="options-grid">
              {OPTION_LABELS.map(([key, label]) => (
                <label key={key} className="check"><input type="checkbox" checked={draft.options[key]} onChange={(e) => setOption(key, e.target.checked)} /> {label}</label>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <button type="button" className="btn btn--primary btn--block" onClick={() => void generate()} disabled={selected.length === 0 || Boolean(progress)}>
              <IconDownload /> {progress ? 'Génération…' : `Générer le PDF (${selected.length})`}
            </button>
            {progress && <span className="small muted" aria-live="polite">{progress}</span>}
            {lastPdf && !progress && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => openBlob(lastPdf)}><IconExternal /> Ouvrir le dernier PDF dans un onglet</button>
            )}
            {canEdit && (
              <button type="button" className="btn btn--block" onClick={() => void save()} disabled={selected.length === 0 || saving}>
                {saving ? 'Enregistrement…' : draft.sheetId ? 'Mettre à jour la fiche enregistrée' : 'Enregistrer cette fiche pour la réutiliser'}
              </button>
            )}
            {draft.sheetId && <button type="button" className="btn btn--ghost btn--sm" onClick={() => selection.setDraft({ sheetId: null })}>Détacher (enregistrer comme nouvelle fiche)</button>}
          </div>
        </aside>
      </div>

      <ConfirmDialog open={Boolean(sheetToDelete)} title={`Supprimer « ${sheetToDelete?.title ?? ''} » ?`} message="La fiche enregistrée sera supprimée ; les exercices sont conservés." confirmLabel="Supprimer" danger onConfirm={() => { const s = sheetToDelete; if (s) deleteSheet(s.id).then(() => { if (draft.sheetId === s.id) selection.setDraft({ sheetId: null }); notify('Fiche supprimée.', 'ok'); }).catch((e) => notify(errorMessage(e), 'danger')).finally(() => setSheetToDelete(null)); }} onClose={() => setSheetToDelete(null)} />
    </>
  );
}
