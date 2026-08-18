import { useState } from 'react';
import { AlertTriangle, Check, RotateCcw } from 'lucide-react';
import { DERNIERE_PERIODE_VERIFIEE, PERIODES, appliquerSurcharges } from '@/domain/referentiel';
import { effacerToutesLesDonnees, usePaieAI } from '@/lib/storage';
import { euros, nombre } from '@/lib/format';
import { Alerte, Carte, TitreSection } from '@/ui/components/primitives';

/** Champs complémentaires qui débloquent des contrôles. */
const CHAMPS = [
  {
    cle: 'effectif' as const,
    libelle: 'Effectif de l’entreprise',
    aide: 'Détermine le taux du FNAL, de la contribution formation et la déduction forfaitaire sur heures supplémentaires.',
    unite: 'salariés',
    pas: '1',
  },
  {
    cle: 'minimumConventionnel' as const,
    libelle: 'Minimum conventionnel mensuel',
    aide: 'Le salaire minimum de votre coefficient dans votre convention collective. Il est souvent supérieur au SMIC.',
    unite: '€ brut',
    pas: '0.01',
  },
  {
    cle: 'dureeHebdoContractuelle' as const,
    libelle: 'Durée hebdomadaire contractuelle',
    aide: 'Pour les temps partiels : permet de vérifier le minimum légal de 24 heures et la majoration des heures complémentaires.',
    unite: 'heures',
    pas: '0.5',
  },
  {
    cle: 'tauxPasAttendu' as const,
    libelle: 'Taux de prélèvement à la source',
    aide: 'Le taux figurant dans votre espace impots.gouv.fr. Permet de vérifier que l’employeur applique le bon.',
    unite: '%',
    pas: '0.1',
  },
  {
    cle: 'abonnementTransport' as const,
    libelle: 'Abonnement de transport public',
    aide: 'Coût mensuel de votre abonnement. L’employeur doit en rembourser au moins la moitié.',
    unite: '€ / mois',
    pas: '0.01',
  },
  {
    cle: 'valeurTitreRestaurant' as const,
    libelle: 'Valeur d’un titre-restaurant',
    aide: 'Valeur faciale du titre. Permet de vérifier la part patronale et le plafond d’exonération.',
    unite: '€',
    pas: '0.01',
  },
  {
    cle: 'nombreTitresRestaurant' as const,
    libelle: 'Nombre de titres par mois',
    aide: 'Nombre de titres-restaurant attribués sur le mois.',
    unite: 'titres',
    pas: '1',
  },
];

