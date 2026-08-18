import type { Anomalie } from '../../types';
import { arrondi } from '../../parsing/montants';
import type { Controle } from '../types';
import {
  aUneLigne, effectif, euros, finaliser, ligneParCode, REF_PRESCRIPTION,
  severiteSelonEcart, tauxHoraireDeBase,
} from '../utils';

/* ------------------------------------------------------------------ */
/* HRS-01 — majoration des heures supplémentaires                      */
/* ------------------------------------------------------------------ */

export const controleMajorationHeuresSupp: Controle = {
  code: 'HRS-01',
  nom: 'Majoration des heures supplémentaires',
  categorie: 'temps_travail',
  description:
    'Vérifie que chaque heure supplémentaire est payée avec la majoration annoncée, calculée sur le taux horaire de base.',
  references: [
    { texte: 'Article L.3121-36 du Code du travail — majoration de 25 % puis 50 %' },
    { texte: 'Article L.3121-33 du Code du travail — taux conventionnel minimal de 10 %' },
  ],
  applicable: ({ bulletin }) =>
    bulletin.heures.supplementaires.length === 0
      ? 'Aucune heure supplémentaire détectée sur ce bulletin.'
      : tauxHoraireDeBase(bulletin) === undefined
        ? 'Le taux horaire de base n’a pas pu être déduit.'
        : null,
  executer({ bulletin, params }) {
    const anomalies: Anomalie[] = [];
    const tauxBase = tauxHoraireDeBase(bulletin)!;

    for (const hs of bulletin.heures.supplementaires) {
      const ligne = bulletin.lignes.find((l) => l.libelle === hs.libelle);
      const tauxPaye = ligne?.tauxUnitaire ?? (hs.nombre ? arrondi(hs.montant / hs.nombre, 4) : undefined);
      if (tauxPaye === undefined) continue;

      const majorationReelle = arrondi((tauxPaye / tauxBase - 1) * 100, 2);
      const majorationAnnoncee = hs.majoration;
      const majorationDue = Math.max(majorationAnnoncee, params.heuresSupplementaires.majorationMinimaleConventionnelle);

      if (majorationReelle >= majorationDue - 0.5) continue;

      const tauxDu = arrondi(tauxBase * (1 + majorationDue / 100), 4);
      const manque = arrondi((tauxDu - tauxPaye) * hs.nombre);

      anomalies.push(
        finaliser(
          {
            code: 'HRS-01',
            controle: this.nom,
            titre: `Heures supplémentaires sous-majorées (« ${hs.libelle} »)`,
            severite: severiteSelonEcart(manque, 5, 40),
            categorie: 'temps_travail',
            confiance: 'probable',
            explication:
              `Ces heures sont annoncées majorées à ${majorationAnnoncee} %, mais elles sont payées ` +
              `${tauxPaye.toFixed(4)} € contre ${tauxBase.toFixed(4)} € pour une heure normale, ` +
              `soit une majoration réelle de ${majorationReelle} %. ` +
              `Il vous manque ${euros(manque)} sur ce bulletin.`,
            detail:
              `${hs.nombre} h à ${tauxPaye.toFixed(4)} € = ${euros(hs.montant)}. ` +
              `Au taux dû de ${tauxDu.toFixed(4)} € (${majorationDue} % de majoration), ` +
              `le montant serait de ${euros(arrondi(tauxDu * hs.nombre))}.`,
            attendu: arrondi(tauxDu * hs.nombre),
            constate: hs.montant,
            ecart: -manque,
            impactMensuel: manque,
            references: [
              { texte: 'Article L.3121-36 du Code du travail' },
              { texte: 'Article L.3121-33 du Code du travail — un accord ne peut descendre en dessous de 10 %' },
              REF_PRESCRIPTION,
            ],
            actions: [
              'Vérifiez le taux de majoration prévu par votre convention collective ou votre accord d’entreprise.',
              'La majoration ne peut jamais être inférieure à 10 %, même par accord.',
              'Réclamez le rappel sur les trois dernières années.',
            ],
            lignesConcernees: [hs.libelle],
          },
          params,
        ),
      );
    }
    return anomalies;
  },
};

/* ------------------------------------------------------------------ */
/* HRS-02 — réduction salariale sur heures supplémentaires             */
/* ------------------------------------------------------------------ */

