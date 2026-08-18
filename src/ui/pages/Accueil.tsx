import { Link, useNavigate } from 'react-router-dom';
import { Calculator, FileSearch, Lock, ScrollText, TrendingUp, Wallet } from 'lucide-react';
import { ZoneDepot } from '@/ui/components/ZoneDepot';
import { Carte } from '@/ui/components/primitives';
import { CONTROLES } from '@/domain/engine';
import { BULLETINS_DEMO } from '@/domain/fixtures/bulletins';
import { analyserLignes } from '@/domain/parsing/parser';
import { usePaieAI } from '@/lib/storage';

const ARGUMENTS = [
  {
    icone: Calculator,
    titre: 'Chaque ligne est recalculée',
    texte:
      'Base multipliée par taux, tranches de cotisations, assiette de CSG, net imposable, net social, ' +
      'prélèvement à la source : tout est refait, ligne à ligne.',
  },
  {
    icone: ScrollText,
    titre: 'Le droit applicable au mois près',
    texte:
      'SMIC, plafond de la sécurité sociale et barèmes de cotisations sont datés. Un bulletin de mars 2024 ' +
      'est contrôlé avec les valeurs de mars 2024, pas avec celles d’aujourd’hui.',
  },
  {
    icone: TrendingUp,
    titre: 'Les erreurs se voient dans la durée',
    texte:
      'Une prime qui disparaît, un taux qui change, un compteur de congés qui se vide : ' +
      'la comparaison mois après mois révèle ce qu’un bulletin isolé ne montre pas.',
  },
  {
    icone: Wallet,
    titre: 'Le montant en jeu, chiffré',
    texte:
      'Chaque anomalie est chiffrée en euros par mois, et projetée sur les trois ans de prescription ' +
      'des salaires. Vous savez ce que vous pouvez réclamer.',
  },
  {
    icone: Lock,
    titre: 'Vos bulletins ne partent pas',
    texte:
      'Toute l’analyse tourne dans votre navigateur. Aucun fichier n’est téléversé, aucun compte n’est requis, ' +
      'rien n’est stocké ailleurs que sur votre appareil.',
  },
  {
    icone: FileSearch,
    titre: 'Un rapport transmissible',
    texte:
      'Le rapport cite les articles du Code du travail et de la sécurité sociale. ' +
      'Il s’envoie tel quel au service paie, à un expert-comptable ou à un conseil.',
  },
];

