import type { Anomalie, Bulletin, ResultatAnalyse, Severite } from '../types';
import { parametresPour, referentielFiable } from '../referentiel';
import type { SurchargesReferentiel } from '../referentiel';
import { arrondi } from '../parsing/montants';
import { CONTROLES_ARITHMETIQUES } from './controles/arithmetique';
import { CONTROLES_ASSIETTES } from './controles/assiettes';
import { CONTROLES_AVANTAGES } from './controles/avantages';
import { CONTROLES_CONFORMITE } from './controles/conformite';
import { CONTROLES_CONGES } from './controles/conges';
import { CONTROLES_COTISATIONS } from './controles/cotisations';
import { CONTROLES_HISTORIQUE } from './controles/historique';
import { CONTROLES_SALAIRE_MINIMUM } from './controles/salaire-minimum';
import { CONTROLES_TEMPS_TRAVAIL } from './controles/heures';
import type { Controle, ContexteControle, OptionsAnalyse } from './types';

export * from './types';

/** Catalogue complet des contrôles exécutés sur un bulletin. */
export const CONTROLES: Controle[] = [
  ...CONTROLES_ARITHMETIQUES,
  ...CONTROLES_COTISATIONS,
  ...CONTROLES_ASSIETTES,
  ...CONTROLES_SALAIRE_MINIMUM,
  ...CONTROLES_TEMPS_TRAVAIL,
  ...CONTROLES_CONGES,
  ...CONTROLES_AVANTAGES,
  ...CONTROLES_CONFORMITE,
  ...CONTROLES_HISTORIQUE,
];

/** Pondération du score de conformité, par sévérité. */
const PENALITES: Record<Severite, number> = {
  critique: 30,
  majeure: 12,
  mineure: 4,
  info: 0,
};

const ORDRE_SEVERITE: Record<Severite, number> = {
  critique: 0, majeure: 1, mineure: 2, info: 3,
};

export interface EntreeAnalyse {
  bulletin: Bulletin;
  /** Bulletins antérieurs du même salarié, dans n'importe quel ordre. */
  historique?: Bulletin[];
  options?: OptionsAnalyse;
  surcharges?: SurchargesReferentiel;
}

/**
 * Exécute l'ensemble des contrôles sur un bulletin.
 *
 * Aucun contrôle ne peut interrompre l'analyse : une exception dans un contrôle
 * est capturée et remontée comme contrôle non exécuté, de sorte qu'un cas de
 * paie exotique ne prive jamais l'utilisateur du reste du rapport.
 */
export function analyser({ bulletin, historique = [], options = {}, surcharges }: EntreeAnalyse): ResultatAnalyse {
  const params = parametresPour(bulletin.annee, bulletin.mois, surcharges);
  const fiable = referentielFiable(params);

  const anterieurs = [...historique]
    .filter((b) => b.id !== bulletin.id)
    .filter((b) => b.annee * 12 + b.mois < bulletin.annee * 12 + bulletin.mois)
    .sort((a, b) => a.annee * 12 + a.mois - (b.annee * 12 + b.mois));

  const ctx: ContexteControle = { bulletin, params, historique: anterieurs, options };

  const anomalies: Anomalie[] = [];
  const controlesNonExecutes: { code: string; raison: string }[] = [];
  let controlesExecutes = 0;

  for (const controle of CONTROLES) {
    try {
      const raison = controle.applicable?.(ctx);
      if (raison) {
        controlesNonExecutes.push({ code: controle.code, raison });
        continue;
      }
      controlesExecutes += 1;
      anomalies.push(...controle.executer(ctx));
    } catch (erreur) {
      controlesNonExecutes.push({
        code: controle.code,
        raison: `Erreur interne du contrôle : ${erreur instanceof Error ? erreur.message : 'inconnue'}`,
      });
    }
  }

  const retenues = trier(dedupliquer(fiable ? anomalies : degrader(anomalies)));
  const score = calculerScore(retenues);

  const impactMensuelTotal = arrondi(
    retenues.reduce((s, a) => s + Math.max(a.impactMensuel ?? 0, 0), 0),
  );
  const rappelPotentielTotal = arrondi(
    retenues.reduce((s, a) => s + Math.max(a.rappelPotentiel ?? 0, 0), 0),
  );

  return {
    bulletinId: bulletin.id,
    annee: bulletin.annee,
    mois: bulletin.mois,
    anomalies: retenues,
    score,
    impactMensuelTotal,
    rappelPotentielTotal,
    controlesExecutes,
    controlesNonExecutes,
    referentielFiable: fiable,
    analyseLe: new Date().toISOString(),
  };
}

