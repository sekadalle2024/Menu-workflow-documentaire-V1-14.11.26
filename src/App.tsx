import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelRightOpen, RefreshCw } from 'lucide-react';
import { AuditChatWorkspace } from './components/AuditChatWorkspace';
import { DeployScriptView } from './components/DeployScriptView';
import { DossierTreeAccordion } from './components/DossierTreeAccordion';
import { LeftWorkflowSidebar } from './components/LeftWorkflowSidebar';
import { PostgresDriveSchemaView } from './components/PostgresDriveSchemaView';
import { RightSlidingMenu } from './components/RightSlidingMenu';
import { TopBar } from './components/TopBar';
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
  AccordionMode,
  ActiveWorkspaceTab,
  AuditChatMessage,
  ClassifiedTableItem,
  DossierTreeNode,
} from './types/dossier';
import {
  ClientSessionConfig,
  WorkflowNatureId,
  WorkflowTreeNode,
} from './types/workflow';
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
  addWorkflowToExercice,
  applySignatureToNodes,
  collectAllExpandableWorkflowIds,
  collectAllWorkflowNodeIds,
  collectSubtreeExpandableIds,
  createBlankWorkflowNode,
  deleteNodesInTree,
  duplicateNodesInTree,
  filterTopLevelSelectedIds,
  findNodeById,
  findNodeIdsByNatureId,
  findNodePath,
  generateRandomAuditDocumentName,
  hasLockedNodeInIds,
  isNodeLockedOrWithinLockedAncestor,
  lockNodesInTree,
  moveNodesToTarget,
  pasteNodesToTarget,
  renameNodeInTree,
  resolveContainerTargetId,
  resolveRootIdForTarget,
  sortExercicesChronologically,
  toggleManagerReviewInTree,
  toggleWorkflowNodeCheck,
  transferNodesToTarget,
  unlockNodeInTree,
} from './utils/workflowTreeOps';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('workspace');
  const [isRightMenuOpen, setIsRightMenuOpen] = useState(false);

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
        'user-ex-2026',
        'user-2026-ex-audit',
        'team-ex-2026',
        'team-2026-ex-audit',
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

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);

  const flashStatus = useCallback((msg: string) => {
    setWfStatusMessage(msg);
    if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = window.setTimeout(() => setWfStatusMessage(null), 3500);
  }, []);

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
    [activatedSourceIds, wfCheckedIds, workflowTrees, session.userSignature, flashStatus]
  );

  const handleOpenWordDoc = useCallback(
    (docNode: WorkflowTreeNode) => {
      if (isNodeLockedOrWithinLockedAncestor(workflowTrees, docNode.id) || docNode.locked) {
        flashStatus('Ouverture bloquée : élément verrouillé par code PIN.');
        return;
      }
      setOpenedWordDoc(docNode);
      setHighlightedNodeId(docNode.id);
      flashStatus(`Document Word simulé ouvert : « ${docNode.label}.docx »`);
    },
    [workflowTrees, flashStatus]
  );

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
      setWorkflowTrees((prev) => duplicateNodesInTree(prev, targetIds));
      flashStatus('Élément(s) dupliqué(s) dans l’arborescence.');
    },
    [workflowTrees, wfCheckedIds, flashStatus]
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
      flashStatus('Élément(s) supprimé(s) de la vue.');
    },
    [workflowTrees, wfCheckedIds, flashStatus]
  );

  const handleRenameNode = useCallback(
    (nodeId: string, newLabel: string) => {
      const target = findNodeById(workflowTrees, nodeId);
      if (target?.locked) {
        flashStatus('Renommage bloqué : déverrouillez d’abord cet élément avec son code PIN.');
        return;
      }
      setWorkflowTrees((prev) => sortExercicesChronologically(renameNodeInTree(prev, nodeId, newLabel)));
      setOpenedWordDoc((prev) => (prev && prev.id === nodeId ? { ...prev, label: newLabel } : prev));
      flashStatus(`Renommé en « ${newLabel} ».`);
    },
    [workflowTrees, flashStatus]
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
      setWorkflowTrees(result.trees);
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
    [workflowTrees, wfCheckedIds, session.userSignature, flashStatus]
  );

  const handleLockNodes = useCallback(
    (targetIds: string[], pin: string) => {
      const idSet = new Set(targetIds);
      if (idSet.size === 0) return;
      setWorkflowTrees((prev) => {
        const nextTrees = lockNodesInTree(prev, idSet, pin);
        setOpenedWordDoc((opened) =>
          opened && isNodeLockedOrWithinLockedAncestor(nextTrees, opened.id) ? null : opened
        );
        return nextTrees;
      });
      setWfCheckedIds(new Set());
      flashStatus(`Verrouillé (${idSet.size} élément(s)) avec code PIN à 4 chiffres.`);
    },
    [flashStatus]
  );

  const handleUnlockNode = useCallback(
    (nodeId: string, pin: string): boolean => {
      const res = unlockNodeInTree(workflowTrees, nodeId, pin);
      if (!res.unlocked) {
        return false;
      }
      setWorkflowTrees(res.trees);
      setOpenedWordDoc((prev) =>
        prev && prev.id === nodeId ? { ...prev, locked: false, lockPin: undefined } : prev
      );
      flashStatus('Élément déverrouillé — le cadenas a disparu et le fichier est modifiable.');
      return true;
    },
    [workflowTrees, flashStatus]
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

      setWorkflowTrees((prev) => toggleManagerReviewInTree(prev, idSet));
      setOpenedWordDoc((prev) =>
        prev && idSet.has(prev.id)
          ? { ...prev, managerReviewed: !prev.managerReviewed }
          : prev
      );
      flashStatus('Icône « Revue manager » mise à jour.');
    },
    [wfCheckedIds, flashStatus]
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

      setWorkflowTrees(res.trees);
      setWfExpandedIds((prev) => {
        const next = new Set(prev);
        const path = findNodePath(res.trees, destinationId);
        path?.forEach((p) => next.add(p.id));
        next.add(destinationId);
        return next;
      });
      setMoveSourceIds([]);
      setWfCheckedIds(new Set());
      const destNode = findNodeById(res.trees, destinationId);
      flashStatus(
        `${res.movedCount} élément(s) déplacé(s) vers « ${destNode?.label || 'destination'} » (supprimé de la source).`
      );
    },
    [moveSourceIds, workflowTrees, flashStatus]
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
    [workflowTrees, wfCheckedIds, clipboardIds, flashStatus]
  );

  const handleAddChildToNode = useCallback(
    (
      targetId: string,
      label: string,
      kind: 'document' | 'section' | 'sous-section' | 'exercice' | 'sub-exercice'
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
        children: nodeType === 'document' ? undefined : [],
      };
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
      flashStatus(`Ajouté en dernière position : « ${label} ».`);
    },
    [workflowTrees, session.userSignature, session.email, flashStatus]
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
    [workflowTrees, flashStatus]
  );

  const handleAddNatureWorkflow = useCallback(
    (natureId: WorkflowNatureId, targetNodeId?: string) => {
      const meta = WORKFLOW_SIDEBAR_ITEMS.find((i) => i.id === natureId);
      if (!meta) return;
      const rootId = resolveRootIdForTarget(workflowTrees, targetNodeId);
      const scope = rootId === 'root-team-workflow' ? 'team' : 'user';
      const node = createFullNatureWorkflowNode(natureId, scope);
      const result = addWorkflowToExercice(workflowTrees, targetNodeId, node);
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
    [workflowTrees, flashStatus]
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isPanelOpen={isRightMenuOpen}
        onTogglePanel={() => setIsRightMenuOpen((prev) => !prev)}
      />

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

            {activeTab === 'schema' && (
              <PostgresDriveSchemaView trees={workflowTrees} session={session} />
            )}

            {activeTab === 'script' && <DeployScriptView />}
          </div>
        </div>
      </main>

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
        onClearMoveSource={() => setMoveSourceIds([])}
        clipboardIds={clipboardIds}
        onCopyPasteAction={handleCopyPasteAction}
        onClearClipboard={() => setClipboardIds([])}
        onSignNodes={handleSignNodes}
        onLockNodes={handleLockNodes}
        onUnlockNode={handleUnlockNode}
        onToggleManagerReview={handleToggleManagerReview}
        openedWordDoc={openedWordDoc}
        onOpenWordDoc={handleOpenWordDoc}
        onCloseWordDoc={() => setOpenedWordDoc(null)}
        onOpenDocumentInChat={handleOpenDocumentInChat}
        onDownloadNodes={handleDownloadNodes}
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
      />
    </div>
  );
}
