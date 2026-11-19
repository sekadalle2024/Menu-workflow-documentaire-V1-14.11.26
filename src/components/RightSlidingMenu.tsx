import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUp,
  BarChart3,
  BookOpen,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardCheck,
  ClipboardCopy,
  ClipboardList,
  CopyPlus,
  CornerLeftUp,
  Database,
  Dices,
  Download,
  ExternalLink,
  FileDown,
  FileSpreadsheet,
  FileUp,
  Folder,
  FolderKanban,
  FolderOpen,
  FolderUp,
  FileText,
  GanttChart,
  History,
  Info,
  KeyRound,
  Layers,
  Link2,
  ListTodo,
  Lock,
  Menu,
  MessageSquarePlus,
  MessageSquareWarning,
  MoreVertical,
  Move,
  Palette,
  Pencil,
  PenLine,
  Plus,
  Redo2,
  Search,
  Share2,
  ShieldAlert,
  Table2,
  Trash2,
  Undo2,
  Unlock,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { WORKFLOW_SIDEBAR_ITEMS } from '../data/workflowCatalog';
import {
  FeuilleCouvertureDocument,
  IntegratedCollectionDocument,
} from '../data/feuilleCouvertureTemplates';
import {
  AuditPlanMissionMeta,
  ClientSessionConfig,
  MissionTodoTask,
  RecoSourceMetadata,
  RiskCustomRubrique,
  RiskManagementMetadata,
  RiskSortDirection,
  RiskSortField,
  WorkflowNatureId,
  WorkflowNodeStatus,
  WorkflowTreeNode,
} from '../types/workflow';
import { NewTodoTaskInput } from '../utils/auditTodoOps';
import {
  AuditReadinessReport,
  buildParentCrossRefMap,
  collectAllCollections,
  collectAllNodesList,
  countDocumentsInNode,
  findNodeById,
  findNodePath,
  generateRandomAuditDocumentName,
  getWorkflowCheckState,
  hasLockedNodeInIds,
  isNodeLockedOrWithinLockedAncestor,
  NodeMoveDirection,
  runAuditReadinessCheck,
  WORKFLOW_STATUS_LABELS,
} from '../utils/workflowTreeOps';
import {
  extractSuiviRecosFromTrees,
  findRecoRecordByRefOrLabel,
} from '../data/suiviRecosSimulation';
import {
  collectDirectionContainersFromTrees,
  extractRisksFromTrees,
  findRiskRecordByRefOrLabel,
} from '../data/riskManagementData';
import { computeContextualWorkflowMetrics } from '../data/auditPlanWorkflowData';
import { IntegratedDataViewer } from './IntegratedDataViewer';
import { RecoInfoManagerPanel, RecoPanelViewMode } from './RecoInfoManagerPanel';
import {
  RiskDetailManagerPanel,
  RiskDetailPanelMode,
} from './RiskDetailManagerPanel';
import {
  NodeInspectorState,
  WorkflowNodeInspector,
} from './WorkflowNodeInspector';
import { AuditStatsDashboard } from './AuditStatsDashboard';
import {
  AuditPlanPanelMode,
  AuditPlanWorkflowPanel,
} from './AuditPlanWorkflowPanel';
import { ExportEtatsPanel } from './ExportEtatsPanel';
import {
  ExportActivityType,
  ExportFormatKind,
} from '../utils/etatExportEngine';
import { MissionStepTableViewer } from './MissionStepTableViewer';
import {
  buildFormatageDataForNode,
  ParsedBaseTable,
  resolveMissionStepClassification,
} from '../data/missionStepsFormatData';
import {
  getStepDocumentFromSqlite,
  getStepTablesFromSqlite,
  importMissionStepFromDocFile,
  importMissionStepFromDocReportFile,
  importMissionStepFromExcelFile,
  loadEAuditSqliteDb,
} from '../utils/eAuditSqliteStore';
import { exportMissionStepToDoc } from '../utils/missionStepDocExporter';
import { exportMissionStepReportToDoc } from '../utils/missionStepDocReportExporter';
import { exportMissionStepToExcel } from '../utils/missionStepExcelExporter';
import {
  getWorkflowTheme,
  WORKFLOW_THEMES,
  WorkflowThemeId,
} from '../utils/workflowTheme';

interface TriCheckboxProps {
  state: 'checked' | 'unchecked' | 'indeterminate';
  onChange: () => void;
  ariaLabel: string;
}

const TriCheckbox: React.FC<TriCheckboxProps> = ({ state, onChange, ariaLabel }) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = state === 'indeterminate';
    }
  }, [state]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={state === 'checked'}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
      className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-600 bg-slate-800 accent-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
    />
  );
};

interface ContextMenuState {
  x: number;
  y: number;
  node: WorkflowTreeNode | null;
}

interface RightSlidingMenuProps {
  isOpen: boolean;
  onClose: () => void;
  trees: WorkflowTreeNode[];
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onExpandBranch: (node: WorkflowTreeNode) => void;
  onCollapseBranch: (node: WorkflowTreeNode) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  checkedIds: Set<string>;
  onToggleCheck: (node: WorkflowTreeNode) => void;
  onSelectAll: () => void;
  onClearChecked: () => void;
  activatedSourceIds: string[];
  onActivateSource: (fallbackNodeId?: string) => void;
  onClearActivatedSource: () => void;
  onTransferToTarget: (targetId: string) => void;
  moveSourceIds: string[];
  onStartMoveNodes: (fallbackNodeId?: string) => void;
  onMoveToTarget: (destinationId: string, explicitSourceId?: string) => void;
  onMoveNodesByDirection: (direction: NodeMoveDirection, fallbackNodeId?: string) => void;
  onClearMoveSource: () => void;
  clipboardIds: string[];
  onCopyPasteAction: (fallbackNodeId?: string) => void;
  onClearClipboard: () => void;
  onSignNodes: (fallbackNodeId?: string) => void;
  onLockNodes: (targetIds: string[], pin: string) => void;
  onUnlockNode: (nodeId: string, pin: string) => boolean;
  onToggleManagerReview: (fallbackNodeId?: string) => void;
  openedWordDoc: WorkflowTreeNode | null;
  wordBodies: Record<string, string>;
  onUpdateWordBody: (docId: string, content: string) => void;
  onOpenWordDoc: (node: WorkflowTreeNode) => void;
  onCloseWordDoc: () => void;
  integratedDataDoc: { node: WorkflowTreeNode; data: FeuilleCouvertureDocument } | null;
  onIntegrateData: (node: WorkflowTreeNode) => void;
  onRegenerateIntegratedData: () => void;
  onCloseIntegratedData: () => void;
  integratedCollectionDoc: {
    node: WorkflowTreeNode;
    data: IntegratedCollectionDocument;
  } | null;
  onIntegrateCollection: (node: WorkflowTreeNode) => void;
  onRegenerateIntegratedCollection: () => void;
  onCloseIntegratedCollection: () => void;
  onExportCollectionArchive: (node: WorkflowTreeNode) => void;
  onMergeCollections: (
    sourceCollectionId: string,
    targetCollectionId: string,
    removeSource?: boolean
  ) => void;
  onAddExistingToCollection: (sourceIds: string[], targetCollectionId: string) => void;
  onOpenDocumentInChat: (node: WorkflowTreeNode) => void;
  onDownloadNodes: (fallbackNodeId?: string) => void;
  onExportArchive: (fallbackNodeId?: string) => void;
  onImportFilesToNode: (targetId: string, files: FileList) => void;
  onImportDirectoryToNode: (targetId: string, files: FileList) => void;
  onDuplicateNodes: (fallbackNodeId?: string) => void;
  onDeleteNodes: (fallbackNodeId?: string) => void;
  onRenameNode: (nodeId: string, newLabel: string) => void;
  onAddChildToNode: (
    targetId: string,
    label: string,
    kind: 'document' | 'section' | 'sous-section' | 'exercice' | 'sub-exercice' | 'collection'
  ) => void;
  onAddRandomDocument: (targetId: string) => void;
  onAddBlankWorkflow: (targetNodeId?: string) => void;
  onAddNatureWorkflow: (natureId: WorkflowNatureId, targetNodeId?: string) => void;
  session: ClientSessionConfig;
  onUpdateSession: (next: ClientSessionConfig) => void;
  onInitClient: () => void;
  onClearClientKeys: () => void;
  highlightedNodeId: string | null;
  statusMessage: string | null;
  canUndo: boolean;
  undoLabel?: string;
  canRedo: boolean;
  redoLabel?: string;
  onUndo: () => void;
  onRedo: () => void;
  onSetNodesStatus: (status: WorkflowNodeStatus, fallbackNodeId?: string) => void;
  onAddReviewNote: (nodeId: string, text: string) => void;
  onToggleReviewNote: (nodeId: string, noteId: string) => void;
  onDeleteReviewNote: (nodeId: string, noteId: string) => void;
  onSaveVersion: (nodeId: string, summary: string) => void;
  onRestoreVersion: (nodeId: string, versionId: string) => void;
  onAddCrossRef: (sourceId: string, targetRefId: string) => void;
  onRemoveCrossRef: (sourceId: string, targetRefId: string) => void;
  onAssignNodes: (targetIds: string[], assignee: string, dueDate: string) => void;
  onJumpToNode: (targetId: string) => void;
  onNavigateCrossRef: (targetId: string) => void;
  onAddTodoTask: (nodeId: string, input: NewTodoTaskInput) => void;
  onUpdateTodoTask: (
    nodeId: string,
    taskId: string,
    patch: Partial<MissionTodoTask>,
    auditLabel?: string
  ) => void;
  onDeleteTodoTask: (nodeId: string, taskId: string) => void;
  onClockInTodoTask: (nodeId: string, taskId: string) => void;
  onClockOutTodoTask: (nodeId: string, taskId: string) => void;
  onInjectPlanMissions: (targetNodeId: string, count: number) => void;
  onUpdatePlanStepDates: (
    stepNodeId: string,
    dateDebut: string,
    dateFin: string,
    dateFinReelle?: string
  ) => void;
  onUpdatePlanMissionMeta?: (
    missionNodeId: string,
    patch: Partial<AuditPlanMissionMeta> & { titre?: string }
  ) => void;
  onUpdateRecoMeta?: (
    recoNodeId: string,
    patch: Partial<RecoSourceMetadata>
  ) => void;
  onUpdateRiskMeta?: (
    riskNodeId: string,
    patch: Partial<RiskManagementMetadata>
  ) => void;
  riskCustomRubriques?: RiskCustomRubrique[];
  onAddRisk?: (targetNodeId?: string) => string | null;
  onDeleteRisk?: (riskNodeId: string) => string | null;
  onDuplicateRisk?: (riskNodeId: string) => string | null;
  onTransferRisk?: (
    riskNodeId: string,
    destinationDirectionNodeId: string
  ) => boolean;
  onAddRiskRubrique?: (input: {
    label: string;
    multiline?: boolean;
    initialValueForCurrent?: string;
    riskNodeId: string;
  }) => void;
  onSortRisks?: (
    field: RiskSortField,
    direction: RiskSortDirection,
    scopeNodeId?: string
  ) => void;
  onOpenAuditPlanTab: () => void;
  onOpenSuiviRecosAnalyticsTab?: () => void;
  onSendMissionStepToChat?: (node: WorkflowTreeNode, tables: ParsedBaseTable[]) => void;
  onSqliteSynced?: (
    detail: string,
    node?: WorkflowTreeNode,
    nextTables?: ParsedBaseTable[]
  ) => void;
  onShareNode?: (node: WorkflowTreeNode) => void;
  onShareMissionStep?: (node: WorkflowTreeNode, tables: ParsedBaseTable[]) => void;
  sqliteRefreshNonce?: number;
  workflowThemeId?: WorkflowThemeId;
  onSelectWorkflowTheme?: (themeId: WorkflowThemeId) => void;
}

function nodeMatchesSearch(node: WorkflowTreeNode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (node.label.toLowerCase().includes(q)) return true;
  return Boolean(node.children?.some((c) => nodeMatchesSearch(c, q)));
}

