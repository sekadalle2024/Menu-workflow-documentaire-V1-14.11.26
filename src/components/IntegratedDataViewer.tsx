import React, { useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Database,
  Download,
  RefreshCw,
  Table2,
  X,
} from 'lucide-react';
import {
  FeuilleCouvertureDocument,
  IntegratedCollectionDocument,
} from '../data/feuilleCouvertureTemplates';
import { WorkflowTreeNode } from '../types/workflow';

interface IntegratedDataViewerProps {
  docNode?: WorkflowTreeNode;
  data?: FeuilleCouvertureDocument;
  collectionDoc?: {
    node: WorkflowTreeNode;
    data: IntegratedCollectionDocument;
  };
  onRegenerate: () => void;
  onSendToChat: (node: WorkflowTreeNode) => void;
  onClose: () => void;
}

export const IntegratedDataViewer: React.FC<IntegratedDataViewerProps> = ({
  docNode,
  data,
  collectionDoc,
  onRegenerate,
  onSendToChat,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [copied, setCopied] = useState(false);

  const isCollectionMode = Boolean(collectionDoc);
  const activeNode = collectionDoc?.node ?? docNode;
  const payload = collectionDoc ? collectionDoc.data : data;

  const tables = useMemo(() => {
    if (collectionDoc) {
      return collectionDoc.data.tablesConsolidees || [];
    }
    return data?.['Etape mission - Feuille couverture'] || [];
  }, [collectionDoc, data]);

  const prettyJson = useMemo(() => JSON.stringify(payload ?? {}, null, 2), [payload]);

  const refSummary = useMemo(() => {
    if (collectionDoc) {
      return `${collectionDoc.data.documentCount} document(s) · ${tables.length} table(s) consolidée(s)`;
    }
    const t1 = tables.find((entry) => 'table 1' in entry)?.['table 1']?.[0];
    return t1?.Reference || 'Feuille couverture';
  }, [collectionDoc, tables]);

  if (!activeNode || !payload) return null;

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(prettyJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([prettyJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNode.label.replace(/[^a-zA-Z0-9_-]+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      aria-label={
        isCollectionMode
          ? `Intégrer collection : ${activeNode.label}`
          : `Intégrer data : ${activeNode.label}`
      }
      className="flex min-h-0 flex-1 flex-col border-b border-slate-700 bg-slate-950 p-3 lg:border-b-0 lg:border-r lg:border-slate-800 lg:p-4"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-700 bg-white text-slate-900 shadow-lg">
        {/* Barre titre façon fenêtre document / data / collection */}
        <div
          className={`flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-xs text-white ${
            isCollectionMode ? 'bg-violet-700' : 'bg-emerald-700'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/15">
              <Database className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="truncate font-medium" title={activeNode.label}>
              {isCollectionMode
                ? `Collection Data · ${activeNode.label} (${collectionDoc!.data.documentCount} doc)`
                : `Data · ${activeNode.label}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onRegenerate}
              title="Générer aléatoirement un autre JSON"
              className="inline-flex items-center gap-1 rounded bg-white/15 px-2 py-0.5 text-[11px] font-medium hover:bg-white/25 cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              <span>Aléatoire</span>
            </button>
            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1 rounded bg-white/15 px-2 py-0.5 text-[11px] font-medium hover:bg-white/25 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-200" aria-hidden="true" />
                  <span>Copié</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" aria-hidden="true" />
                  <span>Copier JSON</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1 rounded bg-white/15 px-2 py-0.5 text-[11px] font-medium hover:bg-white/25 cursor-pointer"
            >
              <Download className="h-3 w-3" aria-hidden="true" />
              <span>.json</span>
            </button>
            <button
              type="button"
              onClick={() => onSendToChat(activeNode)}
              className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-medium hover:bg-white/25 cursor-pointer"
            >
              Envoyer au chat
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={
                isCollectionMode
                  ? "Fermer l'interface Intégrer collection"
                  : "Fermer l'interface Intégrer data"
              }
              className="rounded p-0.5 hover:bg-white/20 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Barre secondaire d'onglets & référence */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-[11px] text-slate-700">
          <div className="inline-flex items-center rounded-md border border-slate-300 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium cursor-pointer ${
                viewMode === 'table'
                  ? isCollectionMode
                    ? 'bg-violet-700 text-white'
                    : 'bg-emerald-700 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table2 className="h-3 w-3" aria-hidden="true" />
              <span>
                {isCollectionMode ? 'Tables consolidées' : 'Feuille couverture'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('json')}
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium cursor-pointer ${
                viewMode === 'json'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="h-3 w-3" aria-hidden="true" />
              <span>JSON collecté</span>
            </button>
          </div>

          <span className="max-w-[460px] truncate font-mono text-[10px] text-slate-600" title={refSummary}>
            {refSummary}
          </span>
        </div>

        {/* Contenu scrollable */}
        <div className="max-h-[45vh] min-h-[260px] flex-1 overflow-y-auto bg-slate-50 p-3 lg:max-h-none">
          {viewMode === 'json' ? (
            <pre className="overflow-x-auto rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
              <code>{prettyJson}</code>
            </pre>
          ) : tables.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
              {isCollectionMode
                ? 'Cette collection ne contient aucun document pour le moment. Ajoutez ou importez des documents pour consolider leurs tables.'
                : 'Aucune table disponible pour ce document.'}
            </div>
          ) : (
            <div className="space-y-3">
              {tables.map((tableObj, tableIdx) => {
                const [tableTitle, rows] = Object.entries(tableObj)[0] || ['', []];
                if (!tableTitle || !Array.isArray(rows) || rows.length === 0) return null;
                const columns = Object.keys(rows[0]);

                return (
                  <div
                    key={`${tableTitle}-${tableIdx}`}
                    className="overflow-hidden rounded-md border border-slate-200 bg-white"
                  >
                    <div className="border-b border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                      {tableTitle}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-600">
                            {columns.map((col) => (
                              <th key={col} className="px-2 py-1.5 whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {rows.map((row, rIdx) => (
                            <tr
                              key={rIdx}
                              className={
                                row.Conclusion === 'Non-satisfaisant'
                                  ? 'bg-red-50/70'
                                  : 'hover:bg-slate-50/70'
                              }
                            >
                              {columns.map((col) => {
                                const val = row[col] ?? '';
                                const isNonSat = col === 'Conclusion' && val === 'Non-satisfaisant';
                                const isSat = col === 'Conclusion' && val === 'Satisfaisant';
                                const isNeg = col.startsWith('CTR') && val === '-';
                                const isPos = col.startsWith('CTR') && val === '+';
                                return (
                                  <td
                                    key={col}
                                    className={`px-2 py-1.5 align-top ${
                                      columns.length > 5 && col !== 'Description'
                                        ? 'whitespace-nowrap'
                                        : 'min-w-[120px]'
                                    } ${
                                      isNonSat || isNeg
                                        ? 'font-semibold text-red-700'
                                        : isSat || isPos
                                        ? 'font-semibold text-emerald-700'
                                        : ''
                                    }`}
                                  >
                                    {val || '—'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
