import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { SheetOptions } from '../data/types';

export interface PdfTagGroup {
  family: string;
  tags: string[];
}

export interface PdfExercise {
  name: string;
  difficulty: number | null;
  description: string;
  instructions: string;
  startPosition: string;
  equipment: string;
  dosage: { sets: string; reps: string; duration: string; rest: string };
  variants: string;
  progressions: string;
  precautions: string;
  notes: string;
  /** JPEG/PNG data URLs, already downscaled. */
  images: string[];
  tagGroups: PdfTagGroup[];
  video?: { url: string; qr?: string; label: string };
}

export interface PdfSheet {
  title: string;
  subtitle: string;
  date: string;
  options: SheetOptions;
  exercises: PdfExercise[];
}

const ink = '#1c2326';
const muted = '#6b777b';
const accent = '#9a4a24';
const line = '#d8cfbf';
const paper = '#f4efe6';

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 10, color: ink },
  header: { marginBottom: 18, paddingBottom: 10, borderBottomWidth: 1.5, borderBottomColor: accent },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 20, letterSpacing: -0.3, marginBottom: 4 },
  subtitle: { marginTop: 2, fontSize: 10.5, color: ink, lineHeight: 1.3 },
  meta: { marginTop: 4, fontSize: 8.5, color: muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  exercise: { marginBottom: 14, paddingBottom: 12, borderBottomWidth: 0.6, borderBottomColor: line },
  exerciseHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  number: { width: 20, height: 20, borderRadius: 10, backgroundColor: ink, color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 9.5, textAlign: 'center', paddingTop: 4.5, marginRight: 8 },
  name: { fontFamily: 'Helvetica-Bold', fontSize: 13.5, flexGrow: 1 },
  dots: { flexDirection: 'row', marginLeft: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: line, marginLeft: 2.5 },
  dotOn: { backgroundColor: accent },
  body: { flexDirection: 'row' },
  text: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  side: { width: 150, marginLeft: 14 },
  image: { width: 150, maxHeight: 130, objectFit: 'contain', marginBottom: 6, borderRadius: 4 },
  section: { marginBottom: 5 },
  label: { fontSize: 7.5, color: muted, letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 1.5 },
  para: { fontSize: 10, lineHeight: 1.35 },
  dosage: { flexDirection: 'row', marginBottom: 6, marginTop: 2 },
  cell: { backgroundColor: paper, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8, marginRight: 6 },
  cellValue: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  cellLabel: { fontSize: 7, color: muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  warnBox: { borderLeftWidth: 2.5, borderLeftColor: '#9c6410', paddingLeft: 7, marginBottom: 6, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  chip: { borderWidth: 0.6, borderColor: line, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1.5, marginRight: 3, marginBottom: 3, fontSize: 7.8 },
  chipFamily: { fontSize: 7.5, color: muted, marginRight: 4, marginBottom: 3, paddingVertical: 2 },
  video: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  qr: { width: 54, height: 54, marginRight: 8 },
  videoText: { fontSize: 8.5, color: ink, flexShrink: 1, lineHeight: 1.3 },
  link: { color: accent, fontSize: 7.5 },
  footerLeft: { position: 'absolute', left: 40, bottom: 22, fontSize: 7.5, color: muted },
  footerRight: { position: 'absolute', left: 40, right: 40, bottom: 22, fontSize: 7.5, color: muted, textAlign: 'right' },
  empty: { color: muted, fontStyle: 'italic', marginTop: 20 },
});

function Section({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <View style={s.section}>
      <Text style={s.label} minPresenceAhead={24}>{label}</Text>
      <Text style={s.para}>{text}</Text>
    </View>
  );
}

function Dots({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <View style={s.dots}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View key={n} style={n <= value ? [s.dot, s.dotOn] : s.dot} />
      ))}
    </View>
  );
}

/**
 * Rough height estimate (points) of one exercise block, used to keep short
 * exercises on a single page while letting very long ones flow across pages.
 */
export function estimateHeight(exercise: PdfExercise, o: SheetOptions): number {
  const images = o.images ? exercise.images.length : 0;
  const columnWidth = images > 0 ? 515 - 164 : 515;
  const charsPerLine = Math.max(40, Math.floor(columnWidth / 4.9));
  const block = (text: string): number => {
    if (!text.trim()) return 0;
    const lines = text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
    return 12 + lines * 13.5 + 5;
  };
  let height = 32; // header
  if (o.description) height += block(exercise.description);
  if (o.startPosition) height += block(exercise.startPosition);
  if (o.equipment) height += block(exercise.equipment);
  if (o.instructions) height += block(exercise.instructions);
  const d = exercise.dosage;
  if (o.dosage && (d.sets || d.reps || d.duration || d.rest)) height += 38;
  if (o.precautions) height += block(exercise.precautions);
  if (o.variants) height += block(exercise.variants) + block(exercise.progressions);
  if (o.notes) height += block(exercise.notes);
  if (o.tags && exercise.tagGroups.length > 0) height += 14 + exercise.tagGroups.length * 16;
  if (o.video && exercise.video) height += 62;
  const imagesHeight = images * 136;
  return Math.max(height, imagesHeight + 32) + 26;
}

