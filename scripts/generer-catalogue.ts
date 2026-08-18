/**
 * Génère `docs/CONTROLES.md` à partir du catalogue de contrôles.
 *
 * La documentation destinée à l'expert-comptable qui valide l'outil doit
 * décrire exactement ce que le code exécute. La produire depuis le code, plutôt
 * que de l'écrire à côté, supprime tout risque de divergence.
 *
 * Utilisation : npm run docs
 */
import { writeFileSync } from 'node:fs';
import { CONTROLES } from '../src/domain/engine';
import { PERIODES, DERNIERE_PERIODE_VERIFIEE } from '../src/domain/referentiel/data';

const LIBELLE_CATEGORIE: Record<string, string> = {
  arithmetique: 'Cohérence arithmétique',
  cotisations: 'Taux de cotisations',
  assiettes: 'Assiettes de cotisations',
  salaire_minimum: 'Salaire minimum',
  temps_travail: 'Temps de travail',
  conges: 'Congés et fin de contrat',
  fiscal: 'Fiscalité',
  avantages: 'Avantages et protection sociale',
  conformite: 'Conformité du bulletin',
  historique: 'Cohérence dans la durée',
};

const ORDRE = Object.keys(LIBELLE_CATEGORIE);

function catalogue(): string {
  const lignes: string[] = [];

  lignes.push('# Catalogue des contrôles');
  lignes.push('');
  lignes.push(
    '> Ce fichier est généré automatiquement par `npm run docs` à partir du code ' +
    'source (`src/domain/engine/controles/`). Ne le modifiez pas à la main : ' +
    'corrigez le contrôle, puis régénérez.',
  );
  lignes.push('');
  lignes.push(
    `PaieAI exécute **${CONTROLES.length} contrôles** sur chaque bulletin. Un contrôle qui ` +
    'a besoin d’une information absente du bulletin n’est pas exécuté : il est listé dans ' +
    'le rapport avec la raison de son écartement, plutôt que de produire un constat hasardeux.',
  );
  lignes.push('');

  lignes.push('## Sommaire');
  lignes.push('');
  for (const categorie of ORDRE) {
    const nombre = CONTROLES.filter((c) => c.categorie === categorie).length;
    if (!nombre) continue;
    const ancre = LIBELLE_CATEGORIE[categorie]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-');
    lignes.push(`- [${LIBELLE_CATEGORIE[categorie]}](#${ancre}) — ${nombre} contrôle(s)`);
  }
  lignes.push('');

  for (const categorie of ORDRE) {
    const controles = CONTROLES.filter((c) => c.categorie === categorie);
    if (!controles.length) continue;

    lignes.push(`## ${LIBELLE_CATEGORIE[categorie]}`);
    lignes.push('');
    for (const controle of controles) {
      lignes.push(`### \`${controle.code}\` — ${controle.nom}`);
      lignes.push('');
      lignes.push(controle.description);
      lignes.push('');
      if (controle.references.length) {
        lignes.push('**Fondement :**');
        lignes.push('');
        for (const reference of controle.references) {
          lignes.push(`- ${reference.url ? `[${reference.texte}](${reference.url})` : reference.texte}`);
        }
        lignes.push('');
      }
    }
  }

  lignes.push('## Référentiel légal utilisé');
  lignes.push('');
  lignes.push(
    `Les contrôles s’appuient sur ${PERIODES.length} périodes de paramètres, ` +
    `vérifiées jusqu’à la période **${DERNIERE_PERIODE_VERIFIEE}** incluse.`,
  );
  lignes.push('');
  lignes.push('| Période | Entrée en vigueur | SMIC horaire | Plafond mensuel SS | Fiabilité |');
  lignes.push('| --- | --- | ---: | ---: | --- |');
  for (const periode of PERIODES) {
    const fiabilite = periode.fiabilite === 'verifie'
      ? 'Vérifié'
      : periode.fiabilite === 'reconduit' ? 'Reconduit' : '**À confirmer**';
    lignes.push(
      `| ${periode.cle} | ${periode.debut} | ${periode.smicHoraire.toFixed(2)} € | ` +
      `${periode.plafondMensuelSS.toLocaleString('fr-FR')} € | ${fiabilite} |`,
    );
  }
  lignes.push('');
  lignes.push(
    'Voir [REFERENTIEL.md](REFERENTIEL.md) pour la procédure de mise à jour et les sources officielles.',
  );
  lignes.push('');

  return lignes.join('\n');
}

writeFileSync(new URL('../docs/CONTROLES.md', import.meta.url), catalogue(), 'utf-8');
console.log(`docs/CONTROLES.md régénéré — ${CONTROLES.length} contrôles.`);
