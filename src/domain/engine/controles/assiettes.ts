import type { Anomalie } from '../../types';
import { arrondi, procheRelatif } from '../../parsing/montants';
import { assietteCsg, bareme, decouperTranches } from '../../referentiel';
import type { Controle } from '../types';
import {
  brut, euros, finaliser, lignesParCode, partPatronalePrevoyance,
  REF_PRESCRIPTION, severiteSelonEcart,
} from '../utils';

/* ------------------------------------------------------------------ */
/* ASS-01 — assiette plafonnée supérieure au plafond                   */
/* ------------------------------------------------------------------ */

/**
 * Codes dont l'assiette est bornée au plafond mensuel de la Sécurité sociale.
 * Le FNAL en est volontairement exclu : son assiette dépend de l'effectif
 * (plafonnée en deçà de 50 salariés, totalité au-delà) et il est purement
 * patronal, ce qui n'en fait pas un enjeu pour le salarié.
 */
const CODES_T1 = ['VIEILLESSE_PLAFONNEE', 'RETRAITE_COMP_T1', 'CEG_T1'];

export const controleAssiettePlafonnee: Controle = {
  code: 'ASS-01',
  nom: 'Assiette des cotisations plafonnées',
  categorie: 'assiettes',
  description:
    'Vérifie que les cotisations de tranche 1 sont calculées sur une assiette limitée au plafond mensuel de la Sécurité sociale.',
  references: [
    { texte: 'Article D.242-17 du Code de la sécurité sociale' },
    { texte: 'BOSS — Assiette générale, plafond de la Sécurité sociale' },
  ],
  executer({ bulletin, params }) {
    const anomalies: Anomalie[] = [];
    const remuneration = brut(bulletin);
    const plafond = params.plafondMensuelSS;
    const assietteAttendue = remuneration !== undefined ? Math.min(remuneration, plafond) : plafond;

    for (const code of CODES_T1) {
      for (const ligne of lignesParCode(bulletin, code)) {
        if (ligne.base === undefined) continue;
        if (ligne.base <= plafond + 0.5) continue;

        const taux = (ligne.tauxSalarial ?? 0) + (ligne.tauxPatronal ?? 0);
        const excedent = arrondi(ligne.base - plafond);
        const impactSalarial = arrondi((excedent * (ligne.tauxSalarial ?? 0)) / 100);

        anomalies.push(
          finaliser(
            {
              code: 'ASS-01',
              controle: this.nom,
              titre: `Assiette plafonnée dépassée sur « ${ligne.libelle} »`,
              severite: severiteSelonEcart(impactSalarial, 3, 30),
              categorie: 'assiettes',
              confiance: params.fiabilite === 'verifie' ? 'certaine' : 'a_verifier',
              explication:
                `Cette cotisation ne peut porter que sur la part de salaire allant jusqu’au plafond mensuel de la ` +
                `Sécurité sociale, soit ${euros(plafond)}. Le bulletin la calcule pourtant sur ${euros(ligne.base)}. ` +
                (impactSalarial > 0
                  ? `Vous payez ${euros(impactSalarial)} de trop chaque mois sur cette ligne.`
                  : 'La part employeur est surévaluée.'),
              detail:
                `Assiette constatée ${euros(ligne.base)}, plafond applicable ${euros(plafond)}, ` +
                `excédent ${euros(excedent)} soumis à ${taux} %. ` +
                `Assiette attendue : ${euros(assietteAttendue)}.`,
              attendu: assietteAttendue,
              constate: ligne.base,
              ecart: excedent,
              impactMensuel: impactSalarial > 0 ? impactSalarial : undefined,
              references: [
                { texte: 'Article D.242-17 du Code de la sécurité sociale' },
                REF_PRESCRIPTION,
              ],
              actions: [
                'Demandez le détail du calcul de l’assiette plafonnée.',
                'Vérifiez si un plafond réduit (entrée ou sortie en cours de mois) s’applique, ce qui abaisserait encore l’assiette.',
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
/* ASS-02 — découpage des tranches 1 et 2                              */
/* ------------------------------------------------------------------ */

export const controleTranches: Controle = {
  code: 'ASS-02',
  nom: 'Découpage des tranches 1 et 2',
  categorie: 'assiettes',
  description:
    'Vérifie que la tranche 1 s’arrête au plafond mensuel et que la tranche 2 couvre exactement la part comprise entre 1 et 8 plafonds.',
  references: [{ texte: 'Accord national interprofessionnel Agirc-Arrco — tranches de cotisation' }],
  applicable: ({ bulletin }) =>
    brut(bulletin) === undefined ? 'Le brut n’a pas pu être lu.' : null,
  executer({ bulletin, params }) {
    const anomalies: Anomalie[] = [];
    const remuneration = brut(bulletin)!;
    const attendues = decouperTranches(remuneration, params.plafondMensuelSS);

    const verifier = (code: string, attendue: number, nomTranche: string) => {
      for (const ligne of lignesParCode(bulletin, code)) {
        if (ligne.base === undefined) continue;
        if (procheRelatif(ligne.base, attendue, 1, 0.002)) continue;

        const ecart = arrondi(ligne.base - attendue);
        const impact = arrondi((ecart * (ligne.tauxSalarial ?? 0)) / 100);
        anomalies.push(
          finaliser(
            {
              code: 'ASS-02',
              controle: this.nom,
              titre: `${nomTranche} mal calculée sur « ${ligne.libelle} »`,
              severite: severiteSelonEcart(impact, 3, 30),
              categorie: 'assiettes',
              confiance: params.fiabilite === 'verifie' ? 'probable' : 'a_verifier',
              explication:
                `Pour un brut de ${euros(remuneration)} et un plafond de ${euros(params.plafondMensuelSS)}, ` +
                `${nomTranche.toLowerCase()} devrait être de ${euros(attendue)}. Le bulletin retient ${euros(ligne.base)}.` +
                (impact > 0 ? ` Cela vous coûte ${euros(impact)} ce mois-ci.` : ''),
              detail:
                `Tranche 1 attendue : ${euros(attendues.t1)} — tranche 2 attendue : ${euros(attendues.t2)}. ` +
                `Assiette constatée sur cette ligne : ${euros(ligne.base)}.`,
              attendu: attendue,
              constate: ligne.base,
              ecart,
              impactMensuel: impact > 0 ? impact : undefined,
              references: [{ texte: 'Accord national interprofessionnel Agirc-Arrco' }, REF_PRESCRIPTION],
              actions: [
                'Vérifiez si un plafond réduit s’applique (mois incomplet, temps partiel avec plafond proratisé).',
                'Demandez le détail du découpage des tranches au service paie.',
              ],
              lignesConcernees: [ligne.libelle],
            },
            params,
          ),
        );
      }
    };

    verifier('RETRAITE_COMP_T1', attendues.t1, 'La tranche 1');
    verifier('CEG_T1', attendues.t1, 'La tranche 1');
    verifier('RETRAITE_COMP_T2', attendues.t2, 'La tranche 2');
    verifier('CEG_T2', attendues.t2, 'La tranche 2');
    return anomalies;
  },
};

/* ------------------------------------------------------------------ */
/* ASS-03 — assiette CSG / CRDS                                        */
/* ------------------------------------------------------------------ */

export const controleAssietteCsg: Controle = {
  code: 'ASS-03',
  nom: 'Assiette de CSG et de CRDS',
  categorie: 'assiettes',
  description:
    'Recalcule l’assiette de CSG/CRDS : 98,25 % de la rémunération brute, augmentée des contributions patronales de protection sociale complémentaire.',
  references: [
    { texte: 'Article L.136-1-1 du Code de la sécurité sociale' },
    { texte: 'Article L.136-8 du Code de la sécurité sociale — abattement de 1,75 % plafonné à 4 PASS' },
  ],
  applicable: ({ bulletin }) =>
    brut(bulletin) === undefined ? 'Le brut n’a pas pu être lu.' : null,
  executer({ bulletin, params }) {
    const anomalies: Anomalie[] = [];
    const remuneration = brut(bulletin)!;
    const partPat = partPatronalePrevoyance(bulletin);
    const attendue = arrondi(assietteCsg(remuneration, partPat, params));

    for (const code of ['CSG_DEDUCTIBLE', 'CSG_CRDS_NON_DEDUCTIBLE', 'CSG_NON_DEDUCTIBLE', 'CRDS']) {
      for (const ligne of lignesParCode(bulletin, code)) {
        if (ligne.base === undefined) continue;
        if (procheRelatif(ligne.base, attendue, 1, 0.002)) continue;

        const ecart = arrondi(ligne.base - attendue);
        const taux = ligne.tauxSalarial ?? bareme(params, code)?.tauxSalarial ?? 0;
        const impact = arrondi((ecart * taux) / 100);

        anomalies.push(
          finaliser(
            {
              code: 'ASS-03',
              controle: this.nom,
              titre: `Assiette de CSG/CRDS incorrecte sur « ${ligne.libelle} »`,
              severite: severiteSelonEcart(impact, 2, 25),
              categorie: 'assiettes',
              confiance: 'probable',
              explication:
                'La CSG et la CRDS se calculent sur 98,25 % du salaire brut, augmenté des cotisations patronales ' +
                'de mutuelle et de prévoyance. ' +
                (ecart > 0
                  ? `L’assiette retenue est supérieure de ${euros(ecart)} à ce calcul, soit ${euros(Math.abs(impact))} de contribution en trop.`
                  : `L’assiette retenue est inférieure de ${euros(Math.abs(ecart))} à ce calcul.`),
              detail:
                `${euros(remuneration)} × 98,25 %` +
                (partPat ? ` + ${euros(partPat)} (part patronale prévoyance/mutuelle)` : '') +
                ` = ${euros(attendue)}, contre ${euros(ligne.base)} retenu.`,
              attendu: attendue,
              constate: ligne.base,
              ecart,
              impactMensuel: impact > 0 ? impact : undefined,
              references: [
                { texte: 'Article L.136-1-1 du Code de la sécurité sociale' },
                REF_PRESCRIPTION,
              ],
              actions: [
                'Vérifiez si des éléments non soumis à l’abattement (indemnités, primes exclues) expliquent l’écart.',
                'Demandez le détail de l’assiette CSG au service paie.',
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
/* ASS-04 — assiette déplafonnée                                       */
/* ------------------------------------------------------------------ */

export const controleAssietteDeplafonnee: Controle = {
  code: 'ASS-04',
  nom: 'Assiette des cotisations déplafonnées',
  categorie: 'assiettes',
  description:
    'Vérifie que les cotisations dues sur la totalité du salaire portent bien sur l’intégralité du brut.',
  references: [{ texte: 'Article L.242-1 du Code de la sécurité sociale' }],
  applicable: ({ bulletin }) =>
    brut(bulletin) === undefined ? 'Le brut n’a pas pu être lu.' : null,
  executer({ bulletin, params }) {
    const anomalies: Anomalie[] = [];
    const remuneration = brut(bulletin)!;
    const codes = ['VIEILLESSE_DEPLAFONNEE', 'CSA', 'ALLOCATIONS_FAMILIALES', 'ACCIDENT_TRAVAIL'];

    for (const code of codes) {
      for (const ligne of lignesParCode(bulletin, code)) {
        if (ligne.base === undefined) continue;
        if (procheRelatif(ligne.base, remuneration, 1, 0.002)) continue;

        const ecart = arrondi(ligne.base - remuneration);
        const impact = arrondi((ecart * (ligne.tauxSalarial ?? 0)) / 100);
        anomalies.push(
          finaliser(
            {
              code: 'ASS-04',
              controle: this.nom,
              titre: `Assiette déplafonnée incohérente sur « ${ligne.libelle} »`,
              severite: impact > 0 ? severiteSelonEcart(impact, 2, 25) : 'mineure',
              categorie: 'assiettes',
              confiance: 'probable',
              explication:
                `Cette cotisation est due sur la totalité de la rémunération, soit ${euros(remuneration)}. ` +
                `Le bulletin la calcule sur ${euros(ligne.base)}.`,
              detail: `Assiette attendue ${euros(remuneration)}, assiette constatée ${euros(ligne.base)} (écart ${euros(ecart)}).`,
              attendu: remuneration,
              constate: ligne.base,
              ecart,
              impactMensuel: impact > 0 ? impact : undefined,
              references: [{ texte: 'Article L.242-1 du Code de la sécurité sociale' }],
              actions: [
                'Vérifiez si des éléments exclus de l’assiette (frais professionnels, indemnités non soumises) justifient l’écart.',
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

export const CONTROLES_ASSIETTES: Controle[] = [
  controleAssiettePlafonnee,
  controleTranches,
  controleAssietteCsg,
  controleAssietteDeplafonnee,
];
