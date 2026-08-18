import type { Anomalie } from '../../types';
import { normaliserLeger } from '../../parsing/montants';
import type { Controle } from '../types';
import { finaliser, REF_MENTIONS_BULLETIN } from '../utils';

/**
 * Contrôle des mentions obligatoires du bulletin de paie.
 * Une mention manquante n'a pas d'impact financier direct, mais elle constitue
 * un manquement opposable à l'employeur et prive le salarié d'informations
 * nécessaires au contrôle de sa paie.
 */

interface MentionObligatoire {
  code: string;
  titre: string;
  motifs: RegExp[];
  /** Date à partir de laquelle la mention est obligatoire (ISO). */
  obligatoireDepuis?: string;
  explication: string;
  reference: string;
  severite: 'majeure' | 'mineure' | 'info';
}

const MENTIONS: MentionObligatoire[] = [
  {
    code: 'CNF-01',
    titre: 'Montant net social',
    motifs: [/montant net social/, /net social/],
    obligatoireDepuis: '2023-07-01',
    explication:
      'Le « montant net social » est obligatoire sur tous les bulletins depuis le 1er juillet 2023. ' +
      'C’est le montant que vous devez déclarer à la CAF ou à la MSA pour la prime d’activité et le RSA. ' +
      'Son absence peut vous faire perdre des droits.',
    reference: 'Arrêté du 31 janvier 2023 modifiant le modèle de bulletin de paie',
    severite: 'majeure',
  },
  {
    code: 'CNF-02',
    titre: 'Convention collective applicable',
    motifs: [/convention collective/, /\bidcc\b/, /accord (de branche|d['’ ]entreprise|collectif)/],
    explication:
      'Le bulletin doit mentionner la convention collective applicable. Sans elle, vous ne pouvez pas vérifier ' +
      'votre salaire minimum conventionnel, vos primes d’ancienneté ni vos jours de congés supplémentaires.',
    reference: 'Article R.3243-1, 5° du Code du travail',
    severite: 'majeure',
  },
  {
    code: 'CNF-03',
    titre: 'Organisme de recouvrement des cotisations',
    motifs: [/urssaf/, /\bmsa\b/, /organisme de recouvrement/, /caisse (generale|de securite sociale)/],
    explication:
      'Le bulletin doit indiquer l’organisme auquel l’employeur verse vos cotisations, ainsi que son numéro ' +
      'de la nomenclature d’activités. Cette mention vous permet de vérifier que vos cotisations sont bien versées.',
    reference: 'Article R.3243-1, 2° du Code du travail',
    severite: 'mineure',
  },
  {
    code: 'CNF-04',
    titre: 'Total versé par l’employeur et allègements',
    motifs: [/total verse par l['’ ]?employeur/, /cout (total|global)/, /allegement/, /exoneration de cotisation/],
    explication:
      'Le bulletin doit faire apparaître le montant total versé par l’employeur, c’est-à-dire la somme de votre ' +
      'rémunération et des cotisations patronales, ainsi que le montant des allègements de cotisations dont il bénéficie.',
    reference: 'Article R.3243-1, 10° du Code du travail',
    severite: 'mineure',
  },
  {
    code: 'CNF-05',
    titre: 'Mention de conservation sans limitation de durée',
    motifs: [/sans limitation de duree/, /conserver.*(sans limite|illimite)/, /duree illimitee/],
    explication:
      'Le bulletin doit rappeler qu’il faut le conserver sans limitation de durée. C’est la seule preuve ' +
      'de votre carrière en cas de litige avec la caisse de retraite.',
    reference: 'Article R.3243-1, 12° du Code du travail',
    severite: 'info',
  },
  {
    code: 'CNF-06',
    titre: 'Position dans la classification conventionnelle',
    motifs: [/coefficient/, /\bniveau\b/, /\bechelon\b/, /position\b/, /classification/, /qualification/],
    explication:
      'Le bulletin doit préciser votre position dans la classification de la convention collective : ' +
      'niveau, coefficient ou échelon. C’est ce qui détermine votre salaire minimum conventionnel.',
    reference: 'Article R.3243-1, 4° du Code du travail',
    severite: 'majeure',
  },
  {
    code: 'CNF-07',
    titre: 'Nombre d’heures de travail',
    motifs: [/\d+[.,]\d{1,2}\s*(h|heures)/, /151[.,]67/, /nombre d heures/, /base horaire/],
    explication:
      'Le bulletin doit indiquer le nombre d’heures de travail auquel se rapporte le salaire, en distinguant ' +
      'les heures payées au taux normal de celles majorées.',
    reference: 'Article R.3243-1, 7° du Code du travail',
    severite: 'majeure',
  },
  {
    code: 'CNF-08',
    titre: 'Dates de congés payés et montant de l’indemnité',
    motifs: [/conges? paye/, /\bcp\b/, /solde de conges/, /droits a conges/],
    explication:
      'Lorsque des congés sont pris au cours de la période, le bulletin doit mentionner leurs dates et le montant ' +
      'de l’indemnité correspondante.',
    reference: 'Article R.3243-1, 9° du Code du travail',
    severite: 'mineure',
  },
];

export const controleMentionsObligatoires: Controle = {
  code: 'CNF',
  nom: 'Mentions obligatoires du bulletin de paie',
  categorie: 'conformite',
  description:
    'Vérifie la présence des mentions que le Code du travail impose de faire figurer sur le bulletin de paie.',
  references: [
    REF_MENTIONS_BULLETIN,
    { texte: 'Arrêté du 31 janvier 2023 modifiant le modèle de bulletin de paie' },
  ],
  applicable: ({ bulletin }) =>
    bulletin.source === 'manuel'
      ? 'Bulletin saisi manuellement : le texte d’origine n’est pas disponible pour vérifier les mentions.'
      : bulletin.texteBrut.length < 200
        ? 'Le texte extrait est trop court pour vérifier les mentions obligatoires.'
        : null,
  executer({ bulletin, params }) {
    const anomalies: Anomalie[] = [];
    const texte = normaliserLeger(bulletin.texteBrut);
    const dateBulletin = `${bulletin.annee}-${String(bulletin.mois).padStart(2, '0')}-01`;

    for (const mention of MENTIONS) {
      if (mention.obligatoireDepuis && dateBulletin < mention.obligatoireDepuis) continue;
      if (mention.motifs.some((m) => m.test(texte))) continue;

      anomalies.push(
        finaliser(
          {
            code: mention.code,
            controle: this.nom,
            titre: `Mention obligatoire absente : ${mention.titre}`,
            severite: mention.severite,
            categorie: 'conformite',
            confiance: 'probable',
            explication: mention.explication,
            detail:
              `Aucune occurrence de cette mention n’a été trouvée dans le texte extrait du bulletin. ` +
              'Si le bulletin est un scan de mauvaise qualité, vérifiez visuellement avant de conclure.',
            references: [{ texte: mention.reference }, REF_MENTIONS_BULLETIN],
            actions: [
              'Vérifiez visuellement la présence de la mention sur le bulletin.',
              'Si elle est réellement absente, demandez par écrit un bulletin conforme.',
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
/* CNF-09 — qualité de l'extraction                                    */
/* ------------------------------------------------------------------ */

export const controleQualiteExtraction: Controle = {
  code: 'CNF-09',
  nom: 'Fiabilité de la lecture du bulletin',
  categorie: 'conformite',
  description:
    'Signale une extraction incomplète, qui rendrait les autres contrôles peu fiables.',
  references: [],
  executer({ bulletin, params }) {
    if (bulletin.qualiteExtraction >= 0.7 && bulletin.champsManquants.length === 0) return [];

    return [
      finaliser(
        {
          code: 'CNF-09',
          controle: this.nom,
          titre: 'Lecture partielle du bulletin',
          severite: bulletin.qualiteExtraction < 0.4 ? 'majeure' : 'info',
          categorie: 'conformite',
          confiance: 'certaine',
          explication:
            `L’analyse n’a pu lire qu’une partie du bulletin (${Math.round(bulletin.qualiteExtraction * 100)} % ` +
            'des éléments attendus). Les contrôles qui dépendent des éléments manquants ont été écartés. ' +
            'Complétez-les à la main pour obtenir un rapport complet.',
          detail:
            bulletin.champsManquants.length
              ? `Éléments non lus : ${bulletin.champsManquants.join(', ')}.`
              : 'Aucun champ critique manquant, mais peu de lignes ont été reconnues.',
          constate: bulletin.qualiteExtraction,
          references: [],
          actions: [
            'Complétez les montants manquants dans l’écran de vérification.',
            'Si le PDF est un scan, la reconnaissance optique donne de meilleurs résultats à partir d’une image nette.',
          ],
        },
        params,
      ),
    ];
  },
};

export const CONTROLES_CONFORMITE: Controle[] = [
  controleMentionsObligatoires,
  controleQualiteExtraction,
];
