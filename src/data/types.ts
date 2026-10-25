// Domain types shared by the UI, the local store, the sync engine and the PDF generator.

export interface Library {
  id: string;
  name: string;
  createdAt: string;
}

/** Palette names for tag families; the CSS maps each to a hue. */
export const FAMILY_COLORS = ['sable', 'terre', 'olive', 'ardoise', 'prune', 'ocre', 'menthe', 'rose'] as const;
export type FamilyColor = (typeof FAMILY_COLORS)[number];

export interface TagFamily {
  id: string;
  name: string;
  description: string;
  color: FamilyColor;
  position: number;
  createdAt: string;
}

export interface Tag {
  id: string;
  familyId: string;
  name: string;
  position: number;
  createdAt: string;
}

export type MediaKind = 'image' | 'video';

export interface Media {
  id: string;
  exerciseId: string;
  kind: MediaKind;
  mimeType: string;
  caption: string;
  position: number;
  bytes: number;
  /** The file itself is present on this device (otherwise it can be fetched online). */
  available: boolean;
  /** The file exists (or is scheduled) in the online backup; videos never are. */
  synced: boolean;
  createdAt: string;
}

export interface Dosage {
  sets: string;
  reps: string;
  duration: string;
  rest: string;
}

export interface Exercise {
  id: string;
  name: string;
  description: string;
  instructions: string;
  startPosition: string;
  equipment: string;
  dosage: Dosage;
  /** 1 (très facile) à 5 (très difficile), ou null si non renseigné. */
  difficulty: number | null;
  variants: string;
  progressions: string;
  precautions: string;
  notes: string;
  videoUrl: string;
  tagIds: string[];
  media: Media[];
  /** Small JPEG data URL of the first image, for lists (no download needed). */
  thumb: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ExerciseInput = Omit<Exercise, 'id' | 'media' | 'thumb' | 'createdAt' | 'updatedAt'>;

export const EMPTY_EXERCISE: ExerciseInput = {
  name: '',
  description: '',
  instructions: '',
  startPosition: '',
  equipment: '',
  dosage: { sets: '', reps: '', duration: '', rest: '' },
  difficulty: null,
  variants: '',
  progressions: '',
  precautions: '',
  notes: '',
  videoUrl: '',
  tagIds: [],
};

export interface SheetOptions {
  description: boolean;
  instructions: boolean;
  startPosition: boolean;
  equipment: boolean;
  dosage: boolean;
  images: boolean;
  tags: boolean;
  precautions: boolean;
  variants: boolean;
  notes: boolean;
  video: boolean;
}

export const DEFAULT_SHEET_OPTIONS: SheetOptions = {
  description: true,
  instructions: true,
  startPosition: true,
  equipment: true,
  dosage: true,
  images: true,
  tags: false,
  precautions: true,
  variants: false,
  notes: false,
  video: true,
};

export interface Sheet {
  id: string;
  title: string;
  subtitle: string;
  options: SheetOptions;
  exerciseIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SheetInput {
  title: string;
  subtitle: string;
  options: SheetOptions;
  exerciseIds: string[];
}
