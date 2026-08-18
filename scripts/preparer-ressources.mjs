/**
 * Copie les ressources de reconnaissance optique depuis node_modules vers
 * `public/tesseract/`.
 *
 * Par défaut, tesseract.js télécharge son worker, son cœur WebAssembly et son
 * fichier de langue depuis un CDN. Ces requêtes ne transportent pas le bulletin,
 * mais elles contredisent la promesse de l'application — « rien ne sort de votre
 * appareil » — et empêchent un fonctionnement hors connexion. On les sert donc
 * depuis notre propre origine, ce qui permet à la politique de sécurité de
 * contenu d'interdire purement et simplement toute connexion sortante.
 *
 * Les fichiers copiés ne sont pas versionnés : ils sont régénérés à chaque build
 * à partir des dépendances déclarées.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(racine, 'public', 'tesseract');

/** Variante « best_int » : dix fois plus légère que la variante complète. */
const RESSOURCES = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz', 'fra.traineddata.gz'],
];

await mkdir(destination, { recursive: true });

for (const [source, nom] of RESSOURCES) {
  const chemin = require.resolve(source);
  await copyFile(chemin, join(destination, nom));
  console.log(`ressource copiée : ${nom}`);
}