export const controleReductionSalarialeHs: Controle = {
  code: 'HRS-02',
  nom: 'Réduction salariale sur heures supplémentaires',
  categorie: 'temps_travail',
  description:
    'Vérifie la présence de la réduction de cotisations salariales d’assurance vieillesse due sur les heures supplémentaires.',
  references: [
    { texte: 'Article L.241-17 du Code de la sécurité sociale' },
    { texte: 'Article D.241-21 du Code de la sécurité sociale — taux plafonné à 11,31 %' },
  ],
  applicable: ({ bulletin }) =>
    bulletin.heures.supplementaires.length === 0 && bulletin.heures.complementaires.length === 0
      ? 'Aucune heure supplémentaire ou complémentaire détectée.'
      : null,
  executer({ bulletin, params }) {
    if (aUneLigne(bulletin, 'REDUCTION_SALARIALE_HS')) return [];

    const remunerationHs = arrondi(
      [...bulletin.heures.supplementaires, ...bulletin.heures.complementaires]
        .reduce((s, h) => s + h.montant, 0),
    );
    if (remunerationHs < 1) return [];

    const reductionAttendue = arrondi(
      (remunerationHs * params.heuresSupplementaires.reductionSalarialeMax) / 100,
    );

    return [
      finaliser(
        {
          code: 'HRS-02',
          controle: this.nom,
          titre: 'Réduction de cotisations salariales sur heures supplémentaires absente',
          severite: 'majeure',
          categorie: 'temps_travail',
          confiance: 'probable',
          explication:
            `Les heures supplémentaires et complémentaires ouvrent droit à une réduction de vos cotisations ` +
            `d’assurance vieillesse, plafonnée à ${params.heuresSupplementaires.reductionSalarialeMax} %. ` +
            `Sur ${euros(remunerationHs)} d’heures majorées, elle représenterait environ ${euros(reductionAttendue)} ` +
            'de net supplémentaire. Aucune ligne correspondante n’a été identifiée.',
          detail:
            `Rémunération des heures supplémentaires et complémentaires : ${euros(remunerationHs)}. ` +
            `Réduction théorique : ${euros(reductionAttendue)} (taux maximal ${params.heuresSupplementaires.reductionSalarialeMax} %). ` +
            'Le taux réel est plafonné au taux effectif de vos cotisations vieillesse.',
          attendu: reductionAttendue,
          constate: 0,
          impactMensuel: reductionAttendue,
          references: [
            { texte: 'Article L.241-17 du Code de la sécurité sociale' },
            { texte: 'Article D.241-21 du Code de la sécurité sociale' },
            REF_PRESCRIPTION,
          ],
          actions: [
            'Vérifiez visuellement la présence d’une ligne « réduction salariale heures supplémentaires ».',
            'Si elle est absente, demandez son application et la régularisation des mois passés.',
          ],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* HRS-03 — exonération d'impôt sur les heures supplémentaires         */
/* ------------------------------------------------------------------ */

export const controleExonerationIrHs: Controle = {
  code: 'HRS-03',
  nom: 'Exonération d’impôt sur les heures supplémentaires',
  categorie: 'fiscal',
  description:
    'Vérifie que la rémunération des heures supplémentaires est bien exclue du net imposable, dans la limite annuelle légale.',
  references: [
    { texte: 'Article 81 quater du Code général des impôts — exonération plafonnée à 7 500 € nets par an' },
  ],
  applicable: ({ bulletin }) => {
    if (bulletin.heures.supplementaires.length === 0) return 'Aucune heure supplémentaire détectée.';
    if (bulletin.totaux.netImposable === undefined) return 'Le net imposable n’a pas pu être lu.';
    if (bulletin.totaux.netAvantImpot === undefined) return 'Le net avant impôt n’est pas mentionné.';
    return null;
  },
  executer({ bulletin, params }) {
    const remunerationHs = arrondi(bulletin.heures.supplementaires.reduce((s, h) => s + h.montant, 0));
    const cumulAnnuel = bulletin.cumuls?.montantHeuresSuppExonereesAnnuel ?? 0;
    const plafond = params.heuresSupplementaires.plafondExoIRAnnuel;

    // Le net imposable devrait être inférieur au net avant impôt de l'ordre de
    // la rémunération nette des heures supplémentaires.
    const t = bulletin.totaux;
    const ecartAttendu = remunerationHs * 0.78; // net approximatif des heures majorées
    const ecartConstate = arrondi(t.netAvantImpot! - t.netImposable!);

    if (ecartConstate > ecartAttendu * 0.5) return [];
    if (cumulAnnuel >= plafond) {
      return [
        finaliser(
          {
            code: 'HRS-03b',
            controle: this.nom,
            titre: 'Plafond annuel d’exonération des heures supplémentaires atteint',
            severite: 'info',
            categorie: 'fiscal',
            confiance: 'probable',
            explication:
              `Vos heures supplémentaires exonérées atteignent ${euros(cumulAnnuel)} sur l’année, ` +
              `au-delà du plafond de ${euros(plafond)}. Le surplus devient imposable : c’est normal.`,
            detail: `Cumul annuel exonéré ${euros(cumulAnnuel)} — plafond ${euros(plafond)}.`,
            references: [{ texte: 'Article 81 quater du Code général des impôts' }],
            actions: ['Aucune action : ce plafonnement est prévu par la loi.'],
          },
          params,
        ),
      ];
    }

    return [
      finaliser(
        {
          code: 'HRS-03',
          controle: this.nom,
          titre: 'Heures supplémentaires semble-t-il non exonérées d’impôt',
          severite: 'majeure',
          categorie: 'fiscal',
          confiance: 'a_verifier',
          explication:
            `La rémunération de vos heures supplémentaires (${euros(remunerationHs)} brut) est exonérée d’impôt ` +
            `sur le revenu dans la limite de ${euros(plafond)} nets par an. Or votre net imposable ne semble pas ` +
            'réduit en conséquence : vous risquez de payer de l’impôt sur des sommes exonérées.',
          detail:
            `Écart attendu entre net avant impôt et net imposable : environ ${euros(arrondi(ecartAttendu))}. ` +
            `Écart constaté : ${euros(ecartConstate)}.`,
          attendu: arrondi(ecartAttendu),
          constate: ecartConstate,
          references: [
            { texte: 'Article 81 quater du Code général des impôts' },
            { texte: 'Article L.241-17 du Code de la sécurité sociale' },
          ],
          actions: [
            'Vérifiez la présence d’une ligne « heures supplémentaires exonérées » sur le bulletin.',
            'Contrôlez le net imposable reporté sur votre déclaration de revenus préremplie.',
          ],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* HRS-04 — déduction forfaitaire patronale                            */
/* ------------------------------------------------------------------ */

export const controleDeductionForfaitaire: Controle = {
  code: 'HRS-04',
  nom: 'Déduction forfaitaire patronale sur heures supplémentaires',
  categorie: 'temps_travail',
  description:
    'Vérifie la présence de la déduction forfaitaire de cotisations patronales pour les entreprises de moins de 250 salariés.',
  references: [{ texte: 'Article L.241-18 du Code de la sécurité sociale' }],
  applicable: (ctx) => {
    if (ctx.bulletin.heures.supplementaires.length === 0) return 'Aucune heure supplémentaire détectée.';
    const eff = effectif(ctx);
    if (eff === undefined) return 'L’effectif de l’entreprise n’est pas connu : renseignez-le pour activer ce contrôle.';
    if (eff > 249) return 'Déduction réservée aux entreprises de moins de 250 salariés.';
    return null;
  },
  executer(ctx) {
    const { bulletin, params } = ctx;
    if (aUneLigne(bulletin, 'DEDUCTION_FORFAITAIRE_HS')) return [];

    const eff = effectif(ctx)!;
    const bareme = params.heuresSupplementaires.deductionForfaitairePatronale
      .find((d) => eff <= d.effectifMax);
    if (!bareme) return [];

    const nbHeures = bulletin.heures.supplementaires.reduce((s, h) => s + h.nombre, 0);
    const montant = arrondi(nbHeures * bareme.montantParHeure);

    return [
      finaliser(
        {
          code: 'HRS-04',
          controle: this.nom,
          titre: 'Déduction forfaitaire patronale non appliquée',
          severite: 'mineure',
          categorie: 'temps_travail',
          confiance: 'a_verifier',
          explication:
            `Avec un effectif de ${eff} salariés, l’employeur bénéficie d’une déduction de ` +
            `${bareme.montantParHeure.toFixed(2)} € par heure supplémentaire, soit ${euros(montant)} ce mois-ci. ` +
            'Cette déduction ne change pas votre net : elle est signalée à titre informatif, notamment si vous êtes vous-même employeur.',
          detail: `${nbHeures} heures supplémentaires × ${bareme.montantParHeure.toFixed(2)} € = ${euros(montant)}.`,
          attendu: montant,
          constate: 0,
          references: [{ texte: 'Article L.241-18 du Code de la sécurité sociale' }],
          actions: ['Point d’optimisation à signaler à l’employeur ou à son cabinet comptable.'],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* HRS-05 — heures complémentaires                                     */
/* ------------------------------------------------------------------ */

export const controleHeuresComplementaires: Controle = {
  code: 'HRS-05',
  nom: 'Majoration des heures complémentaires',
  categorie: 'temps_travail',
  description:
    'Vérifie que les heures complémentaires d’un temps partiel sont majorées d’au moins 10 %.',
  references: [
    { texte: 'Article L.3123-29 du Code du travail — majoration de 10 % puis 25 %' },
  ],
  applicable: ({ bulletin }) =>
    bulletin.heures.complementaires.length === 0
      ? 'Aucune heure complémentaire détectée.'
      : tauxHoraireDeBase(bulletin) === undefined
        ? 'Le taux horaire de base n’a pas pu être déduit.'
        : null,
  executer({ bulletin, params }) {
    const anomalies: Anomalie[] = [];
    const tauxBase = tauxHoraireDeBase(bulletin)!;
    const majorationMin = params.heuresComplementaires.majorationJusquauDixieme;

    for (const hc of bulletin.heures.complementaires) {
      const ligne = bulletin.lignes.find((l) => l.libelle === hc.libelle);
      const tauxPaye = ligne?.tauxUnitaire ?? (hc.nombre ? arrondi(hc.montant / hc.nombre, 4) : undefined);
      if (tauxPaye === undefined) continue;

      const majorationReelle = arrondi((tauxPaye / tauxBase - 1) * 100, 2);
      if (majorationReelle >= majorationMin - 0.5) continue;

      const tauxDu = arrondi(tauxBase * (1 + majorationMin / 100), 4);
      const manque = arrondi((tauxDu - tauxPaye) * hc.nombre);

      anomalies.push(
        finaliser(
          {
            code: 'HRS-05',
            controle: this.nom,
            titre: `Heures complémentaires non majorées (« ${hc.libelle} »)`,
            severite: severiteSelonEcart(manque, 3, 30),
            categorie: 'temps_travail',
            confiance: 'probable',
            explication:
              `Toute heure complémentaire accomplie par un salarié à temps partiel doit être majorée d’au moins ` +
              `${majorationMin} %. La majoration constatée est de ${majorationReelle} %. Il manque ${euros(manque)}.`,
            detail:
              `${hc.nombre} h à ${tauxPaye.toFixed(4)} € — taux dû ${tauxDu.toFixed(4)} € ` +
              `(taux de base ${tauxBase.toFixed(4)} € majoré de ${majorationMin} %).`,
            attendu: arrondi(tauxDu * hc.nombre),
            constate: hc.montant,
            impactMensuel: manque,
            references: [{ texte: 'Article L.3123-29 du Code du travail' }, REF_PRESCRIPTION],
            actions: [
              'Au-delà du dixième de la durée contractuelle, la majoration passe à 25 %.',
              'Réclamez le rappel de salaire correspondant.',
            ],
            lignesConcernees: [hc.libelle],
          },
          params,
        ),
      );
    }
    return anomalies;
  },
};

/* ------------------------------------------------------------------ */
/* HRS-06 — durée minimale du temps partiel                            */
/* ------------------------------------------------------------------ */

export const controleDureeMinimaleTempsPartiel: Controle = {
  code: 'HRS-06',
  nom: 'Durée minimale du temps partiel',
  categorie: 'temps_travail',
  description:
    'Vérifie que la durée contractuelle d’un temps partiel atteint le minimum légal de 24 heures hebdomadaires.',
  references: [
    { texte: 'Article L.3123-27 du Code du travail — durée minimale de 24 heures par semaine' },
    { texte: 'Article L.3123-7 du Code du travail — dérogations' },
  ],
  applicable: ({ bulletin, options }) => {
    if (!bulletin.salarie.tempsPartiel) return 'Le bulletin n’indique pas un temps partiel.';
    const duree = options.dureeHebdoContractuelle
      ?? (bulletin.salarie.horaireMensuel ? bulletin.salarie.horaireMensuel * 12 / 52 : undefined);
    return duree === undefined ? 'La durée contractuelle hebdomadaire n’est pas connue.' : null;
  },
  executer({ bulletin, params, options }) {
    const duree = options.dureeHebdoContractuelle
      ?? arrondi((bulletin.salarie.horaireMensuel! * 12) / 52, 2);
    const minimum = params.tempsPartiel.dureeMinimaleHebdo;
    if (duree >= minimum - 0.1) return [];

    return [
      finaliser(
        {
          code: 'HRS-06',
          controle: this.nom,
          titre: 'Durée contractuelle inférieure au minimum légal du temps partiel',
          severite: 'majeure',
          categorie: 'temps_travail',
          confiance: 'a_verifier',
          explication:
            `Votre durée de travail ressort à ${duree} heures par semaine, en deçà du minimum légal de ` +
            `${minimum} heures. Ce minimum connaît toutefois de nombreuses dérogations : demande écrite du salarié, ` +
            'accord de branche, étudiant de moins de 26 ans, contrat de moins de 7 jours.',
          detail: `Durée hebdomadaire estimée ${duree} h — minimum légal ${minimum} h.`,
          attendu: minimum,
          constate: duree,
          references: [
            { texte: 'Article L.3123-27 du Code du travail' },
            { texte: 'Article L.3123-7 du Code du travail' },
          ],
          actions: [
            'Vérifiez si votre contrat mentionne une dérogation ou une demande écrite de votre part.',
            'À défaut de dérogation valable, vous pouvez demander la requalification à 24 heures hebdomadaires.',
          ],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* HRS-07 — contingent annuel d'heures supplémentaires                 */
/* ------------------------------------------------------------------ */

export const controleContingentAnnuel: Controle = {
  code: 'HRS-07',
  nom: 'Contingent annuel d’heures supplémentaires',
  categorie: 'temps_travail',
  description:
    'Suit le cumul annuel d’heures supplémentaires et alerte à l’approche du contingent légal.',
  references: [
    { texte: 'Article L.3121-30 du Code du travail — contrepartie obligatoire en repos au-delà du contingent' },
    { texte: 'Article D.3121-24 du Code du travail — contingent de 220 heures à défaut d’accord' },
  ],
  applicable: ({ bulletin, historique }) =>
    bulletin.heures.supplementaires.length === 0 && historique.length === 0
      ? 'Aucune heure supplémentaire détectée.'
      : null,
  executer({ bulletin, historique, params }) {
    const memeAnnee = [...historique, bulletin].filter((b) => b.annee === bulletin.annee);
    const cumul = arrondi(
      memeAnnee.reduce(
        (s, b) => s + b.heures.supplementaires.reduce((t, h) => t + h.nombre, 0),
        0,
      ),
      2,
    );
    const contingent = params.heuresSupplementaires.contingentAnnuel;
    if (cumul < contingent * 0.8) return [];

    const depasse = cumul > contingent;
    return [
      finaliser(
        {
          code: 'HRS-07',
          controle: this.nom,
          titre: depasse
            ? 'Contingent annuel d’heures supplémentaires dépassé'
            : 'Contingent annuel d’heures supplémentaires bientôt atteint',
          severite: depasse ? 'majeure' : 'info',
          categorie: 'temps_travail',
          confiance: 'probable',
          explication: depasse
            ? `Vous cumulez ${cumul} heures supplémentaires depuis janvier, au-delà du contingent de ` +
              `${contingent} heures. Les heures au-delà du contingent ouvrent droit à une contrepartie ` +
              'obligatoire en repos, en plus de leur majoration.'
            : `Vous cumulez ${cumul} heures supplémentaires sur ${contingent} heures de contingent annuel.`,
          detail:
            `Cumul calculé sur ${memeAnnee.length} bulletin(s) de l’année ${bulletin.annee}. ` +
            'Le contingent peut être différent si un accord collectif le prévoit.',
          attendu: contingent,
          constate: cumul,
          references: [
            { texte: 'Article L.3121-30 du Code du travail' },
            { texte: 'Article D.3121-24 du Code du travail' },
          ],
          actions: [
            'Vérifiez le contingent fixé par votre accord d’entreprise ou de branche.',
            depasse
              ? 'Réclamez la contrepartie obligatoire en repos : 50 % dans les entreprises jusqu’à 20 salariés, 100 % au-delà.'
              : 'Suivez votre compteur : au-delà du contingent, une contrepartie en repos est due.',
          ],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* HRS-08 — absences non expliquées                                    */
/* ------------------------------------------------------------------ */

export const controleAbsences: Controle = {
  code: 'HRS-08',
  nom: 'Valorisation des absences',
  categorie: 'temps_travail',
  description:
    'Vérifie que la retenue pour absence est valorisée au même taux horaire que le salaire de base.',
  references: [
    { texte: 'Cour de cassation, chambre sociale — la retenue doit être strictement proportionnelle à la durée de l’absence' },
  ],
  applicable: ({ bulletin }) =>
    !aUneLigne(bulletin, 'ABSENCE', 'ABSENCE_MALADIE')
      ? 'Aucune retenue pour absence détectée.'
      : tauxHoraireDeBase(bulletin) === undefined
        ? 'Le taux horaire de base n’a pas pu être déduit.'
        : null,
  executer({ bulletin, params }) {
    const anomalies: Anomalie[] = [];
    const tauxBase = tauxHoraireDeBase(bulletin)!;

    for (const code of ['ABSENCE', 'ABSENCE_MALADIE']) {
      const ligne = ligneParCode(bulletin, code);
      if (!ligne?.nombre || !ligne.montant) continue;
      const tauxRetenue = arrondi(Math.abs(ligne.montant) / Math.abs(ligne.nombre), 4);
      if (tauxRetenue <= tauxBase * 1.02) continue;

      const excedent = arrondi((tauxRetenue - tauxBase) * Math.abs(ligne.nombre));
      anomalies.push(
        finaliser(
          {
            code: 'HRS-08',
            controle: this.nom,
            titre: `Retenue pour absence surévaluée (« ${ligne.libelle} »)`,
            severite: severiteSelonEcart(excedent, 3, 30),
            categorie: 'temps_travail',
            confiance: 'probable',
            explication:
              `L’absence est retenue à ${tauxRetenue.toFixed(4)} € de l’heure alors que votre salaire de base ` +
              `est payé ${tauxBase.toFixed(4)} € de l’heure. La retenue doit être strictement proportionnelle : ` +
              `${euros(excedent)} de trop vous sont retenus.`,
            detail:
              `Retenue : ${Math.abs(ligne.nombre)} h × ${tauxRetenue.toFixed(4)} € = ${euros(Math.abs(ligne.montant))}. ` +
              `Au taux de base : ${euros(arrondi(tauxBase * Math.abs(ligne.nombre)))}.`,
            attendu: arrondi(tauxBase * Math.abs(ligne.nombre)),
            constate: Math.abs(ligne.montant),
            ecart: excedent,
            impactMensuel: excedent,
            references: [
              { texte: 'Article L.3242-1 du Code du travail — mensualisation' },
              REF_PRESCRIPTION,
            ],
            actions: [
              'Demandez la méthode de valorisation des absences appliquée par l’employeur.',
              'La méthode doit être constante et ne peut vous être défavorable.',
            ],
            lignesConcernees: [ligne.libelle],
          },
          params,
        ),
      );
    }
    return anomalies;
  },
};

export const CONTROLES_TEMPS_TRAVAIL: Controle[] = [
  controleMajorationHeuresSupp,
  controleReductionSalarialeHs,
  controleExonerationIrHs,
  controleDeductionForfaitaire,
  controleHeuresComplementaires,
  controleDureeMinimaleTempsPartiel,
  controleContingentAnnuel,
  controleAbsences,
];
