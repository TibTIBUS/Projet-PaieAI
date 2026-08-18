import type { Bulletin } from '@/domain/types';
import { analyserLignes } from '@/domain/parsing/parser';
import type { PeriodeDetectee } from '@/domain/parsing/parser';

export type EtapeImport =
  | { etape: 'lecture'; fichier: string }
  | { etape: 'extraction'; fichier: string }
  | { etape: 'ocr'; fichier: string; page: number; totalPages: number; avancement: number }
  | { etape: 'analyse'; fichier: string }
  | { etape: 'termine'; fichier: string };

export interface ResultatImport {
  bulletin?: Bulletin;
  erreur?: string;
  /** Le fichier a nécessité une reconnaissance optique. */
  ocrUtilise: boolean;
}

const TAILLE_MAX_OCTETS = 20 * 1024 * 1024;

/**
 * Transforme un fichier déposé par l'utilisateur en bulletin exploitable.
 * Tout se passe dans le navigateur : le fichier n'est jamais téléversé.
 */
export async function importerFichier(
  fichier: File,
  surProgression?: (e: EtapeImport) => void,
  periodeForcee?: PeriodeDetectee,
): Promise<ResultatImport> {
  const nom = fichier.name;
  try {
    if (fichier.size > TAILLE_MAX_OCTETS) {
      return { erreur: 'Le fichier dépasse 20 Mo. Réduisez sa taille avant de le déposer.', ocrUtilise: false };
    }

    surProgression?.({ etape: 'lecture', fichier: nom });
    const donnees = await fichier.arrayBuffer();

    if (estTexte(fichier)) {
      const texte = new TextDecoder('utf-8').decode(donnees);
      surProgression?.({ etape: 'analyse', fichier: nom });
      const bulletin = analyserLignes(texte.split('\n'), {
        nomFichier: nom, source: 'manuel', periode: periodeForcee,
      });
      surProgression?.({ etape: 'termine', fichier: nom });
      return { bulletin, ocrUtilise: false };
    }

    if (!estPdf(fichier)) {
      return {
        erreur: 'Format non reconnu. Déposez un PDF, ou exportez votre bulletin en texte.',
        ocrUtilise: false,
      };
    }

    surProgression?.({ etape: 'extraction', fichier: nom });
    // pdf.js n'est chargé qu'au premier dépôt de PDF : inutile de l'imposer
    // au chargement de la page d'accueil.
    const { extraireTextePdf, nombreDePages } = await import('@/domain/parsing/pdf');
    const extraction = await extraireTextePdf(donnees.slice(0));

    let lignes = extraction.lignes;
    let ocrUtilise = false;

    if (extraction.probablementScanne) {
      ocrUtilise = true;
      const { extraireTexteParOcr } = await import('@/domain/parsing/ocr');
      const pages = await nombreDePages(donnees.slice(0));
      lignes = await extraireTexteParOcr(donnees.slice(0), Math.min(pages, 4), (p) =>
        surProgression?.({ etape: 'ocr', fichier: nom, ...p }),
      );
    }

    if (!lignes.join('').trim()) {
      return {
        erreur:
          'Aucun texte n’a pu être lu dans ce PDF. S’il s’agit d’une photo, reprenez-la bien à plat et bien éclairée.',
        ocrUtilise,
      };
    }

    surProgression?.({ etape: 'analyse', fichier: nom });
    const bulletin = analyserLignes(lignes, {
      nomFichier: nom,
      source: ocrUtilise ? 'ocr' : 'pdf',
      periode: periodeForcee,
    });
    surProgression?.({ etape: 'termine', fichier: nom });
    return { bulletin, ocrUtilise };
  } catch (erreur) {
    return {
      erreur: erreur instanceof Error
        ? `Lecture impossible : ${erreur.message}`
        : 'Lecture impossible : erreur inattendue.',
      ocrUtilise: false,
    };
  }
}

function estPdf(fichier: File): boolean {
  return fichier.type === 'application/pdf' || /\.pdf$/i.test(fichier.name);
}

function estTexte(fichier: File): boolean {
  return fichier.type.startsWith('text/') || /\.(txt|csv)$/i.test(fichier.name);
}
