import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLibrary } from '../state/LibraryProvider';
import { useSelection } from '../state/SelectionProvider';
import { errorMessage, useToast } from '../state/ToastProvider';
import { ConfirmDialog, Difficulty } from '../components/ui';
import { TagChip } from '../components/TagChip';
import { useMediaUrl } from '../components/MediaThumb';
import { IconBack, IconCheck, IconCopy, IconEdit, IconExternal, IconPlus, IconTrash } from '../components/icons';
import { sortFamilies, tagsOfFamily } from '../domain/search';
import { formatDate } from '../lib/format';
import type { Media } from '../data/types';

function MediaFigure({ media }: { media: Media }) {
  const url = useMediaUrl(media);
  return (
    <figure className={media.kind === 'video' ? 'is-video' : ''}>
      {url ? media.kind === 'video' ? <video src={url} controls playsInline preload="metadata" /> : <a href={url} target="_blank" rel="noopener"><img src={url} alt={media.caption} /></a> : <span className="small muted" style={{ padding: 8 }}>Chargement…</span>}
      {media.caption && <figcaption>{media.caption}</figcaption>}
    </figure>
  );
}

function Section({ title, text, warn }: { title: string; text: string; warn?: boolean }) {
  if (!text.trim()) return null;
  return (
    <section className={`section ${warn ? 'section--warn' : ''}`}>
      <h3>{title}</h3>
      <p className="prewrap">{text}</p>
    </section>
  );
}

export function ExerciseDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { getExercise, families, tags, familyById, canEdit, deleteExercise, duplicateExercise } = useLibrary();
  const selection = useSelection();
  const { notify } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const exercise = getExercise(id);

  if (!exercise) {
    return (
      <div className="empty">
        <h2>Exercice introuvable</h2>
        <p>Il a peut-être été supprimé.</p>
        <Link to="/exercices" className="btn">Retour aux exercices</Link>
      </div>
    );
  }

  const selected = selection.has(exercise.id);
  const dosage = exercise.dosage;
  const hasDosage = Boolean(dosage.sets || dosage.reps || dosage.duration || dosage.rest);
  const tagSet = new Set(exercise.tagIds);
  const groups = sortFamilies(families)
    .map((family) => ({ family, tags: tagsOfFamily(tags, family.id).filter((t) => tagSet.has(t.id)) }))
    .filter((g) => g.tags.length > 0);

  const onDuplicate = async () => {
    setBusy(true);
    try {
      const copy = await duplicateExercise(exercise);
      notify(`« ${copy.name} » créé.`, 'ok');
      navigate(`/exercices/${copy.id}/modifier`);
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      await deleteExercise(exercise);
      selection.remove(exercise.id);
      notify('Exercice supprimé.', 'ok');
      navigate('/exercices', { replace: true });
    } catch (e) {
      notify(errorMessage(e), 'danger');
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <Link to="/exercices" className="btn btn--ghost btn--sm" style={{ justifySelf: 'start', marginLeft: -12 }}>
            <IconBack /> Exercices
          </Link>
          <h1>{exercise.name}</h1>
          <Difficulty value={exercise.difficulty} showLabel />
        </div>
        <div className="btn-row">
          <button type="button" className={`btn ${selected ? 'btn--soft' : 'btn--primary'}`} onClick={() => selection.toggle(exercise.id)} aria-pressed={selected}>
            {selected ? <><IconCheck /> Dans la sélection</> : <><IconPlus /> Ajouter à la sélection</>}
          </button>
          {canEdit && (
            <>
              <Link to={`/exercices/${exercise.id}/modifier`} className="btn"><IconEdit /> Modifier</Link>
              <button type="button" className="btn" onClick={() => void onDuplicate()} disabled={busy}><IconCopy /> Dupliquer</button>
              <button type="button" className="btn btn--danger" onClick={() => setConfirmDelete(true)} disabled={busy}><IconTrash /> Supprimer</button>
            </>
          )}
        </div>
      </div>

      <div className="detail">
        <div style={{ display: 'grid', gap: 12 }}>
          <Section title="Description" text={exercise.description} />
          <Section title="Position de départ" text={exercise.startPosition} />
          <Section title="Matériel nécessaire" text={exercise.equipment} />
          <Section title="Consignes de réalisation" text={exercise.instructions} />
          {hasDosage && (
            <section className="section">
              <h3>Dosage</h3>
              <div className="dosage">
                {dosage.sets && <div className="dosage__cell"><b>{dosage.sets}</b><span>Séries</span></div>}
                {dosage.reps && <div className="dosage__cell"><b>{dosage.reps}</b><span>Répétitions</span></div>}
                {dosage.duration && <div className="dosage__cell"><b>{dosage.duration}</b><span>Durée</span></div>}
                {dosage.rest && <div className="dosage__cell"><b>{dosage.rest}</b><span>Récupération</span></div>}
              </div>
            </section>
          )}
          <Section title="Précautions et sécurité" text={exercise.precautions} warn />
          <Section title="Variantes" text={exercise.variants} />
          <Section title="Progressions" text={exercise.progressions} />
          <Section title="Notes personnelles" text={exercise.notes} />
          {exercise.videoUrl && (
            <section className="section">
              <h3>Vidéo (lien)</h3>
              <a href={exercise.videoUrl} target="_blank" rel="noopener" style={{ overflowWrap: 'anywhere', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                {exercise.videoUrl} <IconExternal width={16} height={16} />
              </a>
            </section>
          )}
          {!exercise.description && !exercise.instructions && !hasDosage && !exercise.precautions && (
            <div className="notice">Cette fiche ne contient que son nom pour l’instant.{canEdit && <> <Link to={`/exercices/${exercise.id}/modifier`}>Compléter</Link>.</>}</div>
          )}
        </div>

        <aside className="detail__aside">
          {exercise.media.length > 0 && (
            <section className="section">
              <h3>Images et vidéo</h3>
              <div className="gallery">
                {exercise.media.map((m) => <MediaFigure key={m.id} media={m} />)}
              </div>
            </section>
          )}
          <section className="section">
            <h3>Tags</h3>
            {groups.length === 0 ? (
              <p className="small muted">Aucun tag.{canEdit && <> <Link to={`/exercices/${exercise.id}/modifier`}>Classer cet exercice</Link>.</>}</p>
            ) : (
              <div className="tag-groups">
                {groups.map(({ family, tags: list }) => (
                  <div key={family.id} className="tag-group" data-color={family.color}>
                    <span className="tag-group__name"><span className="chip__dot" />{family.name}</span>
                    <div className="chips">
                      {list.map((tag) => (
                        <Link key={tag.id} to={`/exercices?tags=${tag.id}`} style={{ textDecoration: 'none' }}>
                          <TagChip tag={tag} family={familyById.get(tag.familyId)} small />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <p className="small muted">
            Créé le {formatDate(exercise.createdAt)}
            {exercise.updatedAt !== exercise.createdAt && <> · modifié le {formatDate(exercise.updatedAt)}</>}
          </p>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cet exercice ?"
        message={<>« {exercise.name} » et ses {exercise.media.length} média(s) seront supprimés définitivement. Les tags sont conservés.</>}
        confirmLabel="Supprimer"
        danger
        busy={busy}
        onConfirm={() => void onDelete()}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
