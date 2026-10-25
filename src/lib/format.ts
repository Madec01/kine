export function formatDate(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Très facile',
  2: 'Facile',
  3: 'Modéré',
  4: 'Difficile',
  5: 'Très difficile',
};

export function difficultyLabel(value: number | null): string {
  return value ? (DIFFICULTY_LABELS[value] ?? `Niveau ${value}`) : 'Non renseigné';
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

export function excerpt(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Sanitizes free text for PDF standard fonts (WinAnsi): maps unsupported glyphs. */
export function pdfSafe(text: string): string {
  return text
    .replace(/[→⇒➜➔]/g, '->')
    .replace(/[←⇐]/g, '<-')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/≠/g, '!=')
    .replace(/[•▪◦]/g, '-')
    .replace(/[✓✔]/g, 'v')
    .replace(/[✗✘]/g, 'x')
    .replace(/ /g, ' ');
}
