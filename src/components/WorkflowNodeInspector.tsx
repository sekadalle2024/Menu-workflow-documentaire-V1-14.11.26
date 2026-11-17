import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  CornerLeftUp,
  ExternalLink,
  History,
  Link2,
  ListTodo,
  MessageSquareWarning,
  Play,
  RotateCcw,
  ShieldAlert,
  Square,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  MethodologyAssessment,
  MissionTodoTask,
  WorkflowTreeNode,
} from '../types/workflow';
import {
  CRIPP_STANDARDS,
  DEFAULT_AUDITOR_PROFILES,
  getMondayOfCurrentWeek,
  snapToWorkingDay,
} from '../utils/auditTodoOps';
import {
  AuditReadinessReport,
  buildParentCrossRefMap,
  collectAllNodesList,
  findNodeById,
} from '../utils/workflowTreeOps';

export type NodeInspectorMode =
  | 'notes'
  | 'versions'
  | 'crossrefs'
  | 'assign'
  | 'audit'
  | 'readiness'
  | 'todo';

export interface NodeInspectorState {
  mode: NodeInspectorMode;
  nodeId: string;
  targetIds?: string[];
}

interface WorkflowNodeInspectorProps {
  inspector: NodeInspectorState;
  trees: WorkflowTreeNode[];
  wordBodies: Record<string, string>;
  isNodeLocked: (nodeId: string) => boolean;
  readinessReport: AuditReadinessReport | null;
  onClose: () => void;
  onJumpToNode: (nodeId: string) => void;
  onNavigateCrossRef?: (nodeId: string) => void;
  onAddReviewNote: (nodeId: string, text: string) => void;
  onToggleReviewNote: (nodeId: string, noteId: string) => void;
  onDeleteReviewNote: (nodeId: string, noteId: string) => void;
  onSaveVersion: (nodeId: string, summary: string) => void;
  onRestoreVersion: (nodeId: string, versionId: string) => void;
  onAddCrossRef: (sourceId: string, targetRefId: string) => void;
  onRemoveCrossRef: (sourceId: string, targetRefId: string) => void;
  onAssignNodes: (targetIds: string[], assignee: string, dueDate: string) => void;
  onAddTodoTask?: (
    nodeId: string,
    input: {
      title: string;
      auditor: string;
      plannedDate: string;
      plannedStartHour: number;
      plannedDurationHours: number;
      crippNormRef?: string;
      methodologyAssessment?: MethodologyAssessment;
      blockerReason?: string;
      teamSupportRequested?: boolean;
    }
  ) => void;
  onUpdateTodoTask?: (
    nodeId: string,
    taskId: string,
    patch: Partial<MissionTodoTask>,
    auditLabel?: string
  ) => void;
  onDeleteTodoTask?: (nodeId: string, taskId: string) => void;
  onClockInTodoTask?: (nodeId: string, taskId: string) => void;
  onClockOutTodoTask?: (nodeId: string, taskId: string) => void;
  onOpenFullAuditPlan?: () => void;
}

