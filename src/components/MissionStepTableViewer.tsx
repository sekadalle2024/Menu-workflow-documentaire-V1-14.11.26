import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eraser,
  Lock,
  MessageSquarePlus,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import {
  buildFormatageDataForNode,
  normalizeWorkflowBaseTables,
  ParsedBaseTable,
} from '../data/missionStepsFormatData';
import { ClientSessionConfig, WorkflowTreeNode } from '../types/workflow';
import {
  getStepTablesFromSqlite,
  loadEAuditSqliteDb,
  SqliteMessageRow,
  tablesToMarkdown,
  updateStepTablesInSqlite,
} from '../utils/eAuditSqliteStore';

interface MissionStepTableViewerProps {
  node: WorkflowTreeNode;
  session: ClientSessionConfig;
  isLocked?: boolean;
  externalTables?: ParsedBaseTable[];
  onExternalTablesChange?: (nextTables: ParsedBaseTable[], reason: string) => void;
  onShareStep?: (node: WorkflowTreeNode, tables: ParsedBaseTable[]) => void;
  hideSendToChat?: boolean;
  refreshKey?: number;
  flushTop?: boolean;
  compactHeader?: boolean;
  onSendStepToChat: (node: WorkflowTreeNode, tables: ParsedBaseTable[]) => void;
  onSqliteSynced?: (
    detail: string,
    node?: WorkflowTreeNode,
    nextTables?: ParsedBaseTable[]
  ) => void;
  onClose: () => void;
}

