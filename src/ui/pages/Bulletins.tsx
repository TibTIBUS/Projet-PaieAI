import { Link, useNavigate } from 'react-router-dom';
import { Trash2, FileText, Download } from 'lucide-react';
import { ZoneDepot } from '@/ui/components/ZoneDepot';
import { Alerte, TitreSection, Vide } from '@/ui/components/primitives';
import { LIMITE_GRATUITE, usePaieAI } from '@/lib/storage';
import { analyserDossier } from '@/domain/engine';
import { euros, moisAnnee } from '@/lib/format';
import { exporterJson, telecharger } from '@/lib/export';

export function Bulletins() {
  const naviguer = useNavigate();
  const bulletins = usePaieAI((e) => e.bulletins);
  const options = usePaieAI((e) => e.options);
  const surcharges = usePaieAI((e) => e.surcharges);
  const plan = usePaieAI((e) => e.plan);
  const supprimer = usePaieAI((e) => e.supprimerBulletin);

  const synthese = analyserDossier(bulletins, options, surcharges);
  const auDela = plan === 'gratuit' && bulletins.length > LIMITE_GRATUITE;

  return (
    <div className="space-y-8">
      <TitreSection
        titre="Mes bulletins"
        sousTitre="Importez plusieurs mois : les contrôles de cohérence dans la durée s’activent à partir du deuxième bulletin."
        action={
          bulletins.length > 0 ? (
            <button
              type="button"
              className="bouton-secondaire"
              onClick={() => telecharger(
                exporterJson(bulletins, synthese.resultats),
                'paieai-dossier.json',
              )}
            >
              <Download size={16} /> Exporter le dossier
            </button>
          ) : undefined
        }
      />

      <ZoneDepot surImport={(id) => naviguer(`/rapport/${id}`)} />

      {auDela && (
        <Alerte ton="attention" titre="Limite de la formule gratuite atteinte">
          La formule gratuite couvre {LIMITE_GRATUITE} bulletins. Les suivants sont conservés sur votre
          appareil, mais leur rapport détaillé n’est pas affiché.{' '}
          <Link to="/tarifs" className="lien font-medium">Voir les formules</Link>.
        </Alerte>
      )}

      {bulletins.length === 0 ? (
        <Vide titre="Aucun bulletin importé">
          Déposez un PDF ci-dessus, ou chargez un exemple depuis la{' '}
          <Link to="/" className="lien">page d’accueil</Link>.
        </Vide>
      ) : (
        <ul className="space-y-3">
          {[...bulletins].reverse().map((bulletin, indexInverse) => {
            const resultat = synthese.resultats.find((r) => r.bulletinId === bulletin.id);
            const rang = bulletins.length - 1 - indexInverse;
            const verrouille = plan === 'gratuit' && rang >= LIMITE_GRATUITE;

            return (
              <li key={bulletin.id} className="carte flex flex-wrap items-center gap-4 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100">
                  <FileText size={18} className="text-ink-mute" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold capitalize">
                    {moisAnnee(bulletin.annee, bulletin.mois)}
                  </p>
                  <p className="truncate text-sm text-ink-mute">{bulletin.nomFichier}</p>
                </div>

                {resultat && !verrouille && (
                  <div className="flex items-center gap-5 text-sm">
                    <div className="text-right">
                      <p className="tabulaire font-bold">{resultat.score}/100</p>
                      <p className="text-xs text-ink-mute">conformité</p>
                    </div>
                    <div className="text-right">
                      <p className={`tabulaire font-bold ${resultat.impactMensuelTotal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {euros(resultat.impactMensuelTotal)}
                      </p>
                      <p className="text-xs text-ink-mute">écart mensuel</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {verrouille ? (
                    <Link to="/tarifs" className="bouton-secondaire">Débloquer</Link>
                  ) : (
                    <Link to={`/rapport/${bulletin.id}`} className="bouton-principal">
                      Voir le rapport
                    </Link>
                  )}
                  <button
                    type="button"
                    className="bouton-discret !px-2"
                    aria-label={`Supprimer le bulletin de ${moisAnnee(bulletin.annee, bulletin.mois)}`}
                    onClick={() => supprimer(bulletin.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
