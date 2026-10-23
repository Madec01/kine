import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const destination=resolve(root,'dist');
rmSync(destination,{recursive:true,force:true});
mkdirSync(destination,{recursive:true});
for(const path of ['index.html','styles.css','data.js','model.js','illustrations.js','app.js','assets']){
  cpSync(resolve(root,path),resolve(destination,path),{recursive:true});
}
console.log('Site statique préparé dans dist/.');