/**
 * Lorsque le référentiel de la période n'est pas vérifié, aucune anomalie ne
 * peut être présentée comme certaine : on rétrograde toutes les certitudes.
 */
function degrader(anomalies: Anomalie[]): Anomalie[] {
  return anomalies.map((a) =>
    a.confiance === 'certaine' && a.categorie !== 'arithmetique'
      ? { ...a, confiance: 'a_verifier' as const }
      : a,
  );
}

/** Deux anomalies de même code sur la même ligne n'en font qu'une. */
function dedupliquer(anomalies: Anomalie[]): Anomalie[] {
  const vues = new Map<string, Anomalie>();
  for (const a of anomalies) {
    const cle = `${a.code}|${a.lignesConcernees?.join(',') ?? ''}|${a.titre}`;
    const existante = vues.get(cle);
    if (!existante || (a.impactMensuel ?? 0) > (existante.impactMensuel ?? 0)) {
      vues.set(cle, a);
    }
  }
  return [...vues.values()];
}

function trier(anomalies: Anomalie[]): Anomalie[] {
  return [...anomalies].sort((a, b) => {
    const parSeverite = ORDRE_SEVERITE[a.severite] - ORDRE_SEVERITE[b.severite];
    if (parSeverite !== 0) return parSeverite;
    return (b.impactMensuel ?? 0) - (a.impactMensuel ?? 0);
  });
}

/** Score de conformité sur 100, plancher à 0. */
export function calculerScore(anomalies: Anomalie[]): number {
  const penalite = anomalies.reduce((s, a) => {
    const poids = PENALITES[a.severite];
    // Une anomalie seulement « à vérifier » pèse moitié moins.
    return s + (a.confiance === 'a_verifier' ? poids / 2 : poids);
  }, 0);
  return Math.max(0, Math.round(100 - penalite));
}

/* ------------------------------------------------------------------ */
/* Analyse d'un dossier complet                                        */
/* ------------------------------------------------------------------ */

export interface SyntheseDossier {
  resultats: ResultatAnalyse[];
  /** Score moyen pondéré sur l'ensemble des bulletins. */
  scoreMoyen: number;
  /** Somme des impacts mensuels constatés, tous bulletins confondus. */
  impactCumule: number;
  /** Estimation du rappel mobilisable sur la période de prescription. */
  rappelPotentiel: number;
  /** Anomalies présentes sur au moins trois bulletins : erreurs systémiques. */
  anomaliesRecurrentes: { code: string; titre: string; occurrences: number; impactCumule: number }[];
}

/** Analyse une série de bulletins et en tire une synthèse. */
export function analyserDossier(
  bulletins: Bulletin[],
  options: OptionsAnalyse = {},
  surcharges?: SurchargesReferentiel,
): SyntheseDossier {
  const tries = [...bulletins].sort((a, b) => a.annee * 12 + a.mois - (b.annee * 12 + b.mois));
  const resultats = tries.map((bulletin, index) =>
    analyser({ bulletin, historique: tries.slice(0, index), options, surcharges }),
  );

  const scoreMoyen = resultats.length
    ? Math.round(resultats.reduce((s, r) => s + r.score, 0) / resultats.length)
    : 100;
  const impactCumule = arrondi(resultats.reduce((s, r) => s + r.impactMensuelTotal, 0));

  const parCode = new Map<string, { titre: string; occurrences: number; impactCumule: number }>();
  for (const r of resultats) {
    for (const a of r.anomalies) {
      const entree = parCode.get(a.code) ?? { titre: a.titre, occurrences: 0, impactCumule: 0 };
      entree.occurrences += 1;
      entree.impactCumule = arrondi(entree.impactCumule + (a.impactMensuel ?? 0));
      parCode.set(a.code, entree);
    }
  }
  const anomaliesRecurrentes = [...parCode.entries()]
    .filter(([, v]) => v.occurrences >= 3)
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.impactCumule - a.impactCumule);

  // Le rappel mobilisable retient l'impact mensuel le plus récent, projeté sur
  // la période de prescription, plutôt que la somme des projections mensuelles.
  const dernier = resultats[resultats.length - 1];
  const rappelPotentiel = dernier ? dernier.rappelPotentielTotal : 0;

  return { resultats, scoreMoyen, impactCumule, rappelPotentiel, anomaliesRecurrentes };
}
