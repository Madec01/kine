import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { SheetDocument, type PdfExercise, type PdfSheet } from '../../src/pdf/SheetDocument';
import { DEFAULT_SHEET_OPTIONS } from '../../src/data/types';

// 1×1 orange PNG.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const exercise = (name: string, extra: Partial<PdfExercise> = {}): PdfExercise => ({
  name,
  difficulty: 3,
  description: 'Description de l’exercice, avec des accents : é è à ç œ « » — et une flèche -> convertie.',
  instructions: 'Consigne 1.\nConsigne 2 sur une autre ligne.',
  startPosition: 'Assis, pieds à plat.',
  equipment: 'Chaise',
  dosage: { sets: '3', reps: '10', duration: '', rest: '1 min' },
  variants: 'Avec appui.',
  progressions: 'Sans appui.',
  precautions: 'Surveiller la tension.',
  notes: 'Note perso.',
  images: [],
  tagGroups: [{ family: 'Objectifs structurels', tags: ['Renforcement MI', 'Équilibre'] }],
  ...extra,
});

describe('SheetDocument', () => {
  it('renders a multi-page A4 PDF with images, tags and a QR code', async () => {
    const qr = await QRCode.toDataURL('https://example.org/video', { margin: 1, width: 220 });
    const exercises: PdfExercise[] = [
      exercise('Lever de chaise', { images: [PNG, PNG], video: { url: 'https://example.org/video', qr, label: 'Vidéo de démonstration' } }),
      ...Array.from({ length: 9 }, (_, i) => exercise(`Exercice ${i + 2}`)),
    ];
    const sheet: PdfSheet = {
      title: 'Programme test',
      subtitle: 'Sous-titre',
      date: '25 octobre 2026',
      options: { ...DEFAULT_SHEET_OPTIONS, tags: true, variants: true, notes: true },
      exercises,
    };
    const buffer = await renderToBuffer(<SheetDocument sheet={sheet} />);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
    expect(pages).toBeGreaterThanOrEqual(2);
    mkdirSync(resolve(process.cwd(), 'test-results'), { recursive: true });
    writeFileSync(resolve(process.cwd(), 'test-results', 'unit-sheet.pdf'), buffer);
  });

  it('renders an empty sheet without crashing', async () => {
    const buffer = await renderToBuffer(
      <SheetDocument sheet={{ title: 'Vide', subtitle: '', date: 'aujourd’hui', options: DEFAULT_SHEET_OPTIONS, exercises: [] }} />,
    );
    expect(buffer.length).toBeGreaterThan(500);
  });
});
