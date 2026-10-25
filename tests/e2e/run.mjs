// End-to-end check of the main flows in local mode, with the pre-installed
// Chromium. Run `npm run build` first; screenshots and the generated PDF land
// in test-results/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = Number(process.env.KINE_E2E_PORT || 4173);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = resolve(process.cwd(), 'test-results');
mkdirSync(OUT, { recursive: true });

const assert = (condition, message) => {
  if (!condition) throw new Error(`Échec : ${message}`);
  console.log(`  ✓ ${message}`);
};

async function startServer() {
  const { preview } = await import('vite');
  const server = await preview({ preview: { port: PORT, strictPort: true, host: '127.0.0.1', open: false }, logLevel: 'error' });
  return { kill: () => new Promise((done) => server.httpServer.close(() => done())) };
}

async function fakeImage(browser, color, label) {
  const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
  await page.setContent(`<body style="margin:0;background:${color};display:grid;place-items:center;font:bold 40px sans-serif;color:#fff">${label}</body>`);
  const buffer = await page.screenshot({ type: 'png' });
  await page.close();
  return { name: `${label}.png`, mimeType: 'image/png', buffer };
}

async function createFamily(page, name, tags) {
  await page.getByRole('button', { name: /Nouvelle famille|Créer une famille/ }).first().click();
  await page.getByLabel('Nom *').fill(name);
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  const family = page.locator('section.family', { hasText: name });
  await family.waitFor();
  for (const tag of tags) {
    await family.getByLabel(`Nouveau tag dans ${name}`).fill(tag);
    await family.getByLabel(`Nouveau tag dans ${name}`).press('Enter');
    await family.getByRole('button', { name: new RegExp(`^${tag}`) }).waitFor();
  }
}

async function createExercise(page, data, image) {
  await page.goto(`${BASE}/exercices/nouveau`);
  await page.getByLabel('Nom *').fill(data.name);
  if (data.description) await page.getByLabel('Description').fill(data.description);
  if (data.instructions) await page.getByLabel('Consignes de réalisation').fill(data.instructions);
  if (data.precautions) await page.getByLabel('Précautions et consignes de sécurité').fill(data.precautions);
  if (data.sets) await page.getByLabel('Séries').fill(data.sets);
  if (data.reps) await page.getByLabel('Répétitions').fill(data.reps);
  if (data.difficulty) await page.getByRole('group', { name: 'Difficulté' }).getByRole('button', { name: String(data.difficulty), exact: true }).click();
  for (const tag of data.tags ?? []) {
    await page.locator('section.form-section', { hasText: 'Tags' }).getByRole('button', { name: tag, exact: true }).click();
  }
  if (image) {
    await page.locator('input[type=file][accept^="image"]').setInputFiles(image);
    await page.getByText(/À envoyer/).waitFor();
  }
  await page.getByRole('button', { name: 'Créer l’exercice' }).click();
  await page.waitForURL(/\/exercices\/[0-9a-f-]{36}$/);
  await page.getByRole('heading', { level: 1, name: data.name }).waitFor();
}

