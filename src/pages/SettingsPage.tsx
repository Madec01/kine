import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRepo } from '../state/RepositoryProvider';
import { useLibrary } from '../state/LibraryProvider';
import { useSync } from '../state/SyncProvider';
import { errorMessage, useToast } from '../state/ToastProvider';
import { ConfirmDialog, Dialog, Field } from '../components/ui';
import { IconCopy, IconDownload, IconUpload } from '../components/icons';
import { buildExport, parseExport, summarizeExport, type ExportFile, type ExportSummary } from '../domain/exportImport';
import { importExport, type ImportMode, type ImportReport } from '../domain/importer';
import { blobToDataUrl, prepareImage } from '../lib/images';
import { downloadJson, safeFilename } from '../lib/download';
import { canPromptInstall, isIos, isStandalone, onInstallChange, promptInstall } from '../lib/install';
import { formatDate, plural } from '../lib/format';
import { formatLibraryKey, isValidLibraryKey, normalizeLibraryKey } from '../sync/libraryKey';

export function SettingsPage() {
  const lib = useLibrary();
  const { notify } = useToast();

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <span className="eyebrow">Sauvegarde, bibliothèque, installation</span>
          <h1>Réglages</h1>
        </div>
      </div>
      <div className="settings">
        <OnlineBackupSection />
        <LibrarySection />
        <ExportSection />
        <InstallSection />
        <section className="form-section">
          <h2>À propos</h2>
          <dl className="kv">
            <dt>Version</dt><dd>2.1</dd>
            <dt>Données</dt><dd>{plural(lib.exercises.length, 'exercice')}, {plural(lib.families.length, 'famille')}, {plural(lib.tags.length, 'tag')}, {plural(lib.sheets.length, 'fiche enregistrée', 'fiches enregistrées')}</dd>
          </dl>
          <p className="small muted">Cette bibliothèque n’est pas un dossier patient : n’y enregistrez aucune donnée nominative de résident. Les dosages et précautions relèvent de votre évaluation clinique.</p>
          <button type="button" className="btn btn--ghost btn--sm" style={{ justifySelf: 'start' }} onClick={() => { notify('Rechargement…'); void lib.reload(); }}>Recharger les données</button>
        </section>
      </div>
    </>
  );
}