const TEAM_MEMBER_PRESETS = [
  { code: 'OHA', label: 'OHA — Auditeur interne' },
  { code: 'SEK', label: 'SEK — Senior Audit' },
  { code: 'MGR', label: 'MGR — Manager Revue' },
  { code: 'ASS', label: 'ASS — Associé Signataire' },
];

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const WorkflowNodeInspector: React.FC<WorkflowNodeInspectorProps> = ({
  inspector,
  trees,
  isNodeLocked,
  readinessReport,
  onClose,
  onJumpToNode,
  onNavigateCrossRef,
  onAddReviewNote,
  onToggleReviewNote,
  onDeleteReviewNote,
  onSaveVersion,
  onRestoreVersion,
  onAddCrossRef,
  onRemoveCrossRef,
  onAssignNodes,
  onAddTodoTask,
  onUpdateTodoTask,
  onDeleteTodoTask,
  onClockInTodoTask,
  onClockOutTodoTask,
  onOpenFullAuditPlan,
}) => {
  const navigateCrossRef = onNavigateCrossRef ?? onJumpToNode;
  const node = useMemo(
    () => findNodeById(trees, inspector.nodeId),
    [trees, inspector.nodeId]
  );
  const parentCrossRefMap = useMemo(() => buildParentCrossRefMap(trees), [trees]);
  const parentRefNodes = useMemo(
    () => (node ? parentCrossRefMap.get(node.id) || [] : []),
    [parentCrossRefMap, node]
  );
  const locked = node ? isNodeLocked(node.id) : false;

  const [noteDraft, setNoteDraft] = useState('');
  const [versionSummaryDraft, setVersionSummaryDraft] = useState('');
  const [refSearch, setRefSearch] = useState('');
  const [assigneeDraft, setAssigneeDraft] = useState(node?.assignee || '');
  const [dueDateDraft, setDueDateDraft] = useState(node?.dueDate || '');
  const [readinessFilter, setReadinessFilter] = useState<'all' | 'critical'>('all');
  const [todoTitleDraft, setTodoTitleDraft] = useState('');
  const [todoAuditorDraft, setTodoAuditorDraft] = useState('OHA');
  const [todoDateDraft, setTodoDateDraft] = useState(() => getMondayOfCurrentWeek());
  const [todoStartHourDraft, setTodoStartHourDraft] = useState(8);
  const [todoDurationDraft, setTodoDurationDraft] = useState(4);
  const [todoNormDraft, setTodoNormDraft] = useState(CRIPP_STANDARDS[7]);

  const candidateRefNodes = useMemo(() => {
    if (!node) return [];
    const existing = new Set(node.crossRefs || []);
    const q = refSearch.trim().toLowerCase();
    return collectAllNodesList(trees)
      .filter(
        (candidate) =>
          candidate.nodeType !== 'root' &&
          candidate.id !== node.id &&
          !existing.has(candidate.id) &&
          (!q || candidate.label.toLowerCase().includes(q))
      )
      .slice(0, 25);
  }, [trees, node, refSearch]);

  if (!node && inspector.mode !== 'readiness') return null;

  const modeMeta: Record<
    NodeInspectorMode,
    { title: string; icon: React.ReactNode; accent: string }
  > = {
    notes: {
      title: 'Notes de revue / Points en suspens',
      icon: <MessageSquareWarning className="h-4 w-4 text-amber-400" aria-hidden="true" />,
      accent: 'border-amber-700/60',
    },
    versions: {
      title: 'Historique des versions',
      icon: <History className="h-4 w-4 text-cyan-400" aria-hidden="true" />,
      accent: 'border-cyan-700/60',
    },
    crossrefs: {
      title: 'Références croisées (W/P)',
      icon: <Link2 className="h-4 w-4 text-indigo-400" aria-hidden="true" />,
      accent: 'border-indigo-700/60',
    },
    assign: {
      title: 'Assignation & Échéance',
      icon: <UserPlus className="h-4 w-4 text-emerald-400" aria-hidden="true" />,
      accent: 'border-emerald-700/60',
    },
    audit: {
      title: 'Journal de traçabilité (Audit Trail)',
      icon: <ClipboardList className="h-4 w-4 text-slate-300" aria-hidden="true" />,
      accent: 'border-slate-700',
    },
    readiness: {
      title: 'Contrôle de complétude / Pré-clôture',
      icon: <ShieldAlert className="h-4 w-4 text-blue-400" aria-hidden="true" />,
      accent: 'border-blue-700/60',
    },
    todo: {
      title: 'To-do liste & Suivi temps (08h / jour ouvrable)',
      icon: <ListTodo className="h-4 w-4 text-teal-400" aria-hidden="true" />,
      accent: 'border-teal-700/60',
    },
  };

  const meta = modeMeta[inspector.mode];

  return (
    <div
      className={`border-b bg-slate-950/90 px-4 py-3 text-xs text-slate-200 ${meta.accent}`}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {meta.icon}
          <div className="min-w-0">
            <div className="font-semibold text-white">{meta.title}</div>
            {node && (
              <div className="truncate text-[11px] text-slate-400">
                {node.label}
                {locked ? ' · Verrouillé (lecture seule)' : ''}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le panneau d'inspection"
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Point 2 : Notes de revue */}
      {inspector.mode === 'notes' && node && (
        <div className="space-y-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!noteDraft.trim() || locked) return;
              onAddReviewNote(node.id, noteDraft);
              setNoteDraft('');
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              disabled={locked}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder={
                locked
                  ? 'Élément verrouillé par code PIN'
                  : 'Ajouter un point de revue ou une question...'
              }
              className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={locked || !noteDraft.trim()}
              className="rounded bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              Ajouter
            </button>
          </form>

          <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
            {!node.reviewNotes || node.reviewNotes.length === 0 ? (
              <div className="rounded border border-dashed border-slate-800 py-3 text-center text-[11px] text-slate-500">
                Aucune note de revue sur cet élément.
              </div>
            ) : (
              node.reviewNotes.map((rn) => (
                <div
                  key={rn.id}
                  className={`flex items-start justify-between gap-2 rounded border px-2.5 py-2 ${
                    rn.status === 'resolved'
                      ? 'border-emerald-900/60 bg-emerald-950/20 text-slate-400'
                      : 'border-amber-800/60 bg-amber-950/25 text-slate-100'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="font-mono font-semibold text-slate-200">{rn.author}</span>
                      <span>· {formatShortDate(rn.createdAt)}</span>
                      <span
                        className={
                          rn.status === 'resolved' ? 'text-emerald-400' : 'text-amber-400'
                        }
                      >
                        {rn.status === 'resolved' ? 'Levé' : 'Ouvert'}
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 break-words text-xs ${
                        rn.status === 'resolved' ? 'line-through opacity-75' : ''
                      }`}
                    >
                      {rn.text}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => onToggleReviewNote(node.id, rn.id)}
                      title={rn.status === 'open' ? 'Marquer levé' : 'Rouvrir la note'}
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      {rn.status === 'open' ? 'Lever' : 'Rouvrir'}
                    </button>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => onDeleteReviewNote(node.id, rn.id)}
                      aria-label="Supprimer cette note"
                      className="rounded p-1 text-slate-400 hover:bg-red-950/50 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Point 4 : Historique des versions */}
      {inspector.mode === 'versions' && node && (
        <div className="space-y-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (locked) return;
              onSaveVersion(node.id, versionSummaryDraft);
              setVersionSummaryDraft('');
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              disabled={locked}
              value={versionSummaryDraft}
              onChange={(e) => setVersionSummaryDraft(e.target.value)}
              placeholder={
                locked
                  ? 'Élément verrouillé par code PIN'
                  : 'Libellé de version (ex: Avant revue manager)...'
              }
              className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={locked}
              className="rounded bg-cyan-700 px-3 py-1.5 font-medium text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              Enregistrer version
            </button>
          </form>

          <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
            {!node.versions || node.versions.length === 0 ? (
              <div className="rounded border border-dashed border-slate-800 py-3 text-center text-[11px] text-slate-500">
                Aucune version archivée. Cliquez sur « Enregistrer version » pour créer un instantané.
              </div>
            ) : (
              node.versions.map((ver) => (
                <div
                  key={ver.id}
                  className="flex items-start justify-between gap-2 rounded border border-slate-800 bg-slate-900/80 px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono font-semibold text-cyan-300">
                        {ver.versionLabel}
                      </span>
                      <span className="font-mono text-slate-300">{ver.author}</span>
                      <span className="text-slate-500">· {formatShortDate(ver.timestamp)}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-200">{ver.summary}</div>
                    {ver.wordBodySnapshot && (
                      <div className="mt-0.5 truncate text-[10px] text-slate-400">
                        Contenu : {ver.wordBodySnapshot}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => onRestoreVersion(node.id, ver.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded border border-cyan-800/70 bg-cyan-950/40 px-2 py-1 text-[10px] font-medium text-cyan-200 hover:bg-cyan-900/60 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    <span>Restaurer</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Point 5 : Cross-référencement bidirectionnel (Enfants & Parents) */}
      {inspector.mode === 'crossrefs' && node && (
        <div className="space-y-2.5">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-indigo-300">
              <ArrowDownRight className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
              <span>Références enfants ({node.crossRefs?.length || 0})</span>
            </div>
            {!node.crossRefs || node.crossRefs.length === 0 ? (
              <div className="rounded border border-dashed border-slate-800 py-2 text-center text-[11px] text-slate-500">
                Aucune référence enfant associée.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {node.crossRefs.map((refId) => {
                  const target = findNodeById(trees, refId);
                  return (
                    <div
                      key={refId}
                      className="inline-flex items-center gap-1.5 rounded border border-indigo-700/70 bg-indigo-950/50 px-2 py-1 text-[11px] text-indigo-200"
                    >
                      <button
                        type="button"
                        onClick={() => navigateCrossRef(refId)}
                        className="inline-flex items-center gap-1 max-w-[220px] truncate hover:underline cursor-pointer"
                        title={`Sélectionner et ouvrir l'enfant : ${target?.label || refId}`}
                      >
                        <ArrowDownRight className="h-3 w-3 shrink-0 text-indigo-400" aria-hidden="true" />
                        <span className="truncate">{target?.label || 'Élément introuvable'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateCrossRef(refId)}
                        title="Aller vers la référence enfant (ouvrir document)"
                        className="rounded bg-indigo-800/80 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-indigo-700 cursor-pointer"
                      >
                        Ouvrir
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => onRemoveCrossRef(node.id, refId)}
                        aria-label={`Retirer le lien vers ${target?.label || refId}`}
                        className="text-indigo-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-cyan-300">
              <CornerLeftUp className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
              <span>Parents référents identifiés ({parentRefNodes.length})</span>
            </div>
            {parentRefNodes.length === 0 ? (
              <div className="rounded border border-dashed border-slate-800 py-2 text-center text-[11px] text-slate-500">
                Aucun parent ne référence encore cet élément.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {parentRefNodes.map((parentNode) => (
                  <button
                    key={parentNode.id}
                    type="button"
                    onClick={() => navigateCrossRef(parentNode.id)}
                    title={`Sélectionner et ouvrir le parent : ${parentNode.label}`}
                    className="inline-flex items-center gap-1.5 rounded border border-cyan-700/70 bg-cyan-950/50 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-900/60 cursor-pointer"
                  >
                    <CornerLeftUp className="h-3 w-3 shrink-0 text-cyan-400" aria-hidden="true" />
                    <span className="max-w-[200px] truncate">{parentNode.label}</span>
                    <span className="rounded bg-cyan-800/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Aller au parent
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!locked && (
            <div className="space-y-1.5">
              <input
                type="text"
                value={refSearch}
                onChange={(e) => setRefSearch(e.target.value)}
                placeholder="Rechercher un document ou dossier à lier..."
                className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                {candidateRefNodes.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/70 px-2 py-1"
                  >
                    <span className="min-w-0 flex-1 truncate text-[11px] text-slate-200">
                      {candidate.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAddCrossRef(node.id, candidate.id)}
                      className="shrink-0 rounded bg-indigo-700 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-indigo-600 cursor-pointer"
                    >
                      Lier
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Point 7 : Assigner & Échéance */}
      {inspector.mode === 'assign' && node && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (locked) return;
            const targets =
              inspector.targetIds && inspector.targetIds.length > 0
                ? inspector.targetIds
                : [node.id];
            onAssignNodes(targets, assigneeDraft, dueDateDraft);
            onClose();
          }}
          className="space-y-2.5"
        >
          <div className="flex flex-wrap gap-1.5">
            {TEAM_MEMBER_PRESETS.map((preset) => (
              <button
                key={preset.code}
                type="button"
                disabled={locked}
                onClick={() => setAssigneeDraft(preset.code)}
                className={`rounded border px-2 py-1 text-[10px] font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                  assigneeDraft.toUpperCase() === preset.code
                    ? 'border-emerald-500 bg-emerald-950/70 text-emerald-200'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] text-slate-400">
                Responsable / Initiales
              </label>
              <input
                type="text"
                disabled={locked}
                value={assigneeDraft}
                onChange={(e) => setAssigneeDraft(e.target.value)}
                placeholder="Ex: SEK ou Nom"
                className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] text-slate-400">
                <CalendarClock className="h-3 w-3" aria-hidden="true" />
                <span>Échéance</span>
              </label>
              <input
                type="date"
                disabled={locked}
                value={dueDateDraft}
                onChange={(e) => setDueDateDraft(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                const targets =
                  inspector.targetIds && inspector.targetIds.length > 0
                    ? inspector.targetIds
                    : [node.id];
                onAssignNodes(targets, '', '');
                onClose();
              }}
              className="rounded border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              Effacer l&apos;assignation
            </button>
            <button
              type="submit"
              disabled={locked}
              className="inline-flex items-center gap-1.5 rounded bg-emerald-700 px-3 py-1.5 font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Appliquer</span>
            </button>
          </div>
        </form>
      )}

      {/* Point 8 : Journal de traçabilité (Audit Trail) */}
      {inspector.mode === 'audit' && node && (
        <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
          {!node.auditTrail || node.auditTrail.length === 0 ? (
            <div className="rounded border border-dashed border-slate-800 py-3 text-center text-[11px] text-slate-500">
              Aucun événement enregistré sur cet élément depuis l&apos;ouverture de session.
            </div>
          ) : (
            node.auditTrail.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between gap-2 rounded border border-slate-800/80 bg-slate-900/70 px-2.5 py-1.5 text-[11px]"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-mono font-semibold text-blue-300">{entry.actor}</span>{' '}
                  <span className="font-medium text-slate-100">· {entry.action}</span>
                  {entry.detail && (
                    <span className="text-slate-400"> — {entry.detail}</span>
                  )}
                </div>
                <span className="shrink-0 font-mono text-[10px] text-slate-500">
                  {formatShortDate(entry.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Point 9 : Contrôle de complétude / Pré-clôture */}
      {inspector.mode === 'readiness' && readinessReport && (
        <div className="space-y-2.5">
          <div className="rounded border border-slate-800 bg-slate-900/80 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-slate-300">
                Périmètre : {readinessReport.scopeLabel}
              </span>
              <span className="font-mono text-xs font-semibold text-blue-300 tabular-nums">
                {readinessReport.stats.validated}/{readinessReport.stats.total} validés (
                {readinessReport.stats.percent}%)
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${readinessReport.stats.percent}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
              <span>
                À faire : {readinessReport.stats.todo} · En cours :{' '}
                {readinessReport.stats.inProgress} · En revue :{' '}
                {readinessReport.stats.inReview} · Validés : {readinessReport.stats.validated}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setReadinessFilter('all')}
                  className={`rounded px-1.5 py-0.5 cursor-pointer ${
                    readinessFilter === 'all'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tout ({readinessReport.findings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReadinessFilter('critical')}
                  className={`rounded px-1.5 py-0.5 cursor-pointer ${
                    readinessFilter === 'critical'
                      ? 'bg-red-900/70 text-red-200'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Critiques (
                  {readinessReport.findings.filter((f) => f.severity === 'critical').length})
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
            {readinessReport.findings.length === 0 ? (
              <div className="flex items-center justify-center gap-2 rounded border border-emerald-800/60 bg-emerald-950/30 py-3 text-xs font-medium text-emerald-300">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>Dossier complet et prêt pour clôture !</span>
              </div>
            ) : (
              readinessReport.findings
                .filter((f) => readinessFilter === 'all' || f.severity === 'critical')
                .slice(0, 60)
                .map((finding) => (
                  <button
                    key={finding.id}
                    type="button"
                    onClick={() => onJumpToNode(finding.nodeId)}
                    className="flex w-full items-start gap-2 rounded border border-slate-800/80 bg-slate-900/70 px-2.5 py-1.5 text-left hover:border-blue-600/60 hover:bg-slate-800/80 cursor-pointer"
                  >
                    <AlertTriangle
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                        finding.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-100">
                        {finding.nodeLabel}
                      </div>
                      <div className="text-[11px] text-slate-400">{finding.message}</div>
                    </div>
                  </button>
                ))
            )}
          </div>
        </div>
      )}

      {/* Point 25 : To-do liste & Suivi temps 08h/j ouvrable */}
      {inspector.mode === 'todo' && node && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">
              Calendrier horaire 08h/jour ouvrable · Pointage début / fin &amp; écart
            </span>
            {onOpenFullAuditPlan && (
              <button
                type="button"
                onClick={onOpenFullAuditPlan}
                className="inline-flex items-center gap-1 rounded border border-teal-700/70 bg-teal-950/60 px-2 py-1 text-[10px] font-medium text-teal-200 hover:bg-teal-900/70 cursor-pointer"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                <span>Ouvrir Gantt &amp; Pilotage</span>
              </button>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (locked || !todoTitleDraft.trim() || !onAddTodoTask) return;
              onAddTodoTask(node.id, {
                title: todoTitleDraft.trim(),
                auditor: todoAuditorDraft,
                plannedDate: snapToWorkingDay(todoDateDraft),
                plannedStartHour: todoStartHourDraft,
                plannedDurationHours: todoDurationDraft,
                crippNormRef: todoNormDraft,
                methodologyAssessment: 'conforme',
              });
              setTodoTitleDraft('');
            }}
            className="space-y-1.5 rounded border border-slate-800 bg-slate-900/70 p-2"
          >
            <input
              type="text"
              disabled={locked}
              value={todoTitleDraft}
              onChange={(e) => setTodoTitleDraft(e.target.value)}
              placeholder={
                locked
                  ? 'Élément verrouillé par code PIN'
                  : 'Nouvelle tâche To-do sur cette étape / ce document...'
              }
              className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-teal-500 focus:outline-none disabled:opacity-50"
            />
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <select
                disabled={locked}
                value={todoAuditorDraft}
                onChange={(e) => setTodoAuditorDraft(e.target.value)}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
              >
                {DEFAULT_AUDITOR_PROFILES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code}
                  </option>
                ))}
              </select>
              <input
                type="date"
                disabled={locked}
                value={todoDateDraft}
                onChange={(e) => setTodoDateDraft(snapToWorkingDay(e.target.value))}
                className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px] text-white"
              />
              <input
                type="number"
                disabled={locked}
                min={8}
                max={16}
                value={todoStartHourDraft}
                onChange={(e) => setTodoStartHourDraft(Number(e.target.value) || 8)}
                title="Heure début (8-16h)"
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  disabled={locked}
                  min={0.5}
                  max={40}
                  step={0.5}
                  value={todoDurationDraft}
                  onChange={(e) => setTodoDurationDraft(Number(e.target.value) || 2)}
                  title="Durée prévue (h)"
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
                />
                <span className="text-[10px] text-slate-400">h</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                disabled={locked}
                value={todoNormDraft}
                onChange={(e) => setTodoNormDraft(e.target.value)}
                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-200"
              >
                {CRIPP_STANDARDS.map((std) => (
                  <option key={std} value={std}>
                    {std}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={locked || !todoTitleDraft.trim()}
                className="shrink-0 rounded bg-teal-700 px-3 py-1 font-medium text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                Planifier
              </button>
            </div>
          </form>

          <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
            {!node.todoTasks || node.todoTasks.length === 0 ? (
              <div className="rounded border border-dashed border-slate-800 py-3 text-center text-[11px] text-slate-500">
                Aucune tâche To-do attachée à cet élément.
              </div>
            ) : (
              node.todoTasks.map((t) => (
                <div
                  key={t.id}
                  className="rounded border border-slate-800 bg-slate-900/80 px-2.5 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono font-semibold text-teal-300">
                          {t.auditor}
                        </span>
                        <span className="font-mono text-slate-400">
                          {t.plannedDate} · {t.plannedStartHour}h ({t.plannedDurationHours}h)
                        </span>
                        {t.varianceHours !== undefined && (
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono font-semibold ${
                              t.varianceHours > 0
                                ? 'bg-red-950/80 text-red-300'
                                : 'bg-emerald-950/80 text-emerald-300'
                            }`}
                          >
                            Écart : {t.varianceHours > 0 ? `+${t.varianceHours}h` : `${t.varianceHours}h`}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 font-medium text-slate-100">{t.title}</div>
                      {t.blockerReason && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-red-300">
                          <AlertOctagon className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>{t.blockerReason}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {onClockInTodoTask && (
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => onClockInTodoTask(node.id, t.id)}
                          title="Pointer début"
                          className="inline-flex items-center gap-0.5 rounded bg-sky-700 px-1.5 py-1 text-[10px] font-medium text-white hover:bg-sky-600 disabled:opacity-40 cursor-pointer"
                        >
                          <Play className="h-2.5 w-2.5" aria-hidden="true" />
                          <span>Début</span>
                        </button>
                      )}
                      {onClockOutTodoTask && (
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => onClockOutTodoTask(node.id, t.id)}
                          title="Pointer fin et calculer écart"
                          className="inline-flex items-center gap-0.5 rounded bg-emerald-700 px-1.5 py-1 text-[10px] font-medium text-white hover:bg-emerald-600 disabled:opacity-40 cursor-pointer"
                        >
                          <Square className="h-2.5 w-2.5" aria-hidden="true" />
                          <span>Fin</span>
                        </button>
                      )}
                      {onUpdateTodoTask && (
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() =>
                            onUpdateTodoTask(
                              node.id,
                              t.id,
                              {
                                status: t.status === 'blocked' ? 'in-progress' : 'blocked',
                                blockerReason:
                                  t.status === 'blocked'
                                    ? undefined
                                    : t.blockerReason || 'Point bloquant signalé pour support équipe',
                                teamSupportRequested: t.status !== 'blocked',
                              },
                              'Statut blocage mis à jour'
                            )
                          }
                          title={t.status === 'blocked' ? 'Lever blocage' : 'Signaler blocage'}
                          className={`rounded border px-1.5 py-1 text-[10px] cursor-pointer disabled:opacity-40 ${
                            t.status === 'blocked'
                              ? 'border-red-700 bg-red-950/60 text-red-200'
                              : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {t.status === 'blocked' ? 'Débloquer' : 'Bloqué'}
                        </button>
                      )}
                      {onDeleteTodoTask && (
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => onDeleteTodoTask(node.id, t.id)}
                          aria-label="Supprimer cette tâche"
                          className="rounded p-1 text-slate-400 hover:bg-red-950/50 hover:text-red-300 disabled:opacity-40 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
