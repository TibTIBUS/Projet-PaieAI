import type { Anomalie } from '../../types';
import { arrondi, procheRelatif } from '../../parsing/montants';
import type { Controle } from '../types';
import {
  brut, brutRecalcule, csgCrdsNonDeductible, euros, finaliser, partPatronalePrevoyance,
  partSalarialePrevoyance, REF_MENTIONS_BULLETIN, REF_PRESCRIPTION, severiteSelonEcart,
  totalCotisationsPatronales, totalCotisationsSalariales, totalNonSoumis, totalRetenuesNettes,
} from '../utils';

/** Tolérance d'arrondi admise sur un total de bulletin. */
const TOLERANCE = 0.05;

/* ------------------------------------------------------------------ */
/* ARI-01 — cohérence base × taux = montant, ligne à ligne             */
/* ------------------------------------------------------------------ */

export const controleLignesCotisation: Controle = {
  code: 'ARI-01',
  nom: 'Cohérence base × taux de chaque cotisation',
  categorie: 'arithmetique',
  description:
    'Vérifie que, pour chaque ligne de cotisation, le montant retenu correspond bien à la base multipliée par le taux affiché.',
  references: [REF_MENTIONS_BULLETIN],
  executer({ bulletin, params }) {
    const anomalies: Anomalie[] = [];
    for (const ligne of bulletin.lignes) {
      if (ligne.nature !== 'cotisation' || ligne.base === undefined) continue;

      for (const cote of ['salarial', 'patronal'] as const) {
        const taux = cote === 'salarial' ? ligne.tauxSalarial : ligne.tauxPatronal;
        const montant = cote === 'salarial' ? ligne.montantSalarial : ligne.montantPatronal;
        if (taux === undefined || montant === undefined || taux === 0) continue;

        const attendu = arrondi((ligne.base * taux) / 100);
        if (procheRelatif(attendu, montant, 0.03, 0.001)) continue;

        const ecart = arrondi(montant - attendu);
        anomalies.push(
          finaliser(
            {
              code: 'ARI-01',
              controle: this.nom,
              titre: `Montant incohérent sur « ${ligne.libelle} » (part ${cote}e)`,
              severite: severiteSelonEcart(ecart),
              categorie: 'arithmetique',
              confiance: 'certaine',
              explication:
                `La ligne « ${ligne.libelle} » affiche une base et un taux qui ne donnent pas le montant retenu. ` +
                (cote === 'salarial'
                  ? ecart > 0
                    ? `Vous avez été prélevé de ${euros(Math.abs(ecart))} de trop ce mois-ci.`
                    : `Vous avez été prélevé de ${euros(Math.abs(ecart))} de moins que le calcul affiché.`
                  : 'La part employeur ne correspond pas au calcul affiché : cela n’affecte pas votre net, mais révèle un paramétrage erroné.'),
              detail:
                `${euros(ligne.base)} × ${taux} % = ${euros(attendu)}, ` +
                `or le bulletin retient ${euros(montant)} (écart de ${euros(ecart)}).`,
              attendu,
              constate: montant,
              ecart,
              impactMensuel: cote === 'salarial' ? -ecart : undefined,
              references: [REF_MENTIONS_BULLETIN, REF_PRESCRIPTION],
              actions: [
                'Demandez au service paie le détail du calcul de cette ligne.',
                'Si l’écart se répète, réclamez une régularisation sur les trois dernières années.',
              ],
              lignesConcernees: [ligne.libelle],
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
/* ARI-02 — somme des éléments de rémunération = brut                  */
/* ------------------------------------------------------------------ */

export const controleTotalBrut: Controle = {
  code: 'ARI-02',
  nom: 'Total brut = somme des éléments de rémunération',
  categorie: 'arithmetique',
  description: 'Additionne les éléments de rémunération et compare le résultat au brut affiché.',
  references: [REF_MENTIONS_BULLETIN],
  applicable: ({ bulletin }) =>
    bulletin.totaux.brut === undefined
      ? 'Le total brut n’a pas pu être lu sur le bulletin.'
      : bulletin.lignes.filter((l) => l.nature === 'remuneration').length < 1
        ? 'Aucun élément de rémunération détaillé n’a été détecté.'
        : null,
  executer({ bulletin, params }) {
    const affiche = bulletin.totaux.brut!;
    const recalcule = brutRecalcule(bulletin);
    const ecart = arrondi(affiche - recalcule);
    if (Math.abs(ecart) <= TOLERANCE) return [];

    return [
      finaliser(
        {
          code: 'ARI-02',
          controle: this.nom,
          titre: 'Le total brut ne correspond pas au détail des éléments de paie',
          severite: severiteSelonEcart(ecart, 2, 20),
          categorie: 'arithmetique',
          confiance: 'probable',
          explication:
            ecart < 0
              ? `Le détail des lignes de votre bulletin totalise ${euros(recalcule)}, soit ${euros(Math.abs(ecart))} de plus que le brut affiché. Une ligne semble oubliée dans le total.`
              : `Le brut affiché (${euros(affiche)}) dépasse de ${euros(ecart)} la somme des lignes détaillées. Un élément de rémunération n’est peut-être pas détaillé.`,
          detail:
            `Somme des éléments de rémunération : ${euros(recalcule)}. ` +
            `Total brut affiché : ${euros(affiche)}. Écart : ${euros(ecart)}.`,
          attendu: recalcule,
          constate: affiche,
          ecart,
          impactMensuel: ecart < 0 ? Math.abs(ecart) : undefined,
          references: [REF_MENTIONS_BULLETIN],
          actions: [
            'Comparez ligne à ligne avec le bulletin du mois précédent.',
            'Demandez au service paie quel élément explique la différence.',
          ],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* ARI-03 — total des cotisations salariales                           */
/* ------------------------------------------------------------------ */

export const controleTotalCotisations: Controle = {
  code: 'ARI-03',
  nom: 'Total des cotisations salariales',
  categorie: 'arithmetique',
  description: 'Additionne les parts salariales de toutes les cotisations et compare au total affiché.',
  references: [REF_MENTIONS_BULLETIN],
  applicable: ({ bulletin }) =>
    bulletin.totaux.totalCotisationsSalariales === undefined
      ? 'Le total des cotisations salariales n’a pas pu être lu.'
      : null,
  executer({ bulletin, params }) {
    const affiche = bulletin.totaux.totalCotisationsSalariales!;
    const recalcule = totalCotisationsSalariales(bulletin);
    const ecart = arrondi(affiche - recalcule);
    if (Math.abs(ecart) <= TOLERANCE) return [];

    return [
      finaliser(
        {
          code: 'ARI-03',
          controle: this.nom,
          titre: 'Le total des cotisations salariales ne correspond pas au détail',
          severite: severiteSelonEcart(ecart, 2, 20),
          categorie: 'arithmetique',
          confiance: 'probable',
          explication:
            ecart > 0
              ? `Le total des retenues affiché dépasse de ${euros(ecart)} la somme des lignes détaillées : autant de net en moins pour vous.`
              : `La somme des lignes de cotisations dépasse de ${euros(Math.abs(ecart))} le total affiché.`,
          detail:
            `Somme des parts salariales : ${euros(recalcule)}. Total affiché : ${euros(affiche)}. Écart : ${euros(ecart)}.`,
          attendu: recalcule,
          constate: affiche,
          ecart,
          impactMensuel: ecart > 0 ? ecart : undefined,
          references: [REF_MENTIONS_BULLETIN, REF_PRESCRIPTION],
          actions: ['Demandez le détail du calcul du total des retenues salariales.'],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* ARI-04 — brut − cotisations = net avant impôt                       */
/* ------------------------------------------------------------------ */

export const controleNetAvantImpot: Controle = {
  code: 'ARI-04',
  nom: 'Net à payer avant impôt',
  categorie: 'arithmetique',
  description: 'Vérifie que le net avant impôt correspond au brut diminué des cotisations salariales.',
  references: [REF_MENTIONS_BULLETIN],
  applicable: ({ bulletin }) => {
    const t = bulletin.totaux;
    if (t.netAvantImpot === undefined) return 'Le net avant impôt n’est pas mentionné sur le bulletin.';
    if (brut(bulletin) === undefined) return 'Le brut n’a pas pu être lu.';
    return null;
  },
  executer({ bulletin, params }) {
    const t = bulletin.totaux;
    const b = brut(bulletin)!;
    const cotisations = t.totalCotisationsSalariales ?? totalCotisationsSalariales(bulletin);
    const nonSoumis = totalNonSoumis(bulletin);
    const attendu = arrondi(b - cotisations + nonSoumis);
    const ecart = arrondi(t.netAvantImpot! - attendu);
    if (Math.abs(ecart) <= TOLERANCE) return [];

    return [
      finaliser(
        {
          code: 'ARI-04',
          controle: this.nom,
          titre: 'Le net avant impôt ne découle pas du brut et des cotisations',
          severite: severiteSelonEcart(ecart, 2, 20),
          categorie: 'arithmetique',
          confiance: 'probable',
          explication:
            ecart < 0
              ? `Le net avant impôt devrait être de ${euros(attendu)} : il vous manque ${euros(Math.abs(ecart))}.`
              : `Le net avant impôt affiché dépasse de ${euros(ecart)} le calcul attendu. Vérifiez qu’aucune retenue n’a été omise.`,
          detail:
            `${euros(b)} (brut) − ${euros(cotisations)} (cotisations salariales)` +
            (nonSoumis ? ` + ${euros(nonSoumis)} (éléments non soumis)` : '') +
            ` = ${euros(attendu)}, contre ${euros(t.netAvantImpot!)} affiché.`,
          attendu,
          constate: t.netAvantImpot!,
          ecart,
          impactMensuel: ecart < 0 ? Math.abs(ecart) : undefined,
          references: [REF_MENTIONS_BULLETIN, REF_PRESCRIPTION],
          actions: ['Réclamez le détail du passage du brut au net avant impôt.'],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* ARI-05 — net à payer                                                */
/* ------------------------------------------------------------------ */

export const controleNetAPayer: Controle = {
  code: 'ARI-05',
  nom: 'Net à payer après impôt',
  categorie: 'arithmetique',
  description:
    'Vérifie que le net versé correspond au net avant impôt diminué du prélèvement à la source et des retenues.',
  references: [REF_MENTIONS_BULLETIN],
  applicable: ({ bulletin }) => {
    const t = bulletin.totaux;
    if (t.netAPayer === undefined) return 'Le net à payer n’a pas pu être lu.';
    if (t.netAvantImpot === undefined) return 'Le net avant impôt n’est pas mentionné.';
    return null;
  },
  executer({ bulletin, params }) {
    const t = bulletin.totaux;
    const pas = t.prelevementSource ?? 0;
    const retenues = totalRetenuesNettes(bulletin);
    const attendu = arrondi(t.netAvantImpot! - pas - retenues);
    const ecart = arrondi(t.netAPayer! - attendu);
    if (Math.abs(ecart) <= TOLERANCE) return [];

    return [
      finaliser(
        {
          code: 'ARI-05',
          controle: this.nom,
          titre: 'Le net à payer ne correspond pas au calcul attendu',
          severite: severiteSelonEcart(ecart, 2, 20),
          categorie: 'arithmetique',
          confiance: 'probable',
          explication:
            ecart < 0
              ? `Il manque ${euros(Math.abs(ecart))} sur le net qui vous est versé ce mois-ci.`
              : `Le net versé dépasse de ${euros(ecart)} le calcul attendu : vérifiez qu’il ne s’agit pas d’un trop-perçu qui vous sera repris.`,
          detail:
            `${euros(t.netAvantImpot!)} (net avant impôt) − ${euros(pas)} (prélèvement à la source)` +
            (retenues ? ` − ${euros(retenues)} (retenues nettes)` : '') +
            ` = ${euros(attendu)}, contre ${euros(t.netAPayer!)} affiché.`,
          attendu,
          constate: t.netAPayer!,
          ecart,
          impactMensuel: ecart < 0 ? Math.abs(ecart) : undefined,
          references: [REF_MENTIONS_BULLETIN, REF_PRESCRIPTION],
          actions: [
            'Comparez le net à payer avec le montant réellement viré sur votre compte.',
            'Signalez immédiatement l’écart au service paie : la régularisation est due sur la paie suivante.',
          ],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* ARI-06 — net imposable                                              */
/* ------------------------------------------------------------------ */

export const controleNetImposable: Controle = {
  code: 'ARI-06',
  nom: 'Net imposable',
  categorie: 'fiscal',
  description:
    'Recalcule le net imposable : net avant impôt, augmenté de la CSG/CRDS non déductible et de la part patronale de protection sociale complémentaire.',
  references: [
    { texte: 'Article 83 du Code général des impôts' },
    { texte: 'Article L.136-8 du Code de la sécurité sociale — CSG non déductible' },
  ],
  applicable: ({ bulletin }) => {
    const t = bulletin.totaux;
    if (t.netImposable === undefined) return 'Le net imposable n’a pas pu être lu.';
    if (t.netAvantImpot === undefined) return 'Le net avant impôt n’est pas mentionné.';
    return null;
  },
  executer({ bulletin, params }) {
    const t = bulletin.totaux;
    const csgNonDed = csgCrdsNonDeductible(bulletin);
    const partPat = partPatronalePrevoyance(bulletin);
    const nonSoumis = totalNonSoumis(bulletin);
    const attendu = arrondi(t.netAvantImpot! + csgNonDed + partPat - nonSoumis);
    const ecart = arrondi(t.netImposable! - attendu);
    if (Math.abs(ecart) <= 1) return [];

    // Un net imposable surévalué majore l'impôt : l'impact est indirect.
    const impactImpot = ecart > 0 ? arrondi((ecart * (t.tauxPrelevementSource ?? 0)) / 100) : undefined;

    return [
      finaliser(
        {
          code: 'ARI-06',
          controle: this.nom,
          titre: 'Le net imposable ne correspond pas au calcul attendu',
          severite: severiteSelonEcart(ecart, 10, 100),
          categorie: 'fiscal',
          confiance: 'probable',
          explication:
            ecart > 0
              ? `Votre net imposable semble surévalué de ${euros(ecart)}. Vous risquez de payer plus d’impôt que vous ne le devez, ce mois-ci et sur votre déclaration annuelle.`
              : `Votre net imposable semble sous-évalué de ${euros(Math.abs(ecart))}. L’écart se rattrapera lors de votre déclaration de revenus.`,
          detail:
            `${euros(t.netAvantImpot!)} (net avant impôt) + ${euros(csgNonDed)} (CSG/CRDS non déductible)` +
            (partPat ? ` + ${euros(partPat)} (part patronale prévoyance/mutuelle)` : '') +
            (nonSoumis ? ` − ${euros(nonSoumis)} (éléments non soumis)` : '') +
            ` = ${euros(attendu)}, contre ${euros(t.netImposable!)} affiché.`,
          attendu,
          constate: t.netImposable!,
          ecart,
          impactMensuel: impactImpot,
          references: [{ texte: 'Article 83 du Code général des impôts' }],
          actions: [
            'Vérifiez le net imposable reporté sur votre déclaration préremplie.',
            'Demandez un bulletin rectificatif si l’erreur est confirmée : elle affecte votre impôt.',
          ],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* ARI-07 — montant net social                                         */
/* ------------------------------------------------------------------ */

export const controleNetSocial: Controle = {
  code: 'ARI-07',
  nom: 'Montant net social',
  categorie: 'arithmetique',
  description:
    'Recalcule le montant net social : rémunération brute augmentée des contributions patronales de protection sociale complémentaire, diminuée des cotisations salariales.',
  references: [
    {
      texte: 'Arrêté du 31 janvier 2023 modifiant le modèle de bulletin de paie (montant net social)',
      url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000047088980',
    },
  ],
  applicable: ({ bulletin }) => {
    if (bulletin.totaux.netSocial === undefined) return 'Le montant net social n’est pas mentionné.';
    if (brut(bulletin) === undefined) return 'Le brut n’a pas pu être lu.';
    return null;
  },
  executer({ bulletin, params }) {
    const t = bulletin.totaux;
    const b = brut(bulletin)!;
    const cotisations = t.totalCotisationsSalariales ?? totalCotisationsSalariales(bulletin);
    const partPat = partPatronalePrevoyance(bulletin);
    const attendu = arrondi(b + partPat - cotisations);
    const ecart = arrondi(t.netSocial! - attendu);
    if (Math.abs(ecart) <= 1) return [];

    return [
      finaliser(
        {
          code: 'ARI-07',
          controle: this.nom,
          titre: 'Le montant net social semble erroné',
          severite: 'majeure',
          categorie: 'arithmetique',
          confiance: 'probable',
          explication:
            'Le montant net social sert de référence aux organismes sociaux pour calculer la prime d’activité et le RSA. ' +
            (ecart > 0
              ? `Surévalué de ${euros(ecart)}, il peut réduire à tort vos droits.`
              : `Sous-évalué de ${euros(Math.abs(ecart))}, il peut entraîner un indu à rembourser plus tard.`),
          detail:
            `${euros(b)} (brut) + ${euros(partPat)} (part patronale de protection sociale complémentaire) ` +
            `− ${euros(cotisations)} (cotisations salariales) = ${euros(attendu)}, contre ${euros(t.netSocial!)} affiché.`,
          attendu,
          constate: t.netSocial!,
          ecart,
          references: [
            { texte: 'Arrêté du 31 janvier 2023 — montant net social' },
            { texte: 'Article R.3243-1 du Code du travail' },
          ],
          actions: [
            'Vérifiez le montant déclaré à la CAF si vous percevez la prime d’activité ou le RSA.',
            'Demandez la correction du montant net social auprès de votre employeur.',
          ],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* ARI-08 — coût total employeur                                       */
/* ------------------------------------------------------------------ */

export const controleCoutEmployeur: Controle = {
  code: 'ARI-08',
  nom: 'Total versé par l’employeur',
  categorie: 'arithmetique',
  description:
    'Vérifie que le coût employeur affiché correspond au brut augmenté des cotisations patronales et diminué des allègements.',
  references: [REF_MENTIONS_BULLETIN],
  applicable: ({ bulletin }) =>
    bulletin.totaux.coutTotalEmployeur === undefined
      ? 'Le total versé par l’employeur n’est pas mentionné.'
      : brut(bulletin) === undefined
        ? 'Le brut n’a pas pu être lu.'
        : null,
  executer({ bulletin, params }) {
    const t = bulletin.totaux;
    const b = brut(bulletin)!;
    const patronales = t.totalCotisationsPatronales ?? totalCotisationsPatronales(bulletin);
    const allegements = t.allegementsPatronaux ?? 0;
    const attendu = arrondi(b + patronales - allegements);
    const ecart = arrondi(t.coutTotalEmployeur! - attendu);
    if (Math.abs(ecart) <= 1) return [];

    return [
      finaliser(
        {
          code: 'ARI-08',
          controle: this.nom,
          titre: 'Le total versé par l’employeur ne correspond pas au calcul attendu',
          severite: 'mineure',
          categorie: 'arithmetique',
          confiance: 'probable',
          explication:
            'Cette mention ne change pas votre net, mais un écart signale souvent une ligne de cotisation patronale mal paramétrée.',
          detail:
            `${euros(b)} (brut) + ${euros(patronales)} (cotisations patronales)` +
            (allegements ? ` − ${euros(allegements)} (allègements)` : '') +
            ` = ${euros(attendu)}, contre ${euros(t.coutTotalEmployeur!)} affiché.`,
          attendu,
          constate: t.coutTotalEmployeur!,
          ecart,
          references: [REF_MENTIONS_BULLETIN],
          actions: ['Point de vigilance à signaler au service paie ou au cabinet comptable.'],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* ARI-09 — prélèvement à la source                                    */
/* ------------------------------------------------------------------ */

export const controlePrelevementSource: Controle = {
  code: 'ARI-09',
  nom: 'Calcul du prélèvement à la source',
  categorie: 'fiscal',
  description: 'Vérifie que l’impôt retenu correspond au net imposable multiplié par le taux appliqué.',
  references: [
    { texte: 'Article 204 H du Code général des impôts — assiette du prélèvement à la source' },
  ],
  applicable: ({ bulletin }) => {
    const t = bulletin.totaux;
    if (t.prelevementSource === undefined) return 'Aucun prélèvement à la source détecté.';
    if (t.tauxPrelevementSource === undefined) return 'Le taux de prélèvement n’a pas pu être lu.';
    if (t.netImposable === undefined) return 'Le net imposable n’a pas pu être lu.';
    return null;
  },
  executer({ bulletin, params, options }) {
    const anomalies: Anomalie[] = [];
    const t = bulletin.totaux;
    const attendu = arrondi((t.netImposable! * t.tauxPrelevementSource!) / 100);
    const ecart = arrondi(t.prelevementSource! - attendu);

    if (Math.abs(ecart) > 1) {
      anomalies.push(
        finaliser(
          {
            code: 'ARI-09',
            controle: this.nom,
            titre: 'Le prélèvement à la source ne correspond pas au taux appliqué',
            severite: severiteSelonEcart(ecart, 5, 50),
            categorie: 'fiscal',
            confiance: 'certaine',
            explication:
              ecart > 0
                ? `${euros(ecart)} d’impôt de trop ont été prélevés ce mois-ci. La somme vous sera restituée, mais avec un an de décalage.`
                : `${euros(Math.abs(ecart))} d’impôt en moins ont été prélevés : la régularisation viendra en votre défaveur l’an prochain.`,
            detail:
              `${euros(t.netImposable!)} × ${t.tauxPrelevementSource} % = ${euros(attendu)}, ` +
              `contre ${euros(t.prelevementSource!)} retenu.`,
            attendu,
            constate: t.prelevementSource!,
            ecart,
            impactMensuel: ecart > 0 ? ecart : undefined,
            references: [{ texte: 'Article 204 H du Code général des impôts' }],
            actions: ['Signalez l’écart au service paie et vérifiez votre espace impots.gouv.fr.'],
          },
          params,
        ),
      );
    }

    const tauxAttendu = options.tauxPasAttendu;
    if (tauxAttendu !== undefined && Math.abs(tauxAttendu - t.tauxPrelevementSource!) > 0.01) {
      const ecartTaux = arrondi(t.tauxPrelevementSource! - tauxAttendu, 3);
      const impact = arrondi((t.netImposable! * ecartTaux) / 100);
      anomalies.push(
        finaliser(
          {
            code: 'ARI-09b',
            controle: this.nom,
            titre: 'Le taux de prélèvement appliqué diffère de votre taux personnalisé',
            severite: 'majeure',
            categorie: 'fiscal',
            confiance: 'certaine',
            explication:
              `Votre taux transmis par l’administration fiscale est de ${tauxAttendu} %, ` +
              `mais l’employeur applique ${t.tauxPrelevementSource} %. ` +
              (ecartTaux > 0
                ? `Cela vous coûte ${euros(Math.abs(impact))} d’impôt en trop chaque mois.`
                : 'Cela crée une dette d’impôt qui vous sera réclamée.'),
            detail: `Taux attendu ${tauxAttendu} %, taux appliqué ${t.tauxPrelevementSource} % (écart de ${ecartTaux} point).`,
            attendu: tauxAttendu,
            constate: t.tauxPrelevementSource!,
            ecart: ecartTaux,
            impactMensuel: impact > 0 ? impact : undefined,
            references: [{ texte: 'Article 204 H du Code général des impôts' }],
            actions: [
              'Comparez avec le taux figurant dans votre espace personnel sur impots.gouv.fr.',
              'Demandez à l’employeur de reprendre le taux transmis par la DGFiP dans le compte rendu métier de la DSN.',
            ],
          },
          params,
        ),
      );
    }
    return anomalies;
  },
};

/* ------------------------------------------------------------------ */
/* ARI-10 — cohérence des parts salariale et patronale de mutuelle     */
/* ------------------------------------------------------------------ */

export const controleCoherencePrevoyance: Controle = {
  code: 'ARI-10',
  nom: 'Cohérence des lignes de protection sociale complémentaire',
  categorie: 'arithmetique',
  description:
    'Vérifie que les parts salariale et patronale des lignes de mutuelle et de prévoyance sont bien toutes deux renseignées.',
  references: [{ texte: 'Article L.911-7 du Code de la sécurité sociale' }],
  applicable: ({ bulletin }) =>
    bulletin.lignes.some((l) => l.code === 'MUTUELLE' || l.code === 'PREVOYANCE')
      ? null
      : 'Aucune ligne de mutuelle ou de prévoyance détectée.',
  executer({ bulletin, params }) {
    const salariale = partSalarialePrevoyance(bulletin);
    const patronale = partPatronalePrevoyance(bulletin);
    if (salariale === 0 || patronale > 0) return [];

    return [
      finaliser(
        {
          code: 'ARI-10',
          controle: this.nom,
          titre: 'Part patronale de complémentaire santé absente du bulletin',
          severite: 'majeure',
          categorie: 'conformite',
          confiance: 'probable',
          explication:
            'Une part salariale de complémentaire santé est retenue sans qu’aucune part employeur n’apparaisse. ' +
            'L’employeur doit financer au moins la moitié de la couverture collective obligatoire.',
          detail: `Part salariale relevée : ${euros(salariale)}. Part patronale : aucune.`,
          references: [
            { texte: 'Article L.911-7 du Code de la sécurité sociale — financement patronal minimal de 50 %' },
          ],
          actions: [
            'Vérifiez si votre contrat de complémentaire santé est collectif et obligatoire.',
            'Si oui, réclamez la part employeur et sa mention sur le bulletin.',
          ],
        },
        params,
      ),
    ];
  },
};

export const CONTROLES_ARITHMETIQUES: Controle[] = [
  controleLignesCotisation,
  controleTotalBrut,
  controleTotalCotisations,
  controleNetAvantImpot,
  controleNetAPayer,
  controleNetImposable,
  controleNetSocial,
  controleCoutEmployeur,
  controlePrelevementSource,
  controleCoherencePrevoyance,
];