export const RightSlidingMenu: React.FC<RightSlidingMenuProps> = ({
  isOpen,
  onClose,
  trees,
  expandedIds,
  onToggleExpand,
  onExpandBranch,
  onCollapseBranch,
  onExpandAll,
  onCollapseAll,
  checkedIds,
  onToggleCheck,
  onSelectAll,
  onClearChecked,
  activatedSourceIds,
  onActivateSource,
  onClearActivatedSource,
  onTransferToTarget,
  moveSourceIds,
  onStartMoveNodes,
  onMoveToTarget,
  onMoveNodesByDirection,
  onClearMoveSource,
  clipboardIds,
  onCopyPasteAction,
  onClearClipboard,
  onSignNodes,
  onLockNodes,
  onUnlockNode,
  onToggleManagerReview,
  openedWordDoc,
  wordBodies,
  onUpdateWordBody,
  onOpenWordDoc,
  onCloseWordDoc,
  integratedDataDoc,
  onIntegrateData,
  onRegenerateIntegratedData,
  onCloseIntegratedData,
  integratedCollectionDoc,
  onIntegrateCollection,
  onRegenerateIntegratedCollection,
  onCloseIntegratedCollection,
  onExportCollectionArchive,
  onMergeCollections,
  onAddExistingToCollection,
  onOpenDocumentInChat,
  onDownloadNodes,
  onExportArchive,
  onImportFilesToNode,
  onImportDirectoryToNode,
  onDuplicateNodes,
  onDeleteNodes,
  onRenameNode,
  onAddChildToNode,
  onAddRandomDocument,
  onAddBlankWorkflow,
  onAddNatureWorkflow,
  session,
  onUpdateSession,
  onInitClient,
  onClearClientKeys,
  highlightedNodeId,
  statusMessage,
  canUndo,
  undoLabel,
  canRedo,
  redoLabel,
  onUndo,
  onRedo,
  onSetNodesStatus,
  onAddReviewNote,
  onToggleReviewNote,
  onDeleteReviewNote,
  onSaveVersion,
  onRestoreVersion,
  onAddCrossRef,
  onRemoveCrossRef,
  onAssignNodes,
  onJumpToNode,
  onNavigateCrossRef,
  onAddTodoTask,
  onUpdateTodoTask,
  onDeleteTodoTask,
  onClockInTodoTask,
  onClockOutTodoTask,
  onInjectPlanMissions,
  onUpdatePlanStepDates,
  onUpdatePlanMissionMeta,
  onUpdateRecoMeta,
  onUpdateRiskMeta,
  riskCustomRubriques = [],
  onAddRisk,
  onDeleteRisk,
  onDuplicateRisk,
  onTransferRisk,
  onAddRiskRubrique,
  onSortRisks,
  onOpenAuditPlanTab,
  onOpenSuiviRecosAnalyticsTab,
  onSendMissionStepToChat,
  onSqliteSynced,
  onShareNode,
  onShareMissionStep,
  sqliteRefreshNonce = 0,
  workflowThemeId = 'bordeaux',
  onSelectWorkflowTheme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showApiPanel, setShowApiPanel] = useState(false);
  const [showStatsDashboard, setShowStatsDashboard] = useState(false);
  const [userKeyDraft, setUserKeyDraft] = useState(session.userApiKey);
  const [teamKeyDraft, setTeamKeyDraft] = useState(session.teamApiKey);
  const [sigDraft, setSigDraft] = useState(session.userSignature);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const [addingTarget, setAddingTarget] = useState<{
    targetId: string;
    targetLabel: string;
    kind: 'document' | 'section' | 'sous-section' | 'exercice' | 'sub-exercice' | 'collection';
  } | null>(null);
  const [addLabelDraft, setAddLabelDraft] = useState('');

  const [mergeCollectionPrompt, setMergeCollectionPrompt] = useState<{
    sourceId: string;
    sourceLabel: string;
    targetId: string;
    removeSource: boolean;
  } | null>(null);

  const [addToCollectionPrompt, setAddToCollectionPrompt] = useState<{
    collectionId: string;
    collectionLabel: string;
    selectedIds: string[];
    filterText: string;
  } | null>(null);

  const [collectionPickerPrompt, setCollectionPickerPrompt] = useState<{
    action:
      | 'merge'
      | 'duplicate'
      | 'integrate'
      | 'export'
      | 'import-file'
      | 'import-dir'
      | 'delete';
    actionLabel: string;
    selectedCollectionId: string;
  } | null>(null);

  const [pinPrompt, setPinPrompt] = useState<{
    mode: 'lock' | 'unlock';
    targetIds: string[];
    targetLabel: string;
    error?: string;
  } | null>(null);
  const [pinDraft, setPinDraft] = useState('');

  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showNatureSubmenu, setShowNatureSubmenu] = useState(false);
  const [showStatusSubmenu, setShowStatusSubmenu] = useState(false);
  const [showExportEtatSubmenu, setShowExportEtatSubmenu] = useState(false);
  const [inspector, setInspector] = useState<NodeInspectorState | null>(null);
  const [readinessReport, setReadinessReport] = useState<AuditReadinessReport | null>(null);
  const [openedRecoInfoId, setOpenedRecoInfoId] = useState<string | null>(null);
  const [openedRecoInitialView, setOpenedRecoInitialView] =
    useState<RecoPanelViewMode>('accordeon');
  const [openedRecoScopeId, setOpenedRecoScopeId] = useState<string | undefined>(
    undefined
  );
  const [openedRiskInfoId, setOpenedRiskInfoId] = useState<string | null>(null);
  const [openedRiskScopeId, setOpenedRiskScopeId] = useState<string | undefined>(
    undefined
  );
  const [openedRiskPanelMode, setOpenedRiskPanelMode] =
    useState<RiskDetailPanelMode>('detail');
  const [openedRiskModeNonce, setOpenedRiskModeNonce] = useState(0);
  const [openedRiskActionBanner, setOpenedRiskActionBanner] = useState<string | null>(
    null
  );
  const [openedAuditPlanState, setOpenedAuditPlanState] = useState<{
    mode: AuditPlanPanelMode;
    scopeNodeId?: string;
    missionId?: string;
    stepId?: string;
  } | null>(null);
  const [openedExportEtat, setOpenedExportEtat] = useState<{
    activity: ExportActivityType;
    mode: ExportFormatKind;
    scopeNodeId?: string;
    nonce: number;
  } | null>(null);
  const [openedMissionStepNode, setOpenedMissionStepNode] = useState<WorkflowTreeNode | null>(null);
  const [missionStepInitialViewMode, setMissionStepInitialViewMode] = useState<
    'tables' | 'document' | undefined
  >(undefined);
  const [showStepHeaderSubmenu, setShowStepHeaderSubmenu] = useState(false);
  const [showHeaderThemeSubmenu, setShowHeaderThemeSubmenu] = useState(false);
  const [showStepMenuThemesOpen, setShowStepMenuThemesOpen] = useState(false);
  const [showCtxThemeSubmenu, setShowCtxThemeSubmenu] = useState(false);
  const [showStepImportSubmenu, setShowStepImportSubmenu] = useState(false);
  const [showStepExportSubmenu, setShowStepExportSubmenu] = useState(false);
  const [isImportingStepDoc, setIsImportingStepDoc] = useState(false);
  const activeWorkflowTheme = getWorkflowTheme(workflowThemeId);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const importDirInputRef = useRef<HTMLInputElement | null>(null);
  const importTargetIdRef = useRef<string | null>(null);
  const stepDocInputRef = useRef<HTMLInputElement | null>(null);
  const stepReportDocInputRef = useRef<HTMLInputElement | null>(null);
  const stepExcelInputRef = useRef<HTMLInputElement | null>(null);
  const stepDocTargetNodeRef = useRef<WorkflowTreeNode | null>(null);

  const openedRecoInfoNode = useMemo(
    () => (openedRecoInfoId ? findNodeById(trees, openedRecoInfoId) : null),
    [trees, openedRecoInfoId]
  );

  const openedRecoInfoRecord = useMemo(
    () =>
      openedRecoInfoNode
        ? openedRecoInfoNode.recoMeta ??
          findRecoRecordByRefOrLabel(openedRecoInfoNode.label) ??
          null
        : null,
    [openedRecoInfoNode]
  );

  const openedRiskInfoNode = useMemo(
    () => (openedRiskInfoId ? findNodeById(trees, openedRiskInfoId) : null),
    [trees, openedRiskInfoId]
  );

  const openedRiskInfoRecord = useMemo(
    () =>
      openedRiskInfoNode
        ? openedRiskInfoNode.riskMeta ??
          findRiskRecordByRefOrLabel(openedRiskInfoNode.label) ??
          null
        : null,
    [openedRiskInfoNode]
  );

  const riskDirectionOptions = useMemo(
    () => collectDirectionContainersFromTrees(trees),
    [trees]
  );

  const isMissionStepTopMode = Boolean(
    openedMissionStepNode &&
      !openedWordDoc &&
      !integratedDataDoc &&
      !integratedCollectionDoc &&
      !(openedRecoInfoNode && openedRecoInfoRecord) &&
      !(openedRiskInfoNode && openedRiskInfoRecord) &&
      !openedAuditPlanState &&
      !openedExportEtat
  );

  useEffect(() => {
    if (openedWordDoc || integratedDataDoc || integratedCollectionDoc) {
      setOpenedRecoInfoId(null);
      setOpenedRecoScopeId(undefined);
      setOpenedRiskInfoId(null);
      setOpenedRiskScopeId(undefined);
      setOpenedAuditPlanState(null);
      setOpenedExportEtat(null);
      setOpenedMissionStepNode(null);
      setShowStepHeaderSubmenu(false);
    }
  }, [openedWordDoc, integratedDataDoc, integratedCollectionDoc]);

  const openMissionStepPanel = (
    targetNode: WorkflowTreeNode,
    preferredViewMode?: 'tables' | 'document'
  ) => {
    if (isNodeLockedOrWithinLockedAncestor(trees, targetNode.id) || targetNode.locked) {
      return;
    }
    if (openedWordDoc) onCloseWordDoc();
    if (integratedDataDoc) onCloseIntegratedData();
    if (integratedCollectionDoc) onCloseIntegratedCollection();
    setOpenedRecoInfoId(null);
    setOpenedRecoScopeId(undefined);
    setOpenedRiskInfoId(null);
    setOpenedRiskScopeId(undefined);
    setOpenedAuditPlanState(null);
    setOpenedExportEtat(null);
    setMissionStepInitialViewMode(preferredViewMode);
    setOpenedMissionStepNode(targetNode);
    setShowStepHeaderSubmenu(false);
    onJumpToNode(targetNode.id);
  };

  const triggerStepDocImportFromMenu = (targetNode: WorkflowTreeNode) => {
    if (isNodeLockedOrWithinLockedAncestor(trees, targetNode.id) || targetNode.locked) {
      return;
    }
    stepDocTargetNodeRef.current = targetNode;
    stepDocInputRef.current?.click();
  };

  const triggerStepReportDocImportFromMenu = (targetNode: WorkflowTreeNode) => {
    if (isNodeLockedOrWithinLockedAncestor(trees, targetNode.id) || targetNode.locked) {
      return;
    }
    stepDocTargetNodeRef.current = targetNode;
    stepReportDocInputRef.current?.click();
  };

  const triggerStepExcelImportFromMenu = (targetNode: WorkflowTreeNode) => {
    if (isNodeLockedOrWithinLockedAncestor(trees, targetNode.id) || targetNode.locked) {
      return;
    }
    stepDocTargetNodeRef.current = targetNode;
    stepExcelInputRef.current?.click();
  };

  const handleContextMenuStepDocChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    const targetNode = stepDocTargetNodeRef.current;
    e.target.value = '';
    if (!file || !targetNode) return;
    if (isNodeLockedOrWithinLockedAncestor(trees, targetNode.id) || targetNode.locked) {
      return;
    }
    setIsImportingStepDoc(true);
    try {
      const result = await importMissionStepFromDocFile(
        file,
        targetNode,
        session.client,
        'user_admin_oha'
      );
      const updatedNode: WorkflowTreeNode = {
        ...targetNode,
        sqliteHasData: true,
      };
      onSqliteSynced?.(
        `Étape « ${targetNode.label} » importée depuis « ${file.name} » (${result.tables.length} table(s)) et sauvegardée dans SQLite`,
        updatedNode,
        result.tables
      );
      openMissionStepPanel(updatedNode);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : `Impossible d'importer le fichier « ${file.name} ».`;
      onSqliteSynced?.(`Erreur import étape mission (.doc) : ${msg}`);
    } finally {
      setIsImportingStepDoc(false);
    }
  };

  const handleContextMenuStepExcelChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    const targetNode = stepDocTargetNodeRef.current;
    e.target.value = '';
    if (!file || !targetNode) return;
    if (isNodeLockedOrWithinLockedAncestor(trees, targetNode.id) || targetNode.locked) {
      return;
    }
    setIsImportingStepDoc(true);
    try {
      const result = await importMissionStepFromExcelFile(
        file,
        targetNode,
        session.client,
        'user_admin_oha'
      );
      const updatedNode: WorkflowTreeNode = {
        ...targetNode,
        sqliteHasData: true,
      };
      onSqliteSynced?.(
        `Étape « ${targetNode.label} » importée depuis Excel « ${file.name} » (${result.tables.length} table(s)) et sauvegardée dans SQLite`,
        updatedNode,
        result.tables
      );
      openMissionStepPanel(updatedNode);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : `Impossible d'importer le fichier Excel « ${file.name} ».`;
      onSqliteSynced?.(`Erreur import étape mission (Excel) : ${msg}`);
    } finally {
      setIsImportingStepDoc(false);
    }
  };

  const handleContextMenuStepReportDocChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    const targetNode = stepDocTargetNodeRef.current;
    e.target.value = '';
    if (!file || !targetNode) return;
    if (isNodeLockedOrWithinLockedAncestor(trees, targetNode.id) || targetNode.locked) {
      return;
    }
    setIsImportingStepDoc(true);
    try {
      const result = await importMissionStepFromDocReportFile(
        file,
        targetNode,
        session.client,
        'user_admin_oha'
      );
      const updatedNode: WorkflowTreeNode = {
        ...targetNode,
        sqliteHasData: true,
      };
      onSqliteSynced?.(
        `Rapport Word « ${targetNode.label} » importé depuis « ${file.name} » (${result.document?.blocks.length ?? 0} bloc(s), ${result.tables.length} table(s)) et sauvegardé dans SQLite`,
        updatedNode,
        result.tables
      );
      openMissionStepPanel(updatedNode, 'document');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : `Impossible d'importer le rapport Word « ${file.name} ».`;
      onSqliteSynced?.(`Erreur import rapport Word (.doc) : ${msg}`);
    } finally {
      setIsImportingStepDoc(false);
    }
  };

  const handleExportStepDocFromMenu = (targetNode: WorkflowTreeNode) => {
    try {
      const db = loadEAuditSqliteDb(session);
      const { tables } = getStepTablesFromSqlite(db, targetNode, session.client);
      const res = exportMissionStepToDoc({
        node: targetNode,
        tables,
        session,
      });
      onSqliteSynced?.(
        `Étape « ${targetNode.label} » exportée en .doc (${res.filename} · ${res.tableCount} table(s))`
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Impossible d'exporter cette étape de mission en .doc.";
      onSqliteSynced?.(`Erreur export étape mission (.doc) : ${msg}`);
    }
  };

  const handleExportStepDocReportFromMenu = (targetNode: WorkflowTreeNode) => {
    try {
      const db = loadEAuditSqliteDb(session);
      const { tables } = getStepTablesFromSqlite(db, targetNode, session.client);
      const documentData = getStepDocumentFromSqlite(db, targetNode);
      const res = exportMissionStepReportToDoc({
        node: targetNode,
        tables,
        document: documentData,
        session,
      });
      onSqliteSynced?.(
        `Rapport Word « ${targetNode.label} » exporté (${res.filename} · ${res.tableCount} table(s))`
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Impossible d'exporter le rapport Word (.doc) de cette étape.";
      onSqliteSynced?.(`Erreur export rapport Word (.doc) : ${msg}`);
    }
  };

  const handleExportStepExcelFromMenu = async (targetNode: WorkflowTreeNode) => {
    try {
      const db = loadEAuditSqliteDb(session);
      const { tables } = getStepTablesFromSqlite(db, targetNode, session.client);
      const res = await exportMissionStepToExcel({
        node: targetNode,
        tables,
        session,
      });
      onSqliteSynced?.(
        `Étape « ${targetNode.label} » exportée en Excel (${res.filename} · ${res.tableCount} table(s))`
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Impossible d'exporter cette étape de mission en Excel.";
      onSqliteSynced?.(`Erreur export étape mission (Excel) : ${msg}`);
    }
  };

  const openExportEtatPanel = (
    activity: ExportActivityType,
    mode: ExportFormatKind,
    targetNode: WorkflowTreeNode | null
  ) => {
    if (openedWordDoc) onCloseWordDoc();
    if (integratedDataDoc) onCloseIntegratedData();
    if (integratedCollectionDoc) onCloseIntegratedCollection();
    setOpenedRecoInfoId(null);
    setOpenedRecoScopeId(undefined);
    setOpenedRiskInfoId(null);
    setOpenedRiskScopeId(undefined);
    setOpenedAuditPlanState(null);
    setOpenedMissionStepNode(null);
    const resolvedScopeId =
      !targetNode
        ? undefined
        : activity === 'document'
        ? targetNode.id
        : activity === 'etape-mission'
        ? targetNode.natureId === 'plan-audit'
          ? targetNode.id
          : undefined
        : targetNode.natureId === activity
        ? targetNode.id
        : undefined;
    setOpenedExportEtat({
      activity,
      mode,
      scopeNodeId: resolvedScopeId,
      nonce: Date.now(),
    });
  };

  const openRecoInfoPanel = (
    targetNode: WorkflowTreeNode,
    initialView: RecoPanelViewMode = 'accordeon',
    scopeId?: string
  ) => {
    if (openedWordDoc) onCloseWordDoc();
    if (integratedDataDoc) onCloseIntegratedData();
    if (integratedCollectionDoc) onCloseIntegratedCollection();
    setOpenedRiskInfoId(null);
    setOpenedRiskScopeId(undefined);
    setOpenedAuditPlanState(null);
    setOpenedExportEtat(null);
    setOpenedMissionStepNode(null);

    const directReco =
      targetNode.recoMeta ??
      (targetNode.nodeType === 'sous-section' && targetNode.natureId === 'suivi-recos'
        ? findRecoRecordByRefOrLabel(targetNode.label)
        : undefined);

    let resolvedNode: WorkflowTreeNode | undefined = directReco ? targetNode : undefined;
    let resolvedScopeId = scopeId;

    if (!resolvedNode) {
      const scopedEntries = extractSuiviRecosFromTrees(trees, scopeId ?? targetNode.id);
      if (scopedEntries.length > 0) {
        resolvedNode = scopedEntries[0].node;
        resolvedScopeId = scopeId ?? targetNode.id;
      } else {
        const fallbackEntries = extractSuiviRecosFromTrees(trees);
        resolvedNode = fallbackEntries[0]?.node;
        resolvedScopeId = undefined;
      }
    }

    if (!resolvedNode) return;
    setOpenedRecoInitialView(initialView);
    setOpenedRecoScopeId(resolvedScopeId);
    setOpenedRecoInfoId(resolvedNode.id);
    onJumpToNode(resolvedNode.id);
  };

  const openRiskDetailPanel = (
    targetNode: WorkflowTreeNode | null,
    scopeId?: string,
    mode: RiskDetailPanelMode = 'detail',
    banner: string | null = null
  ) => {
    if (openedWordDoc) onCloseWordDoc();
    if (integratedDataDoc) onCloseIntegratedData();
    if (integratedCollectionDoc) onCloseIntegratedCollection();
    setOpenedRecoInfoId(null);
    setOpenedRecoScopeId(undefined);
    setOpenedAuditPlanState(null);
    setOpenedExportEtat(null);
    setOpenedMissionStepNode(null);

    const directRisk =
      targetNode?.riskMeta ??
      (targetNode && targetNode.natureId === 'risk-management' && targetNode.nodeType === 'document'
        ? findRiskRecordByRefOrLabel(targetNode.label)
        : undefined);

    let resolvedNode: WorkflowTreeNode | undefined =
      directRisk && targetNode ? targetNode : undefined;
    let resolvedScopeId = scopeId;

    if (!resolvedNode) {
      const candidateScopeId = scopeId ?? targetNode?.id;
      const scopedEntries = candidateScopeId
        ? extractRisksFromTrees(trees, candidateScopeId)
        : [];
      if (scopedEntries.length > 0) {
        resolvedNode = scopedEntries[0].node;
        resolvedScopeId = candidateScopeId;
      } else if (openedRiskInfoNode) {
        resolvedNode = openedRiskInfoNode;
        resolvedScopeId = openedRiskScopeId;
      } else {
        const fallbackEntries = extractRisksFromTrees(trees);
        resolvedNode = fallbackEntries[0]?.node;
        resolvedScopeId = undefined;
      }
    }

    if (!resolvedNode) return;
    setOpenedRiskScopeId(resolvedScopeId);
    setOpenedRiskInfoId(resolvedNode.id);
    setOpenedRiskPanelMode(mode);
    setOpenedRiskModeNonce((n) => n + 1);
    setOpenedRiskActionBanner(banner);
    onJumpToNode(resolvedNode.id);
  };

  const resolveTargetRiskNode = (ctxNode: WorkflowTreeNode | null): WorkflowTreeNode | null => {
    if (
      ctxNode &&
      (ctxNode.riskMeta ||
        (ctxNode.natureId === 'risk-management' && ctxNode.nodeType === 'document'))
    ) {
      return ctxNode;
    }
    if (openedRiskInfoNode) return openedRiskInfoNode;
    if (ctxNode) {
      const scoped = extractRisksFromTrees(trees, ctxNode.id);
      if (scoped.length > 0) return scoped[0].node;
    }
    return extractRisksFromTrees(trees)[0]?.node ?? null;
  };

  const handleRiskAddAction = (ctxNode: WorkflowTreeNode | null) => {
    if (!onAddRisk) return;
    const insertRefId = ctxNode?.id ?? openedRiskInfoNode?.id;
    const createdId = onAddRisk(insertRefId);
    if (!createdId) return;
    if (openedWordDoc) onCloseWordDoc();
    if (integratedDataDoc) onCloseIntegratedData();
    if (integratedCollectionDoc) onCloseIntegratedCollection();
    setOpenedRecoInfoId(null);
    setOpenedRecoScopeId(undefined);
    setOpenedAuditPlanState(null);
    setOpenedExportEtat(null);
    setOpenedMissionStepNode(null);
    setOpenedRiskScopeId(undefined);
    setOpenedRiskInfoId(createdId);
    setOpenedRiskPanelMode('blank-new');
    setOpenedRiskModeNonce((n) => n + 1);
    setOpenedRiskActionBanner('Nouvelle page de détail vierge créée — renseignez les rubriques ci-dessous.');
  };

  const handleRiskDeleteAction = (riskNodeId: string) => {
    if (!onDeleteRisk) return;
    const nextRiskId = onDeleteRisk(riskNodeId);
    if (nextRiskId) {
      setOpenedRiskInfoId(nextRiskId);
      setOpenedRiskPanelMode('detail');
      setOpenedRiskModeNonce((n) => n + 1);
      setOpenedRiskActionBanner('Risque supprimé — redirection automatique vers le risque suivant.');
    } else {
      setOpenedRiskInfoId(null);
      setOpenedRiskScopeId(undefined);
      setOpenedRiskActionBanner(null);
    }
  };

  const handleRiskDuplicateAction = (riskNodeId: string) => {
    if (!onDuplicateRisk) return;
    const duplicatedId = onDuplicateRisk(riskNodeId);
    if (!duplicatedId) return;
    if (openedWordDoc) onCloseWordDoc();
    if (integratedDataDoc) onCloseIntegratedData();
    if (integratedCollectionDoc) onCloseIntegratedCollection();
    setOpenedRecoInfoId(null);
    setOpenedRecoScopeId(undefined);
    setOpenedAuditPlanState(null);
    setOpenedExportEtat(null);
    setOpenedMissionStepNode(null);
    setOpenedRiskInfoId(duplicatedId);
    setOpenedRiskPanelMode('detail');
    setOpenedRiskModeNonce((n) => n + 1);
    setOpenedRiskActionBanner('Risque dupliqué — affichage de la fiche dupliquée.');
  };

  const openAuditPlanPanel = (
    panelMode: AuditPlanPanelMode,
    targetNode: WorkflowTreeNode | null
  ) => {
    if (openedWordDoc) onCloseWordDoc();
    if (integratedDataDoc) onCloseIntegratedData();
    if (integratedCollectionDoc) onCloseIntegratedCollection();
    setOpenedRecoInfoId(null);
    setOpenedRiskInfoId(null);
    setOpenedRiskScopeId(undefined);
    setOpenedExportEtat(null);
    setOpenedMissionStepNode(null);

    const path = targetNode ? findNodePath(trees, targetNode.id) || [] : [];
    const missionNode =
      targetNode?.planMissionMeta
        ? targetNode
        : [...path].reverse().find((p) => Boolean(p.planMissionMeta));
    const natureNode =
      targetNode?.nodeType === 'nature' && targetNode.natureId === 'plan-audit'
        ? targetNode
        : [...path].reverse().find((p) => p.nodeType === 'nature' && p.natureId === 'plan-audit');
    const stepNode = targetNode?.planStepMeta?.stepNumber ? targetNode : undefined;

    setOpenedAuditPlanState({
      mode: panelMode,
      scopeNodeId: natureNode?.id || targetNode?.id,
      missionId: missionNode?.id,
      stepId: stepNode?.id,
    });
    if (missionNode && !expandedIds.has(missionNode.id)) {
      onToggleExpand(missionNode.id);
    }
    if (targetNode) {
      onJumpToNode(targetNode.id);
    }
  };

  useEffect(() => {
    setUserKeyDraft(session.userApiKey);
    setTeamKeyDraft(session.teamApiKey);
    setSigDraft(session.userSignature);
  }, [session]);

  useEffect(() => {
    if (!isOpen || !highlightedNodeId) return;
    const raf = requestAnimationFrame(() => {
      const targetEl = document.querySelector(
        `[data-wf-node-id="${highlightedNodeId}"]`
      );
      targetEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, highlightedNodeId]);

  useEffect(() => {
    if (!isOpen) {
      setContextMenu(null);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isEditingText = targetTag === 'input' || targetTag === 'textarea';

      if (!isEditingText && (e.ctrlKey || e.metaKey)) {
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
          if (canUndo) {
            e.preventDefault();
            onUndo();
          }
          return;
        }
        if (
          e.key.toLowerCase() === 'y' ||
          (e.key.toLowerCase() === 'z' && e.shiftKey)
        ) {
          if (canRedo) {
            e.preventDefault();
            onRedo();
          }
          return;
        }
      }

      if (e.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null);
        } else if (collectionPickerPrompt) {
          setCollectionPickerPrompt(null);
        } else if (mergeCollectionPrompt) {
          setMergeCollectionPrompt(null);
        } else if (addToCollectionPrompt) {
          setAddToCollectionPrompt(null);
        } else if (pinPrompt) {
          setPinPrompt(null);
        } else if (renamingId) {
          setRenamingId(null);
        } else if (addingTarget) {
          setAddingTarget(null);
        } else if (inspector) {
          setInspector(null);
        } else if (openedRecoInfoId) {
          setOpenedRecoInfoId(null);
          setOpenedRecoScopeId(undefined);
        } else if (openedAuditPlanState) {
          setOpenedAuditPlanState(null);
        } else if (openedExportEtat) {
          setOpenedExportEtat(null);
        } else {
          onClose();
        }
      }
    };
    const onClickOutside = (e: MouseEvent) => {
      if (
        contextMenu &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [
    isOpen,
    onClose,
    renamingId,
    addingTarget,
    collectionPickerPrompt,
    mergeCollectionPrompt,
    addToCollectionPrompt,
    contextMenu,
    pinPrompt,
    inspector,
    openedRecoInfoId,
    openedAuditPlanState,
    openedExportEtat,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
  ]);

  const visibleRoots = useMemo(() => {
    return trees.filter((root) => {
      if (root.id === 'root-workflow') return session.userWorkflowVisible;
      if (root.id === 'root-team-workflow') return session.teamWorkflowVisible;
      return true;
    });
  }, [trees, session.userWorkflowVisible, session.teamWorkflowVisible]);

  const allVisibleNodes = useMemo(
    () => collectAllNodesList(visibleRoots),
    [visibleRoots]
  );

  const checkedNodes = useMemo(
    () => allVisibleNodes.filter((n) => checkedIds.has(n.id)),
    [allVisibleNodes, checkedIds]
  );

  const checkedNonRootNodes = useMemo(
    () => checkedNodes.filter((n) => n.nodeType !== 'root'),
    [checkedNodes]
  );

  const hasLockedChecked = useMemo(
    () => hasLockedNodeInIds(trees, checkedNonRootNodes.map((n) => n.id)),
    [trees, checkedNonRootNodes]
  );

  const parentCrossRefMap = useMemo(() => buildParentCrossRefMap(trees), [trees]);

  const effectiveTransferCount =
    activatedSourceIds.length > 0 ? activatedSourceIds.length : checkedNonRootNodes.length;

  const isSearching = searchQuery.trim().length > 0;

  const openContextMenuAt = (x: number, y: number, node: WorkflowTreeNode | null) => {
    const menuWidth = 288;
    const menuHeight = node ? 640 : 420;
    const clampedX = Math.min(x, window.innerWidth - menuWidth - 12);
    const clampedY = Math.min(y, window.innerHeight - menuHeight - 12);
    setShowNatureSubmenu(false);
    setShowStatusSubmenu(false);
    setShowCtxThemeSubmenu(false);
    setShowStepImportSubmenu(false);
    setShowStepExportSubmenu(false);
    setShowExportEtatSubmenu(
      node?.natureId === 'suivi-recos' || node?.natureId === 'plan-audit'
    );
    setContextMenu({
      x: Math.max(12, clampedX),
      y: Math.max(12, clampedY),
      node,
    });
  };

  const handleValidateKeys = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSession({
      ...session,
      userSignature: (sigDraft.trim() || 'OHA').toUpperCase().slice(0, 3),
      userApiKey: userKeyDraft.trim(),
      teamApiKey: teamKeyDraft.trim(),
      userWorkflowVisible: userKeyDraft.trim().length > 0,
      teamWorkflowVisible: teamKeyDraft.trim().length > 0,
    });
  };

  const handleConfirmRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (renamingId && renameDraft.trim()) {
      onRenameNode(renamingId, renameDraft.trim());
    }
    setRenamingId(null);
  };

  const handleConfirmAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingTarget || !addLabelDraft.trim()) return;
    onAddChildToNode(addingTarget.targetId, addLabelDraft.trim(), addingTarget.kind);
    setAddLabelDraft('');
    setAddingTarget(null);
  };

  const handleConfirmPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinPrompt) return;
    if (!/^\d{4}$/.test(pinDraft)) {
      setPinPrompt({ ...pinPrompt, error: 'Saisissez un code secret exactement à 4 chiffres.' });
      return;
    }
    if (pinPrompt.mode === 'lock') {
      onLockNodes(pinPrompt.targetIds, pinDraft);
      setPinDraft('');
      setPinPrompt(null);
      return;
    }
    const ok = onUnlockNode(pinPrompt.targetIds[0], pinDraft);
    if (!ok) {
      setPinPrompt({ ...pinPrompt, error: 'Code PIN incorrect. Veuillez réessayer.' });
      return;
    }
    setPinDraft('');
    setPinPrompt(null);
  };

  const renderNode = (
    node: WorkflowTreeNode,
    level: number,
    ancestorLocked = false
  ): React.ReactNode => {
    if (!nodeMatchesSearch(node, searchQuery)) return null;

    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isExpanded = isSearching ? true : expandedIds.has(node.id);
    const checkState = getWorkflowCheckState(node, checkedIds);
    const isHighlighted = highlightedNodeId === node.id;
    const isArmed = activatedSourceIds.includes(node.id);
    const isMoveSource = moveSourceIds.includes(node.id);
    const isClipboardSource = clipboardIds.includes(node.id);
    const isDragTarget = dragOverNodeId === node.id;
    const isRenaming = renamingId === node.id;
    const isContextTarget = contextMenu?.node?.id === node.id;
    const effectivelyLocked = ancestorLocked || Boolean(node.locked);

    const renderNodeIcon = () => {
      if (node.nodeType === 'root') {
        return node.id === 'root-team-workflow' ? (
          <Users className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
        ) : (
          <FolderOpen className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
        );
      }
      if (node.nodeType === 'signature') {
        return null;
      }
      if (node.nodeType === 'collection') {
        return <Layers className="h-4 w-4 shrink-0 text-violet-400" aria-hidden="true" />;
      }
      if (node.nodeType === 'document') {
        return <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />;
      }
      return isExpanded ? (
        <FolderOpen className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
      ) : (
        <Folder className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      );
    };
    const collectionDocCount =
      node.nodeType === 'collection' ? countDocumentsInNode(node) : 0;

    return (
      <div key={node.id} className="select-none">
        <div
          role="treeitem"
          data-wf-node-id={node.id}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={checkState === 'checked'}
          draggable={node.nodeType !== 'root' && !effectivelyLocked && !isRenaming}
          onDragStart={(e) => {
            if (node.nodeType === 'root' || effectivelyLocked) {
              e.preventDefault();
              return;
            }
            e.stopPropagation();
            setDraggedNodeId(node.id);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', node.id);
          }}
          onDragOver={(e) => {
            if (!draggedNodeId || draggedNodeId === node.id) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            if (dragOverNodeId !== node.id) setDragOverNodeId(node.id);
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
            if (dragOverNodeId === node.id) setDragOverNodeId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const sourceId = draggedNodeId || e.dataTransfer.getData('text/plain');
            setDraggedNodeId(null);
            setDragOverNodeId(null);
            if (sourceId && sourceId !== node.id) {
              onMoveToTarget(node.id, sourceId);
            }
          }}
          onDragEnd={() => {
            setDraggedNodeId(null);
            setDragOverNodeId(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openContextMenuAt(e.clientX, e.clientY, node);
          }}
          style={{ paddingLeft: `${level * 16 + 6}px` }}
          className={`group flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-sm transition-colors ${
            isDragTarget
              ? 'bg-amber-950/70 text-white ring-2 ring-amber-400'
              : isContextTarget
              ? 'bg-slate-800 text-white ring-1 ring-blue-400'
              : isHighlighted
              ? 'bg-blue-900/60 text-white ring-1 ring-blue-500/70'
              : isMoveSource
              ? 'bg-amber-950/50 text-amber-100 ring-1 ring-amber-500/60'
              : isClipboardSource
              ? 'bg-indigo-950/50 text-indigo-100 ring-1 ring-indigo-500/60'
              : isArmed
              ? 'bg-emerald-950/60 text-emerald-100 ring-1 ring-emerald-500/60'
              : 'text-slate-100 hover:bg-slate-800/75'
          }`}
        >
          <button
            type="button"
            disabled={!hasChildren}
            onClick={() => hasChildren && onToggleExpand(node.id)}
            aria-label={hasChildren ? `${isExpanded ? 'Replier' : 'Déplier'} ${node.label}` : undefined}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 ${
              hasChildren ? 'cursor-pointer hover:bg-slate-700/60 hover:text-white' : 'cursor-default'
            }`}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              )
            ) : (
              <span className="h-1 w-1 rounded-full bg-slate-600" aria-hidden="true" />
            )}
          </button>

          <TriCheckbox
            state={checkState}
            onChange={() => onToggleCheck(node)}
            ariaLabel={`Sélectionner ${node.label}`}
          />

          {isRenaming ? (
            <form onSubmit={handleConfirmRename} className="flex flex-1 items-center gap-1.5">
              <input
                type="text"
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                className="min-w-0 flex-1 rounded border border-blue-500 bg-slate-950 px-2 py-0.5 text-xs text-white focus:outline-none"
              />
              <button
                type="submit"
                className="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-500 cursor-pointer"
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => setRenamingId(null)}
                className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Annuler
              </button>
            </form>
          ) : (
            <button
              type="button"
              disabled={node.nodeType === 'document' && effectivelyLocked}
              onClick={() => {
                const isRecoNode =
                  Boolean(node.recoMeta) ||
                  (node.nodeType === 'sous-section' &&
                    node.natureId === 'suivi-recos' &&
                    Boolean(findRecoRecordByRefOrLabel(node.label)));
                const isRiskDocNode =
                  Boolean(node.riskMeta) ||
                  (node.nodeType === 'document' &&
                    node.natureId === 'risk-management' &&
                    Boolean(findRiskRecordByRefOrLabel(node.label)));
                if (node.nodeType === 'document') {
                  if (!effectivelyLocked) {
                    const stepCls = resolveMissionStepClassification(node);
                    if (stepCls.isStep) {
                      openMissionStepPanel(node);
                    } else if (isRiskDocNode) {
                      openRiskDetailPanel(node);
                    } else {
                      onOpenWordDoc(node);
                    }
                  }
                } else if (node.natureId === 'plan-audit' && Boolean(node.planMissionMeta)) {
                  const isAlreadyActiveMission =
                    openedAuditPlanState?.mode === 'integrale' &&
                    openedAuditPlanState?.missionId === node.id;
                  if (isExpanded && isAlreadyActiveMission) {
                    onToggleExpand(node.id);
                  } else {
                    if (!isExpanded) {
                      onToggleExpand(node.id);
                    }
                    openAuditPlanPanel('integrale', node);
                  }
                } else if (isRecoNode) {
                  const isAlreadyActiveReco = openedRecoInfoId === node.id;
                  if (isExpanded && isAlreadyActiveReco) {
                    onToggleExpand(node.id);
                  } else {
                    if (hasChildren && !isExpanded) {
                      onToggleExpand(node.id);
                    }
                    openRecoInfoPanel(node, 'accordeon');
                  }
                } else if (hasChildren) {
                  onToggleExpand(node.id);
                } else {
                  onToggleCheck(node);
                }
              }}
              className={`flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-blue-400 rounded ${
                node.nodeType === 'document' && effectivelyLocked
                  ? 'cursor-not-allowed opacity-70'
                  : 'cursor-pointer'
              }`}
            >
              {renderNodeIcon()}
              <span
                className={`min-w-0 flex-1 truncate ${
                  node.nodeType === 'root'
                    ? 'font-display font-semibold text-white'
                    : node.nodeType === 'exercice'
                    ? 'font-display font-semibold text-blue-200'
                    : node.nodeType === 'collection'
                    ? 'font-medium text-violet-200'
                    : node.nodeType === 'nature'
                    ? 'font-medium text-slate-100'
                    : node.nodeType === 'signature'
                    ? 'font-mono text-xs font-semibold text-amber-300'
                    : 'text-slate-200'
                }`}
                title={node.nodeType === 'signature' ? `[${node.label}]` : node.label}
              >
                {node.nodeType === 'signature' ? `[${node.label}]` : node.label}
              </span>
              {node.nodeType === 'collection' && (
                <span
                  title={`${collectionDocCount} document(s) dans cette collection`}
                  className="shrink-0 rounded border border-violet-600/60 bg-violet-950/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-violet-200 tabular-nums"
                >
                  {collectionDocCount} doc
                </span>
              )}
              {node.status && (
                <span
                  title={`Statut : ${WORKFLOW_STATUS_LABELS[node.status]}`}
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    node.status === 'validated'
                      ? 'bg-emerald-400'
                      : node.status === 'in-review'
                      ? 'bg-amber-400'
                      : node.status === 'in-progress'
                      ? 'bg-sky-400'
                      : 'bg-slate-500'
                  }`}
                />
              )}
              {(node.assignee || node.dueDate) && (
                <span
                  title={`Assigné à ${node.assignee || 'non défini'}${
                    node.dueDate ? ` · Échéance ${node.dueDate}` : ''
                  }`}
                  className={`hidden shrink-0 font-mono text-[10px] sm:inline ${
                    node.dueDate &&
                    node.dueDate < new Date().toISOString().slice(0, 10) &&
                    node.status !== 'validated'
                      ? 'text-red-400'
                      : 'text-slate-400'
                  }`}
                >
                  {node.assignee ? `@${node.assignee}` : ''}
                  {node.assignee && node.dueDate ? ' · ' : ''}
                  {node.dueDate ? node.dueDate.slice(5) : ''}
                </span>
              )}
              {(() => {
                const openNotesCount = (node.reviewNotes || []).filter(
                  (rn) => rn.status === 'open'
                ).length;
                if (openNotesCount === 0) return null;
                return (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspector({ mode: 'notes', nodeId: node.id });
                    }}
                    title={`${openNotesCount} note(s) de revue ouverte(s)`}
                    className="inline-flex shrink-0 items-center gap-0.5 text-amber-400 hover:text-amber-300"
                  >
                    <MessageSquareWarning className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="font-mono text-[10px] tabular-nums">{openNotesCount}</span>
                  </span>
                );
              })()}
              {node.todoTasks && node.todoTasks.length > 0 && (() => {
                const doneCount = node.todoTasks.filter((t) => t.status === 'done').length;
                const hasBlocked = node.todoTasks.some((t) => t.status === 'blocked');
                return (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspector({ mode: 'todo', nodeId: node.id });
                    }}
                    title={`To-do liste (8h/j) : ${doneCount}/${node.todoTasks.length} terminée(s)`}
                    className={`inline-flex shrink-0 items-center gap-0.5 rounded border px-1 py-0.5 font-mono text-[10px] tabular-nums ${
                      hasBlocked
                        ? 'border-red-700/70 bg-red-950/60 text-red-300'
                        : 'border-teal-700/70 bg-teal-950/60 text-teal-300'
                    }`}
                  >
                    <ListTodo className="h-3 w-3" aria-hidden="true" />
                    <span>
                      {doneCount}/{node.todoTasks.length}
                    </span>
                  </span>
                );
              })()}
              {node.managerReviewed && (
                <span
                  title="Revue manager effectuée"
                  className="inline-flex shrink-0 items-center text-emerald-400"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" aria-label="Revue manager" />
                </span>
              )}
              {node.locked && (
                <span
                  title="Verrouillé par code PIN"
                  className="inline-flex shrink-0 items-center text-amber-400"
                >
                  <Lock className="h-3.5 w-3.5" aria-label="Verrouillé" />
                </span>
              )}
            </button>
          )}

          {/* Bouton rapide Plan annuel d'audit (Tableau 10 col / Gantt 2 niveaux) */}
          {!isRenaming &&
            node.natureId === 'plan-audit' &&
            (node.nodeType === 'nature' || Boolean(node.planMissionMeta)) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openAuditPlanPanel(
                    node.planMissionMeta ? 'gantt-mission' : 'integrer',
                    node
                  );
                }}
                title={
                  node.planMissionMeta
                    ? `Ouvrir le Gantt Niveau 1 & Plan intégral (${node.planMissionMeta.code})`
                    : 'Ouvrir le Plan annuel d’audit (Tableau 10 colonnes & Gantt)'
                }
                className="inline-flex shrink-0 items-center gap-1 rounded border border-teal-700/80 bg-teal-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-teal-300 transition-colors hover:bg-teal-800/80 hover:text-white cursor-pointer"
              >
                <CalendarRange className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {node.planMissionMeta ? 'Gantt' : 'Plan 2026'}
                </span>
              </button>
            )}

          {/* Bouton Parent -> Enfants (Indigo : aller vers références enfants) */}
          {!isRenaming && node.crossRefs && node.crossRefs.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (node.crossRefs!.length === 1) {
                  onNavigateCrossRef(node.crossRefs![0]);
                } else {
                  setInspector({ mode: 'crossrefs', nodeId: node.id });
                }
              }}
              title={
                node.crossRefs.length === 1
                  ? 'Cross-référence enfant : cliquer pour sélectionner et ouvrir le document'
                  : `${node.crossRefs.length} références enfants : cliquer pour choisir et ouvrir`
              }
              aria-label={`Aller vers référence enfant (${node.crossRefs.length})`}
              className="inline-flex shrink-0 items-center gap-0.5 rounded border border-indigo-700/70 bg-indigo-950/70 px-1.5 py-0.5 text-indigo-300 hover:bg-indigo-900/80 hover:text-white cursor-pointer"
            >
              <Link2 className="h-3 w-3 text-indigo-400" aria-hidden="true" />
              <ArrowDownRight className="h-3 w-3 text-indigo-400" aria-hidden="true" />
              <span className="font-mono text-[10px] font-semibold tabular-nums">
                {node.crossRefs.length}
              </span>
            </button>
          )}

          {/* Bouton Enfant -> Parents identifiés (Cyan + CornerLeftUp : couleur & icône différentes) */}
          {!isRenaming &&
            (() => {
              const parentRefs = parentCrossRefMap.get(node.id) || [];
              if (parentRefs.length === 0) return null;
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (parentRefs.length === 1) {
                      onNavigateCrossRef(parentRefs[0].id);
                    } else {
                      setInspector({ mode: 'crossrefs', nodeId: node.id });
                    }
                  }}
                  title={`Parent(s) référent(s) : ${parentRefs
                    .map((p) => p.label)
                    .join(', ')} — cliquer pour sélectionner et ouvrir le parent`}
                  aria-label={`Aller vers le parent référent (${parentRefs.length})`}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded border border-cyan-600/70 bg-cyan-950/75 px-1.5 py-0.5 text-cyan-200 hover:bg-cyan-900/80 hover:text-white cursor-pointer"
                >
                  <CornerLeftUp className="h-3 w-3 text-cyan-400" aria-hidden="true" />
                  <span className="font-mono text-[10px] font-semibold tabular-nums">
                    {parentRefs.length}
                  </span>
                </button>
              );
            })()}

          {!isRenaming && node.nodeType === 'document' && (
            <button
              type="button"
              disabled={effectivelyLocked}
              onClick={() => !effectivelyLocked && onOpenDocumentInChat(node)}
              title={
                effectivelyLocked
                  ? 'Document verrouillé — déverrouillez avec le code PIN'
                  : 'Intégrer dans le contexte du chat'
              }
              aria-label={`Intégrer ${node.label} au chat`}
              className="shrink-0 rounded p-1 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-700 hover:text-blue-300 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}

          {!isRenaming && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                openContextMenuAt(rect.right - 250, rect.bottom + 4, node);
              }}
              title="Menu d'actions (clic droit)"
              aria-label={`Actions pour ${node.label}`}
              className="shrink-0 rounded p-1 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-700 hover:text-white focus-visible:opacity-100 cursor-pointer"
            >
              <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}

          {!isRenaming && hasChildren && node.nodeType !== 'collection' && (
            <span className="shrink-0 font-mono text-[11px] text-slate-400 tabular-nums">
              {node.children!.length}
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="ml-3.5 border-l border-slate-700/70">
            {node.children!.map((child) => renderNode(child, level + 1, effectivelyLocked))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <input
        ref={importInputRef}
        type="file"
        multiple
        accept=".zip,.json,.txt,.md,.csv,.doc,.docx,.pdf,.xlsx"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          const targetId = importTargetIdRef.current;
          if (files && files.length > 0 && targetId) {
            onImportFilesToNode(targetId, files);
          }
          e.target.value = '';
        }}
      />

      <input
        ref={importDirInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          const targetId = importTargetIdRef.current;
          if (files && files.length > 0 && targetId) {
            onImportDirectoryToNode(targetId, files);
          }
          e.target.value = '';
        }}
      />

      <input
        ref={stepDocInputRef}
        type="file"
        accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          void handleContextMenuStepDocChange(e);
        }}
      />

      <input
        ref={stepReportDocInputRef}
        type="file"
        accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          void handleContextMenuStepReportDocChange(e);
        }}
      />

      <input
        ref={stepExcelInputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.ods,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(e) => {
          void handleContextMenuStepExcelChange(e);
        }}
      />

      <div
        aria-hidden={!isOpen}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] transition-opacity duration-200 ${
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        id="dossier-mission-panel"
        aria-label="Menu coulissant — Workflows documentaires"
        aria-hidden={!isOpen}
        className={`wf-sliding-aside fixed top-0 right-0 z-50 flex h-full w-full flex-col border-l shadow-2xl transition-[transform,max-width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          openedWordDoc ||
          integratedDataDoc ||
          integratedCollectionDoc ||
          (openedRecoInfoNode && openedRecoInfoRecord) ||
          (openedRiskInfoNode && openedRiskInfoRecord) ||
          openedAuditPlanState ||
          openedExportEtat ||
          openedMissionStepNode
            ? 'max-w-[1440px]'
            : 'max-w-[780px]'
        } ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header identité & accès API — masqué quand une étape de mission occupe toute la partie haute */}
        {!isMissionStepTopMode && (
        <div className="wf-theme-chrome relative flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="font-display truncate text-base font-semibold text-white">
              Menu coulissant · Workflows documentaires
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {session.client} · {session.email} · Signature{' '}
              <span className="font-mono text-slate-200">{session.userSignature}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(onShareNode || onShareMissionStep) && (
              <button
                type="button"
                onClick={() => {
                  if (openedMissionStepNode && onShareNode) {
                    onShareNode(openedMissionStepNode);
                    return;
                  }
                  const checkedFirst =
                    checkedNonRootNodes[0] ??
                    (highlightedNodeId ? findNodeById(trees, highlightedNodeId) : null) ??
                    findNodeById(trees, 'user-2026-ex-audit') ??
                    visibleRoots[0];
                  if (checkedFirst && onShareNode) {
                    onShareNode(checkedFirst);
                  }
                }}
                title="Générer une URL de partage collaborative sans compte"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/80 bg-emerald-600/20 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-600 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Partager</span>
              </button>
            )}

            {onOpenSuiviRecosAnalyticsTab && (
              <button
                type="button"
                onClick={onOpenSuiviRecosAnalyticsTab}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-700/70 bg-blue-950/60 px-2.5 py-1.5 text-xs font-medium text-blue-200 transition-colors hover:bg-blue-900/70 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BarChart3 className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                <span>Analytics Recos</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenAuditPlanTab}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-700/70 bg-teal-950/60 px-2.5 py-1.5 text-xs font-medium text-teal-200 transition-colors hover:bg-teal-900/70 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ListTodo className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" />
              <span>Plan d&apos;audit (8h/j)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowStatsDashboard((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showStatsDashboard
                  ? 'border-blue-500 bg-blue-950/70 text-blue-200'
                  : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
              <span>Stats &amp; Gantt</span>
            </button>

            <div className="relative shrink-0">
              <button
                type="button"
                aria-expanded={showHeaderThemeSubmenu}
                onClick={() => setShowHeaderThemeSubmenu((v) => !v)}
                title={`Section Thèmes — Actif : ${activeWorkflowTheme.label}`}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showHeaderThemeSubmenu
                    ? 'border-blue-500 bg-blue-950/70 text-blue-200'
                    : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <Palette className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Thèmes</span>
                <span
                  className="h-2.5 w-2.5 rounded-full border shrink-0"
                  style={{
                    backgroundColor: activeWorkflowTheme.swatchHex,
                    borderColor: activeWorkflowTheme.swatchBorderHex,
                  }}
                  aria-hidden="true"
                />
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    showHeaderThemeSubmenu ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {showHeaderThemeSubmenu && (
                <div
                  role="menu"
                  aria-label="Sous-menu Thèmes workflow"
                  className="wf-theme-chrome absolute right-0 top-full z-40 mt-1.5 w-60 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl"
                >
                  <div className="mb-1.5 flex items-center justify-between border-b border-slate-800 px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <span>Thèmes (Couleurs marque)</span>
                    <button
                      type="button"
                      onClick={() => setShowHeaderThemeSubmenu(false)}
                      aria-label="Fermer le sous-menu Thèmes"
                      className="rounded p-0.5 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {WORKFLOW_THEMES.map((theme) => {
                      const isSelected = theme.id === activeWorkflowTheme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={isSelected}
                          onClick={() => {
                            onSelectWorkflowTheme?.(theme.id);
                            setShowHeaderThemeSubmenu(false);
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-950/70 font-semibold text-white ring-1 ring-blue-500/70'
                              : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-3.5 w-3.5 shrink-0 rounded-full border"
                              style={{
                                backgroundColor: theme.swatchHex,
                                borderColor: theme.swatchBorderHex,
                              }}
                              aria-hidden="true"
                            />
                            <span className="truncate">{theme.label}</span>
                          </span>
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowApiPanel((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showApiPanel
                  ? 'border-blue-500 bg-blue-950/70 text-blue-200'
                  : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clés API</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer le menu coulissant"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        )}

        {/* Panneau PostgreSQL / User Api Key & Team Api Key */}
        {showApiPanel && (
          <form
            onSubmit={handleValidateKeys}
            className="wf-theme-chrome space-y-3 border-b border-slate-800 bg-slate-950/60 px-5 py-3.5 text-xs"
          >
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">User Api key</label>
                <input
                  type="text"
                  value={userKeyDraft}
                  onChange={(e) => setUserKeyDraft(e.target.value)}
                  placeholder="usr_live_..."
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-100 focus:outline-1 focus:outline-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Team Api key</label>
                <input
                  type="text"
                  value={teamKeyDraft}
                  onChange={(e) => setTeamKeyDraft(e.target.value)}
                  placeholder="team_live_..."
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-100 focus:outline-1 focus:outline-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  Signature (3 lettres)
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={sigDraft}
                  onChange={(e) => setSigDraft(e.target.value.toUpperCase())}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs uppercase text-slate-100 focus:outline-1 focus:outline-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  className="rounded bg-blue-700 px-3 py-1.5 font-medium text-white hover:bg-blue-600 cursor-pointer"
                >
                  Valider
                </button>
                <button
                  type="button"
                  onClick={onInitClient}
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
                >
                  Initialisation client
                </button>
                <button
                  type="button"
                  onClick={onClearClientKeys}
                  className="rounded border border-red-900/70 bg-red-950/40 px-3 py-1.5 font-medium text-red-300 hover:bg-red-950/70 cursor-pointer"
                >
                  Suppression client
                </button>
              </div>
              <span className="text-[11px] text-slate-400">
                Masque l&apos;affichage sans supprimer PostgreSQL / Drive
              </span>
            </div>
          </form>
        )}

        {/* Recherche, Contrôles TreeView & Saisie contextuelle */}
        {(!isMissionStepTopMode ||
          activatedSourceIds.length > 0 ||
          moveSourceIds.length > 0 ||
          clipboardIds.length > 0 ||
          Boolean(pinPrompt) ||
          Boolean(addingTarget) ||
          Boolean(mergeCollectionPrompt) ||
          Boolean(collectionPickerPrompt) ||
          Boolean(addToCollectionPrompt) ||
          Boolean(statusMessage)) && (
        <div className="wf-theme-chrome space-y-2.5 border-b border-slate-800 px-5 py-3">
          {!isMissionStepTopMode && (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un workflow, exercice, signature [SEK] ou document..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/90 py-1.5 pr-8 pl-9 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-2 focus:outline-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span className="font-mono tabular-nums">
                  {checkedNodes.length} coché{checkedNodes.length > 1 ? 's' : ''}
                </span>

                <span className="text-[11px] text-slate-400">
                  Clic droit ou glisser-déposer pour actions
                </span>
              </div>
            </>
          )}

          {activatedSourceIds.length > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-800/70 bg-emerald-950/50 px-3 py-1.5 text-xs text-emerald-200">
              <span>
                Écouteur activé ({activatedSourceIds.length} en mémoire) · Clic droit sur le dossier cible → « Transférer ici »
              </span>
              <button
                type="button"
                onClick={onClearActivatedSource}
                className="shrink-0 text-emerald-300 underline hover:text-white cursor-pointer"
              >
                Annuler
              </button>
            </div>
          )}

          {moveSourceIds.length > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-amber-800/70 bg-amber-950/50 px-3 py-1.5 text-xs text-amber-200">
              <span>
                Déplacement en cours ({moveSourceIds.length}) · Glissez ou clic droit sur l’emplacement → « Déposer ici »
              </span>
              <button
                type="button"
                onClick={onClearMoveSource}
                className="shrink-0 text-amber-300 underline hover:text-white cursor-pointer"
              >
                Annuler
              </button>
            </div>
          )}

          {clipboardIds.length > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-indigo-800/70 bg-indigo-950/50 px-3 py-1.5 text-xs text-indigo-200">
              <span>
                Copié ({clipboardIds.length}) · Cochez ou clic droit sur la destination puis cliquez « Copie / Paste »
              </span>
              <button
                type="button"
                onClick={onClearClipboard}
                className="shrink-0 text-indigo-300 underline hover:text-white cursor-pointer"
              >
                Annuler
              </button>
            </div>
          )}

          {pinPrompt && (
            <form
              onSubmit={handleConfirmPin}
              className="space-y-2 rounded-md border border-amber-700/70 bg-slate-950/90 p-2.5"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-amber-300">
                <span className="flex items-center gap-1.5 truncate">
                  {pinPrompt.mode === 'lock' ? (
                    <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">
                    {pinPrompt.mode === 'lock'
                      ? `Verrouiller « ${pinPrompt.targetLabel} » — Code PIN à 4 chiffres :`
                      : `Déverrouiller « ${pinPrompt.targetLabel} » — Entrez le code PIN :`}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  value={pinDraft}
                  onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="•••• (4 chiffres)"
                  className="w-36 rounded border border-amber-500 bg-slate-900 px-2.5 py-1.5 font-mono text-xs tracking-widest text-white placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 cursor-pointer"
                >
                  {pinPrompt.mode === 'lock' ? 'Verrouiller' : 'Déverrouiller'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPinPrompt(null);
                    setPinDraft('');
                  }}
                  className="rounded border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Annuler
                </button>
              </div>
              {pinPrompt.error && (
                <div className="text-[11px] font-medium text-red-400">{pinPrompt.error}</div>
              )}
            </form>
          )}

          {addingTarget && (
            <form onSubmit={handleConfirmAdd} className="space-y-1.5 rounded-md border border-slate-700 bg-slate-950/70 p-2.5">
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>
                  Ajouter ({addingTarget.kind}) dans « {addingTarget.targetLabel} » :
                </span>
                {addingTarget.kind === 'document' && (
                  <button
                    type="button"
                    onClick={() => setAddLabelDraft(generateRandomAuditDocumentName())}
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 cursor-pointer"
                  >
                    <Dices className="h-3 w-3" aria-hidden="true" />
                    <span>Régénérer</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={addLabelDraft}
                  onChange={(e) => setAddLabelDraft(e.target.value)}
                  placeholder={
                    addingTarget.kind === 'exercice'
                      ? 'Ex: Exercice 2027'
                      : addingTarget.kind === 'sub-exercice'
                      ? 'Ex: Clôture T4 / Intérim'
                      : addingTarget.kind === 'collection'
                      ? 'Ex: Collection Pièces Justificatives'
                      : addingTarget.kind === 'section'
                      ? 'Ex: Audit conformité'
                      : addingTarget.kind === 'sous-section'
                      ? 'Ex: Sous-section A'
                      : 'Nom du document...'
                  }
                  className="min-w-0 flex-1 rounded border border-blue-500 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 cursor-pointer"
                >
                  Créer
                </button>
                <button
                  type="button"
                  onClick={() => setAddingTarget(null)}
                  className="rounded border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          {mergeCollectionPrompt && (() => {
            const allCols = collectAllCollections(trees).filter(
              (c) => c.id !== mergeCollectionPrompt.sourceId
            );
            return (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!mergeCollectionPrompt.targetId) return;
                  onMergeCollections(
                    mergeCollectionPrompt.sourceId,
                    mergeCollectionPrompt.targetId,
                    mergeCollectionPrompt.removeSource
                  );
                  setMergeCollectionPrompt(null);
                }}
                className="space-y-2 rounded-md border border-violet-700/70 bg-slate-950/90 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-violet-300">
                  <span className="flex items-center gap-1.5 truncate">
                    <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      Fusionner « {mergeCollectionPrompt.sourceLabel} » vers :
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setMergeCollectionPrompt(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {allCols.length === 0 ? (
                  <div className="text-[11px] text-slate-400">
                    Créez d&apos;abord une autre collection documentaire pour pouvoir les fusionner.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={mergeCollectionPrompt.targetId}
                        onChange={(e) =>
                          setMergeCollectionPrompt({
                            ...mergeCollectionPrompt,
                            targetId: e.target.value,
                          })
                        }
                        className="min-w-0 flex-1 rounded border border-violet-600 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      >
                        <option value="">Choisir la collection cible...</option>
                        {allCols.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label} ({countDocumentsInNode(c)} doc)
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={!mergeCollectionPrompt.targetId}
                        className="rounded bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        Fusionner
                      </button>
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mergeCollectionPrompt.removeSource}
                        onChange={(e) =>
                          setMergeCollectionPrompt({
                            ...mergeCollectionPrompt,
                            removeSource: e.target.checked,
                          })
                        }
                        className="accent-violet-500"
                      />
                      <span>Supprimer la collection source après fusion</span>
                    </label>
                  </>
                )}
              </form>
            );
          })()}

          {collectionPickerPrompt && (() => {
            const allCols = collectAllCollections(trees);
            const selectedCol =
              allCols.find((c) => c.id === collectionPickerPrompt.selectedCollectionId) || null;
            return (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!selectedCol) return;
                  const act = collectionPickerPrompt.action;
                  setCollectionPickerPrompt(null);
                  if (act === 'merge') {
                    setMergeCollectionPrompt({
                      sourceId: selectedCol.id,
                      sourceLabel: selectedCol.label,
                      targetId: '',
                      removeSource: true,
                    });
                  } else if (act === 'duplicate') {
                    onDuplicateNodes(selectedCol.id);
                  } else if (act === 'integrate') {
                    onIntegrateCollection(selectedCol);
                  } else if (act === 'export') {
                    onExportCollectionArchive(selectedCol);
                  } else if (act === 'import-file') {
                    importTargetIdRef.current = selectedCol.id;
                    importInputRef.current?.click();
                  } else if (act === 'import-dir') {
                    importTargetIdRef.current = selectedCol.id;
                    importDirInputRef.current?.click();
                  } else if (act === 'delete') {
                    onDeleteNodes(selectedCol.id);
                  }
                }}
                className="space-y-2 rounded-md border border-violet-700/70 bg-slate-950/90 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-violet-300">
                  <span className="flex items-center gap-1.5 truncate">
                    <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {collectionPickerPrompt.actionLabel} — choisir la collection :
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCollectionPickerPrompt(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={collectionPickerPrompt.selectedCollectionId}
                    onChange={(e) =>
                      setCollectionPickerPrompt({
                        ...collectionPickerPrompt,
                        selectedCollectionId: e.target.value,
                      })
                    }
                    className="min-w-0 flex-1 rounded border border-violet-600 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="">Sélectionner une collection...</option>
                    {allCols.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} ({countDocumentsInNode(c)} doc)
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!selectedCol}
                    className="rounded bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    Exécuter
                  </button>
                </div>
              </form>
            );
          })()}

          {addToCollectionPrompt && (() => {
            const allCols = collectAllCollections(trees);
            const q = addToCollectionPrompt.filterText.trim().toLowerCase();
            const candidateNodes = allVisibleNodes.filter(
              (n) =>
                n.nodeType !== 'root' &&
                n.id !== addToCollectionPrompt.collectionId &&
                (!q || n.label.toLowerCase().includes(q))
            );
            return (
              <div className="space-y-2 rounded-md border border-violet-700/70 bg-slate-950/90 p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-violet-300">
                  <span className="flex items-center gap-1.5 truncate">
                    <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      Ajouter dans « {addToCollectionPrompt.collectionLabel} »
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setAddToCollectionPrompt(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {allCols.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[11px] text-slate-400">Collection cible :</span>
                    <select
                      value={addToCollectionPrompt.collectionId}
                      onChange={(e) => {
                        const found = allCols.find((c) => c.id === e.target.value);
                        if (!found) return;
                        setAddToCollectionPrompt({
                          ...addToCollectionPrompt,
                          collectionId: found.id,
                          collectionLabel: found.label,
                        });
                      }}
                      className="min-w-0 flex-1 rounded border border-violet-600 bg-slate-900 px-2 py-1 text-[11px] text-white focus:outline-none"
                    >
                      {allCols.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label} ({countDocumentsInNode(c)} doc)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAddingTarget({
                        targetId: addToCollectionPrompt.collectionId,
                        targetLabel: addToCollectionPrompt.collectionLabel,
                        kind: 'document',
                      });
                      setAddLabelDraft(generateRandomAuditDocumentName());
                      setAddToCollectionPrompt(null);
                    }}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    + Nouveau document
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingTarget({
                        targetId: addToCollectionPrompt.collectionId,
                        targetLabel: addToCollectionPrompt.collectionLabel,
                        kind: 'section',
                      });
                      setAddLabelDraft('');
                      setAddToCollectionPrompt(null);
                    }}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    + Section
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingTarget({
                        targetId: addToCollectionPrompt.collectionId,
                        targetLabel: addToCollectionPrompt.collectionLabel,
                        kind: 'sous-section',
                      });
                      setAddLabelDraft('');
                      setAddToCollectionPrompt(null);
                    }}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    + Sous-section
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingTarget({
                        targetId: addToCollectionPrompt.collectionId,
                        targetLabel: addToCollectionPrompt.collectionLabel,
                        kind: 'collection',
                      });
                      setAddLabelDraft('');
                      setAddToCollectionPrompt(null);
                    }}
                    className="rounded border border-violet-700/70 bg-violet-950/60 px-2 py-1 text-[11px] text-violet-200 hover:bg-violet-900/70 cursor-pointer"
                  >
                    + Sous-collection
                  </button>
                </div>

                <div className="border-t border-slate-800 pt-2">
                  <input
                    type="text"
                    value={addToCollectionPrompt.filterText}
                    onChange={(e) =>
                      setAddToCollectionPrompt({
                        ...addToCollectionPrompt,
                        filterText: e.target.value,
                      })
                    }
                    placeholder="Filtrer des éléments existants à copier/regrouper..."
                    className="mb-1.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-white placeholder:text-slate-500 focus:outline-none"
                  />
                  <div className="max-h-28 space-y-0.5 overflow-y-auto rounded border border-slate-800 bg-slate-900/60 p-1">
                    {candidateNodes.slice(0, 40).map((cand) => {
                      const isSel = addToCollectionPrompt.selectedIds.includes(cand.id);
                      return (
                        <label
                          key={cand.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 text-[11px] text-slate-200 hover:bg-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => {
                              setAddToCollectionPrompt((prev) => {
                                if (!prev) return null;
                                const exists = prev.selectedIds.includes(cand.id);
                                return {
                                  ...prev,
                                  selectedIds: exists
                                    ? prev.selectedIds.filter((id) => id !== cand.id)
                                    : [...prev.selectedIds, cand.id],
                                };
                              });
                            }}
                            className="accent-violet-500"
                          />
                          <span className="truncate flex-1">{cand.label}</span>
                          <span className="shrink-0 font-mono text-[10px] text-slate-500">
                            {cand.nodeType}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-1.5 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={addToCollectionPrompt.selectedIds.length === 0}
                      onClick={() => {
                        onAddExistingToCollection(
                          addToCollectionPrompt.selectedIds,
                          addToCollectionPrompt.collectionId
                        );
                        setAddToCollectionPrompt(null);
                      }}
                      className="rounded bg-violet-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      Ajouter la sélection ({addToCollectionPrompt.selectedIds.length})
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {statusMessage && (
            <div className="flex items-center gap-2 rounded-md border border-blue-800/70 bg-blue-950/60 px-3 py-1.5 text-xs text-blue-200">
              <Check className="h-3.5 w-3.5 shrink-0 text-blue-400" aria-hidden="true" />
              <span className="truncate">{statusMessage}</span>
            </div>
          )}
        </div>
        )}

        {/* Tableau de bord & Gantt d'audit (apparaît au-dessus du contenu si activé) */}
        {showStatsDashboard && (
          <AuditStatsDashboard
            trees={trees}
            wordBodies={wordBodies}
            onClose={() => setShowStatsDashboard(false)}
            onJumpToNode={(nodeId) => {
              const path = findNodePath(trees, nodeId);
              if (path) {
                path.forEach((p) => onToggleExpand(p.id));
              }
              // Highlight node via props if possible, or scroll
              const targetEl = document.querySelector(`[data-wf-node-id="${nodeId}"]`);
              targetEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />
        )}

        {/* Zone principale : Document Word / Data (large fenêtre) + Arborescence */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Simulation d'un document source ouvert à gauche (Word / Excel / PDF · Type 4) */}
          {openedWordDoc && (() => {
            const lowerName = openedWordDoc.label.toLowerCase();
            const inferredExt: 'xlsx' | 'pdf' | 'docx' =
              openedWordDoc.sourceDocFormat === 'xlsx' || lowerName.endsWith('.xlsx')
                ? 'xlsx'
                : openedWordDoc.sourceDocFormat === 'pdf' || lowerName.endsWith('.pdf')
                ? 'pdf'
                : 'docx';
            const headerBg =
              inferredExt === 'xlsx'
                ? 'bg-[#217346]'
                : inferredExt === 'pdf'
                ? 'bg-[#B91C1C]'
                : 'bg-[#185ABD]';
            const badgeText =
              inferredExt === 'xlsx' ? 'XLSX' : inferredExt === 'pdf' ? 'PDF' : 'W';
            const displayFileName =
              lowerName.endsWith(`.${inferredExt}`)
                ? openedWordDoc.label
                : `${openedWordDoc.label}.${inferredExt}`;
            const sourcePayload =
              openedWordDoc.missionStepFormatType === 4 || inferredExt !== 'docx'
                ? buildFormatageDataForNode(openedWordDoc)
                : null;
            const currentBody =
              wordBodies[openedWordDoc.id] ??
              (sourcePayload?.sourceSummary || '');

            return (
              <div
                aria-label={`Document source ouvert : ${openedWordDoc.label}`}
                className="flex min-h-0 flex-1 flex-col border-b border-slate-700 bg-slate-950 p-3 lg:border-b-0 lg:border-r lg:border-slate-800 lg:p-4"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-700 bg-white text-slate-900 shadow-lg">
                  <div className={`flex shrink-0 items-center justify-between gap-2 ${headerBg} px-3.5 py-2 text-xs text-white`}>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-5 min-w-[22px] shrink-0 items-center justify-center rounded bg-white/15 px-1 font-mono text-[10px] font-bold">
                        {badgeText}
                      </span>
                      <span className="truncate font-medium" title={displayFileName}>
                        {displayFileName}
                      </span>
                      <span className="hidden rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-medium sm:inline">
                        Forme source · .{inferredExt}
                      </span>
                      {openedWordDoc.locked && (
                        <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label="Verrouillé" />
                      )}
                      {openedWordDoc.managerReviewed && (
                        <ClipboardCheck
                          className="h-3.5 w-3.5 shrink-0 text-emerald-300"
                          aria-label="Revue manager"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!openedWordDoc.locked && (
                        <button
                          type="button"
                          onClick={() => onSaveVersion(openedWordDoc.id, `Sauvegarde depuis ${inferredExt.toUpperCase()}`)}
                          className="rounded bg-white/15 px-2.5 py-0.5 text-[11px] font-medium hover:bg-white/25 cursor-pointer"
                        >
                          Enregistrer version
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenDocumentInChat(openedWordDoc)}
                        className="rounded bg-white/15 px-2.5 py-0.5 text-[11px] font-medium hover:bg-white/25 cursor-pointer"
                      >
                        Envoyer au chat
                      </button>
                      <button
                        type="button"
                        onClick={onCloseWordDoc}
                        aria-label="Fermer le document source"
                        className="rounded p-0.5 hover:bg-white/20 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-3.5 py-1.5 text-[11px] text-slate-600">
                    <div className="flex items-center gap-2">
                      {inferredExt === 'xlsx' ? (
                        <>
                          <span className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                            Feuille Excel · SYSCOHADA
                          </span>
                          <span className="hidden text-[10px] text-slate-500 sm:inline">
                            Pièce justificative native (Type 4)
                          </span>
                        </>
                      ) : inferredExt === 'pdf' ? (
                        <>
                          <span className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-800">
                            Document PDF · Signé
                          </span>
                          <span className="hidden text-[10px] text-slate-500 sm:inline">
                            Pièce justificative probante (Type 4)
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-sans">
                            Calibri · 11
                          </span>
                          <span className="font-bold">G</span>
                          <span className="italic">I</span>
                          <span className="underline">S</span>
                          <span className="ml-2 hidden text-[10px] text-slate-500 sm:inline">
                            Mise en page · A4 Portrait (100 %)
                          </span>
                        </>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">
                      {openedWordDoc.locked
                        ? 'Lecture seule (verrouillé par PIN)'
                        : `Forme source · [${openedWordDoc.owner || session.userSignature}]`}
                    </span>
                  </div>

                  <div className="max-h-[55vh] flex-1 overflow-y-auto bg-slate-200/85 p-4 lg:max-h-none lg:p-6">
                    <div className="mx-auto flex min-h-[480px] max-w-[840px] flex-col rounded border border-slate-300 bg-white px-8 py-7 shadow-md lg:min-h-full lg:px-10 lg:py-8">
                      <div className="border-b border-slate-200 pb-3">
                        <div className="text-base font-bold text-slate-900">
                          {openedWordDoc.label}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Réf. Drive : {openedWordDoc.driveId || 'N/A'} · Client : {session.client} · Format : .{inferredExt}
                        </div>
                      </div>

                      {sourcePayload && sourcePayload.baseTables.length > 0 && (
                        <div className="mt-4 space-y-4">
                          {sourcePayload.baseTables.map((tbl) => {
                            const isRubriqueDesc =
                              tbl.headers.length === 2 &&
                              tbl.headers[0].trim().toLowerCase() === 'rubrique' &&
                              tbl.headers[1].trim().toLowerCase() === 'description';
                            return (
                              <div
                                key={tbl.id}
                                className="overflow-hidden rounded-lg border border-slate-300/90 bg-white shadow-[0_6px_18px_-3px_rgba(15,23,42,0.22),0_3px_8px_-2px_rgba(15,23,42,0.14)]"
                              >
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse text-left text-xs">
                                    <thead>
                                      <tr className="wf-table-head-row divide-x text-[12px] font-semibold">
                                        {tbl.headers.map((h, i) => (
                                          <th
                                            key={i}
                                            className={`px-3.5 py-2.5 whitespace-nowrap ${
                                              isRubriqueDesc && i === 0
                                                ? 'w-[28%] min-w-[140px] max-w-[230px]'
                                                : ''
                                            }`}
                                          >
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                      {tbl.rows.map((r, rIdx) => (
                                        <tr key={rIdx} className="divide-x divide-slate-200 bg-white">
                                          {r.map((cell, cIdx) => (
                                            <td
                                              key={cIdx}
                                              className={`px-3.5 py-2.5 text-slate-800 transition-colors hover:bg-[#EAF4FF] hover:ring-1 hover:ring-inset hover:ring-sky-500 ${
                                                isRubriqueDesc && cIdx === 0
                                                  ? 'font-medium text-slate-700'
                                                  : ''
                                              }`}
                                            >
                                              {cell || '—'}
                                            </td>
                                          ))}
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

                      <textarea
                        rows={sourcePayload && sourcePayload.baseTables.length > 0 ? 7 : 18}
                        readOnly={Boolean(openedWordDoc.locked)}
                        value={currentBody}
                        onChange={(e) => onUpdateWordBody(openedWordDoc.id, e.target.value)}
                        placeholder={
                          openedWordDoc.locked
                            ? 'Document verrouillé — déverrouillez avec le code PIN pour modifier.'
                            : "Observations ou contenu du document source..."
                        }
                        className={`mt-4 min-h-[160px] w-full flex-1 resize-none border-0 bg-transparent text-sm leading-relaxed placeholder:text-slate-400 focus:outline-none ${
                          openedWordDoc.locked ? 'cursor-not-allowed text-slate-500' : 'text-slate-800'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Interface Intégrer data (collecte JSON Feuille couverture) */}
          {integratedDataDoc && (
            <IntegratedDataViewer
              docNode={integratedDataDoc.node}
              data={integratedDataDoc.data}
              onRegenerate={onRegenerateIntegratedData}
              onSendToChat={onOpenDocumentInChat}
              onClose={onCloseIntegratedData}
            />
          )}

          {/* Interface Intégrer collection (consolidation multi-documents JSON + Tables) */}
          {integratedCollectionDoc && (
            <IntegratedDataViewer
              collectionDoc={integratedCollectionDoc}
              onRegenerate={onRegenerateIntegratedCollection}
              onSendToChat={onOpenDocumentInChat}
              onClose={onCloseIntegratedCollection}
            />
          )}

          {/* Panneau Détail Suivi des Recos (Accordéon 10 colonnes clés + bouton Détail source 22 colonnes) */}
          {!openedWordDoc &&
            !integratedDataDoc &&
            !integratedCollectionDoc &&
            openedRecoInfoNode &&
            openedRecoInfoRecord && (
              <RecoInfoManagerPanel
                node={openedRecoInfoNode}
                record={openedRecoInfoRecord}
                isLocked={
                  isNodeLockedOrWithinLockedAncestor(trees, openedRecoInfoNode.id) ||
                  Boolean(openedRecoInfoNode.locked)
                }
                trees={trees}
                scopeNodeId={openedRecoScopeId}
                initialView={openedRecoInitialView}
                onClose={() => {
                  setOpenedRecoInfoId(null);
                  setOpenedRecoScopeId(undefined);
                }}
                onSelectRecoNode={(recoNodeId) => {
                  setOpenedRecoInfoId(recoNodeId);
                  onJumpToNode(recoNodeId);
                }}
                onUpdateRecoMeta={onUpdateRecoMeta}
                onToggleManagerReview={onToggleManagerReview}
                onSetNodeStatus={onSetNodesStatus}
                onAddReviewNote={onAddReviewNote}
                onToggleReviewNote={onToggleReviewNote}
                onDeleteReviewNote={onDeleteReviewNote}
                onOpenWordDoc={onOpenWordDoc}
                onIntegrateCollection={onIntegrateCollection}
                onExpandBranch={onExpandBranch}
              />
            )}

          {/* Panneau Détail du risque (Workflow Risk management · 23 colonnes accordéon) */}
          {!openedWordDoc &&
            !integratedDataDoc &&
            !integratedCollectionDoc &&
            !(openedRecoInfoNode && openedRecoInfoRecord) &&
            openedRiskInfoNode &&
            openedRiskInfoRecord && (
              <RiskDetailManagerPanel
                node={openedRiskInfoNode}
                record={openedRiskInfoRecord}
                isLocked={
                  isNodeLockedOrWithinLockedAncestor(trees, openedRiskInfoNode.id) ||
                  Boolean(openedRiskInfoNode.locked)
                }
                trees={trees}
                scopeNodeId={openedRiskScopeId}
                initialMode={openedRiskPanelMode}
                modeNonce={openedRiskModeNonce}
                actionBanner={openedRiskActionBanner}
                customRubriques={riskCustomRubriques}
                directionOptions={riskDirectionOptions}
                onClose={() => {
                  setOpenedRiskInfoId(null);
                  setOpenedRiskScopeId(undefined);
                  setOpenedRiskActionBanner(null);
                }}
                onSelectRiskNode={(riskNodeId) => {
                  setOpenedRiskInfoId(riskNodeId);
                  setOpenedRiskActionBanner(null);
                  onJumpToNode(riskNodeId);
                }}
                onUpdateRiskMeta={onUpdateRiskMeta}
                onAddRisk={() => handleRiskAddAction(openedRiskInfoNode)}
                onDeleteRisk={handleRiskDeleteAction}
                onDuplicateRisk={handleRiskDuplicateAction}
                onTransferRisk={(riskNodeId, destDirId) => {
                  if (onTransferRisk?.(riskNodeId, destDirId)) {
                    setOpenedRiskActionBanner('Risque transféré et rattaché à sa nouvelle destination.');
                  }
                }}
                onAddCustomRubrique={(input) => {
                  onAddRiskRubrique?.(input);
                  setOpenedRiskActionBanner(
                    `Rubrique « ${input.label} » ajoutée au détail de ce risque et à tous les autres risques.`
                  );
                }}
                onSortRisks={onSortRisks}
              />
            )}

          {/* Panneau Plan annuel d'audit (10 col / Plan intégral / Planif 08h / Gantt 2 niveaux) */}
          {!openedWordDoc &&
            !integratedDataDoc &&
            !integratedCollectionDoc &&
            !(openedRecoInfoNode && openedRecoInfoRecord) &&
            !(openedRiskInfoNode && openedRiskInfoRecord) &&
            openedAuditPlanState && (
              <AuditPlanWorkflowPanel
                compact
                trees={trees}
                scopeNodeId={openedAuditPlanState.scopeNodeId}
                initialMode={openedAuditPlanState.mode}
                initialMissionId={openedAuditPlanState.missionId}
                initialStepId={openedAuditPlanState.stepId}
                userSignature={session.userSignature}
                onClose={() => setOpenedAuditPlanState(null)}
                onInjectPlanMissions={onInjectPlanMissions}
                onUpdateStepDates={onUpdatePlanStepDates}
                onUpdateMissionMeta={onUpdatePlanMissionMeta}
                onAddTodoTask={onAddTodoTask}
                onUpdateTodoTask={onUpdateTodoTask}
                onDeleteTodoTask={onDeleteTodoTask}
                onJumpToNode={onJumpToNode}
              />
            )}

          {/* Fenêtre Exportation États (Suivi des recos & Plan d'audit : Tables Excel & Dashboards PDF) */}
          {!openedWordDoc &&
            !integratedDataDoc &&
            !integratedCollectionDoc &&
            !(openedRecoInfoNode && openedRecoInfoRecord) &&
            !(openedRiskInfoNode && openedRiskInfoRecord) &&
            !openedAuditPlanState &&
            openedExportEtat && (
              <ExportEtatsPanel
                key={openedExportEtat.nonce}
                trees={trees}
                wordBodies={wordBodies}
                initialActivity={openedExportEtat.activity}
                initialMode={openedExportEtat.mode}
                scopeNodeId={openedExportEtat.scopeNodeId}
                clientName={session.client}
                userSignature={session.userSignature}
                onClose={() => setOpenedExportEtat(null)}
              />
            )}

          {/* Panneau Tables liées d'une Étape de mission (gauche) + TreeView conservée à droite */}
          {!openedWordDoc &&
            !integratedDataDoc &&
            !integratedCollectionDoc &&
            !(openedRecoInfoNode && openedRecoInfoRecord) &&
            !(openedRiskInfoNode && openedRiskInfoRecord) &&
            !openedAuditPlanState &&
            !openedExportEtat &&
            openedMissionStepNode && (
              <MissionStepTableViewer
                node={findNodeById(trees, openedMissionStepNode.id) ?? openedMissionStepNode}
                session={session}
                refreshKey={sqliteRefreshNonce}
                initialViewMode={missionStepInitialViewMode}
                flushTop
                isLocked={
                  isNodeLockedOrWithinLockedAncestor(trees, openedMissionStepNode.id) ||
                  Boolean(openedMissionStepNode.locked)
                }
                onShareStep={onShareMissionStep}
                onSendStepToChat={(stepNode, tables) => {
                  if (onSendMissionStepToChat) {
                    onSendMissionStepToChat(stepNode, tables);
                  } else {
                    onOpenDocumentInChat(stepNode);
                  }
                }}
                onSqliteSynced={onSqliteSynced}
                onClose={() => {
                  setOpenedMissionStepNode(null);
                  setShowStepHeaderSubmenu(false);
                }}
              />
            )}

          {/* Arborescence Workflow & Team Workflow + Inspecteur contextuel */}
          <div
            className={`wf-theme-chrome relative flex min-h-0 flex-col overflow-hidden ${
              openedWordDoc ||
              integratedDataDoc ||
              integratedCollectionDoc ||
              (openedRecoInfoNode && openedRecoInfoRecord) ||
              (openedRiskInfoNode && openedRiskInfoRecord) ||
              openedAuditPlanState ||
              openedExportEtat ||
              openedMissionStepNode
                ? 'min-h-[180px] shrink-0 lg:w-[360px] xl:w-[390px] lg:flex-none'
                : 'flex-1'
            }`}
          >
            {/* Barre compacte + bouton sous-menu (boutons + recherche) quand une étape occupe toute la partie haute */}
            {openedMissionStepNode &&
              !openedWordDoc &&
              !integratedDataDoc &&
              !integratedCollectionDoc &&
              !(openedRecoInfoNode && openedRecoInfoRecord) &&
              !(openedRiskInfoNode && openedRiskInfoRecord) &&
              !openedAuditPlanState &&
              !openedExportEtat && (
                <div className="relative shrink-0 border-b border-slate-800 bg-slate-950/90 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      aria-expanded={showStepHeaderSubmenu}
                      onClick={() => setShowStepHeaderSubmenu((v) => !v)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        showStepHeaderSubmenu || searchQuery.trim().length > 0
                          ? 'border-blue-500 bg-blue-950/70 text-blue-100'
                          : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      <Menu className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                      <span>Menu &amp; Recherche</span>
                      {searchQuery.trim().length > 0 && (
                        <span className="rounded bg-blue-500/30 px-1 font-mono text-[10px] text-blue-200">
                          filtre
                        </span>
                      )}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          showStepHeaderSubmenu ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {checkedNodes.length} coché{checkedNodes.length > 1 ? 's' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fermer le menu coulissant"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {showStepHeaderSubmenu && (
                    <div className="mt-2 space-y-2.5 rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-xl">
                      <div className="relative">
                        <Search
                          className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                          aria-hidden="true"
                        />
                        <input
                          type="text"
                          autoFocus
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Rechercher un workflow, exercice, [SEK]..."
                          className="w-full rounded-md border border-slate-700 bg-slate-950 py-1.5 pr-7 pl-8 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-2 focus:outline-blue-500"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        {(onShareNode || onShareMissionStep) && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowStepHeaderSubmenu(false);
                              if (openedMissionStepNode && onShareNode) {
                                onShareNode(openedMissionStepNode);
                                return;
                              }
                              const checkedFirst =
                                checkedNonRootNodes[0] ??
                                (highlightedNodeId ? findNodeById(trees, highlightedNodeId) : null) ??
                                findNodeById(trees, 'user-2026-ex-audit') ??
                                visibleRoots[0];
                              if (checkedFirst && onShareNode) {
                                onShareNode(checkedFirst);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600/80 bg-emerald-600/20 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-600 hover:text-white cursor-pointer"
                          >
                            <Share2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">Partager</span>
                          </button>
                        )}

                        {onOpenSuiviRecosAnalyticsTab && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowStepHeaderSubmenu(false);
                              onOpenSuiviRecosAnalyticsTab();
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-blue-700/70 bg-blue-950/60 px-2.5 py-1.5 text-xs font-medium text-blue-200 hover:bg-blue-900/70 cursor-pointer"
                          >
                            <BarChart3 className="h-3.5 w-3.5 shrink-0 text-blue-400" aria-hidden="true" />
                            <span className="truncate">Analytics Recos</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setShowStepHeaderSubmenu(false);
                            onOpenAuditPlanTab();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-teal-700/70 bg-teal-950/60 px-2.5 py-1.5 text-xs font-medium text-teal-200 hover:bg-teal-900/70 cursor-pointer"
                        >
                          <ListTodo className="h-3.5 w-3.5 shrink-0 text-teal-400" aria-hidden="true" />
                          <span className="truncate">Plan d&apos;audit (8h/j)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowStatsDashboard((v) => !v)}
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                            showStatsDashboard
                              ? 'border-blue-500 bg-blue-950/70 text-blue-200'
                              : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          <BarChart3 className="h-3.5 w-3.5 shrink-0 text-blue-400" aria-hidden="true" />
                          <span className="truncate">Stats &amp; Gantt</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowApiPanel((v) => !v)}
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                            showApiPanel
                              ? 'border-blue-500 bg-blue-950/70 text-blue-200'
                              : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">Clés API</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowStepHeaderSubmenu(false)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer"
                        >
                          <span>Masquer sous-menu</span>
                        </button>
                      </div>

                      {/* Section Thèmes + sous-menu des 6 thèmes marque */}
                      <div className="rounded-md border border-slate-700/80 bg-slate-950/60 p-1.5">
                        <button
                          type="button"
                          aria-expanded={showStepMenuThemesOpen}
                          onClick={() => setShowStepMenuThemesOpen((v) => !v)}
                          className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Palette className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>Thèmes</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-300">
                            <span
                              className="h-2.5 w-2.5 rounded-full border"
                              style={{
                                backgroundColor: activeWorkflowTheme.swatchHex,
                                borderColor: activeWorkflowTheme.swatchBorderHex,
                              }}
                              aria-hidden="true"
                            />
                            <span>{activeWorkflowTheme.label}</span>
                            <ChevronDown
                              className={`h-3 w-3 transition-transform ${
                                showStepMenuThemesOpen ? 'rotate-180' : ''
                              }`}
                              aria-hidden="true"
                            />
                          </span>
                        </button>

                        {showStepMenuThemesOpen && (
                          <div
                            role="menu"
                            aria-label="Sous-menu Thèmes workflow compact"
                            className="mt-1.5 grid grid-cols-2 gap-1 border-t border-slate-800 pt-1.5"
                          >
                            {WORKFLOW_THEMES.map((theme) => {
                              const isSelected = theme.id === activeWorkflowTheme.id;
                              return (
                                <button
                                  key={theme.id}
                                  type="button"
                                  role="menuitemradio"
                                  aria-checked={isSelected}
                                  onClick={() => onSelectWorkflowTheme?.(theme.id)}
                                  className={`flex items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-950/80 font-semibold text-white ring-1 ring-blue-500/70'
                                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                  }`}
                                >
                                  <span
                                    className="h-3 w-3 shrink-0 rounded-full border"
                                    style={{
                                      backgroundColor: theme.swatchHex,
                                      borderColor: theme.swatchBorderHex,
                                    }}
                                    aria-hidden="true"
                                  />
                                  <span className="truncate">{theme.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            {inspector && (
              <WorkflowNodeInspector
                inspector={inspector}
                trees={trees}
                wordBodies={wordBodies}
                isNodeLocked={(nodeId) =>
                  isNodeLockedOrWithinLockedAncestor(trees, nodeId)
                }
                readinessReport={readinessReport}
                onClose={() => setInspector(null)}
                onJumpToNode={onJumpToNode}
                onNavigateCrossRef={onNavigateCrossRef}
                onAddReviewNote={onAddReviewNote}
                onToggleReviewNote={onToggleReviewNote}
                onDeleteReviewNote={onDeleteReviewNote}
                onSaveVersion={onSaveVersion}
                onRestoreVersion={onRestoreVersion}
                onAddCrossRef={onAddCrossRef}
                onRemoveCrossRef={onRemoveCrossRef}
                onAssignNodes={onAssignNodes}
                onAddTodoTask={onAddTodoTask}
                onUpdateTodoTask={onUpdateTodoTask}
                onDeleteTodoTask={onDeleteTodoTask}
                onClockInTodoTask={onClockInTodoTask}
                onClockOutTodoTask={onClockOutTodoTask}
                onOpenFullAuditPlan={onOpenAuditPlanTab}
              />
            )}

            <div
              role="tree"
              aria-label="Arborescence Workflow et Team Workflow"
              onScroll={() => contextMenu && setContextMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                openContextMenuAt(e.clientX, e.clientY, null);
              }}
              className="flex-1 space-y-1 overflow-y-auto px-4 py-3"
            >
              {visibleRoots.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-xs text-slate-400">
                  Aucune clé API active. Cliquez sur « Clés API » puis sur « Initialisation client » pour
                  afficher les workflows de l&apos;entité.
                </div>
              ) : (
                visibleRoots.map((root) => renderNode(root, 0))
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Menu contextuel droit (Déplier/Replier + Simulation complète des actions) */}
      {isOpen && contextMenu && (
        <div
          ref={contextMenuRef}
          role="menu"
          aria-label={
            contextMenu.node
              ? `Actions pour ${contextMenu.node.label}`
              : "Actions d'affichage TreeView"
          }
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          className="fixed z-[60] max-h-[85vh] w-[288px] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 py-1.5 text-xs text-slate-200 shadow-2xl"
        >
          <div className="border-b border-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-400 truncate">
            {contextMenu.node
              ? contextMenu.node.nodeType === 'signature'
                ? `[${contextMenu.node.label}]`
                : contextMenu.node.label
              : 'Arborescence des Workflows'}
          </div>

          {/* Bloc Métriques liées au nœud & workflow dans le menu contextuel */}
          {(() => {
            const ctxMetrics = computeContextualWorkflowMetrics(contextMenu.node, trees);
            return (
              <div className="border-b border-slate-800 bg-slate-950/70 px-3 py-2 text-[10px]">
                <div className="flex items-center justify-between gap-2 text-slate-400">
                  <span className="font-semibold uppercase tracking-wider text-sky-400">
                    Métriques liées
                  </span>
                  <span className="font-mono font-semibold text-white tabular-nums">
                    {ctxMetrics.primaryPct}% avancement
                  </span>
                </div>
                {ctxMetrics.mode === 'plan-audit' ? (
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5 font-mono tabular-nums">
                    <div className="rounded border border-slate-800 bg-slate-900 px-1.5 py-1">
                      <div className="text-[9px] text-slate-400">Missions</div>
                      <div className="text-slate-100">{ctxMetrics.missionsCount}</div>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-900 px-1.5 py-1">
                      <div className="text-[9px] text-slate-400">Retard / Avance</div>
                      <div>
                        <span className="text-red-400">{ctxMetrics.lateCount}R</span>{' '}
                        <span className="text-emerald-400">{ctxMetrics.normalCount}N</span>{' '}
                        <span className="text-sky-400">{ctxMetrics.aheadCount}A</span>
                      </div>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-900 px-1.5 py-1">
                      <div className="text-[9px] text-slate-400">Écart 08h/j</div>
                      <div
                        className={
                          ctxMetrics.varianceHours > 0
                            ? 'text-red-400'
                            : ctxMetrics.varianceHours < 0
                            ? 'text-sky-400'
                            : 'text-emerald-400'
                        }
                      >
                        {ctxMetrics.varianceHours > 0
                          ? `+${ctxMetrics.varianceHours}h`
                          : `${ctxMetrics.varianceHours}h`}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5 font-mono tabular-nums">
                    <div className="rounded border border-slate-800 bg-slate-900 px-1.5 py-1">
                      <div className="text-[9px] text-slate-400">Docs validés</div>
                      <div className="text-slate-100">
                        {ctxMetrics.validatedDocs}/{ctxMetrics.docsCount}
                      </div>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-900 px-1.5 py-1">
                      <div className="text-[9px] text-slate-400">Tâches 08h/j</div>
                      <div className="text-slate-100">
                        {ctxMetrics.tasksCount} ({ctxMetrics.plannedHours}h)
                      </div>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-900 px-1.5 py-1">
                      <div className="text-[9px] text-slate-400">Alertes / Notes</div>
                      <div className="text-amber-300">
                        {ctxMetrics.overdueCount} éch. · {ctxMetrics.openNotes}n
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Actions spécifiques Workflow Plan annuel d'audit */}
          {(() => {
            const ctxNode = contextMenu.node;
            const showPlanMenu =
              !ctxNode ||
              ctxNode.natureId === 'plan-audit' ||
              ctxNode.nodeType === 'exercice' ||
              ctxNode.nodeType === 'root';
            if (!showPlanMenu) return null;

            return (
              <div className="border-b border-teal-800/60 bg-teal-950/20 py-1">
                <div className="flex items-center justify-between gap-2 px-3 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                    Plan annuel d&apos;audit
                  </span>
                  <span className="font-mono text-[10px] text-teal-300/80">
                    2026 · 08h/j
                  </span>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openAuditPlanPanel('integrer', ctxNode);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" />
                  <span>Intégrer le plan d&apos;audit (10 col. / 12 missions)</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openAuditPlanPanel('integrale', ctxNode);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <FolderKanban className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" />
                  <span>Plan d&apos;audit intégrale (Détails mission)</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openAuditPlanPanel('planification', ctxNode);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <ListTodo className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" />
                  <span>Planification des tâches (Écarts auto)</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openAuditPlanPanel('gantt-mission', ctxNode);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                  <span>Gantt par Mission (Phase/Étape/Auditeur)</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openAuditPlanPanel('gantt-annuel', ctxNode);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <GanttChart className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Gantt Plan annuel d&apos;audit (2026)</span>
                </button>
              </div>
            );
          })()}

          {/* Section Risk management & actions dynamiques sur le détail du risque */}
          {(() => {
            const ctxNode = contextMenu.node;
            const showRiskMenu =
              !ctxNode ||
              ctxNode.natureId === 'risk-management' ||
              Boolean(ctxNode.riskMeta) ||
              Boolean(openedRiskInfoNode) ||
              ctxNode.nodeType === 'root' ||
              (ctxNode.nodeType === 'exercice' &&
                extractRisksFromTrees(trees, ctxNode.id).length > 0);
            if (!showRiskMenu) return null;

            const targetRiskNode = resolveTargetRiskNode(ctxNode);
            const targetRiskLocked = targetRiskNode
              ? isNodeLockedOrWithinLockedAncestor(trees, targetRiskNode.id) ||
                Boolean(targetRiskNode.locked)
              : false;

            return (
              <div className="border-b border-rose-800/60 bg-rose-950/20 py-1">
                <div className="flex items-center justify-between gap-2 px-3 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                    Risk management
                  </span>
                  <span className="font-mono text-[10px] text-rose-300/80">
                    {23 + riskCustomRubriques.length} col.
                  </span>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openRiskDetailPanel(ctxNode, undefined, 'detail');
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                  <span>Détail du risque</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!onAddRisk}
                  onClick={() => {
                    handleRiskAddAction(ctxNode);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Ajouter risque</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!targetRiskNode || targetRiskLocked || !onDeleteRisk}
                  onClick={() => {
                    if (targetRiskNode) handleRiskDeleteAction(targetRiskNode.id);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-red-300 hover:bg-red-950/60 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
                  <span>Supprimer risque</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!targetRiskNode || targetRiskLocked || !onDuplicateRisk}
                  onClick={() => {
                    if (targetRiskNode) handleRiskDuplicateAction(targetRiskNode.id);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <CopyPlus className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
                  <span>Dupliquer risque</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!targetRiskNode || targetRiskLocked}
                  onClick={() => {
                    openRiskDetailPanel(
                      targetRiskNode ?? ctxNode,
                      undefined,
                      'transfer',
                      'Sélectionnez la destination (Cycle / Processus / Direction) pour transférer ce risque.'
                    );
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                  <span>Transférer risque</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!targetRiskNode || targetRiskLocked}
                  onClick={() => {
                    openRiskDetailPanel(
                      targetRiskNode ?? ctxNode,
                      undefined,
                      'edit-all',
                      'Édition globale activée : modifiez les données du risque puis enregistrez.'
                    );
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                  <span>Modifier données risque</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!onAddRiskRubrique}
                  onClick={() => {
                    openRiskDetailPanel(
                      targetRiskNode ?? ctxNode,
                      undefined,
                      'add-rubrique',
                      'Ajoutez une nouvelle rubrique : elle sera visible sur ce risque et tous les autres.'
                    );
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:opacity-40 cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                  <span>Ajouter Rubrique</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openRiskDetailPanel(
                      targetRiskNode ?? ctxNode,
                      ctxNode?.riskMeta ? undefined : ctxNode?.id,
                      'filter',
                      'Filtrez les risques selon vos critères.'
                    );
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                  <span>Filtrer risque</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openRiskDetailPanel(
                      targetRiskNode ?? ctxNode,
                      ctxNode?.riskMeta ? undefined : ctxNode?.id,
                      'sort',
                      'Choisissez le critère et l’ordre de tri des risques.'
                    );
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <ArrowUp className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                  <span>Trier Risques</span>
                </button>
              </div>
            );
          })()}

          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              disabled={!canUndo}
              onClick={() => {
                onUndo();
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <Undo2 className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
              <span className="truncate">
                {canUndo && undoLabel ? `Annuler : ${undoLabel}` : 'Annuler (Ctrl+Z)'}
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!canRedo}
              onClick={() => {
                onRedo();
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <Redo2 className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
              <span className="truncate">
                {canRedo && redoLabel ? `Rétablir : ${redoLabel}` : 'Rétablir (Ctrl+Y)'}
              </span>
            </button>

            <div className="my-1 border-t border-slate-800" />

            {contextMenu.node && contextMenu.node.children && contextMenu.node.children.length > 0 && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onExpandBranch(contextMenu.node!);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <ChevronsUpDown className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                  <span>Déplier la branche</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onCollapseBranch(contextMenu.node!);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <ChevronsDownUp className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span>Replier la branche</span>
                </button>
              </>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onExpandAll();
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span>Tout déplier</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onCollapseAll();
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <ChevronsDownUp className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span>Tout replier</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                if (checkedNodes.length > 0) onClearChecked();
                else onSelectAll();
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              {checkedNodes.length > 0 ? (
                <X className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              ) : (
                <Check className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
              )}
              <span>{checkedNodes.length > 0 ? 'Tout décocher' : 'Tout cocher'}</span>
            </button>
          </div>

          {/* Section dédiée : Collection documentaire (toujours visible avec les 9 actions) */}
          {(() => {
            const ctxNode = contextMenu.node;
            const allCols = collectAllCollections(trees);
            const path = ctxNode ? findNodePath(trees, ctxNode.id) : null;
            const resolvedTargetCol: WorkflowTreeNode | null =
              ctxNode?.nodeType === 'collection'
                ? ctxNode
                : path
                ? [...path].reverse().find((n) => n.nodeType === 'collection') || null
                : allCols.length === 1
                ? allCols[0]
                : null;
            const directTargetCol =
              resolvedTargetCol ?? (allCols.length === 1 ? allCols[0] : null);
            const createTarget =
              ctxNode ??
              visibleRoots[0] ??
              trees[0] ??
              null;
            const createLocked = createTarget
              ? isNodeLockedOrWithinLockedAncestor(trees, createTarget.id)
              : true;
            const hasAnyCollection = allCols.length > 0;
            const directTargetLocked = directTargetCol
              ? isNodeLockedOrWithinLockedAncestor(trees, directTargetCol.id)
              : false;
            const directSubtreeLocked = directTargetCol
              ? hasLockedNodeInIds(trees, [directTargetCol.id])
              : false;

            const runCollectionAction = (
              action:
                | 'merge'
                | 'duplicate'
                | 'integrate'
                | 'export'
                | 'import-file'
                | 'import-dir'
                | 'delete',
              actionLabel: string
            ) => {
              setContextMenu(null);
              if (directTargetCol) {
                if (action === 'merge') {
                  setMergeCollectionPrompt({
                    sourceId: directTargetCol.id,
                    sourceLabel: directTargetCol.label,
                    targetId: '',
                    removeSource: true,
                  });
                } else if (action === 'duplicate') {
                  onDuplicateNodes(directTargetCol.id);
                } else if (action === 'integrate') {
                  onIntegrateCollection(directTargetCol);
                } else if (action === 'export') {
                  onExportCollectionArchive(directTargetCol);
                } else if (action === 'import-file') {
                  importTargetIdRef.current = directTargetCol.id;
                  importInputRef.current?.click();
                } else if (action === 'import-dir') {
                  importTargetIdRef.current = directTargetCol.id;
                  importDirInputRef.current?.click();
                } else if (action === 'delete') {
                  onDeleteNodes(directTargetCol.id);
                }
                return;
              }
              setCollectionPickerPrompt({
                action,
                actionLabel,
                selectedCollectionId: allCols[0]?.id || '',
              });
            };

            return (
              <div className="border-y border-violet-800/60 bg-violet-950/20 py-1">
                <div className="flex items-center justify-between gap-2 px-3 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                    Collection documentaire
                  </span>
                  <span className="truncate font-mono text-[10px] text-violet-300/80">
                    {directTargetCol
                      ? directTargetCol.label
                      : hasAnyCollection
                      ? `${allCols.length} collections`
                      : 'aucune créée'}
                  </span>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!createTarget || createLocked}
                  onClick={() => {
                    if (!createTarget) return;
                    setAddingTarget({
                      targetId: createTarget.id,
                      targetLabel: createTarget.label,
                      kind: 'collection',
                    });
                    setAddLabelDraft('');
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                  <span>Créer collection</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!hasAnyCollection || directTargetLocked}
                  onClick={() => {
                    const targetCol = directTargetCol ?? allCols[0];
                    if (!targetCol) return;
                    const preSelected = checkedNonRootNodes
                      .filter((n) => n.id !== targetCol.id)
                      .map((n) => n.id);
                    if (
                      preSelected.length === 0 &&
                      ctxNode &&
                      ctxNode.nodeType !== 'root' &&
                      ctxNode.id !== targetCol.id
                    ) {
                      preSelected.push(ctxNode.id);
                    }
                    setAddToCollectionPrompt({
                      collectionId: targetCol.id,
                      collectionLabel: targetCol.label,
                      selectedIds: preSelected,
                      filterText: '',
                    });
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                  <span>Ajouter dans collection</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!hasAnyCollection || directSubtreeLocked}
                  onClick={() => runCollectionAction('merge', 'Fusionner collection')}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                  <span>Fusionner collection</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!hasAnyCollection || directSubtreeLocked}
                  onClick={() => runCollectionAction('duplicate', 'Dupliquer collection')}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <CopyPlus className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                  <span>Dupliquer collection</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!hasAnyCollection || directTargetLocked}
                  onClick={() => runCollectionAction('integrate', 'Intégrer collection')}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Database className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                  <span>Intégrer collection</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!hasAnyCollection || directSubtreeLocked}
                  onClick={() => runCollectionAction('export', 'Exporter collection')}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Archive className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                  <span>Exporter collection</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!hasAnyCollection || directTargetLocked}
                  onClick={() =>
                    runCollectionAction('import-file', 'Importer fichier dans collection')
                  }
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                  <span>Importer fichier dans collection</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!hasAnyCollection || directTargetLocked}
                  onClick={() =>
                    runCollectionAction('import-dir', 'Importer dossier dans collection')
                  }
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <FolderUp className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                  <span>Importer dossier dans collection</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!hasAnyCollection || directSubtreeLocked}
                  onClick={() => runCollectionAction('delete', 'Supprimer collection')}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-red-400 hover:bg-red-950/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Supprimer collection</span>
                </button>
              </div>
            );
          })()}

          {/* Section dédiée 27 : Exportation États (Suivi des recos & Plan d'audit -> Table Excel / Dashboard PDF) */}
          <div className="border-b border-emerald-800/50 bg-emerald-950/15 py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => setShowExportEtatSubmenu((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Download className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                <span className="font-semibold text-emerald-300">Exporter état</span>
              </span>
              <ChevronRight
                className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                  showExportEtatSubmenu ? 'rotate-90' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {showExportEtatSubmenu && (
              <div className="mx-2 my-1 space-y-1.5 rounded-lg border border-slate-800 bg-slate-950 p-1.5">
                {/* Branche Suivi des recos */}
                <div>
                  <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                    Suivi des recos
                  </div>
                  <div className="mt-0.5 space-y-0.5 pl-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        openExportEtatPanel('suivi-recos', 'table', contextMenu.node);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        <span>Table</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">.xlsx</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        openExportEtatPanel('suivi-recos', 'dashboard', contextMenu.node);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <BarChart3 className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                        <span>Dashboard</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">.pdf</span>
                    </button>
                  </div>
                </div>

                {/* Branche Plan d'audit */}
                <div className="border-t border-slate-800/80 pt-1">
                  <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                    Plan d’audit
                  </div>
                  <div className="mt-0.5 space-y-0.5 pl-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        openExportEtatPanel('plan-audit', 'table', contextMenu.node);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        <span>Table</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">.xlsx</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        openExportEtatPanel('plan-audit', 'dashboard', contextMenu.node);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <GanttChart className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" />
                        <span>Dashboard</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">.pdf</span>
                    </button>
                  </div>
                </div>

                {/* Branche Document */}
                <div className="border-t border-slate-800/80 pt-1">
                  <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
                    Document
                  </div>
                  <div className="mt-0.5 space-y-0.5 pl-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        openExportEtatPanel('document', 'docx', contextMenu.node);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
                        <span>Document Word</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">.docx</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        openExportEtatPanel('document', 'pdf', contextMenu.node);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                        <span>Document PDF</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">.pdf</span>
                    </button>
                  </div>
                </div>

                {/* Branche Étape de mission */}
                <div className="border-t border-slate-800/80 pt-1">
                  <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                    Étape de mission
                  </div>
                  <div className="mt-0.5 space-y-0.5 pl-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        openExportEtatPanel('etape-mission', 'docx', contextMenu.node);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <GanttChart className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
                        <span>Dossier Word</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">.docx</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        openExportEtatPanel('etape-mission', 'pdf', contextMenu.node);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <GanttChart className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                        <span>Dossier PDF</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">.pdf</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {contextMenu.node && (() => {
            const ctxNode = contextMenu.node;
            const nodeEffectivelyLocked = isNodeLockedOrWithinLockedAncestor(trees, ctxNode.id);
            const nodeOrSubtreeLocked = hasLockedNodeInIds(trees, [ctxNode.id]);
            const actionBlockedByLock =
              checkedNonRootNodes.length > 0 ? hasLockedChecked : nodeOrSubtreeLocked;

            return (
            <>
              <div className="border-t border-slate-800 py-1">
                {ctxNode.nodeType !== 'root' && (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={actionBlockedByLock}
                    onClick={() => {
                      onActivateSource(ctxNode.id);
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    <span>
                      Activer (mémoriser)
                      {checkedNonRootNodes.length > 1 ? ` (${checkedNonRootNodes.length})` : ''}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  disabled={effectiveTransferCount === 0 || nodeEffectivelyLocked}
                  onClick={() => {
                    onTransferToTarget(ctxNode.id);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                  <span>Transférer ici ({effectiveTransferCount})</span>
                </button>

                {ctxNode.nodeType !== 'root' &&
                  ctxNode.nodeType !== 'signature' && (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={actionBlockedByLock}
                      onClick={() => {
                        onSignNodes(ctxNode.id);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      <PenLine className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                      <span>Signature ([{session.userSignature}])</span>
                    </button>
                  )}

                {activatedSourceIds.length > 0 && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onClearActivatedSource();
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Annuler la source activée</span>
                  </button>
                )}
              </div>

              <div className="border-t border-slate-800 py-1">
                {ctxNode.nodeType !== 'root' && (
                  <>
                    {(ctxNode.recoMeta ||
                      (ctxNode.nodeType === 'sous-section' &&
                        ctxNode.natureId === 'suivi-recos' &&
                        findRecoRecordByRefOrLabel(ctxNode.label))) && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          openRecoInfoPanel(ctxNode, 'accordeon');
                          setContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sky-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                      >
                        <Info className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                        <span>Détail du suivi (Accordéon 10 col.)</span>
                      </button>
                    )}

                    {ctxNode.natureId === 'suivi-recos' && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          const isDirectReco = Boolean(
                            ctxNode.recoMeta ||
                              (ctxNode.nodeType === 'sous-section' &&
                                findRecoRecordByRefOrLabel(ctxNode.label))
                          );
                          openRecoInfoPanel(
                            ctxNode,
                            'source-file',
                            isDirectReco ? undefined : ctxNode.id
                          );
                          setContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-amber-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                      >
                        <Table2 className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                        <span>Détail informations sources (22 col.)</span>
                      </button>
                    )}

                    {resolveMissionStepClassification(ctxNode).isStep && (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={nodeEffectivelyLocked}
                          onClick={() => {
                            openMissionStepPanel(ctxNode);
                            setContextMenu(null);
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-emerald-300 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                        >
                          <Table2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                          <span>Ouvrir étape (Tables liées · Forme de base)</span>
                        </button>

                        <div>
                          <button
                            type="button"
                            role="menuitem"
                            aria-expanded={showStepImportSubmenu}
                            disabled={nodeEffectivelyLocked || isImportingStepDoc}
                            onClick={() => {
                              setShowStepExportSubmenu(false);
                              setShowStepImportSubmenu((v) => !v);
                            }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-emerald-300 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                          >
                            <span className="flex items-center gap-2.5">
                              <FileUp className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                              <span>Importer étape mission</span>
                            </span>
                            <ChevronRight
                              className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                                showStepImportSubmenu ? 'rotate-90' : ''
                              }`}
                              aria-hidden="true"
                            />
                          </button>

                          {showStepImportSubmenu && (
                            <div
                              role="menu"
                              aria-label="Sous-menu format import étape de mission"
                              className="mx-2 my-1 space-y-0.5 rounded-lg border border-slate-800 bg-slate-950 p-1"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                disabled={nodeEffectivelyLocked || isImportingStepDoc}
                                onClick={() => {
                                  triggerStepDocImportFromMenu(ctxNode);
                                  setContextMenu(null);
                                }}
                                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                              >
                                <FileText className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                                <span>Word · Tables (.doc / .docx)</span>
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                disabled={nodeEffectivelyLocked || isImportingStepDoc}
                                onClick={() => {
                                  triggerStepReportDocImportFromMenu(ctxNode);
                                  setContextMenu(null);
                                }}
                                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                              >
                                <BookOpen className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                                <span>Word · Rapport (.doc / .docx)</span>
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                disabled={nodeEffectivelyLocked || isImportingStepDoc}
                                onClick={() => {
                                  triggerStepExcelImportFromMenu(ctxNode);
                                  setContextMenu(null);
                                }}
                                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
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
                            aria-expanded={showStepExportSubmenu}
                            onClick={() => {
                              setShowStepImportSubmenu(false);
                              setShowStepExportSubmenu((v) => !v);
                            }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-rose-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                          >
                            <span className="flex items-center gap-2.5">
                              <FileDown className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                              <span>Exporter étape mission</span>
                            </span>
                            <ChevronRight
                              className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                                showStepExportSubmenu ? 'rotate-90' : ''
                              }`}
                              aria-hidden="true"
                            />
                          </button>

                          {showStepExportSubmenu && (
                            <div
                              role="menu"
                              aria-label="Sous-menu format export étape de mission"
                              className="mx-2 my-1 space-y-0.5 rounded-lg border border-slate-800 bg-slate-950 p-1"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  handleExportStepDocFromMenu(ctxNode);
                                  setContextMenu(null);
                                }}
                                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                              >
                                <FileText className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                                <span>Word · Tables (.doc)</span>
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  handleExportStepDocReportFromMenu(ctxNode);
                                  setContextMenu(null);
                                }}
                                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                              >
                                <BookOpen className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                                <span>Word · Rapport (.doc)</span>
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  void handleExportStepExcelFromMenu(ctxNode);
                                  setContextMenu(null);
                                }}
                                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                                <span>Excel (.xlsx)</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {onShareNode && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onShareNode(ctxNode);
                          setContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-emerald-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                      >
                        <Share2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        <span>Partager par URL (équipe / sans compte)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      role="menuitem"
                      disabled={nodeEffectivelyLocked}
                      onClick={() => {
                        onOpenWordDoc(ctxNode);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                      <span>
                        {resolveMissionStepClassification(ctxNode).isStep
                          ? 'Ouvrir (Document Word)'
                          : `Ouvrir (Forme source${
                              ctxNode.sourceDocFormat ? ` .${ctxNode.sourceDocFormat}` : ''
                            })`}
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      disabled={nodeEffectivelyLocked}
                      onClick={() => {
                        onIntegrateData(ctxNode);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      <Database className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                      <span>Intégrer data</span>
                    </button>
                  </>
                )}

                {ctxNode.nodeType === 'document' && (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={nodeEffectivelyLocked}
                    onClick={() => {
                      onOpenDocumentInChat(ctxNode);
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>Ouvrir dans le chat</span>
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onDownloadNodes(ctxNode.id);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span>Télécharger</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={
                    ctxNode.nodeType === 'root' ? nodeEffectivelyLocked : actionBlockedByLock
                  }
                  onClick={() => {
                    onExportArchive(ctxNode.id);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Archive className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                  <span>Exporter (archive .zip)</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={nodeEffectivelyLocked}
                  onClick={() => {
                    importTargetIdRef.current = ctxNode.id;
                    setContextMenu(null);
                    importInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Importer fichier(s) / .zip</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={nodeEffectivelyLocked}
                  onClick={() => {
                    importTargetIdRef.current = ctxNode.id;
                    setContextMenu(null);
                    importDirInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <FolderUp className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Importer dossier</span>
                </button>

                {(ctxNode.nodeType !== 'root' || clipboardIds.length > 0) && (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={
                      clipboardIds.length === 0 ? actionBlockedByLock : nodeEffectivelyLocked
                    }
                    onClick={() => {
                      onCopyPasteAction(ctxNode.id);
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    <ClipboardCopy className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
                    <span>
                      {clipboardIds.length > 0
                        ? `Copie / Paste (Coller ici · ${clipboardIds.length})`
                        : 'Copie / Paste (Copier)'}
                    </span>
                  </button>
                )}

                {ctxNode.nodeType !== 'root' && (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={actionBlockedByLock}
                    onClick={() => {
                      onStartMoveNodes(ctxNode.id);
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    <Move className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                    <span>Déplacer (couper / glisser)</span>
                  </button>
                )}

                {ctxNode.nodeType !== 'root' && (
                  <div className="my-1 border-y border-slate-800/80 py-1">
                    <button
                      type="button"
                      role="menuitem"
                      disabled={actionBlockedByLock}
                      onClick={() => {
                        onMoveNodesByDirection('up', ctxNode.id);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      <ArrowUp className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                      <span>Mouvement haut</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={actionBlockedByLock}
                      onClick={() => {
                        onMoveNodesByDirection('down', ctxNode.id);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      <ArrowDown className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                      <span>Mouvement bas</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={actionBlockedByLock}
                      onClick={() => {
                        onMoveNodesByDirection('left', ctxNode.id);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                      <span>Mouvement gauche</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={actionBlockedByLock}
                      onClick={() => {
                        onMoveNodesByDirection('right', ctxNode.id);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      <ArrowRight className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                      <span>Mouvement droit</span>
                    </button>
                  </div>
                )}

                {moveSourceIds.length > 0 && (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={nodeEffectivelyLocked}
                    onClick={() => {
                      onMoveToTarget(ctxNode.id);
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-amber-300 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    <Move className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Déposer ici ({moveSourceIds.length})</span>
                  </button>
                )}

                {ctxNode.nodeType !== 'root' && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={actionBlockedByLock}
                      onClick={() => {
                        onDuplicateNodes(ctxNode.id);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      <CopyPlus className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      <span>Dupliquer</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      disabled={nodeEffectivelyLocked}
                      onClick={() => {
                        setRenamingId(ctxNode.id);
                        setRenameDraft(ctxNode.label);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      <span>Renommer</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onToggleManagerReview(contextMenu.node!.id);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      <ClipboardCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                      <span>
                        {contextMenu.node.managerReviewed
                          ? 'Retirer Revue manager'
                          : 'Revue manager'}
                      </span>
                    </button>

                    {/* Point 1 : Statut d'avancement */}
                    <div>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={actionBlockedByLock}
                        onClick={() => setShowStatusSubmenu((v) => !v)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              ctxNode.status === 'validated'
                                ? 'bg-emerald-400'
                                : ctxNode.status === 'in-review'
                                ? 'bg-amber-400'
                                : ctxNode.status === 'in-progress'
                                ? 'bg-sky-400'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span>
                            Statut ({WORKFLOW_STATUS_LABELS[ctxNode.status || 'todo']})
                          </span>
                        </span>
                        <ChevronRight
                          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                            showStatusSubmenu ? 'rotate-90' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </button>

                      {showStatusSubmenu && !actionBlockedByLock && (
                        <div className="mx-2 my-1 space-y-0.5 rounded-lg border border-slate-800 bg-slate-950 p-1">
                          {(
                            [
                              ['todo', 'bg-slate-400'],
                              ['in-progress', 'bg-sky-400'],
                              ['in-review', 'bg-amber-400'],
                              ['validated', 'bg-emerald-400'],
                            ] as [WorkflowNodeStatus, string][]
                          ).map(([st, dotClass]) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => {
                                onSetNodesStatus(st, ctxNode.id);
                                setContextMenu(null);
                              }}
                              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-800 cursor-pointer"
                            >
                              <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                              <span>{WORKFLOW_STATUS_LABELS[st]}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Point 2 : Notes de revue */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setInspector({ mode: 'notes', nodeId: ctxNode.id });
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      <MessageSquareWarning className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                      <span>
                        Notes de revue
                        {ctxNode.reviewNotes && ctxNode.reviewNotes.length > 0
                          ? ` (${ctxNode.reviewNotes.length})`
                          : ''}
                      </span>
                    </button>

                    {/* Point 4 : Historique des versions */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setInspector({ mode: 'versions', nodeId: ctxNode.id });
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      <History className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                      <span>
                        Historique des versions
                        {ctxNode.versions && ctxNode.versions.length > 0
                          ? ` (${ctxNode.versions.length})`
                          : ''}
                      </span>
                    </button>

                    {/* Point 5 : Cross-référencer + navigation parent/enfant */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setInspector({ mode: 'crossrefs', nodeId: ctxNode.id });
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      <Link2 className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
                      <span>
                        Lier / Cross-référencer
                        {ctxNode.crossRefs && ctxNode.crossRefs.length > 0
                          ? ` (${ctxNode.crossRefs.length})`
                          : ''}
                      </span>
                    </button>

                    {ctxNode.crossRefs && ctxNode.crossRefs.length > 0 && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          if (ctxNode.crossRefs!.length === 1) {
                            onNavigateCrossRef(ctxNode.crossRefs![0]);
                          } else {
                            setInspector({ mode: 'crossrefs', nodeId: ctxNode.id });
                          }
                          setContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-indigo-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                      >
                        <ArrowDownRight className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
                        <span>
                          Aller vers référence enfant ({ctxNode.crossRefs.length})
                        </span>
                      </button>
                    )}

                    {(() => {
                      const ctxParentRefs = parentCrossRefMap.get(ctxNode.id) || [];
                      if (ctxParentRefs.length === 0) return null;
                      return (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            if (ctxParentRefs.length === 1) {
                              onNavigateCrossRef(ctxParentRefs[0].id);
                            } else {
                              setInspector({ mode: 'crossrefs', nodeId: ctxNode.id });
                            }
                            setContextMenu(null);
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-cyan-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                        >
                          <CornerLeftUp className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                          <span>
                            Aller vers parent référent ({ctxParentRefs.length})
                          </span>
                        </button>
                      );
                    })()}

                    {/* Point 7 : Assigner & Échéance */}
                    <button
                      type="button"
                      role="menuitem"
                      disabled={actionBlockedByLock}
                      onClick={() => {
                        const targets =
                          checkedNonRootNodes.length > 0
                            ? checkedNonRootNodes.map((n) => n.id)
                            : [ctxNode.id];
                        setInspector({
                          mode: 'assign',
                          nodeId: ctxNode.id,
                          targetIds: targets,
                        });
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      <UserPlus className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                      <span>Assigner / Échéance</span>
                    </button>

                    {/* Point 25 : To-do liste & Suivi temps (08h/j) */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setInspector({ mode: 'todo', nodeId: ctxNode.id });
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      <ListTodo className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" />
                      <span>
                        To-do liste &amp; Suivi temps (08h/j)
                        {ctxNode.todoTasks && ctxNode.todoTasks.length > 0
                          ? ` (${ctxNode.todoTasks.length})`
                          : ''}
                      </span>
                    </button>

                    {/* Point 8 : Journal de traçabilité */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setInspector({ mode: 'audit', nodeId: ctxNode.id });
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      <ClipboardList className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
                      <span>Journal de traçabilité</span>
                    </button>

                    {!contextMenu.node.locked ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          const targetIds =
                            checkedNonRootNodes.length > 0
                              ? checkedNonRootNodes.map((n) => n.id)
                              : [contextMenu.node!.id];
                          setPinDraft('');
                          setPinPrompt({
                            mode: 'lock',
                            targetIds,
                            targetLabel:
                              targetIds.length > 1
                                ? `${targetIds.length} éléments`
                                : contextMenu.node!.label,
                          });
                          setContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                      >
                        <Lock className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                        <span>Verrouiller (code PIN 4 chiffres)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setPinDraft('');
                          setPinPrompt({
                            mode: 'unlock',
                            targetIds: [contextMenu.node!.id],
                            targetLabel: contextMenu.node!.label,
                          });
                          setContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-amber-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                      >
                        <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Déverrouiller (code PIN)</span>
                      </button>
                    )}
                  </>
                )}

                {/* Point 9 : Contrôle de complétude (disponible aussi sur la racine) */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setReadinessReport(runAuditReadinessCheck(ctxNode, wordBodies));
                    setInspector({ mode: 'readiness', nodeId: ctxNode.id });
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                  <span>Contrôle de complétude</span>
                </button>
              </div>

              <div className="border-t border-slate-800 py-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onAddRandomDocument(contextMenu.node!.id);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <Dices className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                  <span>Ajouter (codification aléatoire)</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAddingTarget({
                      targetId: contextMenu.node!.id,
                      targetLabel: contextMenu.node!.label,
                      kind: 'document',
                    });
                    setAddLabelDraft(generateRandomAuditDocumentName());
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span>Ajouter un document...</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAddingTarget({
                      targetId: contextMenu.node!.id,
                      targetLabel: contextMenu.node!.label,
                      kind: 'section',
                    });
                    setAddLabelDraft('');
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span>Ajouter une section</span>
                </button>

                {(contextMenu.node.nodeType === 'section' ||
                  contextMenu.node.nodeType === 'collection') && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAddingTarget({
                        targetId: contextMenu.node!.id,
                        targetLabel: contextMenu.node!.label,
                        kind: 'sous-section',
                      });
                      setAddLabelDraft('');
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>Ajouter une sous-section</span>
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAddingTarget({
                      targetId: contextMenu.node!.id,
                      targetLabel: contextMenu.node!.label,
                      kind: 'exercice',
                    });
                    setAddLabelDraft('');
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span>Ajouter un exercice</span>
                </button>

                {contextMenu.node.nodeType === 'exercice' && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAddingTarget({
                        targetId: contextMenu.node!.id,
                        targetLabel: contextMenu.node!.label,
                        kind: 'sub-exercice',
                      });
                      setAddLabelDraft('');
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                    <span>Ajouter un sous-exercice</span>
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onAddBlankWorkflow(contextMenu.node!.id);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span>Ajouter un workflow vierge</span>
                </button>

                <div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setShowNatureSubmenu((v) => !v)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Plus className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      <span>Ajouter workflow par nature</span>
                    </span>
                    <ChevronRight
                      className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                        showNatureSubmenu ? 'rotate-90' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {showNatureSubmenu && (
                    <div className="mx-2 my-1 max-h-44 space-y-0.5 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-1">
                      {WORKFLOW_SIDEBAR_ITEMS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onAddNatureWorkflow(item.id, contextMenu.node!.id);
                            setContextMenu(null);
                          }}
                          className="block w-full truncate rounded px-2 py-1 text-left text-[11px] text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Section Thèmes avec sous-menu des couleurs de marque */}
              <div className="border-t border-slate-800 py-1">
                <button
                  type="button"
                  role="menuitem"
                  aria-expanded={showCtxThemeSubmenu}
                  onClick={() => setShowCtxThemeSubmenu((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Palette className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                    <span>Thèmes</span>
                    <span className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-950/70 px-1.5 py-0.5 text-[10px] text-slate-300">
                      <span
                        className="h-2 w-2 rounded-full border"
                        style={{
                          backgroundColor: activeWorkflowTheme.swatchHex,
                          borderColor: activeWorkflowTheme.swatchBorderHex,
                        }}
                        aria-hidden="true"
                      />
                      <span>{activeWorkflowTheme.label}</span>
                    </span>
                  </span>
                  <ChevronRight
                    className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                      showCtxThemeSubmenu ? 'rotate-90' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {showCtxThemeSubmenu && (
                  <div
                    role="menu"
                    aria-label="Sous-menu Thèmes"
                    className="mx-2 my-1 space-y-0.5 rounded-lg border border-slate-800 bg-slate-950 p-1"
                  >
                    {WORKFLOW_THEMES.map((theme) => {
                      const isSelected = theme.id === activeWorkflowTheme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={isSelected}
                          onClick={() => {
                            onSelectWorkflowTheme?.(theme.id);
                            setContextMenu(null);
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-950/80 font-semibold text-white'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full border"
                              style={{
                                backgroundColor: theme.swatchHex,
                                borderColor: theme.swatchBorderHex,
                              }}
                              aria-hidden="true"
                            />
                            <span>{theme.label}</span>
                          </span>
                          {isSelected && (
                            <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {ctxNode.nodeType !== 'root' && (
                <div className="border-t border-slate-800 pt-1">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={actionBlockedByLock}
                    onClick={() => {
                      onDeleteNodes(ctxNode.id);
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-red-400 hover:bg-red-950/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {ctxNode.nodeType === 'nature'
                        ? 'Supprimer ce workflow'
                        : ctxNode.nodeType === 'exercice'
                        ? 'Supprimer cet exercice'
                        : 'Supprimer'}
                    </span>
                  </button>
                </div>
              )}
            </>
            );
          })()}
        </div>
      )}
    </>
  );
};
