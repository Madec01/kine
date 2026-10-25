import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLibrary } from '../state/LibraryProvider';
import { errorMessage, useToast } from '../state/ToastProvider';
import { ConfirmDialog, Dialog, Field } from '../components/ui';
import { TagChip } from '../components/TagChip';
import { MediaThumb } from '../components/MediaThumb';
import { IconBack, IconImage, IconPlus, IconTrash, IconVideo } from '../components/icons';
import { sortFamilies, tagsOfFamily } from '../domain/search';
import { ACCEPTED_IMAGES, ACCEPTED_VIDEOS, MAX_VIDEO_BYTES, formatBytes, isImageFile, isVideoFile, prepareImage } from '../lib/images';
import { DIFFICULTY_LABELS } from '../lib/format';
import { EMPTY_EXERCISE, type Exercise, type ExerciseInput, type Media } from '../data/types';

interface Pending {
  id: string;
  file: File;
  kind: 'image' | 'video';
  preview: string;
}

export function ExerciseFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getExercise, families, tags, familyById, canEdit, createExercise, updateExercise, createTag, uploadMedia, deleteMedia, updateMedia } = useLibrary();
  const { notify } = useToast();
  const existing = id ? getExercise(id) : undefined;
  const editing = Boolean(id);

  const [form, setForm] = useState<ExerciseInput>(() => (existing ? toInput(existing) : { ...EMPTY_EXERCISE, dosage: { ...EMPTY_EXERCISE.dosage }, tagIds: [] }));
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [newTag, setNewTag] = useState<Record<string, string>>({});
  const [mediaToDelete, setMediaToDelete] = useState<Media | null>(null);
  const [captionTarget, setCaptionTarget] = useState<Media | null>(null);
  const [caption, setCaption] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => pending.forEach((p) => URL.revokeObjectURL(p.preview)), [pending]);

  const set = <K extends keyof ExerciseInput>(key: K, value: ExerciseInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setDosage = (key: keyof ExerciseInput['dosage'], value: string) => setForm((f) => ({ ...f, dosage: { ...f.dosage, [key]: value } }));
  const toggleTag = (tagId: string) => set('tagIds', form.tagIds.includes(tagId) ? form.tagIds.filter((x) => x !== tagId) : [...form.tagIds, tagId]);

  const orderedFamilies = useMemo(() => sortFamilies(families), [families]);
  const hasVideoFile = Boolean(existing?.media.some((m) => m.kind === 'video') || pending.some((p) => p.kind === 'video'));

  if (!canEdit) {
    return <div className="notice notice--warn">Votre rôle ne permet pas de modifier cette bibliothèque.</div>;
  }
  if (editing && !existing) {
    return (
      <div className="empty">
        <h2>Exercice introuvable</h2>
        <Link to="/exercices" className="btn">Retour</Link>
      </div>
    );
  }

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Pending[] = [];
    for (const file of Array.from(files)) {
      if (isImageFile(file)) next.push({ id: crypto.randomUUID(), file, kind: 'image', preview: URL.createObjectURL(file) });
      else if (isVideoFile(file)) {
        if (file.size > MAX_VIDEO_BYTES) {
          notify(`« ${file.name} » dépasse ${formatBytes(MAX_VIDEO_BYTES)}. Hébergez la vidéo en ligne et collez son lien.`, 'danger');
          continue;
        }
        next.push({ id: crypto.randomUUID(), file, kind: 'video', preview: URL.createObjectURL(file) });
      } else notify(`« ${file.name} » : format non pris en charge.`, 'danger');
    }
    setPending((list) => [...list, ...next]);
  };

  const removePending = (pid: string) =>
    setPending((list) => {
      const item = list.find((p) => p.id === pid);
      if (item) URL.revokeObjectURL(item.preview);
      return list.filter((p) => p.id !== pid);
    });

  const uploadPending = async (target: Exercise) => {
    let current = target;
    for (const [index, item] of pending.entries()) {
      setStatus(`Envoi du média ${index + 1}/${pending.length}…`);
      const blob = item.kind === 'image' ? await prepareImage(item.file) : item.file;
      const media = await uploadMedia(current, blob, item.kind);
      current = { ...current, media: [...current.media, media] };
    }
    setPending([]);
  };

  const addTagInline = async (familyId: string) => {
    const name = (newTag[familyId] ?? '').trim();
    if (!name) return;
    try {
      const tag = await createTag(familyId, name);
      set('tagIds', [...form.tagIds, tag.id]);
      setNewTag((m) => ({ ...m, [familyId]: '' }));
    } catch (e) {
      notify(errorMessage(e), 'danger');
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      notify('Le nom de l’exercice est obligatoire.', 'danger');
      return;
    }
    setBusy(true);
    try {
      setStatus('Enregistrement…');
      const saved = editing && existing ? await updateExercise(existing.id, form) : await createExercise(form);
      if (pending.length > 0) await uploadPending(saved);
      notify(editing ? 'Exercice enregistré.' : 'Exercice créé.', 'ok');
      navigate(`/exercices/${saved.id}`, { replace: true });
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  const confirmDeleteMedia = async () => {
    if (!mediaToDelete) return;
    try {
      await deleteMedia(mediaToDelete);
      notify('Média supprimé.', 'ok');
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setMediaToDelete(null);
    }
  };

  const saveCaption = async () => {
    if (!captionTarget) return;
    try {
      await updateMedia(captionTarget, { caption: caption.trim() });
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setCaptionTarget(null);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid" style={{ maxWidth: 860 }}>
      <div className="page-head">
        <div className="page-head__text">
          <Link to={editing && existing ? `/exercices/${existing.id}` : '/exercices'} className="btn btn--ghost btn--sm" style={{ justifySelf: 'start', marginLeft: -12 }}>
            <IconBack /> {editing ? 'Fiche' : 'Exercices'}
          </Link>
          <h1>{editing ? 'Modifier l’exercice' : 'Nouvel exercice'}</h1>
          <p className="lede small">Seul le nom est obligatoire : laissez vides les champs sans intérêt pour cet exercice.</p>
        </div>
      </div>

      <section className="form-section">
        <h2>Identité</h2>
        <Field label="Nom *" htmlFor="name">
          <input id="name" className="input" required maxLength={160} value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus={!editing} />
        </Field>
        <Field label="Description" htmlFor="description" hint="Ce que travaille l’exercice, en quelques lignes.">
          <textarea id="description" className="textarea" value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="field">
          <span className="field__label">Niveau de difficulté</span>
          <div className="segmented segmented--diff" role="group" aria-label="Difficulté">
            <button type="button" className={form.difficulty === null ? 'is-active' : ''} onClick={() => set('difficulty', null)}>—</button>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" className={form.difficulty === n ? 'is-active' : ''} onClick={() => set('difficulty', n)} title={DIFFICULTY_LABELS[n]}>{n}</button>
            ))}
          </div>
          <span className="field__hint">{form.difficulty ? DIFFICULTY_LABELS[form.difficulty] : 'Non renseigné'}</span>
        </div>
      </section>

      <section className="form-section">
        <h2>Réalisation</h2>
        <Field label="Position de départ" htmlFor="start"><textarea id="start" className="textarea" style={{ minHeight: 70 }} value={form.startPosition} onChange={(e) => set('startPosition', e.target.value)} /></Field>
        <Field label="Matériel nécessaire" htmlFor="equipment"><input id="equipment" className="input" value={form.equipment} onChange={(e) => set('equipment', e.target.value)} placeholder="Chaise, barre, lest…" /></Field>
        <Field label="Consignes de réalisation" htmlFor="instructions"><textarea id="instructions" className="textarea" style={{ minHeight: 130 }} value={form.instructions} onChange={(e) => set('instructions', e.target.value)} /></Field>
      </section>

      <section className="form-section">
        <h2>Dosage</h2>
        <div className="form-grid form-grid--2">
          <Field label="Séries" htmlFor="sets"><input id="sets" className="input" value={form.dosage.sets} onChange={(e) => setDosage('sets', e.target.value)} placeholder="3" /></Field>
          <Field label="Répétitions" htmlFor="reps"><input id="reps" className="input" value={form.dosage.reps} onChange={(e) => setDosage('reps', e.target.value)} placeholder="8 à 12" /></Field>
          <Field label="Durée" htmlFor="duration"><input id="duration" className="input" value={form.dosage.duration} onChange={(e) => setDosage('duration', e.target.value)} placeholder="30 s" /></Field>
          <Field label="Récupération" htmlFor="rest"><input id="rest" className="input" value={form.dosage.rest} onChange={(e) => setDosage('rest', e.target.value)} placeholder="1 min" /></Field>
        </div>
      </section>

      <section className="form-section">
        <h2>Variantes et progressions</h2>
        <Field label="Variantes" htmlFor="variants"><textarea id="variants" className="textarea" style={{ minHeight: 80 }} value={form.variants} onChange={(e) => set('variants', e.target.value)} /></Field>
        <Field label="Progressions" htmlFor="progressions"><textarea id="progressions" className="textarea" style={{ minHeight: 80 }} value={form.progressions} onChange={(e) => set('progressions', e.target.value)} /></Field>
      </section>

      <section className="form-section">
        <h2>Sécurité et notes</h2>
        <Field label="Précautions et consignes de sécurité" htmlFor="precautions"><textarea id="precautions" className="textarea" style={{ minHeight: 80 }} value={form.precautions} onChange={(e) => set('precautions', e.target.value)} /></Field>
        <Field label="Notes personnelles" htmlFor="notes" hint="Jamais de données nominatives de résidents."><textarea id="notes" className="textarea" style={{ minHeight: 80 }} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </section>

      <section className="form-section">
        <h2>Images et vidéo</h2>
        <div className="media-grid">
          {existing?.media.map((m) => (
            <div key={m.id} className="media-tile">
              <MediaThumb media={m} alt={m.caption} />
              <button type="button" className="btn btn--icon btn--sm media-tile__remove" onClick={() => setMediaToDelete(m)} aria-label="Supprimer ce média"><IconTrash /></button>
              <button type="button" className="media-tile__caption" style={{ border: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => { setCaptionTarget(m); setCaption(m.caption); }}>
                {m.caption || 'Ajouter une légende'}{!m.synced && ' · appareil seulement'}
              </button>
            </div>
          ))}
          {pending.map((p) => (
            <div key={p.id} className="media-tile">
              {p.kind === 'image' ? <img src={p.preview} alt="" /> : <video src={p.preview} muted playsInline />}
              <button type="button" className="btn btn--icon btn--sm media-tile__remove" onClick={() => removePending(p.id)} aria-label="Retirer"><IconTrash /></button>
              <span className="media-tile__caption">À envoyer · {formatBytes(p.file.size)}</span>
            </div>
          ))}
          <button type="button" className="media-tile media-tile--add" onClick={() => imageInput.current?.click()}>
            <IconImage /> Images
          </button>
          {!hasVideoFile && (
            <button type="button" className="media-tile media-tile--add" onClick={() => videoInput.current?.click()}>
              <IconVideo /> Vidéo
            </button>
          )}
        </div>
        <input ref={imageInput} type="file" accept={ACCEPTED_IMAGES} multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <input ref={videoInput} type="file" accept={ACCEPTED_VIDEOS} hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <p className="field__hint">Les images sont redimensionnées (1600 px max) et sauvegardées en ligne. Une vidéo jointe (50 Mo max) reste sur cet appareil : pour la retrouver ailleurs et dans le PDF, indiquez plutôt un lien ci-dessous.</p>
        <Field label="Lien vidéo (YouTube, Vimeo, Drive…)" htmlFor="video" hint="Le lien figurera dans le PDF avec un QR code.">
          <input id="video" className="input" type="url" inputMode="url" value={form.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} placeholder="https://" />
        </Field>
      </section>

      <section className="form-section">
        <h2>Tags</h2>
        {orderedFamilies.length === 0 ? (
          <div className="notice">
            <div>Aucune famille de tags pour l’instant. Créez-les dans <Link to="/tags">Tags</Link> (par exemple : objectifs structurels, biomécanique, objectifs fonctionnels, caractéristiques pratiques).</div>
          </div>
        ) : (
          orderedFamilies.map((family) => {
            const list = tagsOfFamily(tags, family.id);
            return (
              <div key={family.id} className="tag-group" data-color={family.color}>
                <span className="tag-group__name"><span className="chip__dot" />{family.name}</span>
                <div className="chips" style={{ alignItems: 'center' }}>
                  {list.map((tag) => (
                    <TagChip key={tag.id} tag={tag} family={familyById.get(tag.familyId)} selected={form.tagIds.includes(tag.id)} onClick={() => toggleTag(tag.id)} />
                  ))}
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
                          void addTagInline(family.id);
                        }
                      }}
                    />
                    <button type="button" className="btn btn--icon btn--sm" onClick={() => void addTagInline(family.id)} aria-label="Ajouter le tag" disabled={!(newTag[family.id] ?? '').trim()}><IconPlus /></button>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </section>

      <div className="sticky-actions">
        {status && <span className="small muted" style={{ alignSelf: 'center', marginRight: 'auto', paddingLeft: 8 }}>{status}</span>}
        <Link to={editing && existing ? `/exercices/${existing.id}` : '/exercices'} className="btn btn--ghost">Annuler</Link>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer l’exercice'}</button>
      </div>

      <ConfirmDialog open={Boolean(mediaToDelete)} title="Supprimer ce média ?" message="Le fichier sera supprimé définitivement." confirmLabel="Supprimer" danger onConfirm={() => void confirmDeleteMedia()} onClose={() => setMediaToDelete(null)} />
      <Dialog open={Boolean(captionTarget)} onClose={() => setCaptionTarget(null)} title="Légende" footer={<><button type="button" className="btn btn--ghost" onClick={() => setCaptionTarget(null)}>Annuler</button><button type="button" className="btn btn--primary" onClick={() => void saveCaption()}>Enregistrer</button></>}>
        <input className="input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Ex. : position de départ" autoFocus />
      </Dialog>
    </form>
  );
}

function toInput(exercise: Exercise): ExerciseInput {
  const { id: _id, media: _m, thumb: _t, createdAt: _c, updatedAt: _u, ...rest } = exercise;
  return { ...rest, dosage: { ...rest.dosage }, tagIds: [...rest.tagIds] };
}