export function Accueil() {
  const naviguer = useNavigate();
  const ajouterBulletin = usePaieAI((e) => e.ajouterBulletin);

  const chargerDemo = (cle: string) => {
    const demo = BULLETINS_DEMO.find((b) => b.cle === cle);
    if (!demo) return;
    const bulletin = analyserLignes(demo.texte.split('\n'), {
      nomFichier: `Exemple — ${demo.titre}.pdf`,
      source: 'pdf',
    });
    ajouterBulletin(bulletin);
    naviguer(`/rapport/${bulletin.id}`);
  };

  return (
    <div className="space-y-16">
      <section className="pt-4 text-center">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <Lock size={13} /> Analyse 100 % locale — vos bulletins ne quittent pas votre appareil
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Une erreur de paie passe inaperçue.
          <span className="block text-brand-700">Pas deux fois.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Déposez votre bulletin : PaieAI le recalcule intégralement, confronte chaque ligne au droit
          en vigueur ce mois-là, et chiffre en euros ce que l’erreur vous coûte — sur le mois, et sur
          les trois années que la loi vous laisse pour réclamer.
        </p>

        <div className="mx-auto mt-8 max-w-2xl">
          <ZoneDepot surImport={(id) => naviguer(`/rapport/${id}`)} />
          <p className="mt-4 text-sm text-ink-mute">
            Pas de bulletin sous la main ?{' '}
            <button type="button" className="lien font-medium" onClick={() => chargerDemo('erreurs')}>
              Essayez avec un exemple contenant des erreurs
            </button>
            {' '}ou{' '}
            <button type="button" className="lien font-medium" onClick={() => chargerDemo('conforme')}>
              un bulletin conforme
            </button>.
          </p>
        </div>

        <dl className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { valeur: `${CONTROLES.length}`, libelle: 'contrôles par bulletin' },
            { valeur: '3 ans', libelle: 'de rappel mobilisable' },
            { valeur: '0', libelle: 'donnée envoyée' },
            { valeur: '30 s', libelle: 'pour un rapport complet' },
          ].map((s) => (
            <div key={s.libelle} className="carte px-3 py-4">
              <dt className="tabulaire text-2xl font-bold text-brand-700">{s.valeur}</dt>
              <dd className="mt-0.5 text-xs text-ink-mute">{s.libelle}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-2 text-center text-2xl font-bold tracking-tight">
          Ce qu’un expert-comptable regarde, appliqué à chacun de vos bulletins
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-center text-ink-mute">
          Le contrôle de paie est un travail méthodique. PaieAI l’exécute intégralement, chaque mois,
          sans que vous ayez à y penser.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ARGUMENTS.map(({ icone: Icone, titre, texte }) => (
            <Carte key={titre} className="p-5">
              <Icone className="mb-3 text-brand-600" size={22} />
              <h3 className="mb-1.5 font-semibold">{titre}</h3>
              <p className="text-sm leading-relaxed text-ink-mute">{texte}</p>
            </Carte>
          ))}
        </div>
      </section>

      <section className="carte overflow-hidden">
        <div className="grid gap-8 p-8 lg:grid-cols-2 lg:p-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Les erreurs les plus fréquentes coûtent cher, longtemps
            </h2>
            <p className="mt-3 text-ink-soft">
              Une erreur de paie se répète mois après mois jusqu’à ce que quelqu’un la remarque.
              Un point de cotisation en trop sur un salaire de 2 000 €, c’est 20 € par mois —
              720 € sur trois ans, sans que rien ne vous alerte.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-ink-soft">
              {[
                'Taux de cotisation salariale erroné ou obsolète',
                'Assiette plafonnée calculée au-delà du plafond de la sécurité sociale',
                'Heures supplémentaires majorées en deçà du minimum légal',
                'Complémentaire santé financée à moins de 50 % par l’employeur',
                'Montant net social absent ou faux, avec effet sur vos droits sociaux',
                'Prime versée pendant des années puis supprimée sans dénonciation',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/tarifs" className="bouton-principal mt-7">Voir les formules</Link>
          </div>

          <div className="rounded-xl bg-slate-50 p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-mute">
              Extrait d’un rapport
            </p>
            <div className="space-y-3">
              {[
                { t: 'Taux salarial incorrect — Sécurité sociale plafonnée', m: '19,52 € / mois', s: 'bg-amber-50 text-amber-800' },
                { t: 'Assiette de tranche 1 au-delà du plafond', m: '67,66 € / mois', s: 'bg-rose-50 text-rose-700' },
                { t: 'Heures supplémentaires sous-majorées', m: '18,00 € / mois', s: 'bg-amber-50 text-amber-800' },
                { t: 'Mutuelle financée à 30 % par l’employeur', m: '8,00 € / mois', s: 'bg-amber-50 text-amber-800' },
              ].map((l) => (
                <div key={l.t} className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 text-sm shadow-sm">
                  <span className="min-w-0 flex-1 leading-snug">{l.t}</span>
                  <span className={`tabulaire shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${l.s}`}>
                    {l.m}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
              <p className="text-sm text-brand-900">
                Rappel mobilisable sur trois ans :{' '}
                <strong className="tabulaire">4 810,32 €</strong>
              </p>
            </div>
            <button
              type="button"
              className="bouton-secondaire mt-4 w-full"
              onClick={() => chargerDemo('erreurs')}
            >
              Ouvrir ce rapport en entier
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
