import React, { useMemo, useState } from 'react';
import {
  Database,
  Download,
  FolderTree,
  RotateCcw,
  Search,
  ShieldCheck,
  Table2,
} from 'lucide-react';
import { ClientSessionConfig, WorkflowTreeNode } from '../types/workflow';
import { buildPostgresRowsFromTrees } from '../utils/workflowTreeOps';
import {
  exportEAuditSqliteSqlDump,
  loadEAuditSqliteDb,
  resetEAuditSqliteDb,
  SqliteMessageContentPayload,
} from '../utils/eAuditSqliteStore';

interface PostgresDriveSchemaViewProps {
  trees: WorkflowTreeNode[];
  session: ClientSessionConfig;
}

type SchemaTab = 'sqlite' | 'postgres';
type SqliteTableName = 'users' | 'conversations' | 'messages' | 'audit_log';

export const PostgresDriveSchemaView: React.FC<PostgresDriveSchemaViewProps> = ({
  trees,
  session,
}) => {
  const [activeSchemaTab, setActiveSchemaTab] = useState<SchemaTab>('sqlite');
  const [activeSqliteTable, setActiveSqliteTable] = useState<SqliteTableName>('messages');
  const [selectedConversationId, setSelectedConversationId] = useState<string>('all');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [sqliteVersionTick, setSqliteVersionTick] = useState(0);

  const [filterText, setFilterText] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'Workflow' | 'Team Workflow'>('all');

  const sqliteDb = useMemo(() => {
    void sqliteVersionTick;
    return loadEAuditSqliteDb(session);
  }, [session, sqliteVersionTick]);

  const adminUser = useMemo(
    () => sqliteDb.users.find((u) => u.role === 'admin') || sqliteDb.users[0],
    [sqliteDb.users]
  );

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

  const filteredSqliteMessages = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return sqliteDb.messages.filter((m) => {
      if (selectedConversationId !== 'all' && m.conversation_id !== selectedConversationId) {
        return false;
      }
      if (!q) return true;
      return (
        m.id.toLowerCase().includes(q) ||
        m.conversation_id.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q)
      );
    });
  }, [sqliteDb.messages, selectedConversationId, filterText]);

  const selectedMessageRow = useMemo(
    () =>
      filteredSqliteMessages.find((m) => m.id === selectedMessageId) ||
      filteredSqliteMessages[0] ||
      null,
    [filteredSqliteMessages, selectedMessageId]
  );

  const parsedSelectedMessage = useMemo(() => {
    if (!selectedMessageRow) return null;
    try {
      return JSON.parse(selectedMessageRow.content) as SqliteMessageContentPayload;
    } catch {
      return null;
    }
  }, [selectedMessageRow]);

  const handleDownloadSql = () => {
    const sqlText = exportEAuditSqliteSqlDump(sqliteDb);
    const blob = new Blob([sqlText], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aionui-eaudit-v17-seed-${Date.now()}.sql`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(sqliteDb, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aionui-eaudit-v17-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleResetSqlite = () => {
    resetEAuditSqliteDb(session);
    setSelectedMessageId(null);
    setSqliteVersionTick((v) => v + 1);
  };

  const sampleDrivePath = filteredRows[0]
    ? `${filteredRows[0].sous_categorie} / ${filteredRows[0].exercice} / ${filteredRows[0].nature_workflow} / ${filteredRows[0].activite} / ${filteredRows[0].section} / ${filteredRows[0].sous_section} / ${filteredRows[0].nom_document}`
    : 'Workflow / Exercice / Workflow X / Activité audit / Section / Sous-section / Document';

  return (
    <div className="space-y-6">
      {/* En-tête & sélecteur SQLite v17 vs PostgreSQL */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Database className="h-4 w-4 text-blue-700" aria-hidden="true" />
              <span>Persistance E-audit / AionUI SQLite v17 &amp; Projection Drive</span>
            </div>
            <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">
              Base SQLite E-audit (aionui.db · v17) &amp; Modèle PostgreSQL
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Structure relationnelle conforme au projet source AionUI / E-audit (tables{' '}
              <span className="font-mono text-xs">users</span>,{' '}
              <span className="font-mono text-xs">conversations</span>,{' '}
              <span className="font-mono text-xs">messages</span> et{' '}
              <span className="font-mono text-xs">audit_log</span>), pré-remplie avec les données Admin
              et synchronisée à chaque édition de tableau.
            </p>
          </div>

          <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveSchemaTab('sqlite')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSchemaTab === 'sqlite'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
              <span>SQLite v17 · aionui.db</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSchemaTab('postgres')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSchemaTab === 'postgres'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderTree className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
              <span>PostgreSQL &amp; Drive ({rows.length})</span>
            </button>
          </div>
        </div>

        {activeSchemaTab === 'sqlite' ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5 text-slate-900 font-medium">
                <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <span>Admin actif :</span>
                <span className="font-mono font-semibold text-blue-800">{adminUser?.id}</span>
              </div>
              <span className="text-slate-400">·</span>
              <span className="text-slate-700">{adminUser?.email}</span>
              <span className="text-slate-400">·</span>
              <span className="font-mono text-slate-600">
                role={adminUser?.role} · PRAGMA user_version=17 · WAL
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSqliteVersionTick((v) => v + 1)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>Actualiser</span>
              </button>
              <button
                type="button"
                onClick={handleResetSqlite}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <span>Réinitialiser Seed Admin</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <Download className="h-3 w-3" aria-hidden="true" />
                <span>Export JSON</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadSql}
                className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 cursor-pointer"
              >
                <Download className="h-3 w-3" aria-hidden="true" />
                <span>Télécharger Script SQLite (.sql)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-700">
            {sampleDrivePath}
          </div>
        )}
      </section>

      {activeSchemaTab === 'sqlite' ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {/* Barre de sélection des 4 tables SQLite v17 */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'users', label: `users (${sqliteDb.users.length})` },
                  { id: 'conversations', label: `conversations (${sqliteDb.conversations.length})` },
                  { id: 'messages', label: `messages (${sqliteDb.messages.length})` },
                  { id: 'audit_log', label: `audit_log (${sqliteDb.audit_log.length})` },
                ] as Array<{ id: SqliteTableName; label: string }>
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveSqliteTable(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-medium transition-colors cursor-pointer ${
                    activeSqliteTable === t.id
                      ? 'border-blue-700 bg-blue-50 text-blue-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {activeSqliteTable === 'messages' && (
                <select
                  aria-label="Filtrer par conversation_id"
                  value={selectedConversationId}
                  onChange={(e) => setSelectedConversationId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-2 focus:outline-blue-600"
                >
                  <option value="all">Toutes les conversations</option>
                  {sqliteDb.conversations.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.name}
                    </option>
                  ))}
                </select>
              )}

              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Rechercher ID, Markdown, JSON..."
                  className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Contenu de la table sélectionnée */}
          {activeSqliteTable === 'users' && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">id</th>
                    <th className="px-4 py-2.5 font-semibold">username</th>
                    <th className="px-4 py-2.5 font-semibold">email</th>
                    <th className="px-4 py-2.5 font-semibold">role</th>
                    <th className="px-4 py-2.5 font-semibold">status</th>
                    <th className="px-4 py-2.5 font-semibold">jwt_secret</th>
                    <th className="px-4 py-2.5 font-semibold">last_login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sqliteDb.users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-blue-800">
                        {u.id}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{u.username}</td>
                      <td className="px-4 py-2.5">{u.email || '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-slate-900">
                        {u.role}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-emerald-700">
                        {u.status}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                        {u.jwt_secret}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 tabular-nums">
                        {u.last_login ? new Date(u.last_login).toLocaleString('fr-FR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeSqliteTable === 'conversations' && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">id</th>
                    <th className="px-4 py-2.5 font-semibold">user_id (FK)</th>
                    <th className="px-4 py-2.5 font-semibold">name</th>
                    <th className="px-4 py-2.5 font-semibold">type</th>
                    <th className="px-4 py-2.5 font-semibold">status</th>
                    <th className="px-4 py-2.5 font-semibold">extra (JSON)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sqliteDb.conversations.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => {
                        setSelectedConversationId(c.id);
                        setActiveSqliteTable('messages');
                      }}
                      className="hover:bg-blue-50/50 cursor-pointer"
                    >
                      <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-blue-800 whitespace-nowrap">
                        {c.id}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        {c.user_id}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{c.name}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">{c.type}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-emerald-700">
                        {c.status}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 max-w-[340px] truncate">
                        {c.extra}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeSqliteTable === 'messages' && (
            <div className="grid grid-cols-1 divide-y divide-slate-200 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
              <div className="max-h-[480px] overflow-auto lg:col-span-7">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold whitespace-nowrap">id</th>
                      <th className="px-3 py-2.5 font-semibold whitespace-nowrap">conversation_id</th>
                      <th className="px-3 py-2.5 font-semibold whitespace-nowrap">type</th>
                      <th className="px-3 py-2.5 font-semibold">content (JSON sérialisé)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredSqliteMessages.map((m) => {
                      const isSel = selectedMessageRow?.id === m.id;
                      return (
                        <tr
                          key={m.id}
                          onClick={() => setSelectedMessageId(m.id)}
                          className={`cursor-pointer ${
                            isSel ? 'bg-blue-50' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="px-3 py-2.5 font-mono text-[11px] font-semibold text-blue-800 whitespace-nowrap">
                            {m.id}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {m.conversation_id}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] whitespace-nowrap">
                            {m.type}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600 max-w-[260px] truncate">
                            {m.content}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="max-h-[480px] overflow-auto bg-slate-950 p-4 text-xs text-slate-200 lg:col-span-5">
                {selectedMessageRow ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-mono text-[11px] font-semibold text-sky-300">
                        Cellule messages.content · {selectedMessageRow.id}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {parsedSelectedMessage?.n8nData?.stepKey || 'chat'}
                      </span>
                    </div>
                    <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-emerald-300">
                      <code>
                        {JSON.stringify(
                          parsedSelectedMessage ?? { raw: selectedMessageRow.content },
                          null,
                          2
                        )}
                      </code>
                    </pre>
                  </div>
                ) : (
                  <div className="text-slate-400">Sélectionnez un message pour inspecter le JSON.</div>
                )}
              </div>
            </div>
          )}

          {activeSqliteTable === 'audit_log' && (
            <div className="max-h-[460px] overflow-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">id</th>
                    <th className="px-4 py-2.5 font-semibold">user_id</th>
                    <th className="px-4 py-2.5 font-semibold">action</th>
                    <th className="px-4 py-2.5 font-semibold">resource_id</th>
                    <th className="px-4 py-2.5 font-semibold">details (JSON)</th>
                    <th className="px-4 py-2.5 font-semibold">created_at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sqliteDb.audit_log.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {log.id}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-blue-800 whitespace-nowrap">
                        {log.user_id}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-slate-900 whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {log.resource_id || '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600 max-w-[320px] truncate">
                        {log.details || '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                        {new Date(log.created_at).toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
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
                    <td
                      className="px-3 py-2.5 font-medium text-slate-900 max-w-[260px] truncate"
                      title={row.nom_document}
                    >
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
      )}
    </div>
  );
};
