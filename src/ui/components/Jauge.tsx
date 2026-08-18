import clsx from 'clsx';

/** Jauge circulaire du score de conformité. */
export function Jauge({ score, taille = 128 }: { score: number; taille?: number }) {
  const rayon = taille / 2 - 8;
  const circonference = 2 * Math.PI * rayon;
  const rempli = (score / 100) * circonference;

  const couleur =
    score >= 90 ? 'stroke-emerald-500'
      : score >= 70 ? 'stroke-lime-500'
        : score >= 40 ? 'stroke-amber-500'
          : 'stroke-rose-500';

  const texte =
    score >= 90 ? 'text-emerald-600'
      : score >= 70 ? 'text-lime-600'
        : score >= 40 ? 'text-amber-600'
          : 'text-rose-600';

  return (
    <div className="relative inline-flex" style={{ width: taille, height: taille }}>
      <svg width={taille} height={taille} className="-rotate-90" aria-hidden>
        <circle
          cx={taille / 2} cy={taille / 2} r={rayon}
          className="fill-none stroke-slate-200" strokeWidth={8}
        />
        {score > 0 && (
          <circle
            cx={taille / 2} cy={taille / 2} r={rayon}
            className={clsx('fill-none transition-all duration-700', couleur)}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${rempli} ${circonference}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={clsx('tabulaire text-3xl font-bold', texte)}>{score}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-ink-mute">sur 100</span>
      </div>
    </div>
  );
}

export function libelleScore(score: number): string {
  if (score >= 95) return 'Bulletin conforme';
  if (score >= 80) return 'Anomalies mineures';
  if (score >= 50) return 'Anomalies à corriger';
  return 'Anomalies importantes';
}
