// Pure merge rules between a local record and a remote document.
// Rule: the most recent version wins, except that a record modified locally
// and not yet sent is kept (it is the user's work in progress).
import type { ExerciseRecord, FamilyRecord, OutboxRecord, SheetRecord, TagRecord } from '../data/localDb';
import type { RemoteDoc, RemoteFamily } from './types';

interface Versioned {
  updatedAt: number;
  deletedAt: number | null;
  dirty: boolean;
}

export type MergeDecision<T> = { action: 'keep-local' } | { action: 'apply'; record: T };

/** Generic last-writer-wins for exercises and sheets. */
export function mergeEntity<T extends Versioned>(local: T | undefined, remote: RemoteDoc<Omit<T, 'dirty' | 'updatedAt'>>): MergeDecision<T> {
  if (local?.dirty && local.updatedAt >= remote.updatedAt) return { action: 'keep-local' };
  if (remote.deletedAt !== null) {
    if (!local || local.deletedAt !== null) return { action: 'keep-local' };
    if (local.dirty && local.updatedAt > remote.deletedAt) return { action: 'keep-local' };
    return { action: 'apply', record: { ...local, deletedAt: remote.deletedAt, updatedAt: remote.updatedAt, dirty: false } };
  }
  if (!remote.data) return { action: 'keep-local' };
  if (local && !local.dirty && local.updatedAt === remote.updatedAt && local.deletedAt === null) return { action: 'keep-local' };
  return { action: 'apply', record: { ...(remote.data as object), updatedAt: remote.updatedAt, deletedAt: null, dirty: false } as T };
}

/** Tag-level merge so that tags created or renamed on two devices coexist. */
export function mergeTags(localTags: TagRecord[], remoteTags: TagRecord[]): TagRecord[] {
  const byId = new Map<string, TagRecord>();
  for (const tag of localTags) byId.set(tag.id, tag);
  for (const remote of remoteTags) {
    const local = byId.get(remote.id);
    if (!local || remote.updatedAt > local.updatedAt) byId.set(remote.id, { ...remote });
  }
  return [...byId.values()].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'fr'));
}

export function mergeFamily(local: FamilyRecord | undefined, remote: RemoteDoc<RemoteFamily>): MergeDecision<FamilyRecord> {
  if (remote.deletedAt !== null || !remote.data) return mergeEntity<FamilyRecord>(local, remote);
  const remoteTags = (remote.data.tags ?? []) as TagRecord[];
  if (!local) {
    return { action: 'apply', record: { ...remote.data, tags: remoteTags, updatedAt: remote.updatedAt, deletedAt: null, dirty: false } };
  }
  const tags = mergeTags(local.tags, remoteTags);
  if (local.dirty && local.updatedAt >= remote.updatedAt) {
    // Keep the local family fields, but still absorb tags changed elsewhere.
    return { action: 'apply', record: { ...local, tags } };
  }
  if (local.updatedAt >= remote.updatedAt) return { action: 'apply', record: { ...local, tags } };
  return { action: 'apply', record: { ...remote.data, tags, updatedAt: remote.updatedAt, deletedAt: null, dirty: false } };
}

export const mergeExercise = (local: ExerciseRecord | undefined, remote: RemoteDoc<Omit<ExerciseRecord, 'dirty' | 'updatedAt'>>) =>
  mergeEntity<ExerciseRecord>(local, remote);
export const mergeSheet = (local: SheetRecord | undefined, remote: RemoteDoc<Omit<SheetRecord, 'dirty' | 'updatedAt'>>) =>
  mergeEntity<SheetRecord>(local, remote);

/** One journal entry per entity: a delete wins over earlier edits of the same entity. */
export function coalesceOutbox(entries: OutboxRecord[]): OutboxRecord[] {
  const byKey = new Map<string, OutboxRecord>();
  for (const entry of [...entries].sort((a, b) => a.changedAt - b.changedAt)) {
    const previous = byKey.get(entry.key);
    if (!previous || entry.op === 'delete' || previous.op !== 'delete') byKey.set(entry.key, { ...entry, changedAt: Math.max(entry.changedAt, previous?.changedAt ?? 0) });
  }
  return [...byKey.values()];
}

/** Splits a list into batches of at most `size` elements. */
export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
