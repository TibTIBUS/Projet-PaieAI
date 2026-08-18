import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import type { Anomalie } from '@/domain/types';
import { euros } from '@/lib/format';
import { BadgeConfiance, BadgeSeverite } from './primitives';

const BORDURE = {
  critique: 'border-l-rose-500',
  majeure: 'border-l-amber-500',
  mineure: 'border-l-sky-400',
  info: 'border-l-slate-300',
} as const;

export function CarteAnomalie({ anomalie }: { anomalie: Anomalie }) {
  const [ouvert, setOuvert] = useState(anomalie.severite === 'critique');

  return (
    <article className={clsx('carte border-l-4 p-5', BORDURE[anomalie.severite])}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <BadgeSeverite severite={anomalie.severite} />
            <BadgeConfiance confiance={anomalie.confiance} />
            <span className="text-xs font-mono text-ink-mute">{anomalie.code}</span>
          </div>
          <h3 className="text-base font-semibold leading-snug">{anomalie.titre}</h3>
        </div>
        {anomalie.impactMensuel ? (
          <div className="shrink-0 text-right">
            <p className="tabulaire text-lg font-bold text-rose-600">
              {euros(anomalie.impactMensuel)}
            </p>
            <p className="text-xs text-ink-mute">par mois</p>
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{anomalie.explication}</p>

      {anomalie.rappelPotentiel ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Si l’erreur se répète depuis trois ans, le rappel mobilisable atteint{' '}
          <strong className="tabulaire">{euros(anomalie.rappelPotentiel)}</strong>.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
        aria-expanded={ouvert}
      >
        {ouvert ? 'Masquer le détail' : 'Voir le détail et les textes applicables'}
        {ouvert ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {ouvert && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-mute">
              Détail du calcul
            </h4>
            <p className="tabulaire text-sm leading-relaxed text-ink-soft">{anomalie.detail}</p>
          </section>

          {anomalie.actions.length > 0 && (
            <section>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-mute">
                Que faire
              </h4>
              <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed text-ink-soft">
                {anomalie.actions.map((action) => <li key={action}>{action}</li>)}
              </ul>
            </section>
          )}

          {anomalie.references.length > 0 && (
            <section>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-mute">
                Textes applicables
              </h4>
              <ul className="space-y-1 text-sm text-ink-soft">
                {anomalie.references.map((r) => (
                  <li key={r.texte}>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer noopener" className="lien inline-flex items-center gap-1">
                        {r.texte}<ExternalLink size={13} />
                      </a>
                    ) : r.texte}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {anomalie.lignesConcernees?.length ? (
            <p className="text-xs text-ink-mute">
              Ligne du bulletin concernée : {anomalie.lignesConcernees.join(', ')}
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}
