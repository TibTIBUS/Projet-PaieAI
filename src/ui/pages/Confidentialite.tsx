import { Carte, TitreSection } from '@/ui/components/primitives';

export function Confidentialite() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <TitreSection
        titre="Confidentialité et traitement des données"
        sousTitre="Un bulletin de paie est une donnée personnelle sensible. Voici exactement ce qu’il advient du vôtre."
      />

      <Carte className="space-y-6 p-6 text-sm leading-relaxed text-ink-soft">
        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">Vos bulletins ne sont pas transmis</h2>
          <p>
            L’intégralité du traitement — lecture du PDF, reconnaissance optique éventuelle, analyse,
            production du rapport — s’exécute dans votre navigateur. Aucun fichier, aucun montant,
            aucune donnée d’identification n’est envoyé à un serveur. Vous pouvez le vérifier :
            l’application fonctionne hors connexion une fois chargée, et son code source est public.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">Ce qui est conservé, et où</h2>
          <p>
            Vos bulletins analysés et vos paramètres sont enregistrés dans le stockage local de votre
            navigateur, sur votre appareil. Ils y restent jusqu’à ce que vous les supprimiez depuis la
            page Paramètres, ou que vous effaciez les données du site. Personne d’autre n’y a accès,
            et nous n’avons aucun moyen de les récupérer si vous les perdez.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">Ni compte, ni traceur</h2>
          <p>
            L’application ne demande pas de compte, ne dépose pas de cookie de mesure d’audience et
            n’intègre aucun script tiers de suivi. Les polices de caractères sont chargées depuis
            Google Fonts ; si vous préférez l’éviter, l’application reste lisible avec les polices
            de votre système.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">Portée juridique du rapport</h2>
          <p>
            PaieAI est une aide au contrôle. Les constats qu’il produit reposent sur les informations
            lues automatiquement sur le bulletin et sur un référentiel de paramètres légaux dont la
            période de vérification est indiquée sur chaque rapport. Ils ne constituent ni un conseil
            juridique, ni une attestation comptable, ni une preuve opposable.
          </p>
          <p className="mt-2">
            Une situation de paie particulière — régime local, convention collective spécifique,
            exonération sectorielle, mandat social, expatriation — peut rendre légitime un écart
            signalé comme anormal. Avant d’engager une démarche auprès de votre employeur, faites
            confirmer les constats par votre service paie, un expert-comptable ou un conseil.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">Vos droits</h2>
          <p>
            Aucun traitement de données personnelles n’étant opéré par un responsable de traitement
            distant, il n’y a ni collecte, ni destinataire, ni durée de conservation à déclarer.
            Vous exercez de fait le contrôle complet sur vos données : elles sont sur votre appareil,
            vous pouvez les exporter ou les effacer à tout moment.
          </p>
        </section>
      </Carte>
    </div>
  );
}
