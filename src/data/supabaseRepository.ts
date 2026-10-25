import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Exercise,
  ExerciseInput,
  FamilyColor,
  Invitation,
  Library,
  Media,
  MediaKind,
  Member,
  Role,
  SessionUser,
  Sheet,
  SheetInput,
  Tag,
  TagFamily,
} from './types';
import { DEFAULT_SHEET_OPTIONS } from './types';
import { RepositoryError, type AuthAdapter, type LibrarySnapshot, type Repository } from './repository';

const BUCKET = 'media';
const SIGNED_URL_TTL = 60 * 60; // 1 h for on-screen display
const SHARE_URL_TTL = 60 * 60 * 24 * 365; // 1 year for printed QR codes

type Row = Record<string, any>;

const FRENCH_ERRORS: Array<[RegExp, string]> = [
  [/tag_families_unique_name/, 'Une famille porte déjà ce nom.'],
  [/tags_unique_name/, 'Un tag porte déjà ce nom dans cette famille.'],
  [/library_invitations_unique/, 'Cette adresse a déjà été invitée.'],
  [/row-level security/i, 'Action non autorisée pour votre rôle dans cette bibliothèque.'],
  [/Invalid login credentials/i, 'E-mail ou mot de passe incorrect.'],
  [/Email not confirmed/i, 'Adresse e-mail non confirmée : vérifiez votre boîte de réception.'],
  [/User already registered/i, 'Un compte existe déjà avec cette adresse.'],
  [/Password should be at least/i, 'Le mot de passe doit contenir au moins 6 caractères.'],
  [/exceeded the maximum allowed size/i, 'Fichier trop volumineux pour le stockage (50 Mo maximum).'],
  [/mime type .* is not supported/i, 'Type de fichier refusé par le stockage.'],
  [/Failed to fetch|NetworkError|network/i, 'Connexion au serveur impossible. Vérifiez votre réseau.'],
];

function fail(context: string, error: unknown): never {
  const raw = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as Row).message) : String(error);
  const translated = FRENCH_ERRORS.find(([pattern]) => pattern.test(raw))?.[1];
  throw new RepositoryError(translated ? `${context} : ${translated}` : `${context} : ${raw}`, error);
}

const toFamily = (row: Row): TagFamily => ({
  id: row.id,
  libraryId: row.library_id,
  name: row.name,
  description: row.description ?? '',
  color: (row.color ?? 'sable') as FamilyColor,
  position: row.position ?? 0,
  createdAt: row.created_at,
});

const toTag = (row: Row): Tag => ({
  id: row.id,
  libraryId: row.library_id,
  familyId: row.family_id,
  name: row.name,
  position: row.position ?? 0,
  createdAt: row.created_at,
});

const toMedia = (row: Row): Media => ({
  id: row.id,
  libraryId: row.library_id,
  exerciseId: row.exercise_id,
  kind: row.kind,
  storagePath: row.storage_path,
  mimeType: row.mime_type ?? '',
  caption: row.caption ?? '',
  position: row.position ?? 0,
  createdAt: row.created_at,
});

