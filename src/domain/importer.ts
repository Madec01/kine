import type { Repository, LibrarySnapshot } from '../data/repository';
import type { ExerciseInput, Exercise, Tag, TagFamily } from '../data/types';
import { dataUrlToBlob, sameName, type ExportFile } from './exportImport';

export type ImportMode = 'merge' | 'replace';

export interface ImportReport {
  families: number;
  tags: number;
  exercises: number;
  media: number;
  sheets: number;
  skippedMedia: number;
  warnings: string[];
}

/**
 * Recreates the content of an export file inside a library. In merge mode,
 * families and tags are matched by name (accent- and case-insensitive) so a
 * re-import never creates duplicate tags; exercises are always added.
 */
export async function importExport(
  repo: Repository,
  libraryId: string,
  file: ExportFile,
  mode: ImportMode,
  existing: LibrarySnapshot,
  onProgress?: (message: string) => void,
): Promise<ImportReport> {
  const report: ImportReport = { families: 0, tags: 0, exercises: 0, media: 0, sheets: 0, skippedMedia: 0, warnings: [] };

  let families: TagFamily[] = existing.families;
  let tags: Tag[] = existing.tags;
  if (mode === 'replace') {
    onProgress?.('Suppression du contenu actuel…');
    await repo.clearLibrary(libraryId);
    families = [];
    tags = [];
  }

  const familyIdMap = new Map<string, string>();
  const tagIdMap = new Map<string, string>();

  for (const family of file.families) {
    let target = families.find((f) => sameName(f.name, family.name));
    if (!target) {
      onProgress?.(`Famille « ${family.name} »…`);
      target = await repo.createFamily(libraryId, { name: family.name, description: family.description, color: family.color });
      families = [...families, target];
      report.families += 1;
    }
    familyIdMap.set(family.id, target.id);
    for (const tag of family.tags) {
      let targetTag = tags.find((t) => t.familyId === target!.id && sameName(t.name, tag.name));
      if (!targetTag) {
        targetTag = await repo.createTag(target.id, tag.name);
        tags = [...tags, targetTag];
        report.tags += 1;
      }
      tagIdMap.set(tag.id, targetTag.id);
    }
  }

  const exerciseIdMap = new Map<string, string>();
  for (const item of file.exercises) {
    onProgress?.(`Exercice « ${item.name} »…`);
    const input: ExerciseInput = {
      name: item.name,
      description: item.description,
      instructions: item.instructions,
      startPosition: item.startPosition,
      equipment: item.equipment,
      dosage: { ...item.dosage },
      difficulty: item.difficulty,
      variants: item.variants,
      progressions: item.progressions,
      precautions: item.precautions,
      notes: item.notes,
      videoUrl: item.videoUrl,
      tagIds: item.tags.map((id) => tagIdMap.get(id)).filter((id): id is string => Boolean(id)),
    };
    let created: Exercise = await repo.createExercise(libraryId, input);
    exerciseIdMap.set(item.id, created.id);
    report.exercises += 1;

    for (const media of [...item.media].sort((a, b) => a.position - b.position)) {
      if (!media.dataUrl) {
        report.skippedMedia += 1;
        continue;
      }
      try {
        const { blob } = dataUrlToBlob(media.dataUrl);
        const saved = await repo.uploadMedia(created, blob, media.kind, media.caption);
        created = { ...created, media: [...created.media, saved] };
        report.media += 1;
      } catch (error) {
        report.skippedMedia += 1;
        report.warnings.push(`Média non importé pour « ${item.name} » : ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  for (const sheet of file.sheets) {
    const exerciseIds = sheet.exerciseIds.map((id) => exerciseIdMap.get(id)).filter((id): id is string => Boolean(id));
    if (exerciseIds.length === 0) continue;
    await repo.saveSheet(libraryId, { title: sheet.title, subtitle: sheet.subtitle, options: sheet.options, exerciseIds });
    report.sheets += 1;
  }

  if (report.skippedMedia > 0) {
    report.warnings.unshift(
      `${report.skippedMedia} média(s) n’étaient pas intégrés au fichier (export sans images ou vidéos trop lourdes) et n’ont pas été restaurés.`,
    );
  }
  return report;
}