/** Content height of an A4 page minus margins. */
const PAGE_CONTENT_HEIGHT = 842 - 40 - 48;

export function SheetDocument({ sheet }: { sheet: PdfSheet }) {
  const o = sheet.options;
  return (
    <Document title={sheet.title} author="Kiné · Bibliothèque d'exercices" language="fr">
      <Page size="A4" style={s.page} wrap>
        <View style={s.header}>
          <Text style={s.title}>{sheet.title}</Text>
          {sheet.subtitle.trim() !== '' && <Text style={s.subtitle}>{sheet.subtitle}</Text>}
          <Text style={s.meta}>
            {sheet.exercises.length} exercice{sheet.exercises.length > 1 ? 's' : ''} · {sheet.date}
          </Text>
        </View>

        {sheet.exercises.length === 0 && <Text style={s.empty}>Aucun exercice sélectionné.</Text>}

        {sheet.exercises.map((exercise, index) => {
          const d = exercise.dosage;
          const hasDosage = o.dosage && Boolean(d.sets || d.reps || d.duration || d.rest);
          const images = o.images ? exercise.images : [];
          // Exercises up to ~60 % of a page are kept whole; taller ones may wrap.
          const atomic = estimateHeight(exercise, o) < PAGE_CONTENT_HEIGHT * 0.6;
          return (
            <View key={index} style={s.exercise} wrap={!atomic}>
              <View style={s.exerciseHead} wrap={false} minPresenceAhead={70}>
                <Text style={s.number}>{index + 1}</Text>
                <Text style={s.name}>{exercise.name}</Text>
                <Dots value={exercise.difficulty} />
              </View>
              <View style={s.body}>
                <View style={s.text}>
                  {o.description && <Section label="Description" text={exercise.description} />}
                  {o.startPosition && <Section label="Position de départ" text={exercise.startPosition} />}
                  {o.equipment && <Section label="Matériel" text={exercise.equipment} />}
                  {o.instructions && <Section label="Consignes" text={exercise.instructions} />}
                  {hasDosage && (
                    <View style={s.dosage} wrap={false}>
                      {d.sets ? <View style={s.cell}><Text style={s.cellValue}>{d.sets}</Text><Text style={s.cellLabel}>Séries</Text></View> : null}
                      {d.reps ? <View style={s.cell}><Text style={s.cellValue}>{d.reps}</Text><Text style={s.cellLabel}>Répétitions</Text></View> : null}
                      {d.duration ? <View style={s.cell}><Text style={s.cellValue}>{d.duration}</Text><Text style={s.cellLabel}>Durée</Text></View> : null}
                      {d.rest ? <View style={s.cell}><Text style={s.cellValue}>{d.rest}</Text><Text style={s.cellLabel}>Récupération</Text></View> : null}
                    </View>
                  )}
                  {o.precautions && exercise.precautions.trim() !== '' && (
                    <View style={s.warnBox}>
                      <Text style={s.label} minPresenceAhead={24}>Précautions</Text>
                      <Text style={s.para}>{exercise.precautions}</Text>
                    </View>
                  )}
                  {o.variants && <Section label="Variantes" text={exercise.variants} />}
                  {o.variants && <Section label="Progressions" text={exercise.progressions} />}
                  {o.notes && <Section label="Notes" text={exercise.notes} />}
                  {o.tags && exercise.tagGroups.length > 0 && (
                    <View style={s.section}>
                      <Text style={s.label}>Tags</Text>
                      <View style={s.chips}>
                        {exercise.tagGroups.map((group) => (
                          <View key={group.family} style={s.chips}>
                            <Text style={s.chipFamily}>{group.family} :</Text>
                            {group.tags.map((tag) => (
                              <Text key={tag} style={s.chip}>{tag}</Text>
                            ))}
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  {o.video && exercise.video && (
                    <View style={s.video} wrap={false}>
                      {exercise.video.qr && <Image style={s.qr} src={exercise.video.qr} />}
                      <View style={{ flexShrink: 1 }}>
                        <Text style={s.videoText}>{exercise.video.label}</Text>
                        <Text style={s.link}>{exercise.video.url}</Text>
                      </View>
                    </View>
                  )}
                </View>
                {images.length > 0 && (
                  <View style={s.side}>
                    {images.map((src, i) => (
                      <Image key={i} style={s.image} src={src} />
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        })}

        <Text style={s.footerLeft} fixed>{sheet.title}</Text>
        <Text style={s.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
