import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles, X } from 'lucide-react';
import clsx from 'clsx';
import type { Bulletin, ResultatAnalyse } from '@/domain/types';
import { cleApiPlausible, demanderAssistant, ErreurAssistant } from '@/lib/ai';
import type { MessageChat } from '@/lib/ai';
import { usePaieAI } from '@/lib/storage';
import { Alerte } from './primitives';

/**
 * Assistant conversationnel — la façon simple d'obtenir des explications et
 * de compléter les informations manquantes, sans remplir un formulaire.
 *
 * Rien n'est envoyé nulle part tant qu'aucune clé n'a été saisie ici : c'est
 * la seule fonctionnalité de l'application qui communique avec l'extérieur,
 * et elle est strictement volontaire.
 */

const SUGGESTIONS = [
  'Explique-moi le point le plus grave en une phrase',
  'Est-ce que je dois réclamer quelque chose ?',
  'Pourquoi mon net a-t-il changé ce mois-ci ?',
];

/**
 * Référence stable pour « pas encore de conversation ».
 * Un sélecteur Zustand qui retournerait `... ?? []` créerait un nouveau
 * tableau à chaque rendu : `useSyncExternalStore` considérerait alors le
 * résultat comme toujours différent du précédent et boucle indéfiniment
 * (React error #185). Cette constante évite le piège.
 */
const CHAT_VIDE: MessageChat[] = [];

