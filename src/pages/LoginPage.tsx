import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthProvider';
import { errorMessage } from '../state/ToastProvider';
import { Field } from '../components/ui';

type Mode = 'signin' | 'signup' | 'forgot';

export function LoginPage() {
  const { repo, status, recovery, clearRecovery } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (repo.mode === 'local' || (status === 'signedIn' && !recovery)) {
    return <Navigate to={location.state?.from ?? '/exercices'} replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (recovery) {
        await repo.auth.updatePassword(password);
        clearRecovery();
        navigate('/exercices', { replace: true });
      } else if (mode === 'signin') {
        await repo.auth.signIn(email.trim(), password);
      } else if (mode === 'signup') {
        const { needsConfirmation } = await repo.auth.signUp(email.trim(), password);
        if (needsConfirmation) setInfo('Compte créé. Ouvrez le lien de confirmation reçu par e-mail, puis connectez-vous.');
      } else {
        await repo.auth.resetPassword(email.trim());
        setInfo('Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé.');
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="login__card reveal" onSubmit={submit}>
        <div className="login__brand">
          <span className="brand__mark">Kiné</span>
          <span className="brand__sub">Bibliothèque d’exercices</span>
          <p className="lede small" style={{ marginTop: 6 }}>
            Espace privé. Les exercices, familles de tags et fiches sont réservés aux personnes invitées.
          </p>
        </div>

        {recovery ? (
          <>
            <h2>Nouveau mot de passe</h2>
            <Field label="Mot de passe" htmlFor="password">
              <input id="password" className="input" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </>
        ) : (
          <>
            <div className="segmented" role="tablist" aria-label="Connexion ou création de compte">
              <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'is-active' : ''} onClick={() => setMode('signin')}>
                Connexion
              </button>
              <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'is-active' : ''} onClick={() => setMode('signup')}>
                Créer un compte
              </button>
            </div>
            <Field label="Adresse e-mail" htmlFor="email">
              <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {mode !== 'forgot' && (
              <Field label="Mot de passe" htmlFor="password" hint={mode === 'signup' ? 'Au moins 6 caractères.' : undefined}>
                <input
                  id="password"
                  className="input"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            )}
          </>
        )}

        {error && <div className="notice notice--danger">{error}</div>}
        {info && <div className="notice notice--ok">{info}</div>}

        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Un instant…' : recovery ? 'Enregistrer le mot de passe' : mode === 'signin' ? 'Se connecter' : mode === 'signup' ? 'Créer le compte' : 'Envoyer le lien'}
        </button>

        {!recovery && (
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            {mode === 'forgot' ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setMode('signin')}>
                Retour à la connexion
              </button>
            ) : (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setMode('forgot')}>
                Mot de passe oublié ?
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
