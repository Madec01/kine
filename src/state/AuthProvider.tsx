import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createRepository } from '../data';
import type { Repository } from '../data/repository';
import type { SessionUser } from '../data/types';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  repo: Repository;
  user: SessionUser | null;
  status: Status;
  /** True when the user arrived through a password-recovery link. */
  recovery: boolean;
  clearRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [recovery, setRecovery] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    createRepository()
      .then(async (created) => {
        if (cancelled) return;
        setRepo(created);
        const current = await created.auth.getUser();
        if (cancelled) return;
        setUser(current);
        setStatus(current ? 'signedIn' : 'signedOut');
        unsubscribe = created.auth.onChange((next, event) => {
          if (event === 'PASSWORD_RECOVERY') setRecovery(true);
          setUser(next);
          setStatus(next ? 'signedIn' : 'signedOut');
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailure(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue | null>(
    () => (repo ? { repo, user, status, recovery, clearRecovery: () => setRecovery(false) } : null),
    [repo, user, status, recovery],
  );

  if (failure) {
    return (
      <div className="splash">
        <div className="notice notice--danger" style={{ maxWidth: 480 }}>
          <strong>Démarrage impossible.</strong> {failure}
        </div>
      </div>
    );
  }
  if (!value || status === 'loading') return <>{fallback}</>;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors de AuthProvider');
  return ctx;
}

export function useRepo(): Repository {
  return useAuth().repo;
}
