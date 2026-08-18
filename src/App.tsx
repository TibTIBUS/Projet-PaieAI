import { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from '@/ui/components/Layout';
import { Accueil } from '@/ui/pages/Accueil';
import { Bulletins } from '@/ui/pages/Bulletins';
import { Rapport } from '@/ui/pages/Rapport';
import { Parametres } from '@/ui/pages/Parametres';
import { Tarifs } from '@/ui/pages/Tarifs';
import { Confidentialite } from '@/ui/pages/Confidentialite';
import { Vide } from '@/ui/components/primitives';

// Le suivi embarque la bibliothèque de graphiques : on la charge à la demande.
const Dossier = lazy(() =>
  import('@/ui/pages/Dossier').then((m) => ({ default: m.Dossier })),
);

const routeur = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Accueil /> },
      { path: 'bulletins', element: <Bulletins /> },
      { path: 'rapport/:id', element: <Rapport /> },
      {
        path: 'dossier',
        element: (
          <Suspense fallback={<p className="py-16 text-center text-ink-mute">Chargement du suivi…</p>}>
            <Dossier />
          </Suspense>
        ),
      },
      { path: 'parametres', element: <Parametres /> },
      { path: 'tarifs', element: <Tarifs /> },
      { path: 'confidentialite', element: <Confidentialite /> },
      { path: '*', element: <Vide titre="Page introuvable">Cette adresse ne correspond à aucune page.</Vide> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={routeur} />;
}
