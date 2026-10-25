import { get, set, del } from 'idb-keyval';
import type { Repository } from './repository';
import { LocalRepository, type KeyValueStore } from './localRepository';

const idbStore: KeyValueStore = {
  get: (key) => get(key),
  set: (key, value) => set(key, value),
  del: (key) => del(key),
};

export const supabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

/**
 * Production uses Supabase as soon as the two VITE_SUPABASE_* variables are
 * present at build time. Without them (or with VITE_DATA_MODE=local) the app
 * runs in local mode: single user, data kept in this browser only. The
 * Supabase client is loaded on demand so the local build stays light.
 */
export async function createRepository(): Promise<Repository> {
  const forcedLocal = import.meta.env.VITE_DATA_MODE === 'local';
  if (!forcedLocal && supabaseConfigured) {
    const [{ SupabaseRepository }, { getSupabase }] = await Promise.all([import('./supabaseRepository'), import('../lib/supabase')]);
    return new SupabaseRepository(getSupabase());
  }
  return new LocalRepository(idbStore);
}
