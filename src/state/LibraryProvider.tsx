import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import type {
  Exercise,
  ExerciseInput,
  Library,
  Media,
  MediaKind,
  Role,
  Sheet,
  SheetInput,
  Tag,
  TagFamily,
} from '../data/types';
import type { LibrarySnapshot } from '../data/repository';
import { duplicateName, sortFamilies } from '../domain/search';

interface LibraryContextValue extends LibrarySnapshot {
  library: Library | null;
  libraries: Library[];
  role: Role;
  canEdit: boolean;
  isOwner: boolean;
  loading: boolean;
  error: string | null;
  tagById: Map<string, Tag>;
  familyById: Map<string, TagFamily>;
  getExercise: (id: string) => Exercise | undefined;

  reload: () => Promise<void>;
  switchLibrary: (id: string) => void;
  renameLibrary: (name: string) => Promise<void>;

  createFamily: (input: Pick<TagFamily, 'name' | 'description' | 'color'>) => Promise<TagFamily>;
  updateFamily: (id: string, patch: Partial<Pick<TagFamily, 'name' | 'description' | 'color'>>) => Promise<TagFamily>;
  moveFamily: (id: string, delta: -1 | 1) => Promise<void>;
  deleteFamily: (id: string) => Promise<void>;

  createTag: (familyId: string, name: string) => Promise<Tag>;
  updateTag: (id: string, patch: Partial<Pick<Tag, 'name' | 'familyId'>>) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;

  createExercise: (input: ExerciseInput) => Promise<Exercise>;
  updateExercise: (id: string, input: ExerciseInput) => Promise<Exercise>;
  deleteExercise: (exercise: Exercise) => Promise<void>;
  duplicateExercise: (exercise: Exercise) => Promise<Exercise>;

  uploadMedia: (exercise: Exercise, file: Blob, kind: MediaKind, caption?: string) => Promise<Media>;
  updateMedia: (media: Media, patch: Partial<Pick<Media, 'caption' | 'position'>>) => Promise<Media>;
  deleteMedia: (media: Media) => Promise<void>;

  saveSheet: (input: SheetInput, id?: string) => Promise<Sheet>;
  deleteSheet: (id: string) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);
