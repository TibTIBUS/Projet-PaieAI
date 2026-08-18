import { useState } from 'react';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import { LIMITE_GRATUITE, usePaieAI } from '@/lib/storage';
import { Alerte, Carte, TitreSection } from '@/ui/components/primitives';

const FORMULES = [
  {
    cle: 'gratuit' as const,
    nom: 'Découverte',
    prix: '0 €',
    periode: '',
    accroche: 'Pour vérifier un bulletin qui vous intrigue.',
    avantages: [
      `${LIMITE_GRATUITE} bulletins analysés`,
      'Tous les contrôles de calcul et de conformité',
      'Rapport détaillé avec les textes applicables',
      'Analyse locale, sans compte',
    ],
  },
  {
    cle: 'pro' as const,
    nom: 'Suivi',
    prix: '2,90 €',
    periode: '/ mois',
    accroche: 'Pour ne plus jamais laisser passer un mois.',
    misEnAvant: true,
    avantages: [
      'Bulletins illimités',
      'Contrôles de cohérence dans la durée',
      'Détection des erreurs récurrentes et cumul des rappels',
      'Export du rapport en PDF et du dossier complet',
      'Référentiel légal tenu à jour',
    ],
  },
  {
    cle: 'famille' as const,
    nom: 'Foyer',
    prix: '4,90 €',
    periode: '/ mois',
    accroche: 'Plusieurs salariés sous le même toit.',
    avantages: [
      'Tout le contenu de la formule Suivi',
      'Jusqu’à 4 salariés suivis séparément',
      'Comparaison des dossiers',
    ],
  },
];

export function Tarifs() {
  const plan = usePaieAI((e) => e.plan);
  const definirPlan = usePaieAI((e) => e.definirPlan);
  const [cle, setCle] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const activer = () => {
    const saisie = cle.trim().toUpperCase();
    if (!/^PAIEAI-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(saisie)) {
      setMessage('Format de clé attendu : PAIEAI-XXXX-XXXX');
      return;
    }
    definirPlan('pro', saisie);
    setMessage('Formule Suivi activée sur cet appareil.');
  };

  return (
    <div className="space-y-10">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Le prix d’un café par mois, contre des années d’erreurs
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-ink-soft">
          Une seule erreur de cotisation à 20 € par mois représente 720 € sur les trois ans que la loi
          vous laisse pour réclamer. L’abonnement se rembourse dès la première anomalie corrigée.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {FORMULES.map((formule) => (
          <Carte
            key={formule.cle}
            className={clsx(
              'flex flex-col p-6',
              formule.misEnAvant && 'ring-2 ring-brand-500',
            )}
          >
            {formule.misEnAvant && (
              <p className="mb-3 inline-flex self-start rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                Le plus utile
              </p>
            )}
            <h2 className="text-lg font-bold">{formule.nom}</h2>
            <p className="mt-1 text-sm text-ink-mute">{formule.accroche}</p>
            <p className="mt-4">
              <span className="tabulaire text-3xl font-extrabold">{formule.prix}</span>
              <span className="text-sm text-ink-mute">{formule.periode}</span>
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {formule.avantages.map((a) => (
                <li key={a} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span className="text-ink-soft">{a}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {formule.cle === 'gratuit' ? (
                <span className="bouton-secondaire w-full justify-center">
                  {plan === 'gratuit' ? 'Formule actuelle' : 'Incluse'}
                </span>
              ) : plan === 'pro' && formule.cle === 'pro' ? (
                <span className="bouton-secondaire w-full justify-center !border-emerald-300 !text-emerald-700">
                  Formule active
                </span>
              ) : (
                <a
                  href="#activation"
                  className={formule.misEnAvant ? 'bouton-principal w-full justify-center' : 'bouton-secondaire w-full justify-center'}
                >
                  S’abonner
                </a>
              )}
            </div>
          </Carte>
        ))}
      </div>

      <section id="activation" className="scroll-mt-24">
        <TitreSection
          titre="Activer un abonnement"
          sousTitre="Le paiement n’est pas encore branché sur cette version. Une clé d’activation permet d’ouvrir la formule Suivi."
        />
        <Carte className="p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <label className="etiquette" htmlFor="cle">Clé d’activation</label>
              <input
                id="cle"
                className="champ font-mono uppercase"
                placeholder="PAIEAI-XXXX-XXXX"
                value={cle}
                onChange={(e) => setCle(e.target.value)}
              />
            </div>
            <button type="button" className="bouton-principal" onClick={activer}>Activer</button>
            {plan === 'pro' && (
              <button type="button" className="bouton-discret" onClick={() => { definirPlan('gratuit'); setMessage(null); }}>
                Revenir à la formule gratuite
              </button>
            )}
          </div>
          {message && <p className="mt-3 text-sm text-ink-soft">{message}</p>}
        </Carte>
      </section>

      <Alerte ton="info" titre="Une précision d’honnêteté sur cette version">
        Le contrôle de l’abonnement s’effectue aujourd’hui dans votre navigateur : il relève de
        l’ergonomie, pas de la sécurité, et reste contournable. La facturation réelle suppose un
        service de paiement et une vérification côté serveur ; c’est la prochaine étape du projet,
        décrite dans la feuille de route du dépôt. Le choix d’une analyse entièrement locale reste,
        lui, définitif : c’est ce qui garantit que vos bulletins ne partent nulle part.
      </Alerte>
    </div>
  );
}
