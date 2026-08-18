import type { Anomalie, Bulletin } from '../../types';
import { arrondi } from '../../parsing/montants';
import type { Controle } from '../types';
import { brut, euros, finaliser, REF_PRESCRIPTION, severiteSelonEcart } from '../utils';

/**
 * Contrôles longitudinaux : c'est en comparant les bulletins mois après mois
 * que l'on repère les erreurs les plus coûteuses — une prime qui disparaît,
 * un taux qui change sans raison, un compteur qui se vide.
 */

/* ------------------------------------------------------------------ */
/* HIS-01 — variation du brut                                          */
/* ------------------------------------------------------------------ */

export const controleVariationBrut: Controle = {
  code: 'HIS-01',
  nom: 'Variation du salaire brut',
  categorie: 'historique',
  description: 'Compare le brut au bulletin précédent et signale une variation inexpliquée.',
  references: [{ texte: 'Article L.1221-1 du Code du travail — force obligatoire du contrat de travail' }],
  applicable: ({ historique }) =>
    historique.length === 0 ? 'Aucun bulletin antérieur disponible pour la comparaison.' : null,
  executer({ bulletin, historique, params }) {
    const precedent = historique[historique.length - 1];
    const actuel = brut(bulletin);
    const ancien = brut(precedent);
    if (actuel === undefined || ancien === undefined || ancien === 0) return [];

    const ecart = arrondi(actuel - ancien);
    const variation = arrondi((ecart / ancien) * 100, 1);
    if (Math.abs(variation) < 3) return [];

    // Une variation s'explique souvent par des heures supplémentaires ou des absences.
    const hsActuel = bulletin.heures.supplementaires.reduce((s, h) => s + h.montant, 0);
    const hsPrecedent = precedent.heures.supplementaires.reduce((s, h) => s + h.montant, 0);
    const expliqueParHs = arrondi(hsActuel - hsPrecedent);
    const absences = bulletin.heures.absences ?? 0;
    const inexplique = arrondi(ecart - expliqueParHs);

    if (Math.abs(inexplique) < Math.max(ancien * 0.02, 20)) return [];
    if (absences > 0 && inexplique < 0) return [];

    return [
      finaliser(
        {
          code: 'HIS-01',
          controle: this.nom,
          titre: ecart < 0 ? 'Baisse inexpliquée du salaire brut' : 'Hausse inexpliquée du salaire brut',
          severite: ecart < 0 ? severiteSelonEcart(Math.abs(inexplique), 20, 100) : 'info',
          categorie: 'historique',
          confiance: 'probable',
          explication:
            `Votre brut passe de ${euros(ancien)} (${moisLisible(precedent)}) à ${euros(actuel)} ` +
            `(${moisLisible(bulletin)}), soit ${variation > 0 ? '+' : ''}${variation} %. ` +
            (expliqueParHs !== 0
              ? `Les heures supplémentaires expliquent ${euros(expliqueParHs)} de cette variation, `
              : '') +
            `il reste ${euros(inexplique)} sans explication apparente.` +
            (ecart < 0
              ? ' Une baisse de rémunération ne peut pas vous être imposée sans votre accord écrit.'
              : ''),
          detail:
            `Brut précédent ${euros(ancien)} — brut courant ${euros(actuel)} — écart ${euros(ecart)}. ` +
            `Heures supplémentaires : ${euros(hsPrecedent)} → ${euros(hsActuel)}.` +
            (absences ? ` Absences retenues sur le mois : ${absences} h.` : ''),
          attendu: ancien,
          constate: actuel,
          ecart,
          impactMensuel: ecart < 0 ? Math.abs(inexplique) : undefined,
          references: [
            { texte: 'Article L.1221-1 du Code du travail' },
            { texte: 'Cour de cassation — la rémunération contractuelle ne peut être modifiée unilatéralement' },
            REF_PRESCRIPTION,
          ],
          actions: [
            'Comparez les deux bulletins ligne à ligne pour identifier l’élément qui a changé.',
            ecart < 0
              ? 'Si aucune absence ne l’explique, demandez une explication écrite : une baisse de salaire exige votre accord.'
              : 'Vérifiez qu’il ne s’agit pas d’un versement en double qui vous serait repris ensuite.',
          ],
        },
        params,
      ),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* HIS-02 — disparition d'une ligne récurrente                         */
/* ------------------------------------------------------------------ */

/** Codes dont la disparition mérite une alerte. */
const CODES_SUIVIS = [
  'PRIME_ANCIENNETE', 'PRIME', 'TREIZIEME_MOIS', 'TRANSPORT_PUBLIC',
  'TITRE_RESTAURANT', 'MUTUELLE', 'PREVOYANCE', 'AVANTAGE_NATURE', 'FORFAIT_MOBILITES',
];

export const controleLignesDisparues: Controle = {
  code: 'HIS-02',
  nom: 'Disparition d’un élément de rémunération récurrent',
  categorie: 'historique',
  description:
    'Repère les primes et avantages présents sur les bulletins précédents et absents du bulletin courant.',
  references: [
    { texte: 'Cour de cassation — une prime constante, générale et fixe devient un usage d’entreprise obligatoire' },
  ],
  applicable: ({ historique }) =>
    historique.length < 2 ? 'Au moins deux bulletins antérieurs sont nécessaires.' : null,
  executer({ bulletin, historique, params }) {
    const anomalies: Anomalie[] = [];
    const recents = historique.slice(-3);
    const codesActuels = new Set(bulletin.lignes.map((l) => l.code));

    for (const code of CODES_SUIVIS) {
      if (codesActuels.has(code)) continue;
      const presences = recents.filter((b) => b.lignes.some((l) => l.code === code));
      if (presences.length < 2) continue;

      const montants = presences.map((b) => {
        const l = b.lignes.find((x) => x.code === code)!;
        return Math.abs(l.montant ?? l.montantSalarial ?? 0);
      });
      const moyenne = arrondi(montants.reduce((s, m) => s + m, 0) / montants.length);
      const libelle = presences[0].lignes.find((l) => l.code === code)!.libelle;
      const estRemuneration = presences[0].lignes.find((l) => l.code === code)!.nature === 'remuneration';

      anomalies.push(
        finaliser(
          {
            code: 'HIS-02',
            controle: this.nom,
            titre: `« ${libelle} » a disparu de votre bulletin`,
            severite: estRemuneration ? severiteSelonEcart(moyenne, 15, 80) : 'mineure',
            categorie: 'historique',
            confiance: 'probable',
            explication:
              `Cette ligne figurait sur ${presences.length} des ${recents.length} bulletins précédents ` +
              `(environ ${euros(moyenne)} par mois) et n’apparaît plus sur celui de ${moisLisible(bulletin)}.` +
              (estRemuneration
                ? ' Une prime versée de façon constante, générale et fixe devient un usage que l’employeur ne peut supprimer qu’après dénonciation régulière.'
                : ''),
            detail: `Montants relevés sur les bulletins précédents : ${montants.map((m) => euros(m)).join(', ')}.`,
            attendu: moyenne,
            constate: 0,
            ecart: -moyenne,
            impactMensuel: estRemuneration ? moyenne : undefined,
            references: [
              { texte: 'Cour de cassation, chambre sociale — usage d’entreprise et dénonciation' },
              REF_PRESCRIPTION,
            ],
            actions: [
              'Demandez par écrit la raison de la suppression de cet élément.',
              'Si la prime constituait un usage, sa suppression exige une dénonciation écrite et un délai de prévenance.',
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
/* HIS-03 — changement de taux sans changement de période              */
/* ------------------------------------------------------------------ */

export const controleChangementTaux: Controle = {
  code: 'HIS-03',
  nom: 'Changement de taux de cotisation',
  categorie: 'historique',
  description:
    'Signale un taux de cotisation qui change d’un mois à l’autre sans changement de barème.',
  references: [{ texte: 'Barèmes de cotisations sociales en vigueur' }],
  applicable: ({ historique }) =>
    historique.length === 0 ? 'Aucun bulletin antérieur disponible.' : null,
  executer({ bulletin, historique, params }) {
    const anomalies: Anomalie[] = [];
    const precedent = historique[historique.length - 1];

    for (const ligne of bulletin.lignes) {
      if (ligne.nature !== 'cotisation' || !ligne.code || ligne.tauxSalarial === undefined) continue;
      const ancienne = precedent.lignes.find((l) => l.code === ligne.code);
      if (!ancienne?.tauxSalarial) continue;

      const ecart = arrondi(ligne.tauxSalarial - ancienne.tauxSalarial, 3);
      if (Math.abs(ecart) < 0.005) continue;

      const impact = arrondi(((ligne.base ?? 0) * ecart) / 100);
      anomalies.push(
        finaliser(
          {
            code: 'HIS-03',
            controle: this.nom,
            titre: `Le taux de « ${ligne.libelle} » a changé`,
            severite: impact > 0 ? severiteSelonEcart(impact, 3, 25) : 'info',
            categorie: 'historique',
            confiance: 'certaine',
            explication:
              `Le taux salarial passe de ${ancienne.tauxSalarial} % à ${ligne.tauxSalarial} % ` +
              `entre ${moisLisible(precedent)} et ${moisLisible(bulletin)}.` +
              (impact > 0
                ? ` Cela vous coûte ${euros(impact)} de plus ce mois-ci.`
                : ' Cette évolution vous est favorable.'),
            detail:
              `Taux précédent ${ancienne.tauxSalarial} % — taux courant ${ligne.tauxSalarial} % ` +
              `sur une base de ${euros(ligne.base ?? 0)}.`,
            attendu: ancienne.tauxSalarial,
            constate: ligne.tauxSalarial,
            ecart,
            impactMensuel: impact > 0 ? impact : undefined,
            references: [{ texte: 'Barèmes de cotisations sociales en vigueur' }],
            actions: [
              'Un changement de taux au 1er janvier ou lors d’une revalorisation de barème est normal.',
              'En cours d’année et hors revalorisation, demandez une explication au service paie.',
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

/* ------------------------------------------------------------------ */
/* HIS-04 — récurrence d'une anomalie                                  */
/* ------------------------------------------------------------------ */

export const controleCumulAnnuel: Controle = {
  code: 'HIS-04',
  nom: 'Cohérence des cumuls annuels',
  categorie: 'historique',
  description:
    'Compare le cumul annuel affiché sur le bulletin à la somme des bruts des bulletins importés.',
  references: [{ texte: 'Article R.3243-1 du Code du travail' }],
  applicable: ({ bulletin, historique }) => {
    if (bulletin.cumuls?.brutAnnuel === undefined) return 'Aucun cumul annuel n’a été lu sur le bulletin.';
    const memeAnnee = historique.filter((b) => b.annee === bulletin.annee);
    if (memeAnnee.length + 1 < bulletin.mois) {
      return 'Tous les bulletins de l’année ne sont pas importés : la comparaison serait faussée.';
    }
    return null;
  },
  executer({ bulletin, historique, params }) {
    const memeAnnee = [...historique.filter((b) => b.annee === bulletin.annee), bulletin];
    const somme = arrondi(memeAnnee.reduce((s, b) => s + (brut(b) ?? 0), 0));
    const affiche = bulletin.cumuls!.brutAnnuel!;
    const ecart = arrondi(affiche - somme);
    if (Math.abs(ecart) <= Math.max(2, somme * 0.005)) return [];

    return [
      finaliser(
        {
          code: 'HIS-04',
          controle: this.nom,
          titre: 'Le cumul annuel ne correspond pas à la somme de vos bulletins',
          severite: 'mineure',
          categorie: 'historique',
          confiance: 'probable',
          explication:
            `Le bulletin affiche un cumul brut annuel de ${euros(affiche)}, alors que la somme des ` +
            `${memeAnnee.length} bulletins importés de ${bulletin.annee} donne ${euros(somme)}. ` +
            'Le cumul sert de base à votre déclaration fiscale et à vos droits sociaux.',
          detail: `Écart de ${euros(ecart)} sur ${memeAnnee.length} bulletins.`,
          attendu: somme,
          constate: affiche,
          ecart,
          references: [{ texte: 'Article R.3243-1 du Code du travail' }],
          actions: [
            'Vérifiez qu’aucun bulletin de l’année ne manque à votre import.',
            'Un rappel ou une régularisation d’un mois antérieur peut expliquer l’écart.',
          ],
        },
        params,
      ),
    ];
  },
};

function moisLisible(b: Bulletin): string {
  const mois = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  return `${mois[b.mois - 1]} ${b.annee}`;
}

export const CONTROLES_HISTORIQUE: Controle[] = [
  controleVariationBrut,
  controleLignesDisparues,
  controleChangementTaux,
  controleCumulAnnuel,
];

export type { Anomalie };
