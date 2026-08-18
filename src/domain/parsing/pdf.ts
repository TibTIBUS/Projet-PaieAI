import * as pdfjs from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Extraction du texte d'un bulletin PDF, côté navigateur.
 *
 * Le point délicat est la reconstitution des colonnes : un bulletin de paie est
 * un tableau, et le moteur d'analyse s'appuie sur l'alignement pour distinguer
 * la part salariale de la part patronale. On reprojette donc chaque fragment de
 * texte sur une grille de caractères déduite de ses coordonnées, plutôt que de
 * concaténer les fragments dans l'ordre de lecture.
 */

export interface ResultatExtraction {
  lignes: string[];
  nombrePages: number;
  /** `true` si le PDF ne contient pas de couche texte exploitable. */
  probablementScanne: boolean;
}

/** Écart vertical en dessous duquel deux fragments sont sur la même ligne. */
const TOLERANCE_LIGNE = 3;

export async function extraireTextePdf(fichier: ArrayBuffer): Promise<ResultatExtraction> {
  const document = await pdfjs.getDocument({ data: fichier, isEvalSupported: false }).promise;
  const lignes: string[] = [];

  try {
    for (let numero = 1; numero <= document.numPages; numero++) {
      const page = await document.getPage(numero);
      const contenu = await page.getTextContent();
      const fragments = contenu.items.filter(estFragmentTexte);
      lignes.push(...reconstruireLignes(fragments));
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }

  const caracteres = lignes.join('').replace(/\s/g, '').length;
  return {
    lignes,
    nombrePages: document.numPages,
    probablementScanne: caracteres < 200,
  };
}

function estFragmentTexte(item: unknown): item is TextItem {
  return typeof (item as TextItem)?.str === 'string';
}

/**
 * Regroupe les fragments par ligne, puis reprojette chacun à sa colonne.
 * La largeur de caractère de référence est la médiane observée sur la page :
 * elle donne une grille stable même si plusieurs polices coexistent.
 */
export function reconstruireLignes(fragments: TextItem[]): string[] {
  const utiles = fragments.filter((f) => f.str.trim().length > 0);
  if (!utiles.length) return [];

  const largeurCaractere = medianeLargeurCaractere(utiles);

  // Regroupement par ordonnée décroissante (l'origine PDF est en bas à gauche).
  const groupes = new Map<number, TextItem[]>();
  for (const fragment of utiles) {
    const y = fragment.transform[5];
    const cle = [...groupes.keys()].find((k) => Math.abs(k - y) <= TOLERANCE_LIGNE);
    if (cle === undefined) groupes.set(y, [fragment]);
    else groupes.get(cle)!.push(fragment);
  }

  return [...groupes.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => composerLigne(items, largeurCaractere))
    .filter((l) => l.trim().length > 0);
}

function medianeLargeurCaractere(fragments: TextItem[]): number {
  const largeurs = fragments
    .filter((f) => f.width > 0 && f.str.trim().length > 0)
    .map((f) => f.width / f.str.length)
    .sort((a, b) => a - b);
  if (!largeurs.length) return 5;
  const mediane = largeurs[Math.floor(largeurs.length / 2)];
  // Une grille trop fine produirait des lignes démesurées.
  return Math.max(mediane, 1.5);
}

function composerLigne(items: TextItem[], largeurCaractere: number): string {
  const tries = [...items].sort((a, b) => a.transform[4] - b.transform[4]);
  const origine = 0;
  let ligne = '';

  for (const item of tries) {
    const colonne = Math.round((item.transform[4] - origine) / largeurCaractere);
    if (colonne > ligne.length) {
      ligne += ' '.repeat(colonne - ligne.length);
    } else if (ligne.length && !/\s$/.test(ligne)) {
      // Chevauchement : on garantit au moins une séparation.
      ligne += ' ';
    }
    ligne += item.str;
  }
  return ligne.replace(/\s+$/, '');
}

/**
 * Rend une page en image, pour la reconnaissance optique des bulletins scannés.
 * L'échelle est volontairement élevée : la qualité de l'OCR en dépend
 * directement, et le rendu reste local au navigateur.
 */
export async function rendrePageEnImage(
  fichier: ArrayBuffer,
  numeroPage: number,
  echelle = 2.5,
): Promise<Blob> {
  const document = await pdfjs.getDocument({ data: fichier, isEvalSupported: false }).promise;
  try {
    const page = await document.getPage(numeroPage);
    const viewport = page.getViewport({ scale: echelle });
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const contexte = canvas.getContext('2d');
    if (!contexte) throw new Error('Impossible de préparer le rendu de la page.');

    await page.render({ canvasContext: contexte, viewport }).promise;
    return await new Promise<Blob>((resoudre, rejeter) => {
      canvas.toBlob(
        (blob) => (blob ? resoudre(blob) : rejeter(new Error('Rendu de la page impossible.'))),
        'image/png',
      );
    });
  } finally {
    await document.destroy();
  }
}

export async function nombreDePages(fichier: ArrayBuffer): Promise<number> {
  const document = await pdfjs.getDocument({ data: fichier, isEvalSupported: false }).promise;
  const total = document.numPages;
  await document.destroy();
  return total;
}
