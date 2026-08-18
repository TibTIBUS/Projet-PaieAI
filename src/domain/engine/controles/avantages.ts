import type { Anomalie } from '../../types';
import { arrondi } from '../../parsing/montants';
import type { Controle } from '../types';
import {
  euros, finaliser, ligneParCode, partPatronalePrevoyance, partSalarialePrevoyance,
  REF_PRESCRIPTION,
} from '../utils';

/* ------------------------------------------------------------------ */
/* AVA-01 — participation employeur à la complémentaire santé          */
/* ------------------------------------------------------------------ */

export const controleParticipationMutuelle: Controle = {
  code: 'AVA-01',
  nom: 'Participation de l’employeur à la complémentaire santé',
  categorie: 'avantages',
  description:
    'Vérifie que l’employeur finance au moins la moitié de la couverture collective obligatoire de complémentaire santé.',
  references: [
    { texte: 'Article L.911-7 du Code de la sécurité sociale — financement patronal d’au moins 50 %' },
    { texte: 'Article D.911-1 du Code de la sécurité sociale — panier de soins minimal' },
  ],
  applicable: ({ bulletin }) => {
    const mutuelle = ligneParCode(bulletin, 'MUTUELLE');
    if (!mutuelle) return 'Aucune ligne de complémentaire santé détectée.';
    if (mutuelle.montantSalarial === undefined || mutuelle.montantPatronal === undefined) {
      return 'Les parts salariale et patronale de la complémentaire santé n’ont pas pu être lues toutes les deux.';
    }
    return null;
  },
  executer({ bulletin, params }) {
    const mutuelle = ligneParCode(bulletin, 'MUTUELLE')!;
    const salariale = mutuelle.montantSalarial!;
    const patronale = mutuelle.montantPatronal!;
    const total = arrondi(salariale + patronale);
    if (total <= 0) return [];

    const partPatronale = arrondi((patronale / total) * 100, 2);
    const minimum = params.mutuellePartPatronaleMin;
    if (partPatronale >= minimum - 0.5) return [];

    const patronaleDue = arrondi((total * minimum) / 100);
    const manque = arrondi(patronaleDue - patronale);

    return [
      finaliser(
        {
          code: 'AVA-01',
          controle: this.nom,
          titre: 'Participation employeur à la mutuelle inférieure à 50 %',
          severite: 'majeure',
          categorie: 'avantages',
          confiance: 'probable',
          explication:
            `L’employeur finance ${partPatronale} % de votre complémentaire santé, alors qu’il doit en prendre ` +
            `en charge au moins ${minimum} % lorsque la couverture est collective et obligatoire. ` +
            `Vous payez ${euros(manque)} de trop chaque mois.`,
          detail:
            `Cotisation totale ${euros(total)} : part salariale ${euros(salariale)} (${arrondi(100 - partPatronale, 2)} %), ` +
            `part patronale ${euros(patronale)} (${partPatronale} %). Part patronale due : ${euros(patronaleDue)}.`,
          attendu: patronaleDue,
          constate: patronale,
          ecart: -manque,
          impactMensuel: manque,
          references: [
            { texte: 'Article L.911-7 du Code de la sécurité sociale' },
            REF_PRESCRIPTION,
          ],
          actions: [
            'Vérifiez que la couverture est bien collective et obligatoire : les contrats facultatifs échappent à cette règle.',
            'Certaines options souscrites individuellement restent à votre charge intégrale : vérifiez le détail du contrat.',
            'Si l’obligation s’applique, réclamez la régularisation sur les trois dernières années.',
          ],
          lignesConcernees: [mutuelle.libelle],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* AVA-02 — titres-restaurant                                          */
/* ------------------------------------------------------------------ */

export const controleTitresRestaurant: Controle = {
  code: 'AVA-02',
  nom: 'Titres-restaurant',
  categorie: 'avantages',
  description:
    'Vérifie que la participation patronale au titre-restaurant reste dans les bornes légales et sous le plafond d’exonération.',
  references: [
    { texte: 'Article R.3262-4 du Code du travail — participation patronale comprise entre 50 % et 60 %' },
    { texte: 'Article 81, 19° du Code général des impôts — plafond d’exonération' },
  ],
  applicable: ({ bulletin, options }) => {
    if (!ligneParCode(bulletin, 'TITRE_RESTAURANT')) return 'Aucune ligne de titres-restaurant détectée.';
    if (options.valeurTitreRestaurant === undefined || options.nombreTitresRestaurant === undefined) {
      return 'Renseignez la valeur faciale et le nombre de titres-restaurant pour activer ce contrôle.';
    }
    return null;
  },
  executer({ bulletin, params, options }) {
    const anomalies: Anomalie[] = [];
    const ligne = ligneParCode(bulletin, 'TITRE_RESTAURANT')!;
    const valeur = options.valeurTitreRestaurant!;
    const nombre = options.nombreTitresRestaurant!;
    const retenueSalariale = Math.abs(ligne.montant ?? 0);
    const partSalarialeUnitaire = nombre > 0 ? arrondi(retenueSalariale / nombre, 4) : 0;
    const partPatronaleUnitaire = arrondi(valeur - partSalarialeUnitaire, 4);
    const pourcentagePatronal = valeur > 0 ? arrondi((partPatronaleUnitaire / valeur) * 100, 2) : 0;

    const { min, max } = params.titreRestaurantPartPatronale;
    if (pourcentagePatronal < min - 0.5) {
      const dueUnitaire = arrondi((valeur * min) / 100, 4);
      const manque = arrondi((dueUnitaire - partPatronaleUnitaire) * nombre);
      anomalies.push(
        finaliser(
          {
            code: 'AVA-02',
            controle: this.nom,
            titre: 'Participation patronale au titre-restaurant inférieure au minimum légal',
            severite: 'majeure',
            categorie: 'avantages',
            confiance: 'probable',
            explication:
              `L’employeur doit financer entre ${min} % et ${max} % de la valeur du titre-restaurant. ` +
              `Sa participation ressort à ${pourcentagePatronal} %, soit ${euros(manque)} de trop retenus sur votre net ce mois-ci.`,
            detail:
              `${nombre} titres d’une valeur de ${euros(valeur)}. Retenue salariale ${euros(retenueSalariale)} ` +
              `(${euros(partSalarialeUnitaire)} par titre), part patronale ${euros(partPatronaleUnitaire)} par titre.`,
            attendu: arrondi(dueUnitaire * nombre),
            constate: arrondi(partPatronaleUnitaire * nombre),
            impactMensuel: manque,
            references: [{ texte: 'Article R.3262-4 du Code du travail' }, REF_PRESCRIPTION],
            actions: ['Réclamez la mise en conformité de la participation patronale.'],
            lignesConcernees: [ligne.libelle],
          },
          params,
        ),
      );
    } else if (pourcentagePatronal > max + 0.5) {
      anomalies.push(
        finaliser(
          {
            code: 'AVA-02b',
            controle: this.nom,
            titre: 'Participation patronale au titre-restaurant supérieure au maximum légal',
            severite: 'mineure',
            categorie: 'avantages',
            confiance: 'probable',
            explication:
              `La participation patronale atteint ${pourcentagePatronal} %, au-delà du maximum de ${max} %. ` +
              'L’excédent devient un avantage soumis à cotisations et à impôt : vérifiez qu’il est bien réintégré.',
            detail: `Part patronale ${euros(partPatronaleUnitaire)} pour un titre de ${euros(valeur)}.`,
            constate: pourcentagePatronal,
            attendu: max,
            references: [{ texte: 'Article R.3262-4 du Code du travail' }],
            actions: ['Vérifiez la réintégration de l’excédent dans l’assiette de cotisations.'],
            lignesConcernees: [ligne.libelle],
          },
          params,
        ),
      );
    }

    if (partPatronaleUnitaire > params.titreRestaurantExoMax + 0.01) {
      const excedent = arrondi((partPatronaleUnitaire - params.titreRestaurantExoMax) * nombre);
      anomalies.push(
        finaliser(
          {
            code: 'AVA-02c',
            controle: this.nom,
            titre: 'Plafond d’exonération du titre-restaurant dépassé',
            severite: 'mineure',
            categorie: 'avantages',
            confiance: params.fiabilite === 'verifie' ? 'probable' : 'a_verifier',
            explication:
              `La part patronale (${euros(partPatronaleUnitaire)} par titre) dépasse le plafond d’exonération de ` +
              `${euros(params.titreRestaurantExoMax)}. L’excédent de ${euros(excedent)} doit être soumis à cotisations ` +
              'et intégré à votre net imposable.',
            detail: `Plafond d’exonération applicable sur la période : ${euros(params.titreRestaurantExoMax)} par titre.`,
            attendu: params.titreRestaurantExoMax,
            constate: partPatronaleUnitaire,
            references: [{ texte: 'Article 81, 19° du Code général des impôts' }],
            actions: ['Vérifiez que l’excédent figure bien dans l’assiette de cotisations du bulletin.'],
            lignesConcernees: [ligne.libelle],
          },
          params,
        ),
      );
    }
    return anomalies;
  },
};

/* ------------------------------------------------------------------ */
/* AVA-03 — frais de transport public                                  */
/* ------------------------------------------------------------------ */

export const controleTransportPublic: Controle = {
  code: 'AVA-03',
  nom: 'Prise en charge des frais de transport public',
  categorie: 'avantages',
  description:
    'Vérifie que l’employeur rembourse au moins la moitié de l’abonnement de transport public du salarié.',
  references: [
    { texte: 'Article L.3261-2 du Code du travail — prise en charge obligatoire de 50 %' },
    { texte: 'Article R.3261-1 du Code du travail' },
  ],
  applicable: ({ options }) =>
    options.abonnementTransport === undefined
      ? 'Renseignez le coût de votre abonnement de transport pour activer ce contrôle.'
      : null,
  executer({ bulletin, params, options }) {
    const abonnement = options.abonnementTransport!;
    const ligne = ligneParCode(bulletin, 'TRANSPORT_PUBLIC');
    const rembourse = ligne?.montant ?? 0;
    const du = arrondi((abonnement * params.transportPublicPriseEnChargeMin) / 100);
    if (rembourse >= du - 0.5) return [];

    const manque = arrondi(du - rembourse);
    return [
      finaliser(
        {
          code: 'AVA-03',
          controle: this.nom,
          titre: 'Prise en charge des frais de transport insuffisante',
          severite: 'majeure',
          categorie: 'avantages',
          confiance: 'probable',
          explication:
            `L’employeur doit rembourser au moins ${params.transportPublicPriseEnChargeMin} % du coût de votre ` +
            `abonnement de transport public, soit ${euros(du)} pour un abonnement de ${euros(abonnement)}. ` +
            (rembourse > 0
              ? `Il vous verse ${euros(rembourse)}, soit ${euros(manque)} de moins.`
              : 'Aucun remboursement n’apparaît sur ce bulletin.'),
          detail:
            `Abonnement déclaré ${euros(abonnement)} — prise en charge due ${euros(du)} — ` +
            `remboursement constaté ${euros(rembourse)}.`,
          attendu: du,
          constate: rembourse,
          ecart: -manque,
          impactMensuel: manque,
          references: [
            { texte: 'Article L.3261-2 du Code du travail' },
            REF_PRESCRIPTION,
          ],
          actions: [
            'Transmettez votre justificatif d’abonnement à l’employeur : la prise en charge est conditionnée à sa production.',
            'Le remboursement est obligatoire pour tout abonnement de transport public, à temps plein comme à temps partiel.',
          ],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* AVA-04 — réintégration de la part patronale de prévoyance           */
/* ------------------------------------------------------------------ */

export const controleReintegrationPrevoyance: Controle = {
  code: 'AVA-04',
  nom: 'Réintégration de la part patronale de protection sociale complémentaire',
  categorie: 'avantages',
  description:
    'Vérifie que la part patronale de mutuelle et de prévoyance est bien ajoutée au net imposable.',
  references: [
    { texte: 'Article 83, 1° quater du Code général des impôts' },
    { texte: 'Article L.242-1 du Code de la sécurité sociale' },
  ],
  applicable: ({ bulletin }) => {
    if (partPatronalePrevoyance(bulletin) === 0) return 'Aucune part patronale de prévoyance ou de mutuelle détectée.';
    if (bulletin.totaux.netImposable === undefined) return 'Le net imposable n’a pas pu être lu.';
    if (bulletin.totaux.netAvantImpot === undefined) return 'Le net avant impôt n’est pas mentionné.';
    return null;
  },
  executer({ bulletin, params }) {
    const partPat = partPatronalePrevoyance(bulletin);
    const t = bulletin.totaux;
    const ecartNet = arrondi(t.netImposable! - t.netAvantImpot!);
    // Sans réintégration, l'écart se limiterait à la CSG/CRDS non déductible.
    if (ecartNet >= partPat * 0.8) return [];

    return [
      finaliser(
        {
          code: 'AVA-04',
          controle: this.nom,
          titre: 'Part patronale de mutuelle non réintégrée au net imposable',
          severite: 'mineure',
          categorie: 'fiscal',
          confiance: 'a_verifier',
          explication:
            `La part patronale de complémentaire santé (${euros(partPat)}) doit être ajoutée à votre net imposable. ` +
            'Si elle ne l’est pas, votre revenu déclaré est sous-évalué : l’administration fiscale peut vous le réclamer.',
          detail:
            `Part patronale ${euros(partPat)} — écart entre net imposable et net avant impôt : ${euros(ecartNet)}.`,
          attendu: partPat,
          constate: ecartNet,
          references: [{ texte: 'Article 83, 1° quater du Code général des impôts' }],
          actions: [
            'Attention : la part patronale de prévoyance « lourde » (décès, incapacité) obéit à des règles différentes.',
            'Faites confirmer par le service paie ou un expert-comptable.',
          ],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* AVA-05 — cohérence de la retenue de protection sociale              */
/* ------------------------------------------------------------------ */

export const controleEvolutionMutuelle: Controle = {
  code: 'AVA-05',
  nom: 'Évolution de la cotisation de protection sociale complémentaire',
  categorie: 'avantages',
  description:
    'Signale une hausse importante de la part salariale de mutuelle par rapport au mois précédent.',
  references: [{ texte: 'Article L.911-1 du Code de la sécurité sociale' }],
  applicable: ({ historique }) =>
    historique.length === 0 ? 'Aucun bulletin antérieur disponible pour la comparaison.' : null,
  executer({ bulletin, historique, params }) {
    const precedent = historique[historique.length - 1];
    const actuelle = partSalarialePrevoyance(bulletin);
    const ancienne = partSalarialePrevoyance(precedent);
    if (ancienne <= 0 || actuelle <= ancienne * 1.15) return [];

    const hausse = arrondi(actuelle - ancienne);
    const pourcentage = arrondi(((actuelle - ancienne) / ancienne) * 100, 1);
    const anomalie: Anomalie = finaliser(
      {
        code: 'AVA-05',
        controle: this.nom,
        titre: 'Hausse marquée de votre cotisation de complémentaire santé',
        severite: 'info',
        categorie: 'avantages',
        confiance: 'certaine',
        explication:
          `Votre part salariale de protection sociale complémentaire passe de ${euros(ancienne)} à ` +
          `${euros(actuelle)}, soit +${pourcentage} %. Les revalorisations annuelles sont fréquentes, ` +
          'mais une hausse doit vous être notifiée.',
        detail: `Bulletin précédent : ${euros(ancienne)}. Bulletin courant : ${euros(actuelle)}. Écart : ${euros(hausse)}.`,
        attendu: ancienne,
        constate: actuelle,
        ecart: hausse,
        references: [{ texte: 'Article L.911-1 du Code de la sécurité sociale' }],
        actions: [
          'Demandez la notice d’information à jour du régime de complémentaire santé.',
          'Vérifiez que la part patronale a évolué dans la même proportion.',
        ],
      },
      params,
    );
    return [anomalie];
  },
};

export const CONTROLES_AVANTAGES: Controle[] = [
  controleParticipationMutuelle,
  controleTitresRestaurant,
  controleTransportPublic,
  controleReintegrationPrevoyance,
  controleEvolutionMutuelle,
];
