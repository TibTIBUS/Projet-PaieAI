import { useCallback, useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { importerFichier } from '@/lib/import';
import type { EtapeImport } from '@/lib/import';
import { usePaieAI } from '@/lib/storage';

const LIBELLES: Record<EtapeImport['etape'], string> = {
  lecture: 'Lecture du fichier',
  extraction: 'Extraction du texte',
  ocr: 'Reconnaissance optique',
  analyse: 'Analyse du bulletin',
  termine: 'Terminé',
};

export function ZoneDepot({ surImport }: { surImport?: (id: string) => void }) {
  const ajouterBulletin = usePaieAI((e) => e.ajouterBulletin);
  const [survol, setSurvol] = useState(false);
  const [progression, setProgression] = useState<EtapeImport | null>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const champ = useRef<HTMLInputElement>(null);

  const traiter = useCallback(
    async (fichiers: FileList | File[]) => {
      setErreurs([]);
      const messages: string[] = [];
      let dernierId: string | undefined;

      for (const fichier of Array.from(fichiers)) {
        const resultat = await importerFichier(fichier, setProgression);
        if (resultat.erreur || !resultat.bulletin) {
          messages.push(`${fichier.name} — ${resultat.erreur ?? 'lecture impossible'}`);
          continue;
        }
        ajouterBulletin(resultat.bulletin);
        dernierId = resultat.bulletin.id;
      }

      setProgression(null);
      setErreurs(messages);
      if (dernierId) surImport?.(dernierId);
    },
    [ajouterBulletin, surImport],
  );

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          if (e.dataTransfer.files.length) void traiter(e.dataTransfer.files);
        }}
        className={clsx(
          'rounded-xl border-2 border-dashed px-6 py-12 text-center transition',
          survol ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white',
        )}
      >
        {progression ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-brand-600" size={32} />
            <p className="font-medium">{LIBELLES[progression.etape]}</p>
            <p className="text-sm text-ink-mute">{progression.fichier}</p>
            {progression.etape === 'ocr' && (
              <p className="text-xs text-ink-mute">
                Page {progression.page} sur {progression.totalPages} —{' '}
                {Math.round(progression.avancement * 100)} %. La reconnaissance optique
                prend un peu de temps, elle s’exécute sur votre appareil.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-brand-50 p-3">
              <FileUp className="text-brand-600" size={28} />
            </div>
            <div>
              <p className="font-semibold">Déposez vos bulletins de paie ici</p>
              <p className="mt-1 text-sm text-ink-mute">
                PDF ou texte, plusieurs fichiers à la fois. Ils restent sur votre appareil.
              </p>
            </div>
            <button type="button" className="bouton-principal" onClick={() => champ.current?.click()}>
              Choisir des fichiers
            </button>
            <input
              ref={champ}
              type="file"
              accept="application/pdf,.pdf,text/plain,.txt"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void traiter(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        )}
      </div>

      {erreurs.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {erreurs.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
    </div>
  );
}
