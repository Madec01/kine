import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../state/AuthProvider';
import { useLibrary } from '../state/LibraryProvider';
import { errorMessage, useToast } from '../state/ToastProvider';
import { ConfirmDialog, Dialog, Field } from '../components/ui';
import { IconDownload, IconLogout, IconTrash, IconUpload } from '../components/icons';
import { buildExport, parseExport, summarizeExport, type ExportFile, type ExportSummary } from '../domain/exportImport';
import { importExport, type ImportMode, type ImportReport } from '../domain/importer';
import { blobToDataUrl, prepareImage } from '../lib/images';
import { downloadJson, safeFilename } from '../lib/download';
import { canPromptInstall, isIos, isStandalone, onInstallChange, promptInstall } from '../lib/install';
import { formatDate, plural } from '../lib/format';
import type { Invitation, Member, Role } from '../data/types';

export function SettingsPage() {
  const { repo, user } = useAuth();
  const lib = useLibrary();
  const { notify } = useToast();

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <span className="eyebrow">Compte, partage, sauvegarde</span>
          <h1>Réglages</h1>
        </div>
      </div>
      <div className="settings">
        <AccountSection />
        <LibrarySection />
        <SharingSection />
        <BackupSection />
        <InstallSection />
        <section className="form-section">
          <h2>À propos</h2>
          <dl className="kv">
            <dt>Version</dt><dd>2.0 · {repo.mode === 'supabase' ? 'Supabase' : 'stockage local'}</dd>
            <dt>Données</dt><dd>{plural(lib.exercises.length, 'exercice')}, {plural(lib.families.length, 'famille')}, {plural(lib.tags.length, 'tag')}, {plural(lib.sheets.length, 'fiche enregistrée', 'fiches enregistrées')}</dd>
            {user && <><dt>Compte</dt><dd style={{ overflowWrap: 'anywhere' }}>{user.email}</dd></>}
          </dl>
          <p className="small muted">Cette bibliothèque n’est pas un dossier patient : n’y enregistrez aucune donnée nominative de résident. Les dosages et précautions relèvent de votre évaluation clinique.</p>
          <button type="button" className="btn btn--ghost btn--sm" style={{ justifySelf: 'start' }} onClick={() => { notify('Rechargement…'); void lib.reload(); }}>Recharger les données</button>
        </section>
      </div>
    </>
  );
}

