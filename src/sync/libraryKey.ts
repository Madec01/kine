// The library key replaces a login for now: whoever knows the key can read
// and write the library. Keys are long random strings, so they cannot be
// guessed or listed; the Firestore rules refuse short identifiers.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0/o/1/l/i, easier to copy by hand
export const LIBRARY_KEY_LENGTH = 24;

export function generateLibraryKey(): string {
  const bytes = new Uint8Array(LIBRARY_KEY_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
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
