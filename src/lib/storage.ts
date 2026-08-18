import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bulletin } from '@/domain/types';
import type { SurchargesReferentiel } from '@/domain/referentiel';
import type { OptionsAnalyse } from '@/domain/engine';

/**
 * État de l'application.
 *
 * Tout est conservé dans le navigateur : aucun bulletin n'est transmis à un
 * serveur. C'est un choix de conception, pas une limitation — un bulletin de
 * paie est une donnée personnelle sensible, et ne pas la collecter est la
 * meilleure garantie que l'on puisse offrir.
 */

export type Plan = 'gratuit' | 'pro';

/** Nombre de bulletins analysables sans abonnement. */
export const LIMITE_GRATUITE = 3;

export interface EtatPaieAI {
  bulletins: Bulletin[];
  options: OptionsAnalyse;
  surcharges: SurchargesReferentiel;
  plan: Plan;
  /** Clé d'abonnement saisie par l'utilisateur. */
  cleAbonnement?: string;
  /** L'utilisateur a-t-il pris connaissance de l'avertissement d'usage ? */
  avertissementLu: boolean;

  ajouterBulletin: (bulletin: Bulletin) => void;
  remplacerBulletin: (bulletin: Bulletin) => void;
  supprimerBulletin: (id: string) => void;
  viderBulletins: () => void;
  definirOptions: (options: Partial<OptionsAnalyse>) => void;
  definirSurcharges: (surcharges: SurchargesReferentiel) => void;
  definirPlan: (plan: Plan, cle?: string) => void;
  marquerAvertissementLu: () => void;
}

/** Le texte brut n'est conservé que pour le contrôle des mentions obligatoires. */
const TAILLE_MAX_TEXTE = 40_000;

function alleger(bulletin: Bulletin): Bulletin {
  if (bulletin.texteBrut.length <= TAILLE_MAX_TEXTE) return bulletin;
  return { ...bulletin, texteBrut: bulletin.texteBrut.slice(0, TAILLE_MAX_TEXTE) };
}

export const usePaieAI = create<EtatPaieAI>()(
  persist(
    (set) => ({
      bulletins: [],
      options: {},
      surcharges: {},
      plan: 'gratuit',
      avertissementLu: false,

      ajouterBulletin: (bulletin) =>
        set((etat) => {
          const doublon = etat.bulletins.find(
            (b) => b.annee === bulletin.annee && b.mois === bulletin.mois
              && b.nomFichier === bulletin.nomFichier,
          );
          const bulletins = doublon
            ? etat.bulletins.map((b) => (b.id === doublon.id ? alleger(bulletin) : b))
            : [...etat.bulletins, alleger(bulletin)];
          return { bulletins: trier(bulletins) };
        }),

      remplacerBulletin: (bulletin) =>
        set((etat) => ({
          bulletins: trier(
            etat.bulletins.map((b) => (b.id === bulletin.id ? alleger(bulletin) : b)),
          ),
        })),

      supprimerBulletin: (id) =>
        set((etat) => ({ bulletins: etat.bulletins.filter((b) => b.id !== id) })),

      viderBulletins: () => set({ bulletins: [] }),

      definirOptions: (options) =>
        set((etat) => ({ options: { ...etat.options, ...options } })),

      definirSurcharges: (surcharges) => set({ surcharges }),

      definirPlan: (plan, cleAbonnement) => set({ plan, cleAbonnement }),

      marquerAvertissementLu: () => set({ avertissementLu: true }),
    }),
    {
      name: 'paieai-v1',
      version: 1,
      partialize: (etat) => ({
        bulletins: etat.bulletins,
        options: etat.options,
        surcharges: etat.surcharges,
        plan: etat.plan,
        cleAbonnement: etat.cleAbonnement,
        avertissementLu: etat.avertissementLu,
      }),
    },
  ),
);

function trier(bulletins: Bulletin[]): Bulletin[] {
  return [...bulletins].sort((a, b) => a.annee * 12 + a.mois - (b.annee * 12 + b.mois));
}

/** Efface toutes les données locales. */
export function effacerToutesLesDonnees() {
  window.localStorage.removeItem('paieai-v1');
  window.location.reload();
}
