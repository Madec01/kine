// Firestore implementation of RemoteStore. No listeners: every call is an
// explicit, counted read or write decided by the sync engine.
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  memoryLocalCache,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
  type FirestoreError,
} from 'firebase/firestore';
import { RemoteError, type RemoteCollection, type RemoteDoc, type RemoteLibrary, type RemoteMediaDoc, type RemoteOp, type RemoteStore } from './types';

export interface FirebaseEnv {
  apiKey: string;
  projectId: string;
  appId?: string;
  authDomain?: string;
  /** Optional fixed library identifier (VITE_LIBRARY_KEY); derived from the project otherwise. */
  libraryKey?: string;
}

export function readFirebaseEnv(): FirebaseEnv | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  if (!apiKey || !projectId) return null;
  return {
    apiKey,
    projectId,
    appId: (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) || undefined,
    authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) || undefined,
    libraryKey: (import.meta.env.VITE_LIBRARY_KEY as string | undefined) || undefined,
  };
}

function toRemoteError(error: unknown, context: string): RemoteError {
  const code = (error as FirestoreError | undefined)?.code ?? '';
  const message = error instanceof Error ? error.message : String(error);
  if (code === 'unavailable' || /offline|network|Failed to fetch/i.test(message)) return new RemoteError(`${context} : hors connexion.`, 'offline', error);
  if (code === 'resource-exhausted') return new RemoteError(`${context} : quota Firebase épuisé pour aujourd’hui.`, 'quota', error);
  if (code === 'permission-denied' || code === 'unauthenticated') return new RemoteError(`${context} : accès refusé par les règles Firestore.`, 'denied', error);
  return new RemoteError(`${context} : ${message}`, 'other', error);
}

const millis = (value: unknown): number => (value instanceof Timestamp ? value.toMillis() : typeof value === 'number' ? value : 0);

// One Firestore instance per page: initializeFirestore() cannot be called twice.
let sharedDb: Firestore | null = null;

export class FirestoreRemote implements RemoteStore {
  readonly maxBatch = 450;
  private readonly db: Firestore;

  constructor(env: FirebaseEnv) {
    const app: FirebaseApp = getApps()[0] ?? initializeApp({ apiKey: env.apiKey, projectId: env.projectId, appId: env.appId, authDomain: env.authDomain });
    sharedDb ??= initializeFirestore(app, { localCache: memoryLocalCache(), ignoreUndefinedProperties: true });
    this.db = sharedDb;
  }

  private libraryRef(libraryId: string) {
    return doc(this.db, 'libraries', libraryId);
  }

  async getLibrary(libraryId: string): Promise<RemoteLibrary | null> {
    try {
      const snapshot = await getDoc(this.libraryRef(libraryId));
      if (!snapshot.exists()) return null;
      const data = snapshot.data();
      return { name: String(data.name ?? ''), syncToken: String(data.syncToken ?? ''), updatedAt: millis(data.updatedAt) };
    } catch (error) {
      throw toRemoteError(error, 'Lecture de la bibliothèque');
    }
  }

  async queryChanged<T>(libraryId: string, name: RemoteCollection, sinceMs: number): Promise<RemoteDoc<T>[]> {
    try {
      const q = query(collection(this.db, 'libraries', libraryId, name), where('updatedAt', '>', Timestamp.fromMillis(Math.max(0, sinceMs))));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => {
        const { updatedAt, deletedAt, ...rest } = d.data() as Record<string, unknown>;
        const deleted = typeof deletedAt === 'number' ? deletedAt : null;
        return { id: d.id, updatedAt: millis(updatedAt), deletedAt: deleted, data: deleted !== null ? null : ({ id: d.id, ...rest } as T) };
      });
    } catch (error) {
      throw toRemoteError(error, `Lecture des ${name}`);
    }
  }

  async getMedia(libraryId: string, mediaId: string): Promise<RemoteMediaDoc | null> {
    try {
      const snapshot = await getDoc(doc(this.db, 'libraries', libraryId, 'media', mediaId));
      if (!snapshot.exists()) return null;
      const data = snapshot.data();
      if (typeof data.deletedAt === 'number' || typeof data.data !== 'string') return null;
      return { exerciseId: String(data.exerciseId ?? ''), mimeType: String(data.mimeType ?? 'image/jpeg'), data: data.data };
    } catch (error) {
      throw toRemoteError(error, 'Téléchargement d’une image');
    }
  }

  async commit(libraryId: string, ops: RemoteOp[]): Promise<void> {
    if (ops.length > this.maxBatch) throw new RemoteError('Lot trop volumineux.', 'other');
    try {
      const batch = writeBatch(this.db);
      for (const op of ops) {
        switch (op.type) {
          case 'set':
            batch.set(doc(this.db, 'libraries', libraryId, op.collection, op.id), { ...op.data, deletedAt: null, updatedAt: serverTimestamp() });
            break;
          case 'setMedia':
            batch.set(doc(this.db, 'libraries', libraryId, 'media', op.id), { ...op.data, deletedAt: null, updatedAt: serverTimestamp() });
            break;
          case 'tombstone':
            // Full replace: the heavy payload is dropped, only the marker remains.
            batch.set(doc(this.db, 'libraries', libraryId, op.collection, op.id), { deletedAt: op.deletedAt, updatedAt: serverTimestamp() });
            break;
          case 'purge':
            batch.delete(doc(this.db, 'libraries', libraryId, op.collection, op.id));
            break;
          case 'library':
            batch.set(this.libraryRef(libraryId), { name: op.name, syncToken: op.syncToken, updatedAt: serverTimestamp() }, { merge: true });
            break;
        }
      }
      await batch.commit();
    } catch (error) {
      throw toRemoteError(error, 'Envoi de la sauvegarde');
    }
  }
}
