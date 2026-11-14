import React, { useEffect, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { ADAPTED_DEPLOYABLE_SCRIPT, SCRIPT_ADAPTATIONS } from '../utils/dossierClassifier';

export const DeployScriptView: React.FC = () => {
  const [sourceMode, setSourceMode] = useState<'adapted' | 'original'>('adapted');
  const [originalScript, setOriginalScript] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/assets/aistudio/dossier-menu_b66cffde.js')
      .then((res) => (res.ok ? res.text() : ''))
      .then((text) => {
        if (text) setOriginalScript(text);
      })
      .catch(() => {
        setOriginalScript('');
      });
  }, []);

  const displayedCode =
    sourceMode === 'adapted'
      ? ADAPTED_DEPLOYABLE_SCRIPT
      : originalScript || 'Chargement du script original depuis les ressources statiques...';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    const filename =
      sourceMode === 'adapted' ? 'dossier-menu-adapted.js' : 'dossier-menu-original.js';
    const blob = new Blob([displayedCode], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <section
        id="adaptations-tech"
        className="rounded-xl border border-slate-200 bg-white"
      >
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Adaptations techniques appliquées au script
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Revue d&apos;architecture et correctifs apportés au script d&apos;origine pour garantir la fiabilité DOM et l&apos;accessibilité.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-6 py-3 whitespace-nowrap">Module</th>
                <th className="px-6 py-3">Limitation observée dans la V2</th>
                <th className="px-6 py-3">Adaptation intégrée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {SCRIPT_ADAPTATIONS.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-3.5 font-medium text-slate-900 whitespace-nowrap">
                    {row.area}
                  </td>
                  <td className="px-6 py-3.5 text-slate-600">{row.issue}</td>
                  <td className="px-6 py-3.5 text-slate-900">{row.adaptation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        id="script-deployable"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Script JavaScript prêt à déployer
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Autonome sans dépendance externe · Écoute <code className="font-mono text-slate-800">[data-page=&quot;dossier&quot;]</code> et <code className="font-mono text-slate-800">dossier:toggle</code>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setSourceMode('adapted')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sourceMode === 'adapted'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Script adapté
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('original')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sourceMode === 'original'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Script original
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Copié</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copier</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Télécharger .js</span>
            </button>
          </div>
        </div>

        <pre className="max-h-[540px] overflow-auto bg-slate-900 p-6 font-mono text-xs leading-relaxed text-slate-200">
          <code>{displayedCode}</code>
        </pre>
      </section>
    </div>
  );
};
