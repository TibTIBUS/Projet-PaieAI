import { describe, expect, it } from 'vitest';
import { analyser, analyserDossier, CONTROLES } from './index';
import { analyserLignes } from '../parsing/parser';
import { BULLETINS_DEMO } from '../fixtures/bulletins';

function charger(cle: string) {
  const demo = BULLETINS_DEMO.find((b) => b.cle === cle)!;
  return analyserLignes(demo.texte.split('\n'), { nomFichier: `${cle}.pdf` });
}

describe('catalogue de contrôles', () => {
  it('expose des codes uniques', () => {
    const codes = CONTROLES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it('documente chaque contrôle', () => {
    for (const c of CONTROLES) {
      expect(c.nom.length).toBeGreaterThan(5);
      expect(c.description.length).toBeGreaterThan(20);
    }
  });
});

describe('bulletin conforme', () => {
  const resultat = analyser({ bulletin: charger('conforme') });

  it('ne remonte aucune anomalie critique ni majeure sur les calculs', () => {
    const graves = resultat.anomalies.filter(
      (a) => (a.severite === 'critique' || a.severite === 'majeure')
        && a.categorie !== 'conformite',
    );
    expect(graves.map((a) => `${a.code} ${a.titre}`)).toEqual([]);
  });

  it('n’annonce aucun rappel de salaire', () => {
    expect(resultat.impactMensuelTotal).toBe(0);
  });

  it('obtient un score élevé', () => {
    expect(resultat.score).toBeGreaterThanOrEqual(95);
  });

  it('ne remonte aucune mention obligatoire manquante', () => {
    const mentions = resultat.anomalies.filter((a) => a.categorie === 'conformite');
    expect(mentions.map((a) => a.titre)).toEqual([]);
  });

  it('exécute une majorité de contrôles', () => {
    expect(resultat.controlesExecutes).toBeGreaterThanOrEqual(10);
  });
});

describe('bulletin comportant des erreurs', () => {
  const resultat = analyser({ bulletin: charger('erreurs') });
  const codes = resultat.anomalies.map((a) => a.code);

  it('détecte le taux de vieillesse plafonnée majoré', () => {
    const a = resultat.anomalies.find((x) => x.code === 'COT-01' && /vieillesse|plafonn/i.test(x.titre));
    expect(a).toBeDefined();
    expect(a!.attendu).toBe(6.9);
    expect(a!.constate).toBe(7.9);
    // 1 point de trop sur une base de 1 952,04 €.
    expect(a!.impactMensuel).toBeCloseTo(19.52, 1);
  });

  it('détecte l’assiette de retraite complémentaire au-dessus du plafond', () => {
    expect(codes).toContain('ASS-01');
    const a = resultat.anomalies.find((x) => x.code === 'ASS-01')!;
    expect(a.constate).toBe(4100);
    expect(a.attendu).toBe(1952.04);
  });

  it('détecte la sous-majoration des heures supplémentaires', () => {
    const a = resultat.anomalies.find((x) => x.code === 'HRS-01');
    expect(a).toBeDefined();
    // 10 h payées 13,20 € au lieu de 12,00 € × 1,25 = 15,00 € → 18 € de manque.
    expect(a!.impactMensuel).toBeCloseTo(18, 1);
  });

  it('détecte la participation employeur insuffisante à la mutuelle', () => {
    const a = resultat.anomalies.find((x) => x.code === 'AVA-01');
    expect(a).toBeDefined();
    expect(a!.impactMensuel).toBeCloseTo(8, 1);
  });

  it('signale l’absence du montant net social', () => {
    expect(codes).toContain('CNF-01');
  });

  it('chiffre un rappel potentiel sur trois ans', () => {
    expect(resultat.impactMensuelTotal).toBeGreaterThan(40);
    expect(resultat.rappelPotentielTotal).toBeCloseTo(resultat.impactMensuelTotal * 36, 0);
  });

  it('dégrade le score', () => {
    expect(resultat.score).toBeLessThan(70);
  });
});

describe('bulletin cadre', () => {
  const resultat = analyser({ bulletin: charger('cadre') });

  it('accepte les taux majorés au-delà des seuils de rémunération', () => {
    const tauxMajores = resultat.anomalies.filter(
      (a) => a.code.startsWith('COT-0') && /maladie|familiales/i.test(a.titre),
    );
    expect(tauxMajores).toEqual([]);
  });

  it('valide le découpage des tranches 1 et 2', () => {
    expect(resultat.anomalies.filter((a) => a.code === 'ASS-02')).toEqual([]);
  });

  it('n’émet pas d’alerte APEC ni CET indues', () => {
    expect(resultat.anomalies.filter((a) => a.code.startsWith('COT-04'))).toEqual([]);
  });
});

describe('analyse d’un dossier', () => {
  it('agrège plusieurs bulletins et repère les récurrences', () => {
    const bulletins = [charger('conforme'), charger('erreurs')];
    const synthese = analyserDossier(bulletins);
    expect(synthese.resultats).toHaveLength(2);
    expect(synthese.scoreMoyen).toBeGreaterThan(0);
    expect(synthese.impactCumule).toBeGreaterThan(0);
  });
});
