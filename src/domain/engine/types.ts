import type { Anomalie, Bulletin, CategorieControle, ReferenceLegale } from '../types';
import type { ParametresPeriode } from '../referentiel';

/**
 * Compléments que l'utilisateur peut saisir : ces informations ne figurent pas
 * toujours sur le bulletin et conditionnent certains contrôles.
 */
export interface OptionsAnalyse {
  /** Effectif de l'entreprise, si absent du bulletin. */
  effectif?: number;
  /** Salaire minimum conventionnel mensuel applicable. */
  minimumConventionnel?: number;
  /** Durée contractuelle hebdomadaire, pour les temps partiels. */
  dureeHebdoContractuelle?: number;
  /** Coût mensuel de l'abonnement de transport public engagé par le salarié. */
  abonnementTransport?: number;
  /** Valeur faciale du titre-restaurant. */
  valeurTitreRestaurant?: number;
  /** Nombre de titres-restaurant du mois. */
  nombreTitresRestaurant?: number;
  /** L'entreprise est-elle en Alsace-Moselle ? */
  alsaceMoselle?: boolean;
  /** Taux de prélèvement à la source transmis par l'administration fiscale. */
  tauxPasAttendu?: number;
}

export interface ContexteControle {
  bulletin: Bulletin;
  params: ParametresPeriode;
  /** Bulletins antérieurs du même salarié, du plus ancien au plus récent. */
  historique: Bulletin[];
  options: OptionsAnalyse;
}

/** Raison pour laquelle un contrôle n'a pas pu être exécuté. */
export type NonApplicable = string;

export interface Controle {
  code: string;
  nom: string;
  categorie: CategorieControle;
  /** Ce que le contrôle vérifie, en une phrase. */
  description: string;
  references: ReferenceLegale[];
  /** Retourne une chaîne expliquant pourquoi le contrôle est écarté, ou null. */
  applicable?: (ctx: ContexteControle) => NonApplicable | null;
  executer: (ctx: ContexteControle) => Anomalie[];
}

export type { Anomalie, Bulletin, ParametresPeriode };
