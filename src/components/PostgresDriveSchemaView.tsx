import React, { useMemo, useState } from 'react';
import { Database, FolderTree, Search } from 'lucide-react';
import { ClientSessionConfig, WorkflowTreeNode } from '../types/workflow';
import { buildPostgresRowsFromTrees } from '../utils/workflowTreeOps';

interface PostgresDriveSchemaViewProps {
  trees: WorkflowTreeNode[];
  session: ClientSessionConfig;
}

export const PostgresDriveSchemaView: React.FC<PostgresDriveSchemaViewProps> = ({
  trees,
  session,
}) => {
  const [filterText, setFilterText] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'Workflow' | 'Team Workflow'>('all');

  const rows = useMemo(() => buildPostgresRowsFromTrees(trees, session), [trees, session]);

  const filteredRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return rows.filter((r) => {
      if (scopeFilter !== 'all' && r.sous_categorie !== scopeFilter) return false;
      if (!q) return true;
      return (
        r.nom_document.toLowerCase().includes(q) ||
        r.nature_workflow.toLowerCase().includes(q) ||
        r.exercice.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q) ||
        r.id_google_drive.toLowerCase().includes(q)
      );
    });
  }, [rows, filterText, scopeFilter]);

  const sampleDrivePath = filteredRows[0]
    ? `${filteredRows[0].sous_categorie} / ${filteredRows[0].exercice} / ${filteredRows[0].nature_workflow} / ${filteredRows[0].activite} / ${filteredRows[0].section} / ${filteredRows[0].sous_section} / ${filteredRows[0].nom_document}`
    : 'Workflow / Exercice / Workflow X / Activité audit / Section / Sous-section / Document';

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <FolderTree className="h-4 w-4 text-blue-700" aria-hidden="true" />
              <span>Correspondance Google Drive en cascade</span>
            </div>
            <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">
              Arborescence Drive &amp; Base PostgreSQL
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Chaque modification effectuée dans le menu coulissant met à jour instantanément la
              projection relationnelle PostgreSQL et le chemin Google Drive associé.
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div>
              <div className="text-xs text-slate-500">Lignes indexées</div>
              <div className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {rows.length}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" aria-hidden="true" />
            <div>
              <div className="text-xs text-slate-500">Client actif</div>
              <div className="font-medium text-slate-900">{session.client}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-700">
          {sampleDrivePath}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-slate-900">
              Table PostgreSQL · workflow_documents
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
              {(['all', 'Workflow', 'Team Workflow'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setScopeFilter(opt)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    scopeFilter === opt
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt === 'all' ? 'Tous' : opt}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filtrer documents, Drive ID..."
                className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-blue-600"
              />
            </div>
          </div>
        </div>

        <div className="max-h-[540px] overflow-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">no</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">sous_categorie</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">nature_workflow</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">exercice</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">section</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">sous_section</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">nom_document</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">owner</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">id_google_drive</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">user_api_key_token</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRows.map((row) => (
                <tr key={`${row.no}-${row.id_google_drive}`} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2.5 font-mono text-slate-500 tabular-nums">{row.no}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                    {row.sous_categorie}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{row.nature_workflow}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{row.exercice}</td>
                  <td className="px-3 py-2.5 max-w-[180px] truncate" title={row.section}>
                    {row.section}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-slate-600">
                    {row.sous_section}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900 max-w-[260px] truncate" title={row.nom_document}>
                    {row.nom_document}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] font-semibold text-blue-700 whitespace-nowrap">
                    {row.owner}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {row.id_google_drive}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {row.user_api_key_token}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
