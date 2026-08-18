import type { Anomalie } from '../../types';
import { arrondi } from '../../parsing/montants';
import type { Controle } from '../types';
import { euros, finaliser, REF_PRESCRIPTION } from '../utils';

/* ------------------------------------------------------------------ */
/* CP-01 — acquisition mensuelle                                       */
/* ------------------------------------------------------------------ */

export const controleAcquisitionConges: Controle = {
  code: 'CP-01',
  nom: 'Acquisition mensuelle des congés payés',
  categorie: 'conges',
  description:
    'Vérifie que le compteur de congés progresse de 2,5 jours ouvrables (ou 2,08 jours ouvrés) par mois travaillé.',
  references: [
    { texte: 'Article L.3141-3 du Code du travail — 2,5 jours ouvrables par mois de travail effectif' },
    { texte: 'Article L.3141-5 du Code du travail — périodes assimilées à du travail effectif' },
  ],
  applicable: ({ bulletin }) =>
    bulletin.conges?.acquisPeriodeN === undefined
      ? 'Aucun compteur de congés payés n’a été lu sur le bulletin.'
      : null,
  executer({ bulletin, params }) {
    const conges = bulletin.conges!;
    const attendu = conges.unite === 'ouvres'
      ? params.congesPayes.acquisitionMensuelleOuvres
      : params.congesPayes.acquisitionMensuelleOuvrables;
    const acquis = conges.acquisPeriodeN!;

    // Un compteur cumulé annuel n'est pas une acquisition mensuelle.
    if (acquis > attendu * 1.5) return [];
    if (acquis >= attendu - 0.02) return [];

    const manque = arrondi(attendu - acquis, 2);
    return [
      finaliser(
        {
          code: 'CP-01',
          controle: this.nom,
          titre: 'Acquisition de congés payés inférieure au droit légal',
          severite: 'majeure',
          categorie: 'conges',
          confiance: 'probable',
          explication:
            `Vous acquérez ${acquis} jour(s) de congés ce mois-ci, contre ${attendu} jour(s) prévus par la loi ` +
            `en jours ${conges.unite ?? 'ouvrables'}. Sur une année, cela représente ${arrondi(manque * 12, 1)} jours de congés perdus.`,
          detail:
            `Acquisition constatée ${acquis} — acquisition légale ${attendu} ` +
            `(${conges.unite === 'ouvres' ? '25 jours ouvrés' : '30 jours ouvrables'} par an).`,
          attendu,
          constate: acquis,
          ecart: -manque,
          references: [
            { texte: 'Article L.3141-3 du Code du travail' },
            { texte: 'Article L.3141-5 du Code du travail' },
            REF_PRESCRIPTION,
          ],
          actions: [
            'Vérifiez si une absence non assimilée à du travail effectif explique la réduction.',
            'Attention : les arrêts maladie, y compris non professionnels, ouvrent désormais droit à congés (loi du 22 avril 2024).',
            'Réclamez la régularisation de votre compteur.',
          ],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* CP-02 — cohérence du compteur                                       */
/* ------------------------------------------------------------------ */

export const controleCoherenceCompteurConges: Controle = {
  code: 'CP-02',
  nom: 'Cohérence du compteur de congés payés',
  categorie: 'conges',
  description: 'Détecte un solde de congés négatif ou une évolution incohérente du compteur.',
  references: [{ texte: 'Article R.3243-1 du Code du travail — mention des congés sur le bulletin' }],
  applicable: ({ bulletin }) =>
    bulletin.conges === undefined ? 'Aucun compteur de congés n’a été lu.' : null,
  executer({ bulletin, historique, params }) {
    const anomalies: Anomalie[] = [];
    const conges = bulletin.conges!;

    if (conges.soldeN !== undefined && conges.soldeN < -0.5) {
      anomalies.push(
        finaliser(
          {
            code: 'CP-02',
            controle: this.nom,
            titre: 'Solde de congés payés négatif',
            severite: 'mineure',
            categorie: 'conges',
            confiance: 'probable',
            explication:
              `Votre compteur affiche ${conges.soldeN} jours. Un solde négatif signifie que vous avez pris ` +
              'des congés par anticipation : ils seront déduits de votre solde de tout compte en cas de départ.',
            detail: `Solde constaté : ${conges.soldeN} jours.`,
            constate: conges.soldeN,
            references: [{ texte: 'Article L.3141-3 du Code du travail' }],
            actions: ['Vérifiez l’accord donné pour la prise de congés par anticipation.'],
          },
          params,
        ),
      );
    }

    const precedent = historique[historique.length - 1];
    if (
      precedent?.conges?.soldeN !== undefined &&
      conges.soldeN !== undefined &&
      conges.acquisPeriodeN !== undefined
    ) {
      const pris = conges.prisPeriodeN ?? 0;
      const attendu = arrondi(precedent.conges.soldeN + conges.acquisPeriodeN - pris, 2);
      const ecart = arrondi(conges.soldeN - attendu, 2);
      if (Math.abs(ecart) > 0.6) {
        anomalies.push(
          finaliser(
            {
              code: 'CP-02b',
              controle: this.nom,
              titre: 'Évolution incohérente du compteur de congés',
              severite: 'majeure',
              categorie: 'conges',
              confiance: 'probable',
              explication:
                `Le mois dernier votre solde était de ${precedent.conges.soldeN} jours. Avec ` +
                `${conges.acquisPeriodeN} jour(s) acquis et ${pris} jour(s) pris, il devrait s’établir à ` +
                `${attendu} jours. Le bulletin affiche ${conges.soldeN} jours` +
                (ecart < 0 ? `, soit ${Math.abs(ecart)} jour(s) qui ont disparu de votre compteur.` : '.'),
              detail:
                `Solde précédent ${precedent.conges.soldeN} + acquis ${conges.acquisPeriodeN} ` +
                `− pris ${pris} = ${attendu}, contre ${conges.soldeN} affiché.`,
              attendu,
              constate: conges.soldeN,
              ecart,
              references: [{ texte: 'Article R.3243-1 du Code du travail' }, REF_PRESCRIPTION],
              actions: [
                'Demandez le détail des mouvements du compteur de congés.',
                'Attention à la période de report : les congés non pris peuvent être perdus si l’employeur vous a mis en mesure de les prendre.',
              ],
            },
            params,
          ),
        );
      }
    }
    return anomalies;
  },
};

/* ------------------------------------------------------------------ */
/* CP-03 — indemnité compensatrice de congés payés                     */
/* ------------------------------------------------------------------ */

export const controleIndemniteCompensatrice: Controle = {
  code: 'CP-03',
  nom: 'Indemnité compensatrice de congés payés',
  categorie: 'conges',
  description:
    'Vérifie que l’indemnité compensatrice atteint au moins le dixième de la rémunération brute de la période de référence.',
  references: [
    { texte: 'Article L.3141-24 du Code du travail — règle du dixième et du maintien de salaire' },
    { texte: 'Article L.3141-28 du Code du travail — indemnité compensatrice en fin de contrat' },
  ],
  applicable: ({ bulletin }) =>
    !bulletin.lignes.some((l) => l.code === 'INDEMNITE_CP')
      ? 'Aucune indemnité compensatrice de congés payés détectée.'
      : null,
  executer({ bulletin, historique, params }) {
    const ligne = bulletin.lignes.find((l) => l.code === 'INDEMNITE_CP')!;
    const montant = ligne.montant ?? 0;
    if (montant <= 0) return [];

    // Le dixième se calcule sur la rémunération de la période de référence.
    const bulletinsReference = [...historique, bulletin];
    const remunerationReference = arrondi(
      bulletinsReference.reduce((s, b) => s + (b.totaux.brut ?? 0), 0),
    );
    if (bulletinsReference.length < 3) {
      return [
        finaliser(
          {
            code: 'CP-03',
            controle: this.nom,
            titre: 'Indemnité compensatrice de congés payés à vérifier',
            severite: 'info',
            categorie: 'conges',
            confiance: 'a_verifier',
            explication:
              `Une indemnité compensatrice de ${euros(montant)} figure sur ce bulletin. Son montant doit être ` +
              'le plus favorable entre le dixième de la rémunération de la période de référence et le maintien de salaire. ' +
              'Importez davantage de bulletins pour que ce contrôle soit automatique.',
            detail: `Indemnité constatée : ${euros(montant)}. Bulletins disponibles : ${bulletinsReference.length}.`,
            constate: montant,
            references: [{ texte: 'Article L.3141-24 du Code du travail' }],
            actions: ['Importez les bulletins de la période de référence (juin N-1 à mai N) pour un contrôle complet.'],
          },
          params,
        ),
      ];
    }

    const dixieme = arrondi(remunerationReference * (params.congesPayes.tauxIndemniteCompensatrice / 100));
    // Le dixième porte sur l'ensemble des droits : on le rapporte aux jours indemnisés.
    const soldeIndemnise = bulletin.conges?.soldeN ?? params.congesPayes.maxAnnuelOuvrables;
    const dixiemeProratise = arrondi((dixieme * soldeIndemnise) / params.congesPayes.maxAnnuelOuvrables);
    if (montant >= dixiemeProratise - 1) return [];

    const manque = arrondi(dixiemeProratise - montant);
    return [
      finaliser(
        {
          code: 'CP-03',
          controle: this.nom,
          titre: 'Indemnité de congés payés inférieure à la règle du dixième',
          severite: 'majeure',
          categorie: 'conges',
          confiance: 'a_verifier',
          explication:
            `L’indemnité versée (${euros(montant)}) semble inférieure au dixième de la rémunération ` +
            `de la période de référence rapporté à vos droits, estimé à ${euros(dixiemeProratise)}. ` +
            `L’employeur doit retenir la méthode la plus favorable : il vous manquerait ${euros(manque)}.`,
          detail:
            `Rémunération de référence estimée sur ${bulletinsReference.length} bulletins : ${euros(remunerationReference)}. ` +
            `Dixième : ${euros(dixieme)}, rapporté à ${soldeIndemnise} jours : ${euros(dixiemeProratise)}.`,
          attendu: dixiemeProratise,
          constate: montant,
          ecart: -manque,
          impactMensuel: manque,
          references: [
            { texte: 'Article L.3141-24 du Code du travail' },
            REF_PRESCRIPTION,
          ],
          actions: [
            'Ce calcul est une estimation : il suppose que tous les bulletins de la période de référence sont importés.',
            'Demandez à l’employeur le détail du comparatif entre maintien de salaire et règle du dixième.',
          ],
          lignesConcernees: [ligne.libelle],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* CP-04 — indemnité de fin de contrat                                 */
/* ------------------------------------------------------------------ */

export const controlePrecarite: Controle = {
  code: 'CP-04',
  nom: 'Indemnité de fin de contrat à durée déterminée',
  categorie: 'conges',
  description:
    'Vérifie que l’indemnité de précarité atteint 10 % de la rémunération brute totale du contrat.',
  references: [
    { texte: 'Article L.1243-8 du Code du travail — indemnité de fin de contrat de 10 %' },
    { texte: 'Article L.1243-9 du Code du travail — taux réduit de 6 % sous conditions' },
  ],
  applicable: ({ bulletin }) => {
    if (bulletin.contrat.type !== 'CDD') return 'Ce contrôle ne concerne que les contrats à durée déterminée.';
    if (!bulletin.lignes.some((l) => l.code === 'PRIME_PRECARITE')) {
      return 'Aucune indemnité de précarité détectée : ce bulletin n’est probablement pas un solde de tout compte.';
    }
    return null;
  },
  executer({ bulletin, historique, params }) {
    const ligne = bulletin.lignes.find((l) => l.code === 'PRIME_PRECARITE')!;
    const montant = ligne.montant ?? 0;
    const bulletinsContrat = [...historique, bulletin];
    const remunerationTotale = arrondi(
      bulletinsContrat.reduce((s, b) => s + (b.totaux.brut ?? 0), 0),
    );
    const attendu = arrondi((remunerationTotale * params.cdd.tauxPrecarite) / 100);
    const attenduReduit = arrondi((remunerationTotale * params.cdd.tauxPrecariteReduit) / 100);

    if (montant >= attenduReduit - 1) {
      if (montant >= attendu - 1) return [];
      return [
        finaliser(
          {
            code: 'CP-04',
            controle: this.nom,
            titre: 'Indemnité de précarité au taux réduit de 6 %',
            severite: 'mineure',
            categorie: 'conges',
            confiance: 'a_verifier',
            explication:
              `L’indemnité versée (${euros(montant)}) correspond au taux réduit de 6 %. Ce taux n’est admis ` +
              'que si un accord de branche le prévoit ET que l’employeur vous a proposé un accès privilégié à la formation. ' +
              `Au taux de droit commun de 10 %, elle serait de ${euros(attendu)}.`,
            detail: `Rémunération totale du contrat estimée : ${euros(remunerationTotale)} sur ${bulletinsContrat.length} bulletins.`,
            attendu,
            constate: montant,
            impactMensuel: arrondi(attendu - montant),
            references: [{ texte: 'Article L.1243-9 du Code du travail' }],
            actions: ['Vérifiez que votre convention collective prévoit bien le taux réduit et la contrepartie formation.'],
            lignesConcernees: [ligne.libelle],
          },
          params,
        ),
      ];
    }

    const manque = arrondi(attendu - montant);
    return [
      finaliser(
        {
          code: 'CP-04b',
          controle: this.nom,
          titre: 'Indemnité de fin de contrat insuffisante',
          severite: 'majeure',
          categorie: 'conges',
          confiance: 'a_verifier',
          explication:
            `L’indemnité de précarité doit représenter 10 % de la rémunération brute totale de votre contrat. ` +
            `Sur ${euros(remunerationTotale)}, elle devrait atteindre ${euros(attendu)}. ` +
            `Vous percevez ${euros(montant)}, soit ${euros(manque)} de moins.`,
          detail: `Calcul établi sur ${bulletinsContrat.length} bulletin(s) importé(s). Importez tous les bulletins du contrat pour fiabiliser le calcul.`,
          attendu,
          constate: montant,
          ecart: -manque,
          impactMensuel: manque,
          references: [{ texte: 'Article L.1243-8 du Code du travail' }, REF_PRESCRIPTION],
          actions: [
            'Vérifiez que tous les bulletins du contrat sont importés avant de réclamer.',
            'L’indemnité n’est pas due en cas de démission, faute grave, ou embauche en CDI à l’issue du contrat.',
          ],
          lignesConcernees: [ligne.libelle],
        },
        params,
      ),
    ];
  },
};

export const CONTROLES_CONGES: Controle[] = [
  controleAcquisitionConges,
  controleCoherenceCompteurConges,
  controleIndemniteCompensatrice,
  controlePrecarite,
];
