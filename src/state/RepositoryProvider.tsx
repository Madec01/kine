import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createRepository } from '../data';
import type { LocalRepository } from '../data/localRepository';

const RepositoryContext = createContext<LocalRepository | null>(null);

export function RepositoryProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [repo, setRepo] = useState<LocalRepository | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createRepository()
      .then((created) => {
        if (!cancelled) setRepo(created);
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailure(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failure) {
    return (
      <div className="splash">
        <div className="notice notice--danger" style={{ maxWidth: 480 }}>
          <strong>Démarrage impossible.</strong> {failure}
        </div>
      </div>
    );
  }
  if (!repo) return <>{fallback}</>;
  return <RepositoryContext.Provider value={repo}>{children}</RepositoryContext.Provider>;
}

export function useRepo(): LocalRepository {
  const repo = useContext(RepositoryContext);
  if (!repo) throw new Error('useRepo hors de RepositoryProvider');
  return repo;
}