export const MissionStepTableViewer: React.FC<MissionStepTableViewerProps> = ({
  node,
  session,
  isLocked = false,
  externalTables,
  onExternalTablesChange,
  onShareStep,
  hideSendToChat = false,
  refreshKey = 0,
  flushTop = false,
  compactHeader = false,
  onSendStepToChat,
  onSqliteSynced,
  onClose,
}) => {
  const [tables, setTables] = useState<ParsedBaseTable[]>([]);
  const [sqliteRow, setSqliteRow] = useState<SqliteMessageRow | null>(null);
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    tIdx: number;
    rIdx: number;
    cIdx: number;
  } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    tIdx: number;
    rIdx: number;
    cIdx: number;
  } | null>(null);
  const [cellDraft, setCellDraft] = useState('');
  const [rowMenu, setRowMenu] = useState<{
    x: number;
    y: number;
    tIdx: number;
    rIdx: number;
    cIdx: number;
  } | null>(null);
  const [lastSyncNote, setLastSyncNote] = useState<string | null>(null);

  const prevNodeIdRef = useRef<string | null>(null);
  const editingCellRef = useRef(editingCell);
  editingCellRef.current = editingCell;
  const tablesRef = useRef(tables);
  tablesRef.current = tables;
  const rowMenuRef = useRef<HTMLDivElement | null>(null);

  const formatPayload = useMemo(
    () => buildFormatageDataForNode(node, session.client, '2026'),
    [node, session.client]
  );

  // Charger les tables depuis externalTables (invité partagé) ou aionui.db (SQLite v17)
  // Ne réinitialiser editingCell/rowMenu que lors d'un vrai changement d'étape (node.id),
  // jamais pendant une synchro en arrière-plan pour ne pas effacer la saisie en cours.
  useEffect(() => {
    const isNodeChanged = prevNodeIdRef.current !== node.id;
    prevNodeIdRef.current = node.id;

    if (isNodeChanged) {
      setEditingCell(null);
      setSelectedCell(null);
      setRowMenu(null);
      setLastSyncNote(null);
    }

    if (externalTables) {
      const normalizedExternal = normalizeWorkflowBaseTables(externalTables);
      if (!isNodeChanged && editingCellRef.current !== null) {
        return;
      }
      if (
        !isNodeChanged &&
        tablesToMarkdown(normalizedExternal) === tablesToMarkdown(tablesRef.current)
      ) {
        return;
      }
      setTables(normalizedExternal);
      setSqliteRow(null);
      return;
    }

    if (!isNodeChanged && editingCellRef.current !== null) {
      return;
    }

    const db = loadEAuditSqliteDb(session);
    const loaded = getStepTablesFromSqlite(db, node, session.client);
    const normalizedLoaded = normalizeWorkflowBaseTables(loaded.tables);
    if (
      !isNodeChanged &&
      tablesToMarkdown(normalizedLoaded) === tablesToMarkdown(tablesRef.current)
    ) {
      return;
    }
    setTables(normalizedLoaded);
    setSqliteRow(loaded.messageRow);
  }, [node, session.client, refreshKey, externalTables]);

  useEffect(() => {
    if (!rowMenu) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) {
        setRowMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRowMenu(null);
      }
    };
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [rowMenu]);

  const openRowContextMenu = (
    clientX: number,
    clientY: number,
    tIdx: number,
    rIdx: number,
    cIdx: number
  ) => {
    const menuWidth = 248;
    const menuHeight = isLocked ? 180 : 390;
    const maxX =
      typeof window !== 'undefined' ? window.innerWidth - menuWidth - 12 : clientX;
    const maxY =
      typeof window !== 'undefined' ? window.innerHeight - menuHeight - 12 : clientY;
    setRowMenu({
      x: Math.max(12, Math.min(clientX, maxX)),
      y: Math.max(12, Math.min(clientY, maxY)),
      tIdx,
      rIdx,
      cIdx,
    });
  };

  const persistTables = (nextTables: ParsedBaseTable[], reason: string) => {
    setTables(nextTables);
    if (onExternalTablesChange) {
      onExternalTablesChange(nextTables, reason);
      setLastSyncNote('Synchronisé');
      return;
    }
    const { messageRow } = updateStepTablesInSqlite(
      node,
      nextTables,
      'user_admin_oha',
      reason,
      session.client
    );
    setSqliteRow(messageRow);
    setLastSyncNote(`Sauvegardé (${messageRow.id})`);
    onSqliteSynced?.(`SQLite v17 mis à jour · ${reason} (${messageRow.id})`, node, nextTables);
  };

  const handleStartEditCell = (tIdx: number, rIdx: number, cIdx: number, value: string) => {
    if (isLocked) return;
    setEditingCell({ tIdx, rIdx, cIdx });
    setCellDraft(value);
  };

  const handleCommitCell = () => {
    if (!editingCell) return;
    const { tIdx, rIdx, cIdx } = editingCell;
    const nextTables = tables.map((t, idx) => {
      if (idx !== tIdx) return t;
      const nextRows = t.rows.map((row, ri) =>
        ri === rIdx ? row.map((cell, ci) => (ci === cIdx ? cellDraft : cell)) : row
      );
      return { ...t, rows: nextRows };
    });
    setEditingCell(null);
    persistTables(nextTables, `Cellule modifiée (${tables[tIdx]?.title || 'table'})`);
  };

  const makeBlankRow = (table: ParsedBaseTable): string[] =>
    table.headers.map((h, i) =>
      i === 0 && (h.toLowerCase() === 'no' || h.toLowerCase() === 'n°')
        ? String(table.rows.length + 1)
        : '—'
    );

  const handleInsertRowAt = (tIdx: number, insertIndex: number) => {
    if (isLocked) return;
    const nextTables = tables.map((t, idx) => {
      if (idx !== tIdx) return t;
      const blank = makeBlankRow(t);
      const copy = [...t.rows];
      const clampedIndex = Math.max(0, Math.min(insertIndex, copy.length));
      copy.splice(clampedIndex, 0, blank);
      return { ...t, rows: copy };
    });
    setRowMenu(null);
    persistTables(nextTables, `Ligne ajoutée dans ${tables[tIdx]?.title || 'table'}`);
  };

  const handleDuplicateRow = (tIdx: number, rIdx: number) => {
    if (isLocked) return;
    const target = tables[tIdx];
    const sourceRow = target?.rows[rIdx];
    if (!target || !sourceRow) return;
    const nextTables = tables.map((t, idx) => {
      if (idx !== tIdx) return t;
      const copy = [...t.rows];
      copy.splice(rIdx + 1, 0, [...sourceRow]);
      return { ...t, rows: copy };
    });
    setRowMenu(null);
    persistTables(nextTables, `Ligne dupliquée dans ${target.title}`);
  };

  const handleClearRow = (tIdx: number, rIdx: number) => {
    if (isLocked) return;
    const target = tables[tIdx];
    if (!target) return;
    const nextTables = tables.map((t, idx) => {
      if (idx !== tIdx) return t;
      const cleared = t.headers.map((h, i) =>
        i === 0 && (h.toLowerCase() === 'no' || h.toLowerCase() === 'n°')
          ? t.rows[rIdx]?.[0] || String(rIdx + 1)
          : '—'
      );
      return {
        ...t,
        rows: t.rows.map((row, ri) => (ri === rIdx ? cleared : row)),
      };
    });
    setRowMenu(null);
    persistTables(nextTables, `Ligne vidée dans ${target.title}`);
  };

  const handleDeleteRow = (tIdx: number, rIdx: number) => {
    if (isLocked) return;
    const target = tables[tIdx];
    if (!target || target.rows.length <= 1) return;
    const nextTables = tables.map((t, idx) =>
      idx === tIdx ? { ...t, rows: t.rows.filter((_, ri) => ri !== rIdx) } : t
    );
    setRowMenu(null);
    persistTables(nextTables, `Ligne supprimée dans ${target.title}`);
  };

  const handleCopyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setLastSyncNote(label);
    } catch {
      setLastSyncNote(label);
    }
    setRowMenu(null);
  };

  const handleResetStepToDefault = () => {
    if (isLocked) return;
    const fresh = formatPayload.baseTables;
    setRowMenu(null);
    persistTables(fresh, `Réinitialisation modèle [Formatage data] (${formatPayload.reference})`);
  };

  const accentBarClass =
    formatPayload.formatType === 2
      ? 'bg-emerald-800'
      : formatPayload.formatType === 3
      ? 'bg-amber-800'
      : 'bg-slate-900';

  const activeMenuTable = rowMenu ? tables[rowMenu.tIdx] : undefined;
  const activeMenuHeader =
    activeMenuTable && rowMenu
      ? activeMenuTable.headers[rowMenu.cIdx] ?? activeMenuTable.headers[0] ?? 'Cellule'
      : 'Cellule';
  const activeMenuCellVal =
    activeMenuTable && rowMenu
      ? activeMenuTable.rows[rowMenu.rIdx]?.[rowMenu.cIdx] ?? ''
      : '';

  return (
    <div
      aria-label={`Tables liées à l'étape : ${node.label}`}
      className={`flex min-h-0 flex-1 flex-col border-b border-slate-700 bg-slate-950 lg:border-b-0 lg:border-r lg:border-slate-800 ${
        flushTop ? 'p-0' : 'p-3 lg:p-4'
      }`}
    >
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-white text-slate-900 shadow-lg ${
          flushTop ? 'rounded-none border-0' : 'rounded-lg border border-slate-700'
        }`}
      >
        {/* Barre supérieure */}
        <div
          className={`flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 text-xs text-white ${accentBarClass} ${
            compactHeader ? 'py-1.5' : 'px-3.5 py-2'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Table2 className="h-4 w-4 shrink-0 text-white/90" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold" title={node.label}>
                  {node.label}
                </span>
                {compactHeader && (
                  <span className="shrink-0 rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] text-white/90">
                    {tables.length} table(s)
                  </span>
                )}
                {compactHeader && lastSyncNote && (
                  <span className="shrink-0 rounded bg-emerald-500/25 px-1.5 py-0.5 font-mono text-[10px] text-emerald-200">
                    {lastSyncNote}
                  </span>
                )}
              </div>
              {!compactHeader && (
                <div className="flex items-center gap-1.5 text-[10px] text-white/80">
                  <span>{formatPayload.phase}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatPayload.formatLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{formatPayload.reference}</span>
                </div>
              )}
            </div>
            {isLocked && (
              <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label="Verrouillé" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {!isLocked && (
              <button
                type="button"
                onClick={() => setEditingEnabled((prev) => !prev)}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  editingEnabled
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                <Pencil className="h-3 w-3" aria-hidden="true" />
                <span>{editingEnabled ? 'Édition active' : 'Éditer cellules'}</span>
              </button>
            )}
            {compactHeader && !isLocked && (
              <button
                type="button"
                onClick={handleResetStepToDefault}
                title="Restaurer le modèle initial de l'étape"
                className="inline-flex items-center gap-1 rounded bg-white/15 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/25 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>Réinitialiser</span>
              </button>
            )}
            {onShareStep && (
              <button
                type="button"
                onClick={() => onShareStep(node, tables)}
                className="inline-flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-400 cursor-pointer"
              >
                <Share2 className="h-3 w-3" aria-hidden="true" />
                <span>Partager</span>
              </button>
            )}
            {!hideSendToChat && (
              <button
                type="button"
                onClick={() => onSendStepToChat(node, tables)}
                className="inline-flex items-center gap-1 rounded bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/25 cursor-pointer"
              >
                <MessageSquarePlus className="h-3 w-3" aria-hidden="true" />
                <span>Envoyer au chat</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer l'aperçu de l'étape de mission"
              className="rounded p-1 hover:bg-white/20 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Barre utilitaire compacte (masquée si compactHeader pour maximiser la hauteur des tables) */}
        {!compactHeader && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-4 py-1.5 text-[11px]">
            <div className="flex min-w-0 items-center gap-2 text-slate-600">
              <span className="font-semibold text-slate-800 whitespace-nowrap">
                {tables.length} table(s)
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="truncate">
                {formatPayload.isEmptyPlaceholder && !sqliteRow
                  ? 'Étape sans données · Double-clic, « Éditer cellules » ou clic droit / ⋮ sur une ligne.'
                  : 'Double-clic sur une cellule, « Éditer cellules » ou clic droit / ⋮ pour le menu contextuel.'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {lastSyncNote && (
                <span className="font-mono text-[10px] font-medium text-emerald-700">
                  {lastSyncNote}
                </span>
              )}
              {!isLocked && (
                <button
                  type="button"
                  onClick={handleResetStepToDefault}
                  title="Restaurer le modèle initial de l'étape"
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  <span>Réinitialiser</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Zone de contenu (pleine hauteur disponible) */}
        <div
          onScroll={() => rowMenu && setRowMenu(null)}
          className={`min-h-0 flex-1 overflow-y-auto bg-[#F5F6F8] ${
            flushTop ? 'p-4 lg:p-5' : 'max-h-[52vh] min-h-[280px] p-4 lg:max-h-none lg:p-5'
          }`}
        >
          <div className="space-y-5">
            {tables.map((table, tIdx) => {
              const isRubriqueDescTable =
                table.headers.length === 2 &&
                table.headers[0].trim().toLowerCase() === 'rubrique' &&
                table.headers[1].trim().toLowerCase() === 'description';

              return (
                <div
                  key={table.id}
                  className="overflow-hidden rounded-lg border border-slate-300/90 bg-white shadow-[0_6px_18px_-3px_rgba(15,23,42,0.22),0_3px_8px_-2px_rgba(15,23,42,0.14)]"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="divide-x divide-red-950/45 bg-[#8B0000] text-[12px] font-semibold text-white">
                          {table.headers.map((header, hIdx) => (
                            <th
                              key={hIdx}
                              className={`px-3.5 py-2.5 text-left align-middle whitespace-nowrap ${
                                isRubriqueDescTable && hIdx === 0
                                  ? 'w-[28%] min-w-[140px] max-w-[230px]'
                                  : ''
                              }`}
                            >
                              {header}
                            </th>
                          ))}
                          <th
                            title={`${table.title} — Actions`}
                            className="w-[1%] whitespace-nowrap px-2 py-1.5 text-right font-normal"
                          >
                            <div className="inline-flex items-center justify-end gap-1">
                              {!isLocked && (
                                <button
                                  type="button"
                                  onClick={() => handleInsertRowAt(tIdx, table.rows.length)}
                                  title={`Ajouter une ligne dans ${table.title}`}
                                  className="inline-flex items-center gap-0.5 rounded bg-white/15 px-1.5 py-1 text-[10px] font-medium text-white transition-colors hover:bg-white/25 cursor-pointer"
                                >
                                  <Plus className="h-3 w-3" aria-hidden="true" />
                                  <span>Ligne</span>
                                </button>
                              )}
                              <button
                                type="button"
                                title={`${table.title} — Menu contextuel du tableau`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  openRowContextMenu(
                                    rect.right - 220,
                                    rect.bottom + 4,
                                    tIdx,
                                    Math.max(0, table.rows.length - 1),
                                    0
                                  );
                                }}
                                className="rounded p-1 text-white/85 transition-colors hover:bg-white/20 hover:text-white cursor-pointer"
                              >
                                <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white text-slate-800">
                        {table.rows.map((row, rIdx) => {
                          const isNonSatRow = row.some((c) => c === 'Non-satisfaisant');
                          const isRowContextActive =
                            rowMenu?.tIdx === tIdx && rowMenu?.rIdx === rIdx;
                          return (
                            <tr
                              key={rIdx}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                openRowContextMenu(e.clientX, e.clientY, tIdx, rIdx, 0);
                              }}
                              className={`group divide-x divide-slate-200 ${
                                isRowContextActive
                                  ? 'bg-sky-50/50'
                                  : isNonSatRow
                                  ? 'bg-red-50/50'
                                  : 'bg-white'
                              }`}
                            >
                              {table.headers.map((header, cIdx) => {
                                const cellVal = row[cIdx] ?? '';
                                const isCellEditing =
                                  editingCell?.tIdx === tIdx &&
                                  editingCell?.rIdx === rIdx &&
                                  editingCell?.cIdx === cIdx;
                                const isCellSelected =
                                  selectedCell?.tIdx === tIdx &&
                                  selectedCell?.rIdx === rIdx &&
                                  selectedCell?.cIdx === cIdx;
                                const isPos =
                                  (header === 'Conclusion' && cellVal === 'Satisfaisant') ||
                                  (header.startsWith('CTR') && cellVal === '+');
                                const isNeg =
                                  (header === 'Conclusion' && cellVal === 'Non-satisfaisant') ||
                                  (header.startsWith('CTR') && cellVal === '-');
                                const isNumeric =
                                  header === 'no' ||
                                  header === 'N°' ||
                                  header.includes('FCFA') ||
                                  header === 'Ecart' ||
                                  header.includes('(h)');

                                return (
                                  <td
                                    key={cIdx}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setSelectedCell({ tIdx, rIdx, cIdx });
                                      openRowContextMenu(
                                        e.clientX,
                                        e.clientY,
                                        tIdx,
                                        rIdx,
                                        cIdx
                                      );
                                    }}
                                    onClick={() => {
                                      setSelectedCell({ tIdx, rIdx, cIdx });
                                      if (editingEnabled && !isCellEditing && !isLocked) {
                                        handleStartEditCell(tIdx, rIdx, cIdx, cellVal);
                                      }
                                    }}
                                    onDoubleClick={() => {
                                      setSelectedCell({ tIdx, rIdx, cIdx });
                                      if (!isLocked) {
                                        handleStartEditCell(tIdx, rIdx, cIdx, cellVal);
                                      }
                                    }}
                                    title={
                                      isLocked
                                        ? 'Clic droit pour copier'
                                        : 'Double-clic pour modifier · Clic droit pour menu contextuel'
                                    }
                                    className={`px-3.5 py-2.5 align-top whitespace-pre-line leading-relaxed transition-colors ${
                                      isNumeric ? 'font-mono tabular-nums' : ''
                                    } ${
                                      isRubriqueDescTable && cIdx === 0
                                        ? 'font-medium text-slate-700'
                                        : ''
                                    } ${
                                      isNeg
                                        ? 'font-semibold text-red-700'
                                        : isPos
                                        ? 'font-semibold text-emerald-700'
                                        : ''
                                    } ${
                                      isCellSelected || isCellEditing
                                        ? 'bg-[#EAF4FF] ring-1 ring-inset ring-sky-500'
                                        : 'hover:bg-sky-50/75'
                                    } ${
                                      editingEnabled && !isLocked ? 'cursor-text' : ''
                                    }`}
                                  >
                                    {isCellEditing ? (
                                      <div className="flex flex-col gap-1">
                                        <textarea
                                          rows={Math.min(
                                            5,
                                            Math.max(2, cellDraft.split('\n').length)
                                          )}
                                          autoFocus
                                          value={cellDraft}
                                          onChange={(e) => setCellDraft(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                              e.preventDefault();
                                              handleCommitCell();
                                            } else if (e.key === 'Escape') {
                                              setEditingCell(null);
                                            }
                                          }}
                                          className="w-full min-w-[160px] rounded border border-sky-600 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none"
                                        />
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleCommitCell();
                                            }}
                                            className="rounded bg-[#8B0000] px-2 py-0.5 text-[10px] font-medium text-white hover:bg-[#720000] cursor-pointer"
                                          >
                                            Valider
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingCell(null);
                                            }}
                                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-600 cursor-pointer"
                                          >
                                            Annuler
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      cellVal || '—'
                                    )}
                                  </td>
                                );
                              })}
                              <td className="w-[1%] whitespace-nowrap px-1.5 py-2 text-right align-top">
                                <button
                                  type="button"
                                  title="Menu contextuel de la ligne"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    openRowContextMenu(
                                      rect.right - 220,
                                      rect.bottom + 4,
                                      tIdx,
                                      rIdx,
                                      0
                                    );
                                  }}
                                  className="rounded p-1 text-slate-400 opacity-65 transition-opacity hover:bg-slate-100 hover:text-slate-800 group-hover:opacity-100 cursor-pointer"
                                >
                                  <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Menu contextuel clic droit / ⋮ sur cellule & ligne de table partagée */}
      {rowMenu && activeMenuTable && (
        <div
          ref={rowMenuRef}
          role="menu"
          aria-label="Menu contextuel de la table"
          style={{ left: `${rowMenu.x}px`, top: `${rowMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[95] w-60 rounded-xl border border-slate-700 bg-slate-900 p-1.5 text-xs text-slate-100 shadow-2xl"
        >
          <div className="border-b border-slate-800 px-2.5 py-1.5">
            <div className="truncate font-semibold text-white">
              {activeMenuTable.title} · Ligne {rowMenu.rIdx + 1}
            </div>
            <div className="truncate text-[10px] text-slate-400">
              Colonne : {activeMenuHeader}
            </div>
          </div>

          <div className="py-1 space-y-0.5">
            {!isLocked && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setEditingEnabled(true);
                    handleStartEditCell(
                      rowMenu.tIdx,
                      rowMenu.rIdx,
                      rowMenu.cIdx,
                      activeMenuCellVal
                    );
                    setRowMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-800 cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                  <span>Modifier « {activeMenuHeader} »</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setEditingEnabled((prev) => !prev);
                    setRowMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-800 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                  <span>
                    {editingEnabled
                      ? "Quitter l'édition rapide"
                      : "Activer l'édition rapide"}
                  </span>
                </button>

                <div className="my-1 border-t border-slate-800" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleInsertRowAt(rowMenu.tIdx, rowMenu.rIdx)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-800 cursor-pointer"
                >
                  <ArrowUp className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Insérer une ligne au-dessus</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleInsertRowAt(rowMenu.tIdx, rowMenu.rIdx + 1)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-800 cursor-pointer"
                >
                  <ArrowDown className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Insérer une ligne en dessous</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleDuplicateRow(rowMenu.tIdx, rowMenu.rIdx)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-800 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                  <span>Dupliquer cette ligne</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleClearRow(rowMenu.tIdx, rowMenu.rIdx)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-amber-200 hover:bg-slate-800 cursor-pointer"
                >
                  <Eraser className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                  <span>Vider cette ligne</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={activeMenuTable.rows.length <= 1}
                  onClick={() => handleDeleteRow(rowMenu.tIdx, rowMenu.rIdx)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-red-300 hover:bg-red-950/60 disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
                  <span>Supprimer cette ligne</span>
                </button>
              </>
            )}

            <div className="my-1 border-t border-slate-800" />
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                void handleCopyText(activeMenuCellVal || '—', 'Cellule copiée')
              }
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span>Copier cette cellule</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const rowCells = activeMenuTable.rows[rowMenu.rIdx] || [];
                void handleCopyText(rowCells.join(' | '), 'Ligne copiée');
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span>Copier toute la ligne</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                void handleCopyText(
                  tablesToMarkdown([activeMenuTable]),
                  'Tableau Markdown copié'
                )
              }
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <Table2 className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
              <span>Copier la table (Markdown)</span>
            </button>

            {!isLocked && (
              <>
                <div className="my-1 border-t border-slate-800" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleResetStepToDefault}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span>Réinitialiser le modèle</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

