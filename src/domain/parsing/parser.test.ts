import { describe, expect, it } from 'vitest';
import { analyserLignes, detecterPeriode, interpreterColonnesCotisation } from './parser';
import { BULLETINS_DEMO } from '../fixtures/bulletins';

const conforme = BULLETINS_DEMO[0].texte.split('\n');

describe('detecterPeriode', () => {
  it('lit une période « du … au … »', () => {
    expect(detecterPeriode('Période du 01/07/2025 au 31/07/2025')).toEqual({ annee: 2025, mois: 7 });
  });
  it('lit un mois en toutes lettres', () => {
    expect(detecterPeriode('Bulletin de paie - Juillet 2025')).toEqual({ annee: 2025, mois: 7 });
  });
});

describe('interpreterColonnesCotisation', () => {
  it('sépare parts salariale et patronale sur cinq colonnes', () => {
    const c = interpreterColonnesCotisation([2000, 6.9, 138, 8.55, 171]);
    expect(c).toMatchObject({ base: 2000, tauxSalarial: 6.9, montantSalarial: 138, tauxPatronal: 8.55, montantPatronal: 171 });
  });
  it('reconnaît une ligne purement patronale grâce au barème', () => {
    const c = interpreterColonnesCotisation([2000, 7, 140], {
      code: 'MALADIE', libelle: '', assiette: 'TOTALITE', tauxSalarial: 0, tauxPatronal: 7, fiabilite: 'verifie',
    });
    expect(c.montantPatronal).toBe(140);
    expect(c.montantSalarial).toBeUndefined();
  });
});

describe('analyserLignes sur le bulletin conforme', () => {
  const b = analyserLignes(conforme, { nomFichier: 'demo.pdf' });

  it('identifie la période', () => {
    expect(b.annee).toBe(2025);
    expect(b.mois).toBe(7);
  });

  it('lit les totaux', () => {
    expect(b.totaux.brut).toBe(2000);
    expect(b.totaux.totalCotisationsSalariales).toBe(444.23);
    expect(b.totaux.netImposable).toBe(1638.48);
    expect(b.totaux.netSocial).toBe(1580.77);
    expect(b.totaux.netAPayer).toBe(1498.42);
    expect(b.totaux.prelevementSource).toBe(57.35);
    expect(b.totaux.tauxPrelevementSource).toBe(3.5);
    expect(b.totaux.coutTotalEmployeur).toBe(2707.52);
  });

  it('lit l’en-tête', () => {
    expect(b.employeur.siret).toBe('12345678900012');
    expect(b.employeur.idcc).toBe('1486');
    expect(b.employeur.effectif).toBe(8);
    expect(b.salarie.statutCadre).toBe(false);
    expect(b.contrat.type).toBe('CDI');
  });

  it('reconnaît les cotisations et leurs colonnes', () => {
    const vp = b.lignes.find((l) => l.code === 'VIEILLESSE_PLAFONNEE');
    expect(vp).toMatchObject({ base: 2000, tauxSalarial: 6.9, montantSalarial: 138, tauxPatronal: 8.55, montantPatronal: 171 });
    const csg = b.lignes.find((l) => l.code === 'CSG_DEDUCTIBLE');
    expect(csg).toMatchObject({ base: 1990, tauxSalarial: 6.8, montantSalarial: 135.32 });
  });

  it('ne confond pas le SIRET ni les compteurs de congés avec des montants', () => {
    expect(b.lignes.some((l) => (l.montant ?? 0) > 100000)).toBe(false);
    expect(b.lignes.some((l) => l.code === 'CONGES_PAYES_PRIS')).toBe(false);
    expect(b.conges?.soldeN).toBe(12.5);
  });

  it('atteint une bonne qualité d’extraction', () => {
    expect(b.qualiteExtraction).toBeGreaterThan(0.85);
  });
});

describe('analyserLignes sur le bulletin cadre', () => {
  const b = analyserLignes(BULLETINS_DEMO[2].texte.split('\n'));
  it('détecte le statut cadre et la tranche 2', () => {
    expect(b.salarie.statutCadre).toBe(true);
    expect(b.lignes.find((l) => l.code === 'RETRAITE_COMP_T2')?.base).toBe(2575);
    expect(b.lignes.find((l) => l.code === 'APEC')?.montantSalarial).toBe(1.56);
  });
});