export function Parametres() {
  const options = usePaieAI((e) => e.options);
  const definirOptions = usePaieAI((e) => e.definirOptions);
  const surcharges = usePaieAI((e) => e.surcharges);
  const definirSurcharges = usePaieAI((e) => e.definirSurcharges);
  const alsaceMoselle = options.alsaceMoselle ?? false;

  return (
    <div className="space-y-10">
      <section>
        <TitreSection
          titre="Vos informations"
          sousTitre="Ces éléments ne figurent pas toujours sur le bulletin. Chacun débloque un ou plusieurs contrôles."
        />
        <Carte className="p-5">
          <div className="grid gap-5 sm:grid-cols-2">
            {CHAMPS.map((champ) => (
              <div key={champ.cle}>
                <label className="etiquette" htmlFor={champ.cle}>
                  {champ.libelle} <span className="font-normal text-ink-mute">({champ.unite})</span>
                </label>
                <input
                  id={champ.cle}
                  type="number"
                  step={champ.pas}
                  min="0"
                  className="champ tabulaire"
                  value={options[champ.cle] ?? ''}
                  placeholder="Non renseigné"
                  onChange={(e) => definirOptions({
                    [champ.cle]: e.target.value === '' ? undefined : Number(e.target.value),
                  })}
                />
                <p className="mt-1 text-xs leading-relaxed text-ink-mute">{champ.aide}</p>
              </div>
            ))}
          </div>

          <label className="mt-6 flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={alsaceMoselle}
              onChange={(e) => definirOptions({ alsaceMoselle: e.target.checked })}
            />
            <span>
              <span className="font-medium">Établissement en Alsace-Moselle</span>
              <span className="block text-ink-mute">
                Bas-Rhin, Haut-Rhin ou Moselle : le régime local prévoit une cotisation salariale
                maladie supplémentaire de 1,30 %, légitime dans ce cas seulement.
              </span>
            </span>
          </label>
        </Carte>
      </section>

      <SectionReferentiel surcharges={surcharges} definirSurcharges={definirSurcharges} />

      <section>
        <TitreSection titre="Vos données" sousTitre="Tout est conservé dans ce navigateur, et nulle part ailleurs." />
        <Carte className="p-5">
          <p className="text-sm text-ink-soft">
            Vos bulletins, vos paramètres et vos rapports sont stockés dans le stockage local de ce
            navigateur. Ils disparaissent si vous videz les données du site. Aucun serveur n’en détient
            de copie, et donc personne ne peut vous les restituer : exportez votre dossier si vous
            souhaitez le conserver.
          </p>
          <button
            type="button"
            className="bouton-secondaire mt-4 !border-rose-300 !text-rose-700 hover:!bg-rose-50"
            onClick={() => {
              if (window.confirm('Effacer définitivement tous les bulletins et paramètres enregistrés ?')) {
                effacerToutesLesDonnees();
              }
            }}
          >
            <RotateCcw size={16} /> Effacer toutes mes données
          </button>
        </Carte>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SectionReferentiel({
  surcharges, definirSurcharges,
}: {
  surcharges: ReturnType<typeof usePaieAI.getState>['surcharges'];
  definirSurcharges: (s: ReturnType<typeof usePaieAI.getState>['surcharges']) => void;
}) {
  const [periodeOuverte, setPeriodeOuverte] = useState<string | null>(null);

  const modifier = (cle: string, champ: string, valeur: string) => {
    const nombreSaisi = valeur === '' ? undefined : Number(valeur);
    definirSurcharges({
      ...surcharges,
      periodes: {
        ...surcharges.periodes,
        [cle]: { ...surcharges.periodes?.[cle], [champ]: nombreSaisi },
      },
    });
  };

  const basculerValidation = (cle: string) => {
    const validees = new Set(surcharges.validees ?? []);
    if (validees.has(cle)) validees.delete(cle);
    else validees.add(cle);
    definirSurcharges({ ...surcharges, validees: [...validees] });
  };

  return (
    <section>
      <TitreSection
        titre="Paramètres légaux"
        sousTitre="Le référentiel utilisé par les contrôles. Il est modifiable sans toucher au code : un professionnel de la paie peut le valider période par période."
      />

      <Alerte ton="attention" titre="Vérifiez avant de vous fier à un rapport récent">
        Les valeurs sont vérifiées jusqu’à la période <strong>{DERNIERE_PERIODE_VERIFIEE}</strong>.
        Au-delà, elles sont reconduites de la période précédente et signalées comme non vérifiées :
        les anomalies qui en découlent sont affichées « à vérifier » et pèsent moitié moins dans le score.
        Corrigez-les ci-dessous à partir du Journal officiel, du BOSS ou du site de l’URSSAF, puis
        marquez la période comme validée.
      </Alerte>

      <div className="mt-5 space-y-3">
        {[...PERIODES].reverse().map((periode) => {
          const effective = appliquerSurcharges(periode, surcharges);
          const validee = surcharges.validees?.includes(periode.cle) ?? false;
          const ouverte = periodeOuverte === periode.cle;

          return (
            <Carte key={periode.cle} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    Période {periode.cle}
                    <span className="ml-2 text-sm font-normal text-ink-mute">
                      du {new Date(periode.debut).toLocaleDateString('fr-FR')}
                      {periode.fin ? ` au ${new Date(periode.fin).toLocaleDateString('fr-FR')}` : ' à aujourd’hui'}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-ink-mute">
                    SMIC {nombre(effective.smicHoraire)} €/h · plafond mensuel {euros(effective.plafondMensuelSS)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {effective.fiabilite === 'verifie' ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      <Check size={13} /> {validee ? 'Validé manuellement' : 'Vérifié'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                      <AlertTriangle size={13} /> À confirmer
                    </span>
                  )}
                  <button
                    type="button"
                    className="bouton-discret !py-1.5 !text-xs"
                    onClick={() => setPeriodeOuverte(ouverte ? null : periode.cle)}
                  >
                    {ouverte ? 'Fermer' : 'Corriger'}
                  </button>
                </div>
              </div>

              {ouverte && (
                <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {([
                      ['smicHoraire', 'SMIC horaire (€)', '0.01'],
                      ['smicMensuel', 'SMIC mensuel 151,67 h (€)', '0.01'],
                      ['plafondMensuelSS', 'Plafond mensuel SS (€)', '1'],
                      ['plafondAnnuelSS', 'Plafond annuel SS (€)', '1'],
                      ['plafondHoraireSS', 'Plafond horaire SS (€)', '1'],
                      ['titreRestaurantExoMax', 'Exonération titre-restaurant (€)', '0.01'],
                    ] as const).map(([champ, libelle, pas]) => (
                      <div key={champ}>
                        <label className="etiquette" htmlFor={`${periode.cle}-${champ}`}>{libelle}</label>
                        <input
                          id={`${periode.cle}-${champ}`}
                          type="number"
                          step={pas}
                          className="champ tabulaire"
                          placeholder={String(periode[champ])}
                          value={surcharges.periodes?.[periode.cle]?.[champ] ?? ''}
                          onChange={(e) => modifier(periode.cle, champ, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>

                  <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={validee}
                      onChange={() => basculerValidation(periode.cle)}
                    />
                    <span>
                      <span className="font-medium">J’ai vérifié ces valeurs à la source</span>
                      <span className="block text-ink-mute">
                        Les anomalies de cette période seront présentées comme des constats fermes.
                        À ne cocher qu’après confrontation aux textes officiels.
                      </span>
                    </span>
                  </label>

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-mute">
                      Sources déclarées
                    </p>
                    <ul className="list-inside list-disc space-y-0.5 text-sm text-ink-soft">
                      {effective.sources.map((s) => <li key={s}>{s}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </Carte>
          );
        })}
      </div>
    </section>
  );
}
