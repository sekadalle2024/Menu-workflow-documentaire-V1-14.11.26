import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelRightOpen, RefreshCw, Share2 } from 'lucide-react';
import { AuditChatWorkspace } from './components/AuditChatWorkspace';
import { AuditPlanExecutionView } from './components/AuditPlanExecutionView';
import { DeployScriptView } from './components/DeployScriptView';
import { DossierTreeAccordion } from './components/DossierTreeAccordion';
import { LeftWorkflowSidebar } from './components/LeftWorkflowSidebar';
import { PostgresDriveSchemaView } from './components/PostgresDriveSchemaView';
import { RightSlidingMenu } from './components/RightSlidingMenu';
import { ShareCollabModal } from './components/ShareCollabModal';
import { SharedGuestWorkspace } from './components/SharedGuestWorkspace';
import {
  extractRecoAnalyticsRows,
  SuiviRecosAnalyticsDashboard,
} from './components/SuiviRecosAnalyticsDashboard';
import { TopBar } from './components/TopBar';
import { RecosDashboard } from './features/recos';
import {
  INITIAL_AUDIT_MESSAGES,
  SAMPLE_AUDIT_TEMPLATES,
  STRUCTURE_DOSSIER,
} from './data/dossierStructure';
import {
  INITIAL_CLIENT_SESSION,
  WORKFLOW_SIDEBAR_ITEMS,
  createFullNatureWorkflowNode,
  createInitialWorkflowTrees,
} from './data/workflowCatalog';
import {
  buildInitialSuiviRecosWordBodies,
  updateRecoMetaInTree,
} from './data/suiviRecosSimulation';
import {
  FeuilleCouvertureDocument,
  generateCollectionDataJson,
  generateRandomFeuilleCouvertureJson,
  IntegratedCollectionDocument,
} from './data/feuilleCouvertureTemplates';
import {
  AccordionMode,
  ActiveWorkspaceTab,
  AuditChatMessage,
  ClassifiedTableItem,
  DossierTreeNode,
} from './types/dossier';
import {
  AuditPlanMissionMeta,
  ClientSessionConfig,
  MissionTodoTask,
  RecoSourceMetadata,
  WorkflowNatureId,
  WorkflowNodeStatus,
  WorkflowTreeNode,
} from './types/workflow';
import {
  addTodoTaskOnNode,
  clockInTodoTaskOnNode,
  clockOutTodoTaskOnNode,
  deleteTodoTaskOnNode,
  NewTodoTaskInput,
  updateTodoTaskOnNode,
} from './utils/auditTodoOps';
import {
  collectAllExpandableIds,
  collectAllNodeIds,
  collectSubtreeDossierExpandableIds,
  findSiblingIds,
  getInitialExpandedIds,
  scanDomForAuditTables,
  toggleNodeChecked,
} from './utils/dossierClassifier';
import {
  addChildNodeToTarget,
  addCrossReferenceToNode,
  addExistingNodesToCollection,
  addReviewNoteToNode,
  addWorkflowToExercice,
  appendAuditTrailToNodes,
  applySignatureToNodes,
  assignNodesInTree,
  collectAllExpandableWorkflowIds,
  collectAllWorkflowNodeIds,
  collectDocumentsInNode,
  collectSubtreeExpandableIds,
  createBlankWorkflowNode,
  deleteNodesInTree,
  deleteReviewNoteInTree,
  duplicateNodesInTree,
  filterTopLevelSelectedIds,
  findNodeById,
  findNodeIdsByNatureId,
  findNodePath,
  generateRandomAuditDocumentName,
  hasLockedNodeInIds,
  insertNodesAtTarget,
  isNodeLockedOrWithinLockedAncestor,
  lockNodesInTree,
  mergeCollectionsInTree,
  moveNodesByDirection,
  moveNodesToTarget,
  NodeMoveDirection,
  pasteNodesToTarget,
  removeCrossReferenceFromNode,
  renameNodeInTree,
  resolveContainerTargetId,
  resolveRootIdForTarget,
  restoreNodeVersionSnapshot,
  saveNodeVersionSnapshot,
  setNodesStatusInTree,
  sortExercicesChronologically,
  toggleManagerReviewInTree,
  toggleReviewNoteStatusInTree,
  toggleWorkflowNodeCheck,
  transferNodesToTarget,
  unlockNodeInTree,
  WORKFLOW_STATUS_LABELS,
} from './utils/workflowTreeOps';
import {
  buildArchiveZipBlob,
  parseImportedDirectory,
  parseImportedFiles,
} from './utils/workflowArchive';
import {
  injectMissionsIntoPlanNode,
  updatePlanMissionMetaInTree,
  updatePlanStepDatesInTree,
} from './data/auditPlanWorkflowData';
import {
  buildFormatageDataForNode,
  ParsedBaseTable,
  resolveMissionStepClassification,
} from './data/missionStepsFormatData';
import {
  appendMessageToSqliteChat,
  getStepTablesFromSqlite,
  loadEAuditSqliteDb,
  tablesToMarkdown,
  updateStepTablesInSqlite,
} from './utils/eAuditSqliteStore';
import {
  SharedPhasesConfig,
  SharedRecoRowSnapshot,
  SharedWorkspaceRoom,
} from './types/share';
import {
  createOrSyncShareRoom,
  deterministicTokenForTarget,
  fetchOwnerShareRooms,
  fetchShareRoom,
  patchShareRoom,
  subscribeShareBroadcast,
} from './utils/shareSyncClient';
import {
  collectSubtreeNodeIds,
  EMPTY_SHARED_PHASES,
  filterMissionTreeForStepAndPhases,
  filterNodeByAllowedPhases,
  findMissionContainerForStep,
  getEnabledPhaseLabels,
  mergeAuthorizedPhaseChangesIntoTrees,
  subtreeContainsPhaseNodes,
} from './utils/sharePhaseTree';