const server = await startServer();
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'fr-FR', acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error('Erreur page :', error.message));

  console.log('1. Bibliothèque vide au départ');
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/exercices$/);
  await page.getByText('Votre bibliothèque est vide').waitFor();
  assert(await page.getByText('Mode local').first().isVisible(), 'le mode local est indiqué');
  await page.screenshot({ path: resolve(OUT, '01-vide.png') });

  console.log('2. Familles et tags');
  await page.goto(`${BASE}/tags`);
  await page.getByText('Aucune famille pour l’instant').waitFor();
  await createFamily(page, 'Objectifs structurels', ['Renforcement MI', 'Équilibre']);
  await createFamily(page, 'Biomécanique', ['CCF']);
  await createFamily(page, 'Objectifs fonctionnels', ['Assis-debout', 'Marche']);
  assert((await page.locator('section.family').count()) === 3, 'trois familles créées');
  // Duplicate names are refused (case/accent insensitive).
  const structural = page.locator('section.family', { hasText: 'Objectifs structurels' });
  await structural.getByLabel('Nouveau tag dans Objectifs structurels').fill('equilibre');
  await structural.getByLabel('Nouveau tag dans Objectifs structurels').press('Enter');
  await page.getByText(/existe déjà/).waitFor();
  assert(true, 'un doublon de tag est refusé');
  await page.screenshot({ path: resolve(OUT, '02-tags.png'), fullPage: true });

  console.log('3. Exercices');
  const photo = await fakeImage(browser, '#9a4a24', 'Photo');
  await createExercise(page, { name: 'Lever de chaise', description: 'Se lever sans les mains depuis une chaise standard.', instructions: 'Pieds en arrière, buste penché, pousser dans les jambes.', precautions: 'Chaise stable, appui à portée.', sets: '3', reps: '8', difficulty: 2, tags: ['Renforcement MI', 'CCF', 'Assis-debout'] }, photo);
  assert(await page.locator('.gallery img').first().isVisible(), 'l’image envoyée s’affiche sur la fiche');
  await page.screenshot({ path: resolve(OUT, '03-fiche.png'), fullPage: true });
  await createExercise(page, { name: 'Montée de marche', description: 'Monter une marche en alternant le pied de départ.', sets: '2', reps: '10', difficulty: 3, tags: ['Renforcement MI', 'CCF', 'Marche'] });
  await createExercise(page, { name: 'Équilibre unipodal', description: 'Tenir sur un pied avec appui léger.', difficulty: 4, tags: ['Équilibre', 'Marche'] });

  console.log('4. Recherche multicritère');
  await page.goto(`${BASE}/exercices`);
  await page.locator('.results-head', { hasText: '3 exercices' }).waitFor();
  await page.getByLabel('Rechercher un exercice').fill('equilibre');
  await page.getByText('1 exercice correspondant').waitFor();
  assert(await page.getByRole('link', { name: 'Équilibre unipodal' }).isVisible(), 'la recherche ignore les accents');
  await page.getByLabel('Effacer la recherche').click();
  await page.locator('.results-head', { hasText: '3 exercices' }).waitFor();
  const rail = page.locator('aside.filters--rail');
  await rail.getByRole('button', { name: /^Renforcement MI/ }).click();
  await rail.getByRole('button', { name: /^CCF/ }).click();
  await rail.getByRole('button', { name: /^Assis-debout/ }).click();
  await page.getByText('1 exercice correspondant').waitFor();
  assert(await page.getByRole('link', { name: 'Lever de chaise' }).isVisible(), 'structurel + biomécanique + fonctionnel = 1 exercice (ET entre familles)');
  assert(page.url().includes('tags='), 'les filtres sont dans l’adresse (partageable, bouton retour)');
  await rail.getByRole('button', { name: /^Marche/ }).click();
  await page.getByText('2 exercices correspondant').waitFor();
  assert(true, 'deux tags d’une même famille = OU par défaut');
  await rail.getByRole('group', { name: 'Combinaison dans Objectifs fonctionnels' }).getByRole('button', { name: 'ET' }).click();
  await page.getByText('Aucun exercice ne correspond').waitFor();
  assert(true, 'le mode ET dans une famille est appliqué');
  await rail.getByRole('group', { name: 'Combinaison dans Objectifs fonctionnels' }).getByRole('button', { name: 'OU' }).click();
  await page.getByText('2 exercices correspondant').waitFor();
  await page.screenshot({ path: resolve(OUT, '04-recherche.png'), fullPage: true });

  console.log('5. Sélection et PDF');
  await page.getByRole('button', { name: 'Tout ajouter à la sélection' }).click();
  await page.getByRole('button', { name: 'Retirer ces résultats de la sélection' }).waitFor();
  await page.getByRole('link', { name: 'Sélection' }).first().click();
  await page.waitForURL(/\/selection$/);
  await page.locator('.sel-row').first().waitFor();
  assert((await page.locator('.sel-row').count()) === 2, 'deux exercices dans la sélection');
  await page.locator('.sel-row').nth(1).getByLabel('Monter').click();
  const firstName = await page.locator('.sel-row').first().locator('a').innerText();
  assert(firstName === 'Montée de marche', 'l’ordre peut être modifié');
  await page.getByLabel('Titre de la fiche').fill('Programme assis-debout');
  await page.getByLabel('Sous-titre ou remarques').fill('Séance du matin, 2 fois par semaine');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: /Générer le PDF/ }).click()]);
  const pdfPath = resolve(OUT, 'fiche.pdf');
  await download.saveAs(pdfPath);
  const pdf = readFileSync(pdfPath);
  assert(pdf.subarray(0, 5).toString() === '%PDF-', `un PDF est téléchargé (${(pdf.length / 1024).toFixed(0)} Ko, ${download.suggestedFilename()})`);
  assert(pdf.length > 5000, 'le PDF contient du contenu (image incluse)');
  await page.getByRole('button', { name: /Enregistrer cette fiche/ }).click();
  await page.getByText('Fiches enregistrées').waitFor();
  assert(true, 'la fiche est enregistrée pour réutilisation');
  await page.screenshot({ path: resolve(OUT, '05-selection.png'), fullPage: true });

  console.log('6. Dupliquer, modifier, supprimer');
  await page.goto(`${BASE}/exercices`);
  await page.getByRole('link', { name: 'Lever de chaise' }).click();
  await page.getByRole('button', { name: 'Dupliquer' }).click();
  await page.waitForURL(/\/modifier$/);
  await page.getByLabel('Nom *').waitFor();
  assert((await page.getByLabel('Nom *').inputValue()) === 'Lever de chaise (copie)', 'la copie reçoit un nom libre');
  await page.locator('.media-tile img').first().waitFor();
  assert((await page.locator('.media-tile img').count()) === 1, 'la copie reprend l’image');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForURL(/\/exercices\/[0-9a-f-]{36}$/);
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).last().click();
  await page.waitForURL(/\/exercices$/);
  await page.locator('.results-head', { hasText: '3 exercices' }).waitFor();
  assert(true, 'la copie est supprimée');

  console.log('7. Renommer et supprimer des tags');
  await page.goto(`${BASE}/tags`);
  await page.getByRole('button', { name: /^CCF/ }).click();
  await page.getByLabel('Nom *').fill('Chaîne cinétique fermée');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByRole('button', { name: /^Chaîne cinétique fermée/ }).waitFor();
  await page.goto(`${BASE}/exercices`);
  await page.getByRole('link', { name: 'Montée de marche' }).click();
  assert(await page.getByText('Chaîne cinétique fermée').isVisible(), 'le tag renommé est mis à jour sur les exercices');
  await page.goto(`${BASE}/tags`);
  await page.getByRole('button', { name: /^Marche/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.getByText('Tag supprimé.').waitFor();
  await page.goto(`${BASE}/exercices?tags=`);
  await page.getByRole('link', { name: 'Équilibre unipodal' }).click();
  assert(!(await page.getByText('Marche', { exact: true }).isVisible().catch(() => false)), 'le tag supprimé disparaît des exercices');

  console.log('8. Export, import et persistance');
  await page.goto(`${BASE}/reglages`);
  const [exportDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter la bibliothèque' }).click()]);
  const exportPath = resolve(OUT, 'export.json');
  await exportDownload.saveAs(exportPath);
  const exported = JSON.parse(readFileSync(exportPath, 'utf8'));
  assert(exported.format === 'kine-bibliotheque' && exported.exercises.length === 3, 'l’export contient les 3 exercices');
  assert(exported.exercises.some((e) => e.media.some((m) => m.dataUrl?.startsWith('data:image/'))), 'les images sont intégrées à l’export');
  assert(exported.families.length === 3 && exported.sheets.length === 1, 'familles, tags et fiches sont exportés');
  await page.locator('input[type=file][accept*="json"]').setInputFiles(exportPath);
  await page.getByText('Importer cet export ?').waitFor();
  await page.getByRole('button', { name: 'Importer', exact: true }).click();
  await page.getByText('Import terminé.').first().waitFor({ timeout: 30000 });
  await page.goto(`${BASE}/exercices`);
  await page.locator('.results-head', { hasText: '6 exercices' }).waitFor();
  assert(true, 'l’import en mode « ajouter » recrée les exercices sans dupliquer les tags');
  await page.goto(`${BASE}/tags`);
  await page.locator('section.family').first().waitFor();
  assert((await page.locator('section.family').count()) === 3, 'toujours trois familles après import');
  await page.reload();
  await page.locator('section.family').first().waitFor();
  await page.goto(`${BASE}/exercices`);
  await page.locator('.results-head', { hasText: '6 exercices' }).waitFor();
  assert(true, 'les données survivent au rechargement (IndexedDB)');

  console.log('9. Téléphone');
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
  const mpage = await mobile.newPage();
  await mpage.goto(`${BASE}/exercices`);
  await mpage.getByText('Votre bibliothèque est vide').waitFor();
  assert(await mpage.locator('nav.bottomnav').isVisible(), 'navigation basse sur téléphone (nouveau profil : bibliothèque vide)');
  await mpage.screenshot({ path: resolve(OUT, '06-mobile-vide.png') });
  await mobile.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/exercices`);
  await page.getByRole('button', { name: /Filtres/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Renforcement MI/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Voir 4 exercices/ }).click();
  await page.locator('.results-head', { hasText: '4 exercices' }).waitFor();
  assert((await page.locator('.card, .row').count()) === 4, 'les filtres fonctionnent dans le panneau mobile');
  await page.screenshot({ path: resolve(OUT, '07-mobile-liste.png'), fullPage: true });
  await page.goto(`${BASE}/selection`);
  await page.screenshot({ path: resolve(OUT, '08-mobile-selection.png'), fullPage: true });

  writeFileSync(resolve(OUT, 'e2e-ok.txt'), new Date().toISOString());
  console.log('\nTous les parcours sont passés.');
} finally {
  await browser.close();
  await server.kill();
}
