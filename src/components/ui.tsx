import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconClose } from './icons';
import { difficultyLabel } from '../lib/format';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Slide from the bottom on phones. */
  sheet?: boolean;
}

export function Dialog({ open, onClose, title, children, footer, sheet }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog ${sheet ? 'dialog--sheet' : ''}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dialog__body">
          <div className="dialog__head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label="Fermer">
              <IconClose />
            </button>
          </div>
          {children}
          {footer && <div className="dialog__foot">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmer', danger, busy, onConfirm, onClose }: ConfirmProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button type="button" className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'En cours…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="lede">{message}</div>
    </Dialog>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <div className="field__hint">{hint}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty reveal">
      {icon}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Difficulty({ value, showLabel }: { value: number | null; showLabel?: boolean }) {
  if (!value) return showLabel ? <span className="muted small">Difficulté non renseignée</span> : null;
  return (
    <span className="difficulty" title={difficultyLabel(value)} aria-label={`Difficulté : ${difficultyLabel(value)}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={n <= value ? 'on' : ''} />
      ))}
      {showLabel && <span className="difficulty__label">{difficultyLabel(value)}</span>}
    </span>
  );
}

export function Splash({ message = 'Chargement…' }: { message?: string }) {
  return (
    <div className="splash">
      <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
        <span className="brand__mark">Kiné</span>
        <span className="small">{message}</span>
      </div>
    </div>
  );
}
