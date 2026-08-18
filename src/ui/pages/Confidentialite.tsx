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
          <h2 className="mb-2 text-base font-semibold text-ink">Vos bulletins ne sont pas transmis, par défaut</h2>
          <p>
            L’intégralité du traitement — lecture du PDF, reconnaissance optique éventuelle, analyse,
            production du rapport — s’exécute dans votre navigateur. Aucun fichier, aucun montant,
            aucune donnée d’identification n’est envoyé à un serveur. Vous pouvez le vérifier
            vous-même : ouvrez l’onglet « Réseau » des outils de développement et analysez un
            bulletin — aucune requête ne part. L’application fonctionne d’ailleurs entièrement hors
            connexion une fois chargée, et son code source est public.
          </p>
          <p className="mt-2">
            La seule exception est l’assistant conversationnel, entièrement optionnel : voir la
            section dédiée ci-dessous. Sans lui, cette page décrit exactement le fonctionnement de
            l’application.
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
            n’intègre aucun script tiers de suivi publicitaire. Tout ce dont elle a besoin est servi
            depuis son propre domaine : la police de caractères, et jusqu’au moteur de reconnaissance
            optique et à son dictionnaire français, qui sont ailleurs habituellement chargés depuis
            un service externe.
          </p>
          <p className="mt-2">
            Cette absence de requête sortante n’est pas seulement une intention : l’application
            déclare une politique de sécurité de contenu qui interdit au navigateur toute connexion
            vers un autre domaine que le sien — à une seule exception nommément déclarée près,
            l’adresse de l’assistant décrite ci-dessous. Si une future version tentait d’envoyer
            quoi que ce soit ailleurs, le navigateur bloquerait la requête.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">L’assistant conversationnel : ce qui change si vous l’activez</h2>
          <p>
            L’assistant est la seule fonctionnalité de l’application à communiquer avec l’extérieur,
            et elle est strictement volontaire : elle reste inactive tant que vous n’avez pas
            vous-même collé une clé API et posé une question.
          </p>
          <p className="mt-2">
            Une fois activé, un résumé du bulletin ouvert — montants, anomalies déjà calculées par le
            moteur local, vos questions et les informations que vous lui donnez — est envoyé à Claude,
            le service d’intelligence artificielle d’Anthropic, pour obtenir une réponse en langage
            courant. Anthropic devient alors, pour ce seul échange, un sous-traitant technique en
            dehors de votre appareil ; consultez sa{' '}
            <a
              href="https://www.anthropic.com/legal/privacy"
              target="_blank" rel="noreferrer noopener" className="lien"
            >
              politique de confidentialité
            </a>{' '}
            pour savoir comment ces données sont traitées de son côté.
          </p>
          <p className="mt-2">
            Votre clé API, elle, ne nous est jamais transmise : elle reste dans le stockage local de
            votre navigateur, au même endroit que vos bulletins, et sert uniquement à vous identifier
            directement auprès d’Anthropic. Vous pouvez la retirer à tout moment depuis la page
            Paramètres ou directement dans la fenêtre de l’assistant — l’application redevient alors
            intégralement locale.
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
            Sans l’assistant, aucun traitement de données personnelles n’est opéré par un
            responsable de traitement distant : il n’y a ni collecte, ni destinataire, ni durée de
            conservation à déclarer. Vous exercez de fait le contrôle complet sur vos données :
            elles sont sur votre appareil, vous pouvez les exporter ou les effacer à tout moment.
          </p>
          <p className="mt-2">
            Si vous activez l’assistant, cette maîtrise reste entière mais s’étend à un tiers que
            vous choisissez d’impliquer vous-même à chaque question posée : vos droits d’accès, de
            rectification et de suppression sur ce que vous lui avez envoyé s’exercent directement
            auprès d’Anthropic.
          </p>
        </section>
      </Carte>
    </div>
  );
}
