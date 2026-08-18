import type { Anomalie } from '../../types';
import { arrondi } from '../../parsing/montants';
import type { Controle } from '../types';
import { brut, euros, finaliser, REF_PRESCRIPTION, tauxHoraire, tauxHoraireDeBase } from '../utils';

/* ------------------------------------------------------------------ */
/* SMI-01 — taux horaire inférieur au SMIC                             */
/* ------------------------------------------------------------------ */

export const controleSmicHoraire: Controle = {
  code: 'SMI-01',
  nom: 'Respect du SMIC horaire',
  categorie: 'salaire_minimum',
  description: 'Compare le taux horaire du salaire de base au SMIC horaire en vigueur sur la période.',
  references: [
    { texte: 'Articles L.3231-2 et suivants du Code du travail — salaire minimum de croissance' },
  ],
  applicable: ({ bulletin }) => {
    if (bulletin.contrat.type === 'APPRENTISSAGE') {
      return 'Les apprentis relèvent d’un pourcentage du SMIC variable selon l’âge et l’année de contrat.';
    }
    return tauxHoraireDeBase(bulletin) === undefined
      ? 'Aucun taux horaire n’a pu être déduit du salaire de base.'
      : null;
  },
  executer({ bulletin, params }) {
    const taux = tauxHoraireDeBase(bulletin)!;
    if (taux >= params.smicHoraire - 0.005) return [];

    const heures = bulletin.heures.normales ?? params.dureeLegaleMensuelle;
    const manque = arrondi((params.smicHoraire - taux) * heures);

    return [
      finaliser(
        {
          code: 'SMI-01',
          controle: this.nom,
          titre: 'Taux horaire inférieur au SMIC',
          severite: 'critique',
          categorie: 'salaire_minimum',
          confiance: params.fiabilite === 'verifie' ? 'certaine' : 'a_verifier',
          explication:
            `Votre taux horaire est de ${tauxHoraire(taux)} alors que le SMIC s’élève à ` +
            `${tauxHoraire(params.smicHoraire)} sur cette période. ` +
            `Il vous manque environ ${euros(manque)} de salaire brut ce mois-ci.`,
          detail:
            `Taux horaire constaté ${tauxHoraire(taux)} — SMIC horaire ${tauxHoraire(params.smicHoraire)} ` +
            `(source : ${params.sources[0]}). Base retenue : ${heures} heures.` +
            (params.fiabilite !== 'verifie'
              ? ' ⚠️ La valeur du SMIC pour cette période n’est pas vérifiée dans l’application.'
              : ''),
          attendu: params.smicHoraire,
          constate: taux,
          ecart: arrondi(taux - params.smicHoraire, 4),
          impactMensuel: manque,
          references: [
            { texte: 'Article L.3231-2 du Code du travail' },
            { texte: 'Article L.3232-1 du Code du travail — rémunération mensuelle minimale' },
            REF_PRESCRIPTION,
          ],
          actions: [
            'Le non-respect du SMIC est une infraction : la régularisation est due sans discussion.',
            'Réclamez le rappel de salaire sur les trois dernières années par courrier recommandé.',
            'À défaut de réponse, saisissez l’inspection du travail puis le conseil de prud’hommes.',
          ],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* SMI-02 — brut mensuel inférieur au SMIC mensualisé                  */
/* ------------------------------------------------------------------ */

export const controleSmicMensuel: Controle = {
  code: 'SMI-02',
  nom: 'Respect du SMIC mensuel',
  categorie: 'salaire_minimum',
  description:
    'Compare la rémunération mensuelle brute au SMIC mensualisé, pour un salarié à temps complet et sans absence.',
  references: [{ texte: 'Article L.3232-1 du Code du travail' }],
  applicable: ({ bulletin }) => {
    if (bulletin.salarie.tempsPartiel) return 'Salarié à temps partiel : le SMIC mensuel se proratise.';
    if (bulletin.heures.absences) return 'Des absences ont été retenues sur le mois : comparaison non pertinente.';
    if (bulletin.contrat.type === 'APPRENTISSAGE') return 'Contrat d’apprentissage : rémunération minimale spécifique.';
    if (brut(bulletin) === undefined) return 'Le brut n’a pas pu être lu.';
    return null;
  },
  executer({ bulletin, params }) {
    const remuneration = brut(bulletin)!;
    // On neutralise les heures supplémentaires, exclues de la comparaison au SMIC.
    const heuresSupp = bulletin.heures.supplementaires.reduce((s, h) => s + h.montant, 0);
    const base = arrondi(remuneration - heuresSupp);
    if (base >= params.smicMensuel - 0.5) return [];

    const manque = arrondi(params.smicMensuel - base);
    return [
      finaliser(
        {
          code: 'SMI-02',
          controle: this.nom,
          titre: 'Rémunération mensuelle inférieure au SMIC',
          severite: 'critique',
          categorie: 'salaire_minimum',
          confiance: params.fiabilite === 'verifie' ? 'probable' : 'a_verifier',
          explication:
            `Hors heures supplémentaires, votre rémunération brute s’élève à ${euros(base)}, ` +
            `en deçà du SMIC mensualisé de ${euros(params.smicMensuel)} pour 151,67 heures. ` +
            `Il manque ${euros(manque)}.`,
          detail:
            `Brut ${euros(remuneration)}` +
            (heuresSupp ? ` dont ${euros(heuresSupp)} d’heures supplémentaires exclues de la comparaison` : '') +
            ` — SMIC mensualisé ${euros(params.smicMensuel)}.`,
          attendu: params.smicMensuel,
          constate: base,
          ecart: arrondi(base - params.smicMensuel),
          impactMensuel: manque,
          references: [
            { texte: 'Article L.3232-1 du Code du travail — rémunération mensuelle minimale' },
            REF_PRESCRIPTION,
          ],
          actions: [
            'Vérifiez d’abord qu’aucune absence non rémunérée n’explique l’écart.',
            'Si le mois est complet, réclamez le complément : le SMIC est un plancher d’ordre public.',
          ],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* SMI-03 — minimum conventionnel                                      */
/* ------------------------------------------------------------------ */

export const controleMinimumConventionnel: Controle = {
  code: 'SMI-03',
  nom: 'Respect du minimum conventionnel',
  categorie: 'salaire_minimum',
  description:
    'Compare la rémunération au minimum conventionnel de la branche saisi par l’utilisateur.',
  references: [
    { texte: 'Article L.2253-1 du Code du travail — primauté de la branche sur les salaires minima hiérarchiques' },
  ],
  applicable: ({ options, bulletin }) => {
    if (options.minimumConventionnel === undefined) {
      return 'Aucun minimum conventionnel n’a été saisi. Renseignez-le pour activer ce contrôle.';
    }
    return brut(bulletin) === undefined ? 'Le brut n’a pas pu être lu.' : null;
  },
  executer({ bulletin, params, options }) {
    const minimum = options.minimumConventionnel!;
    const remuneration = brut(bulletin)!;
    const heuresSupp = bulletin.heures.supplementaires.reduce((s, h) => s + h.montant, 0);
    const base = arrondi(remuneration - heuresSupp);
    if (base >= minimum - 0.5) return [];

    const manque = arrondi(minimum - base);
    const anomalie: Anomalie = finaliser(
      {
        code: 'SMI-03',
        controle: this.nom,
        titre: 'Rémunération inférieure au minimum conventionnel',
        severite: 'critique',
        categorie: 'salaire_minimum',
        confiance: 'probable',
        explication:
          `Le minimum conventionnel que vous avez renseigné est de ${euros(minimum)}. ` +
          `Votre rémunération hors heures supplémentaires s’élève à ${euros(base)}, ` +
          `soit ${euros(manque)} de moins.`,
        detail:
          `Convention collective : ${bulletin.employeur.conventionCollective ?? 'non identifiée'}` +
          (bulletin.employeur.idcc ? ` (IDCC ${bulletin.employeur.idcc})` : '') +
          `. Coefficient : ${bulletin.salarie.niveauCoefficient ?? 'non identifié'}.`,
        attendu: minimum,
        constate: base,
        ecart: arrondi(base - minimum),
        impactMensuel: manque,
        references: [
          { texte: 'Article L.2253-1 du Code du travail' },
          REF_PRESCRIPTION,
        ],
        actions: [
          'Vérifiez la grille de salaires en vigueur de votre convention collective pour votre coefficient.',
          'Attention : certaines primes s’intègrent au minimum conventionnel, d’autres non. Vérifiez le texte de la branche.',
          'Réclamez le rappel de salaire sur les trois dernières années.',
        ],
      },
      params,
    );
    return [anomalie];
  },
};

export const CONTROLES_SALAIRE_MINIMUM: Controle[] = [
  controleSmicHoraire,
  controleSmicMensuel,
  controleMinimumConventionnel,
];
