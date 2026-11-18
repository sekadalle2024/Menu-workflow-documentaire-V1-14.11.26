import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Layers,
  Lock,
  MoreVertical,
  PanelRight,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  Table2,
  Trash2,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  buildFormatageDataForNode,
  normalizeWorkflowBaseTables,
  ParsedBaseTable,
  resolveMissionStepClassification,
} from '../data/missionStepsFormatData';
import { SharedRecoRowSnapshot, SharedWorkspaceRoom } from '../types/share';
import {
  ClientSessionConfig,
  RecoSourceMetadata,
  SourceDocFormat,
  WorkflowNodeStatus,
  WorkflowTreeNode,
} from '../types/workflow';
import { tablesToMarkdown } from '../utils/eAuditSqliteStore';
import {
  filterMissionTreeForStepAndPhases,
  filterNodeByAllowedPhases,
  findPreferredAuthorizedPhaseNode,
  getEnabledPhaseLabels,
  hasAnyAllowedPhase,
  isNodeInsideAuthorizedPhase,
  subtreeContainsPhaseNodes,
} from '../utils/sharePhaseTree';
import {
  fetchShareRoom,
  patchShareRoom,
  subscribeShareBroadcast,
} from '../utils/shareSyncClient';
import { parseImportedFiles } from '../utils/workflowArchive';
import {
  WORKFLOW_STATUS_LABELS,
  addChildNodeToTarget,
  cloneNodeWithFreshIds,
  deleteNodesInTree,
  findNodeById,
  findNodePath,
  insertNodesAtTarget,
  renameNodeInTree,
  resolveContainerTargetId,
  setNodesStatusInTree,
} from '../utils/workflowTreeOps';
import { MissionStepTableViewer } from './MissionStepTableViewer';

interface SharedGuestWorkspaceProps {
  token: string;
  onExitGuestMode: () => void;
}

const GUEST_ACTOR_STORAGE_KEY = 'eaudit_guest_actor_name';

function findFirstStepNode(node: WorkflowTreeNode | undefined | null): WorkflowTreeNode | null {
  if (!node) return null;
  if (node.nodeType === 'document' && resolveMissionStepClassification(node).isStep) {
    return node;
  }
  if (node.children) {
    for (const child of node.children) {
      const found = findFirstStepNode(child);
      if (found) return found;
    }
  }
  return null;
}

function collectExpandableIds(
  node: WorkflowTreeNode | undefined | null,
  out = new Set<string>()
): Set<string> {
  if (!node) return out;
  if (node.children && node.children.length > 0) {
    out.add(node.id);
    node.children.forEach((c) => collectExpandableIds(c, out));
  }
  return out;
}

const STATUT_OPTIONS: Array<{
  label: 'Réalisé' | 'En attente' | 'Reporté' | 'Non réalisé';
  status: WorkflowNodeStatus;
}> = [
  { label: 'Non réalisé', status: 'todo' },
  { label: 'Reporté', status: 'in-progress' },
  { label: 'En attente', status: 'in-review' },
  { label: 'Réalisé', status: 'validated' },
];