interface HistorySnapshot {
  trees: WorkflowTreeNode[];
  wordBodies: Record<string, string>;
  label: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>(() =>
    typeof window !== 'undefined' && window.location.hash === '#recos'
      ? 'recos'
      : 'workspace'
  );
  const [isRightMenuOpen, setIsRightMenuOpen] = useState(false);

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === '#recos') {
        setActiveTab('recos');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // État du chat nod n8n & classification DOM du dossier de mission
  const [messages, setMessages] = useState<AuditChatMessage[]>(INITIAL_AUDIT_MESSAGES);
  const [attachedDoc, setAttachedDoc] = useState<WorkflowTreeNode | null>(null);
  const [missionExpandedIds, setMissionExpandedIds] = useState<Set<string>>(() =>
    getInitialExpandedIds(STRUCTURE_DOSSIER)
  );
  const [accordionMode, setAccordionMode] = useState<AccordionMode>('multi');
  const [classifiedByRubrique, setClassifiedByRubrique] = useState<
    Map<string, ClassifiedTableItem[]>
  >(() => new Map());
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [missionCheckedIds, setMissionCheckedIds] = useState<Set<string>>(() => new Set());

  // État des 10 Workflows (Workflow + Team Workflow) du Menu Coulissant
  const [workflowTrees, setWorkflowTrees] = useState<WorkflowTreeNode[]>(() =>
    createInitialWorkflowTrees()
  );
  const [wfExpandedIds, setWfExpandedIds] = useState<Set<string>>(
    () =>
      new Set([
        'root-workflow',
        'root-team-workflow',
        'user-ex-2025',
        'user-2025-suivi-recos',
        'user-ex-2026',
        'user-2026-ex-audit',
        'user-2026-ex-audit-tresorerie',
        'user-2026-ex-audit-tres-prep',
        'user-2026-ex-audit-tres-real',
        'user-2026-ex-audit-tres-conc',
        'user-2026-plan-audit',
        'team-ex-2026',
        'team-2026-ex-audit',
        'team-2026-ex-audit-tresorerie',
      ])
  );
  const [wfCheckedIds, setWfCheckedIds] = useState<Set<string>>(() => new Set());
  const [activatedSourceIds, setActivatedSourceIds] = useState<string[]>([]);
  const [moveSourceIds, setMoveSourceIds] = useState<string[]>([]);
  const [clipboardIds, setClipboardIds] = useState<string[]>([]);
  const [session, setSession] = useState<ClientSessionConfig>(INITIAL_CLIENT_SESSION);
  const [activeNatureId, setActiveNatureId] = useState<WorkflowNatureId | null>('ex-audit');
  const [activeSubMenuId, setActiveSubMenuId] = useState<string | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [wfStatusMessage, setWfStatusMessage] = useState<string | null>(null);
  const [openedWordDoc, setOpenedWordDoc] = useState<WorkflowTreeNode | null>(null);
  const [wordBodies, setWordBodies] = useState<Record<string, string>>(() =>
    buildInitialSuiviRecosWordBodies()
  );
  const [integratedDataDoc, setIntegratedDataDoc] = useState<{
    node: WorkflowTreeNode;
    data: FeuilleCouvertureDocument;
  } | null>(null);
  const [integratedCollectionDoc, setIntegratedCollectionDoc] = useState<{
    node: WorkflowTreeNode;
    data: IntegratedCollectionDocument;
  } | null>(null);
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  // Collaboration sans compte (Partage par URL)
  const [guestShareToken, setGuestShareToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('share');
  });
  const [shareModalRoom, setShareModalRoom] = useState<SharedWorkspaceRoom | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sqliteRefreshNonce, setSqliteRefreshNonce] = useState(0);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);
  const appliedShareTimestampsRef = useRef<Record<string, number>>({});

  const flashStatus = useCallback((msg: string) => {
    setWfStatusMessage(msg);
    if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = window.setTimeout(() => setWfStatusMessage(null), 3500);
  }, []);

  const pushUndoSnapshot = useCallback(
    (label: string) => {
      setUndoStack((prev) => [
        ...prev.slice(-39),
        { trees: workflowTrees, wordBodies, label },
      ]);
      setRedoStack([]);
    },
    [workflowTrees, wordBodies]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [
      ...prev.slice(-39),
      { trees: workflowTrees, wordBodies, label: last.label },
    ]);
    setWorkflowTrees(last.trees);
    setWordBodies(last.wordBodies);
    setOpenedWordDoc((prev) => (prev ? findNodeById(last.trees, prev.id) : null));
    flashStatus(`Annulé : ${last.label}`);
  }, [undoStack, workflowTrees, wordBodies, flashStatus]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [
      ...prev.slice(-39),
      { trees: workflowTrees, wordBodies, label: next.label },
    ]);
    setWorkflowTrees(next.trees);
    setWordBodies(next.wordBodies);
    setOpenedWordDoc((prev) => (prev ? findNodeById(next.trees, prev.id) : null));
    flashStatus(`Rétabli : ${next.label}`);
  }, [redoStack, workflowTrees, wordBodies, flashStatus]);

  const runDomScan = useCallback(() => {
    const map = scanDomForAuditTables(chatContainerRef.current);
    setClassifiedByRubrique(map);
  }, []);

  useEffect(() => {
    if (activeTab === 'workspace') {
      const raf = requestAnimationFrame(() => runDomScan());
      return () => cancelAnimationFrame(raf);
    }
  }, [messages, activeTab, runDomScan]);

  useEffect(() => {
    const handleCustomToggle = () => setIsRightMenuOpen((prev) => !prev);
    document.addEventListener('dossier:toggle', handleCustomToggle);
    return () => document.removeEventListener('dossier:toggle', handleCustomToggle);
  }, []);

  const { totalTables, rubriquesCount } = useMemo(() => {
    let total = 0;
    classifiedByRubrique.forEach((items) => {
      total += items.length;
    });
    return { totalTables: total, rubriquesCount: classifiedByRubrique.size };
  }, [classifiedByRubrique]);

  // Handlers Mission TreeView (bloc inline)
  const handleToggleMissionNode = useCallback(
    (nodeId: string, level: number) => {
      setMissionExpandedIds((prev) => {
        const next = new Set(prev);
        const willOpen = !next.has(nodeId);
        if (accordionMode === 'single' && willOpen) {
          findSiblingIds(STRUCTURE_DOSSIER, nodeId).forEach((sib) => {
            if (sib !== nodeId) next.delete(sib);
          });
        }
        if (willOpen) next.add(nodeId);
        else next.delete(nodeId);
        return next;
      });
      void level;
    },
    [accordionMode]
  );

  const handleNavigateToTable = useCallback((item: ClassifiedTableItem) => {
    setActiveTableId(item.id);
    if (!item.element) return;
    item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    item.element.classList.remove('audit-table-highlighted');
    void item.element.offsetWidth;
    item.element.classList.add('audit-table-highlighted');
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = window.setTimeout(() => {
      item.element.classList.remove('audit-table-highlighted');
      setActiveTableId(null);
    }, 2200);
  }, []);

  // Handlers Barre latérale gauche -> activation Menu coulissant droit
  const expandPathToNode = useCallback(
    (targetIds: string[]) => {
      setWfExpandedIds((prev) => {
        const next = new Set(prev);
        targetIds.forEach((tid) => {
          const path = findNodePath(workflowTrees, tid);
          path?.forEach((p) => next.add(p.id));
        });
        return next;
      });
    },
    [workflowTrees]
  );

  const handleActivateWorkflowNature = useCallback(
    (natureId: WorkflowNatureId) => {
      setActiveNatureId(natureId);
      setActiveSubMenuId(null);
      const matchingIds = findNodeIdsByNatureId(workflowTrees, natureId);
      if (matchingIds.length > 0) {
        expandPathToNode(matchingIds);
        const primaryUserNode = matchingIds.find((id) => id.startsWith('user-')) ?? matchingIds[0];
        setHighlightedNodeId(primaryUserNode);
      }
      setIsRightMenuOpen(true);
    },
    [workflowTrees, expandPathToNode]
  );

  const handleActivateWorkflowSubItem = useCallback(
    (natureId: WorkflowNatureId, subMenuId: string, targetNodeSuffix: string) => {
      setActiveNatureId(natureId);
      setActiveSubMenuId(subMenuId);
      const userTarget = `user-${targetNodeSuffix}`;
      const teamTarget = `team-${targetNodeSuffix}`;
      expandPathToNode([userTarget, teamTarget]);
      setHighlightedNodeId(userTarget);
      setIsRightMenuOpen(true);
    },
    [expandPathToNode]
  );

  // Handlers Menu Coulissant (Workflow & Team Workflow)
  const handleToggleWfExpand = useCallback((id: string) => {
    setWfExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleExpandWfBranch = useCallback((node: WorkflowTreeNode) => {
    const ids = collectSubtreeExpandableIds(node);
    setWfExpandedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const handleCollapseWfBranch = useCallback((node: WorkflowTreeNode) => {
    const ids = collectSubtreeExpandableIds(node);
    setWfExpandedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const handleToggleWfCheck = useCallback((node: WorkflowTreeNode) => {
    setWfCheckedIds((prev) => toggleWorkflowNodeCheck(node, prev));
  }, []);

  const handleActivateSource = useCallback(
    (fallbackNodeId?: string) => {
      const checkedTopLevel = filterTopLevelSelectedIds(workflowTrees, wfCheckedIds);
      const selected =
        checkedTopLevel.length > 0
          ? checkedTopLevel
          : fallbackNodeId &&
            fallbackNodeId !== 'root-workflow' &&
            fallbackNodeId !== 'root-team-workflow'
          ? [fallbackNodeId]
          : [];
      if (selected.length === 0) return;
      if (hasLockedNodeInIds(workflowTrees, selected)) {
        flashStatus('Action bloquée : un élément verrouillé nécessite son code PIN.');
        return;
      }
      setActivatedSourceIds(selected);
      setWfCheckedIds(new Set());
      flashStatus(
        `${selected.length} élément(s) activé(s) en mémoire. Clic droit sur la destination puis « Transférer ici ».`
      );
    },
    [workflowTrees, wfCheckedIds, flashStatus]
  );

  const handleTransferToTarget = useCallback(
    (targetId: string) => {
      if (!targetId) return;
      const checkedTopLevel = filterTopLevelSelectedIds(workflowTrees, wfCheckedIds);
      const sources =
        activatedSourceIds.length > 0
          ? filterTopLevelSelectedIds(workflowTrees, activatedSourceIds)
          : checkedTopLevel;
      if (sources.length === 0) return;
      if (
        hasLockedNodeInIds(workflowTrees, sources) ||
        isNodeLockedOrWithinLockedAncestor(workflowTrees, targetId)
      ) {
        flashStatus('Transfert bloqué : élément ou destination verrouillé par code PIN.');
        return;
      }

      const targetNode = findNodeById(workflowTrees, targetId);
      pushUndoSnapshot('Transfert');
      setWorkflowTrees((prev) =>
        transferNodesToTarget(prev, sources, targetId, session.userSignature)
      );
      setWfExpandedIds((prev) => {
        const next = new Set(prev);
        const path = findNodePath(workflowTrees, targetId);
        path?.forEach((n) => next.add(n.id));
        next.add(targetId);
        return next;
      });
      setActivatedSourceIds([]);
      setWfCheckedIds(new Set());
      flashStatus(
        `${sources.length} élément(s) transféré(s) vers « ${targetNode?.label || 'destination'} » (source conservée, signature ${session.userSignature}).`
      );
    },
    [activatedSourceIds, wfCheckedIds, workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleOpenWordDoc = useCallback(
    (docNode: WorkflowTreeNode) => {
      if (isNodeLockedOrWithinLockedAncestor(workflowTrees, docNode.id) || docNode.locked) {
        flashStatus('Ouverture bloquée : élément verrouillé par code PIN.');
        return;
      }
      setIntegratedDataDoc(null);
      setIntegratedCollectionDoc(null);
      setOpenedWordDoc(docNode);
      setHighlightedNodeId(docNode.id);
      flashStatus(`Document Word simulé ouvert : « ${docNode.label}.docx »`);
    },
    [workflowTrees, flashStatus]
  );

  const handleIntegrateData = useCallback(
    (docNode: WorkflowTreeNode) => {
      if (isNodeLockedOrWithinLockedAncestor(workflowTrees, docNode.id) || docNode.locked) {
        flashStatus('Action bloquée : élément verrouillé par code PIN.');
        return;
      }
      const generated = generateRandomFeuilleCouvertureJson(docNode.label, docNode.driveId);
      const ref =
        generated['Etape mission - Feuille couverture'].find((e) => 'table 1' in e)?.['table 1']?.[0]
          ?.Reference || 'Feuille couverture';
      setOpenedWordDoc(null);
      setIntegratedCollectionDoc(null);
      setIntegratedDataDoc({ node: docNode, data: generated });
      setHighlightedNodeId(docNode.id);
      flashStatus(`Data JSON collectée pour « ${docNode.label} » (${ref.split(' - ')[0]}).`);
    },
    [workflowTrees, flashStatus]
  );

  const handleRegenerateIntegratedData = useCallback(() => {
    setIntegratedDataDoc((prev) => {
      if (!prev) return null;
      const generated = generateRandomFeuilleCouvertureJson(prev.node.label, prev.node.driveId);
      const ref =
        generated['Etape mission - Feuille couverture'].find((e) => 'table 1' in e)?.['table 1']?.[0]
          ?.Reference || 'Feuille couverture';
      flashStatus(`Nouveau JSON généré aléatoirement (${ref.split(' - ')[0]}).`);
      return { node: prev.node, data: generated };
    });
  }, [flashStatus]);

  const handleIntegrateCollection = useCallback(
    (collectionNode: WorkflowTreeNode) => {
      if (
        isNodeLockedOrWithinLockedAncestor(workflowTrees, collectionNode.id) ||
        collectionNode.locked
      ) {
        flashStatus('Action bloquée : cette collection est verrouillée par code PIN.');
        return;
      }
      const latestNode = findNodeById(workflowTrees, collectionNode.id) ?? collectionNode;
      const docs = collectDocumentsInNode(latestNode);
      const generated = generateCollectionDataJson(latestNode.id, latestNode.label, docs);
      setOpenedWordDoc(null);
      setIntegratedDataDoc(null);
      setIntegratedCollectionDoc({ node: latestNode, data: generated });
      setHighlightedNodeId(latestNode.id);
      flashStatus(
        `Collection intégrée : « ${latestNode.label} » (${docs.length} document(s), ${generated.tablesConsolidees.length} table(s) consolidée(s)).`
      );
    },
    [workflowTrees, flashStatus]
  );

  const handleRegenerateIntegratedCollection = useCallback(() => {
    setIntegratedCollectionDoc((prev) => {
      if (!prev) return null;
      const latestNode = findNodeById(workflowTrees, prev.node.id) ?? prev.node;
      const docs = collectDocumentsInNode(latestNode);
      const generated = generateCollectionDataJson(latestNode.id, latestNode.label, docs);
      flashStatus(`Données de la collection « ${latestNode.label} » régénérées.`);
      return { node: latestNode, data: generated };
    });
  }, [workflowTrees, flashStatus]);

  const handleOpenDocumentInChat = useCallback(
    (docNode: WorkflowTreeNode) => {
      if (isNodeLockedOrWithinLockedAncestor(workflowTrees, docNode.id) || docNode.locked) {
        flashStatus('Ouverture bloquée : élément verrouillé par code PIN.');
        return;
      }
      setAttachedDoc(docNode);
      setActiveTab('workspace');
      setIsRightMenuOpen(false);
      flashStatus(`Document « ${docNode.label} » intégré au contexte du chat.`);
    },
    [workflowTrees, flashStatus]
  );

  const handleDownloadNodes = useCallback(
    (fallbackNodeId?: string) => {
      const targetIds =
        wfCheckedIds.size > 0
          ? Array.from(wfCheckedIds)
          : fallbackNodeId
          ? [fallbackNodeId]
          : [];
      const selectedNodes = targetIds
        .map((id) => findNodeById(workflowTrees, id))
        .filter((n): n is WorkflowTreeNode => Boolean(n));
      if (selectedNodes.length === 0) return;

      const payload = {
        exportedAt: new Date().toISOString(),
        client: session.client,
        ownerEmail: session.email,
        selection: selectedNodes,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flashStatus(`document telecharge (${selectedNodes.length} élément(s) · ${selectedNodes[0].label})`);
    },
    [wfCheckedIds, workflowTrees, session.client, session.email, flashStatus]
  );

  const handleExportArchive = useCallback(
    async (fallbackNodeId?: string) => {
      const checkedTopLevel = filterTopLevelSelectedIds(workflowTrees, wfCheckedIds);
      const targetIds =
        checkedTopLevel.length > 0
          ? checkedTopLevel
          : fallbackNodeId
          ? [fallbackNodeId]
          : [];
      const selectedNodes = targetIds
        .map((id) => findNodeById(workflowTrees, id))
        .filter((n): n is WorkflowTreeNode => Boolean(n));
      if (selectedNodes.length === 0) return;

      const hasLocked = selectedNodes.some((n) =>
        n.nodeType === 'root' ? false : hasLockedNodeInIds(workflowTrees, [n.id])
      );
      if (hasLocked) {
        flashStatus('Export bloqué : un élément verrouillé nécessite son code PIN.');
        return;
      }

      try {
        const { blob, filename } = await buildArchiveZipBlob(selectedNodes, wordBodies, {
          client: session.client,
          email: session.email,
          signature: session.userSignature,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        flashStatus(`Archive exportée dans les téléchargements : ${filename}`);
      } catch {
        flashStatus("Erreur lors de la création de l'archive ZIP.");
      }
    },
    [
      wfCheckedIds,
      workflowTrees,
      wordBodies,
      session.client,
      session.email,
      session.userSignature,
      flashStatus,
    ]
  );

  const handleImportFilesToNode = useCallback(
    async (targetId: string, files: FileList) => {
      if (!targetId || files.length === 0) return;
      if (isNodeLockedOrWithinLockedAncestor(workflowTrees, targetId)) {
        flashStatus('Import bloqué : la destination est verrouillée par code PIN.');
        return;
      }
      try {
        const { nodes: importedNodes, restoredWordBodies } = await parseImportedFiles(
          files,
          session.userSignature,
          session.email
        );
        if (importedNodes.length === 0) {
          flashStatus('Aucun fichier ou dossier valide détecté dans la sélection.');
          return;
        }
        const targetNode = findNodeById(workflowTrees, targetId);
        pushUndoSnapshot('Import fichier(s)');
        setWorkflowTrees((prev) =>
          sortExercicesChronologically(insertNodesAtTarget(prev, targetId, importedNodes))
        );
        if (Object.keys(restoredWordBodies).length > 0) {
          setWordBodies((prev) => ({ ...prev, ...restoredWordBodies }));
        }
        setWfExpandedIds((prev) => {
          const next = new Set(prev);
          const path = findNodePath(workflowTrees, targetId);
          path?.forEach((p) => next.add(p.id));
          next.add(targetId);
          return next;
        });
        setHighlightedNodeId(importedNodes[0].id);
        flashStatus(
          `${importedNodes.length} élément(s) importé(s) sous « ${targetNode?.label || 'destination'} ».`
        );
      } catch {
        flashStatus("Impossible d'importer cette archive ou ce fichier.");
      }
    },
    [workflowTrees, session.userSignature, session.email, pushUndoSnapshot, flashStatus]
  );

  const handleImportDirectoryToNode = useCallback(
    async (targetId: string, files: FileList) => {
      if (!targetId || files.length === 0) return;
      if (isNodeLockedOrWithinLockedAncestor(workflowTrees, targetId)) {
        flashStatus('Import dossier bloqué : la destination est verrouillée par code PIN.');
        return;
      }
      try {
        const { nodes: importedNodes, restoredWordBodies } = await parseImportedDirectory(
          files,
          session.userSignature,
          session.email
        );
        if (importedNodes.length === 0) {
          flashStatus('Le dossier sélectionné ne contient aucun élément importable.');
          return;
        }
        const targetNode = findNodeById(workflowTrees, targetId);
        pushUndoSnapshot('Import dossier');
        setWorkflowTrees((prev) =>
          sortExercicesChronologically(insertNodesAtTarget(prev, targetId, importedNodes))
        );
        if (Object.keys(restoredWordBodies).length > 0) {
          setWordBodies((prev) => ({ ...prev, ...restoredWordBodies }));
        }
        setWfExpandedIds((prev) => {
          const next = new Set(prev);
          const path = findNodePath(workflowTrees, targetId);
          path?.forEach((p) => next.add(p.id));
          next.add(targetId);
          importedNodes.forEach((n) => next.add(n.id));
          return next;
        });
        setHighlightedNodeId(importedNodes[0].id);
        flashStatus(
          `Dossier « ${importedNodes[0].label} » importé sous « ${targetNode?.label || 'destination'} ».`
        );
      } catch {
        flashStatus("Impossible d'importer ce dossier.");
      }
    },
    [workflowTrees, session.userSignature, session.email, pushUndoSnapshot, flashStatus]
  );

  const handleDuplicateNodes = useCallback(
    (fallbackNodeId?: string) => {
      const checkedTopLevel = filterTopLevelSelectedIds(workflowTrees, wfCheckedIds);
      const targetIds =
        checkedTopLevel.length > 0
          ? new Set(checkedTopLevel)
          : fallbackNodeId &&
            fallbackNodeId !== 'root-workflow' &&
            fallbackNodeId !== 'root-team-workflow'
          ? new Set([fallbackNodeId])
          : new Set<string>();
      if (targetIds.size === 0) return;
      if (hasLockedNodeInIds(workflowTrees, targetIds)) {
        flashStatus('Duplication bloquée : un élément verrouillé ne peut pas être dupliqué.');
        return;
      }
      pushUndoSnapshot('Duplication');
      setWorkflowTrees((prev) => duplicateNodesInTree(prev, targetIds));
      flashStatus('Élément(s) dupliqué(s) dans l’arborescence.');
    },
    [workflowTrees, wfCheckedIds, pushUndoSnapshot, flashStatus]
  );

  const handleDeleteNodes = useCallback(
    (fallbackNodeId?: string) => {
      const checkedNonRoot = Array.from(wfCheckedIds).filter(
        (id) => id !== 'root-workflow' && id !== 'root-team-workflow'
      );
      const targetIds =
        checkedNonRoot.length > 0
          ? new Set(checkedNonRoot)
          : fallbackNodeId &&
            fallbackNodeId !== 'root-workflow' &&
            fallbackNodeId !== 'root-team-workflow'
          ? new Set([fallbackNodeId])
          : new Set<string>();
      if (targetIds.size === 0) return;
      if (hasLockedNodeInIds(workflowTrees, targetIds)) {
        flashStatus('Suppression bloquée : un élément verrouillé nécessite son code PIN.');
        return;
      }
      pushUndoSnapshot('Suppression');
      setWorkflowTrees((prev) => deleteNodesInTree(prev, targetIds));
      setWfCheckedIds((prev) => {
        const next = new Set(prev);
        targetIds.forEach((id) => next.delete(id));
        return next;
      });
      setActivatedSourceIds((prev) => prev.filter((id) => !targetIds.has(id)));
      setMoveSourceIds((prev) => prev.filter((id) => !targetIds.has(id)));
      setClipboardIds((prev) => prev.filter((id) => !targetIds.has(id)));
      setOpenedWordDoc((prev) => (prev && targetIds.has(prev.id) ? null : prev));
      setIntegratedDataDoc((prev) => (prev && targetIds.has(prev.node.id) ? null : prev));
      setIntegratedCollectionDoc((prev) => (prev && targetIds.has(prev.node.id) ? null : prev));
      flashStatus('Élément(s) supprimé(s) de la vue.');
    },
    [workflowTrees, wfCheckedIds, pushUndoSnapshot, flashStatus]
  );

  const handleExportCollectionArchive = useCallback(
    async (collectionNode: WorkflowTreeNode) => {
      const target = findNodeById(workflowTrees, collectionNode.id) ?? collectionNode;
      if (hasLockedNodeInIds(workflowTrees, [target.id])) {
        flashStatus('Export collection bloqué : déverrouillez d’abord cette collection.');
        return;
      }
      try {
        const { blob, filename } = await buildArchiveZipBlob([target], wordBodies, {
          client: session.client,
          email: session.email,
          signature: session.userSignature,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        flashStatus(`Collection « ${target.label} » exportée dans les téléchargements : ${filename}`);
      } catch {
        flashStatus("Erreur lors de l'export de la collection.");
      }
    },
    [workflowTrees, wordBodies, session.client, session.email, session.userSignature, flashStatus]
  );

  const handleMergeCollections = useCallback(
    (sourceCollectionId: string, targetCollectionId: string, removeSource = true) => {
      const res = mergeCollectionsInTree(
        workflowTrees,
        sourceCollectionId,
        targetCollectionId,
        session.userSignature,
        wordBodies,
        removeSource
      );
      if (res.error) {
        flashStatus(res.error);
        return;
      }
      pushUndoSnapshot('Fusion de collections');
      setWorkflowTrees(res.trees);
      if (Object.keys(res.copiedWordBodies).length > 0) {
        setWordBodies((prev) => ({ ...prev, ...res.copiedWordBodies }));
      }
      setWfExpandedIds((prev) => {
        const next = new Set(prev);
        const path = findNodePath(res.trees, targetCollectionId);
        path?.forEach((p) => next.add(p.id));
        next.add(targetCollectionId);
        return next;
      });
      setHighlightedNodeId(targetCollectionId);
      flashStatus(`Collections fusionnées (${res.mergedItemsCount} élément(s) regroupé(s)).`);
    },
    [workflowTrees, wordBodies, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleAddExistingToCollection = useCallback(
    (sourceIds: string[], targetCollectionId: string) => {
      const res = addExistingNodesToCollection(
        workflowTrees,
        sourceIds,
        targetCollectionId,
        wordBodies,
        session.userSignature
      );
      if (res.error) {
        flashStatus(res.error);
        return;
      }
      pushUndoSnapshot('Ajout dans collection');
      setWorkflowTrees(res.trees);
      if (Object.keys(res.copiedWordBodies).length > 0) {
        setWordBodies((prev) => ({ ...prev, ...res.copiedWordBodies }));
      }
      setWfExpandedIds((prev) => {
        const next = new Set(prev);
        const path = findNodePath(res.trees, targetCollectionId);
        path?.forEach((p) => next.add(p.id));
        next.add(targetCollectionId);
        return next;
      });
      setWfCheckedIds(new Set());
      setHighlightedNodeId(targetCollectionId);
      flashStatus(`${res.addedCount} élément(s) ajouté(s) dans la collection.`);
    },
    [workflowTrees, wordBodies, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleRenameNode = useCallback(
    (nodeId: string, newLabel: string) => {
      const target = findNodeById(workflowTrees, nodeId);
      if (target?.locked) {
        flashStatus('Renommage bloqué : déverrouillez d’abord cet élément avec son code PIN.');
        return;
      }
      pushUndoSnapshot(`Renommage « ${newLabel} »`);
      setWorkflowTrees((prev) =>
        sortExercicesChronologically(
          appendAuditTrailToNodes(
            renameNodeInTree(prev, nodeId, newLabel),
            new Set([nodeId]),
            session.userSignature,
            'Renommé',
            newLabel
          )
        )
      );
      setOpenedWordDoc((prev) => (prev && prev.id === nodeId ? { ...prev, label: newLabel } : prev));
      flashStatus(`Renommé en « ${newLabel} ».`);
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleSignNodes = useCallback(
    (fallbackNodeId?: string) => {
      const checkedTop = filterTopLevelSelectedIds(workflowTrees, wfCheckedIds);
      const targets =
        checkedTop.length > 0
          ? checkedTop
          : fallbackNodeId &&
            fallbackNodeId !== 'root-workflow' &&
            fallbackNodeId !== 'root-team-workflow'
          ? [fallbackNodeId]
          : [];
      if (targets.length === 0) return;
      if (hasLockedNodeInIds(workflowTrees, targets)) {
        flashStatus('Action Signature bloquée : élément verrouillé par code PIN.');
        return;
      }

      const result = applySignatureToNodes(workflowTrees, targets, session.userSignature);
      if (result.signedCount === 0) {
        flashStatus('Aucun élément éligible à intégrer sous votre signature.');
        return;
      }
      pushUndoSnapshot(`Signature [${session.userSignature}]`);
      setWorkflowTrees(
        appendAuditTrailToNodes(
          result.trees,
          new Set(targets),
          session.userSignature,
          'Signature intégrée',
          `[${session.userSignature}]`
        )
      );
      setWfExpandedIds((prev) => {
        const next = new Set(prev);
        result.signatureFolderIds.forEach((id) => {
          const path = findNodePath(result.trees, id);
          path?.forEach((p) => next.add(p.id));
          next.add(id);
        });
        return next;
      });
      setWfCheckedIds(new Set());
      flashStatus(
        `${result.signedCount} élément(s) intégré(s) sous la signature [${session.userSignature}].`
      );
    },
    [workflowTrees, wfCheckedIds, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleLockNodes = useCallback(
    (targetIds: string[], pin: string) => {
      const idSet = new Set(targetIds);
      if (idSet.size === 0) return;
      pushUndoSnapshot('Verrouillage PIN');
      setWorkflowTrees((prev) => {
        const nextTrees = appendAuditTrailToNodes(
          lockNodesInTree(prev, idSet, pin),
          idSet,
          session.userSignature,
          'Verrouillé par code PIN'
        );
        setOpenedWordDoc((opened) =>
          opened && isNodeLockedOrWithinLockedAncestor(nextTrees, opened.id) ? null : opened
        );
        setIntegratedDataDoc((opened) =>
          opened && isNodeLockedOrWithinLockedAncestor(nextTrees, opened.node.id) ? null : opened
        );
        setIntegratedCollectionDoc((opened) =>
          opened && isNodeLockedOrWithinLockedAncestor(nextTrees, opened.node.id) ? null : opened
        );
        return nextTrees;
      });
      setWfCheckedIds(new Set());
      flashStatus(`Verrouillé (${idSet.size} élément(s)) avec code PIN à 4 chiffres.`);
    },
    [session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleUnlockNode = useCallback(
    (nodeId: string, pin: string): boolean => {
      const res = unlockNodeInTree(workflowTrees, nodeId, pin);
      if (!res.unlocked) {
        return false;
      }
      pushUndoSnapshot('Déverrouillage PIN');
      setWorkflowTrees(
        appendAuditTrailToNodes(
          res.trees,
          new Set([nodeId]),
          session.userSignature,
          'Déverrouillé par code PIN'
        )
      );
      setOpenedWordDoc((prev) =>
        prev && prev.id === nodeId ? { ...prev, locked: false, lockPin: undefined } : prev
      );
      flashStatus('Élément déverrouillé — le cadenas a disparu et le fichier est modifiable.');
      return true;
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleToggleManagerReview = useCallback(
    (fallbackNodeId?: string) => {
      const checkedNonRoot = Array.from(wfCheckedIds).filter(
        (id) => id !== 'root-workflow' && id !== 'root-team-workflow'
      );
      const idSet =
        checkedNonRoot.length > 0
          ? new Set(checkedNonRoot)
          : fallbackNodeId &&
            fallbackNodeId !== 'root-workflow' &&
            fallbackNodeId !== 'root-team-workflow'
          ? new Set([fallbackNodeId])
          : new Set<string>();
      if (idSet.size === 0) return;

      pushUndoSnapshot('Revue manager');
      setWorkflowTrees((prev) =>
        appendAuditTrailToNodes(
          toggleManagerReviewInTree(prev, idSet),
          idSet,
          session.userSignature,
          'Revue manager basculée'
        )
      );
      setOpenedWordDoc((prev) =>
        prev && idSet.has(prev.id)
          ? { ...prev, managerReviewed: !prev.managerReviewed }
          : prev
      );
      flashStatus('Icône « Revue manager » mise à jour.');
    },
    [wfCheckedIds, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleToggleSingleNodeManagerReview = useCallback(
    (nodeId: string) => {
      if (!nodeId || nodeId === 'root-workflow' || nodeId === 'root-team-workflow') return;
      if (isNodeLockedOrWithinLockedAncestor(workflowTrees, nodeId)) {
        flashStatus('Action bloquée : élément verrouillé par code PIN.');
        return;
      }
      const idSet = new Set([nodeId]);
      pushUndoSnapshot('Revue manager');
      setWorkflowTrees((prev) =>
        appendAuditTrailToNodes(
          toggleManagerReviewInTree(prev, idSet),
          idSet,
          session.userSignature,
          'Revue manager basculée'
        )
      );
      setOpenedWordDoc((prev) =>
        prev && idSet.has(prev.id)
          ? { ...prev, managerReviewed: !prev.managerReviewed }
          : prev
      );
      flashStatus('Revue manager mise à jour.');
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleStartMoveNodes = useCallback(
    (fallbackNodeId?: string) => {
      const checkedTop = filterTopLevelSelectedIds(workflowTrees, wfCheckedIds);
      const sources =
        checkedTop.length > 0
          ? checkedTop
          : fallbackNodeId &&
            fallbackNodeId !== 'root-workflow' &&
            fallbackNodeId !== 'root-team-workflow'
          ? [fallbackNodeId]
          : [];
      if (sources.length === 0) return;
      if (hasLockedNodeInIds(workflowTrees, sources)) {
        flashStatus('Déplacement bloqué : déverrouillez d’abord cet élément.');
        return;
      }
      setMoveSourceIds(sources);
      setWfCheckedIds(new Set());
      flashStatus(
        `${sources.length} élément(s) prêt(s) à déplacer. Glissez ou clic droit sur l’emplacement → « Déposer ici ».`
      );
    },
    [workflowTrees, wfCheckedIds, flashStatus]
  );

  const handleMoveToTarget = useCallback(
    (destinationId: string, explicitSourceId?: string) => {
      const sources = explicitSourceId ? [explicitSourceId] : moveSourceIds;
      if (sources.length === 0 || !destinationId) return;

      const res = moveNodesToTarget(workflowTrees, sources, destinationId);
      if (res.error) {
        flashStatus(res.error);
        return;
      }
      if (res.movedCount === 0) return;

      pushUndoSnapshot('Déplacement');
      const destNode = findNodeById(res.trees, destinationId);
      setWorkflowTrees(
        appendAuditTrailToNodes(
          res.trees,
          new Set(sources),
          session.userSignature,
          'Déplacé',
          `Vers « ${destNode?.label || 'destination'} »`
        )
      );
      setWfExpandedIds((prev) => {
        const next = new Set(prev);
        const path = findNodePath(res.trees, destinationId);
        path?.forEach((p) => next.add(p.id));
        next.add(destinationId);
        return next;
      });
      setMoveSourceIds([]);
      setWfCheckedIds(new Set());
      flashStatus(
        `${res.movedCount} élément(s) déplacé(s) vers « ${destNode?.label || 'destination'} » (supprimé de la source).`
      );
    },
    [moveSourceIds, workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleMoveNodesByDirection = useCallback(
    (direction: NodeMoveDirection, fallbackNodeId?: string) => {
      const checkedTop = filterTopLevelSelectedIds(workflowTrees, wfCheckedIds);
      const sources =
        checkedTop.length > 0
          ? checkedTop
          : fallbackNodeId &&
            fallbackNodeId !== 'root-workflow' &&
            fallbackNodeId !== 'root-team-workflow'
          ? [fallbackNodeId]
          : [];
      if (sources.length === 0) return;

      const res = moveNodesByDirection(workflowTrees, sources, direction);
      if (res.error) {
        flashStatus(res.error);
        return;
      }
      if (res.movedCount === 0) return;

      const directionLabels: Record<NodeMoveDirection, string> = {
        up: 'Mouvement haut',
        down: 'Mouvement bas',
        left: 'Mouvement gauche',
        right: 'Mouvement droit',
      };
      pushUndoSnapshot(directionLabels[direction]);
      setWorkflowTrees(
        appendAuditTrailToNodes(
          res.trees,
          new Set(res.movedIds),
          session.userSignature,
          directionLabels[direction]
        )
      );
      setWfExpandedIds((prev) => {
        const next = new Set(prev);
        res.expandedParentIds.forEach((eid) => {
          const path = findNodePath(res.trees, eid);
          path?.forEach((p) => next.add(p.id));
          next.add(eid);
        });
        res.movedIds.forEach((mid) => {
          const path = findNodePath(res.trees, mid);
          path?.slice(0, -1).forEach((p) => next.add(p.id));
        });
        return next;
      });
      if (res.movedIds[0]) {
        setHighlightedNodeId(res.movedIds[0]);
      }

      flashStatus(`${directionLabels[direction]} effectué (${res.movedCount} élément(s)).`);
    },
    [workflowTrees, wfCheckedIds, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleCopyPasteAction = useCallback(
    (fallbackNodeId?: string) => {
      const checkedTop = filterTopLevelSelectedIds(workflowTrees, wfCheckedIds);

      // Phase 1 : Copie dans le presse-papier
      if (clipboardIds.length === 0) {
        const sources =
          checkedTop.length > 0
            ? checkedTop
            : fallbackNodeId &&
              fallbackNodeId !== 'root-workflow' &&
              fallbackNodeId !== 'root-team-workflow'
            ? [fallbackNodeId]
            : [];
        if (sources.length === 0) return;
        if (hasLockedNodeInIds(workflowTrees, sources)) {
          flashStatus('Copie bloquée : un élément verrouillé ne peut pas être copié.');
          return;
        }
        setClipboardIds(sources);
        setWfCheckedIds(new Set());
        flashStatus(
          `${sources.length} élément(s) copié(s). Sélectionnez la destination et cliquez à nouveau sur « Copie / Paste ».`
        );
        return;
      }

      // Phase 2 : Collage vers la destination sélectionnée (case cochée ou clic contextuel)
      const destId = checkedTop[0] || fallbackNodeId;
      if (!destId) return;
      const res = pasteNodesToTarget(workflowTrees, clipboardIds, destId);
      if (res.error) {
        flashStatus(res.error);
        return;
      }
      if (res.pastedCount === 0) return;

      pushUndoSnapshot('Collage');
      const destNode = findNodeById(workflowTrees, destId);
      setWorkflowTrees(res.trees);
      setWfExpandedIds((prev) => {
        const next = new Set(prev);
        const path = findNodePath(res.trees, destId);
        path?.forEach((p) => next.add(p.id));
        next.add(destId);
        return next;
      });
      setClipboardIds([]);
      setWfCheckedIds(new Set());
      flashStatus(
        `${res.pastedCount} élément(s) collé(s) ${
          destNode?.nodeType === 'document' ? 'après' : 'dans'
        } « ${destNode?.label || 'destination'} ».`
      );
    },
    [workflowTrees, wfCheckedIds, clipboardIds, pushUndoSnapshot, flashStatus]
  );

  const handleAddChildToNode = useCallback(
    (
      targetId: string,
      label: string,
      kind: 'document' | 'section' | 'sous-section' | 'exercice' | 'sub-exercice' | 'collection'
    ) => {
      if (!targetId) return;
      const effectiveTargetId =
        kind === 'exercice'
          ? resolveRootIdForTarget(workflowTrees, targetId)
          : kind === 'document'
          ? resolveContainerTargetId(workflowTrees, targetId)
          : targetId;
      const nodeType = kind === 'sub-exercice' ? 'exercice' : kind;
      const newChild: WorkflowTreeNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label,
        nodeType,
        driveId: nodeType === 'document' ? `1drv_${Math.random().toString(36).slice(2, 10)}` : undefined,
        owner: session.userSignature,
        ownerEmail: session.email,
        status: 'todo',
        auditTrail: [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actor: session.userSignature,
            action: 'Création',
            detail: label,
          },
        ],
        children: nodeType === 'document' ? undefined : [],
      };
      pushUndoSnapshot(`Ajout « ${label} »`);
      setWorkflowTrees((prev) =>
        sortExercicesChronologically(addChildNodeToTarget(prev, effectiveTargetId, newChild))
      );
      setWfExpandedIds((prev) => {
        const next = new Set(prev);
        const path = findNodePath(workflowTrees, effectiveTargetId);
        path?.forEach((p) => next.add(p.id));
        next.add(effectiveTargetId);
        return next;
      });
      setHighlightedNodeId(newChild.id);
      flashStatus(
        nodeType === 'collection'
          ? `Collection documentaire créée : « ${label} ».`
          : `Ajouté en dernière position : « ${label} ».`
      );
    },
    [workflowTrees, session.userSignature, session.email, pushUndoSnapshot, flashStatus]
  );

  const handleAddRandomDocument = useCallback(
    (targetId: string) => {
      const randomLabel = generateRandomAuditDocumentName();
      handleAddChildToNode(targetId, randomLabel, 'document');
    },
    [handleAddChildToNode]
  );

  const handleAddBlankWorkflow = useCallback(
    (targetNodeId?: string) => {
      const blank = createBlankWorkflowNode('Workflow domaine');
      const result = addWorkflowToExercice(workflowTrees, targetNodeId, blank);
      pushUndoSnapshot('Ajout workflow vierge');
      setWorkflowTrees(sortExercicesChronologically(result.trees));
      setWfExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(result.rootId);
        next.add(result.targetExerciceId);
        next.add(blank.id);
        blank.children?.forEach((c) => next.add(c.id));
        return next;
      });
      setHighlightedNodeId(blank.id);
      flashStatus('Workflow vierge « Workflow domaine » ajouté (3 sections, 4 sous-sections).');
    },
    [workflowTrees, pushUndoSnapshot, flashStatus]
  );

  const handleAddNatureWorkflow = useCallback(
    (natureId: WorkflowNatureId, targetNodeId?: string) => {
      const meta = WORKFLOW_SIDEBAR_ITEMS.find((i) => i.id === natureId);
      if (!meta) return;
      const rootId = resolveRootIdForTarget(workflowTrees, targetNodeId);
      const scope = rootId === 'root-team-workflow' ? 'team' : 'user';
      const node = createFullNatureWorkflowNode(natureId, scope);
      const result = addWorkflowToExercice(workflowTrees, targetNodeId, node);
      pushUndoSnapshot(`Ajout workflow « ${meta.label} »`);
      setWorkflowTrees(sortExercicesChronologically(result.trees));
      setWfExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(result.rootId);
        next.add(result.targetExerciceId);
        next.add(node.id);
        return next;
      });
      setHighlightedNodeId(node.id);
      flashStatus(`Workflow « ${meta.label} » ajouté avec sa structure complète.`);
    },
    [workflowTrees, pushUndoSnapshot, flashStatus]
  );

  const handleSetNodesStatus = useCallback(
    (status: WorkflowNodeStatus, fallbackNodeId?: string) => {
      const checkedNonRoot = Array.from(wfCheckedIds).filter(
        (id) => id !== 'root-workflow' && id !== 'root-team-workflow'
      );
      const idSet =
        checkedNonRoot.length > 0
          ? new Set(checkedNonRoot)
          : fallbackNodeId &&
            fallbackNodeId !== 'root-workflow' &&
            fallbackNodeId !== 'root-team-workflow'
          ? new Set([fallbackNodeId])
          : new Set<string>();
      if (idSet.size === 0) return;
      if (hasLockedNodeInIds(workflowTrees, idSet)) {
        flashStatus('Action bloquée : un élément verrouillé nécessite son code PIN.');
        return;
      }
      pushUndoSnapshot(`Statut → ${WORKFLOW_STATUS_LABELS[status]}`);
      setWorkflowTrees((prev) =>
        setNodesStatusInTree(prev, idSet, status, session.userSignature)
      );
      flashStatus(
        `Statut mis à jour : « ${WORKFLOW_STATUS_LABELS[status]} » (${idSet.size} élément(s)).`
      );
    },
    [workflowTrees, wfCheckedIds, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleSetSingleNodeStatus = useCallback(
    (status: WorkflowNodeStatus, nodeId: string) => {
      if (!nodeId || nodeId === 'root-workflow' || nodeId === 'root-team-workflow') return;
      const idSet = new Set([nodeId]);
      if (hasLockedNodeInIds(workflowTrees, idSet)) {
        flashStatus('Action bloquée : un élément verrouillé nécessite son code PIN.');
        return;
      }
      pushUndoSnapshot(`Statut → ${WORKFLOW_STATUS_LABELS[status]}`);
      setWorkflowTrees((prev) =>
        setNodesStatusInTree(prev, idSet, status, session.userSignature)
      );
      flashStatus(`Statut mis à jour : « ${WORKFLOW_STATUS_LABELS[status]} ».`);
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleAddReviewNote = useCallback(
    (nodeId: string, text: string) => {
      if (isNodeLockedOrWithinLockedAncestor(workflowTrees, nodeId)) {
        flashStatus('Action bloquée : élément verrouillé par code PIN.');
        return;
      }
      pushUndoSnapshot('Ajout note de revue');
      setWorkflowTrees((prev) =>
        addReviewNoteToNode(prev, nodeId, session.userSignature, text)
      );
      flashStatus('Note de revue ajoutée.');
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleToggleReviewNote = useCallback(
    (nodeId: string, noteId: string) => {
      if (isNodeLockedOrWithinLockedAncestor(workflowTrees, nodeId)) {
        flashStatus('Action bloquée : élément verrouillé par code PIN.');
        return;
      }
      pushUndoSnapshot('Statut note de revue');
      setWorkflowTrees((prev) =>
        toggleReviewNoteStatusInTree(prev, nodeId, noteId, session.userSignature)
      );
      flashStatus('Statut de la note de revue mis à jour.');
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleDeleteReviewNote = useCallback(
    (nodeId: string, noteId: string) => {
      if (isNodeLockedOrWithinLockedAncestor(workflowTrees, nodeId)) {
        flashStatus('Action bloquée : élément verrouillé par code PIN.');
        return;
      }
      pushUndoSnapshot('Suppression note de revue');
      setWorkflowTrees((prev) =>
        deleteReviewNoteInTree(prev, nodeId, noteId, session.userSignature)
      );
      flashStatus('Note de revue supprimée.');
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleSaveVersion = useCallback(
    (nodeId: string, summary: string) => {
      if (isNodeLockedOrWithinLockedAncestor(workflowTrees, nodeId)) {
        flashStatus('Action bloquée : élément verrouillé par code PIN.');
        return;
      }
      const res = saveNodeVersionSnapshot(
        workflowTrees,
        nodeId,
        session.userSignature,
        summary,
        wordBodies[nodeId] ?? ''
      );
      pushUndoSnapshot(`Sauvegarde ${res.versionLabel || 'version'}`);
      setWorkflowTrees(res.trees);
      flashStatus(`Version ${res.versionLabel || ''} enregistrée.`);
    },
    [workflowTrees, wordBodies, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleRestoreVersion = useCallback(
    (nodeId: string, versionId: string) => {
      if (isNodeLockedOrWithinLockedAncestor(workflowTrees, nodeId)) {
        flashStatus('Restauration bloquée : élément verrouillé par code PIN.');
        return;
      }
      const res = restoreNodeVersionSnapshot(
        workflowTrees,
        nodeId,
        versionId,
        session.userSignature
      );
      if (!res.versionLabel) return;
      pushUndoSnapshot(`Restauration ${res.versionLabel}`);
      setWorkflowTrees(res.trees);
      if (res.restoredBody !== undefined) {
        setWordBodies((prev) => ({ ...prev, [nodeId]: res.restoredBody! }));
      }
      setOpenedWordDoc((prev) =>
        prev && prev.id === nodeId && res.restoredLabel
          ? { ...prev, label: res.restoredLabel }
          : prev
      );
      flashStatus(`Version ${res.versionLabel} restaurée.`);
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleAddCrossRef = useCallback(
    (sourceId: string, targetRefId: string) => {
      if (isNodeLockedOrWithinLockedAncestor(workflowTrees, sourceId)) {
        flashStatus('Action bloquée : élément verrouillé par code PIN.');
        return;
      }
      const targetNode = findNodeById(workflowTrees, targetRefId);
      pushUndoSnapshot('Référence croisée');
      setWorkflowTrees((prev) =>
        addCrossReferenceToNode(
          prev,
          sourceId,
          targetRefId,
          session.userSignature,
          targetNode?.label || targetRefId
        )
      );
      flashStatus(`Référence croisée liée à « ${targetNode?.label || targetRefId} ».`);
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleRemoveCrossRef = useCallback(
    (sourceId: string, targetRefId: string) => {
      if (isNodeLockedOrWithinLockedAncestor(workflowTrees, sourceId)) {
        flashStatus('Action bloquée : élément verrouillé par code PIN.');
        return;
      }
      const targetNode = findNodeById(workflowTrees, targetRefId);
      pushUndoSnapshot('Suppression référence croisée');
      setWorkflowTrees((prev) =>
        removeCrossReferenceFromNode(
          prev,
          sourceId,
          targetRefId,
          session.userSignature,
          targetNode?.label
        )
      );
      flashStatus('Référence croisée retirée.');
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleAssignNodes = useCallback(
    (targetIds: string[], assignee: string, dueDate: string) => {
      const idSet = new Set(targetIds);
      if (idSet.size === 0) return;
      if (hasLockedNodeInIds(workflowTrees, idSet)) {
        flashStatus('Action bloquée : élément verrouillé par code PIN.');
        return;
      }
      pushUndoSnapshot('Assignation / Échéance');
      setWorkflowTrees((prev) =>
        assignNodesInTree(prev, idSet, assignee, dueDate, session.userSignature)
      );
      flashStatus(
        assignee.trim()
          ? `Assigné à ${assignee.trim()}${dueDate ? ` (échéance ${dueDate})` : ''}.`
          : 'Assignation effacée.'
      );
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleJumpToNode = useCallback(
    (targetId: string) => {
      const path = findNodePath(workflowTrees, targetId);
      if (path) {
        setWfExpandedIds((prev) => {
          const next = new Set(prev);
          path.slice(0, -1).forEach((p) => next.add(p.id));
          return next;
        });
      }
      setHighlightedNodeId(targetId);
    },
    [workflowTrees]
  );

  const handleNavigateCrossRef = useCallback(
    (targetId: string) => {
      const targetNode = findNodeById(workflowTrees, targetId);
      if (!targetNode) {
        flashStatus('Élément référencé introuvable dans l’arborescence.');
        return;
      }
      const path = findNodePath(workflowTrees, targetId);
      if (path) {
        setWfExpandedIds((prev) => {
          const next = new Set(prev);
          path.forEach((p) => next.add(p.id));
          return next;
        });
      }
      setHighlightedNodeId(targetNode.id);
      if (targetNode.nodeType !== 'root') {
        setWfCheckedIds(new Set([targetNode.id]));
      }
      const locked =
        isNodeLockedOrWithinLockedAncestor(workflowTrees, targetNode.id) ||
        Boolean(targetNode.locked);
      if (locked) {
        flashStatus(
          `Référence croisée sélectionnée : « ${targetNode.label} » (verrouillé par code PIN).`
        );
        return;
      }
      if (targetNode.nodeType !== 'root') {
        setIntegratedDataDoc(null);
        setIntegratedCollectionDoc(null);
        setOpenedWordDoc(targetNode);
        flashStatus(
          `Cross-référence ouverte : « ${targetNode.label} » (sélectionné et affiché).`
        );
      } else {
        flashStatus(`Cross-référence affichée : « ${targetNode.label} ».`);
      }
    },
    [workflowTrees, flashStatus]
  );

  const handleAddTodoTask = useCallback(
    (nodeId: string, input: NewTodoTaskInput) => {
      const res = addTodoTaskOnNode(workflowTrees, nodeId, input, session.userSignature);
      if (res.error) {
        flashStatus(res.error);
        return;
      }
      pushUndoSnapshot(`Tâche To-do « ${input.title} »`);
      setWorkflowTrees(res.trees);
      flashStatus(`Tâche planifiée (08h/j) : « ${input.title} ».`);
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleUpdateTodoTask = useCallback(
    (
      nodeId: string,
      taskId: string,
      patch: Partial<MissionTodoTask>,
      auditLabel = 'Tâche To-do mise à jour'
    ) => {
      const res = updateTodoTaskOnNode(
        workflowTrees,
        nodeId,
        taskId,
        patch,
        session.userSignature,
        auditLabel
      );
      if (res.error) {
        flashStatus(res.error);
        return;
      }
      pushUndoSnapshot(auditLabel);
      setWorkflowTrees(res.trees);
      flashStatus(auditLabel);
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleDeleteTodoTask = useCallback(
    (nodeId: string, taskId: string) => {
      const res = deleteTodoTaskOnNode(workflowTrees, nodeId, taskId, session.userSignature);
      if (res.error) {
        flashStatus(res.error);
        return;
      }
      pushUndoSnapshot('Suppression tâche To-do');
      setWorkflowTrees(res.trees);
      flashStatus('Tâche To-do supprimée.');
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleClockInTodoTask = useCallback(
    (nodeId: string, taskId: string) => {
      const res = clockInTodoTaskOnNode(workflowTrees, nodeId, taskId, session.userSignature);
      if (res.error) {
        flashStatus(res.error);
        return;
      }
      pushUndoSnapshot('Pointage début tâche');
      setWorkflowTrees(res.trees);
      flashStatus('Pointage début enregistré — tâche en cours.');
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleClockOutTodoTask = useCallback(
    (nodeId: string, taskId: string) => {
      const res = clockOutTodoTaskOnNode(workflowTrees, nodeId, taskId, session.userSignature);
      if (res.error) {
        flashStatus(res.error);
        return;
      }
      pushUndoSnapshot('Pointage fin tâche');
      setWorkflowTrees(res.trees);
      flashStatus('Pointage fin enregistré — écart horaire calculé.');
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleInjectPlanMissions = useCallback(
    (targetNodeId: string, count: number) => {
      const res = injectMissionsIntoPlanNode(
        workflowTrees,
        targetNodeId,
        count,
        session.userSignature
      );
      pushUndoSnapshot(`Injection ${res.injectedCount} missions Plan d’audit`);
      setWorkflowTrees(res.trees);
      if (res.targetNatureId) {
        setWfExpandedIds((prev) => {
          const next = new Set(prev);
          next.add(res.targetNatureId!);
          return next;
        });
      }
      flashStatus(
        `Plan annuel d’audit intégré : ${res.injectedCount} missions Industrie 2026 injectées (moy. 3 sem., 3 auditeurs).`
      );
    },
    [workflowTrees, session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleUpdatePlanStepDates = useCallback(
    (
      stepNodeId: string,
      dateDebut: string,
      dateFin: string,
      dateFinReelle?: string
    ) => {
      pushUndoSnapshot('Mise à jour dates étape Plan d’audit');
      setWorkflowTrees((prev) =>
        updatePlanStepDatesInTree(
          prev,
          stepNodeId,
          dateDebut,
          dateFin,
          dateFinReelle,
          session.userSignature
        )
      );
      flashStatus(
        `Dates de l’étape mises à jour (${dateDebut} → ${dateFin}) — Gantts recalculés.`
      );
    },
    [session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleUpdatePlanMissionMeta = useCallback(
    (
      missionNodeId: string,
      patch: Partial<AuditPlanMissionMeta> & { titre?: string }
    ) => {
      pushUndoSnapshot('Modification fiche mission Plan d’audit');
      setWorkflowTrees((prev) =>
        updatePlanMissionMetaInTree(prev, missionNodeId, patch, session.userSignature)
      );
      flashStatus('Informations de la mission mises à jour dans le Plan annuel d’audit.');
    },
    [session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleUpdateRecoMeta = useCallback(
    (recoNodeId: string, patch: Partial<RecoSourceMetadata>) => {
      pushUndoSnapshot('Modification fiche Suivi Recos');
      setWorkflowTrees((prev) =>
        updateRecoMetaInTree(prev, recoNodeId, patch, session.userSignature)
      );
      flashStatus('Informations de la recommandation mises à jour.');
    },
    [session.userSignature, pushUndoSnapshot, flashStatus]
  );

  const handleInitClient = useCallback(() => {
    setSession(INITIAL_CLIENT_SESSION);
    setWorkflowTrees(createInitialWorkflowTrees());
    flashStatus('Client initialisé : 10 workflows standard et clés API restaurés.');
  }, [flashStatus]);

  const handleClearClientKeys = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      userApiKey: '',
      teamApiKey: '',
      userWorkflowVisible: false,
      teamWorkflowVisible: false,
    }));
    setWfCheckedIds(new Set());
    setActivatedSourceIds([]);
    flashStatus('Clés API effacées du front-end (données conservées côté serveur).');
  }, [flashStatus]);

  // Handlers Chat Workspace
  const handleAppendTemplate = useCallback((templateId: string) => {
    const tpl = SAMPLE_AUDIT_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setMessages((prev) => [
      ...prev,
      { ...tpl.message, id: `msg-${Date.now()}`, timestamp },
    ]);
  }, []);

  const handleSendChatPrompt = useCallback(
    (promptText: string, docContext: WorkflowTreeNode | null) => {
      const now = new Date();
      const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const lower = `${promptText} ${docContext?.label || ''}`.toLowerCase();

      let etape = 'Programme de travail';
      let norme = 'Norme 13.6 — Programme de travail';
      let ref = `PRG-${Math.floor(100 + Math.random() * 900)}`;

      if (lower.includes('frap') || lower.includes('problème') || lower.includes('anomalie')) {
        etape = 'FRAP';
        norme = 'Norme 14.3 — Communication des résultats';
        ref = `FRAP-${Math.floor(100 + Math.random() * 900)}`;
      } else if (lower.includes('risque') || lower.includes('carto')) {
        etape = 'Cartographie des risques';
        norme = 'Norme 13.2 — Évaluation des risques';
        ref = `RISK-${Math.floor(100 + Math.random() * 900)}`;
      } else if (lower.includes('qci') || lower.includes('contrôle')) {
        etape = 'Questionnaire de contrôle interne';
        norme = 'Norme 13.4 — Critères d’évaluation';
        ref = `QCI-${Math.floor(100 + Math.random() * 900)}`;
      } else if (lower.includes('rapport final')) {
        etape = 'Rapport final';
        norme = 'Norme 15.1 — Communication finale';
        ref = `RF-${Math.floor(100 + Math.random() * 900)}`;
      }

      const userMsg: AuditChatMessage = {
        id: `msg-u-${Date.now()}`,
        role: 'user',
        author: 'Auditeur interne',
        timestamp,
        content: docContext
          ? `${promptText} [Document joint : ${docContext.label}]`
          : promptText,
      };

      const assistantMsg: AuditChatMessage = {
        id: `msg-a-${Date.now() + 1}`,
        role: 'assistant',
        author: 'Assistant Mission Audit',
        timestamp,
        content: docContext
          ? `Livrable structuré généré à partir du document « ${docContext.label} » (${docContext.driveId || 'Drive'}) :`
          : `Synthèse générée pour votre requête « ${promptText} » :`,
        table: {
          caption: `${etape} — ${docContext ? docContext.label : ref}`,
          headers: ['Etape de mission', 'Norme', 'Source', 'Reference'],
          rows: [
            [
              etape,
              norme,
              docContext ? docContext.label : 'Conversation nod n8n',
              ref,
            ],
          ],
        },
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setAttachedDoc(null);
    },
    []
  );

  const handleSendMissionStepToChat = useCallback(
    (stepNode: WorkflowTreeNode, tables: ParsedBaseTable[]) => {
      if (isNodeLockedOrWithinLockedAncestor(workflowTrees, stepNode.id) || stepNode.locked) {
        flashStatus('Envoi bloqué : étape verrouillée par code PIN.');
        return;
      }
      const now = new Date();
      const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const fmtPayload = buildFormatageDataForNode(stepNode);

      const userMsg: AuditChatMessage = {
        id: `msg-u-step-${Date.now()}`,
        role: 'user',
        author: `${session.userSignature} · ${session.email}`,
        timestamp,
        content: `Ouvrir étape de mission : ${stepNode.label} (${fmtPayload.phase} · ${fmtPayload.formatLabel})`,
      };

      const tableMessages: AuditChatMessage[] = tables.map((tbl, idx) => ({
        id: `msg-a-step-${Date.now()}-${idx}`,
        role: 'assistant',
        author: 'E-audit / Formatage data (SQLite v17)',
        timestamp,
        content:
          idx === 0
            ? `[Formatage data · Type ${fmtPayload.formatType}] ${stepNode.label} — ${tbl.title} (${fmtPayload.norme})`
            : `${stepNode.label} — ${tbl.title} :`,
        table: {
          caption: `${stepNode.label} · ${tbl.title} (${fmtPayload.reference})`,
          headers: tbl.headers,
          rows: tbl.rows,
        },
      }));

      setMessages((prev) => [...prev, userMsg, ...tableMessages]);
      appendMessageToSqliteChat(
        stepNode.sqliteConversationId || 'conv_tres_2026_mission',
        'user_admin_oha',
        `### ${stepNode.label} (${fmtPayload.formatLabel})`,
        tables,
        {
          workflowId: stepNode.id,
          executionId: `exec_${Date.now()}`,
          stepKey: fmtPayload.stepKey,
          formatType: fmtPayload.formatType,
          reference: fmtPayload.reference,
          nodeId: stepNode.id,
        }
      );

      setActiveTab('workspace');
      setIsRightMenuOpen(false);
      flashStatus(
        `Étape « ${stepNode.label} » (${tables.length} table(s)) intégrée dans le Chat et enregistrée dans SQLite v17.`
      );
    },
    [workflowTrees, session.userSignature, session.email, flashStatus]
  );

  const ownerActorLabel = useMemo(
    () => `Propriétaire (${session.userSignature})`,
    [session.userSignature]
  );

  const collectStepTablesForSubtree = useCallback(
    (rootNode: WorkflowTreeNode): Record<string, ParsedBaseTable[]> => {
      const db = loadEAuditSqliteDb(session);
      const map: Record<string, ParsedBaseTable[]> = {};
      const walk = (n: WorkflowTreeNode) => {
        if (n.nodeType === 'document' && resolveMissionStepClassification(n).isStep) {
          map[n.id] = getStepTablesFromSqlite(db, n, session.client).tables;
        }
        n.children?.forEach(walk);
      };
      walk(rootNode);
      return map;
    },
    [session]
  );

  const collectWordBodiesForSubtree = useCallback(
    (rootNode: WorkflowTreeNode): Record<string, string> => {
      const ids = collectSubtreeNodeIds(rootNode);
      const map: Record<string, string> = {};
      ids.forEach((id) => {
        if (typeof wordBodies[id] === 'string') {
          map[id] = wordBodies[id];
        }
      });
      return map;
    },
    [wordBodies]
  );

  const buildRecoSnapshotList = useCallback(
    (scopeRootId: 'root-workflow' | 'root-team-workflow' = 'root-workflow'): SharedRecoRowSnapshot[] => {
      return extractRecoAnalyticsRows(workflowTrees, scopeRootId).map((r) => ({
        nodeId: r.node.id,
        label: r.node.label,
        status: r.node.status || 'todo',
        missionLabel: r.missionLabel,
        exerciceLabel: r.exerciceLabel,
        record: r.record,
      }));
    },
    [workflowTrees]
  );

  const handleOpenShareForMissionStep = useCallback(
    async (stepNode: WorkflowTreeNode, currentTables?: ParsedBaseTable[]) => {
      const db = loadEAuditSqliteDb(session);
      const tables =
        currentTables && currentTables.length > 0
          ? currentTables
          : getStepTablesFromSqlite(db, stepNode, session.client).tables;
      const token = deterministicTokenForTarget(
        'mission-step',
        session.userSignature,
        stepNode.id
      );

      const existingRoom = await fetchShareRoom(token);
      const missionContainer = findMissionContainerForStep(workflowTrees, stepNode.id);
      const hasExistingValidation = Boolean(existingRoom?.phasesValidatedAt);
      const includeWorkflow = hasExistingValidation
        ? Boolean(existingRoom?.includeMissionWorkflow)
        : existingRoom?.includeMissionWorkflow;
      const initialAllowedPhases = hasExistingValidation
        ? existingRoom?.allowedPhases ?? EMPTY_SHARED_PHASES
        : existingRoom?.allowedPhases;

      const filteredMissionTree =
        includeWorkflow && missionContainer
          ? filterMissionTreeForStepAndPhases(
              missionContainer,
              stepNode.id,
              initialAllowedPhases
            )
          : undefined;

      const tablesByNodeId: Record<string, ParsedBaseTable[]> = {
        ...(filteredMissionTree
          ? collectStepTablesForSubtree(filteredMissionTree)
          : {}),
        [stepNode.id]: tables,
      };
      const sharedWordBodies = filteredMissionTree
        ? collectWordBodiesForSubtree(filteredMissionTree)
        : undefined;

      const stepSubtitle = missionContainer
        ? `${stepNode.missionPhase || 'Étape de mission'} · ${missionContainer.label}`
        : stepNode.missionPhase || 'Étape de mission';

      const room = await createOrSyncShareRoom({
        token,
        active: existingRoom?.active ?? true,
        allowEdit: existingRoom?.allowEdit ?? true,
        shareType: 'mission-step',
        title: stepNode.label,
        subtitle: stepSubtitle,
        ownerName: session.userSignature,
        ownerEmail: session.email,
        ownerSignature: session.userSignature,
        clientName: session.client,
        nodeId: stepNode.id,
        node: stepNode,
        includeMissionWorkflow: includeWorkflow,
        missionRootNodeId: missionContainer?.id ?? existingRoom?.missionRootNodeId,
        missionTree: filteredMissionTree,
        allowedPhases: initialAllowedPhases,
        phasesValidatedAt: existingRoom?.phasesValidatedAt,
        wordBodies: sharedWordBodies,
        tablesByNodeId,
        recoUpdatesByNodeId: {},
        lastModifiedBy: ownerActorLabel,
      });
      appliedShareTimestampsRef.current[room.token] = room.updatedAt;
      setShareModalRoom(room);
      setIsShareModalOpen(true);
    },
    [
      session,
      ownerActorLabel,
      workflowTrees,
      collectStepTablesForSubtree,
      collectWordBodiesForSubtree,
    ]
  );

  const handleOpenShareForSuiviRecos = useCallback(
    async (scopeRootId: 'root-workflow' | 'root-team-workflow' = 'root-workflow') => {
      const snapshot = buildRecoSnapshotList(scopeRootId);
      const token = deterministicTokenForTarget(
        'suivi-recos',
        session.userSignature,
        scopeRootId
      );
      const room = await createOrSyncShareRoom({
        token,
        active: true,
        allowEdit: true,
        shareType: 'suivi-recos',
        title: 'Suivi des Recommandations',
        subtitle:
          scopeRootId === 'root-team-workflow'
            ? 'Team Workflow · Auditeurs & Opérationnels'
            : 'Workflow Personnel · Auditeurs & Opérationnels',
        ownerName: session.userSignature,
        ownerEmail: session.email,
        ownerSignature: session.userSignature,
        clientName: session.client,
        nodeId: scopeRootId,
        tablesByNodeId: {},
        recoUpdatesByNodeId: {},
        recoRowsSnapshot: snapshot,
        lastModifiedBy: ownerActorLabel,
      });
      appliedShareTimestampsRef.current[room.token] = room.updatedAt;
      setShareModalRoom(room);
      setIsShareModalOpen(true);
    },
    [buildRecoSnapshotList, session, ownerActorLabel]
  );

  const handleOpenShareForWorkflowNode = useCallback(
    async (targetNode: WorkflowTreeNode) => {
      if (resolveMissionStepClassification(targetNode).isStep) {
        await handleOpenShareForMissionStep(targetNode);
        return;
      }
      if (targetNode.natureId === 'suivi-recos') {
        const isTeam = targetNode.id.startsWith('team-');
        await handleOpenShareForSuiviRecos(
          isTeam ? 'root-team-workflow' : 'root-workflow'
        );
        return;
      }

      const token = deterministicTokenForTarget(
        'workflow-dossier',
        session.userSignature,
        targetNode.id
      );
      const existingRoom = await fetchShareRoom(token);
      const isPhased = subtreeContainsPhaseNodes(targetNode);
      const initialAllowedPhases: SharedPhasesConfig | undefined =
        existingRoom?.allowedPhases ?? (isPhased ? EMPTY_SHARED_PHASES : undefined);

      const filteredNode = filterNodeByAllowedPhases(targetNode, initialAllowedPhases);
      const tablesByNodeId = collectStepTablesForSubtree(filteredNode);
      const sharedWordBodies = collectWordBodiesForSubtree(filteredNode);

      const room = await createOrSyncShareRoom({
        token,
        active: existingRoom?.active ?? true,
        allowEdit: existingRoom?.allowEdit ?? true,
        shareType: 'workflow-dossier',
        title: targetNode.label,
        subtitle: 'Workflow collaboratif · Étapes, Phases & Collections',
        ownerName: session.userSignature,
        ownerEmail: session.email,
        ownerSignature: session.userSignature,
        clientName: session.client,
        nodeId: targetNode.id,
        node: filteredNode,
        allowedPhases: initialAllowedPhases,
        phasesValidatedAt: existingRoom?.phasesValidatedAt,
        wordBodies: sharedWordBodies,
        tablesByNodeId,
        recoUpdatesByNodeId: {},
        lastModifiedBy: ownerActorLabel,
      });
      appliedShareTimestampsRef.current[room.token] = room.updatedAt;
      setShareModalRoom(room);
      setIsShareModalOpen(true);
    },
    [
      handleOpenShareForMissionStep,
      handleOpenShareForSuiviRecos,
      collectStepTablesForSubtree,
      collectWordBodiesForSubtree,
      session,
      ownerActorLabel,
    ]
  );

  const handleValidateSharePhases = useCallback(
    async (
      room: SharedWorkspaceRoom,
      nextPhases: SharedPhasesConfig,
      includeWorkflow: boolean
    ): Promise<SharedWorkspaceRoom | null> => {
      let sourceTrees = workflowTrees;

      if (room.shareType === 'mission-step') {
        if (room.missionTree && room.includeMissionWorkflow) {
          const preMerge = mergeAuthorizedPhaseChangesIntoTrees(
            workflowTrees,
            room.missionTree,
            room.allowedPhases,
            room.nodeId
          );
          if (preMerge.changed) {
            sourceTrees = preMerge.trees;
            setWorkflowTrees(preMerge.trees);
          }
        }

        const stepId = room.nodeId || room.node?.id || '';
        const stepNode =
          (stepId ? findNodeById(sourceTrees, stepId) : null) ?? room.node;
        const missionNode =
          (room.missionRootNodeId
            ? findNodeById(sourceTrees, room.missionRootNodeId)
            : null) ??
          (stepId ? findMissionContainerForStep(sourceTrees, stepId) : null);

        const enabledLabels = getEnabledPhaseLabels(nextPhases);

        if (includeWorkflow && missionNode) {
          const filteredMission = filterMissionTreeForStepAndPhases(
            missionNode,
            stepId,
            nextPhases
          );
          const tablesByNodeId = collectStepTablesForSubtree(filteredMission);
          if (stepNode && !tablesByNodeId[stepNode.id]) {
            const db = loadEAuditSqliteDb(session);
            tablesByNodeId[stepNode.id] = getStepTablesFromSqlite(
              db,
              stepNode,
              session.client
            ).tables;
          }
          const scopedWordBodies = collectWordBodiesForSubtree(filteredMission);

          const updated = await patchShareRoom(room.token, {
            includeMissionWorkflow: true,
            missionRootNodeId: missionNode.id,
            missionTree: filteredMission,
            allowedPhases: nextPhases,
            phasesValidatedAt: Date.now(),
            tablesByNodeId,
            wordBodies: scopedWordBodies,
            isOwnerUpdate: true,
            actor: ownerActorLabel,
            changeSummary:
              enabledLabels.length > 0
                ? `Accès workflow lié & phases validées : ${enabledLabels.join(', ')}`
                : 'Workflow lié activé pour l’étape (aucune phase supplémentaire cochée)',
          });
          if (updated) {
            appliedShareTimestampsRef.current[updated.token] = updated.updatedAt;
            setShareModalRoom(updated);
            flashStatus(
              enabledLabels.length > 0
                ? `Workflow lié & phases validées : ${enabledLabels.join(' · ')}`
                : "Workflow lié activé pour l'étape partagée."
            );
          }
          return updated;
        }

        const updated = await patchShareRoom(room.token, {
          includeMissionWorkflow: false,
          missionTree: null,
          allowedPhases: EMPTY_SHARED_PHASES,
          phasesValidatedAt: Date.now(),
          isOwnerUpdate: true,
          actor: ownerActorLabel,
          changeSummary:
            'Accès au workflow lié désactivé (tables de l’étape uniquement)',
        });
        if (updated) {
          appliedShareTimestampsRef.current[updated.token] = updated.updatedAt;
          setShareModalRoom(updated);
          flashStatus('Accès restreint aux tables de l’étape uniquement.');
        }
        return updated;
      }

      if (room.node && room.allowedPhases) {
        const preMerge = mergeAuthorizedPhaseChangesIntoTrees(
          workflowTrees,
          room.node,
          room.allowedPhases
        );
        if (preMerge.changed) {
          sourceTrees = preMerge.trees;
          setWorkflowTrees(preMerge.trees);
        }
      }

      const targetNode =
        (room.nodeId ? findNodeById(sourceTrees, room.nodeId) : null) ?? room.node;
      if (!targetNode) return null;

      const filteredNode = filterNodeByAllowedPhases(targetNode, nextPhases);
      const tablesByNodeId = collectStepTablesForSubtree(filteredNode);
      const scopedWordBodies = collectWordBodiesForSubtree(filteredNode);
      const enabledLabels = getEnabledPhaseLabels(nextPhases);

      const updated = await patchShareRoom(room.token, {
        allowedPhases: nextPhases,
        phasesValidatedAt: Date.now(),
        node: filteredNode,
        tablesByNodeId,
        wordBodies: scopedWordBodies,
        isOwnerUpdate: true,
        actor: ownerActorLabel,
        changeSummary:
          enabledLabels.length > 0
            ? `Phases validées par le propriétaire : ${enabledLabels.join(', ')}`
            : 'Accès aux phases suspendu par le propriétaire',
      });
      if (updated) {
        appliedShareTimestampsRef.current[updated.token] = updated.updatedAt;
        setShareModalRoom(updated);
        flashStatus(
          enabledLabels.length > 0
            ? `Phases validées pour le partage : ${enabledLabels.join(' · ')}`
            : 'Aucune phase validée pour les invités.'
        );
      }
      return updated;
    },
    [
      workflowTrees,
      session,
      collectStepTablesForSubtree,
      collectWordBodiesForSubtree,
      ownerActorLabel,
      flashStatus,
    ]
  );

  const integrateGuestRoomChanges = useCallback(
    (room: SharedWorkspaceRoom) => {
      setShareModalRoom((prev) =>
        prev && prev.token === room.token && room.updatedAt > prev.updatedAt
          ? room
          : prev
      );

      const lastApplied = appliedShareTimestampsRef.current[room.token] ?? 0;
      if (room.updatedAt <= lastApplied) return;
      appliedShareTimestampsRef.current[room.token] = room.updatedAt;

      if (room.lastModifiedBy === ownerActorLabel) return;

      let tablesIntegratedCount = 0;
      const db = loadEAuditSqliteDb(session);

      Object.entries(room.tablesByNodeId || {}).forEach(([stepNodeId, nextTables]) => {
        if (!Array.isArray(nextTables) || nextTables.length === 0) return;
        const stepNode =
          findNodeById(workflowTrees, stepNodeId) ??
          (room.node ? findNodeById([room.node], stepNodeId) : undefined) ??
          (room.missionTree ? findNodeById([room.missionTree], stepNodeId) : undefined);
        if (!stepNode) return;

        const current = getStepTablesFromSqlite(db, stepNode, session.client).tables;
        if (tablesToMarkdown(current) !== tablesToMarkdown(nextTables)) {
          updateStepTablesInSqlite(
            stepNode,
            nextTables,
            'collab_guest',
            `Édition collaborative (${room.lastModifiedBy || 'Invité'})`,
            session.client
          );
          tablesIntegratedCount += 1;
        }
      });

      if (tablesIntegratedCount > 0) {
        setSqliteRefreshNonce((n) => n + 1);
      }

      let treePhasesUpdatedCount = 0;
      let wordBodiesIntegratedCount = 0;
      let workingTrees = workflowTrees;
      const newlyAddedToExpand: string[] = [];

      const guestTreeToMerge =
        room.shareType === 'workflow-dossier'
          ? room.node
          : room.shareType === 'mission-step' && room.includeMissionWorkflow
          ? room.missionTree
          : undefined;

      if (guestTreeToMerge) {
        const treeMerge = mergeAuthorizedPhaseChangesIntoTrees(
          workingTrees,
          guestTreeToMerge,
          room.allowedPhases,
          room.shareType === 'mission-step' ? room.nodeId : undefined
        );
        if (treeMerge.changed) {
          workingTrees = treeMerge.trees;
          treePhasesUpdatedCount = treeMerge.updatedPhaseLabels.length;
          newlyAddedToExpand.push(...treeMerge.newlyAddedNodeIds);
        }

        const wordBodiesPatch: Record<string, string> = {};
        Object.entries(room.wordBodies || {}).forEach(([docId, content]) => {
          if (
            treeMerge.authorizedDocIds.has(docId) &&
            typeof content === 'string' &&
            wordBodies[docId] !== content
          ) {
            wordBodiesPatch[docId] = content;
          }
        });
        wordBodiesIntegratedCount = Object.keys(wordBodiesPatch).length;
        if (wordBodiesIntegratedCount > 0) {
          setWordBodies((prev) => ({ ...prev, ...wordBodiesPatch }));
        }
      }

      const recoEntries = Object.entries(room.recoUpdatesByNodeId || {});
      let recosIntegratedCount = 0;
      if (recoEntries.length > 0 || treePhasesUpdatedCount > 0) {
        let nextTrees = workingTrees;
        recoEntries.forEach(([recoNodeId, patch]) => {
          if (!patch) return;
          if (patch.recoMeta && Object.keys(patch.recoMeta).length > 0) {
            nextTrees = updateRecoMetaInTree(
              nextTrees,
              recoNodeId,
              patch.recoMeta,
              room.lastModifiedBy || 'EXT'
            );
            recosIntegratedCount += 1;
          }
          if (patch.status) {
            nextTrees = setNodesStatusInTree(
              nextTrees,
              new Set([recoNodeId]),
              patch.status,
              room.lastModifiedBy || 'EXT'
            );
          }
        });
        setWorkflowTrees(nextTrees);
        if (newlyAddedToExpand.length > 0) {
          setWfExpandedIds((prev) => {
            const next = new Set(prev);
            newlyAddedToExpand.forEach((addedId) => {
              const path = findNodePath(nextTrees, addedId);
              path?.forEach((p) => next.add(p.id));
            });
            return next;
          });
        }
      }

      if (
        tablesIntegratedCount > 0 ||
        recosIntegratedCount > 0 ||
        treePhasesUpdatedCount > 0 ||
        wordBodiesIntegratedCount > 0
      ) {
        const parts: string[] = [];
        if (tablesIntegratedCount > 0) parts.push(`${tablesIntegratedCount} table(s) SQLite`);
        if (treePhasesUpdatedCount > 0) parts.push(`${treePhasesUpdatedCount} phase(s) TreeView`);
        if (wordBodiesIntegratedCount > 0) parts.push(`${wordBodiesIntegratedCount} pièce(s)`);
        if (recosIntegratedCount > 0) parts.push(`${recosIntegratedCount} reco(s)`);
        flashStatus(
          `Collaboration intégrée (${room.lastModifiedBy || 'Invité'}) : ${parts.join(', ')} mise(s) à jour.`
        );
      }
    },
    [ownerActorLabel, session, workflowTrees, wordBodies, flashStatus]
  );

  useEffect(() => {
    if (guestShareToken) return;

    const syncAll = async () => {
      const rooms = await fetchOwnerShareRooms(session.email);
      rooms.forEach((r) => integrateGuestRoomChanges(r));
    };

    void syncAll();
    const unsub = subscribeShareBroadcast((room) => {
      if (room.ownerEmail.toLowerCase() === session.email.toLowerCase()) {
        integrateGuestRoomChanges(room);
      }
    });
    const timer = window.setInterval(() => {
      void syncAll();
    }, 2500);
    window.addEventListener('focus', syncAll);

    return () => {
      unsub();
      window.clearInterval(timer);
      window.removeEventListener('focus', syncAll);
    };
  }, [guestShareToken, session.email, integrateGuestRoomChanges]);

  if (guestShareToken) {
    return (
      <SharedGuestWorkspace
        token={guestShareToken}
        onExitGuestMode={() => {
          setGuestShareToken(null);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('share');
            window.history.replaceState({}, '', url.toString());
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isPanelOpen={isRightMenuOpen}
        onTogglePanel={() => setIsRightMenuOpen((prev) => !prev)}
      />

      {activeTab === 'recos' ? (
        <main className="min-h-[calc(100vh-57px)] w-full">
          <RecosDashboard className="min-h-[calc(100vh-57px)]" />
        </main>
      ) : (
        <main className="mx-auto max-w-[1440px] px-6 py-6">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-slate-500">
              SaaS Audit &amp; Commissariat aux Comptes · nod n8n
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
              Gestion des Workflows Documentaires &amp; Dossiers d&apos;Audit
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-5 text-sm">
              <div>
                <div className="text-xs text-slate-500">Tables classées</div>
                <div className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                  {totalTables}
                </div>
              </div>
              <div className="h-7 w-px bg-slate-200" aria-hidden="true" />
              <div>
                <div className="text-xs text-slate-500">Rubriques actives</div>
                <div className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                  {rubriquesCount}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runDomScan}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Analyser DOM</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetNode =
                    findNodeById(workflowTrees, 'user-2026-ex-audit') ?? workflowTrees[0];
                  if (targetNode) {
                    void handleOpenShareForWorkflowNode(targetNode);
                  }
                }}
                title="Générer une URL de partage collaborative (équipe / opérationnels sans compte)"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Partager</span>
              </button>
              <button
                type="button"
                onClick={() => setIsRightMenuOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PanelRightOpen className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Ouvrir Workflows</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-6 lg:flex-row">
          <LeftWorkflowSidebar
            activeNatureId={activeNatureId}
            activeSubMenuId={activeSubMenuId}
            onActivateWorkflowNature={handleActivateWorkflowNature}
            onActivateWorkflowSubItem={handleActivateWorkflowSubItem}
          />

          <div className="min-w-0 flex-1 w-full">
            {activeTab === 'workspace' && (
              <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
                <div className="xl:col-span-7">
                  <AuditChatWorkspace
                    messages={messages}
                    onAppendTemplate={handleAppendTemplate}
                    onSendChatPrompt={handleSendChatPrompt}
                    onResetMessages={() => {
                      setMessages(INITIAL_AUDIT_MESSAGES);
                      setActiveTableId(null);
                    }}
                    chatContainerRef={chatContainerRef}
                    attachedDoc={attachedDoc}
                    onClearAttachedDoc={() => setAttachedDoc(null)}
                  />
                </div>

                <section
                  id="accordeon-direct"
                  aria-label="Indexation automatique des étapes de mission"
                  className="flex h-[710px] flex-col rounded-xl border border-slate-200 bg-white xl:col-span-5"
                >
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div>
                      <h2 className="font-display text-base font-semibold text-slate-900">
                        Dossier de Mission (DOM)
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Classification en temps réel des tables du chat.
                      </p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-blue-700 tabular-nums">
                      {totalTables} classées
                    </span>
                  </div>

                  <div className="flex-1 overflow-hidden p-4">
                    <DossierTreeAccordion
                      nodes={STRUCTURE_DOSSIER}
                      expandedIds={missionExpandedIds}
                      onToggleNode={handleToggleMissionNode}
                      onExpandBranch={(node) => {
                        const ids = collectSubtreeDossierExpandableIds(node, classifiedByRubrique);
                        setMissionExpandedIds((prev) => {
                          const next = new Set(prev);
                          ids.forEach((id) => next.add(id));
                          return next;
                        });
                      }}
                      onCollapseBranch={(node) => {
                        const ids = collectSubtreeDossierExpandableIds(node, classifiedByRubrique);
                        setMissionExpandedIds((prev) => {
                          const next = new Set(prev);
                          ids.forEach((id) => next.delete(id));
                          return next;
                        });
                      }}
                      onExpandAll={() =>
                        setMissionExpandedIds(collectAllExpandableIds(STRUCTURE_DOSSIER))
                      }
                      onCollapseAll={() => setMissionExpandedIds(new Set())}
                      accordionMode={accordionMode}
                      onChangeAccordionMode={setAccordionMode}
                      classifiedByRubrique={classifiedByRubrique}
                      onNavigateToTable={handleNavigateToTable}
                      activeTableId={activeTableId}
                      checkedIds={missionCheckedIds}
                      onToggleCheckNode={(node: DossierTreeNode) =>
                        setMissionCheckedIds((prev) =>
                          toggleNodeChecked(node, prev, classifiedByRubrique)
                        )
                      }
                      onToggleCheckItem={(itemId: string) =>
                        setMissionCheckedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(itemId)) next.delete(itemId);
                          else next.add(itemId);
                          return next;
                        })
                      }
                      onSelectAll={() => {
                        const next = new Set<string>(collectAllNodeIds(STRUCTURE_DOSSIER));
                        classifiedByRubrique.forEach((items) =>
                          items.forEach((it) => next.add(it.id))
                        );
                        setMissionCheckedIds(next);
                      }}
                      onClearSelection={() => setMissionCheckedIds(new Set())}
                    />
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'suivi-recos-analytics' && (
              <SuiviRecosAnalyticsDashboard
                trees={workflowTrees}
                onToggleManagerReview={handleToggleSingleNodeManagerReview}
                onSetNodeStatus={handleSetSingleNodeStatus}
                onAddReviewNote={handleAddReviewNote}
                onToggleReviewNote={handleToggleReviewNote}
                onDeleteReviewNote={handleDeleteReviewNote}
                onUpdateRecoMeta={handleUpdateRecoMeta}
                onShareSuiviRecos={(scopeId) => void handleOpenShareForSuiviRecos(scopeId)}
                onOpenWordDoc={(docNode) => {
                  handleJumpToNode(docNode.id);
                  handleOpenWordDoc(docNode);
                  setIsRightMenuOpen(true);
                }}
                onIntegrateCollection={(colNode) => {
                  handleJumpToNode(colNode.id);
                  handleIntegrateCollection(colNode);
                  setIsRightMenuOpen(true);
                }}
                onOpenNodeInWorkflow={(nodeId) => {
                  handleJumpToNode(nodeId);
                  setIsRightMenuOpen(true);
                }}
              />
            )}

            {activeTab === 'audit-plan' && (
              <AuditPlanExecutionView
                trees={workflowTrees}
                userSignature={session.userSignature}
                onAddTodoTask={handleAddTodoTask}
                onUpdateTodoTask={handleUpdateTodoTask}
                onDeleteTodoTask={handleDeleteTodoTask}
                onClockInTodoTask={handleClockInTodoTask}
                onClockOutTodoTask={handleClockOutTodoTask}
                onInjectPlanMissions={handleInjectPlanMissions}
                onUpdatePlanStepDates={handleUpdatePlanStepDates}
                onUpdatePlanMissionMeta={handleUpdatePlanMissionMeta}
                onOpenNodeInWorkflow={(nodeId) => {
                  handleJumpToNode(nodeId);
                  setIsRightMenuOpen(true);
                }}
              />
            )}

            {activeTab === 'schema' && (
              <PostgresDriveSchemaView trees={workflowTrees} session={session} />
            )}

            {activeTab === 'script' && <DeployScriptView />}
          </div>
        </div>
        </main>
      )}

      <RightSlidingMenu
        isOpen={isRightMenuOpen}
        onClose={() => setIsRightMenuOpen(false)}
        trees={workflowTrees}
        expandedIds={wfExpandedIds}
        onToggleExpand={handleToggleWfExpand}
        onExpandBranch={handleExpandWfBranch}
        onCollapseBranch={handleCollapseWfBranch}
        onExpandAll={() =>
          setWfExpandedIds(collectAllExpandableWorkflowIds(workflowTrees))
        }
        onCollapseAll={() => setWfExpandedIds(new Set())}
        checkedIds={wfCheckedIds}
        onToggleCheck={handleToggleWfCheck}
        onSelectAll={() =>
          setWfCheckedIds(new Set(collectAllWorkflowNodeIds(workflowTrees)))
        }
        onClearChecked={() => setWfCheckedIds(new Set())}
        activatedSourceIds={activatedSourceIds}
        onActivateSource={handleActivateSource}
        onClearActivatedSource={() => setActivatedSourceIds([])}
        onTransferToTarget={handleTransferToTarget}
        moveSourceIds={moveSourceIds}
        onStartMoveNodes={handleStartMoveNodes}
        onMoveToTarget={handleMoveToTarget}
        onMoveNodesByDirection={handleMoveNodesByDirection}
        onClearMoveSource={() => setMoveSourceIds([])}
        clipboardIds={clipboardIds}
        onCopyPasteAction={handleCopyPasteAction}
        onClearClipboard={() => setClipboardIds([])}
        onSignNodes={handleSignNodes}
        onLockNodes={handleLockNodes}
        onUnlockNode={handleUnlockNode}
        onToggleManagerReview={handleToggleManagerReview}
        openedWordDoc={openedWordDoc}
        wordBodies={wordBodies}
        onUpdateWordBody={(docId, content) =>
          setWordBodies((prev) => ({ ...prev, [docId]: content }))
        }
        onOpenWordDoc={handleOpenWordDoc}
        onCloseWordDoc={() => setOpenedWordDoc(null)}
        integratedDataDoc={integratedDataDoc}
        onIntegrateData={handleIntegrateData}
        onRegenerateIntegratedData={handleRegenerateIntegratedData}
        onCloseIntegratedData={() => setIntegratedDataDoc(null)}
        integratedCollectionDoc={integratedCollectionDoc}
        onIntegrateCollection={handleIntegrateCollection}
        onRegenerateIntegratedCollection={handleRegenerateIntegratedCollection}
        onCloseIntegratedCollection={() => setIntegratedCollectionDoc(null)}
        onExportCollectionArchive={handleExportCollectionArchive}
        onMergeCollections={handleMergeCollections}
        onAddExistingToCollection={handleAddExistingToCollection}
        onOpenDocumentInChat={handleOpenDocumentInChat}
        onSendMissionStepToChat={handleSendMissionStepToChat}
        sqliteRefreshNonce={sqliteRefreshNonce}
        onShareNode={(node) => void handleOpenShareForWorkflowNode(node)}
        onShareMissionStep={(node, tables) =>
          void handleOpenShareForMissionStep(node, tables)
        }
        onSqliteSynced={(detail, stepNode, nextTables) => {
          flashStatus(detail);
          if (stepNode && nextTables) {
            void fetchOwnerShareRooms(session.email).then((rooms) => {
              rooms.forEach((r) => {
                if (
                  r.active &&
                  (r.nodeId === stepNode.id ||
                    Boolean(r.tablesByNodeId?.[stepNode.id]))
                ) {
                  void patchShareRoom(r.token, {
                    tablesByNodeId: { [stepNode.id]: nextTables },
                    isOwnerUpdate: true,
                    actor: ownerActorLabel,
                    changeSummary: `Mise à jour propriétaire : ${stepNode.label}`,
                  }).then((updated) => {
                    if (updated) {
                      appliedShareTimestampsRef.current[updated.token] =
                        updated.updatedAt;
                    }
                  });
                }
              });
            });
          }
        }}
        onDownloadNodes={handleDownloadNodes}
        onExportArchive={handleExportArchive}
        onImportFilesToNode={handleImportFilesToNode}
        onImportDirectoryToNode={handleImportDirectoryToNode}
        onDuplicateNodes={handleDuplicateNodes}
        onDeleteNodes={handleDeleteNodes}
        onRenameNode={handleRenameNode}
        onAddChildToNode={handleAddChildToNode}
        onAddRandomDocument={handleAddRandomDocument}
        onAddBlankWorkflow={handleAddBlankWorkflow}
        onAddNatureWorkflow={handleAddNatureWorkflow}
        session={session}
        onUpdateSession={setSession}
        onInitClient={handleInitClient}
        onClearClientKeys={handleClearClientKeys}
        highlightedNodeId={highlightedNodeId}
        statusMessage={wfStatusMessage}
        canUndo={undoStack.length > 0}
        undoLabel={undoStack[undoStack.length - 1]?.label}
        canRedo={redoStack.length > 0}
        redoLabel={redoStack[redoStack.length - 1]?.label}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSetNodesStatus={handleSetNodesStatus}
        onAddReviewNote={handleAddReviewNote}
        onToggleReviewNote={handleToggleReviewNote}
        onDeleteReviewNote={handleDeleteReviewNote}
        onSaveVersion={handleSaveVersion}
        onRestoreVersion={handleRestoreVersion}
        onAddCrossRef={handleAddCrossRef}
        onRemoveCrossRef={handleRemoveCrossRef}
        onAssignNodes={handleAssignNodes}
        onJumpToNode={handleJumpToNode}
        onNavigateCrossRef={handleNavigateCrossRef}
        onAddTodoTask={handleAddTodoTask}
        onUpdateTodoTask={handleUpdateTodoTask}
        onDeleteTodoTask={handleDeleteTodoTask}
        onClockInTodoTask={handleClockInTodoTask}
        onClockOutTodoTask={handleClockOutTodoTask}
        onInjectPlanMissions={handleInjectPlanMissions}
        onUpdatePlanStepDates={handleUpdatePlanStepDates}
        onUpdatePlanMissionMeta={handleUpdatePlanMissionMeta}
        onUpdateRecoMeta={handleUpdateRecoMeta}
        onOpenAuditPlanTab={() => {
          setActiveTab('audit-plan');
          setIsRightMenuOpen(false);
        }}
        onOpenSuiviRecosAnalyticsTab={() => {
          setActiveTab('suivi-recos-analytics');
          setIsRightMenuOpen(false);
        }}
      />

      <ShareCollabModal
        room={shareModalRoom}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onUpdateRoom={(nextRoom) => {
          appliedShareTimestampsRef.current[nextRoom.token] = nextRoom.updatedAt;
          setShareModalRoom(nextRoom);
        }}
        onValidatePhases={handleValidateSharePhases}
        onPreviewGuest={(token) => setGuestShareToken(token)}
      />
    </div>
  );
}
