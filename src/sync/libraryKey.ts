// Without user accounts, the library identifier plays the role of the login.
// By default it is derived from the Firebase configuration embedded in the
// site, so every device that opens the site shares the same library with
// nothing to type. Identifiers are long, so the Firestore rules can refuse
// anything short and forbid listing.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // 31 symbols, no 0/o/1/l/i
export const LIBRARY_KEY_LENGTH = 24;

function fromBytes(bytes: Uint8Array): string {
  return Array.from(bytes.subarray(0, LIBRARY_KEY_LENGTH), (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function generateLibraryKey(): string {
  const bytes = new Uint8Array(LIBRARY_KEY_LENGTH);
  crypto.getRandomValues(bytes);
  return fromBytes(bytes);
}

/** Deterministic identifier for a Firebase project: same site, same library on every device. */
export async function deriveLibraryKey(projectId: string, apiKey: string): Promise<string> {
  const data = new TextEncoder().encode(`kine-library|${projectId}|${apiKey}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return fromBytes(new Uint8Array(digest));
}

export function normalizeLibraryKey(input: string): string {
  return input.trim().toLowerCase().replace(/[\s-]/g, '');
}

export function isValidLibraryKey(key: string): boolean {
  return /^[a-z0-9]{20,64}$/.test(key);
}

/** Groups of 4 for display: abcd-efgh-… */
export function formatLibraryKey(key: string): string {
  return key.replace(/(.{4})(?=.)/g, '$1-');
}

/**
 * Which library this device must use: the configured one always wins; a
 * device that previously used another identifier must adopt it (its local
 * content is merged in).
 */
export function resolveLibraryKey(stored: string | undefined | null, configured: string): { key: string; mustAdopt: boolean } {
  return { key: configured, mustAdopt: Boolean(stored) && stored !== configured };
}
