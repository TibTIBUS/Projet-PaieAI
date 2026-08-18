import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Police auto-hébergée : aucune requête vers un service tiers.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import './index.css';

const racine = document.getElementById('root');
if (!racine) throw new Error('Élément racine introuvable.');

createRoot(racine).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
