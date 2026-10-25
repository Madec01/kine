import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRepo } from './RepositoryProvider';
import { useLibrary } from './LibraryProvider';
import type { SyncEngine } from '../sync/engine';
import type { SyncStatus } from '../sync/types';
import { deriveLibraryKey, isValidLibraryKey, normalizeLibraryKey, resolveLibraryKey } from '../sync/libraryKey';

const DISABLED: SyncStatus = {
  state: 'disabled',
  pending: 0,
  lastSuccessAt: null,
  lastError: null,
  readsToday: 0,
  writesToday: 0,
  libraryId: null,
  missingMedia: 0,
};

interface SyncContextValue {
  /** True when the Firebase configuration is present in the build. */
  enabled: boolean;
  ready: boolean;
  status: SyncStatus;
  saveNow: () => Promise<void>;
  checkNow: () => Promise<number>;
  downloadAllMedia: (onProgress?: (done: number, total: number) => void) => Promise<number>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const repo = useRepo();
  const { reload } = useLibrary();
  const engineRef = useRef<SyncEngine | null>(null);
  const [status, setStatus] = useState<SyncStatus>(DISABLED);
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      const { readFirebaseEnv } = await import('../sync/firestore');
      const env = readFirebaseEnv();
      if (!env) {
        setReady(true);
        return;
      }
      setEnabled(true);
      const [{ FirestoreRemote }, { SyncEngine }] = await Promise.all([import('../sync/firestore'), import('../sync/engine')]);
      if (cancelled) return;
      // Every device opening this site shares one library: no key to copy.
      const override = env.libraryKey ? normalizeLibraryKey(env.libraryKey) : '';
      const configured = override && isValidLibraryKey(override) ? override : await deriveLibraryKey(env.projectId, env.apiKey);
      const stored = await repo.getMeta<string>('libraryId');
      const { key, mustAdopt } = resolveLibraryKey(stored, configured);
      if (!stored) await repo.setMeta('libraryId', key);
      const engine = new SyncEngine(repo, new FirestoreRemote(env), stored ?? key);
      engineRef.current = engine;
      const unsubscribe = engine.subscribe(setStatus);
      const unsubscribeRemote = engine.onRemoteApplied(() => void reloadRef.current());
      cleanup = () => {
        unsubscribe();
        unsubscribeRemote();
        engine.stop();
        engineRef.current = null;
      };
      if (mustAdopt) {
        // This device used another identifier (older version): merge its content into the shared library.
        await engine.start();
        await engine.adoptLibrary(key);
        await reloadRef.current();
      } else {
        await engine.start();
      }
      if (!cancelled) setReady(true);
    })().catch((error: unknown) => {
      setStatus({ ...DISABLED, state: 'error', lastError: error instanceof Error ? error.message : String(error) });
      setReady(true);
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [repo]);

  const saveNow = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    await engine.flush('manuel');
    await engine.pull();
  }, []);

  const checkNow = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return 0;
    const result = await engine.pull(true);
    return result.applied;
  }, []);

  const downloadAllMedia = useCallback((onProgress?: (done: number, total: number) => void) => engineRef.current?.downloadAllMedia(onProgress) ?? Promise.resolve(0), []);

  const value = useMemo<SyncContextValue>(
    () => ({ enabled, ready, status, saveNow, checkNow, downloadAllMedia }),
    [enabled, ready, status, saveNow, checkNow, downloadAllMedia],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync hors de SyncProvider');
  return ctx;
}
