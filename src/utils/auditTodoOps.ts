import {
  AuditPlanScheduleStatus,
  AuditPlanTaskUnit,
  AuditTrailEntry,
  MethodologyAssessment,
  MissionTodoTask,
  TodoTaskStatus,
  WorkflowTreeNode,
} from '../types/workflow';
import {
  findNodeById,
  isNodeLockedOrWithinLockedAncestor,
} from './workflowTreeOps';

export const WORKDAY_HOURS = 8;
export const WORKDAY_START_HOUR = 8;
export const WORKDAY_END_HOUR = 17;

export const CRIPP_STANDARDS: string[] = [
  'Norme 9.4 — Plan d’audit fondé sur les risques',
  'Norme 11.2 — Communication efficace',
  'Norme 12.1 — Programme d’assurance et d’amélioration qualité (PAQ)',
  'Norme 12.3 — Supervision des missions',
  'Norme 13.1 — Communication relative à la mission & planification',
  'Norme 13.2 — Évaluation des risques de la mission',
  'Norme 13.4 — Critères d’évaluation',
  'Norme 13.6 — Programme de travail',
  'Norme 14.1 — Collecte des informations & preuves d’audit',
  'Norme 14.3 — Évaluation des constats (FRAP 5C)',
  'Norme 14.6 — Documentation & archivage des dossiers',
  'Norme 15.1 — Communication des résultats finaux',
  'Norme 15.2 — Suivi des recommandations & plans d’action',
];

export interface AuditorProfile {
  code: string;
  name: string;
  role: string;
}

export const DEFAULT_AUDITOR_PROFILES: AuditorProfile[] = [
  { code: 'OHA', name: 'OHA · Auditeur Interne', role: 'Auditeur interne' },
  { code: 'SEK', name: 'SEK · Senior Audit', role: 'Auditeur Senior' },
  { code: 'JFK', name: 'JFK · Auditeur Confirmé', role: 'Auditeur Confirmé' },
  { code: 'TAK', name: 'TAK · Auditeur Junior', role: 'Auditeur Junior' },
  { code: 'MGR', name: 'MGR · Manager Revue', role: 'Chef de mission / Manager' },
];

export const DEFAULT_AUDITORS = DEFAULT_AUDITOR_PROFILES.map((p) => p.code);

