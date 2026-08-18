import type { Bulletin, ResultatAnalyse } from '@/domain/types';
import { euros, moisAnnee } from './format';

/**
 * Export du rapport en PDF, destiné à être transmis au service paie,
 * à un expert-comptable ou à un conseil.
 */

const MARGE = 15;
const LARGEUR = 210;
const LIBELLE_SEVERITE: Record<string, string> = {
  critique: 'CRITIQUE',
  majeure: 'MAJEURE',
  mineure: 'MINEURE',
  info: 'INFORMATION',
};

/**
 * jsPDF est chargé à la demande : il pèse plusieurs centaines de kilooctets et
 * n'est utile qu'au moment où l'utilisateur télécharge son rapport.
 */
export async function exporterRapportPdf(
  bulletin: Bulletin,
  resultat: ResultatAnalyse,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGE;

  const saut = (hauteur: number) => {
    if (y + hauteur > 280) {
      doc.addPage();
      y = MARGE;
    }
  };

  const paragraphe = (texte: string, taille = 10, style: 'normal' | 'bold' = 'normal', interligne = 5) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(taille);
    const lignes = doc.splitTextToSize(texte, LARGEUR - 2 * MARGE);
    saut(lignes.length * interligne);
    doc.text(lignes, MARGE, y);
    y += lignes.length * interligne;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Rapport d’analyse de bulletin de paie', MARGE, y);
  y += 9;

  paragraphe(
    `Période : ${moisAnnee(bulletin.annee, bulletin.mois)} — Fichier : ${bulletin.nomFichier}`,
    10, 'normal', 5,
  );
  paragraphe(
    `Analyse réalisée le ${new Date(resultat.analyseLe).toLocaleDateString('fr-FR')} par PaieAI. ` +
    `${resultat.controlesExecutes} contrôles exécutés.`,
    9,
  );
  y += 3;

  doc.setDrawColor(220);
  doc.line(MARGE, y, LARGEUR - MARGE, y);
  y += 7;

  paragraphe('Synthèse', 13, 'bold', 6);
  paragraphe(`Score de conformité : ${resultat.score}/100`, 10);
  paragraphe(
    `Écart mensuel constaté en votre faveur : ${euros(resultat.impactMensuelTotal)}`,
    10,
  );
  paragraphe(
    `Rappel mobilisable sur la période de prescription de trois ans : ${euros(resultat.rappelPotentielTotal)}`,
    10,
  );
  if (!resultat.referentielFiable) {
    paragraphe(
      'Attention : les paramètres légaux de cette période n’ont pas été vérifiés dans l’application. ' +
      'Les constats doivent être confirmés avant toute démarche.',
      9, 'bold',
    );
  }
  y += 4;

  paragraphe(`Anomalies relevées (${resultat.anomalies.length})`, 13, 'bold', 6);
  if (!resultat.anomalies.length) {
    paragraphe('Aucune anomalie détectée sur ce bulletin.', 10);
  }

  for (const [index, anomalie] of resultat.anomalies.entries()) {
    saut(30);
    y += 2;
    paragraphe(
      `${index + 1}. [${LIBELLE_SEVERITE[anomalie.severite]}] ${anomalie.titre}`,
      11, 'bold', 5,
    );
    paragraphe(anomalie.explication, 9.5);
    paragraphe(`Détail du calcul : ${anomalie.detail}`, 9);
    if (anomalie.impactMensuel) {
      paragraphe(
        `Impact mensuel : ${euros(anomalie.impactMensuel)} — sur trois ans : ${euros(anomalie.rappelPotentiel ?? 0)}`,
        9, 'bold',
      );
    }
    paragraphe(`Références : ${anomalie.references.map((r) => r.texte).join(' ; ')}`, 8.5);
    if (anomalie.actions.length) {
      paragraphe(`À faire : ${anomalie.actions.join(' ')}`, 9);
    }
  }

  saut(30);
  y += 6;
  doc.setDrawColor(220);
  doc.line(MARGE, y, LARGEUR - MARGE, y);
  y += 6;
  paragraphe(
    'Ce rapport est établi automatiquement à partir des informations lues sur le bulletin. ' +
    'Il constitue une aide au contrôle et ne remplace pas l’analyse d’un professionnel de la paie ' +
    'ou d’un conseil juridique. Vérifiez chaque constat avant d’engager une démarche.',
    8, 'normal', 4,
  );

  return doc.output('blob');
}

/** Export brut des données, pour transmission à un professionnel. */
export function exporterJson(bulletins: Bulletin[], resultats: ResultatAnalyse[]): Blob {
  const contenu = {
    genereLe: new Date().toISOString(),
    outil: 'PaieAI',
    bulletins: bulletins.map((b) => ({ ...b, texteBrut: undefined })),
    resultats,
  };
  return new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' });
}

export function telecharger(blob: Blob, nomFichier: string) {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}
