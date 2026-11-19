import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eraser,
  FileDown,
  FileSpreadsheet,
  FileText,
  FileUp,
  Heading1,
  Loader2,
  Lock,
  MessageSquarePlus,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  SeparatorHorizontal,
  Share2,
  Table2,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import {
  buildFormatageDataForNode,
  normalizeWorkflowBaseTables,
  ParsedBaseTable,
} from '../data/missionStepsFormatData';
import type {
  DocHeadingLevel,
  MissionStepDocBlock,
  MissionStepDocumentData,
} from '../types/missionStepDocument';
import { ClientSessionConfig, WorkflowTreeNode } from '../types/workflow';
import {
  getStepDocumentFromSqlite,
  getStepTablesFromSqlite,
  importMissionStepFromDocFile,
  importMissionStepFromDocReportFile,
  importMissionStepFromExcelFile,
  loadEAuditSqliteDb,
  SqliteMessageRow,
  tablesToMarkdown,
  updateStepDocumentInSqlite,
  updateStepTablesInSqlite,
} from '../utils/eAuditSqliteStore';
import { exportMissionStepToDoc } from '../utils/missionStepDocExporter';
import { exportMissionStepReportToDoc } from '../utils/missionStepDocReportExporter';
import {
  buildDefaultMissionStepReportDocument,
  countWordsInDocument,
  paginateMissionStepDocument,
  syncDocumentWithTables,
} from '../utils/missionStepDocumentModel';
import { exportMissionStepToExcel } from '../utils/missionStepExcelExporter';
import {
  getWorkflowTheme,
  loadSavedWorkflowTheme,
  WorkflowThemeId,
} from '../utils/workflowTheme';

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
  initialViewMode?: 'tables' | 'document';
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
  initialViewMode,
  onSendStepToChat,
  onSqliteSynced,
  onClose,
}) => {
  const [tables, setTables] = useState<ParsedBaseTable[]>([]);
  const [docData, setDocData] = useState<MissionStepDocumentData | null>(null);
  const [viewMode, setViewMode] = useState<'tables' | 'document'>(
    initialViewMode ?? 'tables'
  );
  const [activeThemeId, setActiveThemeId] = useState<WorkflowThemeId>(() =>
    loadSavedWorkflowTheme()
  );
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
  const [importingDoc, setImportingDoc] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [openHeaderSubmenu, setOpenHeaderSubmenu] = useState<'import' | 'export' | null>(null);
  const [openRowSubmenu, setOpenRowSubmenu] = useState<'import' | 'export' | null>(null);

  const prevNodeIdRef = useRef<string | null>(null);
  const editingCellRef = useRef(editingCell);
  editingCellRef.current = editingCell;
  const tablesRef = useRef(tables);
  tablesRef.current = tables;
  const rowMenuRef = useRef<HTMLDivElement | null>(null);
  const headerMenuWrapRef = useRef<HTMLDivElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const reportDocInputRef = useRef<HTMLInputElement | null>(null);
  const excelInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const syncTheme = () => setActiveThemeId(loadSavedWorkflowTheme());
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-workflow-theme'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  const formatPayload = useMemo(
    () => buildFormatageDataForNode(node, session.client, '2026'),
    [node, session.client]
  );

  // Charger les tables et le document Word structuré depuis externalTables ou aionui.db
  useEffect(() => {
    const isNodeChanged = prevNodeIdRef.current !== node.id;
    prevNodeIdRef.current = node.id;

    if (isNodeChanged) {
      setEditingCell(null);
      setSelectedCell(null);
      setRowMenu(null);
      setLastSyncNote(null);
      setImportError(null);
    }

    if (externalTables) {
      const normalizedExternal = normalizeWorkflowBaseTables(externalTables);
      if (!isNodeChanged && editingCellRef.current !== null) {
        return;
      }
      const db = loadEAuditSqliteDb(session);
      const savedDoc = getStepDocumentFromSqlite(db, node);
      const nextDoc = savedDoc
        ? syncDocumentWithTables(savedDoc, normalizedExternal)
        : buildDefaultMissionStepReportDocument(node, normalizedExternal, session.client);
      if (
        !isNodeChanged &&
        tablesToMarkdown(normalizedExternal) === tablesToMarkdown(tablesRef.current)
      ) {
        setDocData((prev) => prev ?? nextDoc);
        return;
      }
      setTables(normalizedExternal);
      setDocData(nextDoc);
      setSqliteRow(null);
      if (isNodeChanged) {
        if (initialViewMode) {
          setViewMode(initialViewMode);
        } else if (savedDoc?.sourceFileName) {
          setViewMode('document');
        }
      }
      return;
    }

    if (!isNodeChanged && editingCellRef.current !== null) {
      return;
    }

    const db = loadEAuditSqliteDb(session);
    const loaded = getStepTablesFromSqlite(db, node, session.client);
    const normalizedLoaded = normalizeWorkflowBaseTables(loaded.tables);
    const savedDoc = getStepDocumentFromSqlite(db, node);
    const nextDoc = savedDoc
      ? syncDocumentWithTables(savedDoc, normalizedLoaded)
      : buildDefaultMissionStepReportDocument(node, normalizedLoaded, session.client);

    if (
      !isNodeChanged &&
      tablesToMarkdown(normalizedLoaded) === tablesToMarkdown(tablesRef.current) &&
      refreshKey === 0
    ) {
      setDocData((prev) => prev ?? nextDoc);
      return;
    }
    setTables(normalizedLoaded);
    setDocData(nextDoc);
    setSqliteRow(loaded.messageRow);
    if (isNodeChanged || refreshKey > 0) {
      if (initialViewMode) {
        setViewMode(initialViewMode);
      } else if (isNodeChanged && savedDoc?.sourceFileName) {
        setViewMode('document');
      } else if (isNodeChanged && !savedDoc?.sourceFileName) {
        setViewMode('tables');
      }
    }
  }, [node, session.client, refreshKey, externalTables, initialViewMode]);

  useEffect(() => {
    if (!rowMenu && !openHeaderSubmenu) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (rowMenu && rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) {
        setRowMenu(null);
        setOpenRowSubmenu(null);
      }
      if (
        openHeaderSubmenu &&
        headerMenuWrapRef.current &&
        !headerMenuWrapRef.current.contains(e.target as Node)
      ) {
        setOpenHeaderSubmenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRowMenu(null);
        setOpenRowSubmenu(null);
        setOpenHeaderSubmenu(null);
      }
    };
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [rowMenu, openHeaderSubmenu]);

  const openRowContextMenu = (
    clientX: number,
    clientY: number,
    tIdx: number,
    rIdx: number,
    cIdx: number
  ) => {
    const menuWidth = 264;
    const menuHeight = isLocked ? 210 : 420;
    const maxX =
      typeof window !== 'undefined' ? window.innerWidth - menuWidth - 12 : clientX;
    const maxY =
      typeof window !== 'undefined' ? window.innerHeight - menuHeight - 12 : clientY;
    setOpenRowSubmenu(null);
    setOpenHeaderSubmenu(null);
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
    const baseDoc =
      docData ?? buildDefaultMissionStepReportDocument(node, nextTables, session.client);
    const syncedDoc = syncDocumentWithTables(baseDoc, nextTables);
    setDocData(syncedDoc);

    if (onExternalTablesChange) {
      updateStepDocumentInSqlite(
        node,
        nextTables,
        syncedDoc,
        'user_admin_oha',
        reason,
        session.client
      );
      onExternalTablesChange(nextTables, reason);
      setLastSyncNote('Synchronisé');
      return;
    }
    const { messageRow } = updateStepDocumentInSqlite(
      node,
      nextTables,
      syncedDoc,
      'user_admin_oha',
      reason,
      session.client
    );
    setSqliteRow(messageRow);
    setLastSyncNote(`Sauvegardé (${messageRow.id})`);
    onSqliteSynced?.(`SQLite v17 mis à jour · ${reason} (${messageRow.id})`, node, nextTables);
  };

  const persistDocumentOnly = (nextDoc: MissionStepDocumentData, reason: string) => {
    const withTs: MissionStepDocumentData = {
      ...nextDoc,
      updatedAt: Date.now(),
    };
    setDocData(withTs);
    const { messageRow } = updateStepDocumentInSqlite(
      node,
      tables,
      withTs,
      'user_admin_oha',
      reason,
      session.client
    );
    setSqliteRow(messageRow);
    setLastSyncNote(`Document sauvegardé (${messageRow.id})`);
  };

  const handleUpdateDocHeader = (text: string) => {
    if (!docData || isLocked) return;
    persistDocumentOnly({ ...docData, headerText: text }, 'Modification en-tête document Word');
  };

  const handleUpdateDocFooter = (text: string) => {
    if (!docData || isLocked) return;
    persistDocumentOnly({ ...docData, footerText: text }, 'Modification pied de page document Word');
  };

  const handleUpdateDocBlockText = (blockId: string, nextText: string) => {
    if (!docData || isLocked) return;
    const nextBlocks = docData.blocks.map((b) =>
      b.id === blockId && (b.type === 'heading' || b.type === 'paragraph')
        ? { ...b, text: nextText }
        : b
    );
    persistDocumentOnly({ ...docData, blocks: nextBlocks }, 'Modification texte rapport Word');
  };

  const handleAddDocBlock = (
    kind: 'heading-1' | 'heading-2' | 'heading-3' | 'paragraph' | 'page-break'
  ) => {
    if (isLocked) return;
    const currentDoc =
      docData ?? buildDefaultMissionStepReportDocument(node, tables, session.client);
    const id = `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let newBlock: MissionStepDocBlock;
    if (kind === 'page-break') {
      newBlock = { id, type: 'page-break' };
    } else if (kind.startsWith('heading-')) {
      const level = Number(kind.split('-')[1]) as DocHeadingLevel;
      newBlock = {
        id,
        type: 'heading',
        level,
        text:
          level === 1
            ? 'Nouvelle section principale'
            : level === 2
            ? 'Nouvelle sous-section'
            : 'Nouveau sous-titre de procédure',
      };
    } else {
      newBlock = {
        id,
        type: 'paragraph',
        text: "Saisissez le texte d'analyse ou les diligences d'audit de cette section...",
      };
    }
    setEditingEnabled(true);
    persistDocumentOnly(
      { ...currentDoc, blocks: [...currentDoc.blocks, newBlock] },
      `Ajout bloc ${kind} dans le rapport Word`
    );
  };

  const handleDeleteDocBlock = (blockId: string) => {
    if (!docData || isLocked) return;
    const target = docData.blocks.find((b) => b.id === blockId);
    if (!target || target.type === 'table') return;
    persistDocumentOnly(
      { ...docData, blocks: docData.blocks.filter((b) => b.id !== blockId) },
      'Suppression bloc texte dans le rapport Word'
    );
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
    const fresh = normalizeWorkflowBaseTables(formatPayload.baseTables);
    const freshDoc = buildDefaultMissionStepReportDocument(node, fresh, session.client);
    setRowMenu(null);
    setTables(fresh);
    setDocData(freshDoc);
    if (onExternalTablesChange) {
      updateStepDocumentInSqlite(
        node,
        fresh,
        freshDoc,
        'user_admin_oha',
        `Réinitialisation modèle (${formatPayload.reference})`,
        session.client
      );
      onExternalTablesChange(fresh, `Réinitialisation modèle (${formatPayload.reference})`);
      setLastSyncNote('Réinitialisé');
      return;
    }
    const { messageRow } = updateStepDocumentInSqlite(
      node,
      fresh,
      freshDoc,
      'user_admin_oha',
      `Réinitialisation modèle [Formatage data] (${formatPayload.reference})`,
      session.client
    );
    setSqliteRow(messageRow);
    setLastSyncNote(`Réinitialisé (${messageRow.id})`);
    onSqliteSynced?.(
      `Réinitialisation modèle [Formatage data] (${formatPayload.reference}) (${messageRow.id})`,
      node,
      fresh
    );
  };

  const triggerDocImportPicker = () => {
    if (isLocked || importingDoc) return;
    setRowMenu(null);
    setOpenRowSubmenu(null);
    setOpenHeaderSubmenu(null);
    setImportError(null);
    docInputRef.current?.click();
  };

  const triggerReportDocImportPicker = () => {
    if (isLocked || importingDoc) return;
    setRowMenu(null);
    setOpenRowSubmenu(null);
    setOpenHeaderSubmenu(null);
    setImportError(null);
    reportDocInputRef.current?.click();
  };

  const triggerExcelImportPicker = () => {
    if (isLocked || importingDoc) return;
    setRowMenu(null);
    setOpenRowSubmenu(null);
    setOpenHeaderSubmenu(null);
    setImportError(null);
    excelInputRef.current?.click();
  };

  const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isLocked) return;

    setImportingDoc(true);
    setImportError(null);
    try {
      const result = await importMissionStepFromDocFile(
        file,
        node,
        session.client,
        'user_admin_oha'
      );
      setEditingCell(null);
      setSelectedCell(null);
      setTables(result.tables);
      setSqliteRow(result.messageRow);
      setLastSyncNote(
        `Importé (.doc) : ${file.name} (${result.tables.length} tables · SQLite)`
      );
      if (onExternalTablesChange) {
        onExternalTablesChange(
          result.tables,
          `Import .doc (${file.name} · ${result.tables.length} tables)`
        );
      }
      onSqliteSynced?.(
        `Étape « ${node.label} » importée depuis « ${file.name} » (${result.tables.length} table(s)) et enregistrée dans SQLite`,
        node,
        result.tables
      );
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : `Erreur lors de l'import du fichier « ${file.name} ».`
      );
    } finally {
      setImportingDoc(false);
    }
  };

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isLocked) return;

    setImportingDoc(true);
    setImportError(null);
    try {
      const result = await importMissionStepFromExcelFile(
        file,
        node,
        session.client,
        'user_admin_oha'
      );
      setEditingCell(null);
      setSelectedCell(null);
      setTables(result.tables);
      setSqliteRow(result.messageRow);
      setLastSyncNote(
        `Importé (Excel) : ${file.name} (${result.tables.length} tables · SQLite)`
      );
      if (onExternalTablesChange) {
        onExternalTablesChange(
          result.tables,
          `Import Excel (${file.name} · ${result.tables.length} tables)`
        );
      }
      onSqliteSynced?.(
        `Étape « ${node.label} » importée depuis Excel « ${file.name} » (${result.tables.length} table(s)) et enregistrée dans SQLite`,
        node,
        result.tables
      );
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : `Erreur lors de l'import Excel du fichier « ${file.name} ».`
      );
    } finally {
      setImportingDoc(false);
    }
  };

  const handleReportDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isLocked) return;

    setImportingDoc(true);
    setImportError(null);
    try {
      const result = await importMissionStepFromDocReportFile(
        file,
        node,
        session.client,
        'user_admin_oha'
      );
      setEditingCell(null);
      setSelectedCell(null);
      setTables(result.tables);
      if (result.document) {
        setDocData(syncDocumentWithTables(result.document, result.tables));
      }
      setViewMode('document');
      setSqliteRow(result.messageRow);
      setLastSyncNote(
        `Rapport Word importé : ${file.name} (${result.tables.length} tables · SQLite)`
      );
      if (onExternalTablesChange) {
        onExternalTablesChange(
          result.tables,
          `Import Rapport Word (${file.name} · ${result.tables.length} tables)`
        );
      }
      onSqliteSynced?.(
        `Rapport Word « ${node.label} » importé depuis « ${file.name} » (${result.document?.blocks.length ?? 0} blocs, ${result.tables.length} table(s)) et enregistré dans SQLite`,
        node,
        result.tables
      );
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : `Erreur lors de l'import du rapport Word « ${file.name} ».`
      );
    } finally {
      setImportingDoc(false);
    }
  };

  const handleExportStepToDoc = () => {
    setImportError(null);
    setOpenHeaderSubmenu(null);
    setOpenRowSubmenu(null);
    setRowMenu(null);
    try {
      const result = exportMissionStepToDoc({
        node,
        tables,
        session,
      });
      setLastSyncNote(`Exporté : ${result.filename}`);
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : "Impossible d'exporter cette étape de mission en .doc."
      );
    }
  };

  const handleExportStepToDocReport = () => {
    setImportError(null);
    setOpenHeaderSubmenu(null);
    setOpenRowSubmenu(null);
    setRowMenu(null);
    try {
      const result = exportMissionStepReportToDoc({
        node,
        tables,
        document: docData,
        session,
      });
      setLastSyncNote(`Export Rapport : ${result.filename}`);
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : "Impossible d'exporter le rapport Word (.doc) de cette étape."
      );
    }
  };

  const handleExportStepToExcel = async () => {
    setImportError(null);
    setOpenHeaderSubmenu(null);
    setOpenRowSubmenu(null);
    setRowMenu(null);
    setExportingExcel(true);
    try {
      const result = await exportMissionStepToExcel({
        node,
        tables,
        session,
      });
      setLastSyncNote(`Exporté : ${result.filename}`);
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : "Impossible d'exporter cette étape de mission en Excel (.xlsx)."
      );
    } finally {
      setExportingExcel(false);
    }
  };

  const activeTheme = useMemo(
    () => getWorkflowTheme(activeThemeId),
    [activeThemeId]
  );
  const reportBrandRed = activeTheme.isLight ? '#8B0000' : activeTheme.tableHeadBg;
  const reportBrandDivider = activeTheme.isLight
    ? '#5C0A0A'
    : activeTheme.tableHeadDivider;
  const reportTintColBg =
    activeTheme.id === 'orange'
      ? '#FFF2E8'
      : activeTheme.id === 'rose'
      ? '#FDF0F6'
      : activeTheme.id === 'marron'
      ? '#F6EFEA'
      : '#F5E6EA';

  const resolvedDocument = useMemo(() => {
    const base =
      docData ?? buildDefaultMissionStepReportDocument(node, tables, session.client);
    return syncDocumentWithTables(base, tables);
  }, [docData, node, tables, session.client]);

  const paginatedPages = useMemo(
    () => paginateMissionStepDocument(resolvedDocument, tables),
    [resolvedDocument, tables]
  );

  const documentWordCount = useMemo(
    () => countWordsInDocument(resolvedDocument, tables),
    [resolvedDocument, tables]
  );

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
          className={`wf-step-topbar flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 text-xs ${
            compactHeader ? 'py-1.5' : 'px-3.5 py-2'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Table2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold" title={node.label}>
                  {node.label}
                </span>
                {compactHeader && (
                  <span className="wf-step-topbar-btn shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]">
                    {tables.length} table(s)
                  </span>
                )}
                {compactHeader && lastSyncNote && (
                  <span className="shrink-0 rounded bg-emerald-600/85 px-1.5 py-0.5 font-mono text-[10px] text-white">
                    {lastSyncNote}
                  </span>
                )}
              </div>
              {!compactHeader && (
                <div className="wf-step-topbar-sub flex items-center gap-1.5 text-[10px]">
                  <span>{formatPayload.phase}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatPayload.formatLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{formatPayload.reference}</span>
                </div>
              )}
            </div>
            {isLocked && (
              <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-label="Verrouillé" />
            )}
          </div>

          <div ref={headerMenuWrapRef} className="flex flex-wrap items-center gap-1.5 shrink-0">
            <input
              ref={docInputRef}
              type="file"
              accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => void handleDocFileChange(e)}
            />
            <input
              ref={reportDocInputRef}
              type="file"
              accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => void handleReportDocFileChange(e)}
            />
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.ods,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => void handleExcelFileChange(e)}
            />

            {/* Sélecteur de vue : Tables / Document Word paginé */}
            <div
              role="tablist"
              aria-label="Mode d'affichage de l'étape de mission"
              className="inline-flex items-center rounded-md border border-white/25 bg-black/20 p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'tables'}
                onClick={() => setViewMode('tables')}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                  viewMode === 'tables'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                <Table2 className="h-3 w-3" aria-hidden="true" />
                <span>Tables</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'document'}
                onClick={() => setViewMode('document')}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                  viewMode === 'document'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                <BookOpen className="h-3 w-3" aria-hidden="true" />
                <span>Document Word ({paginatedPages.length}p.)</span>
              </button>
            </div>

            {!isLocked && (
              <div className="relative">
                <button
                  type="button"
                  disabled={importingDoc}
                  aria-expanded={openHeaderSubmenu === 'import'}
                  onClick={() =>
                    setOpenHeaderSubmenu((prev) =>
                      prev === 'import' ? null : 'import'
                    )
                  }
                  title="Importer l'étape de mission (Tables .doc, Rapport Word .doc ou Excel .xlsx)"
                  className="inline-flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-60 cursor-pointer"
                >
                  {importingDoc ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <FileUp className="h-3 w-3" aria-hidden="true" />
                  )}
                  <span>{importingDoc ? 'Import en cours...' : 'Importer étape mission'}</span>
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${
                      openHeaderSubmenu === 'import' ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {openHeaderSubmenu === 'import' && (
                  <div
                    role="menu"
                    aria-label="Sous-menu format d'import étape de mission"
                    className="absolute right-0 top-full z-40 mt-1 w-64 rounded-lg border border-slate-700 bg-slate-900 p-1 text-[11px] text-slate-100 shadow-2xl"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={triggerDocImportPicker}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-800 cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden="true" />
                      <span>Word · Tables uniquement (.doc / .docx)</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={triggerReportDocImportPicker}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-800 cursor-pointer"
                    >
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden="true" />
                      <span>Word · Rapport / Document (.doc / .docx)</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={triggerExcelImportPicker}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-800 cursor-pointer"
                    >
                      <FileSpreadsheet
                        className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                        aria-hidden="true"
                      />
                      <span>Excel (.xlsx / .xls)</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              <button
                type="button"
                disabled={tables.length === 0 || exportingExcel}
                aria-expanded={openHeaderSubmenu === 'export'}
                onClick={() =>
                  setOpenHeaderSubmenu((prev) =>
                    prev === 'export' ? null : 'export'
                  )
                }
                title="Exporter l'étape de mission (Tables .doc, Rapport Word .doc ou Excel .xlsx)"
                className="wf-brand-btn inline-flex items-center gap-1 rounded border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {exportingExcel ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <FileDown className="h-3 w-3" aria-hidden="true" />
                )}
                <span>Exporter étape mission</span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    openHeaderSubmenu === 'export' ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {openHeaderSubmenu === 'export' && (
                <div
                  role="menu"
                  aria-label="Sous-menu format d'export étape de mission"
                  className="absolute right-0 top-full z-40 mt-1 w-64 rounded-lg border border-slate-700 bg-slate-900 p-1 text-[11px] text-slate-100 shadow-2xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportStepToDoc}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-800 cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden="true" />
                    <span>Word · Tables uniquement (.doc)</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportStepToDocReport}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-800 cursor-pointer"
                  >
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden="true" />
                    <span>Word · Rapport / Document (.doc)</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleExportStepToExcel()}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-800 cursor-pointer"
                  >
                    <FileSpreadsheet
                      className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                      aria-hidden="true"
                    />
                    <span>Excel (.xlsx)</span>
                  </button>
                </div>
              )}
            </div>
            {!isLocked && (
              <button
                type="button"
                onClick={() => setEditingEnabled((prev) => !prev)}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  editingEnabled
                    ? 'bg-amber-400 text-slate-950'
                    : 'wf-step-topbar-btn'
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
                className="wf-step-topbar-btn inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium cursor-pointer"
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
                className="wf-step-topbar-btn inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium cursor-pointer"
              >
                <MessageSquarePlus className="h-3 w-3" aria-hidden="true" />
                <span>Envoyer au chat</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer l'aperçu de l'étape de mission"
              className="wf-step-topbar-btn rounded p-1 cursor-pointer"
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

        {importError && (
          <div className="flex items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
            <span>{importError}</span>
            <button
              type="button"
              onClick={() => setImportError(null)}
              className="rounded px-1.5 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100 cursor-pointer"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Zone de contenu (pleine hauteur disponible) */}
        <div
          onScroll={() => rowMenu && setRowMenu(null)}
          className={`min-h-0 flex-1 overflow-y-auto ${
            viewMode === 'document' ? 'bg-[#DDE3EA]' : 'bg-[#F5F6F8]'
          } ${
            flushTop ? 'p-4 lg:p-5' : 'max-h-[52vh] min-h-[280px] p-4 lg:max-h-none lg:p-5'
          }`}
        >
          {viewMode === 'document' ? (
            <div className="mx-auto max-w-[850px] space-y-6 pb-8">
              {/* Ruban de statut Word (Pages, Mots, Outils d'édition du document) */}
              <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white/95 px-3.5 py-2 text-[11px] text-slate-700 shadow-sm backdrop-blur-sm">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                    <BookOpen className="h-3.5 w-3.5" style={{ color: reportBrandRed }} aria-hidden="true" />
                    <span>Mode Page Word A4</span>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>
                    <strong className="text-slate-900">{paginatedPages.length}</strong> page(s)
                  </span>
                  <span className="text-slate-300">·</span>
                  <span>
                    <strong className="text-slate-900">{documentWordCount}</strong> mots
                  </span>
                  <span className="text-slate-300">·</span>
                  <span>
                    <strong className="text-slate-900">{tables.length}</strong> tableau(x)
                  </span>
                  {resolvedDocument.sourceFileName && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="max-w-[200px] truncate rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-800">
                        {resolvedDocument.sourceFileName}
                      </span>
                    </>
                  )}
                </div>

                {!isLocked && (
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleAddDocBlock('heading-1')}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Heading1 className="h-3 w-3" style={{ color: reportBrandRed }} aria-hidden="true" />
                      <span>+ Titre</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddDocBlock('paragraph')}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Type className="h-3 w-3 text-slate-600" aria-hidden="true" />
                      <span>+ Paragraphe</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddDocBlock('page-break')}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <SeparatorHorizontal className="h-3 w-3 text-slate-500" aria-hidden="true" />
                      <span>+ Saut de page</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Pages A4 séquentielles */}
              {paginatedPages.map((page) => (
                <article
                  key={page.pageNumber}
                  aria-label={`Page ${page.pageNumber} sur ${page.totalPages}`}
                  className="relative mx-auto flex min-h-[1040px] w-full max-w-[816px] flex-col justify-between border border-[#C8D0DC] bg-white px-8 py-8 text-slate-900 shadow-[0_6px_22px_rgba(15,23,42,0.16)] sm:px-[60px] sm:py-[50px]"
                >
                  {/* Repères de marges Word (Print Layout crop marks) */}
                  <span aria-hidden="true" className="pointer-events-none absolute left-5 top-5 h-3.5 w-3.5 border-b border-r border-slate-300 sm:left-[44px] sm:top-[36px]" />
                  <span aria-hidden="true" className="pointer-events-none absolute right-5 top-5 h-3.5 w-3.5 border-b border-l border-slate-300 sm:right-[44px] sm:top-[36px]" />
                  <span aria-hidden="true" className="pointer-events-none absolute bottom-5 left-5 h-3.5 w-3.5 border-r border-t border-slate-300 sm:bottom-[36px] sm:left-[44px]" />
                  <span aria-hidden="true" className="pointer-events-none absolute bottom-5 right-5 h-3.5 w-3.5 border-l border-t border-slate-300 sm:bottom-[36px] sm:right-[44px]" />

                  {/* En-tête de page Word */}
                  <div>
                    <header
                      className="mb-5 border-b pb-1.5 text-[11px] font-normal"
                      style={{ borderColor: reportBrandRed, color: reportBrandRed }}
                    >
                      {editingEnabled && !isLocked ? (
                        <input
                          type="text"
                          defaultValue={resolvedDocument.headerText}
                          onBlur={(e) => {
                            if (e.target.value !== resolvedDocument.headerText) {
                              handleUpdateDocHeader(e.target.value);
                            }
                          }}
                          className="w-full bg-transparent text-[11px] focus:bg-rose-50/40 focus:outline-none"
                        />
                      ) : (
                        <span>{resolvedDocument.headerText}</span>
                      )}
                    </header>

                    {/* Corps de page */}
                    <div className="space-y-3">
                      {page.items.map((item) => {
                        const { block, resolvedTable, resolvedTableIndex } = item;

                        if (block.type === 'heading') {
                          const isH1 = block.level === 1;
                          const isH2 = block.level === 2;
                          return (
                            <div key={block.id} className="group relative">
                              {editingEnabled && !isLocked ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    defaultValue={block.text}
                                    onBlur={(e) => {
                                      if (e.target.value !== block.text) {
                                        handleUpdateDocBlockText(block.id, e.target.value);
                                      }
                                    }}
                                    style={{
                                      color: isH2 ? '#1E293B' : reportBrandRed,
                                      borderColor: isH1 ? reportBrandRed : undefined,
                                    }}
                                    className={`w-full bg-transparent focus:bg-slate-50 focus:outline-none ${
                                      isH1
                                        ? 'border-b-2 pb-1.5 pt-2 text-[20px] font-bold tracking-tight'
                                        : isH2
                                        ? 'pt-2.5 text-[15.5px] font-bold'
                                        : 'pt-1.5 text-[13.5px] font-bold'
                                    }`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDocBlock(block.id)}
                                    title="Supprimer ce titre"
                                    className="rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                </div>
                              ) : isH1 ? (
                                <h1
                                  className="border-b-2 pb-1.5 pt-2 text-[20px] font-bold tracking-tight"
                                  style={{ color: reportBrandRed, borderColor: reportBrandRed }}
                                >
                                  {block.text}
                                </h1>
                              ) : isH2 ? (
                                <h2 className="pt-2.5 text-[15.5px] font-bold text-[#1E293B]">
                                  {block.text}
                                </h2>
                              ) : (
                                <h3
                                  className="pt-1.5 text-[13.5px] font-bold"
                                  style={{ color: reportBrandRed }}
                                >
                                  {block.text}
                                </h3>
                              )}
                            </div>
                          );
                        }

                        if (block.type === 'paragraph') {
                          return (
                            <div key={block.id} className="group relative">
                              {editingEnabled && !isLocked ? (
                                <div className="flex items-start gap-1.5">
                                  <textarea
                                    rows={Math.max(2, Math.ceil((block.text?.length || 60) / 86))}
                                    defaultValue={block.text}
                                    onBlur={(e) => {
                                      if (e.target.value !== block.text) {
                                        handleUpdateDocBlockText(block.id, e.target.value);
                                      }
                                    }}
                                    className="w-full rounded border border-dashed border-slate-300 bg-slate-50/40 px-2 py-1 text-[13px] leading-[1.6] text-[#1E293B] focus:border-sky-500 focus:bg-white focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDocBlock(block.id)}
                                    title="Supprimer ce paragraphe"
                                    className="mt-1 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                </div>
                              ) : block.listType === 'bullet' ? (
                                <p className="pl-5 text-justify text-[13.5px] leading-[1.6] text-[#1E293B] -indent-3">
                                  <span aria-hidden="true" className="mr-1.5 font-bold" style={{ color: reportBrandRed }}>
                                    •
                                  </span>
                                  {block.text}
                                </p>
                              ) : (
                                <p className="text-justify text-[13.5px] leading-[1.6] text-[#1E293B]">
                                  {block.text}
                                </p>
                              )}
                            </div>
                          );
                        }

                        if (block.type === 'table' && resolvedTable && resolvedTableIndex !== undefined) {
                          const tIdx = resolvedTableIndex;
                          const isRubriqueDescTable =
                            resolvedTable.headers.length === 2 &&
                            resolvedTable.headers[0].trim().toLowerCase() === 'rubrique' &&
                            resolvedTable.headers[1].trim().toLowerCase() === 'description';

                          return (
                            <div key={block.id} className="my-3 overflow-x-auto">
                              <table className="w-full border-collapse border border-[#CBD5E1] text-left text-[12px]">
                                <thead>
                                  <tr
                                    className="divide-x font-semibold text-white"
                                    style={{
                                      backgroundColor: reportBrandRed,
                                      borderColor: reportBrandDivider,
                                    }}
                                  >
                                    {resolvedTable.headers.map((header, hIdx) => (
                                      <th
                                        key={hIdx}
                                        style={{ borderColor: reportBrandDivider }}
                                        className={`px-3 py-2 align-middle ${
                                          isRubriqueDescTable ? 'text-center' : 'text-left'
                                        } ${
                                          isRubriqueDescTable && hIdx === 0
                                            ? 'w-[28%] min-w-[140px]'
                                            : ''
                                        }`}
                                      >
                                        {header}
                                      </th>
                                    ))}
                                    {!isLocked && (
                                      <th
                                        style={{ borderColor: reportBrandDivider }}
                                        className="w-[1%] whitespace-nowrap px-1.5 py-1 text-right font-normal"
                                      >
                                        <div className="inline-flex items-center gap-0.5">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleInsertRowAt(tIdx, resolvedTable.rows.length)
                                            }
                                            title={`Ajouter une ligne dans ${resolvedTable.title}`}
                                            className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] text-white hover:bg-white/25 cursor-pointer"
                                          >
                                            +
                                          </button>
                                          <button
                                            type="button"
                                            title={`Options de ${resolvedTable.title}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              openRowContextMenu(
                                                rect.right - 220,
                                                rect.bottom + 4,
                                                tIdx,
                                                Math.max(0, resolvedTable.rows.length - 1),
                                                0
                                              );
                                            }}
                                            className="rounded p-0.5 text-white/90 hover:bg-white/20 cursor-pointer"
                                          >
                                            <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                                          </button>
                                        </div>
                                      </th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#CBD5E1] bg-white text-[#1E293B]">
                                  {resolvedTable.rows.map((row, rIdx) => (
                                    <tr
                                      key={rIdx}
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        openRowContextMenu(e.clientX, e.clientY, tIdx, rIdx, 0);
                                      }}
                                      className="divide-x divide-[#CBD5E1]"
                                    >
                                      {resolvedTable.headers.map((_, cIdx) => {
                                        const cellVal = row[cIdx] ?? '';
                                        const isCellEditing =
                                          editingCell?.tIdx === tIdx &&
                                          editingCell?.rIdx === rIdx &&
                                          editingCell?.cIdx === cIdx;
                                        const isRubriqueCol = isRubriqueDescTable && cIdx === 0;
                                        return (
                                          <td
                                            key={cIdx}
                                            style={{
                                              backgroundColor: isCellEditing
                                                ? '#EAF4FF'
                                                : isRubriqueCol
                                                ? reportTintColBg
                                                : '#FFFFFF',
                                            }}
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
                                            className={`px-3 py-2 align-top whitespace-pre-line leading-relaxed ${
                                              isRubriqueCol ? 'font-semibold text-slate-900' : ''
                                            } ${editingEnabled && !isLocked ? 'cursor-text' : ''}`}
                                          >
                                            {isCellEditing ? (
                                              <div className="flex flex-col gap-1">
                                                <textarea
                                                  rows={Math.min(5, Math.max(2, cellDraft.split('\n').length))}
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
                                                    className="wf-brand-btn rounded px-2 py-0.5 text-[10px] font-medium cursor-pointer"
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
                                      {!isLocked && (
                                        <td className="w-[1%] whitespace-nowrap px-1 py-1.5 text-right align-top">
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
                                            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                                          >
                                            <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  </div>

                  {/* Pied de page Word */}
                  <footer className="mt-8 border-t border-slate-200/80 pt-3 text-center text-[11px] text-slate-400">
                    {editingEnabled && !isLocked ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="text"
                          defaultValue={resolvedDocument.footerText}
                          onBlur={(e) => {
                            if (e.target.value !== resolvedDocument.footerText) {
                              handleUpdateDocFooter(e.target.value);
                            }
                          }}
                          className="w-full max-w-md bg-transparent text-center text-[11px] text-slate-500 focus:bg-slate-50 focus:outline-none"
                        />
                        <span className="shrink-0 font-medium text-slate-500">
                          — Page {page.pageNumber} / {page.totalPages}
                        </span>
                      </div>
                    ) : (
                      <span>
                        {resolvedDocument.footerText} — Page {page.pageNumber} / {page.totalPages}
                      </span>
                    )}
                  </footer>
                </article>
              ))}
            </div>
          ) : (
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
                        <tr className="wf-table-head-row divide-x text-[12px] font-semibold">
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
                                  className="wf-table-head-btn inline-flex items-center gap-0.5 rounded px-1.5 py-1 text-[10px] font-medium transition-colors cursor-pointer"
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
                                className="wf-table-head-btn rounded p-1 transition-colors cursor-pointer"
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
                                            className="wf-brand-btn rounded px-2 py-0.5 text-[10px] font-medium cursor-pointer"
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
          )}
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
                <div>
                  <button
                    type="button"
                    role="menuitem"
                    aria-expanded={openRowSubmenu === 'import'}
                    onClick={() =>
                      setOpenRowSubmenu((prev) => (prev === 'import' ? null : 'import'))
                    }
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sky-300 hover:bg-slate-800 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <FileUp className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                      <span>Importer étape mission</span>
                    </span>
                    <ChevronRight
                      className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                        openRowSubmenu === 'import' ? 'rotate-90' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {openRowSubmenu === 'import' && (
                    <div
                      role="menu"
                      aria-label="Formats d'import"
                      className="mx-1.5 my-1 space-y-0.5 rounded-lg border border-slate-800 bg-slate-950 p-1"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={triggerDocImportPicker}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                        <span>Word · Tables (.doc / .docx)</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={triggerReportDocImportPicker}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 cursor-pointer"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                        <span>Word · Rapport (.doc / .docx)</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={triggerExcelImportPicker}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 cursor-pointer"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        <span>Excel (.xlsx / .xls)</span>
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    role="menuitem"
                    aria-expanded={openRowSubmenu === 'export'}
                    onClick={() =>
                      setOpenRowSubmenu((prev) => (prev === 'export' ? null : 'export'))
                    }
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-rose-300 hover:bg-slate-800 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <FileDown className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                      <span>Exporter étape mission</span>
                    </span>
                    <ChevronRight
                      className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                        openRowSubmenu === 'export' ? 'rotate-90' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {openRowSubmenu === 'export' && (
                    <div
                      role="menu"
                      aria-label="Formats d'export"
                      className="mx-1.5 my-1 space-y-0.5 rounded-lg border border-slate-800 bg-slate-950 p-1"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleExportStepToDoc}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                        <span>Word · Tables (.doc)</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleExportStepToDocReport}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 cursor-pointer"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                        <span>Word · Rapport (.doc)</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void handleExportStepToExcel()}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 cursor-pointer"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        <span>Excel (.xlsx)</span>
                      </button>
                    </div>
                  )}
                </div>

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
            {isLocked && (
              <>
                <div className="my-1 border-t border-slate-800" />
                <div>
                  <button
                    type="button"
                    role="menuitem"
                    aria-expanded={openRowSubmenu === 'export'}
                    onClick={() =>
                      setOpenRowSubmenu((prev) => (prev === 'export' ? null : 'export'))
                    }
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-rose-300 hover:bg-slate-800 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <FileDown className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                      <span>Exporter étape mission</span>
                    </span>
                    <ChevronRight
                      className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                        openRowSubmenu === 'export' ? 'rotate-90' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {openRowSubmenu === 'export' && (
                    <div
                      role="menu"
                      aria-label="Formats d'export"
                      className="mx-1.5 my-1 space-y-0.5 rounded-lg border border-slate-800 bg-slate-950 p-1"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleExportStepToDoc}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                        <span>Word · Tables (.doc)</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleExportStepToDocReport}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 cursor-pointer"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                        <span>Word · Rapport (.doc)</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void handleExportStepToExcel()}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 cursor-pointer"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        <span>Excel (.xlsx)</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