function AccountSection() {
  const { repo, user } = useAuth();
  const { notify } = useToast();
  const [pwdOpen, setPwdOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await repo.auth.updatePassword(password);
      notify('Mot de passe modifié.', 'ok');
      setPwdOpen(false);
      setPassword('');
    } catch (err) {
      notify(errorMessage(err), 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (repo.mode === 'local') {
    return (
      <section className="form-section">
        <h2>Mode local</h2>
        <div className="notice notice--warn">
          <div>
            <strong>Les données restent dans ce navigateur.</strong> Aucun compte, aucune synchronisation, aucun contrôle d’accès : ce mode sert à essayer l’application ou à travailler sur un seul appareil. Exportez régulièrement une sauvegarde.
          </div>
        </div>
        <p className="small muted">Pour un espace privé en ligne, sécurisé côté serveur et partageable avec des collègues, configurez Supabase (voir le README du dépôt) puis redéployez le site.</p>
      </section>
    );
  }

  return (
    <section className="form-section">
      <h2>Compte</h2>
      <dl className="kv">
        <dt>Connecté</dt><dd style={{ overflowWrap: 'anywhere' }}>{user?.email}</dd>
        <dt>Sécurité</dt><dd>Accès contrôlé par Supabase (authentification et politiques RLS en base de données).</dd>
      </dl>
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => setPwdOpen(true)}>Changer le mot de passe</button>
        <button type="button" className="btn btn--ghost" onClick={() => void repo.auth.signOut()}><IconLogout /> Se déconnecter</button>
      </div>
      <Dialog open={pwdOpen} onClose={() => setPwdOpen(false)} title="Nouveau mot de passe">
        <form onSubmit={changePassword} className="form-grid">
          <Field label="Mot de passe" htmlFor="new-password" hint="Au moins 6 caractères."><input id="new-password" className="input" type="password" minLength={6} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus /></Field>
          <div className="dialog__foot"><button type="button" className="btn btn--ghost" onClick={() => setPwdOpen(false)}>Annuler</button><button type="submit" className="btn btn--primary" disabled={busy}>Enregistrer</button></div>
        </form>
      </Dialog>
    </section>
  );
}

function LibrarySection() {
  const { library, libraries, isOwner, renameLibrary, switchLibrary } = useLibrary();
  const { notify } = useToast();
  const [name, setName] = useState(library?.name ?? '');
  useEffect(() => setName(library?.name ?? ''), [library?.name]);
  if (!library) return null;

  return (
    <section className="form-section">
      <h2>Bibliothèque</h2>
      {libraries.length > 1 && (
        <Field label="Bibliothèque active" htmlFor="lib-switch" hint="Vous avez accès à plusieurs bibliothèques (la vôtre et celles partagées avec vous).">
          <select id="lib-switch" className="select" value={library.id} onChange={(e) => switchLibrary(e.target.value)}>
            {libraries.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.role === 'owner' ? 'propriétaire' : l.role === 'editor' ? 'collaborateur' : 'lecteur'}</option>)}
          </select>
        </Field>
      )}
      {isOwner ? (
        <form className="form-grid" onSubmit={(e) => { e.preventDefault(); renameLibrary(name).then(() => notify('Nom enregistré.', 'ok')).catch((err) => notify(errorMessage(err), 'danger')); }}>
          <Field label="Nom de la bibliothèque" htmlFor="lib-name"><input id="lib-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <button type="submit" className="btn" style={{ justifySelf: 'start' }} disabled={name.trim() === library.name}>Renommer</button>
        </form>
      ) : (
        <p className="small muted">{library.name} — vous y accédez en tant que {library.role === 'editor' ? 'collaborateur' : 'lecteur'}.</p>
      )}
    </section>
  );
}

