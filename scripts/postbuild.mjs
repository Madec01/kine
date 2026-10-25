// GitHub Pages has no SPA fallback: serving index.html as 404.html lets deep
// links such as /kine/exercices/<id> load the application.
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const index = resolve(dist, 'index.html');
if (!existsSync(index)) {
  console.error('dist/index.html introuvable : lancer `vite build` d’abord.');
  process.exit(1);
}
copyFileSync(index, resolve(dist, '404.html'));
writeFileSync(resolve(dist, '.nojekyll'), '');
console.log('dist/ prêt : 404.html et .nojekyll ajoutés.');