const toExercise = (row: Row): Exercise => ({
  id: row.id,
  libraryId: row.library_id,
  name: row.name,
  description: row.description ?? '',
  instructions: row.instructions ?? '',
  startPosition: row.start_position ?? '',
  equipment: row.equipment ?? '',
  dosage: {
    sets: row.dosage_sets ?? '',
    reps: row.dosage_reps ?? '',
    duration: row.dosage_duration ?? '',
    rest: row.dosage_rest ?? '',
  },
  difficulty: row.difficulty ?? null,
  variants: row.variants ?? '',
  progressions: row.progressions ?? '',
  precautions: row.precautions ?? '',
  notes: row.notes ?? '',
  videoUrl: row.video_url ?? '',
  tagIds: Array.isArray(row.exercise_tags) ? row.exercise_tags.map((t: Row) => t.tag_id) : [],
  media: Array.isArray(row.exercise_media)
    ? row.exercise_media.map(toMedia).sort((a: Media, b: Media) => a.position - b.position)
    : [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toSheet = (row: Row): Sheet => ({
  id: row.id,
  libraryId: row.library_id,
  title: row.title,
  subtitle: row.subtitle ?? '',
  options: { ...DEFAULT_SHEET_OPTIONS, ...(row.options ?? {}) },
  exerciseIds: Array.isArray(row.sheet_items)
    ? [...row.sheet_items].sort((a: Row, b: Row) => a.position - b.position).map((i: Row) => i.exercise_id)
    : [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const fromExerciseInput = (input: ExerciseInput): Row => ({
  name: input.name.trim(),
  description: input.description,
  instructions: input.instructions,
  start_position: input.startPosition,
  equipment: input.equipment,
  dosage_sets: input.dosage.sets,
  dosage_reps: input.dosage.reps,
  dosage_duration: input.dosage.duration,
  dosage_rest: input.dosage.rest,
  difficulty: input.difficulty,
  variants: input.variants,
  progressions: input.progressions,
  precautions: input.precautions,
  notes: input.notes,
  video_url: input.videoUrl,
});

const EXERCISE_SELECT = '*, exercise_tags(tag_id), exercise_media(*)';

class SupabaseAuth implements AuthAdapter {
  constructor(private client: SupabaseClient) {}

  private redirectTo(): string {
    return new URL(import.meta.env.BASE_URL, window.location.origin).href;
  }

  async getUser(): Promise<SessionUser | null> {
    const { data } = await this.client.auth.getSession();
    const user = data.session?.user;
    return user ? { id: user.id, email: user.email ?? '' } : null;
  }

  onChange(callback: (user: SessionUser | null, event?: string) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      callback(user ? { id: user.id, email: user.email ?? '' } : null, event);
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) fail('Connexion impossible', error);
  }

  async signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
    const { data, error } = await this.client.auth.signUp({ email, password, options: { emailRedirectTo: this.redirectTo() } });
    if (error) fail('Création du compte impossible', error);
    return { needsConfirmation: !data.session };
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo: this.redirectTo() });
    if (error) fail('Envoi du lien impossible', error);
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password });
    if (error) fail('Changement de mot de passe impossible', error);
  }
}

/** Production repository: every rule is enforced by Postgres RLS (see supabase/migrations). */
export class SupabaseRepository implements Repository {
  readonly mode = 'supabase' as const;
  readonly auth: AuthAdapter;
  private signedUrls = new Map<string, { url: string; expires: number }>();

  constructor(private client: SupabaseClient) {
    this.auth = new SupabaseAuth(client);
  }

  private storage() {
    return this.client.storage.from(BUCKET);
  }

  async listLibraries(): Promise<Library[]> {
    const { data: libraries, error } = await this.client.rpc('ensure_library');
    if (error) fail('Chargement de la bibliothèque', error);
    const { data: session } = await this.client.auth.getSession();
    const userId = session.session?.user.id;
    const { data: memberships, error: memberError } = await this.client
      .from('library_members')
      .select('library_id, role')
      .eq('user_id', userId ?? '');
    if (memberError) fail('Chargement des accès', memberError);
    const roles = new Map<string, Role>((memberships ?? []).map((m: Row) => [m.library_id, m.role as Role]));
    return ((libraries ?? []) as Row[]).map((row) => ({
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      role: row.owner_id === userId ? 'owner' : (roles.get(row.id) ?? 'reader'),
      createdAt: row.created_at,
    }));
  }

  async renameLibrary(libraryId: string, name: string): Promise<void> {
    const { error } = await this.client.from('libraries').update({ name: name.trim() || 'Ma bibliothèque' }).eq('id', libraryId);
    if (error) fail('Renommage de la bibliothèque', error);
  }

  async loadSnapshot(libraryId: string): Promise<LibrarySnapshot> {
    const [families, tags, exercises, sheets] = await Promise.all([
      this.client.from('tag_families').select('*').eq('library_id', libraryId).order('position').order('name'),
      this.client.from('tags').select('*').eq('library_id', libraryId).order('position').order('name'),
      this.client.from('exercises').select(EXERCISE_SELECT).eq('library_id', libraryId).order('name'),
      this.client.from('sheets').select('*, sheet_items(exercise_id, position)').eq('library_id', libraryId).order('updated_at', { ascending: false }),
    ]);
    const failed = [families, tags, exercises, sheets].find((r) => r.error);
    if (failed?.error) fail('Chargement des données', failed.error);
    return {
      families: (families.data ?? []).map(toFamily),
      tags: (tags.data ?? []).map(toTag),
      exercises: (exercises.data ?? []).map(toExercise),
      sheets: (sheets.data ?? []).map(toSheet),
    };
  }