function SharingSection() {
  const { repo } = useAuth();
  const { library, isOwner, canEdit } = useLibrary();
  const { notify } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<Role, 'owner'>>('reader');
  const [busy, setBusy] = useState(false);
  const [toRemove, setToRemove] = useState<Member | null>(null);

  const refresh = async () => {
    if (!library || repo.mode === 'local') return;
    try {
      setMembers(await repo.listMembers(library.id));
      if (isOwner) setInvitations(await repo.listInvitations(library.id));
    } catch (e) {
      notify(errorMessage(e), 'danger');
    }
  };
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library?.id, isOwner]);

  if (repo.mode === 'local' || !library) {
    return (
      <section className="form-section">
        <h2>Partage</h2>
        <p className="small muted">Le partage avec des collègues (collaborateur ou lecteur) est disponible en mode Supabase : chaque personne se connecte avec son compte et ne voit que les bibliothèques auxquelles elle est invitée.</p>
      </section>
    );
  }

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await repo.invite(library.id, email, role);
      notify(`Invitation enregistrée pour ${email.trim()}. L’accès s’activera à sa prochaine connexion (compte créé avec cette adresse).`, 'ok');
      setEmail('');
      await refresh();
    } catch (err) {
      notify(errorMessage(err), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const roleName = (r: Role) => (r === 'owner' ? 'Propriétaire' : r === 'editor' ? 'Collaborateur' : 'Lecteur');

  return (
    <section className="form-section">
      <h2>Partage</h2>
      <p className="small muted">Propriétaire : tout gérer. Collaborateur : consulter et modifier. Lecteur : consulter et générer des PDF.</p>
      <div className="members">
        {members.map((m) => (
          <div key={m.userId} className="member">
            <span className="member__mail">{m.email || m.userId}</span>
            {isOwner && !m.isOwner ? (
              <>
                <select className="select" style={{ width: 'auto', minHeight: 36, padding: '4px 32px 4px 10px' }} value={m.role} onChange={(e) => repo.setMemberRole(library.id, m.userId, e.target.value as Exclude<Role, 'owner'>).then(refresh).catch((err) => notify(errorMessage(err), 'danger'))} aria-label={`Rôle de ${m.email}`}>
                  <option value="editor">Collaborateur</option>
                  <option value="reader">Lecteur</option>
                </select>
                <button type="button" className="btn btn--ghost btn--icon btn--sm btn--danger" onClick={() => setToRemove(m)} aria-label="Retirer l’accès"><IconTrash /></button>
              </>
            ) : (
              <span className="badge">{roleName(m.role)}</span>
            )}
          </div>
        ))}
        {invitations.map((inv) => (
          <div key={inv.id} className="member">
            <span className="member__mail">{inv.email}</span>
            <span className="badge badge--warn">Invitation · {roleName(inv.role)}</span>
            <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => repo.cancelInvitation(inv.id).then(refresh).catch((err) => notify(errorMessage(err), 'danger'))} aria-label="Annuler l’invitation"><IconTrash /></button>
          </div>
        ))}
      </div>
      {isOwner && (
        <form className="form-grid" onSubmit={invite}>
          <div className="form-grid form-grid--2">
            <Field label="Adresse e-mail du collègue" htmlFor="invite-mail"><input id="invite-mail" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Rôle" htmlFor="invite-role">
              <select id="invite-role" className="select" value={role} onChange={(e) => setRole(e.target.value as Exclude<Role, 'owner'>)}>
                <option value="reader">Lecteur</option>
                <option value="editor">Collaborateur</option>
              </select>
            </Field>
          </div>
          <button type="submit" className="btn btn--primary" style={{ justifySelf: 'start' }} disabled={busy}>Inviter</button>
          <p className="small muted">La personne doit créer un compte avec exactement cette adresse (ou être invitée depuis le tableau de bord Supabase si les inscriptions sont fermées).</p>
        </form>
      )}
      {!isOwner && canEdit && <p className="small muted">Seul le propriétaire gère les accès.</p>}
      <ConfirmDialog open={Boolean(toRemove)} title="Retirer l’accès ?" message={<>{toRemove?.email} n’aura plus accès à « {library.name} ».</>} confirmLabel="Retirer" danger onConfirm={() => { const m = toRemove; if (m) repo.removeMember(library.id, m.userId).then(refresh).catch((err) => notify(errorMessage(err), 'danger')).finally(() => setToRemove(null)); }} onClose={() => setToRemove(null)} />
    </section>
  );
}

