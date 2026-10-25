import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SHEET_OPTIONS, type Sheet, type SheetOptions } from '../data/types';
import { useLibrary } from './LibraryProvider';

export interface SheetDraft {
  title: string;
  subtitle: string;
  options: SheetOptions;
  /** Saved sheet currently being edited, if any. */
  sheetId: string | null;
}

interface SelectionState {
  ids: string[];
  draft: SheetDraft;
}

interface SelectionContextValue {
  ids: string[];
  count: number;
  draft: SheetDraft;
  has: (id: string) => boolean;
  add: (ids: string | string[]) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  move: (index: number, delta: number) => void;
  setIds: (ids: string[]) => void;
  clear: () => void;
  setDraft: (patch: Partial<SheetDraft>) => void;
  loadSheet: (sheet: Sheet) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

const emptyDraft = (): SheetDraft => ({ title: '', subtitle: '', options: { ...DEFAULT_SHEET_OPTIONS }, sheetId: null });

function read(key: string): SelectionState {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ids: [], draft: emptyDraft() };
    const parsed = JSON.parse(raw) as Partial<SelectionState>;
    return {
      ids: Array.isArray(parsed.ids) ? parsed.ids.filter((x): x is string => typeof x === 'string') : [],
      draft: { ...emptyDraft(), ...(parsed.draft ?? {}), options: { ...DEFAULT_SHEET_OPTIONS, ...(parsed.draft?.options ?? {}) } },
    };
  } catch {
    return { ids: [], draft: emptyDraft() };
  }
}

/** The temporary selection used to compose a PDF sheet; kept per library in localStorage. */
export function SelectionProvider({ children }: { children: ReactNode }) {
  const { library } = useLibrary();
  const key = `kine-selection:${library?.id ?? 'none'}`;
  const [state, setState] = useState<SelectionState>(() => read(key));

  useEffect(() => {
    setState(read(key));
  }, [key]);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* quota exceeded: the selection simply is not persisted */
    }
  }, [key, state]);

  const setIds = useCallback((ids: string[]) => setState((s) => ({ ...s, ids: [...new Set(ids)] })), []);

  const value = useMemo<SelectionContextValue>(
    () => ({
      ids: state.ids,
      count: state.ids.length,
      draft: state.draft,
      has: (id) => state.ids.includes(id),
      add: (ids) => setState((s) => ({ ...s, ids: [...new Set([...s.ids, ...(Array.isArray(ids) ? ids : [ids])])] })),
      remove: (id) => setState((s) => ({ ...s, ids: s.ids.filter((x) => x !== id) })),
      toggle: (id) =>
        setState((s) => ({ ...s, ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id] })),
      move: (index, delta) =>
        setState((s) => {
          const target = index + delta;
          if (index < 0 || target < 0 || target >= s.ids.length) return s;
          const ids = [...s.ids];
          [ids[index], ids[target]] = [ids[target], ids[index]];
          return { ...s, ids };
        }),
      setIds,
      clear: () => setState({ ids: [], draft: emptyDraft() }),
      setDraft: (patch) => setState((s) => ({ ...s, draft: { ...s.draft, ...patch } })),
      loadSheet: (sheet) =>
        setState({
          ids: [...sheet.exerciseIds],
          draft: { title: sheet.title, subtitle: sheet.subtitle, options: { ...DEFAULT_SHEET_OPTIONS, ...sheet.options }, sheetId: sheet.id },
        }),
    }),
    [state, setIds],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection hors de SelectionProvider');
  return ctx;
}