function formatTime(ms: number | null): string {
  if (!ms) return 'jamais';
  const date = new Date(ms);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function OnlineBackupSection() {
  const { enabled, ready, status, saveNow, checkNow, downloadAllMedia, useLibraryKey } = useSync();
  const { notify } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [keyDialog, setKeyDialog] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  if (!enabled) {
    return (
      <section className="form-section">
        <h2>Sauvegarde en ligne</h2>
        <div className="notice notice--warn">
          <div>
            <strong>Non configurée : les données restent sur cet appareil.</strong> Pour une sauvegarde automatique sur Firebase et un accès depuis plusieurs appareils, renseignez la configuration Firebase au moment de la construction du site (voir le README). En attendant, exportez régulièrement un fichier JSON ci-dessous.
          </div>
        </div>
      </section>
    );
  }

  const run = async (label: string, action: () => Promise<unknown>, success?: string) => {
    setBusy(label);
    try {
      await action();
      if (success) notify(success, 'ok');
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const copyKey = async () => {
    if (!status.libraryId) return;
    try {
      await navigator.clipboard.writeText(status.libraryId);
      notify('Clé copiée.', 'ok');
    } catch {
      notify('Copie impossible : sélectionnez la clé et copiez-la manuellement.', 'danger');
    }
  };

  const submitKey = (event: FormEvent) => {
    event.preventDefault();
    const key = normalizeLibraryKey(keyInput);
    if (!isValidLibraryKey(key)) {
      notify('Clé invalide : 20 caractères au minimum, lettres et chiffres.', 'danger');
      return;
    }
    setKeyDialog(false);
    setConfirmKey(key);
  };

  const stateLabel: Record<typeof status.state, string> = {
    disabled: 'désactivée',
    idle: 'à jour',
    pending: `${plural(status.pending, 'modification')} en attente`,
    syncing: 'envoi en cours',
    offline: `hors connexion, ${plural(status.pending, 'modification')} en attente`,
    error: 'erreur',
    paused: 'en pause (plafond du jour atteint)',
  };

  return (
    <section className="form-section">
      <h2>Sauvegarde en ligne (Firebase)</h2>
      {!ready ? (
        <p className="small muted">Connexion à la sauvegarde…</p>
      ) : (
        <>
          <dl className="kv">
            <dt>État</dt><dd>{stateLabel[status.state]}</dd>
            <dt>Dernière sauvegarde</dt><dd>{formatTime(status.lastSuccessAt)}</dd>
            <dt>Aujourd’hui</dt><dd>{status.readsToday} lectures · {status.writesToday} écritures <span className="muted">(quota gratuit : 50 000 lectures, 20 000 écritures par jour)</span></dd>
            {status.missingMedia > 0 && <><dt>Images</dt><dd>{plural(status.missingMedia, 'image')} en ligne non encore téléchargée{status.missingMedia > 1 ? 's' : ''} sur cet appareil</dd></>}
          </dl>
          {status.lastError && <div className="notice notice--danger">{status.lastError}</div>}
          <p className="small muted">Les modifications sont envoyées automatiquement une minute après le dernier changement, à la fermeture de l’application et sur demande. Seuls les éléments modifiés sont transmis.</p>
          <div className="btn-row">
            <button type="button" className="btn btn--primary" disabled={Boolean(busy) || status.state === 'syncing'} onClick={() => void run('save', saveNow, 'Sauvegarde terminée.')}>Sauvegarder maintenant</button>
            <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => void run('check', async () => { const n = await checkNow(); notify(n > 0 ? `${plural(n, 'élément')} mis à jour depuis la sauvegarde en ligne.` : 'Aucune modification en ligne.', 'ok'); })}>Vérifier les modifications en ligne</button>
            {status.missingMedia > 0 && (
              <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => void run('media', async () => { const n = await downloadAllMedia(); notify(`${plural(n, 'image')} téléchargée${n > 1 ? 's' : ''}.`, 'ok'); })}>
                <IconDownload /> Télécharger les images ({status.missingMedia} lectures)
              </button>
            )}
          </div>

          <div className="field">
            <span className="field__label">Clé de la bibliothèque</span>
            <div className="btn-row">
              <code className="input" style={{ width: 'auto', minHeight: 40, display: 'inline-flex', alignItems: 'center', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.04em', userSelect: 'all' }}>{status.libraryId ? formatLibraryKey(status.libraryId) : '…'}</code>
              <button type="button" className="btn btn--sm" onClick={() => void copyKey()}><IconCopy /> Copier</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setKeyInput(''); setKeyDialog(true); }}>Utiliser une autre clé</button>
            </div>
            <span className="field__hint">Cette clé tient lieu d’identifiant : saisissez-la sur un autre appareil pour retrouver la même bibliothèque. Ne la partagez qu’avec des personnes de confiance ; toute personne qui la connaît peut lire et modifier les données.</span>
          </div>
        </>
      )}

      <Dialog open={keyDialog} onClose={() => setKeyDialog(false)} title="Utiliser une autre clé">
        <form className="form-grid" onSubmit={submitKey}>
          <Field label="Clé de la bibliothèque à rejoindre" htmlFor="library-key" hint="Recopiez la clé affichée dans les réglages de l’autre appareil (les tirets sont facultatifs)."><input id="library-key" className="input" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} autoFocus autoComplete="off" spellCheck={false} /></Field>
          <div className="dialog__foot"><button type="button" className="btn btn--ghost" onClick={() => setKeyDialog(false)}>Annuler</button><button type="submit" className="btn btn--primary">Continuer</button></div>
        </form>
      </Dialog>
      <ConfirmDialog
        open={Boolean(confirmKey)}
        title="Changer de bibliothèque en ligne ?"
        message={<>Cet appareil utilisera la clé <code>{confirmKey ? formatLibraryKey(confirmKey) : ''}</code>. Son contenu actuel sera ajouté à cette bibliothèque (fusion), puis les données en ligne seront téléchargées.</>}
        confirmLabel="Changer de clé"
        busy={busy === 'key'}
        onConfirm={() => { const key = confirmKey; if (key) void run('key', () => useLibraryKey(key), 'Bibliothèque rejointe.').then(() => setConfirmKey(null)); }}
        onClose={() => setConfirmKey(null)}
      />
    </section>
  );
}

function LibrarySection() {
  const { library, renameLibrary } = useLibrary();
  const { notify } = useToast();
  const [name, setName] = useState(library?.name ?? '');
  useEffect(() => setName(library?.name ?? ''), [library?.name]);
  if (!library) return null;
  return (
    <section className="form-section">
      <h2>Bibliothèque</h2>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); renameLibrary(name).then(() => notify('Nom enregistré.', 'ok')).catch((err) => notify(errorMessage(err), 'danger')); }}>
        <Field label="Nom de la bibliothèque" htmlFor="lib-name"><input id="lib-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <button type="submit" className="btn" style={{ justifySelf: 'start' }} disabled={name.trim() === library.name || !name.trim()}>Renommer</button>
      </form>
    </section>
  );
}

function ExportSection() {
  const repo = useRepo();
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
    if (!file) return;
    setProgress('Import en cours…');
    try {
      const snapshot = { families: lib.families, tags: lib.tags, exercises: lib.exercises, sheets: lib.sheets };
      const result = await importExport(repo, file, mode, snapshot, setProgress);
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
      <h2>Export et import (fichier JSON)</h2>
      <p className="small muted">Le fichier contient les exercices, les familles, les tags, leurs associations et les fiches enregistrées. Il sert de sauvegarde de secours indépendante de Firebase et permet de changer de solution technique. Les vidéos jointes ne sont pas incluses.</p>
      <label className="check"><input type="checkbox" checked={withImages} onChange={(e) => setWithImages(e.target.checked)} /> Inclure les images (fichier plus lourd)</label>
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => void doExport()} disabled={Boolean(exporting)}><IconDownload /> {exporting ?? 'Exporter la bibliothèque'}</button>
        <button type="button" className="btn" onClick={() => input.current?.click()}><IconUpload /> Importer un export</button>
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
      <p className="small muted">L’application et ses données fonctionnent hors connexion ; la sauvegarde en ligne reprend au retour du réseau.</p>
    </section>
  );
}
