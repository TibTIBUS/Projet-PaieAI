import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { Severite, Confiance } from '@/domain/types';

export function Carte({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('carte', className)}>{children}</div>;
}

export function TitreSection({
  titre, sousTitre, action,
}: { titre: string; sousTitre?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{titre}</h2>
        {sousTitre && <p className="mt-1 text-sm text-ink-mute">{sousTitre}</p>}
      </div>
      {action}
    </div>
  );
}

const STYLES_SEVERITE: Record<Severite, string> = {
  critique: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  majeure: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  mineure: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  info: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

const LIBELLE_SEVERITE: Record<Severite, string> = {
  critique: 'Critique',
  majeure: 'Majeure',
  mineure: 'Mineure',
  info: 'Information',
};

export function BadgeSeverite({ severite }: { severite: Severite }) {
  return (
    <span className={clsx(
      'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
      STYLES_SEVERITE[severite],
    )}>
      {LIBELLE_SEVERITE[severite]}
    </span>
  );
}

const LIBELLE_CONFIANCE: Record<Confiance, string> = {
  certaine: 'Constat certain',
  probable: 'Constat probable',
  a_verifier: 'À vérifier',
};

export function BadgeConfiance({ confiance }: { confiance: Confiance }) {
  return (
    <span
      className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
      title={
        confiance === 'certaine'
          ? 'Le constat repose sur un calcul vérifiable directement sur le bulletin.'
          : confiance === 'probable'
            ? 'Le constat est très probable mais peut dépendre d’un élément absent du bulletin.'
            : 'Le constat dépend d’une information non vérifiée : confirmez-le avant toute démarche.'
      }
    >
      {LIBELLE_CONFIANCE[confiance]}
    </span>
  );
}

export function Statistique({
  libelle, valeur, aide, accent,
}: { libelle: string; valeur: ReactNode; aide?: string; accent?: 'positif' | 'negatif' | 'neutre' }) {
  return (
    <div className="carte p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-mute">{libelle}</p>
      <p className={clsx(
        'tabulaire mt-1.5 text-2xl font-bold',
        accent === 'negatif' && 'text-rose-600',
        accent === 'positif' && 'text-emerald-600',
      )}>
        {valeur}
      </p>
      {aide && <p className="mt-1 text-xs leading-relaxed text-ink-mute">{aide}</p>}
    </div>
  );
}

export function Alerte({
  ton = 'info', titre, children,
}: { ton?: 'info' | 'attention' | 'danger' | 'succes'; titre?: string; children: ReactNode }) {
  const styles = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    attention: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-rose-200 bg-rose-50 text-rose-900',
    succes: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }[ton];
  return (
    <div className={clsx('rounded-lg border p-4 text-sm leading-relaxed', styles)}>
      {titre && <p className="mb-1 font-semibold">{titre}</p>}
      {children}
    </div>
  );
}

export function Vide({ titre, children }: { titre: string; children?: ReactNode }) {
  return (
    <div className="carte flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="font-semibold">{titre}</p>
      <div className="max-w-md text-sm text-ink-mute">{children}</div>
    </div>
  );
}