  async createFamily(libraryId: string, input: Pick<TagFamily, 'name' | 'description' | 'color'>): Promise<TagFamily> {
    const { count } = await this.client.from('tag_families').select('id', { count: 'exact', head: true }).eq('library_id', libraryId);
    const { data, error } = await this.client
      .from('tag_families')
      .insert({ library_id: libraryId, name: input.name.trim(), description: input.description, color: input.color, position: count ?? 0 })
      .select()
      .single();
    if (error) fail('Création de la famille', error);
    return toFamily(data);
  }

  async updateFamily(id: string, patch: Partial<Pick<TagFamily, 'name' | 'description' | 'color' | 'position'>>): Promise<TagFamily> {
    const row: Row = {};
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.color !== undefined) row.color = patch.color;
    if (patch.position !== undefined) row.position = patch.position;
    const { data, error } = await this.client.from('tag_families').update(row).eq('id', id).select().single();
    if (error) fail('Modification de la famille', error);
    return toFamily(data);
  }

  async deleteFamily(id: string): Promise<void> {
    const { error } = await this.client.from('tag_families').delete().eq('id', id);
    if (error) fail('Suppression de la famille', error);
  }

  async createTag(familyId: string, name: string): Promise<Tag> {
    const { count } = await this.client.from('tags').select('id', { count: 'exact', head: true }).eq('family_id', familyId);
    const { data, error } = await this.client
      .from('tags')
      .insert({ family_id: familyId, name: name.trim(), position: count ?? 0 })
      .select()
      .single();
    if (error) fail('Création du tag', error);
    return toTag(data);
  }

  async updateTag(id: string, patch: Partial<Pick<Tag, 'name' | 'position' | 'familyId'>>): Promise<Tag> {
    const row: Row = {};
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.position !== undefined) row.position = patch.position;
    if (patch.familyId !== undefined) row.family_id = patch.familyId;
    const { data, error } = await this.client.from('tags').update(row).eq('id', id).select().single();
    if (error) fail('Modification du tag', error);
    return toTag(data);
  }

  async deleteTag(id: string): Promise<void> {
    const { error } = await this.client.from('tags').delete().eq('id', id);
    if (error) fail('Suppression du tag', error);
  }

  private async replaceTags(exerciseId: string, tagIds: string[]): Promise<void> {
    const unique = [...new Set(tagIds)];
    const { error: deleteError } = await this.client.from('exercise_tags').delete().eq('exercise_id', exerciseId);
    if (deleteError) fail('Mise à jour des tags', deleteError);
    if (unique.length === 0) return;
    const { error } = await this.client.from('exercise_tags').insert(unique.map((tag_id) => ({ exercise_id: exerciseId, tag_id })));
    if (error) fail('Mise à jour des tags', error);
  }

  private async fetchExercise(id: string): Promise<Exercise> {
    const { data, error } = await this.client.from('exercises').select(EXERCISE_SELECT).eq('id', id).single();
    if (error) fail('Lecture de l’exercice', error);
    return toExercise(data);
  }

  async createExercise(libraryId: string, input: ExerciseInput): Promise<Exercise> {
    if (!input.name.trim()) throw new RepositoryError('Le nom de l’exercice est obligatoire.');
    const { data: session } = await this.client.auth.getSession();
    const { data, error } = await this.client
      .from('exercises')
      .insert({ ...fromExerciseInput(input), library_id: libraryId, created_by: session.session?.user.id ?? null })
      .select('id')
      .single();
    if (error) fail('Création de l’exercice', error);
    await this.replaceTags(data.id, input.tagIds);
    return this.fetchExercise(data.id);
  }

  async updateExercise(id: string, input: ExerciseInput): Promise<Exercise> {
    if (!input.name.trim()) throw new RepositoryError('Le nom de l’exercice est obligatoire.');
    const { error } = await this.client.from('exercises').update(fromExerciseInput(input)).eq('id', id);
    if (error) fail('Enregistrement de l’exercice', error);
    await this.replaceTags(id, input.tagIds);
    return this.fetchExercise(id);
  }

  async deleteExercise(exercise: Exercise): Promise<void> {
    const paths = exercise.media.map((m) => m.storagePath);
    if (paths.length > 0) {
      const { error } = await this.storage().remove(paths);
      if (error) fail('Suppression des médias', error);
    }
    const { error } = await this.client.from('exercises').delete().eq('id', exercise.id);
    if (error) fail('Suppression de l’exercice', error);
  }

  async duplicateExercise(exercise: Exercise, name: string): Promise<Exercise> {
    const { id: _id, libraryId, media, createdAt: _c, updatedAt: _u, ...fields } = exercise;
    const created = await this.createExercise(libraryId, { ...fields, name });
    for (const item of media) {
      const path = this.mediaPath(libraryId, created.id, item.mimeType, item.storagePath);
      const { error: copyError } = await this.storage().copy(item.storagePath, path);
      if (copyError) fail('Copie d’un média', copyError);
      const { error } = await this.client.from('exercise_media').insert({
        exercise_id: created.id,
        kind: item.kind,
        storage_path: path,
        mime_type: item.mimeType,
        caption: item.caption,
        position: item.position,
      });
      if (error) fail('Copie d’un média', error);
    }
    return this.fetchExercise(created.id);
  }

  private mediaPath(libraryId: string, exerciseId: string, mimeType: string, original?: string): string {
    const fromMime: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
    };
    const ext = fromMime[mimeType] ?? original?.split('.').pop() ?? 'bin';
    return `${libraryId}/${exerciseId}/${crypto.randomUUID()}.${ext}`;
  }

  async uploadMedia(exercise: Exercise, file: Blob, kind: MediaKind, caption = ''): Promise<Media> {
    const path = this.mediaPath(exercise.libraryId, exercise.id, file.type);
    const { error: uploadError } = await this.storage().upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (uploadError) fail('Envoi du fichier', uploadError);
    const { count } = await this.client.from('exercise_media').select('id', { count: 'exact', head: true }).eq('exercise_id', exercise.id);
    const { data, error } = await this.client
      .from('exercise_media')
      .insert({ exercise_id: exercise.id, kind, storage_path: path, mime_type: file.type, caption, position: count ?? 0 })
      .select()
      .single();
    if (error) {
      await this.storage().remove([path]);
      fail('Enregistrement du média', error);
    }
    return toMedia(data);
  }

  async updateMedia(id: string, patch: Partial<Pick<Media, 'caption' | 'position'>>): Promise<Media> {
    const { data, error } = await this.client.from('exercise_media').update(patch).eq('id', id).select().single();
    if (error) fail('Modification du média', error);
    return toMedia(data);
  }

  async deleteMedia(media: Media): Promise<void> {
    const { error: storageError } = await this.storage().remove([media.storagePath]);
    if (storageError) fail('Suppression du fichier', storageError);
    const { error } = await this.client.from('exercise_media').delete().eq('id', media.id);
    if (error) fail('Suppression du média', error);
    this.signedUrls.delete(media.storagePath);
  }

  private async signedUrl(path: string, ttl: number): Promise<string> {
    const { data, error } = await this.storage().createSignedUrl(path, ttl);
    if (error) fail('Accès au média', error);
    return data.signedUrl;
  }

  async mediaUrl(media: Media): Promise<string> {
    const cached = this.signedUrls.get(media.storagePath);
    if (cached && cached.expires > Date.now() + 60_000) return cached.url;
    const url = await this.signedUrl(media.storagePath, SIGNED_URL_TTL);
    this.signedUrls.set(media.storagePath, { url, expires: Date.now() + SIGNED_URL_TTL * 1000 });
    return url;
  }

  async mediaShareUrl(media: Media): Promise<string> {
    return this.signedUrl(media.storagePath, SHARE_URL_TTL);
  }

  async mediaBlob(media: Media): Promise<Blob> {
    const { data, error } = await this.storage().download(media.storagePath);
    if (error) fail('Téléchargement du média', error);
    return data;
  }

  async saveSheet(libraryId: string, input: SheetInput, id?: string): Promise<Sheet> {
    const row = { library_id: libraryId, title: input.title.trim() || 'Fiche sans titre', subtitle: input.subtitle, options: input.options };
    const query = id
      ? this.client.from('sheets').update(row).eq('id', id).select('id').single()
      : this.client.from('sheets').insert(row).select('id').single();
    const { data, error } = await query;
    if (error) fail('Enregistrement de la fiche', error);
    const sheetId = data.id as string;
    const { error: clearError } = await this.client.from('sheet_items').delete().eq('sheet_id', sheetId);
    if (clearError) fail('Enregistrement de la fiche', clearError);
    const items = [...new Set(input.exerciseIds)].map((exercise_id, position) => ({ sheet_id: sheetId, exercise_id, position }));
    if (items.length > 0) {
      const { error: itemsError } = await this.client.from('sheet_items').insert(items);
      if (itemsError) fail('Enregistrement de la fiche', itemsError);
    }
    const { data: saved, error: readError } = await this.client
      .from('sheets')
      .select('*, sheet_items(exercise_id, position)')
      .eq('id', sheetId)
      .single();
    if (readError) fail('Lecture de la fiche', readError);
    return toSheet(saved);
  }

  async deleteSheet(id: string): Promise<void> {
    const { error } = await this.client.from('sheets').delete().eq('id', id);
    if (error) fail('Suppression de la fiche', error);
  }

  async listMembers(libraryId: string): Promise<Member[]> {
    const { data, error } = await this.client.rpc('library_people', { p_library: libraryId });
    if (error) fail('Liste des membres', error);
    return ((data ?? []) as Row[]).map((row) => ({ userId: row.user_id, email: row.email ?? '', role: row.role, isOwner: row.is_owner }));
  }

  async listInvitations(libraryId: string): Promise<Invitation[]> {
    const { data, error } = await this.client.from('library_invitations').select('*').eq('library_id', libraryId).order('created_at');
    if (error) fail('Liste des invitations', error);
    return ((data ?? []) as Row[]).map((row) => ({ id: row.id, email: row.email, role: row.role, createdAt: row.created_at }));
  }

  async invite(libraryId: string, email: string, role: Exclude<Role, 'owner'>): Promise<Invitation> {
    const { data, error } = await this.client
      .from('library_invitations')
      .insert({ library_id: libraryId, email: email.trim().toLowerCase(), role })
      .select()
      .single();
    if (error) fail('Invitation', error);
    return { id: data.id, email: data.email, role: data.role, createdAt: data.created_at };
  }

  async cancelInvitation(id: string): Promise<void> {
    const { error } = await this.client.from('library_invitations').delete().eq('id', id);
    if (error) fail('Annulation de l’invitation', error);
  }

  async setMemberRole(libraryId: string, userId: string, role: Exclude<Role, 'owner'>): Promise<void> {
    const { error } = await this.client.from('library_members').update({ role }).eq('library_id', libraryId).eq('user_id', userId);
    if (error) fail('Changement de rôle', error);
  }

  async removeMember(libraryId: string, userId: string): Promise<void> {
    const { error } = await this.client.from('library_members').delete().eq('library_id', libraryId).eq('user_id', userId);
    if (error) fail('Retrait du membre', error);
  }

  async clearLibrary(libraryId: string): Promise<void> {
    const { data: media, error: mediaError } = await this.client.from('exercise_media').select('storage_path').eq('library_id', libraryId);
    if (mediaError) fail('Vidage de la bibliothèque', mediaError);
    const paths = (media ?? []).map((m: Row) => m.storage_path as string);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await this.storage().remove(paths.slice(i, i + 100));
      if (error) fail('Suppression des médias', error);
    }
    for (const table of ['sheets', 'exercises', 'tag_families']) {
      const { error } = await this.client.from(table).delete().eq('library_id', libraryId);
      if (error) fail('Vidage de la bibliothèque', error);
    }
  }
}
