import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  FolderLock,
  Layers,
  ListTree,
  Lock,
  MessageSquareWarning,
  ShieldAlert,
  X,
} from 'lucide-react';
import { WorkflowTreeNode } from '../types/workflow';

interface AuditStatsDashboardProps {
  trees: WorkflowTreeNode[];
  wordBodies: Record<string, string>;
  onClose: () => void;
  onJumpToNode: (nodeId: string) => void;
}

export const AuditStatsDashboard: React.FC<AuditStatsDashboardProps> = ({
  trees,
  wordBodies,
  onClose,
  onJumpToNode,
}) => {
  const [scopeId, setScopeId] = useState<string>('all');

  const scopeNode = useMemo(() => {
    if (scopeId === 'all') return null;
    const find = (list: WorkflowTreeNode[]): WorkflowTreeNode | null => {
      for (const n of list) {
        if (n.id === scopeId) return n;
        if (n.children?.length) {
          const f = find(n.children);
          if (f) return f;
        }
      }
      return null;
    };
    return find(trees);
  }, [trees, scopeId]);

  const targetNodesList = useMemo(() => {
    const list: WorkflowTreeNode[] = [];
    const walk = (nodes: WorkflowTreeNode[]) => {
      for (const n of nodes) {
        if (n.nodeType !== 'root') list.push(n);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(scopeNode ? [scopeNode] : trees);
    return list;
  }, [trees, scopeNode]);

  const stats = useMemo(() => {
    let totalDocs = 0;
    let validated = 0;
    let inReview = 0;
    let inProgress = 0;
    let todo = 0;

    let lockedCount = 0;
    let openNotesCount = 0;
    let resolvedNotesCount = 0;
    let unreviewedCount = 0;
    let unsignedCount = 0;
    let emptyDocsCount = 0;
    let overdueCount = 0;

    const todayIso = new Date().toISOString().slice(0, 10);

    for (const n of targetNodesList) {
      if (n.locked) lockedCount += 1;
      if (n.assignee || n.dueDate) {
        if (n.dueDate && n.dueDate < todayIso && n.status !== 'validated') {
          overdueCount += 1;
        }
      }

      if (n.reviewNotes && n.reviewNotes.length > 0) {
        for (const rn of n.reviewNotes) {
          if (rn.status === 'open') openNotesCount += 1;
          else resolvedNotesCount += 1;
        }
      }

      if (n.nodeType === 'document') {
        totalDocs += 1;
        const st = n.status || 'todo';
        if (st === 'validated') validated += 1;
        else if (st === 'in-review') inReview += 1;
        else if (st === 'in-progress') inProgress += 1;
        else todo += 1;

        if (!n.managerReviewed) unreviewedCount += 1;
        if (!n.signature && !n.owner) unsignedCount += 1;
        const body = wordBodies[n.id];
        if (!body || body.trim().length === 0) emptyDocsCount += 1;
      }
    }

    const percent = totalDocs > 0 ? Math.round((validated / totalDocs) * 100) : 0;

    return {
      totalDocs,
      validated,
      inReview,
      inProgress,
      todo,
      percent,
      lockedCount,
      openNotesCount,
      resolvedNotesCount,
      unreviewedCount,
      unsignedCount,
      emptyDocsCount,
      overdueCount,
    };
  }, [targetNodesList, wordBodies]);

  const scopeOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [{ id: 'all', label: 'Vue globale (Tous les workflows)' }];
    const walk = (nodes: WorkflowTreeNode[], depth = 0) => {
      for (const n of nodes) {
        if (
          n.nodeType === 'nature' ||
          n.nodeType === 'exercice' ||
          n.nodeType === 'section' ||
          n.nodeType === 'collection' ||
          n.nodeType === 'root'
        ) {
          opts.push({
            id: n.id,
            label: `${'— '.repeat(depth)}${n.label} (${n.nodeType})`,
          });
          if (n.children?.length) walk(n.children, depth + 1);
        }
      }
    };
    walk(trees);
    return opts;
  }, [trees]);

  // Gantt breakdown by workflow / section
  const ganttRows = useMemo(() => {
    const roots = scopeNode ? [scopeNode] : trees;
    const rows: { id: string; label: string; total: number; validated: number; percent: number; node: WorkflowTreeNode }[] = [];

    for (const root of roots) {
      if (!root.children) continue;
      const subItems = root.nodeType === 'root' ? root.children : [root];
      for (const sub of subItems) {
        let subTotal = 0;
        let subVal = 0;
        const countWalk = (n: WorkflowTreeNode) => {
          if (n.nodeType === 'document') {
            subTotal += 1;
            if (n.status === 'validated') subVal += 1;
          }
          n.children?.forEach(countWalk);
        };
        countWalk(sub);
        if (subTotal > 0 || sub.children?.length) {
          rows.push({
            id: sub.id,
            label: sub.label,
            total: subTotal,
            validated: subVal,
            percent: subTotal > 0 ? Math.round((subVal / subTotal) * 100) : 0,
            node: sub,
          });
        }
      }
    }
    return rows;
  }, [trees, scopeNode]);

  return (
    <div className="border-b border-slate-700/80 bg-slate-950/95 px-5 py-4 text-xs text-slate-100 shadow-lg">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-400" aria-hidden="true" />
          <h3 className="font-display font-semibold text-white">
            Tableau de bord &amp; Gantt d&apos;avancement des travaux
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
          >
            {scopeOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le tableau de bord"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <FileText className="h-3.5 w-3.5 text-blue-400" />
            <span>Documents</span>
          </div>
          <div className="mt-1 font-mono text-base font-bold text-white tabular-nums">
            {stats.validated} / {stats.totalDocs}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">{stats.percent}% validés</div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <MessageSquareWarning className="h-3.5 w-3.5 text-amber-400" />
            <span>Notes de revue</span>
          </div>
          <div className="mt-1 font-mono text-base font-bold text-amber-400 tabular-nums">
            {stats.openNotesCount}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {stats.resolvedNotesCount} levées
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Lock className="h-3.5 w-3.5 text-amber-300" />
            <span>Éléments verrouillés</span>
          </div>
          <div className="mt-1 font-mono text-base font-bold text-amber-300 tabular-nums">
            {stats.lockedCount}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">protégés par PIN</div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Clock className="h-3.5 w-3.5 text-red-400" />
            <span>Échéances échues</span>
          </div>
          <div className="mt-1 font-mono text-base font-bold text-red-400 tabular-nums">
            {stats.overdueCount}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">en retard</div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
            <span>Sans revue manager</span>
          </div>
          <div className="mt-1 font-mono text-base font-bold text-amber-400 tabular-nums">
            {stats.unreviewedCount}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">documents</div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <AlertCircle className="h-3.5 w-3.5 text-sky-400" />
            <span>Contenus vierges</span>
          </div>
          <div className="mt-1 font-mono text-base font-bold text-sky-400 tabular-nums">
            {stats.emptyDocsCount}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">Word vides</div>
        </div>
      </div>

      {/* Progress Bar globale */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
          <span className="font-medium">Répartition des statuts de mission</span>
          <span className="font-mono tabular-nums">
            {stats.todo} à faire · {stats.inProgress} en cours · {stats.inReview} en revue ·{' '}
            {stats.validated} validés
          </span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${stats.totalDocs ? (stats.validated / stats.totalDocs) * 100 : 0}%` }}
            title="Validés"
          />
          <div
            className="bg-amber-500 transition-all"
            style={{ width: `${stats.totalDocs ? (stats.inReview / stats.totalDocs) * 100 : 0}%` }}
            title="En revue"
          />
          <div
            className="bg-sky-500 transition-all"
            style={{ width: `${stats.totalDocs ? (stats.inProgress / stats.totalDocs) * 100 : 0}%` }}
            title="En cours"
          />
          <div
            className="bg-slate-600 transition-all"
            style={{ width: `${stats.totalDocs ? (stats.todo / stats.totalDocs) * 100 : 0}%` }}
            title="À faire"
          />
        </div>
      </div>

      {/* Gantt / Avancement par section/workflow */}
      {ganttRows.length > 0 && (
        <div className="mt-3.5">
          <div className="mb-1.5 text-[11px] font-medium text-slate-300">
            Gantt d&apos;avancement par branche
          </div>
          <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
            {ganttRows.map((row) => (
              <div
                key={row.id}
                onClick={() => onJumpToNode(row.id)}
                className="group flex cursor-pointer items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 hover:border-blue-600/60 hover:bg-slate-800/80"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate font-medium text-slate-200 group-hover:text-white">
                      {row.label}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400 tabular-nums">
                      {row.validated}/{row.total} ({row.percent}%)
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