export const SharedGuestWorkspace: React.FC<SharedGuestWorkspaceProps> = ({
  token,
  onExitGuestMode,
}) => {
  const [room, setRoom] = useState<SharedWorkspaceRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [guestActor, setGuestActor] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Collaborateur / Opérationnel';
    return (
      window.sessionStorage.getItem(GUEST_ACTOR_STORAGE_KEY) ||
      'Collaborateur / Opérationnel'
    );
  });

  // Pour workflow-dossier : nœud sélectionné & nœuds dépliés
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  // Formulaires collaboratifs TreeView (Collection, Pièce, Sous-section, Renommage, Suppression, Contenu pièce, Menu contextuel)
  const [creationMode, setCreationMode] = useState<
    'collection' | 'piece' | 'sous-section' | null
  >(null);
  const [creationTargetId, setCreationTargetId] = useState<string | null>(null);
  const [newCollectionLabel, setNewCollectionLabel] = useState('');
  const [newSubSectionLabel, setNewSubSectionLabel] = useState('');
  const [newPieceLabel, setNewPieceLabel] = useState('');
  const [newPieceFormat, setNewPieceFormat] = useState<SourceDocFormat>('docx');
  const [newPieceNote, setNewPieceNote] = useState('');
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteNodeId, setConfirmDeleteNodeId] = useState<string | null>(null);
  const [docBodyDraft, setDocBodyDraft] = useState('');
  const [docBodyDirty, setDocBodyDirty] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: WorkflowTreeNode;
  } | null>(null);

  // Pour suivi-recos : ligne sélectionnée pour édition détaillée
  const [editingRecoCell, setEditingRecoCell] = useState<{
    nodeId: string;
    field: keyof RecoSourceMetadata;
    draft: string;
  } | null>(null);
  const [recoSearch, setRecoSearch] = useState('');
  const [showWorkflowPane, setShowWorkflowPane] = useState(true);
  const [recoContextMenu, setRecoContextMenu] = useState<{
    x: number;
    y: number;
    row: SharedRecoRowSnapshot & { lastEditedBy?: string };
    field?: keyof RecoSourceMetadata;
  } | null>(null);

  const mutationSeqRef = useRef(0);
  const isPatchingRef = useRef(false);
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);
  const importTargetIdRef = useRef<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const recoContextMenuRef = useRef<HTMLDivElement | null>(null);
  const knownFolderIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(GUEST_ACTOR_STORAGE_KEY, guestActor);
    }
  }, [guestActor]);

  useEffect(() => {
    if (!contextMenu && !recoContextMenu) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        contextMenu &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
      if (
        recoContextMenu &&
        recoContextMenuRef.current &&
        !recoContextMenuRef.current.contains(e.target as Node)
      ) {
        setRecoContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setRecoContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, recoContextMenu]);

  const loadRoom = useCallback(
    async (isInitial = false) => {
      if (!isInitial && isPatchingRef.current) return;
      const startSeq = mutationSeqRef.current;
      if (isInitial) setLoading(true);
      const fetched = await fetchShareRoom(token);
      if (!isInitial && (isPatchingRef.current || startSeq !== mutationSeqRef.current)) {
        return;
      }
      if (fetched) {
        setRoom((prev) => {
          if (prev && fetched.updatedAt <= prev.updatedAt) return prev;
          return fetched;
        });
        if (isInitial) {
          if (fetched.shareType === 'mission-step' && (fetched.node || fetched.nodeId)) {
            const stepTargetId = fetched.nodeId || fetched.node?.id || null;
            setSelectedNodeId(stepTargetId);
            if (fetched.includeMissionWorkflow && fetched.missionTree) {
              const visible = filterMissionTreeForStepAndPhases(
                fetched.missionTree,
                stepTargetId || '',
                fetched.allowedPhases
              );
              const allExp = collectExpandableIds(visible);
              knownFolderIdsRef.current = new Set(allExp);
              setExpandedIds(allExp);
            }
          } else if (fetched.shareType === 'workflow-dossier' && fetched.node) {
            const visible = filterNodeByAllowedPhases(fetched.node, fetched.allowedPhases);
            const allExp = collectExpandableIds(visible);
            knownFolderIdsRef.current = new Set(allExp);
            setExpandedIds(allExp);
            const initialSelection =
              findFirstStepNode(visible) ??
              findPreferredAuthorizedPhaseNode(visible, fetched.allowedPhases) ??
              visible;
            setSelectedNodeId(initialSelection.id);
          }
        }
      } else if (isInitial) {
        setRoom(null);
      }
      if (isInitial) setLoading(false);
    },
    [token]
  );

  useEffect(() => {
    void loadRoom(true);
    const unsub = subscribeShareBroadcast((incoming) => {
      if (incoming.token === token && !isPatchingRef.current) {
        setRoom((prev) => {
          if (prev && incoming.updatedAt <= prev.updatedAt) return prev;
          return incoming;
        });
      }
    });
    const timer = window.setInterval(() => {
      void loadRoom(false);
    }, 2500);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, [token, loadRoom]);

  const guestSession: ClientSessionConfig = useMemo(
    () => ({
      email: room?.ownerEmail || 'collaborateur@externe.local',
      client: room?.clientName || 'Espace collaboratif',
      userSignature: room?.ownerSignature || 'EXT',
      userApiKey: '',
      teamApiKey: '',
      userWorkflowVisible: true,
      teamWorkflowVisible: true,
    }),
    [room?.ownerEmail, room?.clientName, room?.ownerSignature]
  );

  const visibleWorkflowTree = useMemo(() => {
    if (!room) return null;
    if (room.shareType === 'workflow-dossier') {
      return room.node
        ? filterNodeByAllowedPhases(room.node, room.allowedPhases)
        : null;
    }
    if (room.shareType === 'mission-step') {
      if (!room.includeMissionWorkflow || !room.missionTree) return null;
      const stepId = room.nodeId || room.node?.id || '';
      return filterMissionTreeForStepAndPhases(
        room.missionTree,
        stepId,
        room.allowedPhases
      );
    }
    return null;
  }, [
    room?.shareType,
    room?.node,
    room?.nodeId,
    room?.includeMissionWorkflow,
    room?.missionTree,
    room?.allowedPhases,
  ]);

  const showWorkflowSplit = useMemo(() => {
    if (!room) return false;
    return room.shareType === 'workflow-dossier' || room.shareType === 'mission-step';
  }, [room]);

  const isPhasedWorkflow = useMemo(() => {
    if (!room) return false;
    if (room.shareType === 'workflow-dossier' && room.node) {
      return Boolean(room.allowedPhases) || subtreeContainsPhaseNodes(room.node);
    }
    if (
      room.shareType === 'mission-step' &&
      room.includeMissionWorkflow &&
      room.missionTree
    ) {
      return Boolean(room.allowedPhases) || subtreeContainsPhaseNodes(room.missionTree);
    }
    return false;
  }, [room]);

  const hasPendingPhaseValidation = useMemo(() => {
    if (!room || room.shareType !== 'workflow-dossier' || !isPhasedWorkflow) {
      return false;
    }
    return !hasAnyAllowedPhase(room.allowedPhases);
  }, [isPhasedWorkflow, room]);

  const enabledPhaseLabels = useMemo(
    () => getEnabledPhaseLabels(room?.allowedPhases),
    [room?.allowedPhases]
  );

  // Déplier automatiquement les nouveaux dossiers/phases validés par le propriétaire
  useEffect(() => {
    if (!visibleWorkflowTree) return;
    const currentExpandable = collectExpandableIds(visibleWorkflowTree);
    const newlyDiscovered: string[] = [];
    currentExpandable.forEach((id) => {
      if (!knownFolderIdsRef.current.has(id)) {
        newlyDiscovered.push(id);
        knownFolderIdsRef.current.add(id);
      }
    });
    if (newlyDiscovered.length > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        newlyDiscovered.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [visibleWorkflowTree]);

  const activeNode: WorkflowTreeNode | null = useMemo(() => {
    if (!room) return null;
    if (visibleWorkflowTree && selectedNodeId) {
      const found = findNodeById([visibleWorkflowTree], selectedNodeId);
      if (found) return found;
    }
    if (room.shareType === 'mission-step') {
      const stepId = room.nodeId || room.node?.id;
      if (visibleWorkflowTree && stepId) {
        const stepInTree = findNodeById([visibleWorkflowTree], stepId);
        if (stepInTree) return stepInTree;
      }
      return room.node ?? null;
    }
    if (!visibleWorkflowTree) return null;
    return (
      findFirstStepNode(visibleWorkflowTree) ??
      findPreferredAuthorizedPhaseNode(visibleWorkflowTree, room.allowedPhases) ??
      visibleWorkflowTree
    );
  }, [room, visibleWorkflowTree, selectedNodeId]);

  const activeStepTables: ParsedBaseTable[] = useMemo(() => {
    if (!activeNode || !room) return [];
    if (
      activeNode.nodeType !== 'document' ||
      !resolveMissionStepClassification(activeNode).isStep
    ) {
      return [];
    }
    return normalizeWorkflowBaseTables(
      room.tablesByNodeId[activeNode.id] ||
        buildFormatageDataForNode(activeNode, room.clientName, '2026').baseTables
    );
  }, [activeNode, room?.tablesByNodeId, room?.clientName]);

  // Cible autorisée pour la création de collections / ajout de pièces dans la TreeView
  const targetContainerNode: WorkflowTreeNode | null = useMemo(() => {
    if (!visibleWorkflowTree || !room || hasPendingPhaseValidation) return null;
    if (
      creationTargetId &&
      isNodeInsideAuthorizedPhase(visibleWorkflowTree, creationTargetId, room.allowedPhases)
    ) {
      const explicitTarget = findNodeById([visibleWorkflowTree], creationTargetId);
      if (explicitTarget) {
        if (explicitTarget.nodeType === 'document') {
          const cid = resolveContainerTargetId([visibleWorkflowTree], explicitTarget.id);
          return findNodeById([visibleWorkflowTree], cid) ?? explicitTarget;
        }
        return explicitTarget;
      }
    }
    if (
      activeNode &&
      isNodeInsideAuthorizedPhase(visibleWorkflowTree, activeNode.id, room.allowedPhases)
    ) {
      if (activeNode.nodeType === 'document') {
        const containerId = resolveContainerTargetId([visibleWorkflowTree], activeNode.id);
        return findNodeById([visibleWorkflowTree], containerId) ?? activeNode;
      }
      return activeNode;
    }
    if (hasAnyAllowedPhase(room.allowedPhases)) {
      return findPreferredAuthorizedPhaseNode(visibleWorkflowTree, room.allowedPhases);
    }
    return null;
  }, [visibleWorkflowTree, room, hasPendingPhaseValidation, creationTargetId, activeNode]);

  // Synchroniser le brouillon du document non-étape sélectionné quand on change de nœud
  useEffect(() => {
    if (!activeNode || !room) return;
    if (
      activeNode.nodeType === 'document' &&
      !resolveMissionStepClassification(activeNode).isStep
    ) {
      const serverBody =
        room.wordBodies?.[activeNode.id] ??
        `Pièce : ${activeNode.label}\nAjoutée dans le dossier collaboratif (${room.clientName}).`;
      setDocBodyDraft(serverBody);
      setDocBodyDirty(false);
    }
  }, [activeNode?.id]);

  // Si un patch externe met à jour le document non-étape et qu'il n'est pas en cours d'édition
  useEffect(() => {
    if (!activeNode || !room || docBodyDirty) return;
    if (
      activeNode.nodeType === 'document' &&
      !resolveMissionStepClassification(activeNode).isStep
    ) {
      const serverBody = room.wordBodies?.[activeNode.id];
      if (typeof serverBody === 'string' && serverBody !== docBodyDraft) {
        setDocBodyDraft(serverBody);
      }
    }
  }, [room?.wordBodies, activeNode?.id, docBodyDirty]);

  const showToast = (msg: string) => {
    setSyncMessage(msg);
    window.setTimeout(() => setSyncMessage(null), 3400);
  };

  const handleGuestStepTablesChange = async (
    targetNode: WorkflowTreeNode,
    nextTables: ParsedBaseTable[],
    reason: string
  ) => {
    if (!room || !room.active || !room.allowEdit) {
      setErrorBanner('Modification refusée : accès en lecture seule ou partage désactivé.');
      return;
    }
    setErrorBanner(null);
    mutationSeqRef.current += 1;
    isPatchingRef.current = true;
    const actor = guestActor.trim() || 'Collaborateur invité';
    const optimistic: SharedWorkspaceRoom = {
      ...room,
      tablesByNodeId: {
        ...room.tablesByNodeId,
        [targetNode.id]: nextTables,
      },
      updatedAt: Math.max(Date.now(), room.updatedAt + 1),
      lastModifiedBy: actor,
    };
    setRoom(optimistic);

    try {
      const updated = await patchShareRoom(room.token, {
        tablesByNodeId: {
          [targetNode.id]: nextTables,
        },
        actor,
        changeSummary: `${targetNode.label} : ${reason}`,
      });
      if (updated) {
        setRoom(updated);
        showToast(
          `Modification intégrée chez ${room.ownerName} (${new Date().toLocaleTimeString('fr-FR')})`
        );
      }
    } finally {
      isPatchingRef.current = false;
    }
  };

  const handleGuestTreeMutation = async (
    nextTreeNode: WorkflowTreeNode,
    changeSummary: string,
    wordBodiesPatch?: Record<string, string>,
    nextSelectedId?: string,
    expandAlsoIds?: string[],
    tablesPatch?: Record<string, ParsedBaseTable[]>
  ) => {
    if (!room || !room.active || !room.allowEdit) {
      setErrorBanner('Action refusée : accès en lecture seule ou partage désactivé.');
      return;
    }
    if (hasPendingPhaseValidation) {
      setErrorBanner(
        'Action bloquée : le propriétaire doit d’abord valider au moins une phase.'
      );
      return;
    }
    setErrorBanner(null);
    mutationSeqRef.current += 1;
    isPatchingRef.current = true;
    const actor = guestActor.trim() || 'Collaborateur invité';

    if (expandAlsoIds && expandAlsoIds.length > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        expandAlsoIds.forEach((id) => {
          next.add(id);
          knownFolderIdsRef.current.add(id);
        });
        return next;
      });
    }
    if (nextSelectedId) {
      setSelectedNodeId(nextSelectedId);
    }

    const isMissionStepWorkflow = room.shareType === 'mission-step';
    const updatedPrimaryStepNode =
      isMissionStepWorkflow && room.nodeId
        ? findNodeById([nextTreeNode], room.nodeId) ?? room.node
        : undefined;

    const optimistic: SharedWorkspaceRoom = {
      ...room,
      ...(isMissionStepWorkflow
        ? {
            missionTree: nextTreeNode,
            ...(updatedPrimaryStepNode ? { node: updatedPrimaryStepNode } : {}),
          }
        : { node: nextTreeNode }),
      wordBodies: wordBodiesPatch
        ? { ...(room.wordBodies || {}), ...wordBodiesPatch }
        : room.wordBodies,
      tablesByNodeId: tablesPatch
        ? { ...room.tablesByNodeId, ...tablesPatch }
        : room.tablesByNodeId,
      updatedAt: Math.max(Date.now(), room.updatedAt + 1),
      lastModifiedBy: actor,
    };
    setRoom(optimistic);

    try {
      const updated = await patchShareRoom(room.token, {
        ...(isMissionStepWorkflow
          ? {
              missionTree: nextTreeNode,
              ...(updatedPrimaryStepNode ? { node: updatedPrimaryStepNode } : {}),
            }
          : { node: nextTreeNode }),
        wordBodies: wordBodiesPatch,
        tablesByNodeId: tablesPatch,
        actor,
        changeSummary,
      });
      if (updated) {
        setRoom(updated);
        showToast(`Workflow synchronisé chez ${room.ownerName}`);
      }
    } finally {
      isPatchingRef.current = false;
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visibleWorkflowTree || !targetContainerNode || !room) return;
    const label = newCollectionLabel.trim();
    if (!label) return;

    const actor = guestActor.trim() || 'Collaborateur invité';
    const sig = actor.slice(0, 6).toUpperCase() || 'EXT';
    const colId = `col-guest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newCol: WorkflowTreeNode = {
      id: colId,
      label,
      nodeType: 'collection',
      natureId: targetContainerNode.natureId || 'ex-audit',
      owner: sig,
      ownerEmail: room.ownerEmail,
      status: 'todo',
      children: [],
      auditTrail: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor,
          action: 'Création collection (invité)',
          detail: label,
        },
      ],
    };

    const nextTrees = addChildNodeToTarget(
      [visibleWorkflowTree],
      targetContainerNode.id,
      newCol
    );
    setNewCollectionLabel('');
    setCreationMode(null);
    setCreationTargetId(null);
    await handleGuestTreeMutation(
      nextTrees[0],
      `Collection créée dans « ${targetContainerNode.label} » : ${label}`,
      undefined,
      colId,
      [targetContainerNode.id, colId]
    );
  };

  const handleCreateSubSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visibleWorkflowTree || !targetContainerNode || !room) return;
    const label = newSubSectionLabel.trim();
    if (!label) return;

    const actor = guestActor.trim() || 'Collaborateur invité';
    const sig = actor.slice(0, 6).toUpperCase() || 'EXT';
    const subId = `sub-guest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newSub: WorkflowTreeNode = {
      id: subId,
      label,
      nodeType: 'sous-section',
      natureId: targetContainerNode.natureId || 'ex-audit',
      missionPhase: targetContainerNode.missionPhase,
      owner: sig,
      ownerEmail: room.ownerEmail,
      status: 'todo',
      children: [],
      auditTrail: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor,
          action: 'Création sous-section (invité)',
          detail: label,
        },
      ],
    };

    const nextTrees = addChildNodeToTarget(
      [visibleWorkflowTree],
      targetContainerNode.id,
      newSub
    );
    setNewSubSectionLabel('');
    setCreationMode(null);
    setCreationTargetId(null);
    await handleGuestTreeMutation(
      nextTrees[0],
      `Sous-section créée dans « ${targetContainerNode.label} » : ${label}`,
      undefined,
      subId,
      [targetContainerNode.id, subId]
    );
  };

  const handleCreatePiece = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visibleWorkflowTree || !targetContainerNode || !room) return;
    const rawLabel = newPieceLabel.trim();
    if (!rawLabel) return;

    const hasExt = /\.(docx|xlsx|pdf|txt|csv|md)$/i.test(rawLabel);
    const label = hasExt ? rawLabel : `${rawLabel}.${newPieceFormat}`;
    const actor = guestActor.trim() || 'Collaborateur invité';
    const sig = actor.slice(0, 6).toUpperCase() || 'EXT';
    const docId = `doc-guest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newDoc: WorkflowTreeNode = {
      id: docId,
      label,
      nodeType: 'document',
      natureId: targetContainerNode.natureId || 'ex-audit',
      driveId: `1drv_${Math.random().toString(36).slice(2, 10)}`,
      owner: sig,
      ownerEmail: room.ownerEmail,
      status: 'todo',
      isMissionStep: false,
      missionStepFormatType: 4,
      missionStepKey: 'doc-source',
      sourceDocFormat: newPieceFormat,
      auditTrail: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor,
          action: 'Ajout pièce (invité)',
          detail: label,
        },
      ],
    };

    const bodyContent =
      newPieceNote.trim() ||
      `Pièce ajoutée par ${actor} dans « ${targetContainerNode.label} » le ${new Date().toLocaleDateString('fr-FR')}.`;

    const nextTrees = addChildNodeToTarget(
      [visibleWorkflowTree],
      targetContainerNode.id,
      newDoc
    );
    setNewPieceLabel('');
    setNewPieceNote('');
    setCreationMode(null);
    setCreationTargetId(null);
    await handleGuestTreeMutation(
      nextTrees[0],
      `Pièce ajoutée dans « ${targetContainerNode.label} » : ${label}`,
      { [docId]: bodyContent },
      docId,
      [targetContainerNode.id]
    );
  };

  const handleImportPiecesFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !visibleWorkflowTree || !room) {
      return;
    }
    const preferredTarget =
      (importTargetIdRef.current
        ? findNodeById([visibleWorkflowTree], importTargetIdRef.current)
        : null) ?? targetContainerNode;
    importTargetIdRef.current = null;
    if (!preferredTarget) return;

    const actor = guestActor.trim() || 'Collaborateur invité';
    const sig = actor.slice(0, 6).toUpperCase() || 'EXT';
    try {
      const { nodes: importedNodes, restoredWordBodies } = await parseImportedFiles(
        files,
        sig,
        room.ownerEmail
      );
      if (importedNodes.length === 0) {
        setErrorBanner('Aucun fichier valide sélectionné.');
        return;
      }
      const enrichedBodies: Record<string, string> = { ...restoredWordBodies };
      const tagImported = (n: WorkflowTreeNode): WorkflowTreeNode => {
        if (n.nodeType === 'document' && !enrichedBodies[n.id]) {
          enrichedBodies[n.id] = `Pièce importée par ${actor} (${new Date().toLocaleString('fr-FR')}) dans « ${preferredTarget.label} ».`;
        }
        return {
          ...n,
          isMissionStep: n.isMissionStep ?? false,
          missionStepFormatType: n.missionStepFormatType ?? 4,
          missionStepKey: n.missionStepKey ?? 'doc-source',
          auditTrail: [
            ...(n.auditTrail || []),
            {
              id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              timestamp: new Date().toISOString(),
              actor,
              action: 'Import pièce (invité)',
              detail: n.label,
            },
          ],
          children: n.children?.map(tagImported),
        };
      };
      const taggedNodes = importedNodes.map(tagImported);
      const nextTrees = insertNodesAtTarget(
        [visibleWorkflowTree],
        preferredTarget.id,
        taggedNodes
      );
      await handleGuestTreeMutation(
        nextTrees[0],
        `${taggedNodes.length} pièce(s) importée(s) dans « ${preferredTarget.label} »`,
        enrichedBodies,
        taggedNodes[0].id,
        [preferredTarget.id]
      );
    } catch {
      setErrorBanner("Erreur lors de l'importation des pièces.");
    }
  };

  const handleRenameGuestNode = async (node: WorkflowTreeNode) => {
    if (!visibleWorkflowTree || !room) return;
    const nextLabel = renameDraft.trim();
    setRenamingNodeId(null);
    if (!nextLabel || nextLabel === node.label) return;
    const nextTrees = renameNodeInTree([visibleWorkflowTree], node.id, nextLabel);
    await handleGuestTreeMutation(
      nextTrees[0],
      `Renommage : « ${node.label} » → « ${nextLabel} »`
    );
  };

  const handleSetGuestNodeStatus = async (
    node: WorkflowTreeNode,
    nextStatus: WorkflowNodeStatus
  ) => {
    if (!visibleWorkflowTree || !room) return;
    const actor = guestActor.trim() || 'Collaborateur invité';
    const nextTrees = setNodesStatusInTree(
      [visibleWorkflowTree],
      new Set([node.id]),
      nextStatus,
      actor
    );
    await handleGuestTreeMutation(
      nextTrees[0],
      `Statut « ${node.label} » → ${WORKFLOW_STATUS_LABELS[nextStatus]}`
    );
  };

  const handleDuplicateGuestNode = async (node: WorkflowTreeNode) => {
    if (!visibleWorkflowTree || !room) return;
    const path = findNodePath([visibleWorkflowTree], node.id);
    if (!path || path.length < 2) return;
    const parent = path[path.length - 2];
    const actor = guestActor.trim() || 'Collaborateur invité';
    const sig = actor.slice(0, 6).toUpperCase() || 'EXT';
    const cloned = cloneNodeWithFreshIds(node, sig);
    cloned.label = `${node.label} (copie)`;

    const wordBodiesPatch: Record<string, string> = {};
    const tablesPatch: Record<string, ParsedBaseTable[]> = {};
    const mapBodies = (src: WorkflowTreeNode, dst: WorkflowTreeNode) => {
      if (room.wordBodies?.[src.id]) {
        wordBodiesPatch[dst.id] = room.wordBodies[src.id];
      }
      if (room.tablesByNodeId?.[src.id]) {
        tablesPatch[dst.id] = room.tablesByNodeId[src.id];
      }
      if (src.children && dst.children) {
        src.children.forEach((sc, idx) => {
          const dc = dst.children?.[idx];
          if (dc) mapBodies(sc, dc);
        });
      }
    };
    mapBodies(node, cloned);

    const insertAfterTarget = (list: WorkflowTreeNode[]): WorkflowTreeNode[] =>
      list.map((item) => {
        if (item.id === parent.id) {
          const children = [...(item.children || [])];
          const idx = children.findIndex((c) => c.id === node.id);
          children.splice(idx >= 0 ? idx + 1 : children.length, 0, cloned);
          return { ...item, children };
        }
        if (item.children?.length) {
          return { ...item, children: insertAfterTarget(item.children) };
        }
        return item;
      });

    const nextTrees = insertAfterTarget([visibleWorkflowTree]);
    await handleGuestTreeMutation(
      nextTrees[0],
      `Duplication dans phase autorisée : « ${node.label} » → « ${cloned.label} »`,
      Object.keys(wordBodiesPatch).length > 0 ? wordBodiesPatch : undefined,
      cloned.id,
      [parent.id],
      Object.keys(tablesPatch).length > 0 ? tablesPatch : undefined
    );
  };

  const handleDownloadGuestNode = (node: WorkflowTreeNode) => {
    if (!room) return;
    const isStep =
      node.nodeType === 'document' && resolveMissionStepClassification(node).isStep;
    let content = `# ${node.label}\n`;
    content += `Client : ${room.clientName}\n`;
    content += `Propriétaire : ${room.ownerName} [${room.ownerSignature}]\n\n`;

    if (isStep) {
      const tbls = normalizeWorkflowBaseTables(
        room.tablesByNodeId[node.id] ||
          buildFormatageDataForNode(node, room.clientName, '2026').baseTables
      );
      content += tablesToMarkdown(tbls);
    } else if (node.nodeType === 'document') {
      content +=
        room.wordBodies?.[node.id] ||
        `Document : ${node.label}\nStatut : ${WORKFLOW_STATUS_LABELS[node.status || 'todo']}`;
    } else {
      const lines: string[] = [];
      const walk = (n: WorkflowTreeNode, lvl: number) => {
        lines.push(`${'  '.repeat(lvl)}- ${n.label} [${WORKFLOW_STATUS_LABELS[n.status || 'todo']}]`);
        n.children?.forEach((c) => walk(c, lvl + 1));
      };
      walk(node, 0);
      content += lines.join('\n');
    }

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = node.label.replace(/[^a-zA-Z0-9À-ÿ._-]+/g, '_').slice(0, 60);
    a.href = url;
    a.download = `${safeName || 'workflow-doc'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Document exporté : ${a.download}`);
  };

  const handleDeleteGuestNode = async (node: WorkflowTreeNode) => {
    if (!visibleWorkflowTree || !room) return;
    setConfirmDeleteNodeId(null);
    const nextTrees = deleteNodesInTree([visibleWorkflowTree], new Set([node.id]));
    const fallback =
      room.shareType === 'mission-step'
        ? findNodeById([nextTrees[0]], room.nodeId || '') ??
          findPreferredAuthorizedPhaseNode(nextTrees[0], room.allowedPhases)
        : findPreferredAuthorizedPhaseNode(nextTrees[0], room.allowedPhases);
    await handleGuestTreeMutation(
      nextTrees[0],
      `Suppression dans phase autorisée : « ${node.label} »`,
      undefined,
      selectedNodeId === node.id ? fallback?.id : selectedNodeId ?? undefined
    );
  };

  const handleSaveDocBody = async () => {
    if (!room || !activeNode || activeNode.nodeType !== 'document') return;
    if (!room.active || !room.allowEdit) {
      setErrorBanner('Modification refusée : accès en lecture seule.');
      return;
    }
    setErrorBanner(null);
    mutationSeqRef.current += 1;
    isPatchingRef.current = true;
    const actor = guestActor.trim() || 'Collaborateur invité';
    const optimistic: SharedWorkspaceRoom = {
      ...room,
      wordBodies: {
        ...(room.wordBodies || {}),
        [activeNode.id]: docBodyDraft,
      },
      updatedAt: Math.max(Date.now(), room.updatedAt + 1),
      lastModifiedBy: actor,
    };
    setRoom(optimistic);
    setDocBodyDirty(false);

    try {
      const updated = await patchShareRoom(room.token, {
        wordBodies: { [activeNode.id]: docBodyDraft },
        actor,
        changeSummary: `Contenu pièce mis à jour : ${activeNode.label}`,
      });
      if (updated) {
        setRoom(updated);
        showToast(`Contenu de « ${activeNode.label} » synchronisé`);
      }
    } finally {
      isPatchingRef.current = false;
    }
  };

  const handleGuestRecoPatch = async (
    row: SharedRecoRowSnapshot,
    recoMetaPatch: Partial<RecoSourceMetadata>,
    nextStatus?: WorkflowNodeStatus,
    summaryLabel?: string
  ) => {
    if (!room || !room.active || !room.allowEdit) {
      setErrorBanner('Modification refusée : accès en lecture seule ou partage désactivé.');
      return;
    }
    setErrorBanner(null);
    mutationSeqRef.current += 1;
    isPatchingRef.current = true;
    const actor = guestActor.trim() || 'Opérationnel invité';
    const prevUpdate = room.recoUpdatesByNodeId[row.nodeId];
    const nextUpdate = {
      recoMeta: {
        ...(prevUpdate?.recoMeta || {}),
        ...recoMetaPatch,
      },
      status: nextStatus ?? prevUpdate?.status ?? row.status,
      updatedAt: Date.now(),
      actor,
    };

    try {
      const updated = await patchShareRoom(room.token, {
        recoUpdatesByNodeId: {
          [row.nodeId]: nextUpdate,
        },
        actor,
        changeSummary:
          summaryLabel || `Mise à jour ${row.record.refRecos} (${row.record.direction})`,
      });
      if (updated) {
        setRoom(updated);
        showToast(`Suivi des recos mis à jour chez ${room.ownerName}`);
      }
    } finally {
      isPatchingRef.current = false;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-6 py-4 text-sm">
          <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" aria-hidden="true" />
          <span>Chargement de l&apos;espace collaboratif partagé...</span>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 text-center shadow-xl">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" aria-hidden="true" />
          <h1 className="mt-3 font-display text-lg font-semibold text-white">
            Lien de partage introuvable
          </h1>
          <p className="mt-2 text-xs text-slate-400">
            Ce lien collaboratif (<span className="font-mono">{token}</span>) n&apos;existe plus ou a été supprimé par son propriétaire.
          </p>
          <button
            type="button"
            onClick={onExitGuestMode}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Revenir à l&apos;application</span>
          </button>
        </div>
      </div>
    );
  }

  if (!room.active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 text-center shadow-xl">
          <Lock className="mx-auto h-10 w-10 text-amber-400" aria-hidden="true" />
          <h1 className="mt-3 font-display text-lg font-semibold text-white">
            Partage temporairement désactivé
          </h1>
          <p className="mt-2 text-xs text-slate-400">
            Le propriétaire ({room.ownerName}) a suspendu l&apos;accès à « {room.title} ».
          </p>
          <button
            type="button"
            onClick={onExitGuestMode}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Fermer la vue partagée</span>
          </button>
        </div>
      </div>
    );
  }

  const openContextMenuAt = (
    clientX: number,
    clientY: number,
    node: WorkflowTreeNode
  ) => {
    const menuWidth = 264;
    const menuHeight = 380;
    const maxX =
      typeof window !== 'undefined' ? window.innerWidth - menuWidth - 12 : clientX;
    const maxY =
      typeof window !== 'undefined' ? window.innerHeight - menuHeight - 12 : clientY;
    setContextMenu({
      x: Math.max(12, Math.min(clientX, maxX)),
      y: Math.max(12, Math.min(clientY, maxY)),
      node,
    });
  };

  const renderTreeNode = (node: WorkflowTreeNode, depth = 0): React.ReactNode => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isExpanded = expandedIds.has(node.id);
    const isSelected = activeNode?.id === node.id;
    const isContextTarget = contextMenu?.node.id === node.id;
    const isSharedPrimaryStep =
      room.shareType === 'mission-step' &&
      (node.id === room.nodeId || node.id === room.node?.id);
    const isStep = resolveMissionStepClassification(node).isStep;
    const hasCustomData = Boolean(room.tablesByNodeId[node.id]);
    const inAuthorizedPhase =
      Boolean(visibleWorkflowTree) &&
      isNodeInsideAuthorizedPhase(visibleWorkflowTree!, node.id, room.allowedPhases);
    const isPhaseFolder = Boolean(node.missionPhase && node.nodeType !== 'document');
    const canRename =
      room.allowEdit &&
      inAuthorizedPhase &&
      !node.locked &&
      !isStep &&
      !isPhaseFolder &&
      depth > 0 &&
      (node.nodeType === 'collection' ||
        node.nodeType === 'document' ||
        node.nodeType === 'sous-section');
    const canDelete = canRename && !isSharedPrimaryStep;

    const isRenamingThis = renamingNodeId === node.id;
    const isConfirmDeleteThis = confirmDeleteNodeId === node.id;

    return (
      <div key={node.id}>
        <div
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openContextMenuAt(e.clientX, e.clientY, node);
          }}
          className={`group flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-xs transition-colors ${
            isContextTarget
              ? 'bg-sky-950/80 text-sky-100 ring-1 ring-sky-500/70'
              : isSelected
              ? 'bg-emerald-950/70 text-emerald-100 ring-1 ring-emerald-500/60'
              : 'text-slate-200 hover:bg-slate-800/80'
          }`}
        >
          <button
            type="button"
            disabled={!hasChildren}
            onClick={() => {
              if (!hasChildren) return;
              setExpandedIds((prev) => {
                const next = new Set(prev);
                if (next.has(node.id)) next.delete(node.id);
                else next.add(node.id);
                return next;
              });
            }}
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-400 ${
              hasChildren ? 'hover:bg-slate-700 cursor-pointer' : 'opacity-30'
            }`}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )
            ) : (
              <span className="h-1 w-1 rounded-full bg-slate-600" />
            )}
          </button>

          {isRenamingThis ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleRenameGuestNode(node);
              }}
              className="flex min-w-0 flex-1 items-center gap-1"
            >
              <input
                type="text"
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setRenamingNodeId(null);
                }}
                className="min-w-0 flex-1 rounded border border-emerald-500 bg-slate-950 px-1.5 py-0.5 text-xs text-white focus:outline-none"
              />
              <button
                type="submit"
                className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white cursor-pointer"
              >
                OK
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSelectedNodeId(node.id);
                if (hasChildren && !isExpanded) {
                  setExpandedIds((prev) => {
                    const next = new Set(prev);
                    next.add(node.id);
                    return next;
                  });
                }
              }}
              className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
            >
              {node.nodeType === 'collection' ? (
                <Layers className="h-3.5 w-3.5 shrink-0 text-violet-400" />
              ) : node.nodeType === 'document' ? (
                <FileText
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isStep ? 'text-emerald-400' : 'text-sky-400'
                  }`}
                />
              ) : isExpanded ? (
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-400" />
              ) : (
                <Folder className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              )}
              <span className="min-w-0 flex-1 truncate">{node.label}</span>
              {isSharedPrimaryStep && (
                <span className="shrink-0 rounded bg-emerald-500/20 px-1 py-0.5 font-mono text-[9px] font-semibold text-emerald-300">
                  PARTAGÉE
                </span>
              )}
              {node.nodeType === 'collection' && (
                <span className="shrink-0 rounded bg-violet-500/20 px-1 py-0.5 font-mono text-[9px] text-violet-300">
                  {node.children?.length || 0}
                </span>
              )}
              {node.status && node.status !== 'todo' && (
                <span
                  title={`Statut : ${WORKFLOW_STATUS_LABELS[node.status]}`}
                  className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${
                    node.status === 'validated'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : node.status === 'in-review'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-sky-500/20 text-sky-300'
                  }`}
                >
                  {WORKFLOW_STATUS_LABELS[node.status]}
                </span>
              )}
              {hasCustomData && (
                <span
                  title="Tables disponibles / modifiées"
                  className="h-2 w-2 shrink-0 rounded-full bg-emerald-400"
                />
              )}
            </button>
          )}

          {!isRenamingThis && (
            <div className="flex shrink-0 items-center gap-0.5">
              {isConfirmDeleteThis ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleDeleteGuestNode(node)}
                    className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white cursor-pointer"
                  >
                    Suppr.
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteNodeId(null)}
                    className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-200 cursor-pointer"
                  >
                    Non
                  </button>
                </div>
              ) : (
                <div className="hidden items-center gap-0.5 group-hover:flex">
                  {canRename && (
                    <button
                      type="button"
                      title="Renommer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingNodeId(node.id);
                        setRenameDraft(node.label);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      title="Supprimer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteNodeId(node.id);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-red-900/60 hover:text-red-300 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Menu contextuel (actions workflow)"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      openContextMenuAt(rect.right - 220, rect.bottom + 4, node);
                    }}
                    className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
                  >
                    <MoreVertical className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>{node.children!.map((child) => renderTreeNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const mergedRecoRows = (room.recoRowsSnapshot || [])
    .map((baseRow) => {
      const upd = room.recoUpdatesByNodeId[baseRow.nodeId];
      const mergedRecord: RecoSourceMetadata = {
        ...baseRow.record,
        ...(upd?.recoMeta || {}),
      };
      const mergedStatus = upd?.status ?? baseRow.status;
      return {
        ...baseRow,
        record: mergedRecord,
        status: mergedStatus,
        lastEditedBy: upd?.actor,
      };
    })
    .filter((row) => {
      const q = recoSearch.trim().toLowerCase();
      if (!q) return true;
      return `${row.record.refRecos} ${row.record.intituleRecos} ${row.record.direction} ${row.record.responsable} ${row.record.planAction}`
        .toLowerCase()
        .includes(q);
    });

  const activeIsStep = Boolean(
    activeNode && resolveMissionStepClassification(activeNode).isStep
  );

  const isSplitViewActive = showWorkflowSplit && showWorkflowPane;

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      {/* Bandeau supérieur uniquement lorsque la TreeView latérale est masquée ou pour Suivi des Recos */}
      {!isSplitViewActive && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400">
              <Users className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm font-semibold text-white truncate">
                  {room.title}
                </span>
                <span className="rounded border border-emerald-700/70 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Accès collaboratif sans compte
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                    room.allowEdit
                      ? 'bg-sky-950/70 text-sky-300 border border-sky-700/70'
                      : 'bg-amber-950/70 text-amber-300 border border-amber-700/70'
                  }`}
                >
                  {room.allowEdit ? (
                    <>
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      <span>Édition synchronisée</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-3 w-3" aria-hidden="true" />
                      <span>Lecture seule</span>
                    </>
                  )}
                </span>
                {(room.shareType === 'workflow-dossier' ||
                  (room.shareType === 'mission-step' && room.includeMissionWorkflow)) &&
                  enabledPhaseLabels.length > 0 && (
                    <span className="rounded border border-indigo-700/70 bg-indigo-950/60 px-2 py-0.5 text-[10px] font-semibold text-indigo-200">
                      Phases validées : {enabledPhaseLabels.join(' · ')}
                    </span>
                  )}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                Partagé par <strong className="text-slate-200">{room.ownerName}</strong> [{room.ownerSignature}] · {room.clientName}
                {room.subtitle ? ` · ${room.subtitle}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-300">
              <UserCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              <span className="hidden sm:inline text-slate-400">Intervenant :</span>
              <input
                type="text"
                value={guestActor}
                onChange={(e) => setGuestActor(e.target.value)}
                placeholder="Votre nom / service"
                className="w-40 bg-transparent text-xs font-medium text-white focus:outline-none"
              />
            </label>

            {syncMessage && (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-700/70 bg-emerald-950/70 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {syncMessage}
              </span>
            )}

            {errorBanner && (
              <span className="inline-flex items-center gap-1 rounded-md border border-red-700/70 bg-red-950/70 px-2.5 py-1 text-[11px] font-medium text-red-300">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {errorBanner}
              </span>
            )}

            {(room.shareType === 'mission-step' || room.shareType === 'workflow-dossier') && (
              <button
                type="button"
                onClick={() => setShowWorkflowPane(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/80 bg-indigo-600/25 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-200 hover:bg-indigo-600/35 cursor-pointer"
              >
                <PanelRight className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
                <span>Afficher workflow</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void loadRoom(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
              <span>Actualiser</span>
            </button>

            <button
              type="button"
              onClick={onExitGuestMode}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Quitter vue partagée</span>
            </button>
          </div>
        </header>
      )}

      {/* Corps principal : tables pleine hauteur à gauche (~63-65%) / infos + TreeView workflow à droite (~35-37%) */}
      {showWorkflowSplit && (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Gauche : Tables / Documents sur toute la hauteur */}
          <div
            className={
              showWorkflowPane
                ? 'flex min-h-0 w-full flex-1 flex-col lg:w-[62.5%] xl:w-[65%] lg:flex-none min-w-0'
                : 'flex min-h-0 w-full flex-1 flex-col min-w-0'
            }
          >
            {hasPendingPhaseValidation ? (
              <div className="flex flex-1 flex-col items-center justify-center bg-slate-950 p-6 text-center">
                <div className="max-w-lg rounded-xl border border-amber-700/60 bg-slate-900 p-6 shadow-xl">
                  <Lock className="mx-auto h-10 w-10 text-amber-400" aria-hidden="true" />
                  <h2 className="mt-3 font-display text-base font-semibold text-white">
                    En attente de validation des phases par le propriétaire
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    <strong className="text-white">{room.ownerName}</strong> doit valider les phases partagées (<em>Phase de préparation</em>, <em>Phase de réalisation</em>, <em>Phase de conclusion</em>) dans la fenêtre de partage pour ouvrir l&apos;arborescence correspondante.
                  </p>
                  <p className="mt-3 text-[11px] text-slate-400">
                    La page se met à jour automatiquement dès que les phases sont validées.
                  </p>
                </div>
              </div>
            ) : activeNode && activeIsStep ? (
              <MissionStepTableViewer
                node={activeNode}
                session={guestSession}
                isLocked={!room.allowEdit}
                hideSendToChat
                flushTop
                compactHeader
                externalTables={activeStepTables}
                onExternalTablesChange={(nextTables, reason) =>
                  void handleGuestStepTablesChange(activeNode, nextTables, reason)
                }
                onSendStepToChat={() => undefined}
                onClose={() => {
                  if (
                    room.shareType === 'mission-step' &&
                    activeNode.id !== (room.nodeId || room.node?.id)
                  ) {
                    setSelectedNodeId(room.nodeId || room.node?.id || null);
                  } else if (room.shareType === 'workflow-dossier') {
                    setSelectedNodeId(null);
                  } else {
                    onExitGuestMode();
                  }
                }}
              />
            ) : activeNode && activeNode.nodeType === 'collection' ? (
              <div className="flex flex-1 flex-col overflow-hidden bg-slate-950 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-700/60 bg-slate-900 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/20 text-violet-300">
                      <Layers className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-display text-base font-semibold text-white">
                          {activeNode.label}
                        </h2>
                        <span className="rounded bg-violet-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-violet-200">
                          COLLECTION ({activeNode.children?.length || 0} pièce(s))
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Collection synchronisée dans la TreeView du propriétaire ({room.ownerName}).
                      </p>
                    </div>
                  </div>
                  {room.allowEdit && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCreationMode('piece');
                          setNewPieceLabel('');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 cursor-pointer"
                      >
                        <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>+ Ajouter une pièce</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileUploadInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        <span>Importer fichiers</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  {!activeNode.children || activeNode.children.length === 0 ? (
                    <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center text-slate-400">
                      <FileText className="h-9 w-9 text-slate-600" aria-hidden="true" />
                      <p className="mt-2 text-sm font-medium text-slate-200">
                        Collection vide
                      </p>
                      <p className="mt-1 max-w-md text-xs text-slate-400">
                        Ajoutez ou importez des pièces justificatives dans cette collection pour les intégrer automatiquement au dossier du propriétaire.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {activeNode.children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => setSelectedNodeId(child.id)}
                          className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-left transition-colors hover:border-sky-600/70 hover:bg-slate-900 cursor-pointer"
                        >
                          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-semibold text-white">
                              {child.label}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              {child.owner ? `Par ${child.owner}` : 'Pièce justificative'}
                              {child.sourceDocFormat ? ` · .${child.sourceDocFormat}` : ''}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : activeNode && activeNode.nodeType === 'document' ? (
              <div className="flex flex-1 flex-col overflow-hidden bg-slate-950 p-5">
                <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <FileText className="h-4 w-4 shrink-0 text-sky-400" aria-hidden="true" />
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-sm font-semibold text-white">
                          {activeNode.label}
                        </h2>
                        <p className="text-[11px] text-slate-400">
                          Pièce de dossier · Propriétaire / Auteur : {activeNode.owner || room.ownerSignature}
                        </p>
                      </div>
                    </div>
                    {room.allowEdit && (
                      <button
                        type="button"
                        onClick={() => void handleSaveDocBody()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 cursor-pointer"
                      >
                        <Save className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Enregistrer la pièce</span>
                      </button>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <label className="mb-1.5 text-[11px] font-medium text-slate-400">
                      Contenu / Notes justificatives de la pièce (synchronisé avec {room.ownerName}) :
                    </label>
                    <textarea
                      readOnly={!room.allowEdit}
                      value={docBodyDraft}
                      onChange={(e) => {
                        setDocBodyDraft(e.target.value);
                        setDocBodyDirty(true);
                      }}
                      placeholder="Saisissez le contenu ou les commentaires de cette pièce..."
                      className="flex-1 resize-none rounded-lg border border-slate-800 bg-slate-950 p-3.5 font-mono text-xs leading-relaxed text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-400">
                <Table2 className="h-10 w-10 text-slate-600" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-slate-200">
                  {activeNode
                    ? `Dossier sélectionné : ${activeNode.label}`
                    : 'Sélectionnez une phase, collection ou étape dans l’arborescence'}
                </p>
                <p className="mt-1 max-w-md text-xs text-slate-400">
                  Dans les phases validées par {room.ownerName} ({enabledPhaseLabels.join(', ') || 'autorisées'}), vous pouvez ouvrir et modifier les étapes de mission, créer des collections et ajouter des pièces dans la TreeView à droite.
                </p>
                {room.allowEdit && targetContainerNode && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCreationMode('collection');
                        setNewCollectionLabel('');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer"
                    >
                      <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>+ Créer une collection</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreationMode('piece');
                        setNewPieceLabel('');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-500 cursor-pointer"
                    >
                      <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>+ Ajouter une pièce</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Droite (~35-37.5%, réduit de 25%) : Infos de partage en haut + TreeView workflow */}
          {showWorkflowPane && (
            <aside
              aria-label="Arborescence partagée"
              className="flex min-h-[280px] w-full flex-1 flex-col border-t border-slate-800 bg-slate-900 lg:w-[37.5%] xl:w-[35%] lg:flex-none min-w-0 lg:border-t-0 lg:border-l"
            >
              {/* Infos de session collaborative placées en haut de la TreeView */}
              <div className="shrink-0 space-y-2 border-b border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400">
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-display text-xs font-semibold text-white" title={room.title}>
                        {room.title}
                      </div>
                      <p className="truncate text-[10px] text-slate-400" title={`${room.ownerName} · ${room.clientName}${room.subtitle ? ` · ${room.subtitle}` : ''}`}>
                        Par <strong className="text-slate-200">{room.ownerName}</strong> [{room.ownerSignature}] · {room.clientName}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      title="Actualiser"
                      onClick={() => void loadRoom(false)}
                      className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3 text-sky-400" aria-hidden="true" />
                      <span className="hidden xl:inline">Actualiser</span>
                    </button>
                    <button
                      type="button"
                      title="Masquer la TreeView pour agrandir les tables"
                      onClick={() => setShowWorkflowPane(false)}
                      className="inline-flex items-center gap-1 rounded border border-indigo-700/70 bg-indigo-950/60 px-2 py-1 text-[10px] font-medium text-indigo-200 hover:bg-indigo-900/70 cursor-pointer"
                    >
                      <PanelRight className="h-3 w-3 text-indigo-400" aria-hidden="true" />
                      <span>Masquer</span>
                    </button>
                    <button
                      type="button"
                      title="Quitter vue partagée"
                      onClick={onExitGuestMode}
                      className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
                    >
                      <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                      <span className="hidden xl:inline">Quitter</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded border border-emerald-700/70 bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                    Sans compte
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      room.allowEdit
                        ? 'bg-sky-950/70 text-sky-300 border border-sky-700/70'
                        : 'bg-amber-950/70 text-amber-300 border border-amber-700/70'
                    }`}
                  >
                    {room.allowEdit ? (
                      <>
                        <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" />
                        <span>Édition synchronisée</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                        <span>Lecture seule</span>
                      </>
                    )}
                  </span>
                  {(room.shareType === 'workflow-dossier' ||
                    (room.shareType === 'mission-step' && room.includeMissionWorkflow)) &&
                    enabledPhaseLabels.length > 0 && (
                      <span
                        title={enabledPhaseLabels.join(' · ')}
                        className="truncate max-w-full rounded border border-indigo-700/70 bg-indigo-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-200"
                      >
                        Phases : {enabledPhaseLabels.join(' · ')}
                      </span>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300">
                    <UserCheck className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden="true" />
                    <span className="shrink-0 text-[10px] text-slate-400">Intervenant :</span>
                    <input
                      type="text"
                      value={guestActor}
                      onChange={(e) => setGuestActor(e.target.value)}
                      placeholder="Votre nom / service"
                      className="min-w-0 flex-1 bg-transparent text-[11px] font-medium text-white focus:outline-none"
                    />
                  </label>
                </div>

                {syncMessage && (
                  <div className="flex items-center gap-1 rounded border border-emerald-700/70 bg-emerald-950/70 px-2 py-1 text-[10px] font-medium text-emerald-300">
                    <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{syncMessage}</span>
                  </div>
                )}

                {errorBanner && (
                  <div className="flex items-center gap-1 rounded border border-red-700/70 bg-red-950/70 px-2 py-1 text-[10px] font-medium text-red-300">
                    <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{errorBanner}</span>
                  </div>
                )}
              </div>

              <div className="border-b border-slate-800 px-3.5 py-2">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-200">
                  <span className="truncate text-[11px]">
                    {room.shareType === 'mission-step'
                      ? 'Workflow documentaire · Étape & Phases'
                      : 'TreeView partagée · Phases autorisées'}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {room.shareType === 'mission-step' &&
                      room.nodeId &&
                      activeNode?.id !== room.nodeId && (
                        <button
                          type="button"
                          onClick={() => setSelectedNodeId(room.nodeId || null)}
                          className="rounded border border-emerald-700/70 bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-900/70 cursor-pointer"
                        >
                          Étape partagée
                        </button>
                      )}
                    {enabledPhaseLabels.length > 0 && (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                        {enabledPhaseLabels.length} phase(s)
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Clic droit ou <span className="font-mono text-slate-300">⋮</span> sur un élément pour le menu contextuel.
                </p>

                {!hasPendingPhaseValidation &&
                  room.allowEdit &&
                  targetContainerNode &&
                  (room.shareType !== 'mission-step' ||
                    (room.includeMissionWorkflow && visibleWorkflowTree)) && (
                    <div className="mt-2 space-y-2">
                      <div className="truncate text-[10px] text-slate-400">
                        Dossier cible :{' '}
                        <strong className="text-emerald-300">
                          {targetContainerNode.label}
                        </strong>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setCreationTargetId(targetContainerNode.id);
                            setCreationMode((prev) =>
                              prev === 'collection' ? null : 'collection'
                            );
                            setNewCollectionLabel('');
                          }}
                          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                            creationMode === 'collection'
                              ? 'bg-violet-600 text-white'
                              : 'border border-violet-700/70 bg-violet-950/50 text-violet-200 hover:bg-violet-900/60'
                          }`}
                        >
                          <FolderPlus className="h-3 w-3" aria-hidden="true" />
                          <span>+ Collection</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCreationTargetId(targetContainerNode.id);
                            setCreationMode((prev) => (prev === 'piece' ? null : 'piece'));
                            setNewPieceLabel('');
                          }}
                          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                            creationMode === 'piece'
                              ? 'bg-sky-600 text-white'
                              : 'border border-sky-700/70 bg-sky-950/50 text-sky-200 hover:bg-sky-900/60'
                          }`}
                        >
                          <FilePlus2 className="h-3 w-3" aria-hidden="true" />
                          <span>+ Pièce</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCreationTargetId(targetContainerNode.id);
                            setCreationMode((prev) =>
                              prev === 'sous-section' ? null : 'sous-section'
                            );
                            setNewSubSectionLabel('');
                          }}
                          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                            creationMode === 'sous-section'
                              ? 'bg-indigo-600 text-white'
                              : 'border border-indigo-700/70 bg-indigo-950/50 text-indigo-200 hover:bg-indigo-900/60'
                          }`}
                        >
                          <Folder className="h-3 w-3" aria-hidden="true" />
                          <span>+ Sous-section</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            importTargetIdRef.current = targetContainerNode.id;
                            fileUploadInputRef.current?.click();
                          }}
                          className="inline-flex items-center gap-1 rounded border border-emerald-700/70 bg-emerald-950/50 px-2 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-900/60 cursor-pointer"
                        >
                          <Upload className="h-3 w-3" aria-hidden="true" />
                          <span>Importer</span>
                        </button>
                        <input
                          ref={fileUploadInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            void handleImportPiecesFiles(e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </div>
                    </div>
                  )}

                {/* Formulaire création Collection */}
                {creationMode === 'collection' && targetContainerNode && (
                  <form
                    onSubmit={(e) => void handleCreateCollection(e)}
                    className="mt-2.5 space-y-2 rounded-lg border border-violet-700/70 bg-slate-950 p-2.5 text-xs"
                  >
                    <div className="text-[11px] font-semibold text-violet-200">
                      Nouvelle collection dans « {targetContainerNode.label} »
                    </div>
                    <input
                      type="text"
                      autoFocus
                      value={newCollectionLabel}
                      onChange={(e) => setNewCollectionLabel(e.target.value)}
                      placeholder="Ex : Pièces justificatives clôture T1"
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCreationMode(null);
                          setCreationTargetId(null);
                        }}
                        className="rounded border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800 cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="rounded bg-violet-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-violet-500 cursor-pointer"
                      >
                        Créer
                      </button>
                    </div>
                  </form>
                )}

                {/* Formulaire création Sous-section */}
                {creationMode === 'sous-section' && targetContainerNode && (
                  <form
                    onSubmit={(e) => void handleCreateSubSection(e)}
                    className="mt-2.5 space-y-2 rounded-lg border border-indigo-700/70 bg-slate-950 p-2.5 text-xs"
                  >
                    <div className="text-[11px] font-semibold text-indigo-200">
                      Nouvelle sous-section dans « {targetContainerNode.label} »
                    </div>
                    <input
                      type="text"
                      autoFocus
                      value={newSubSectionLabel}
                      onChange={(e) => setNewSubSectionLabel(e.target.value)}
                      placeholder="Ex : Sous-dossier justificatifs"
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCreationMode(null);
                          setCreationTargetId(null);
                        }}
                        className="rounded border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800 cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="rounded bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500 cursor-pointer"
                      >
                        Créer
                      </button>
                    </div>
                  </form>
                )}

                {/* Formulaire ajout Pièce */}
                {creationMode === 'piece' && targetContainerNode && (
                  <form
                    onSubmit={(e) => void handleCreatePiece(e)}
                    className="mt-2.5 space-y-2 rounded-lg border border-sky-700/70 bg-slate-950 p-2.5 text-xs"
                  >
                    <div className="text-[11px] font-semibold text-sky-200">
                      Nouvelle pièce dans « {targetContainerNode.label} »
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={newPieceLabel}
                        onChange={(e) => setNewPieceLabel(e.target.value)}
                        placeholder="Nom de la pièce (ex : PV clôture)"
                        className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                      />
                      <select
                        value={newPieceFormat}
                        onChange={(e) =>
                          setNewPieceFormat(e.target.value as SourceDocFormat)
                        }
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
                      >
                        <option value="docx">.docx</option>
                        <option value="pdf">.pdf</option>
                        <option value="xlsx">.xlsx</option>
                        <option value="csv">.csv</option>
                      </select>
                    </div>
                    <textarea
                      rows={2}
                      value={newPieceNote}
                      onChange={(e) => setNewPieceNote(e.target.value)}
                      placeholder="Commentaire ou contenu initial (optionnel)..."
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-100 focus:border-sky-500 focus:outline-none"
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCreationMode(null);
                          setCreationTargetId(null);
                        }}
                        className="rounded border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800 cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="rounded bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-sky-500 cursor-pointer"
                      >
                        Ajouter
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div
                onScroll={() => contextMenu && setContextMenu(null)}
                className="flex-1 space-y-0.5 overflow-y-auto p-3"
              >
                {room.shareType === 'mission-step' &&
                (!room.includeMissionWorkflow || !visibleWorkflowTree) ? (
                  <div className="flex h-full min-h-[220px] flex-col items-center justify-center p-4 text-center">
                    <div className="max-w-md rounded-xl border border-amber-700/60 bg-slate-950/80 p-5 shadow-lg">
                      <Lock className="mx-auto h-8 w-8 text-amber-400" aria-hidden="true" />
                      <h3 className="mt-3 text-sm font-semibold text-white">
                        Workflow documentaire lié en attente d&apos;autorisation
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">
                        Le propriétaire (<strong className="text-white">{room.ownerName}</strong>) n&apos;a pas encore validé l&apos;accès à la TreeView du workflow de la mission pour cette étape.
                      </p>
                      <p className="mt-2 text-[11px] text-slate-400">
                        Dans la fenêtre <strong>Partager</strong>, cochez <em>« Donner accès au workflow documentaire lié à la mission »</em> et les phases autorisées, puis cliquez sur <em>« Valider l&apos;accès &amp; les phases »</em>.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => void loadRoom(false)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 cursor-pointer"
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Actualiser</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowWorkflowPane(false)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
                        >
                          <span>Masquer ce panneau</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : hasPendingPhaseValidation ? (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-center text-[11px] text-slate-400">
                    Aucune phase validée par le propriétaire pour le moment.
                  </div>
                ) : visibleWorkflowTree ? (
                  <>
                    {room.shareType === 'mission-step' &&
                      !hasAnyAllowedPhase(room.allowedPhases) && (
                        <div className="mb-2 rounded-lg border border-amber-700/60 bg-amber-950/30 px-2.5 py-2 text-[11px] text-amber-200">
                          Workflow lié actif pour l&apos;étape. Les phases supplémentaires apparaîtront ici dès validation par {room.ownerName}.
                        </div>
                      )}
                    {renderTreeNode(visibleWorkflowTree, 0)}
                  </>
                ) : null}
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Menu contextuel clic droit sur les données du workflow partagé */}
      {contextMenu && visibleWorkflowTree && (() => {
        const ctxNode = contextMenu.node;
        const inAuthorizedPhase = isNodeInsideAuthorizedPhase(
          visibleWorkflowTree,
          ctxNode.id,
          room.allowedPhases
        );
        const isSharedPrimaryStep =
          room.shareType === 'mission-step' &&
          (ctxNode.id === room.nodeId || ctxNode.id === room.node?.id);
        const isStep = resolveMissionStepClassification(ctxNode).isStep;
        const isPhaseFolder = Boolean(
          ctxNode.missionPhase && ctxNode.nodeType !== 'document'
        );
        const containerId = resolveContainerTargetId(
          [visibleWorkflowTree],
          ctxNode.id
        );
        const canCreateInside =
          room.allowEdit && inAuthorizedPhase && !ctxNode.locked;
        const canChangeStatus =
          room.allowEdit &&
          (inAuthorizedPhase || isSharedPrimaryStep) &&
          !ctxNode.locked &&
          ctxNode.nodeType !== 'root';
        const canRenameOrDup =
          room.allowEdit &&
          inAuthorizedPhase &&
          !ctxNode.locked &&
          !isStep &&
          !isPhaseFolder &&
          ctxNode.id !== visibleWorkflowTree.id &&
          (ctxNode.nodeType === 'collection' ||
            ctxNode.nodeType === 'document' ||
            ctxNode.nodeType === 'sous-section');
        const canDeleteCtx = canRenameOrDup && !isSharedPrimaryStep;

        return (
          <div
            ref={contextMenuRef}
            role="menu"
            aria-label={`Actions pour ${ctxNode.label}`}
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            className="fixed z-[95] w-64 rounded-xl border border-slate-700 bg-slate-900 p-1.5 text-xs text-slate-100 shadow-2xl"
          >
            <div className="border-b border-slate-800 px-2.5 py-2">
              <div className="truncate font-semibold text-white">{ctxNode.label}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="uppercase">{ctxNode.nodeType}</span>
                <span>·</span>
                <span
                  className={
                    inAuthorizedPhase || isSharedPrimaryStep
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }
                >
                  {inAuthorizedPhase
                    ? 'Phase autorisée'
                    : isSharedPrimaryStep
                    ? 'Étape partagée'
                    : 'Lecture / Hors phase'}
                </span>
              </div>
            </div>

            <div className="py-1 space-y-0.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setSelectedNodeId(ctxNode.id);
                  if (ctxNode.children?.length) {
                    setExpandedIds((prev) => {
                      const next = new Set(prev);
                      next.add(ctxNode.id);
                      return next;
                    });
                  }
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-slate-100 hover:bg-slate-800 cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                <span>Ouvrir / Afficher à gauche</span>
              </button>

              {canCreateInside && (
                <>
                  <div className="my-1 border-t border-slate-800" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setCreationTargetId(containerId);
                      setCreationMode('collection');
                      setNewCollectionLabel('');
                      setExpandedIds((prev) => new Set(prev).add(containerId));
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-violet-200 hover:bg-violet-950/60 cursor-pointer"
                  >
                    <FolderPlus className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                    <span>Nouvelle collection ici</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setCreationTargetId(containerId);
                      setCreationMode('piece');
                      setNewPieceLabel('');
                      setExpandedIds((prev) => new Set(prev).add(containerId));
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sky-200 hover:bg-sky-950/60 cursor-pointer"
                  >
                    <FilePlus2 className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                    <span>Ajouter une pièce / document</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setCreationTargetId(containerId);
                      setCreationMode('sous-section');
                      setNewSubSectionLabel('');
                      setExpandedIds((prev) => new Set(prev).add(containerId));
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-indigo-200 hover:bg-indigo-950/60 cursor-pointer"
                  >
                    <Folder className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
                    <span>Ajouter une sous-section</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      importTargetIdRef.current = containerId;
                      setContextMenu(null);
                      fileUploadInputRef.current?.click();
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-emerald-200 hover:bg-emerald-950/60 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    <span>Importer fichier(s) ici</span>
                  </button>
                </>
              )}

              {canChangeStatus && (
                <>
                  <div className="my-1 border-t border-slate-800" />
                  <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Statut ({WORKFLOW_STATUS_LABELS[ctxNode.status || 'todo']})
                  </div>
                  <div className="grid grid-cols-2 gap-1 px-2 pb-1">
                    {(['todo', 'in-progress', 'in-review', 'validated'] as WorkflowNodeStatus[]).map(
                      (st) => {
                        const isCur = (ctxNode.status || 'todo') === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              setContextMenu(null);
                              void handleSetGuestNodeStatus(ctxNode, st);
                            }}
                            className={`rounded px-2 py-1 text-left text-[10px] font-semibold transition-colors cursor-pointer ${
                              isCur
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {WORKFLOW_STATUS_LABELS[st]}
                          </button>
                        );
                      }
                    )}
                  </div>
                </>
              )}

              <div className="my-1 border-t border-slate-800" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  handleDownloadGuestNode(ctxNode);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                <span>Télécharger (.md)</span>
              </button>

              {canRenameOrDup && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setContextMenu(null);
                      void handleDuplicateGuestNode(ctxNode);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>Dupliquer</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setRenamingNodeId(ctxNode.id);
                      setRenameDraft(ctxNode.label);
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                    <span>Renommer</span>
                  </button>
                </>
              )}

              {canDeleteCtx && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setConfirmDeleteNodeId(ctxNode.id);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-red-300 hover:bg-red-950/60 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
                  <span>Supprimer</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {(room.shareType === 'suivi-recos' || room.shareType === 'audit-plan') && (
        <div className="flex min-h-0 flex-1 flex-col bg-slate-50 text-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 text-xs">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-blue-700" aria-hidden="true" />
              <span className="font-semibold text-slate-900">
                Registre collaboratif Suivi des Recommandations ({mergedRecoRows.length} recos)
              </span>
              <span className="text-slate-500">
                · Double-clic ou clic droit / ⋮ sur une ligne pour ouvrir le menu contextuel et mettre à jour les tables du propriétaire
              </span>
            </div>
            <input
              type="text"
              value={recoSearch}
              onChange={(e) => setRecoSearch(e.target.value)}
              placeholder="Filtrer réf, direction, responsable..."
              className="w-64 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div
            onScroll={() => recoContextMenu && setRecoContextMenu(null)}
            className="flex-1 overflow-auto bg-[#F5F6F8] p-4 lg:p-5"
          >
            <div className="overflow-x-auto rounded-lg border border-slate-300/90 bg-white shadow-[0_6px_18px_-3px_rgba(15,23,42,0.22),0_3px_8px_-2px_rgba(15,23,42,0.14)]">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="divide-x divide-red-950/45 bg-[#8B0000] text-[12px] font-semibold text-white">
                    <th className="px-3.5 py-2.5 whitespace-nowrap">N° / Réf</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap">Mission &amp; Direction</th>
                    <th className="px-3.5 py-2.5">Recommandation</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap">Risque</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap">Statut (Sync)</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap">Délai</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap">Report délai</th>
                    <th className="px-3.5 py-2.5">Plan d&apos;action</th>
                    <th className="px-3.5 py-2.5">Commentaire audité / opérationnel</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap">Responsable</th>
                    <th className="w-8 px-1.5 py-2.5 text-right font-normal text-white/80">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {mergedRecoRows.map((row) => {
                    const openRecoRowMenu = (
                      clientX: number,
                      clientY: number,
                      field?: keyof RecoSourceMetadata
                    ) => {
                      const menuWidth = 248;
                      const menuHeight = 320;
                      const maxX =
                        typeof window !== 'undefined'
                          ? window.innerWidth - menuWidth - 12
                          : clientX;
                      const maxY =
                        typeof window !== 'undefined'
                          ? window.innerHeight - menuHeight - 12
                          : clientY;
                      setRecoContextMenu({
                        x: Math.max(12, Math.min(clientX, maxX)),
                        y: Math.max(12, Math.min(clientY, maxY)),
                        row,
                        field,
                      });
                    };

                    const renderEditableCell = (
                      field: keyof RecoSourceMetadata,
                      value: string,
                      placeholder = '—'
                    ) => {
                      const isEditing =
                        editingRecoCell?.nodeId === row.nodeId &&
                        editingRecoCell?.field === field;
                      if (isEditing) {
                        return (
                          <div className="flex flex-col gap-1">
                            <textarea
                              rows={2}
                              autoFocus
                              value={editingRecoCell.draft}
                              onChange={(e) =>
                                setEditingRecoCell({
                                  ...editingRecoCell,
                                  draft: e.target.value,
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  const val = editingRecoCell.draft;
                                  setEditingRecoCell(null);
                                  void handleGuestRecoPatch(
                                    row,
                                    { [field]: val },
                                    undefined,
                                    `${row.record.refRecos} · ${String(field)} modifié`
                                  );
                                } else if (e.key === 'Escape') {
                                  setEditingRecoCell(null);
                                }
                              }}
                              className="w-full min-w-[160px] rounded border border-blue-600 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none"
                            />
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const val = editingRecoCell.draft;
                                  setEditingRecoCell(null);
                                  void handleGuestRecoPatch(
                                    row,
                                    { [field]: val },
                                    undefined,
                                    `${row.record.refRecos} · ${String(field)} modifié`
                                  );
                                }}
                                className="rounded bg-blue-700 px-2 py-0.5 text-[10px] font-semibold text-white cursor-pointer"
                              >
                                Enregistrer
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingRecoCell(null)}
                                className="rounded border border-slate-300 px-2 py-0.5 text-[10px] text-slate-600 cursor-pointer"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openRecoRowMenu(e.clientX, e.clientY, field);
                          }}
                          onDoubleClick={() => {
                            if (!room.allowEdit) return;
                            setEditingRecoCell({
                              nodeId: row.nodeId,
                              field,
                              draft: value || '',
                            });
                          }}
                          title={
                            room.allowEdit
                              ? 'Double-clic pour modifier · Clic droit pour menu contextuel'
                              : 'Clic droit pour copier'
                          }
                          className={`min-h-[24px] rounded px-1.5 py-0.5 transition-colors ${
                            room.allowEdit
                              ? 'cursor-text hover:bg-[#EAF4FF] hover:ring-1 hover:ring-inset hover:ring-sky-500'
                              : ''
                          }`}
                        >
                          {value || placeholder}
                        </div>
                      );
                    };

                    const isRecoContextActive =
                      recoContextMenu?.row.nodeId === row.nodeId;

                    return (
                      <tr
                        key={row.nodeId}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          openRecoRowMenu(e.clientX, e.clientY);
                        }}
                        className={`group divide-x divide-slate-200 align-top ${
                          isRecoContextActive
                            ? 'bg-[#EAF4FF] ring-1 ring-inset ring-sky-500'
                            : 'bg-white hover:bg-sky-50/40'
                        }`}
                      >
                        <td className="px-3 py-2 font-mono whitespace-nowrap">
                          <div className="font-semibold text-slate-900">
                            #{row.record.no} · {row.record.refRecos}
                          </div>
                          <div className="text-[10px] text-slate-500">{row.exerciceLabel}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">{row.missionLabel}</div>
                          <div className="text-[11px] text-slate-500">{row.record.direction}</div>
                        </td>
                        <td className="max-w-xs px-3 py-2 text-slate-800">
                          {row.record.intituleRecos}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                              row.record.evaluationRisque.toLowerCase() === 'critique'
                                ? 'bg-red-100 text-red-800'
                                : row.record.evaluationRisque.toLowerCase() === 'majeur'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {row.record.evaluationRisque}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <select
                            disabled={!room.allowEdit}
                            value={row.record.statut}
                            onChange={(e) => {
                              const nextStatutLabel = e.target.value as
                                | 'Réalisé'
                                | 'En attente'
                                | 'Reporté'
                                | 'Non réalisé';
                              const mapped = STATUT_OPTIONS.find(
                                (s) => s.label === nextStatutLabel
                              );
                              void handleGuestRecoPatch(
                                row,
                                { statut: nextStatutLabel },
                                mapped?.status,
                                `${row.record.refRecos} → Statut « ${nextStatutLabel} »`
                              );
                            }}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-900 disabled:bg-slate-100"
                          >
                            {STATUT_OPTIONS.map((opt) => (
                              <option key={opt.label} value={opt.label}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">
                          {renderEditableCell('delai', row.record.delai)}
                        </td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">
                          {renderEditableCell('reportDelai', row.record.reportDelai, 'Aucun')}
                        </td>
                        <td className="max-w-xs px-3 py-2">
                          {renderEditableCell('planAction', row.record.planAction)}
                        </td>
                        <td className="max-w-xs px-3 py-2">
                          {renderEditableCell(
                            'commentaireAudite',
                            row.record.commentaireAudite,
                            'Double-clic pour commenter...'
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                          <div>{row.record.responsable}</div>
                          {row.lastEditedBy && (
                            <div className="text-[10px] text-emerald-700">
                              Màj : {row.lastEditedBy}
                            </div>
                          )}
                        </td>
                        <td className="px-1.5 py-2 text-right">
                          <button
                            type="button"
                            title="Menu contextuel de la recommandation"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              openRecoRowMenu(rect.right - 220, rect.bottom + 4);
                            }}
                            className="rounded p-1 text-slate-400 opacity-75 hover:bg-slate-200 hover:text-slate-800 group-hover:opacity-100 cursor-pointer"
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
        </div>
      )}

      {/* Menu contextuel sur les lignes du tableau partagé Suivi des Recommandations */}
      {recoContextMenu && (
        <div
          ref={recoContextMenuRef}
          role="menu"
          aria-label={`Menu contextuel ${recoContextMenu.row.record.refRecos}`}
          style={{ left: `${recoContextMenu.x}px`, top: `${recoContextMenu.y}px` }}
          className="fixed z-[95] w-60 rounded-xl border border-slate-700 bg-slate-900 p-1.5 text-xs text-slate-100 shadow-2xl"
        >
          <div className="border-b border-slate-800 px-2.5 py-1.5">
            <div className="truncate font-semibold text-white">
              #{recoContextMenu.row.record.no} · {recoContextMenu.row.record.refRecos}
            </div>
            <div className="truncate text-[10px] text-slate-400">
              {recoContextMenu.row.record.direction}
            </div>
          </div>

          <div className="py-1 space-y-0.5">
            {room.allowEdit && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const targetRow = recoContextMenu.row;
                    setEditingRecoCell({
                      nodeId: targetRow.nodeId,
                      field: 'planAction',
                      draft: targetRow.record.planAction || '',
                    });
                    setRecoContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-800 cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                  <span>Modifier le plan d&apos;action</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const targetRow = recoContextMenu.row;
                    setEditingRecoCell({
                      nodeId: targetRow.nodeId,
                      field: 'commentaireAudite',
                      draft: targetRow.record.commentaireAudite || '',
                    });
                    setRecoContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-800 cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                  <span>Modifier commentaire audité</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const targetRow = recoContextMenu.row;
                    setEditingRecoCell({
                      nodeId: targetRow.nodeId,
                      field: 'delai',
                      draft: targetRow.record.delai || '',
                    });
                    setRecoContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-800 cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Modifier le délai</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const targetRow = recoContextMenu.row;
                    setEditingRecoCell({
                      nodeId: targetRow.nodeId,
                      field: 'reportDelai',
                      draft: targetRow.record.reportDelai || '',
                    });
                    setRecoContextMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-800 cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                  <span>Modifier le report de délai</span>
                </button>

                <div className="my-1 border-t border-slate-800" />
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Statut ({recoContextMenu.row.record.statut})
                </div>
                <div className="grid grid-cols-2 gap-1 px-2 pb-1">
                  {STATUT_OPTIONS.map((opt) => {
                    const isCur = recoContextMenu.row.record.statut === opt.label;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          const targetRow = recoContextMenu.row;
                          setRecoContextMenu(null);
                          void handleGuestRecoPatch(
                            targetRow,
                            { statut: opt.label },
                            opt.status,
                            `${targetRow.record.refRecos} → Statut « ${opt.label} »`
                          );
                        }}
                        className={`rounded px-2 py-1 text-left text-[10px] font-semibold cursor-pointer ${
                          isCur
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="my-1 border-t border-slate-800" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const r = recoContextMenu.row.record;
                const txt = `${r.refRecos} | ${r.direction} | ${r.intituleRecos} | Statut: ${r.statut}`;
                void navigator.clipboard?.writeText(txt).catch(() => undefined);
                setRecoContextMenu(null);
                showToast(`Référence ${r.refRecos} copiée`);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span>Copier la recommandation</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
