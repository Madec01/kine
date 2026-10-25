import { useSync } from '../state/SyncProvider';
import { useToast, errorMessage } from '../state/ToastProvider';
import { IconCheck, IconDownload, IconWarn } from './icons';
import type { SyncStatus } from '../sync/types';

function describe(status: SyncStatus): { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' } {
  switch (status.state) {
    case 'disabled':
      return { label: 'Local seulement', tone: 'muted' };
    case 'idle':
      return { label: 'Sauvegardé en ligne', tone: 'ok' };
    case 'pending':
      return { label: `${status.pending} modification${status.pending > 1 ? 's' : ''} à sauvegarder`, tone: 'warn' };
    case 'syncing':
      return { label: 'Sauvegarde…', tone: 'warn' };
    case 'offline':
      return { label: `Hors connexion · ${status.pending} en attente`, tone: 'warn' };
    case 'paused':
      return { label: 'Sauvegarde en pause (quota)', tone: 'danger' };
    case 'error':
      return { label: 'Erreur de sauvegarde', tone: 'danger' };
  }
}

/** Status pill + manual save button, shown in the navigation. */
export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const { enabled, status, saveNow } = useSync();
  const { notify } = useToast();
  const { label, tone } = describe(status);
  const className = `badge ${tone === 'ok' ? 'badge--ok' : tone === 'warn' ? 'badge--warn' : tone === 'danger' ? 'badge--danger' : ''}`;

  const save = async () => {
    try {
      await saveNow();
      notify('Sauvegarde en ligne terminée.', 'ok');
    } catch (e) {
      notify(errorMessage(e), 'danger');
    }
  };

  if (!enabled) return compact ? null : <span className={className}>{label}</span>;

  if (compact) {
    return (
      <button type="button" className={`btn btn--sm ${status.pending > 0 ? 'btn--primary' : 'btn--ghost'}`} onClick={() => void save()} disabled={status.state === 'syncing'} aria-label={`${label}. Sauvegarder maintenant`} title={label}>
        {status.state === 'error' || status.state === 'paused' ? <IconWarn /> : status.pending > 0 ? <IconDownload /> : <IconCheck />}
        {status.pending > 0 ? <span>{status.pending}</span> : null}
      </button>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span className={className} title={status.lastError ?? undefined}>
        {label}
      </span>
      <button type="button" className={`btn btn--sm ${status.pending > 0 ? 'btn--primary' : ''}`} onClick={() => void save()} disabled={status.state === 'syncing'}>
        {status.state === 'syncing' ? 'Sauvegarde…' : 'Sauvegarder maintenant'}
      </button>
    </div>
  );
}
