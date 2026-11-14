import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardCheck,
  ClipboardCopy,
  CopyPlus,
  Dices,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Folder,
  FolderOpen,
  FileText,
  KeyRound,
  Lock,
  MessageSquarePlus,
  MoreVertical,
  Move,
  Pencil,
  PenLine,
  Plus,
  Search,
  Trash2,
  Unlock,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { WORKFLOW_SIDEBAR_ITEMS } from '../data/workflowCatalog';
import {
  ClientSessionConfig,
  WorkflowNatureId,
  WorkflowTreeNode,
} from '../types/workflow';
import {
  collectAllNodesList,
  generateRandomAuditDocumentName,
  getWorkflowCheckState,
  hasLockedNodeInIds,
  isNodeLockedOrWithinLockedAncestor,
} from '../utils/workflowTreeOps';

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
  onClearMoveSource: () => void;
  clipboardIds: string[];
  onCopyPasteAction: (fallbackNodeId?: string) => void;
  onClearClipboard: () => void;
  onSignNodes: (fallbackNodeId?: string) => void;
  onLockNodes: (targetIds: string[], pin: string) => void;
  onUnlockNode: (nodeId: string, pin: string) => boolean;
  onToggleManagerReview: (fallbackNodeId?: string) => void;
  openedWordDoc: WorkflowTreeNode | null;
  onOpenWordDoc: (node: WorkflowTreeNode) => void;
  onCloseWordDoc: () => void;
  onOpenDocumentInChat: (node: WorkflowTreeNode) => void;
  onDownloadNodes: (fallbackNodeId?: string) => void;
  onDuplicateNodes: (fallbackNodeId?: string) => void;
  onDeleteNodes: (fallbackNodeId?: string) => void;
  onRenameNode: (nodeId: string, newLabel: string) => void;
  onAddChildToNode: (
    targetId: string,
    label: string,
    kind: 'document' | 'section' | 'sous-section' | 'exercice' | 'sub-exercice'
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
  onClearMoveSource,
  clipboardIds,
  onCopyPasteAction,
  onClearClipboard,
  onSignNodes,
  onLockNodes,
  onUnlockNode,
  onToggleManagerReview,
  openedWordDoc,
  onOpenWordDoc,
  onCloseWordDoc,
  onOpenDocumentInChat,
  onDownloadNodes,
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showApiPanel, setShowApiPanel] = useState(false);
  const [userKeyDraft, setUserKeyDraft] = useState(session.userApiKey);
  const [teamKeyDraft, setTeamKeyDraft] = useState(session.teamApiKey);
  const [sigDraft, setSigDraft] = useState(session.userSignature);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const [addingTarget, setAddingTarget] = useState<{
    targetId: string;
    targetLabel: string;
    kind: 'document' | 'section' | 'sous-section' | 'exercice' | 'sub-exercice';
  } | null>(null);
  const [addLabelDraft, setAddLabelDraft] = useState('');
  const [wordBodies, setWordBodies] = useState<Record<string, string>>({});

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
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

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
      if (e.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null);
        } else if (pinPrompt) {
          setPinPrompt(null);
        } else if (renamingId) {
          setRenamingId(null);
        } else if (addingTarget) {
          setAddingTarget(null);
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
  }, [isOpen, onClose, renamingId, addingTarget, contextMenu, pinPrompt]);

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

  const effectiveTransferCount =
    activatedSourceIds.length > 0 ? activatedSourceIds.length : checkedNonRootNodes.length;

  const isSearching = searchQuery.trim().length > 0;

  const openContextMenuAt = (x: number, y: number, node: WorkflowTreeNode | null) => {
    const menuWidth = 288;
    const menuHeight = node ? 540 : 140;
    const clampedX = Math.min(x, window.innerWidth - menuWidth - 12);
    const clampedY = Math.min(y, window.innerHeight - menuHeight - 12);
    setShowNatureSubmenu(false);
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
      if (node.nodeType === 'document') {
        return <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />;
      }
      return isExpanded ? (
        <FolderOpen className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
      ) : (
        <Folder className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      );
    };

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
                if (node.nodeType === 'document') {
                  if (!effectivelyLocked) onOpenWordDoc(node);
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

          {!isRenaming && hasChildren && (
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
        className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-[780px] flex-col border-l border-slate-800 bg-slate-900 text-slate-100 shadow-2xl transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header identité & accès API — INCHANGÉ */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-3.5">
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

        {/* Panneau PostgreSQL / User Api Key & Team Api Key — INCHANGÉ */}
        {showApiPanel && (
          <form
            onSubmit={handleValidateKeys}
            className="space-y-3 border-b border-slate-800 bg-slate-950/60 px-5 py-3.5 text-xs"
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
        <div className="space-y-2.5 border-b border-slate-800 px-5 py-3">
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

          {statusMessage && (
            <div className="flex items-center gap-2 rounded-md border border-blue-800/70 bg-blue-950/60 px-3 py-1.5 text-xs text-blue-200">
              <Check className="h-3.5 w-3.5 shrink-0 text-blue-400" aria-hidden="true" />
              <span className="truncate">{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Simulation d'un document Word vierge ouvert AU-DESSUS de la TreeView */}
        {openedWordDoc && (
          <div
            aria-label={`Document Word simulé : ${openedWordDoc.label}`}
            className="border-b border-slate-700 bg-slate-950 px-4 py-3"
          >
            <div className="overflow-hidden rounded-lg border border-slate-700 bg-white text-slate-900 shadow-lg">
              <div className="flex items-center justify-between gap-2 bg-[#185ABD] px-3 py-1.5 text-xs text-white">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/15 font-serif text-[11px] font-bold">
                    W
                  </span>
                  <span className="truncate font-medium" title={`${openedWordDoc.label}.docx`}>
                    {openedWordDoc.label}.docx
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
                  <button
                    type="button"
                    onClick={() => onOpenDocumentInChat(openedWordDoc)}
                    className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-medium hover:bg-white/25 cursor-pointer"
                  >
                    Envoyer au chat
                  </button>
                  <button
                    type="button"
                    onClick={onCloseWordDoc}
                    aria-label="Fermer le document Word simulé"
                    className="rounded p-0.5 hover:bg-white/20 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-sans">
                    Calibri · 11
                  </span>
                  <span className="font-bold">G</span>
                  <span className="italic">I</span>
                  <span className="underline">S</span>
                </div>
                <span className="font-mono text-[10px] text-slate-500">
                  {openedWordDoc.locked
                    ? 'Lecture seule (verrouillé par PIN)'
                    : `Document vierge · [${openedWordDoc.owner || session.userSignature}]`}
                </span>
              </div>

              <div className="bg-slate-200/70 p-2.5">
                <div className="mx-auto rounded border border-slate-300 bg-white px-4 py-3 shadow-xs">
                  <div className="border-b border-slate-200 pb-1.5">
                    <div className="text-xs font-bold text-slate-900">
                      {openedWordDoc.label}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      Réf. Drive : {openedWordDoc.driveId || 'N/A'} · Client : {session.client}
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    readOnly={Boolean(openedWordDoc.locked)}
                    value={wordBodies[openedWordDoc.id] ?? ''}
                    onChange={(e) =>
                      setWordBodies((prev) => ({
                        ...prev,
                        [openedWordDoc.id]: e.target.value,
                      }))
                    }
                    placeholder={
                      openedWordDoc.locked
                        ? 'Document verrouillé — déverrouillez avec le code PIN pour modifier.'
                        : "Document vierge simulé — saisissez vos observations, constats ou tests d'audit..."
                    }
                    className={`mt-2 w-full resize-none border-0 bg-transparent text-xs placeholder:text-slate-400 focus:outline-none ${
                      openedWordDoc.locked ? 'cursor-not-allowed text-slate-500' : 'text-slate-800'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Arborescence Workflow & Team Workflow */}
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

          <div className="py-1">
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
                    <span>Ouvrir (Document Word)</span>
                  </button>
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

                {contextMenu.node.nodeType === 'section' && (
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
