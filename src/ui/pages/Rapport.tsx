import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Info } from 'lucide-react';
import { analyser } from '@/domain/engine';
import { parametresPour } from '@/domain/referentiel';
import { usePaieAI } from '@/lib/storage';
import { euros, moisAnnee, nombre } from '@/lib/format';
import { exporterRapportPdf, telecharger } from '@/lib/export';
import { CarteAnomalie } from '@/ui/components/CarteAnomalie';
import { Jauge, libelleScore } from '@/ui/components/Jauge';
import { Alerte, Carte, Statistique, TitreSection, Vide } from '@/ui/components/primitives';

export function Rapport() {
  const { id } = useParams();
  const bulletins = usePaieAI((e) => e.bulletins);
  const options = usePaieAI((e) => e.options);
  const surcharges = usePaieAI((e) => e.surcharges);

  const bulletin = bulletins.find((b) => b.id === id);

  const resultat = useMemo(
    () => (bulletin ? analyser({ bulletin, historique: bulletins, options, surcharges }) : null),
    [bulletin, bulletins, options, surcharges],
  );

  if (!bulletin || !resultat) {
    return (
      <Vide titre="Bulletin introuvable">
        Il a peut-être été supprimé.{' '}
        <Link to="/bulletins" className="lien">Revenir à la liste</Link>.
      </Vide>
    );
  }

  const params = parametresPour(bulletin.annee, bulletin.mois, surcharges);
  const actionnables = resultat.anomalies.filter((a) => a.severite !== 'info');
  const informations = resultat.anomalies.filter((a) => a.severite === 'info');

  return (
    <div className="space-y-8">
      <TitreSection
        titre={`Rapport — ${moisAnnee(bulletin.annee, bulletin.mois)}`}
        sousTitre={`${bulletin.nomFichier} · ${resultat.controlesExecutes} contrôles exécutés · lecture ${Math.round(bulletin.qualiteExtraction * 100)} %`}
        action={
          <button
            type="button"
            className="bouton-secondaire"
            onClick={() => {
              void exporterRapportPdf(bulletin, resultat).then((pdf) => telecharger(
                pdf,
                `rapport-paie-${bulletin.annee}-${String(bulletin.mois).padStart(2, '0')}.pdf`,
              ));
            }}
          >
            <Download size={16} /> Télécharger le rapport
          </button>
        }
      />

      {!resultat.referentielFiable && (
        <Alerte ton="attention" titre="Paramètres légaux non vérifiés pour cette période">
          {params.avertissement ??
            'Les valeurs légales de cette période n’ont pas été confirmées à la source.'}{' '}
          <Link to="/parametres" className="lien font-medium">Mettre à jour les paramètres</Link>.
        </Alerte>
      )}

      <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
        <Carte className="flex flex-col items-center justify-center gap-3 p-6">
          <Jauge score={resultat.score} />
          <p className="text-sm font-semibold">{libelleScore(resultat.score)}</p>
        </Carte>

        <div className="grid gap-4 sm:grid-cols-2">
          <Statistique
            libelle="Écart mensuel en votre faveur"
            valeur={euros(resultat.impactMensuelTotal)}
            accent={resultat.impactMensuelTotal > 0 ? 'negatif' : 'positif'}
            aide={
              resultat.impactMensuelTotal > 0
                ? 'Somme des écarts chiffrés, en votre défaveur ce mois-ci.'
                : 'Aucun écart chiffrable détecté sur ce bulletin.'
            }
          />
          <Statistique
            libelle="Rappel mobilisable sur trois ans"
            valeur={euros(resultat.rappelPotentielTotal)}
            aide="Si les mêmes écarts se répètent depuis trois ans, durée de prescription des salaires."
          />
          <Statistique
            libelle="Anomalies à traiter"
            valeur={nombre(actionnables.length, 0)}
            aide={`${resultat.anomalies.filter((a) => a.severite === 'critique').length} critique(s), ${resultat.anomalies.filter((a) => a.severite === 'majeure').length} majeure(s).`}
          />
          <Statistique
            libelle="Brut du mois"
            valeur={bulletin.totaux.brut !== undefined ? euros(bulletin.totaux.brut) : '—'}
            aide={
              bulletin.totaux.netAPayer !== undefined
                ? `Net à payer : ${euros(bulletin.totaux.netAPayer)}`
                : 'Net à payer non lu sur le bulletin.'
            }
          />
        </div>
      </div>

      <section>
        <TitreSection
          titre={actionnables.length ? `${actionnables.length} point(s) à traiter` : 'Aucune anomalie à traiter'}
          sousTitre={
            actionnables.length
              ? 'Classés par gravité, puis par montant. Chaque constat cite le texte applicable.'
              : 'Les contrôles exécutés n’ont rien relevé qui appelle une action de votre part.'
          }
        />
        {actionnables.length ? (
          <div className="space-y-4">
            {actionnables.map((a) => <CarteAnomalie key={`${a.code}-${a.titre}`} anomalie={a} />)}
          </div>
        ) : (
          <Alerte ton="succes">
            Sur les {resultat.controlesExecutes} contrôles applicables à ce bulletin, aucun n’a relevé
            d’écart nécessitant une démarche. Importez d’autres mois pour activer les contrôles
            de cohérence dans la durée.
          </Alerte>
        )}
      </section>

      {informations.length > 0 && (
        <section>
          <TitreSection titre="Pour information" sousTitre="Constats sans action requise de votre part." />
          <div className="space-y-4">
            {informations.map((a) => <CarteAnomalie key={`${a.code}-${a.titre}`} anomalie={a} />)}
          </div>
        </section>
      )}

      {resultat.controlesNonExecutes.length > 0 && (
        <Carte className="p-5">
          <h3 className="mb-1 flex items-center gap-2 font-semibold">
            <Info size={17} className="text-ink-mute" />
            {resultat.controlesNonExecutes.length} contrôle(s) non exécuté(s)
          </h3>
          <p className="mb-4 text-sm text-ink-mute">
            Ces contrôles ont besoin d’une information absente du bulletin. Renseignez-la dans les{' '}
            <Link to="/parametres" className="lien">paramètres</Link> pour les activer.
          </p>
          <ul className="space-y-1.5 text-sm text-ink-soft">
            {resultat.controlesNonExecutes.map((c) => (
              <li key={c.code} className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-ink-mute">{c.code}</span>
                <span>{c.raison}</span>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      <Carte className="p-5">
        <h3 className="mb-3 font-semibold">Paramètres légaux appliqués à ce bulletin</h3>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ['Période de référence', params.cle],
            ['SMIC horaire', `${nombre(params.smicHoraire)} €`],
            ['SMIC mensuel (151,67 h)', euros(params.smicMensuel)],
            ['Plafond mensuel de la sécurité sociale', euros(params.plafondMensuelSS)],
            ['Plafond annuel', euros(params.plafondAnnuelSS)],
            ['Exonération titre-restaurant', euros(params.titreRestaurantExoMax)],
          ].map(([libelle, valeur]) => (
            <div key={libelle} className="flex justify-between gap-4 border-b border-slate-100 py-1.5">
              <dt className="text-ink-mute">{libelle}</dt>
              <dd className="tabulaire font-medium">{valeur}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-ink-mute">
          Sources : {params.sources.join(' · ')}
        </p>
      </Carte>
    </div>
  );
}
