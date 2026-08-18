import { rendrePageEnImage } from './pdf';

/**
 * Reconnaissance optique pour les bulletins scannés.
 *
 * Tesseract est chargé à la demande : la plupart des bulletins comportent une
 * couche texte et n'en ont pas besoin, il serait inutile d'imposer ce poids au
 * chargement de l'application. Le traitement reste intégralement local.
 */

export interface ProgressionOcr {
  page: number;
  totalPages: number;
  /** Avancement de la page courante, entre 0 et 1. */
  avancement: number;
}

export async function extraireTexteParOcr(
  fichier: ArrayBuffer,
  totalPages: number,
  surProgression?: (p: ProgressionOcr) => void,
): Promise<string[]> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('fra', 1, {
    logger: (message: { status: string; progress: number }) => {
      if (message.status === 'recognizing text') {
        surProgression?.({ page: 0, totalPages, avancement: message.progress });
      }
    },
  });

  const lignes: string[] = [];
  try {
    for (let page = 1; page <= totalPages; page++) {
      surProgression?.({ page, totalPages, avancement: 0 });
      const image = await rendrePageEnImage(fichier, page);
      const { data } = await worker.recognize(image);
      lignes.push(...data.text.split('\n'));
      surProgression?.({ page, totalPages, avancement: 1 });
    }
  } finally {
    await worker.terminate();
  }
  return lignes;
}
