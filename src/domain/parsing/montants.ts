/** Utilitaires de lecture des nombres au format francais presents sur un bulletin. */

/** Nombre francais : `1 895,88`, `1.895,88`, `-12,50`, `12.50`. */
const REGEX_NOMBRE =
  /-?\d{1,3}(?:[   .]\d{3})*(?:[.,]\d{1,4})?|-?\d+(?:[.,]\d{1,4})?/g;

const ESPACES_INSECABLES = /[  ]/g;
const DIACRITIQUES = /[̀-ͯ]/g;

/**
 * Convertit un nombre ecrit a la francaise en `number`.
 * Retourne `null` si la chaine n'est pas un nombre exploitable.
 */
export function versNombre(texte: string): number | null {
  if (!texte) return null;
  let t = texte.trim().replace(ESPACES_INSECABLES, ' ');

  // Signe negatif suffixe, frequent sur les editions de paie : 120,50-
  let negatif = false;
  if (/-\s*$/.test(t)) {
    negatif = true;
    t = t.replace(/-\s*$/, '');
  }
  if (/^\(.*\)$/.test(t)) {
    negatif = true;
    t = t.slice(1, -1);
  }

  const virgule = t.lastIndexOf(',');
  const point = t.lastIndexOf('.');
  const separateurDecimal = Math.max(virgule, point);

  let normalise: string;
  if (separateurDecimal === -1) {
    normalise = t.replace(/[ .]/g, '');
  } else {
    const partieEntiere = t.slice(0, separateurDecimal).replace(/[ .,]/g, '');
    const partieDecimale = t.slice(separateurDecimal + 1).replace(/[^\d]/g, '');
    normalise = partieEntiere + '.' + partieDecimale;
  }

  const valeur = Number(normalise);
  if (!Number.isFinite(valeur)) return null;
  return negatif ? -valeur : valeur;
}

export interface NombreLocalise {
  valeur: number;
  brut: string;
  index: number;
}

/** Extrait tous les nombres d'une ligne, dans l'ordre, avec leur position. */
export function extraireNombres(ligne: string): NombreLocalise[] {
  const resultats: NombreLocalise[] = [];
  const source = ligne.replace(ESPACES_INSECABLES, ' ');
  REGEX_NOMBRE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REGEX_NOMBRE.exec(source)) !== null) {
    const brut = m[0];
    // Un nombre accole a un mot ou a d'autres chiffres (matricule, SIRET,
    // code analytique) n'est pas une colonne de montant.
    const precedent = source[m.index - 1];
    const suivantImmediat = source[m.index + brut.length];
    if (precedent && /[A-Za-z0-9]/.test(precedent)) continue;
    if (suivantImmediat && /[A-Za-z0-9]/.test(suivantImmediat)) continue;
    const valeur = versNombre(brut);
    if (valeur === null) continue;
    // Signe negatif suffixe (« 120,50- »), immediatement accole : un tiret
    // separe par une espace est un separateur de texte, pas un signe.
    const suivant = source.slice(m.index + brut.length, m.index + brut.length + 2);
    const negatif = /^-(?!\d)/.test(suivant);
    resultats.push({ valeur: negatif ? -valeur : valeur, brut, index: m.index });
  }
  return resultats;
}

/** Partie textuelle d'une ligne, avant le premier nombre. */
export function libelleDeLigne(ligne: string): string {
  const nombres = extraireNombres(ligne);
  const fin = nombres.length ? nombres[0].index : ligne.length;
  return ligne
    .slice(0, fin)
    .replace(/[\s.·•\-–—_|]+$/g, '')
    .trim();
}

/**
 * Decoupe une ligne en libelle et colonnes numeriques.
 *
 * Une colonne commence en debut de ligne ou apres au moins deux espaces : cette
 * regle evite de confondre un nombre appartenant au libelle (« Heures
 * supplementaires 25% ») avec la premiere colonne de valeurs. Si aucune colonne
 * ne se detache ainsi — texte extrait sans alignement — on retombe sur le
 * premier nombre rencontre.
 */
export function decouperLigne(ligne: string): { libelle: string; nombres: NombreLocalise[] } {
  const tous = extraireNombres(ligne);
  if (!tous.length) return { libelle: ligne.trim(), nombres: [] };

  const debutsDeColonne = tous.filter(
    (n) => n.index === 0 || /\s{2}$/.test(ligne.slice(0, n.index)),
  );
  const premiere = debutsDeColonne.length ? debutsDeColonne[0] : tous[0];
  const libelle = ligne
    .slice(0, premiere.index)
    .replace(/[\s.·•\-–—_|]+$/g, '')
    .trim();
  return { libelle, nombres: tous.filter((n) => n.index >= premiere.index) };
}

/** Arrondi comptable a deux decimales. */
export function arrondi(valeur: number, decimales = 2): number {
  const f = 10 ** decimales;
  return Math.round((valeur + Number.EPSILON) * f) / f;
}

/** Comparaison a la tolerance pres (arrondis de paie). */
export function proche(a: number, b: number, tolerance = 0.02): boolean {
  return Math.abs(a - b) <= tolerance;
}

/**
 * Comparaison relative : retient l'ecart le plus grand entre une tolerance
 * absolue et un pourcentage du montant, pour absorber les arrondis en cascade.
 */
export function procheRelatif(a: number, b: number, absolue = 0.02, relative = 0.001): boolean {
  const seuil = Math.max(absolue, Math.abs(b) * relative);
  return Math.abs(a - b) <= seuil;
}

/**
 * Normalisation legere : minuscules et suppression des accents, mais la
 * ponctuation est conservee. Indispensable pour rechercher des mentions
 * contenant des nombres decimaux (« 151,67 h ») dans le texte du bulletin.
 */
export function normaliserLeger(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(DIACRITIQUES, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalise une chaine pour comparaison : minuscules, sans accents ni ponctuation. */
export function normaliserTexte(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(DIACRITIQUES, '')
    .toLowerCase()
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9%+/.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