const EMPTY: LibrarySnapshot = { families: [], tags: [], exercises: [], sheets: [] };
const CURRENT_KEY = 'kine-current-library';

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { repo, user } = useAuth();
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [libraryId, setLibraryId] = useState<string | null>(() => localStorage.getItem(CURRENT_KEY));
  const [snapshot, setSnapshot] = useState<LibrarySnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const library = useMemo(() => libraries.find((l) => l.id === libraryId) ?? libraries[0] ?? null, [libraries, libraryId]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await repo.listLibraries();
      setLibraries(list);
      const chosen = list.find((l) => l.id === libraryId) ?? list[0];
      if (!chosen) throw new Error('Aucune bibliothèque disponible.');
      setSnapshot(await repo.loadSnapshot(chosen.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [repo, libraryId]);

  useEffect(() => {
    void reload();
  }, [reload, user?.id]);

  const switchLibrary = useCallback((id: string) => {
    localStorage.setItem(CURRENT_KEY, id);
    setLibraryId(id);
  }, []);

  const requireLibrary = (): Library => {
    if (!library) throw new Error('Bibliothèque non chargée.');
    return library;
  };

  const patchExercise = (updated: Exercise) =>
    setSnapshot((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === updated.id ? updated : e)) }));

  const value: LibraryContextValue = {
    ...snapshot,
    library,
    libraries,
    role: library?.role ?? 'reader',
    canEdit: library?.role === 'owner' || library?.role === 'editor',
    isOwner: library?.role === 'owner',
    loading,
    error,
    tagById: useMemo(() => new Map(snapshot.tags.map((t) => [t.id, t])), [snapshot.tags]),
    familyById: useMemo(() => new Map(snapshot.families.map((f) => [f.id, f])), [snapshot.families]),
    getExercise: (id) => snapshot.exercises.find((e) => e.id === id),
    reload,
    switchLibrary,

    async renameLibrary(name) {
      const lib = requireLibrary();
      await repo.renameLibrary(lib.id, name);
      setLibraries((list) => list.map((l) => (l.id === lib.id ? { ...l, name: name.trim() || l.name } : l)));
    },

    async createFamily(input) {
      const family = await repo.createFamily(requireLibrary().id, input);
      setSnapshot((s) => ({ ...s, families: [...s.families, family] }));
      return family;
    },
    async updateFamily(id, patch) {
      const family = await repo.updateFamily(id, patch);
      setSnapshot((s) => ({ ...s, families: s.families.map((f) => (f.id === id ? family : f)) }));
      return family;
    },
    async moveFamily(id, delta) {
      const ordered = sortFamilies(snapshot.families);
      const index = ordered.findIndex((f) => f.id === id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= ordered.length) return;
      const reordered = [...ordered];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      const updated = await Promise.all(
        reordered.map((f, position) => (f.position === position ? Promise.resolve(f) : repo.updateFamily(f.id, { position }))),
      );
      setSnapshot((s) => ({ ...s, families: updated }));
    },
    async deleteFamily(id) {
      await repo.deleteFamily(id);
      setSnapshot((s) => {
        const removed = new Set(s.tags.filter((t) => t.familyId === id).map((t) => t.id));
        return {
          ...s,
          families: s.families.filter((f) => f.id !== id),
          tags: s.tags.filter((t) => t.familyId !== id),
          exercises: s.exercises.map((e) => ({ ...e, tagIds: e.tagIds.filter((tid) => !removed.has(tid)) })),
        };
      });
    },

    async createTag(familyId, name) {
      const tag = await repo.createTag(familyId, name);
      setSnapshot((s) => ({ ...s, tags: [...s.tags, tag] }));
      return tag;
    },
    async updateTag(id, patch) {
      const tag = await repo.updateTag(id, patch);
      setSnapshot((s) => ({ ...s, tags: s.tags.map((t) => (t.id === id ? tag : t)) }));
      return tag;
    },
    async deleteTag(id) {
      await repo.deleteTag(id);
      setSnapshot((s) => ({
        ...s,
        tags: s.tags.filter((t) => t.id !== id),
        exercises: s.exercises.map((e) => ({ ...e, tagIds: e.tagIds.filter((tid) => tid !== id) })),
      }));
    },

    async createExercise(input) {
      const exercise = await repo.createExercise(requireLibrary().id, input);
      setSnapshot((s) => ({ ...s, exercises: [...s.exercises, exercise] }));
      return exercise;
    },
    async updateExercise(id, input) {
      const exercise = await repo.updateExercise(id, input);
      patchExercise(exercise);
      return exercise;
    },
    async deleteExercise(exercise) {
      await repo.deleteExercise(exercise);
      setSnapshot((s) => ({
        ...s,
        exercises: s.exercises.filter((e) => e.id !== exercise.id),
        sheets: s.sheets.map((sheet) => ({ ...sheet, exerciseIds: sheet.exerciseIds.filter((eid) => eid !== exercise.id) })),
      }));
    },
    async duplicateExercise(exercise) {
      const name = duplicateName(exercise.name, snapshot.exercises.map((e) => e.name));
      const copy = await repo.duplicateExercise(exercise, name);
      setSnapshot((s) => ({ ...s, exercises: [...s.exercises, copy] }));
      return copy;
    },

    async uploadMedia(exercise, file, kind, caption) {
      const media = await repo.uploadMedia(exercise, file, kind, caption);
      setSnapshot((s) => ({
        ...s,
        exercises: s.exercises.map((e) => (e.id === exercise.id ? { ...e, media: [...e.media, media] } : e)),
      }));
      return media;
    },
    async updateMedia(media, patch) {
      const updated = await repo.updateMedia(media.id, patch);
      setSnapshot((s) => ({
        ...s,
        exercises: s.exercises.map((e) =>
          e.id === media.exerciseId ? { ...e, media: e.media.map((m) => (m.id === media.id ? updated : m)) } : e,
        ),
      }));
      return updated;
    },
    async deleteMedia(media) {
      await repo.deleteMedia(media);
      setSnapshot((s) => ({
        ...s,
        exercises: s.exercises.map((e) => (e.id === media.exerciseId ? { ...e, media: e.media.filter((m) => m.id !== media.id) } : e)),
      }));
    },

    async saveSheet(input, id) {
      const sheet = await repo.saveSheet(requireLibrary().id, input, id);
      setSnapshot((s) => ({
        ...s,
        sheets: s.sheets.some((x) => x.id === sheet.id) ? s.sheets.map((x) => (x.id === sheet.id ? sheet : x)) : [sheet, ...s.sheets],
      }));
      return sheet;
    },
    async deleteSheet(id) {
      await repo.deleteSheet(id);
      setSnapshot((s) => ({ ...s, sheets: s.sheets.filter((x) => x.id !== id) }));
    },
  };

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary hors de LibraryProvider');
  return ctx;
}
