import type Anthropic from '@anthropic-ai/sdk';
import type { Bulletin, ResultatAnalyse } from '@/domain/types';
import type { OptionsAnalyse } from '@/domain/engine';
import { euros, moisAnnee } from './format';

/**
 * Assistant conversationnel.
 *
 * Principe de conception : l'IA n'invente rien. Le moteur de calcul
 * déterministe (src/domain/engine) reste la seule source des montants, des
 * taux et des articles de loi cités. L'IA reçoit ces résultats déjà calculés
 * et se limite à les expliquer en langage courant et à répondre aux
 * questions — un rôle de traduction, pas de calcul.
 *
 * Fonctionnement « apportez votre clé » (BYOK) : chaque personne colle sa
 * propre clé API Anthropic, conservée uniquement dans son navigateur. Aucune
 * clé partagée ne transite par un serveur à nous : c'est le seul modèle
 * compatible avec une application 100 % statique, sans backend.
 *
 * Conséquence assumée : quand l'assistant est utilisé, le contenu de la fiche
 * de paie (sous forme résumée) est envoyé à l'API d'Anthropic. C'est
 * strictement volontaire — rien ne part tant qu'aucune clé n'est renseignée.
 */

export const MODELE_IA = 'claude-opus-5';

export interface MessageChat {
  id: string;
  role: 'user' | 'assistant';
  texte: string;
  horodatage: string;
}

export interface ContexteAssistant {
  bulletin: Bulletin;
  resultat: ResultatAnalyse;
  options: OptionsAnalyse;
}

/**
 * Outil que l'assistant peut appeler pour mémoriser une information donnée
 * en langage naturel par l'utilisateur, plutôt que de la lui faire ressaisir
 * dans un formulaire. C'est le principal levier de simplification : au lieu
 * de huit champs numériques à remplir d'emblée, l'utilisateur les donne au
 * fil de la conversation, seulement quand ils sont utiles.
 */
const OUTIL_ENREGISTRER_INFO: Anthropic.Tool = {
  name: 'enregistrer_information',
  description:
    'Enregistre une information que l’utilisateur vient de donner sur sa situation. ' +
    'N’appelle cet outil que lorsque l’utilisateur communique explicitement l’une de ces ' +
    'informations dans son message — ne l’appelle jamais pour une valeur que tu déduis ou suppose.',
  input_schema: {
    type: 'object',
    properties: {
      effectif: {
        type: 'number',
        description: 'Nombre de salariés de l’entreprise.',
      },
      minimumConventionnel: {
        type: 'number',
        description: 'Salaire minimum mensuel brut prévu par la convention collective, en euros.',
      },
      dureeHebdoContractuelle: {
        type: 'number',
        description: 'Durée de travail hebdomadaire prévue au contrat, en heures (temps partiel).',
      },
      abonnementTransport: {
        type: 'number',
        description: 'Coût mensuel de l’abonnement de transport public, en euros.',
      },
      valeurTitreRestaurant: {
        type: 'number',
        description: 'Valeur faciale d’un titre-restaurant, en euros.',
      },
      nombreTitresRestaurant: {
        type: 'number',
        description: 'Nombre de titres-restaurant attribués sur le mois.',
      },
      alsaceMoselle: {
        type: 'boolean',
        description: 'L’entreprise est-elle en Alsace-Moselle (Bas-Rhin, Haut-Rhin, Moselle) ?',
      },
      tauxPasAttendu: {
        type: 'number',
        description: 'Taux de prélèvement à la source personnalisé, en pourcentage, communiqué par impots.gouv.fr.',
      },
    },
    additionalProperties: false,
  },
};

function construireSystemPrompt(ctx: ContexteAssistant): string {
  const { bulletin, resultat, options } = ctx;

  const anomalies = resultat.anomalies.map((a) => ({
    titre: a.titre,
    severite: a.severite,
    confiance: a.confiance,
    explication: a.explication,
    detail: a.detail,
    impactMensuel: a.impactMensuel,
    rappelPotentiel: a.rappelPotentiel,
    references: a.references.map((r) => r.texte),
    actions: a.actions,
  }));

  return `Tu es l'assistant de PaieAI, une application qui vérifie les fiches de paie françaises.

Un moteur de calcul déterministe — pas toi — a déjà analysé cette fiche de paie et produit
les résultats ci-dessous. Ton seul rôle est d'expliquer ces résultats en langage simple et
chaleureux, et de répondre aux questions de l'utilisateur à leur sujet.

Règles impératives :
- N'invente jamais un taux, un montant ou un article de loi absent des données ci-dessous.
  Si la question dépasse ces données, dis-le simplement et propose de vérifier auprès d'un
  professionnel de la paie plutôt que de deviner.
- Phrases courtes, vocabulaire courant, aucun jargon sans l'expliquer aussitôt. Vouvoyez
  l'utilisateur.
- Pour toute anomalie « majeure » ou « critique », rappelle qu'il vaut mieux faire confirmer
  le constat avant d'engager une démarche auprès de l'employeur.
- Quand l'utilisateur donne une information sur sa situation (effectif de l'entreprise,
  minimum conventionnel, durée de travail, abonnement transport, titres-restaurant,
  Alsace-Moselle, taux de prélèvement à la source), appelle l'outil enregistrer_information
  pour la mémoriser plutôt que de simplement la répéter dans ta réponse.
- Reste bref : quelques phrases suffisent la plupart du temps.

Bulletin analysé : ${moisAnnee(bulletin.annee, bulletin.mois)}
- Brut : ${bulletin.totaux.brut !== undefined ? euros(bulletin.totaux.brut) : 'non lu sur le bulletin'}
- Net à payer : ${bulletin.totaux.netAPayer !== undefined ? euros(bulletin.totaux.netAPayer) : 'non lu sur le bulletin'}
- Score de conformité : ${resultat.score}/100
- Écart mensuel détecté en faveur du salarié : ${euros(resultat.impactMensuelTotal)}
- Rappel mobilisable sur 3 ans (prescription des salaires) : ${euros(resultat.rappelPotentielTotal)}
- Référentiel légal de cette période fiable : ${resultat.referentielFiable ? 'oui' : 'non, à confirmer'}

Anomalies détectées (${anomalies.length}) :
${JSON.stringify(anomalies, null, 2)}

Informations déjà connues sur la situation de l'utilisateur :
${JSON.stringify(options, null, 2)}`;
}