let todoUidSeq = 1;
function nextTodoUid(prefix: string): string {
  todoUidSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${todoUidSeq}`;
}

function makeTodoAuditEntry(actor: string, action: string, detail?: string): AuditTrailEntry {
  return {
    id: nextTodoUid('aud'),
    timestamp: new Date().toISOString(),
    actor: (actor || 'OHA').toUpperCase().slice(0, 12),
    action,
    ...(detail ? { detail } : {}),
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((v) => Number.parseInt(v, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function isWorkingDay(dateStr: string): boolean {
  const d = parseLocalDate(dateStr);
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

export function snapToWorkingDay(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return formatIsoDateLocal(d);
}

export function addWorkingDays(startDateStr: string, workingDaysOffset: number): string {
  const d = parseLocalDate(snapToWorkingDay(startDateStr));
  if (workingDaysOffset === 0) return formatIsoDateLocal(d);
  const step = workingDaysOffset > 0 ? 1 : -1;
  let remaining = Math.abs(workingDaysOffset);
  while (remaining > 0) {
    d.setDate(d.getDate() + step);
    const day = d.getDay();
    if (day >= 1 && day <= 5) {
      remaining -= 1;
    }
  }
  return formatIsoDateLocal(d);
}

export function getMondayOfCurrentWeek(refDate = new Date()): string {
  const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 12, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return formatIsoDateLocal(d);
}

export function getWorkingDaysRange(startDateStr: string, count: number): string[] {
  const days: string[] = [];
  let cursor = snapToWorkingDay(startDateStr);
  for (let i = 0; i < count; i += 1) {
    days.push(cursor);
    cursor = addWorkingDays(cursor, 1);
  }
  return days;
}

export function computePlannedEndDate(
  startDateStr: string,
  plannedDurationHours: number
): { endDate: string; spanWorkingDays: number } {
  const safeHours = Math.max(0.5, plannedDurationHours || WORKDAY_HOURS);
  const spanWorkingDays = Math.max(1, Math.ceil(safeHours / WORKDAY_HOURS));
  const endDate = addWorkingDays(startDateStr, spanWorkingDays - 1);
  return { endDate, spanWorkingDays };
}

export function computeHoursBetween(startIso?: string, endIso?: string): number | undefined {
  if (!startIso || !endIso) return undefined;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return undefined;
  return round2((e - s) / 3_600_000);
}

export interface NewTodoTaskInput {
  title: string;
  auditor: string;
  plannedDate: string;
  plannedEndDate?: string;
  actualEndDate?: string;
  plannedStartHour: number;
  plannedDurationHours: number;
  unit?: AuditPlanTaskUnit;
  actualHours?: number;
  status?: TodoTaskStatus;
  crippNormRef?: string;
  methodologyAssessment?: MethodologyAssessment;
  blockerReason?: string;
  teamSupportRequested?: boolean;
}

function deriveTaskScheduleStatus(
  varianceHours?: number,
  plannedEndDate?: string,
  actualEndDate?: string
): AuditPlanScheduleStatus {
  if (varianceHours !== undefined && varianceHours > 0) return 'en-retard';
  if (varianceHours !== undefined && varianceHours < 0) return 'en-avance';
  if (plannedEndDate && actualEndDate) {
    if (actualEndDate > plannedEndDate) return 'en-retard';
    if (actualEndDate < plannedEndDate) return 'en-avance';
  }
  return 'normal';
}

function updateNodeInTrees(
  nodes: WorkflowTreeNode[],
  nodeId: string,
  updater: (node: WorkflowTreeNode) => WorkflowTreeNode
): WorkflowTreeNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return updater(node);
    }
    if (node.children?.length) {
      return {
        ...node,
        children: updateNodeInTrees(node.children, nodeId, updater),
      };
    }
    return node;
  });
}

export function addTodoTaskOnNode(
  trees: WorkflowTreeNode[],
  nodeId: string,
  input: NewTodoTaskInput,
  actor: string
): { trees: WorkflowTreeNode[]; createdTask?: MissionTodoTask; error?: string } {
  const target = findNodeById(trees, nodeId);
  if (!target) {
    return { trees, error: 'Élément cible introuvable.' };
  }
  if (isNodeLockedOrWithinLockedAncestor(trees, nodeId) || target.locked) {
    return { trees, error: 'Action bloquée : élément verrouillé par code PIN.' };
  }
  const cleanTitle = input.title.trim();
  if (!cleanTitle) {
    return { trees, error: 'Saisissez un intitulé de tâche.' };
  }

  const normalizedAuditor = (input.auditor || actor || 'OHA').trim().toUpperCase().slice(0, 8);
  const workingDate = snapToWorkingDay(input.plannedDate || getMondayOfCurrentWeek());
  const startHour = Math.min(WORKDAY_END_HOUR - 1, Math.max(WORKDAY_START_HOUR, Math.round(input.plannedStartHour || 8)));
  const duration = round2(Math.max(0.5, Number(input.plannedDurationHours) || 2));
  const computedPlannedEnd =
    input.plannedEndDate ? snapToWorkingDay(input.plannedEndDate) : computePlannedEndDate(workingDate, duration).endDate;
  const actualEnd = input.actualEndDate ? snapToWorkingDay(input.actualEndDate) : undefined;
  const actualHrs = input.actualHours !== undefined ? round2(Math.max(0, input.actualHours)) : undefined;
  const varianceHrs = actualHrs !== undefined ? round2(actualHrs - duration) : undefined;
  const schedStatus = deriveTaskScheduleStatus(varianceHrs, computedPlannedEnd, actualEnd);

  const newTask: MissionTodoTask = {
    id: nextTodoUid('todo'),
    nodeId,
    title: cleanTitle,
    auditor: normalizedAuditor,
    plannedDate: workingDate,
    plannedEndDate: computedPlannedEnd,
    actualEndDate: actualEnd,
    plannedStartHour: startHour,
    plannedDurationHours: duration,
    unit: input.unit || 'heure',
    actualHours: actualHrs,
    varianceHours: varianceHrs,
    scheduleStatus: schedStatus,
    status: input.status || (input.blockerReason?.trim() ? 'blocked' : 'todo'),
    blockerReason: input.blockerReason?.trim() || undefined,
    teamSupportRequested: Boolean(input.teamSupportRequested),
    crippNormRef: input.crippNormRef || CRIPP_STANDARDS[7],
    methodologyAssessment: input.methodologyAssessment || 'conforme',
    createdAt: new Date().toISOString(),
  };

  const nextTrees = updateNodeInTrees(trees, nodeId, (n) => ({
    ...n,
    todoTasks: [newTask, ...(n.todoTasks || [])],
    auditTrail: [
      makeTodoAuditEntry(actor, 'Tâche To-do planifiée', `${cleanTitle} (${duration}h · ${workingDate})`),
      ...(n.auditTrail || []),
    ].slice(0, 80),
  }));

  return { trees: nextTrees, createdTask: newTask };
}

export function updateTodoTaskOnNode(
  trees: WorkflowTreeNode[],
  nodeId: string,
  taskId: string,
  patch: Partial<MissionTodoTask>,
  actor: string,
  auditLabel = 'Tâche To-do mise à jour'
): { trees: WorkflowTreeNode[]; error?: string } {
  const target = findNodeById(trees, nodeId);
  if (!target) {
    return { trees, error: 'Élément cible introuvable.' };
  }
  if (isNodeLockedOrWithinLockedAncestor(trees, nodeId) || target.locked) {
    return { trees, error: 'Action bloquée : élément verrouillé par code PIN.' };
  }

  const existing = (target.todoTasks || []).find((t) => t.id === taskId);
  if (!existing) {
    return { trees, error: 'Tâche introuvable.' };
  }

  const nextPlannedDate = patch.plannedDate ? snapToWorkingDay(patch.plannedDate) : existing.plannedDate;
  const nextPlannedHours =
    patch.plannedDurationHours !== undefined
      ? round2(Math.max(0.5, patch.plannedDurationHours))
      : existing.plannedDurationHours;
  const nextPlannedEndDate =
    patch.plannedEndDate !== undefined
      ? patch.plannedEndDate
        ? snapToWorkingDay(patch.plannedEndDate)
        : undefined
      : existing.plannedEndDate;
  const nextActualEndDate =
    patch.actualEndDate !== undefined
      ? patch.actualEndDate
        ? snapToWorkingDay(patch.actualEndDate)
        : undefined
      : existing.actualEndDate;
  const nextStartIso = patch.actualStartAt !== undefined ? patch.actualStartAt : existing.actualStartAt;
  const nextEndIso = patch.actualEndAt !== undefined ? patch.actualEndAt : existing.actualEndAt;

  let nextActualHours = patch.actualHours !== undefined ? patch.actualHours : existing.actualHours;
  if (
    patch.actualHours === undefined &&
    (patch.actualStartAt !== undefined || patch.actualEndAt !== undefined)
  ) {
    const computed = computeHoursBetween(nextStartIso, nextEndIso);
    if (computed !== undefined) {
      nextActualHours = computed;
    }
  }

  const nextVarianceHours =
    nextActualHours !== undefined ? round2(nextActualHours - nextPlannedHours) : undefined;
  const nextScheduleStatus =
    patch.scheduleStatus ?? deriveTaskScheduleStatus(nextVarianceHours, nextPlannedEndDate, nextActualEndDate);

  const updatedTask: MissionTodoTask = {
    ...existing,
    ...patch,
    auditor: (patch.auditor ?? existing.auditor).trim().toUpperCase().slice(0, 8),
    plannedDate: nextPlannedDate,
    plannedEndDate: nextPlannedEndDate,
    actualEndDate: nextActualEndDate,
    plannedDurationHours: nextPlannedHours,
    actualStartAt: nextStartIso,
    actualEndAt: nextEndIso,
    actualHours: nextActualHours !== undefined ? round2(nextActualHours) : undefined,
    varianceHours: nextVarianceHours,
    scheduleStatus: nextScheduleStatus,
  };

  const nextTrees = updateNodeInTrees(trees, nodeId, (n) => ({
    ...n,
    todoTasks: (n.todoTasks || []).map((t) => (t.id === taskId ? updatedTask : t)),
    auditTrail: [
      makeTodoAuditEntry(actor, auditLabel, updatedTask.title),
      ...(n.auditTrail || []),
    ].slice(0, 80),
  }));

  return { trees: nextTrees };
}

export function deleteTodoTaskOnNode(
  trees: WorkflowTreeNode[],
  nodeId: string,
  taskId: string,
  actor: string
): { trees: WorkflowTreeNode[]; error?: string } {
  const target = findNodeById(trees, nodeId);
  if (!target) return { trees, error: 'Élément cible introuvable.' };
  if (isNodeLockedOrWithinLockedAncestor(trees, nodeId) || target.locked) {
    return { trees, error: 'Action bloquée : élément verrouillé par code PIN.' };
  }
  const removed = (target.todoTasks || []).find((t) => t.id === taskId);
  if (!removed) return { trees, error: 'Tâche introuvable.' };

  const nextTrees = updateNodeInTrees(trees, nodeId, (n) => ({
    ...n,
    todoTasks: (n.todoTasks || []).filter((t) => t.id !== taskId),
    auditTrail: [
      makeTodoAuditEntry(actor, 'Tâche To-do supprimée', removed.title),
      ...(n.auditTrail || []),
    ].slice(0, 80),
  }));

  return { trees: nextTrees };
}

export function clockInTodoTaskOnNode(
  trees: WorkflowTreeNode[],
  nodeId: string,
  taskId: string,
  actor: string,
  nowIso = new Date().toISOString()
): { trees: WorkflowTreeNode[]; error?: string } {
  const target = findNodeById(trees, nodeId);
  const existing = (target?.todoTasks || []).find((t) => t.id === taskId);
  if (!target || !existing) return { trees, error: 'Tâche introuvable.' };

  return updateTodoTaskOnNode(
    trees,
    nodeId,
    taskId,
    {
      actualStartAt: nowIso,
      actualEndAt: undefined,
      actualHours: undefined,
      varianceHours: undefined,
      status: 'in-progress',
    },
    actor,
    'Pointage début'
  );
}

export function clockOutTodoTaskOnNode(
  trees: WorkflowTreeNode[],
  nodeId: string,
  taskId: string,
  actor: string,
  nowIso = new Date().toISOString()
): { trees: WorkflowTreeNode[]; error?: string } {
  const target = findNodeById(trees, nodeId);
  const existing = (target?.todoTasks || []).find((t) => t.id === taskId);
  if (!target || !existing) return { trees, error: 'Tâche introuvable.' };

  const startIso = existing.actualStartAt || nowIso;
  const computedRaw = computeHoursBetween(startIso, nowIso) ?? 0;
  // Garantit au minimum 0.25h lors d'un pointage instantané en démonstration
  const effectiveActualHours = computedRaw < 0.25 ? 0.25 : computedRaw;

  return updateTodoTaskOnNode(
    trees,
    nodeId,
    taskId,
    {
      actualStartAt: startIso,
      actualEndAt: nowIso,
      actualHours: effectiveActualHours,
      status: 'done',
    },
    actor,
    'Pointage fin & calcul écart'
  );
}

export interface EnrichedTodoTask extends MissionTodoTask {
  nodeLabel: string;
  nodeType: WorkflowTreeNode['nodeType'];
  stageLabel: string;
  exerciceLabel: string;
  workflowLabel: string;
  isLocked: boolean;
  openReviewNotesOnNode: number;
  resolvedReviewNotesOnNode: number;
}

export function collectAllEnrichedTodoTasks(trees: WorkflowTreeNode[]): EnrichedTodoTask[] {
  const out: EnrichedTodoTask[] = [];
  const walk = (node: WorkflowTreeNode, ancestors: WorkflowTreeNode[], ancestorLocked: boolean) => {
    const locked = ancestorLocked || Boolean(node.locked);
    const chain = [...ancestors, node];
    if (node.todoTasks?.length) {
      const exerciceNode = chain.find((n) => n.nodeType === 'exercice');
      const natureNode = chain.find((n) => n.nodeType === 'nature');
      const stageNode =
        [...chain]
          .reverse()
          .find(
            (n) =>
              n.nodeType === 'section' ||
              n.nodeType === 'sous-section' ||
              n.nodeType === 'activite' ||
              n.nodeType === 'collection'
          ) ??
        natureNode ??
        node;

      const notes = node.reviewNotes || [];
      const openNotes = notes.filter((rn) => rn.status === 'open').length;
      const resolvedNotes = notes.filter((rn) => rn.status === 'resolved').length;

      for (const task of node.todoTasks) {
        out.push({
          ...task,
          nodeLabel: node.label,
          nodeType: node.nodeType,
          stageLabel: stageNode.label,
          exerciceLabel: exerciceNode?.label || 'Exercice 2026',
          workflowLabel: natureNode?.label || 'Mission Audit',
          isLocked: locked,
          openReviewNotesOnNode: openNotes,
          resolvedReviewNotesOnNode: resolvedNotes,
        });
      }
    }
    node.children?.forEach((c) => walk(c, chain, locked));
  };

  trees.forEach((root) => walk(root, [], Boolean(root.locked)));

  return out.sort((a, b) => {
    const d = a.plannedDate.localeCompare(b.plannedDate);
    if (d !== 0) return d;
    return a.plannedStartHour - b.plannedStartHour;
  });
}

export interface GanttBarItem {
  task: EnrichedTodoTask;
  startIndex: number;
  spanDays: number;
  endDate: string;
  isOverrun: boolean;
  dailyHours: number;
}

export interface GanttGroupRow {
  groupKey: string;
  groupLabel: string;
  totalPlannedHours: number;
  totalActualHours: number;
  totalVarianceHours: number;
  doneCount: number;
  blockedCount: number;
  bars: GanttBarItem[];
}

export function buildGanttSeries(
  tasks: EnrichedTodoTask[],
  groupBy: 'auditor' | 'stage' | 'global',
  workingDays: string[]
): GanttGroupRow[] {
  if (workingDays.length === 0) return [];
  const dayIndexMap = new Map<string, number>();
  workingDays.forEach((d, idx) => dayIndexMap.set(d, idx));

  const firstDay = workingDays[0];
  const lastDayIdx = workingDays.length - 1;

  const grouped = new Map<string, { label: string; tasks: EnrichedTodoTask[] }>();

  for (const t of tasks) {
    let key = 'GLOBAL';
    let label = 'Plan d’audit global — Tous intervenants & étapes (Base 08h / jour ouvrable)';
    if (groupBy === 'auditor') {
      key = t.auditor;
      const prof = DEFAULT_AUDITOR_PROFILES.find((p) => p.code === t.auditor);
      label = prof ? prof.name : `${t.auditor} · Intervenant`;
    } else if (groupBy === 'stage') {
      key = t.stageLabel;
      label = t.stageLabel;
    }

    if (!grouped.has(key)) {
      grouped.set(key, { label, tasks: [] });
    }
    grouped.get(key)!.tasks.push(t);
  }

  const rows: GanttGroupRow[] = [];
  grouped.forEach(({ label, tasks: groupTasks }, groupKey) => {
    let totalPlannedHours = 0;
    let totalActualHours = 0;
    let totalVarianceHours = 0;
    let doneCount = 0;
    let blockedCount = 0;

    const bars: GanttBarItem[] = [];
    for (const task of groupTasks) {
      totalPlannedHours += task.plannedDurationHours;
      if (task.actualHours !== undefined) {
        totalActualHours += task.actualHours;
      }
      if (task.varianceHours !== undefined) {
        totalVarianceHours += task.varianceHours;
      }
      if (task.status === 'done') doneCount += 1;
      if (task.status === 'blocked') blockedCount += 1;

      const { endDate, spanWorkingDays } = computePlannedEndDate(
        task.plannedDate,
        task.plannedDurationHours
      );

      let startIndex = dayIndexMap.get(task.plannedDate);
      if (startIndex === undefined) {
        if (task.plannedDate < firstDay) startIndex = 0;
        else if (task.plannedDate > workingDays[lastDayIdx]) continue;
        else startIndex = 0;
      }

      const clampedSpan = Math.max(1, Math.min(spanWorkingDays, workingDays.length - startIndex));
      bars.push({
        task,
        startIndex,
        spanDays: clampedSpan,
        endDate,
        isOverrun: (task.varianceHours ?? 0) > 0,
        dailyHours: round2(task.plannedDurationHours / spanWorkingDays),
      });
    }

    rows.push({
      groupKey,
      groupLabel: label,
      totalPlannedHours: round2(totalPlannedHours),
      totalActualHours: round2(totalActualHours),
      totalVarianceHours: round2(totalVarianceHours),
      doneCount,
      blockedCount,
      bars,
    });
  });

  return rows;
}

export interface ManagerPilotageSummary {
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  todoTasks: number;
  completionPercent: number;
  totalPlannedHours: number;
  totalActualHours: number;
  totalVarianceHours: number;
  overrunTasksCount: number;
  crippConformeCount: number;
  crippToJustifyCount: number;
  crippHorsPerimetreCount: number;
  crippComplianceRate: number;
  supportRequestedCount: number;
  availableCapacityHours: number;
  effectiveWorkloadHours: number;
  utilizationRate: number;
  capacityGapHours: number;
  recommendedAdditionalEtp: number;
  recruitmentJustification: string;
}

export function computeManagerPilotageSummary(
  tasks: EnrichedTodoTask[],
  activeAuditorsCount = 4,
  missionWorkingDays = 10
): ManagerPilotageSummary {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress').length;
  const blockedTasks = tasks.filter((t) => t.status === 'blocked').length;
  const todoTasks = tasks.filter((t) => t.status === 'todo').length;
  const completionPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const totalPlannedHours = round2(
    tasks.reduce((sum, t) => sum + t.plannedDurationHours, 0)
  );
  const completedWithActual = tasks.filter((t) => t.actualHours !== undefined);
  const totalActualHours = round2(
    completedWithActual.reduce((sum, t) => sum + (t.actualHours ?? 0), 0)
  );
  const completedPlanned = completedWithActual.reduce((sum, t) => sum + t.plannedDurationHours, 0);
  const totalVarianceHours = round2(
    completedWithActual.reduce((sum, t) => sum + (t.varianceHours ?? 0), 0)
  );
  const overrunTasksCount = tasks.filter((t) => (t.varianceHours ?? 0) > 0).length;

  const crippConformeCount = tasks.filter(
    (t) => (t.methodologyAssessment || 'pending') === 'conforme'
  ).length;
  const crippToJustifyCount = tasks.filter(
    (t) => t.methodologyAssessment === 'a-justifier'
  ).length;
  const crippHorsPerimetreCount = tasks.filter(
    (t) => t.methodologyAssessment === 'hors-perimetre'
  ).length;
  const assessedCount = crippConformeCount + crippToJustifyCount + crippHorsPerimetreCount;
  const crippComplianceRate =
    assessedCount > 0 ? Math.round((crippConformeCount / assessedCount) * 100) : 100;

  const supportRequestedCount = tasks.filter(
    (t) => t.teamSupportRequested || t.status === 'blocked'
  ).length;

  const safeAuditors = Math.max(1, activeAuditorsCount);
  const safeDays = Math.max(1, missionWorkingDays);
  const capacityPerEtpHours = safeDays * WORKDAY_HOURS;
  const availableCapacityHours = round2(safeAuditors * capacityPerEtpHours);

  const overrunFactor =
    completedPlanned > 0 ? Math.max(1, totalActualHours / completedPlanned) : 1;
  const remainingPlanned = Math.max(0, totalPlannedHours - completedPlanned);
  const effectiveWorkloadHours = round2(
    totalActualHours + remainingPlanned * overrunFactor
  );
  const utilizationRate =
    availableCapacityHours > 0
      ? Math.round((effectiveWorkloadHours / availableCapacityHours) * 100)
      : 0;
  const capacityGapHours = round2(Math.max(0, effectiveWorkloadHours - availableCapacityHours));
  const recommendedAdditionalEtp =
    capacityGapHours > 0 ? round2(capacityGapHours / capacityPerEtpHours) : 0;

  const recruitmentJustification =
    capacityGapHours > 0
      ? `Déficit de capacité de ${capacityGapHours}h sur un régime de ${WORKDAY_HOURS}h/jour ouvrable (${safeDays} j ouvrés), compte tenu d’un dépassement constaté de +${Math.max(0, totalVarianceHours)}h. Recrutement recommandé : +${recommendedAdditionalEtp} ETP auditeur(s) pour respecter le plan d’audit et les normes CRIPP.`
      : `La charge projetée (${effectiveWorkloadHours}h) reste couverte par la capacité actuelle (${availableCapacityHours}h sur base ${WORKDAY_HOURS}h/j × ${safeAuditors} auditeurs). Maintenir la veille sur ${overrunTasksCount} tâche(s) en dérive.`;

  return {
    totalTasks,
    doneTasks,
    inProgressTasks,
    blockedTasks,
    todoTasks,
    completionPercent,
    totalPlannedHours,
    totalActualHours,
    totalVarianceHours,
    overrunTasksCount,
    crippConformeCount,
    crippToJustifyCount,
    crippHorsPerimetreCount,
    crippComplianceRate,
    supportRequestedCount,
    availableCapacityHours,
    effectiveWorkloadHours,
    utilizationRate,
    capacityGapHours,
    recommendedAdditionalEtp,
    recruitmentJustification,
  };
}

export interface AuditorPerformanceDashboard {
  auditor: string;
  displayName: string;
  role: string;
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  plannedHours: number;
  actualHours: number;
  varianceHours: number;
  overrunCount: number;
  efficiencyRate: number;
  crippConformityRate: number;
  openReviewNotes: number;
  resolvedReviewNotes: number;
  totalReviewNotes: number;
  annualScore: number;
  ratingLabel:
    | 'Exceptionnel'
    | 'Très satisfaisant'
    | 'Conforme aux attentes'
    | 'Plan de progrès requis';
  trainingRecommendations: string[];
  teamBuildingFocus: string;
}

export function buildAuditorPerformanceDashboards(
  trees: WorkflowTreeNode[],
  tasks: EnrichedTodoTask[]
): AuditorPerformanceDashboard[] {
  const reviewCountsByAuditor = new Map<string, { open: number; resolved: number }>();

  const ensureReviewBucket = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return null;
    if (!reviewCountsByAuditor.has(clean)) {
      reviewCountsByAuditor.set(clean, { open: 0, resolved: 0 });
    }
    return reviewCountsByAuditor.get(clean)!;
  };

  DEFAULT_AUDITORS.forEach((c) => ensureReviewBucket(c));

  const walkReviews = (nodes: WorkflowTreeNode[]) => {
    for (const node of nodes) {
      if (node.nodeType !== 'root' && node.reviewNotes?.length) {
        const owners = new Set<string>();
        if (node.assignee) owners.add(node.assignee.trim().toUpperCase());
        if (node.owner) owners.add(node.owner.trim().toUpperCase());
        if (node.signature) owners.add(node.signature.trim().toUpperCase());
        if (node.todoTasks?.length) {
          node.todoTasks.forEach((t) => owners.add(t.auditor.trim().toUpperCase()));
        }
        if (owners.size === 0) owners.add('OHA');

        for (const rn of node.reviewNotes) {
          owners.forEach((ownerCode) => {
            const bucket = ensureReviewBucket(ownerCode);
            if (!bucket) return;
            if (rn.status === 'open') bucket.open += 1;
            else bucket.resolved += 1;
          });
        }
      }
      if (node.children?.length) walkReviews(node.children);
    }
  };
  walkReviews(trees);

  const auditorCodes = new Set<string>(DEFAULT_AUDITORS);
  tasks.forEach((t) => auditorCodes.add(t.auditor.toUpperCase()));

  const dashboards: AuditorPerformanceDashboard[] = [];

  auditorCodes.forEach((code) => {
    const profile = DEFAULT_AUDITOR_PROFILES.find((p) => p.code === code);
    const auditorTasks = tasks.filter((t) => t.auditor.toUpperCase() === code);
    const totalTasks = auditorTasks.length;
    const doneTasks = auditorTasks.filter((t) => t.status === 'done').length;
    const inProgressTasks = auditorTasks.filter((t) => t.status === 'in-progress').length;
    const blockedTasks = auditorTasks.filter((t) => t.status === 'blocked').length;

    const plannedHours = round2(
      auditorTasks.reduce((sum, t) => sum + t.plannedDurationHours, 0)
    );
    const withActual = auditorTasks.filter((t) => t.actualHours !== undefined);
    const actualHours = round2(withActual.reduce((sum, t) => sum + (t.actualHours ?? 0), 0));
    const completedPlanned = withActual.reduce((sum, t) => sum + t.plannedDurationHours, 0);
    const varianceHours = round2(withActual.reduce((sum, t) => sum + (t.varianceHours ?? 0), 0));
    const overrunCount = auditorTasks.filter((t) => (t.varianceHours ?? 0) > 0).length;

    const efficiencyRate =
      actualHours > 0
        ? Math.min(130, Math.round((completedPlanned / actualHours) * 100))
        : 100;

    const conformeCount = auditorTasks.filter(
      (t) => (t.methodologyAssessment || 'pending') === 'conforme'
    ).length;
    const assessed = auditorTasks.filter(
      (t) => t.methodologyAssessment && t.methodologyAssessment !== 'pending'
    ).length;
    const crippConformityRate =
      assessed > 0 ? Math.round((conformeCount / assessed) * 100) : 100;

    const revBucket = reviewCountsByAuditor.get(code) || { open: 0, resolved: 0 };
    const totalReviewNotes = revBucket.open + revBucket.resolved;

    // Score annuel /100 intégrant productivité, respect des 8h/j (écarts), CRIPP et points de revue
    let score = 82;
    if (totalTasks > 0) {
      const completionRatio = doneTasks / totalTasks;
      score += Math.round(completionRatio * 14);
    }
    if (varianceHours > 0) {
      score -= Math.min(18, Math.round(varianceHours * 2.5));
    } else if (varianceHours < 0) {
      score += Math.min(6, Math.round(Math.abs(varianceHours)));
    }
    score -= Math.min(18, revBucket.open * 6);
    score += Math.min(6, revBucket.resolved * 2);
    score -= Math.min(12, blockedTasks * 4);
    if (crippConformityRate < 100) {
      score -= Math.round((100 - crippConformityRate) * 0.2);
    }
    const annualScore = Math.max(35, Math.min(99, score));

    const ratingLabel: AuditorPerformanceDashboard['ratingLabel'] =
      annualScore >= 90
        ? 'Exceptionnel'
        : annualScore >= 78
        ? 'Très satisfaisant'
        : annualScore >= 65
        ? 'Conforme aux attentes'
        : 'Plan de progrès requis';

    const trainingRecommendations: string[] = [];
    if (revBucket.open > 0) {
      trainingRecommendations.push(
        `Atelier qualité documentation & levée des points de revue (${revBucket.open} note(s) ouverte(s))`
      );
    }
    if (varianceHours > 1 || overrunCount > 0) {
      trainingRecommendations.push(
        'Optimisation du séquencement des tests & gestion du budget temps (08h/jour ouvrable)'
      );
    }
    if (crippConformityRate < 95) {
      trainingRecommendations.push(
        'Recyclage Normes CRIPP 2024 (Domaine IV — Conduite des missions 13.6 & 14.3)'
      );
    }
    if (blockedTasks > 0) {
      trainingRecommendations.push(
        'Techniques d’entretien d’audit, relance audités et escalade des blocages'
      );
    }
    if (trainingRecommendations.length === 0) {
      trainingRecommendations.push(
        'Préparation certification CIA / Supervision avancée CAATs & Data Analytics'
      );
    }

    const teamBuildingFocus =
      blockedTasks > 0 || revBucket.open >= 2
        ? 'Session hebdomadaire de déblocage binôme Senior/Auditeur & partage d’expériences terrain.'
        : varianceHours > 2
        ? 'Revue de charge en point équipe (daily stand-up 15 min) pour rééquilibrer les tâches.'
        : 'Mentorat croisé : partage des bonnes pratiques de papier de travail avec l’équipe.';

    dashboards.push({
      auditor: code,
      displayName: profile ? profile.name : `${code} · Auditeur`,
      role: profile ? profile.role : 'Auditeur',
      totalTasks,
      doneTasks,
      inProgressTasks,
      blockedTasks,
      plannedHours,
      actualHours,
      varianceHours,
      overrunCount,
      efficiencyRate,
      crippConformityRate,
      openReviewNotes: revBucket.open,
      resolvedReviewNotes: revBucket.resolved,
      totalReviewNotes,
      annualScore,
      ratingLabel,
      trainingRecommendations,
      teamBuildingFocus,
    });
  });

  return dashboards.sort((a, b) => b.totalTasks - a.totalTasks || b.annualScore - a.annualScore);
}

export function attachStarterTodoTasks(trees: WorkflowTreeNode[]): WorkflowTreeNode[] {
  const monday = getMondayOfCurrentWeek();
  const days = getWorkingDaysRange(monday, 10);
  const d0 = days[0];
  const d1 = days[1];
  const d2 = days[2];
  const d3 = days[3];
  const d4 = days[4];
  const d5 = days[5];
  const d6 = days[6];

  const seeds: Record<
    string,
    {
      todoTasks: MissionTodoTask[];
      reviewNotes?: { text: string; status: 'open' | 'resolved'; author: string }[];
      status?: WorkflowTreeNode['status'];
      assignee?: string;
    }
  > = {
    'user-ea26-lm': {
      status: 'validated',
      assignee: 'SEK',
      todoTasks: [
        {
          id: 'seed-todo-1',
          nodeId: 'user-ea26-lm',
          title: 'Cadrage périmètre & signature lettre de mission Trésorerie',
          auditor: 'SEK',
          plannedDate: d0,
          plannedStartHour: 8,
          plannedDurationHours: 4,
          actualStartAt: `${d0}T08:00:00`,
          actualEndAt: `${d0}T11:30:00`,
          actualHours: 3.5,
          varianceHours: -0.5,
          status: 'done',
          crippNormRef: CRIPP_STANDARDS[4],
          methodologyAssessment: 'conforme',
          createdAt: `${d0}T08:00:00`,
        },
      ],
      reviewNotes: [
        {
          author: 'MGR',
          text: 'Mandat validé et aligné avec la charte d’audit interne.',
          status: 'resolved',
        },
      ],
    },
    'user-ea26-a29': {
      status: 'in-progress',
      assignee: 'OHA',
      todoTasks: [
        {
          id: 'seed-todo-2',
          nodeId: 'user-ea26-a29',
          title: 'Contrôle inopiné de caisse agence principale & rapprochement brouillard',
          auditor: 'OHA',
          plannedDate: d0,
          plannedStartHour: 13,
          plannedDurationHours: 4,
          actualStartAt: `${d0}T13:00:00`,
          actualEndAt: `${d0}T18:30:00`,
          actualHours: 5.5,
          varianceHours: 1.5,
          status: 'done',
          crippNormRef: CRIPP_STANDARDS[8],
          methodologyAssessment: 'conforme',
          managerRedirectNote: 'Écart +1.5h dû à la justification d’un billet abîmé en coffre.',
          createdAt: `${d0}T12:45:00`,
        },
        {
          id: 'seed-todo-3',
          nodeId: 'user-ea26-a29',
          title: 'Revue analytique écarts d’encaisse T1 & formalisation FRAP',
          auditor: 'OHA',
          plannedDate: d2,
          plannedStartHour: 8,
          plannedDurationHours: 6,
          actualStartAt: `${d2}T08:15:00`,
          status: 'in-progress',
          crippNormRef: CRIPP_STANDARDS[9],
          methodologyAssessment: 'conforme',
          createdAt: `${d2}T08:00:00`,
        },
      ],
      reviewNotes: [
        {
          author: 'MGR',
          text: 'Joindre le PV signé du caissier principal en annexe de la feuille de couverture.',
          status: 'open',
        },
      ],
    },
    'user-ea26-fc': {
      status: 'in-review',
      assignee: 'JFK',
      todoTasks: [
        {
          id: 'seed-todo-4',
          nodeId: 'user-ea26-fc',
          title: 'Circularisation & apurement des suspens bancaires > 30 jours',
          auditor: 'JFK',
          plannedDate: d1,
          plannedStartHour: 8,
          plannedDurationHours: 8,
          actualStartAt: `${d1}T08:00:00`,
          actualEndAt: `${d1}T18:30:00`,
          actualHours: 10.5,
          varianceHours: 2.5,
          status: 'done',
          crippNormRef: CRIPP_STANDARDS[8],
          methodologyAssessment: 'a-justifier',
          managerRedirectNote: 'Dépassement +2.5h à réorienter sur automatisation extraction.',
          createdAt: `${d1}T08:00:00`,
        },
      ],
      reviewNotes: [
        {
          author: 'MGR',
          text: 'Revoir l’échantillonnage des suspens BCEAO et référencer la norme 14.1.',
          status: 'open',
        },
        {
          author: 'SEK',
          text: 'Cross-référence ajoutée vers le relevé mensuel.',
          status: 'resolved',
        },
      ],
    },
    'user-ea26-v-risk': {
      status: 'in-progress',
      assignee: 'TAK',
      todoTasks: [
        {
          id: 'seed-todo-5',
          nodeId: 'user-ea26-v-risk',
          title: 'Entretiens processus Facturation & mise à jour matrice des risques Ventes',
          auditor: 'TAK',
          plannedDate: d1,
          plannedStartHour: 8,
          plannedDurationHours: 6,
          status: 'blocked',
          blockerReason: 'En attente de l’export grand-livre auxiliaire clients par la DSI.',
          teamSupportRequested: true,
          crippNormRef: CRIPP_STANDARDS[5],
          methodologyAssessment: 'conforme',
          createdAt: `${d1}T08:00:00`,
        },
      ],
      reviewNotes: [
        {
          author: 'MGR',
          text: 'Documenter l’impact du délai DSI et préparer un test de cheminement alternatif.',
          status: 'open',
        },
      ],
    },
    'user-ea26-v-test': {
      status: 'todo',
      assignee: 'JFK',
      todoTasks: [
        {
          id: 'seed-todo-6',
          nodeId: 'user-ea26-v-test',
          title: 'Tests de cut-off factures de fin de période (30 dernières livraisons)',
          auditor: 'JFK',
          plannedDate: d3,
          plannedStartHour: 8,
          plannedDurationHours: 12,
          status: 'todo',
          crippNormRef: CRIPP_STANDARDS[7],
          methodologyAssessment: 'conforme',
          createdAt: `${d3}T08:00:00`,
        },
      ],
    },
    'user-ea26-f-caat': {
      status: 'in-progress',
      assignee: 'SEK',
      todoTasks: [
        {
          id: 'seed-todo-7',
          nodeId: 'user-ea26-f-caat',
          title: 'Scripts CAATs détection paiements fractionnés & doublons fournisseurs',
          auditor: 'SEK',
          plannedDate: d2,
          plannedStartHour: 8,
          plannedDurationHours: 16,
          actualStartAt: `${d2}T08:00:00`,
          status: 'in-progress',
          crippNormRef: CRIPP_STANDARDS[8],
          methodologyAssessment: 'conforme',
          createdAt: `${d2}T08:00:00`,
        },
      ],
    },
    'user-ea26-f-alerte': {
      status: 'todo',
      assignee: 'OHA',
      todoTasks: [
        {
          id: 'seed-todo-8',
          nodeId: 'user-ea26-f-alerte',
          title: 'Analyse signaux d’alerte & synthèse comité d’audit (revue manager)',
          auditor: 'MGR',
          plannedDate: d4,
          plannedStartHour: 8,
          plannedDurationHours: 8,
          status: 'todo',
          crippNormRef: CRIPP_STANDARDS[3],
          methodologyAssessment: 'conforme',
          createdAt: `${d4}T08:00:00`,
        },
        {
          id: 'seed-todo-9',
          nodeId: 'user-ea26-f-alerte',
          title: 'Rédaction projet de rapport contradictoire & suivi plans d’action',
          auditor: 'SEK',
          plannedDate: d5,
          plannedStartHour: 8,
          plannedDurationHours: 12,
          status: 'todo',
          crippNormRef: CRIPP_STANDARDS[11],
          methodologyAssessment: 'conforme',
          createdAt: `${d5}T08:00:00`,
        },
      ],
    },
    'user-dm26-rev': {
      status: 'in-review',
      assignee: 'MGR',
      todoTasks: [
        {
          id: 'seed-todo-10',
          nodeId: 'user-dm26-rev',
          title: 'Supervision qualité des papiers de travail & levée des points de revue',
          auditor: 'MGR',
          plannedDate: d6,
          plannedStartHour: 8,
          plannedDurationHours: 6,
          status: 'todo',
          crippNormRef: CRIPP_STANDARDS[2],
          methodologyAssessment: 'conforme',
          createdAt: `${d6}T08:00:00`,
        },
      ],
    },
  };

  const applySeeds = (nodes: WorkflowTreeNode[]): WorkflowTreeNode[] =>
    nodes.map((node) => {
      const seed = seeds[node.id];
      const nextChildren = node.children ? applySeeds(node.children) : undefined;
      if (!seed && !nextChildren) return node;
      return {
        ...node,
        ...(seed
          ? {
              todoTasks: seed.todoTasks,
              status: seed.status ?? node.status,
              assignee: seed.assignee ?? node.assignee,
              reviewNotes: seed.reviewNotes
                ? seed.reviewNotes.map((rn, idx) => ({
                    id: `seed-rn-${node.id}-${idx}`,
                    author: rn.author,
                    text: rn.text,
                    createdAt: `${d0}T10:00:00`,
                    status: rn.status,
                    resolvedAt: rn.status === 'resolved' ? `${d1}T16:00:00` : undefined,
                  }))
                : node.reviewNotes,
            }
          : {}),
        ...(nextChildren ? { children: nextChildren } : {}),
      };
    });

  return applySeeds(trees);
}
