const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function euros(valeur: number, decimales = 2): string {
  return valeur.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

export function nombre(valeur: number, decimales = 2): string {
  return valeur.toLocaleString('fr-FR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

export function pourcent(valeur: number): string {
  return `${nombre(valeur, valeur % 1 === 0 ? 0 : 2)} %`;
}

export function moisAnnee(annee: number, mois: number): string {
  return `${MOIS[mois - 1]} ${annee}`;
}

export function moisCourt(annee: number, mois: number): string {
  return `${MOIS[mois - 1].slice(0, 4)}. ${String(annee).slice(2)}`;
}

export function dateLisible(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Clé chronologique d'une période de paie, pour le tri. */
export function clePeriode(annee: number, mois: number): number {
  return annee * 12 + mois;
}
