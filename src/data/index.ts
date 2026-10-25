import { LocalRepository } from './localRepository';

/** Opens the device store (IndexedDB). The online backup is layered on top by the sync engine. */
export function createRepository(): Promise<LocalRepository> {
  return LocalRepository.open();
}