export function Assistant({
  bulletin, resultat,
}: { bulletin: Bulletin; resultat: ResultatAnalyse }) {
  const cle = usePaieAI((e) => e.cleApiIA);
  const options = usePaieAI((e) => e.options);
  const chat = usePaieAI((e) => e.chatParBulletin[bulletin.id] ?? CHAT_VIDE);
  const ajouterMessageChat = usePaieAI((e) => e.ajouterMessageChat);
  const viderChat = usePaieAI((e) => e.viderChat);
  const definirOptions = usePaieAI((e) => e.definirOptions);
  const definirCleApiIA = usePaieAI((e) => e.definirCleApiIA);

  if (!cle) {
    return <ActivationAssistant onActive={definirCleApiIA} />;
  }

  return (
    <FenetreChat
      bulletin={bulletin}
      resultat={resultat}
      options={options}
      cle={cle}
      chat={chat}
      onMessage={(m) => ajouterMessageChat(bulletin.id, m)}
      onInfos={(infos) => definirOptions(infos)}
      onEffacer={() => viderChat(bulletin.id)}
      onDesactiver={() => definirCleApiIA(undefined)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Activation : consentement explicite et clé API                      */
/* ------------------------------------------------------------------ */

function ActivationAssistant({ onActive }: { onActive: (cle: string) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  if (!ouvert) {
    return (
      <div className="carte flex flex-col items-start gap-3 p-5">
        <div className="flex items-center gap-2 text-brand-700">
          <Sparkles size={18} />
          <h3 className="font-semibold">Poser une question sur ce bulletin</h3>
        </div>
        <p className="text-sm text-ink-soft">
          Un assistant peut expliquer ce rapport avec ses propres mots, répondre à vos questions,
          et retenir ce que vous lui dites sur votre situation — plus besoin de remplir un
          formulaire. Il ne calcule rien lui-même : il s’appuie uniquement sur les résultats déjà
          vérifiés ci-dessus.
        </p>
        <button type="button" className="bouton-principal" onClick={() => setOuvert(true)}>
          Activer l’assistant
        </button>
      </div>
    );
  }

  return (
    <div className="carte space-y-4 p-5">
      <div className="flex items-center gap-2 text-brand-700">
        <Sparkles size={18} />
        <h3 className="font-semibold">Activer l’assistant</h3>
      </div>

      <Alerte ton="attention" titre="Ce que ça change">
        Jusqu’ici, rien de votre bulletin ne quittait votre appareil. En activant l’assistant,
        un résumé de ce bulletin (montants, anomalies détectées, vos questions) est envoyé à
        Claude, le service d’intelligence artificielle d’Anthropic, pour obtenir une réponse.
        Votre clé reste uniquement dans ce navigateur — elle n’est jamais envoyée à nous.
      </Alerte>

      <div>
        <label className="etiquette" htmlFor="cle-ia">Votre clé API Anthropic</label>
        <input
          id="cle-ia"
          type="password"
          className="champ font-mono"
          placeholder="sk-ant-…"
          value={saisie}
          onChange={(e) => { setSaisie(e.target.value); setErreur(null); }}
        />
        {erreur && <p className="mt-1.5 text-sm text-rose-600">{erreur}</p>}
        <p className="mt-1.5 text-xs leading-relaxed text-ink-mute">
          Vous n’en avez pas ? Créez-en une gratuitement sur{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank" rel="noreferrer noopener" className="lien"
          >
            console.anthropic.com
          </a>{' '}
          — chaque question coûte quelques centimes, facturés directement par Anthropic à votre
          compte, jamais par PaieAI.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="bouton-principal"
          onClick={() => {
            const nettoyee = saisie.trim();
            if (!cleApiPlausible(nettoyee)) {
              setErreur('Cette clé ne ressemble pas à une clé Anthropic (elle commence par « sk-ant- »).');
              return;
            }
            onActive(nettoyee);
          }}
        >
          Activer
        </button>
        <button type="button" className="bouton-discret" onClick={() => setOuvert(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fenêtre de conversation                                             */
/* ------------------------------------------------------------------ */

interface OptionsAssistant {
  effectif?: number; minimumConventionnel?: number; dureeHebdoContractuelle?: number;
  abonnementTransport?: number; valeurTitreRestaurant?: number; nombreTitresRestaurant?: number;
  alsaceMoselle?: boolean; tauxPasAttendu?: number;
}

function FenetreChat({
  bulletin, resultat, options, cle, chat, onMessage, onInfos, onEffacer, onDesactiver,
}: {
  bulletin: Bulletin; resultat: ResultatAnalyse; options: OptionsAssistant; cle: string;
  chat: MessageChat[];
  onMessage: (m: MessageChat) => void;
  onInfos: (infos: Partial<OptionsAssistant>) => void;
  onEffacer: () => void;
  onDesactiver: () => void;
}) {
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const finDeListe = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finDeListe.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat, enCours]);

  const envoyer = async (texte: string) => {
    const contenu = texte.trim();
    if (!contenu || enCours) return;
    setErreur(null);
    setSaisie('');

    const messageUtilisateur: MessageChat = {
      id: crypto.randomUUID(), role: 'user', texte: contenu, horodatage: new Date().toISOString(),
    };
    onMessage(messageUtilisateur);
    setEnCours(true);

    try {
      const reponse = await demanderAssistant(
        cle,
        { bulletin, resultat, options },
        [...chat, messageUtilisateur],
        contenu,
        onInfos,
      );
      onMessage({
        id: crypto.randomUUID(), role: 'assistant', texte: reponse, horodatage: new Date().toISOString(),
      });
    } catch (e) {
      setErreur(e instanceof ErreurAssistant ? e.message : 'Une erreur inattendue est survenue.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="carte flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2 text-brand-700">
          <Sparkles size={18} />
          <h3 className="font-semibold">Poser une question sur ce bulletin</h3>
        </div>
        <div className="flex items-center gap-1">
          {chat.length > 0 && (
            <button type="button" className="bouton-discret !px-2 !py-1 !text-xs" onClick={onEffacer}>
              Effacer la conversation
            </button>
          )}
          <button
            type="button" className="bouton-discret !px-2 !py-1" title="Désactiver l’assistant"
            onClick={onDesactiver}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="max-h-[28rem] min-h-[10rem] space-y-3 overflow-y-auto px-5 py-4">
        {chat.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s} type="button"
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-ink-soft hover:border-brand-300 hover:bg-brand-50"
                onClick={() => void envoyer(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {chat.map((m) => <Bulle key={m.id} message={m} />)}

        {enCours && (
          <div className="flex items-center gap-2 text-sm text-ink-mute">
            <Loader2 size={15} className="animate-spin" /> L’assistant réfléchit…
          </div>
        )}
        {erreur && <p className="text-sm text-rose-600">{erreur}</p>}
        <div ref={finDeListe} />
      </div>

      <form
        className="flex gap-2 border-t border-slate-100 p-3"
        onSubmit={(e) => { e.preventDefault(); void envoyer(saisie); }}
      >
        <input
          className="champ flex-1"
          placeholder="Posez votre question en langage courant…"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          disabled={enCours}
        />
        <button type="submit" className="bouton-principal !px-3" disabled={enCours || !saisie.trim()}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

function Bulle({ message }: { message: MessageChat }) {
  const estUtilisateur = message.role === 'user';
  return (
    <div className={clsx('flex gap-2', estUtilisateur && 'flex-row-reverse')}>
      {!estUtilisateur && (
        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
          <Bot size={15} />
        </div>
      )}
      <div className={clsx(
        'max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
        estUtilisateur ? 'bg-brand-600 text-white' : 'bg-slate-100 text-ink',
      )}>
        {message.texte}
      </div>
    </div>
  );
}
