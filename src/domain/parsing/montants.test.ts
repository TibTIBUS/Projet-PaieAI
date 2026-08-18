import { describe, expect, it } from 'vitest';
import { extraireNombres, libelleDeLigne, normaliserTexte, versNombre } from './montants';

describe('versNombre', () => {
  it('lit les formats français', () => {
    expect(versNombre('1 895,88')).toBe(1895.88);
    expect(versNombre('1.895,88')).toBe(1895.88);
    expect(versNombre('12,50')).toBe(12.5);
    expect(versNombre('3 925')).toBe(3925);
    expect(versNombre('0,024')).toBe(0.024);
  });
  it('gère les négatifs suffixés et parenthésés', () => {
    expect(versNombre('120,50-')).toBe(-120.5);
    expect(versNombre('(45,00)')).toBe(-45);
  });
  it('rejette le non numérique', () => {
    expect(versNombre('')).toBeNull();
    expect(versNombre('abc')).toBeNull();
  });
});

describe('extraireNombres', () => {
  it('isole les colonnes d’une ligne de cotisation', () => {
    const n = extraireNombres('Sécurité sociale plafonnée   3 925,00   6,90   270,83   8,55   335,59');
    expect(n.map((x) => x.valeur)).toEqual([3925, 6.9, 270.83, 8.55, 335.59]);
  });
  it('ignore les nombres collés à un mot', () => {
    const n = extraireNombres('Matricule A1234  Salaire 1 800,00');
    expect(n.map((x) => x.valeur)).toEqual([1800]);
  });
});

describe('libelleDeLigne', () => {
  it('coupe au premier nombre', () => {
    expect(libelleDeLigne('Salaire de base  151,67  12,50  1 895,88')).toBe('Salaire de base');
  });
});

describe('normaliserTexte', () => {
  it('supprime accents et casse', () => {
    expect(normaliserTexte("Sécurité sociale plafonnée")).toBe('securite sociale plafonnee');
  });
});