export class ErreurAssistant extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'ErreurAssistant';
  }
}

/**
 * Envoie un message à l'assistant et retourne sa réponse.
 *
 * `surMiseAJourInfos` est appelé pour chaque information que l'assistant
 * décide de mémoriser au fil de la conversation.
 */
export async function demanderAssistant(
  cleApi: string,
  ctx: ContexteAssistant,
  historique: MessageChat[],
  nouveauMessage: string,
  surMiseAJourInfos: (infos: Partial<OptionsAnalyse>) => void,
): Promise<string> {
  // Chargé à la demande : le SDK ne doit peser sur le chargement de l'application
  // que pour les personnes qui utilisent réellement l'assistant.
  const {
    default: AnthropicClient, AuthenticationError, PermissionDeniedError,
    RateLimitError, APIConnectionError, APIError,
  } = await import('@anthropic-ai/sdk');

  const client = new AnthropicClient({ apiKey: cleApi, dangerouslyAllowBrowser: true });
  const system = construireSystemPrompt(ctx);
  const tools = [OUTIL_ENREGISTRER_INFO];

  const messages: Anthropic.MessageParam[] = historique.map((m) => ({
    role: m.role,
    content: m.texte,
  }));
  messages.push({ role: 'user', content: nouveauMessage });

  try {
    let reponse = await client.messages.create({
      model: MODELE_IA,
      max_tokens: 1500,
      system,
      tools,
      messages,
    });

    // L'assistant peut mémoriser plusieurs informations avant de répondre :
    // on applique chaque appel d'outil, puis on relance une seule fois pour
    // obtenir le texte final. Une boucle plus longue n'est pas nécessaire ici,
    // l'assistant n'ayant qu'un seul outil, sans enchaînement possible.
    const appelsOutil = reponse.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (appelsOutil.length > 0) {
      for (const appel of appelsOutil) {
        surMiseAJourInfos(appel.input as Partial<OptionsAnalyse>);
      }

      messages.push({ role: 'assistant', content: reponse.content });
      messages.push({
        role: 'user',
        content: appelsOutil.map((a) => ({
          type: 'tool_result' as const,
          tool_use_id: a.id,
          content: 'Information enregistrée.',
        })),
      });

      reponse = await client.messages.create({
        model: MODELE_IA,
        max_tokens: 1500,
        system,
        tools,
        messages,
      });
    }

    const texte = reponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n\n')
      .trim();

    return texte || 'C’est noté. Avez-vous une autre question sur ce bulletin ?';
  } catch (erreur) {
    if (erreur instanceof AuthenticationError) {
      throw new ErreurAssistant('Cette clé API ne semble pas valide. Vérifiez qu’elle est correctement copiée.', erreur);
    }
    if (erreur instanceof PermissionDeniedError) {
      throw new ErreurAssistant('Cette clé n’a pas accès au modèle demandé.', erreur);
    }
    if (erreur instanceof RateLimitError) {
      throw new ErreurAssistant('Trop de questions en peu de temps. Réessayez dans un instant.', erreur);
    }
    if (erreur instanceof APIConnectionError) {
      throw new ErreurAssistant('Impossible de joindre le service. Vérifiez votre connexion internet.', erreur);
    }
    if (erreur instanceof APIError) {
      throw new ErreurAssistant(`Le service a renvoyé une erreur (${erreur.status}). Réessayez dans un instant.`, erreur);
    }
    throw new ErreurAssistant('Une erreur inattendue est survenue.', erreur);
  }
}

/** Vérifie sommairement le format d'une clé API Anthropic avant de l'enregistrer. */
export function cleApiPlausible(cle: string): boolean {
  return /^sk-ant-/.test(cle.trim());
}
