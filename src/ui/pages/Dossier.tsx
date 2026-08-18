import { Link } from 'react-router-dom';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { analyserDossier } from '@/domain/engine';
import { usePaieAI } from '@/lib/storage';
import { euros, moisCourt, nombre } from '@/lib/format';
import { Alerte, Carte, Statistique, TitreSection, Vide } from '@/ui/components/primitives';

export function Dossier() {
  const bulletins = usePaieAI((e) => e.bulletins);
  const options = usePaieAI((e) => e.options);
  const surcharges = usePaieAI((e) => e.surcharges);

  if (bulletins.length === 0) {
    return (
      <Vide titre="Aucun bulletin à suivre">
        Le suivi compare vos bulletins mois après mois.{' '}
        <Link to="/bulletins" className="lien">Importez-en au moins deux</Link> pour l’activer.
      </Vide>
    );
  }

  const synthese = analyserDossier(bulletins, options, surcharges);

  const donnees = synthese.resultats.map((r) => {
    const bulletin = bulletins.find((b) => b.id === r.bulletinId)!;
    return {
      periode: moisCourt(r.annee, r.mois),
      brut: bulletin.totaux.brut ?? 0,
      net: bulletin.totaux.netAPayer ?? 0,
      score: r.score,
      ecart: r.impactMensuelTotal,
    };
  });

  return (
    <div className="space-y-8">
      <TitreSection
        titre="Suivi de vos bulletins"
        sousTitre={`${bulletins.length} bulletin(s) analysés. Les erreurs récurrentes sont celles qui coûtent le plus cher.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Statistique
          libelle="Score moyen"
          valeur={`${synthese.scoreMoyen}/100`}
          aide="Moyenne sur l’ensemble des bulletins importés."
        />
        <Statistique
          libelle="Écarts cumulés"
          valeur={euros(synthese.impactCumule)}
          accent={synthese.impactCumule > 0 ? 'negatif' : 'positif'}
          aide="Somme des écarts constatés sur les mois importés."
        />
        <Statistique
          libelle="Rappel mobilisable"
          valeur={euros(synthese.rappelPotentiel)}
          aide="Projection du dernier mois sur trois ans de prescription."
        />
        <Statistique
          libelle="Erreurs récurrentes"
          valeur={nombre(synthese.anomaliesRecurrentes.length, 0)}
          aide="Anomalies présentes sur au moins trois bulletins."
        />
      </div>

      {synthese.anomaliesRecurrentes.length > 0 && (
        <Alerte ton="attention" titre="Des erreurs se répètent d’un mois sur l’autre">
          <p className="mb-3">
            Une erreur systématique est celle qui produit les rappels les plus élevés :
            elle se poursuit tant qu’elle n’est pas signalée.
          </p>
          <ul className="space-y-1.5">
            {synthese.anomaliesRecurrentes.map((a) => (
              <li key={a.code} className="flex flex-wrap justify-between gap-2">
                <span>{a.titre} <span className="text-xs">({a.occurrences} bulletins)</span></span>
                <span className="tabulaire font-semibold">{euros(a.impactCumule)} cumulés</span>
              </li>
            ))}
          </ul>
        </Alerte>
      )}

      <Carte className="p-5">
        <h3 className="mb-4 font-semibold">Évolution du brut et du net</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={donnees} margin={{ top: 5, right: 8, bottom: 5, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="periode" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={false} axisLine={false} width={62}
                tickFormatter={(v: number) => `${Math.round(v)} €`}
              />
              <Tooltip
                formatter={(v: number, n: string) => [euros(v), n === 'brut' ? 'Brut' : 'Net à payer']}
                labelStyle={{ fontWeight: 600 }}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
              />
              <Line type="monotone" dataKey="brut" stroke="#1f66f0" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-ink-mute">
          Ligne bleue : salaire brut. Ligne verte : net à payer.
        </p>
      </Carte>

      <Carte className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-ink-mute">
              <th className="px-4 py-3 font-semibold">Période</th>
              <th className="px-4 py-3 text-right font-semibold">Brut</th>
              <th className="px-4 py-3 text-right font-semibold">Net à payer</th>
              <th className="px-4 py-3 text-right font-semibold">Score</th>
              <th className="px-4 py-3 text-right font-semibold">Écart</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {synthese.resultats.map((r, i) => (
              <tr key={r.bulletinId} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 capitalize">{donnees[i].periode}</td>
                <td className="tabulaire px-4 py-3 text-right">{euros(donnees[i].brut)}</td>
                <td className="tabulaire px-4 py-3 text-right">{euros(donnees[i].net)}</td>
                <td className="tabulaire px-4 py-3 text-right font-medium">{r.score}</td>
                <td className={`tabulaire px-4 py-3 text-right font-medium ${r.impactMensuelTotal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {euros(r.impactMensuelTotal)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/rapport/${r.bulletinId}`} className="lien text-sm">Détail</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Carte>
    </div>
  );
}