function BackupSection() {
  const { repo } = useAuth();
  const lib = useLibrary();
  const { notify } = useToast();
  const [withImages, setWithImages] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [file, setFile] = useState<ExportFile | null>(null);
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [progress, setProgress] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    if (!lib.library) return;
    setExporting('Préparation…');
    try {
      const snapshot = { families: lib.families, tags: lib.tags, exercises: lib.exercises, sheets: lib.sheets };
      const mediaData = new Map<string, string>();
      if (withImages) {
        const all = lib.exercises.flatMap((e) => e.media.filter((m) => m.kind === 'image'));
        for (const [i, media] of all.entries()) {
          setExporting(`Images ${i + 1}/${all.length}…`);
          try {
            const blob = await prepareImage(await repo.mediaBlob(media), { maxSize: 1600 });
            mediaData.set(media.id, await blobToDataUrl(blob));
          } catch {
            /* the image is listed without its data */
          }
        }
      }
      const data = buildExport(lib.library, snapshot, mediaData);
      downloadJson(data, safeFilename(`kine-${lib.library.name}-${new Date().toISOString().slice(0, 10)}`, 'json'));
      notify('Export téléchargé.', 'ok');
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setExporting(null);
    }
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    try {
      const parsed = parseExport(JSON.parse(await f.text()));
      setFile(parsed);
      setSummary(summarizeExport(parsed));
      setMode('merge');
      setReport(null);
    } catch (e) {
      notify(e instanceof SyntaxError ? 'Fichier JSON illisible.' : errorMessage(e), 'danger');
    }
  };

  const doImport = async () => {
    if (!file || !lib.library) return;
    setProgress('Import en cours…');
    try {
      const snapshot = { families: lib.families, tags: lib.tags, exercises: lib.exercises, sheets: lib.sheets };
      const result = await importExport(repo, lib.library.id, file, mode, snapshot, setProgress);
      await lib.reload();
      setReport(result);
      setFile(null);
      notify('Import terminé.', 'ok');
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setProgress(null);
    }
  };

  return (
    <section className="form-section">
      <h2>Sauvegarde et export</h2>
      <p className="small muted">Le fichier JSON contient les exercices, les familles, les tags, leurs associations et les fiches enregistrées : il permet de restaurer la bibliothèque ou de changer de solution technique. Les vidéos jointes ne sont pas incluses.</p>
      <label className="check"><input type="checkbox" checked={withImages} onChange={(e) => setWithImages(e.target.checked)} /> Inclure les images (fichier plus lourd)</label>
      <div className="btn-row">
        <button type="button" className="btn btn--primary" onClick={() => void doExport()} disabled={Boolean(exporting)}><IconDownload /> {exporting ?? 'Exporter la bibliothèque'}</button>
        {lib.canEdit && <button type="button" className="btn" onClick={() => input.current?.click()}><IconUpload /> Importer un export</button>}
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {report && (
        <div className="notice notice--ok" style={{ display: 'grid', gap: 4 }}>
          <strong>Import terminé.</strong>
          <span>{plural(report.families, 'famille')} et {plural(report.tags, 'tag')} ajoutés, {plural(report.exercises, 'exercice')}, {plural(report.media, 'média')}, {plural(report.sheets, 'fiche')}.</span>
          {report.warnings.map((w, i) => <span key={i} className="small">{w}</span>)}
        </div>
      )}
      <Dialog open={Boolean(file)} onClose={() => !progress && setFile(null)} title="Importer cet export ?">
        {file && summary && (
          <div className="form-grid">
            <dl className="kv">
              <dt>Bibliothèque</dt><dd>{file.library.name}{file.exportedAt && <> · exporté le {formatDate(file.exportedAt)}</>}</dd>
              <dt>Contenu</dt><dd>{plural(summary.families, 'famille')}, {plural(summary.tags, 'tag')}, {plural(summary.exercises, 'exercice')}, {summary.embeddedMedia}/{summary.media} médias intégrés, {plural(summary.sheets, 'fiche')}</dd>
            </dl>
            <label className="check"><input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> <span><strong>Ajouter</strong> à la bibliothèque actuelle (les familles et tags de même nom sont réutilisés)</span></label>
            <label className="check"><input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> <span><strong>Remplacer</strong> tout le contenu actuel ({plural(lib.exercises.length, 'exercice')}, {plural(lib.tags.length, 'tag')}) — irréversible</span></label>
            {progress && <div className="notice">{progress}</div>}
            <div className="dialog__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setFile(null)} disabled={Boolean(progress)}>Annuler</button>
              <button type="button" className={`btn ${mode === 'replace' ? 'btn--danger' : 'btn--primary'}`} onClick={() => void doImport()} disabled={Boolean(progress)}>{mode === 'replace' ? 'Remplacer et importer' : 'Importer'}</button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}

function InstallSection() {
  const [, force] = useState(0);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);
  const { notify } = useToast();
  if (isStandalone()) {
    return (
      <section className="form-section">
        <h2>Application installée</h2>
        <p className="small muted">Kiné s’exécute depuis l’écran d’accueil. Les mises à jour s’appliquent automatiquement à l’ouverture suivante.</p>
      </section>
    );
  }
  return (
    <section className="form-section">
      <h2>Installer sur le téléphone</h2>
      {canPromptInstall() ? (
        <button type="button" className="btn btn--primary" style={{ justifySelf: 'start' }} onClick={() => promptInstall().then((ok) => notify(ok ? 'Application installée.' : 'Installation annulée.'))}>Installer Kiné</button>
      ) : isIos() ? (
        <p className="small">Dans Safari : <strong>Partager</strong> → <strong>Sur l’écran d’accueil</strong> → <strong>Ajouter</strong>.</p>
      ) : (
        <p className="small">Dans le menu du navigateur : <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.</p>
      )}
      <p className="small muted">L’interface est disponible hors connexion ; les données nécessitent une connexion en mode Supabase.</p>
    </section>
  );
}
