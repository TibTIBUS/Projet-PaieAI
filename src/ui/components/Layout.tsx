import { NavLink, Outlet, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { usePaieAI } from '@/lib/storage';

const LIENS = [
  { vers: '/bulletins', libelle: 'Mes bulletins' },
  { vers: '/dossier', libelle: 'Suivi' },
  { vers: '/parametres', libelle: 'Paramètres' },
  { vers: '/tarifs', libelle: 'Tarifs' },
];

export function Layout() {
  const nombreBulletins = usePaieAI((e) => e.bulletins.length);
  const plan = usePaieAI((e) => e.plan);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">P</span>
            <span>PaieAI</span>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 sm:flex">
            {LIENS.map((lien) => (
              <NavLink
                key={lien.vers}
                to={lien.vers}
                className={({ isActive }) => clsx(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-mute hover:bg-slate-100 hover:text-ink',
                )}
              >
                {lien.libelle}
                {lien.vers === '/bulletins' && nombreBulletins > 0 && (
                  <span
                    aria-hidden
                    className="ml-1.5 rounded bg-slate-200 px-1.5 text-xs tabulaire text-ink-soft"
                  >
                    {nombreBulletins}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {plan === 'pro' && (
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                Pro
              </span>
            )}
            <Link to="/bulletins" className="bouton-principal !py-2 !text-xs sm:!text-sm">
              Analyser un bulletin
            </Link>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 sm:hidden">
          {LIENS.map((lien) => (
            <NavLink
              key={lien.vers}
              to={lien.vers}
              className={({ isActive }) => clsx(
                'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium',
                isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-mute',
              )}
            >
              {lien.libelle}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-ink-mute">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
              <ShieldCheck size={16} /> Analyse locale, aucun bulletin transmis
            </span>
            <Link to="/confidentialite" className="lien">Confidentialité et données</Link>
            <Link to="/parametres" className="lien">Paramètres légaux et sources</Link>
            <a
              href="https://github.com/TibTIBUS/Projet-PaieAI"
              target="_blank" rel="noreferrer noopener" className="lien"
            >
              Code source
            </a>
          </div>
          <p className="mt-4 max-w-3xl text-xs leading-relaxed">
            PaieAI est une aide au contrôle de bulletin de paie. Les constats produits ne constituent
            ni un conseil juridique, ni une attestation comptable. Avant toute démarche, faites-les
            confirmer par votre service paie, un expert-comptable ou un conseil.
          </p>
        </div>
      </footer>
    </div>
  );
}
