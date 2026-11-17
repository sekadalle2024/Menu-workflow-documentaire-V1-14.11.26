import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  Award,
  BookOpen,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Clock,
  Compass,
  GanttChart,
  GraduationCap,
  Handshake,
  ListTodo,
  Lock,
  MessageSquareWarning,
  Play,
  Plus,
  ShieldCheck,
  Square,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  AuditPlanMissionMeta,
  MethodologyAssessment,
  MissionTodoTask,
  TodoTaskStatus,
  WorkflowTreeNode,
} from '../types/workflow';
import { AuditPlanWorkflowPanel } from './AuditPlanWorkflowPanel';
import {
  buildAuditorPerformanceDashboards,
  buildGanttSeries,
  collectAllEnrichedTodoTasks,
  computeManagerPilotageSummary,
  computePlannedEndDate,
  CRIPP_STANDARDS,
  DEFAULT_AUDITOR_PROFILES,
  DEFAULT_AUDITORS,
  getMondayOfCurrentWeek,
  getWorkingDaysRange,
  NewTodoTaskInput,
  round2,
  snapToWorkingDay,
  WORKDAY_HOURS,
} from '../utils/auditTodoOps';
import { collectAllNodesList } from '../utils/workflowTreeOps';

interface AuditPlanExecutionViewProps {
  trees: WorkflowTreeNode[];
  userSignature: string;
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
  onInjectPlanMissions?: (targetNodeId: string, count: number) => void;
  onUpdatePlanStepDates?: (
    stepNodeId: string,
    dateDebut: string,
    dateFin: string,
    dateFinReelle?: string
  ) => void;
  onUpdatePlanMissionMeta?: (
    missionNodeId: string,
    patch: Partial<AuditPlanMissionMeta> & { titre?: string }
  ) => void;
  onOpenNodeInWorkflow: (nodeId: string) => void;
}

type PlanSubTab = 'plan-annuel' | 'calendrier' | 'gantt' | 'manager' | 'evaluation';
type GanttGroupMode = 'auditor' | 'stage' | 'global';

const STATUS_META: Record<
  TodoTaskStatus,
  { label: string; badgeClass: string; barClass: string }
> = {
  todo: {
    label: 'À faire',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
    barClass: 'bg-slate-600 text-white',
  },
  'in-progress': {
    label: 'En cours',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-800',
    barClass: 'bg-sky-600 text-white',
  },
  blocked: {
    label: 'Bloqué',
    badgeClass: 'border-red-200 bg-red-50 text-red-800',
    barClass: 'bg-red-600 text-white',
  },
  done: {
    label: 'Terminé',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    barClass: 'bg-emerald-600 text-white',
  },
};

const METHODOLOGY_META: Record<
  MethodologyAssessment,
  { label: string; badgeClass: string }
> = {
  pending: {
    label: 'À évaluer',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
  },
  conforme: {
    label: 'Conforme CRIPP',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  'a-justifier': {
    label: 'À justifier',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  'hors-perimetre': {
    label: 'Hors périmètre',
    badgeClass: 'border-red-200 bg-red-50 text-red-800',
  },
};

function toLocalDateTimeInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function formatDayShort(dateStr: string): { dow: string; dm: string } {
  const [y, m, d] = dateStr.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
  const dows = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  return {
    dow: dows[dt.getDay()] || 'Jour',
    dm: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
  };
}

function formatVarianceBadge(varianceHours?: number): {
  text: string;
  className: string;
} {
  if (varianceHours === undefined) {
    return {
      text: 'En attente pointage',
      className: 'border-slate-200 bg-slate-50 text-slate-500',
    };
  }
  if (varianceHours > 0) {
    return {
      text: `+${varianceHours}h (Dépassement)`,
      className: 'border-red-200 bg-red-50 text-red-700',
    };
  }
  if (varianceHours < 0) {
    return {
      text: `${varianceHours}h (Avance)`,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }
  return {
    text: '0h (Dans les temps)',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  };
}

export const AuditPlanExecutionView: React.FC<AuditPlanExecutionViewProps> = ({
  trees,
  userSignature,
  onAddTodoTask,
  onUpdateTodoTask,
  onDeleteTodoTask,
  onClockInTodoTask,
  onClockOutTodoTask,
  onInjectPlanMissions,
  onUpdatePlanStepDates,
  onUpdatePlanMissionMeta,
  onOpenNodeInWorkflow,
}) => {
  const [subTab, setSubTab] = useState<PlanSubTab>('plan-annuel');
  const [ganttMode, setGanttMode] = useState<GanttGroupMode>('auditor');
  const [ganttHorizonDays, setGanttHorizonDays] = useState<number>(10);
  const [calendarStartDate, setCalendarStartDate] = useState<string>(() =>
    getMondayOfCurrentWeek()
  );

  // Filtres transverses
  const [filterAuditor, setFilterAuditor] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterStage, setFilterStage] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Paramètres simulateur budget recrutement
  const [activeAuditorsCount, setActiveAuditorsCount] = useState<number>(4);
  const [missionWorkingDays, setMissionWorkingDays] = useState<number>(10);

  // Formulaire nouvelle tâche
  const assignableNodes = useMemo(
    () =>
      collectAllNodesList(trees).filter(
        (n) =>
          n.nodeType !== 'root' &&
          (n.id.startsWith('user-') || n.id.startsWith('node-'))
      ),
    [trees]
  );

  const [newTaskNodeId, setNewTaskNodeId] = useState<string>(
    () => assignableNodes[0]?.id || ''
  );
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAuditor, setNewTaskAuditor] = useState(
    (userSignature || 'OHA').toUpperCase().slice(0, 3)
  );
  const [newTaskDate, setNewTaskDate] = useState(() => getMondayOfCurrentWeek());
  const [newTaskStartHour, setNewTaskStartHour] = useState<number>(8);
  const [newTaskDuration, setNewTaskDuration] = useState<number>(4);
  const [newTaskNorm, setNewTaskNorm] = useState<string>(CRIPP_STANDARDS[7]);
  const [newTaskBlocker, setNewTaskBlocker] = useState('');

  const allEnrichedTasks = useMemo(
    () => collectAllEnrichedTodoTasks(trees),
    [trees]
  );

  const stageOptions = useMemo(() => {
    const set = new Set<string>();
    allEnrichedTasks.forEach((t) => set.add(t.stageLabel));
    return Array.from(set);
  }, [allEnrichedTasks]);

  const auditorOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_AUDITORS);
    allEnrichedTasks.forEach((t) => set.add(t.auditor));
    return Array.from(set);
  }, [allEnrichedTasks]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allEnrichedTasks.filter((t) => {
      if (filterAuditor !== 'ALL' && t.auditor !== filterAuditor) return false;
      if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
      if (filterStage !== 'ALL' && t.stageLabel !== filterStage) return false;
      if (
        q &&
        !t.title.toLowerCase().includes(q) &&
        !t.nodeLabel.toLowerCase().includes(q) &&
        !t.stageLabel.toLowerCase().includes(q) &&
        !(t.crippNormRef || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [allEnrichedTasks, filterAuditor, filterStatus, filterStage, searchQuery]);

  const workingDaysWindow = useMemo(
    () => getWorkingDaysRange(calendarStartDate, ganttHorizonDays),
    [calendarStartDate, ganttHorizonDays]
  );

  const ganttRows = useMemo(
    () => buildGanttSeries(filteredTasks, ganttMode, workingDaysWindow),
    [filteredTasks, ganttMode, workingDaysWindow]
  );

  const managerSummary = useMemo(
    () =>
      computeManagerPilotageSummary(
        allEnrichedTasks,
        activeAuditorsCount,
        missionWorkingDays
      ),
    [allEnrichedTasks, activeAuditorsCount, missionWorkingDays]
  );

  const auditorDashboards = useMemo(
    () => buildAuditorPerformanceDashboards(trees, allEnrichedTasks),
    [trees, allEnrichedTasks]
  );

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = newTaskNodeId || assignableNodes[0]?.id;
    if (!targetId || !newTaskTitle.trim()) return;
    onAddTodoTask(targetId, {
      title: newTaskTitle.trim(),
      auditor: newTaskAuditor,
      plannedDate: snapToWorkingDay(newTaskDate),
      plannedStartHour: newTaskStartHour,
      plannedDurationHours: newTaskDuration,
      crippNormRef: newTaskNorm,
      methodologyAssessment: 'conforme',
      blockerReason: newTaskBlocker.trim() || undefined,
      teamSupportRequested: Boolean(newTaskBlocker.trim()),
    });
    setNewTaskTitle('');
    setNewTaskBlocker('');
  };

  const dailyCapacityByAuditor = useMemo(() => {
    const map = new Map<string, number>();
    filteredTasks.forEach((t) => {
      const { spanWorkingDays } = computePlannedEndDate(
        t.plannedDate,
        t.plannedDurationHours
      );
      const perDay = round2(t.plannedDurationHours / spanWorkingDays);
      const days = getWorkingDaysRange(t.plannedDate, spanWorkingDays);
      days.forEach((d) => {
        const k = `${t.auditor}::${d}`;
        map.set(k, round2((map.get(k) || 0) + perDay));
      });
    });
    return map;
  }, [filteredTasks]);

  return (
    <div className="space-y-6">
      {/* En-tête KPI temps réel */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-teal-700">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              <span>Pilotage Quotidien Temps Réel · Régime {WORKDAY_HOURS}h / Jour Ouvrable</span>
            </div>
            <h2 className="mt-1 font-display text-xl font-bold text-slate-900">
              To-do Liste Mission, Suivi Horaire, Gantt &amp; Évaluation Auditeurs
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(
              [
                { id: 'plan-annuel', label: 'Plan annuel 2026 (12 Missions)', icon: CalendarRange },
                { id: 'calendrier', label: 'To-do & Pointage 08h/j', icon: ListTodo },
                { id: 'gantt', label: 'Diagramme de Gantt', icon: GanttChart },
                { id: 'manager', label: 'Manager, CRIPP & Recrutement', icon: Compass },
                { id: 'evaluation', label: 'Dashboard Auditeur & Formation', icon: GraduationCap },
              ] as { id: PlanSubTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
            ).map((tab) => {
              const Icon = tab.icon;
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-medium text-slate-500">Avancement Plan</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                {managerSummary.completionPercent}%
              </span>
              <span className="text-[11px] text-slate-500">
                {managerSummary.doneTasks}/{managerSummary.totalTasks} tâches
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-medium text-slate-500">Heures Planifiées vs Réelles</div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
              {managerSummary.totalActualHours}h{' '}
              <span className="text-xs font-normal text-slate-500">
                / {managerSummary.totalPlannedHours}h
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-medium text-slate-500">Écart Cumulé</div>
            <div
              className={`mt-1 font-mono text-xl font-bold tabular-nums ${
                managerSummary.totalVarianceHours > 0
                  ? 'text-red-600'
                  : managerSummary.totalVarianceHours < 0
                  ? 'text-emerald-600'
                  : 'text-slate-900'
              }`}
            >
              {managerSummary.totalVarianceHours > 0
                ? `+${managerSummary.totalVarianceHours}h`
                : `${managerSummary.totalVarianceHours}h`}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-medium text-slate-500">Conformité CRIPP</div>
            <div className="mt-1 font-mono text-xl font-bold text-emerald-700 tabular-nums">
              {managerSummary.crippComplianceRate}%
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-medium text-slate-500">Blocages &amp; Support</div>
            <div className="mt-1 font-mono text-xl font-bold text-red-600 tabular-nums">
              {managerSummary.blockedTasks}{' '}
              <span className="text-xs font-normal text-slate-500">
                ({managerSummary.supportRequestedCount} support)
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-medium text-slate-500">Besoin Recrutement</div>
            <div className="mt-1 font-mono text-xl font-bold text-blue-700 tabular-nums">
              +{managerSummary.recommendedAdditionalEtp}{' '}
              <span className="text-xs font-normal text-slate-500">ETP</span>
            </div>
          </div>
        </div>
      </section>

      {/* Barre de filtres transverses */}
      {(subTab === 'calendrier' || subTab === 'gantt') && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer tâche, étape, dossier ou norme CRIPP..."
            className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
          />

          <select
            value={filterAuditor}
            onChange={(e) => setFilterAuditor(e.target.value)}
            aria-label="Filtrer par auditeur"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            <option value="ALL">Tous les auditeurs</option>
            {auditorOptions.map((aud) => (
              <option key={aud} value={aud}>
                Auditeur : {aud}
              </option>
            ))}
          </select>

          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            aria-label="Filtrer par étape ou dossier"
            className="max-w-[240px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            <option value="ALL">Toutes les étapes / sections</option>
            {stageOptions.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filtrer par statut"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            <option value="ALL">Tous statuts</option>
            <option value="todo">À faire</option>
            <option value="in-progress">En cours</option>
            <option value="blocked">Bloqué</option>
            <option value="done">Terminé</option>
          </select>
        </section>
      )}

      {/* SOUS-VUE 1 : To-do liste & Pointage quotidien 08h/j ouvrable */}
      {subTab === 'calendrier' && (
        <div className="space-y-5">
          {/* Formulaire de planification d'une tâche adossée à une étape / dossier / document */}
          <form
            onSubmit={handleCreateTask}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-teal-700" aria-hidden="true" />
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Planifier une tâche To-do sur calendrier 08h / jour ouvrable
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Jours non ouvrables (Sam/Dim) automatiquement reportés au jour ouvré suivant
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-4">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Étape mission / Dossier / Sous-dossier / Document
                </label>
                <select
                  value={newTaskNodeId}
                  onChange={(e) => setNewTaskNodeId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                >
                  {assignableNodes.slice(0, 120).map((n) => (
                    <option key={n.id} value={n.id}>
                      [{n.nodeType}] {n.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Intitulé de la tâche quotidienne
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Ex: Test de cheminement sur les rapprochements bancaires..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Auditeur
                </label>
                <select
                  value={newTaskAuditor}
                  onChange={(e) => setNewTaskAuditor(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  {DEFAULT_AUDITOR_PROFILES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Date ouvrable
                </label>
                <input
                  type="date"
                  value={newTaskDate}
                  onChange={(e) => setNewTaskDate(snapToWorkingDay(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Heure début (08h-16h)
                </label>
                <input
                  type="number"
                  min={8}
                  max={16}
                  value={newTaskStartHour}
                  onChange={(e) => setNewTaskStartHour(Number(e.target.value) || 8)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Durée prévue (h)
                </label>
                <input
                  type="number"
                  min={0.5}
                  max={80}
                  step={0.5}
                  value={newTaskDuration}
                  onChange={(e) => setNewTaskDuration(Number(e.target.value) || 1)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="md:col-span-4">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Norme CRIPP / Méthodologie de rattachement
                </label>
                <select
                  value={newTaskNorm}
                  onChange={(e) => setNewTaskNorm(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  {CRIPP_STANDARDS.map((std) => (
                    <option key={std} value={std}>
                      {std}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Blocage éventuel (opt.)
                </label>
                <input
                  type="text"
                  value={newTaskBlocker}
                  onChange={(e) => setNewTaskBlocker(e.target.value)}
                  placeholder="Si bloqué..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-end md:col-span-2">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-medium text-white hover:bg-teal-800 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ajouter tâche</span>
                </button>
              </div>
            </div>
          </form>

          {/* Liste des tâches avec pointage Début / Fin et calcul d'écart */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Suivi des tâches &amp; Pointage temps réel ({filteredTasks.length})
              </h3>
              <span className="text-[11px] text-slate-500">
                Cliquez « Pointer début » / « Pointer fin » ou ajustez les horaires réels
              </span>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Aucune tâche ne correspond aux filtres sélectionnés.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredTasks.map((task) => {
                  const stMeta = STATUS_META[task.status];
                  const varBadge = formatVarianceBadge(task.varianceHours);
                  const { endDate } = computePlannedEndDate(
                    task.plannedDate,
                    task.plannedDurationHours
                  );

                  return (
                    <div key={task.id} className="p-4 transition-colors hover:bg-slate-50/70">
                      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                              {task.auditor}
                            </span>
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${stMeta.badgeClass}`}
                            >
                              {stMeta.label}
                            </span>
                            <span
                              className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${varBadge.className}`}
                            >
                              Écart : {varBadge.text}
                            </span>
                            {task.isLocked && (
                              <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                                <Lock className="h-3 w-3" aria-hidden="true" />
                                Verrouillé
                              </span>
                            )}
                            {task.teamSupportRequested && (
                              <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                                <Handshake className="h-3 w-3" aria-hidden="true" />
                                Support équipe requis
                              </span>
                            )}
                          </div>

                          <div className="text-sm font-semibold text-slate-900">{task.title}</div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                            <button
                              type="button"
                              onClick={() => onOpenNodeInWorkflow(task.nodeId)}
                              className="font-medium text-blue-700 hover:underline cursor-pointer"
                            >
                              {task.stageLabel} → {task.nodeLabel}
                            </button>
                            <span>·</span>
                            <span className="font-mono">
                              Planifié : {task.plannedDate} ({task.plannedStartHour}h) → {endDate} ·{' '}
                              {task.plannedDurationHours}h
                            </span>
                            {task.crippNormRef && (
                              <>
                                <span>·</span>
                                <span className="text-slate-600">{task.crippNormRef}</span>
                              </>
                            )}
                          </div>

                          {task.blockerReason && (
                            <div className="mt-1 flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] text-red-800">
                              <AlertOctagon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>Point de blocage : {task.blockerReason}</span>
                            </div>
                          )}

                          {task.managerRedirectNote && (
                            <div className="mt-1 rounded border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] text-indigo-800">
                              Note Manager : {task.managerRedirectNote}
                            </div>
                          )}
                        </div>

                        {/* Contrôles de pointage début/fin et heures réelles */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px]">
                            <span className="text-slate-500">Début:</span>
                            <input
                              type="datetime-local"
                              disabled={task.isLocked}
                              value={toLocalDateTimeInput(task.actualStartAt)}
                              onChange={(e) =>
                                onUpdateTodoTask(
                                  task.nodeId,
                                  task.id,
                                  {
                                    actualStartAt: e.target.value
                                      ? new Date(e.target.value).toISOString()
                                      : undefined,
                                  },
                                  'Pointage début ajusté'
                                )
                              }
                              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-800"
                            />
                          </div>

                          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px]">
                            <span className="text-slate-500">Fin:</span>
                            <input
                              type="datetime-local"
                              disabled={task.isLocked}
                              value={toLocalDateTimeInput(task.actualEndAt)}
                              onChange={(e) =>
                                onUpdateTodoTask(
                                  task.nodeId,
                                  task.id,
                                  {
                                    actualEndAt: e.target.value
                                      ? new Date(e.target.value).toISOString()
                                      : undefined,
                                    status: e.target.value ? 'done' : task.status,
                                  },
                                  'Pointage fin ajusté'
                                )
                              }
                              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-800"
                            />
                          </div>

                          <button
                            type="button"
                            disabled={task.isLocked}
                            onClick={() => onClockInTodoTask(task.nodeId, task.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                          >
                            <Play className="h-3 w-3" aria-hidden="true" />
                            <span>Pointer début</span>
                          </button>

                          <button
                            type="button"
                            disabled={task.isLocked}
                            onClick={() => onClockOutTodoTask(task.nodeId, task.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                          >
                            <Square className="h-3 w-3" aria-hidden="true" />
                            <span>Pointer fin</span>
                          </button>

                          <button
                            type="button"
                            disabled={task.isLocked}
                            onClick={() => onDeleteTodoTask(task.nodeId, task.id)}
                            aria-label={`Supprimer la tâche ${task.title}`}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SOUS-VUE 2 : Diagramme de Gantt (Par Auditeur / Par Étape / Global) */}
      {subTab === 'gantt' && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Vue Gantt :</span>
              {(
                [
                  { id: 'auditor', label: 'Par Auditeur' },
                  { id: 'stage', label: 'Par Étape' },
                  { id: 'global', label: 'Global Plan d’Audit' },
                ] as { id: GanttGroupMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setGanttMode(m.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                    ganttMode === m.id
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 text-slate-600">
                <span>Début ouvré :</span>
                <input
                  type="date"
                  value={calendarStartDate}
                  onChange={(e) => setCalendarStartDate(snapToWorkingDay(e.target.value))}
                  className="rounded border border-slate-200 px-2 py-1 text-slate-900"
                />
              </label>
              <label className="flex items-center gap-1.5 text-slate-600">
                <span>Fenêtre :</span>
                <select
                  value={ganttHorizonDays}
                  onChange={(e) => setGanttHorizonDays(Number(e.target.value))}
                  className="rounded border border-slate-200 px-2 py-1 text-slate-900"
                >
                  <option value={5}>5 jours ouvrables (1 sem.)</option>
                  <option value={10}>10 jours ouvrables (2 sem.)</option>
                  <option value={15}>15 jours ouvrables (3 sem.)</option>
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <div className="min-w-[880px]">
              {/* En-tête calendrier jours ouvrables */}
              <div
                className="grid border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600"
                style={{
                  gridTemplateColumns: `280px repeat(${workingDaysWindow.length}, minmax(60px, 1fr))`,
                }}
              >
                <div className="border-r border-slate-200 px-3 py-2">
                  {ganttMode === 'auditor'
                    ? 'Auditeur / Tâches'
                    : ganttMode === 'stage'
                    ? 'Étape de mission / Tâches'
                    : 'Plan d’audit global'}
                </div>
                {workingDaysWindow.map((dayStr) => {
                  const fmt = formatDayShort(dayStr);
                  return (
                    <div
                      key={dayStr}
                      className="border-r border-slate-200 px-1 py-1.5 text-center last:border-r-0"
                    >
                      <div className="text-slate-900">{fmt.dow}</div>
                      <div className="font-mono text-[10px] font-normal text-slate-500">
                        {fmt.dm} · {WORKDAY_HOURS}h
                      </div>
                    </div>
                  );
                })}
              </div>

              {ganttRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Aucune tâche planifiée dans cette fenêtre de jours ouvrables.
                </div>
              ) : (
                ganttRows.map((group) => (
                  <div key={group.groupKey} className="border-b border-slate-200 last:border-b-0">
                    {/* Ligne résumé du groupe */}
                    <div
                      className="grid bg-slate-100/80 text-xs"
                      style={{
                        gridTemplateColumns: `280px repeat(${workingDaysWindow.length}, minmax(60px, 1fr))`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 border-r border-slate-200 px-3 py-2 font-semibold text-slate-900">
                        <span className="truncate">{group.groupLabel}</span>
                        <span className="shrink-0 font-mono text-[10px] text-slate-600">
                          {group.totalPlannedHours}h prév.
                          {group.totalVarianceHours !== 0
                            ? ` (${group.totalVarianceHours > 0 ? '+' : ''}${group.totalVarianceHours}h)`
                            : ''}
                        </span>
                      </div>
                      {workingDaysWindow.map((dayStr) => {
                        const dayLoad =
                          ganttMode === 'auditor'
                            ? dailyCapacityByAuditor.get(`${group.groupKey}::${dayStr}`) || 0
                            : 0;
                        const overloaded = dayLoad > WORKDAY_HOURS;
                        return (
                          <div
                            key={dayStr}
                            className={`flex items-center justify-center border-r border-slate-200 px-1 py-1 font-mono text-[10px] last:border-r-0 ${
                              overloaded
                                ? 'bg-red-100 font-bold text-red-700'
                                : dayLoad > 0
                                ? 'text-slate-600'
                                : 'text-slate-300'
                            }`}
                          >
                            {ganttMode === 'auditor' && dayLoad > 0 ? `${dayLoad}h` : '·'}
                          </div>
                        );
                      })}
                    </div>

                    {/* Barres des tâches du groupe */}
                    {group.bars.map((bar) => {
                      const stMeta = STATUS_META[bar.task.status];
                      return (
                        <div
                          key={bar.task.id}
                          className="grid items-center border-t border-slate-100 text-[11px] hover:bg-slate-50"
                          style={{
                            gridTemplateColumns: `280px repeat(${workingDaysWindow.length}, minmax(60px, 1fr))`,
                          }}
                        >
                          <div className="flex items-center justify-between gap-1.5 border-r border-slate-200 px-3 py-2">
                            <button
                              type="button"
                              onClick={() => onOpenNodeInWorkflow(bar.task.nodeId)}
                              title={`${bar.task.title} — cliquer pour localiser dans le workflow`}
                              className="min-w-0 flex-1 truncate text-left font-medium text-slate-800 hover:text-blue-700 hover:underline cursor-pointer"
                            >
                              {bar.task.title}
                            </button>
                            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                              {bar.task.auditor}
                            </span>
                          </div>

                          {/* Track Gantt */}
                          <div
                            className="relative grid h-9 items-center"
                            style={{
                              gridColumn: `2 / span ${workingDaysWindow.length}`,
                              gridTemplateColumns: `repeat(${workingDaysWindow.length}, minmax(60px, 1fr))`,
                            }}
                          >
                            {workingDaysWindow.map((dayStr) => (
                              <div
                                key={dayStr}
                                className="h-full border-r border-slate-100 last:border-r-0"
                              />
                            ))}

                            <div
                              style={{
                                gridColumn: `${bar.startIndex + 1} / span ${bar.spanDays}`,
                                gridRow: 1,
                              }}
                              title={`${bar.task.title} · ${bar.task.plannedDurationHours}h prévues${
                                bar.task.actualHours !== undefined
                                  ? ` / ${bar.task.actualHours}h réelles`
                                  : ''
                              }`}
                              className={`mx-1 flex h-6 items-center justify-between gap-1.5 overflow-hidden rounded px-2 text-[10px] font-medium shadow-xs ${stMeta.barClass} ${
                                bar.isOverrun ? 'ring-2 ring-amber-400' : ''
                              }`}
                            >
                              <span className="truncate">
                                {bar.task.plannedStartHour}h · {bar.task.plannedDurationHours}h
                              </span>
                              {bar.task.varianceHours !== undefined && (
                                <span className="shrink-0 rounded bg-black/20 px-1 font-mono text-[9px]">
                                  {bar.task.varianceHours > 0
                                    ? `+${bar.task.varianceHours}h`
                                    : `${bar.task.varianceHours}h`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-slate-600" /> À faire
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-sky-600" /> En cours
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-red-600" /> Bloqué
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-emerald-600" /> Terminé
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-amber-400" /> Dépassement temps réel
            </span>
          </div>
        </section>
      )}

      {/* SOUS-VUE 3 : Pilotage Manager temps réel, CRIPP, Blocages & Budget Recrutement */}
      {subTab === 'manager' && (
        <div className="space-y-6">
          {/* Justification Budget Recrutement & Charge/Capacité */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-700" aria-hidden="true" />
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Justification Budget Recrutement (Base {WORKDAY_HOURS}h / jour ouvrable)
                </h3>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <span className="font-medium text-slate-700">Effectif actuel (auditeurs)</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={activeAuditorsCount}
                    onChange={(e) => setActiveAuditorsCount(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1.5 w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-sm font-semibold text-slate-900"
                  />
                </label>

                <label className="block rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <span className="font-medium text-slate-700">Durée mission (jours ouvrables)</span>
                  <input
                    type="number"
                    min={1}
                    max={250}
                    value={missionWorkingDays}
                    onChange={(e) => setMissionWorkingDays(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1.5 w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-sm font-semibold text-slate-900"
                  />
                </label>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-[11px] text-slate-500">Capacité disponible</div>
                  <div className="mt-0.5 font-mono text-base font-bold text-slate-900">
                    {managerSummary.availableCapacityHours}h
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-[11px] text-slate-500">Charge réelle projetée</div>
                  <div className="mt-0.5 font-mono text-base font-bold text-blue-700">
                    {managerSummary.effectiveWorkloadHours}h ({managerSummary.utilizationRate}%)
                  </div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="text-[11px] font-medium text-blue-700">Renfort requis</div>
                  <div className="mt-0.5 font-mono text-base font-bold text-blue-900">
                    +{managerSummary.recommendedAdditionalEtp} ETP
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
                <div className="mb-1 font-semibold text-slate-900">
                  Note de synthèse pour arbitrage budgétaire :
                </div>
                {managerSummary.recruitmentJustification}
              </div>
            </div>

            {/* Points de blocage & Support Team Building */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-rose-600" aria-hidden="true" />
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Blocages &amp; Support Team Building
                  </h3>
                </div>
                <span className="rounded-full bg-rose-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-rose-700">
                  {managerSummary.supportRequestedCount} actif(s)
                </span>
              </div>

              <div className="mt-3 max-h-64 space-y-2.5 overflow-y-auto pr-1">
                {allEnrichedTasks.filter(
                  (t) =>
                    t.status === 'blocked' ||
                    t.teamSupportRequested ||
                    (t.varianceHours ?? 0) > 0
                ).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                    Aucun point de blocage ni contreperformance signalée.
                  </div>
                ) : (
                  allEnrichedTasks
                    .filter(
                      (t) =>
                        t.status === 'blocked' ||
                        t.teamSupportRequested ||
                        (t.varianceHours ?? 0) > 0
                    )
                    .map((t) => (
                      <div
                        key={t.id}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{t.title}</span>
                          <span className="font-mono text-[10px] font-semibold text-slate-600">
                            {t.auditor}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-600">
                          {t.blockerReason
                            ? `Blocage : ${t.blockerReason}`
                            : `Contreperformance / dérive : +${t.varianceHours}h vs prévu`}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={t.isLocked}
                            onClick={() =>
                              onUpdateTodoTask(
                                t.nodeId,
                                t.id,
                                {
                                  status: 'in-progress',
                                  blockerReason: undefined,
                                  teamSupportRequested: false,
                                  managerRedirectNote: `Débloqué en binôme avec ${userSignature} (Team Building)`,
                                },
                                'Déblocage & support équipe'
                              )
                            }
                            className="rounded bg-emerald-700 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-800 disabled:opacity-40 cursor-pointer"
                          >
                            Débloquer + Coaching binôme
                          </button>
                          <button
                            type="button"
                            disabled={t.isLocked}
                            onClick={() =>
                              onUpdateTodoTask(
                                t.nodeId,
                                t.id,
                                {
                                  teamSupportRequested: !t.teamSupportRequested,
                                },
                                'Support équipe basculé'
                              )
                            }
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                          >
                            {t.teamSupportRequested ? 'Retirer alerte support' : 'Demander support équipe'}
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </section>

          {/* Table de réorientation Manager & Évaluation méthodologique CRIPP */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Réorientation temps réel &amp; Conformité Méthodologie / Normes CRIPP
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                {managerSummary.overrunTasksCount} contreperformance(s) détectée(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2.5">Tâche &amp; Étape</th>
                    <th className="px-3 py-2.5">Réorienter Auditeur</th>
                    <th className="px-3 py-2.5">Date ouvrable</th>
                    <th className="px-3 py-2.5">Norme CRIPP</th>
                    <th className="px-3 py-2.5">Bien-fondé Méthodo</th>
                    <th className="px-3 py-2.5">Prév. / Réel / Écart</th>
                    <th className="px-3 py-2.5">Directive Manager</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {allEnrichedTasks.map((t) => {
                    const meth = METHODOLOGY_META[t.methodologyAssessment || 'pending'];
                    const isOverrun = (t.varianceHours ?? 0) > 0;
                    return (
                      <tr key={t.id} className={isOverrun ? 'bg-red-50/35' : 'hover:bg-slate-50'}>
                        <td className="max-w-[260px] px-4 py-2.5">
                          <div className="font-semibold text-slate-900">{t.title}</div>
                          <div className="truncate text-[10px] text-slate-500">
                            {t.stageLabel} · {t.nodeLabel}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            disabled={t.isLocked}
                            value={t.auditor}
                            onChange={(e) =>
                              onUpdateTodoTask(
                                t.nodeId,
                                t.id,
                                { auditor: e.target.value },
                                `Réorientation vers ${e.target.value}`
                              )
                            }
                            className="rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-900"
                          >
                            {auditorOptions.map((aud) => (
                              <option key={aud} value={aud}>
                                {aud}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="date"
                            disabled={t.isLocked}
                            value={t.plannedDate}
                            onChange={(e) =>
                              onUpdateTodoTask(
                                t.nodeId,
                                t.id,
                                { plannedDate: snapToWorkingDay(e.target.value) },
                                'Replanification manager'
                              )
                            }
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            disabled={t.isLocked}
                            value={t.crippNormRef || CRIPP_STANDARDS[7]}
                            onChange={(e) =>
                              onUpdateTodoTask(
                                t.nodeId,
                                t.id,
                                { crippNormRef: e.target.value },
                                'Norme CRIPP ajustée'
                              )
                            }
                            className="max-w-[210px] rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800"
                          >
                            {CRIPP_STANDARDS.map((std) => (
                              <option key={std} value={std}>
                                {std}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            disabled={t.isLocked}
                            value={t.methodologyAssessment || 'pending'}
                            onChange={(e) =>
                              onUpdateTodoTask(
                                t.nodeId,
                                t.id,
                                {
                                  methodologyAssessment: e.target.value as MethodologyAssessment,
                                },
                                'Évaluation CRIPP mise à jour'
                              )
                            }
                            className={`rounded border px-2 py-1 text-[11px] font-medium ${meth.badgeClass}`}
                          >
                            <option value="pending">À évaluer</option>
                            <option value="conforme">Conforme CRIPP</option>
                            <option value="a-justifier">À justifier</option>
                            <option value="hors-perimetre">Hors périmètre</option>
                          </select>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums">
                          <div>
                            {t.plannedDurationHours}h /{' '}
                            {t.actualHours !== undefined ? `${t.actualHours}h` : '—'}
                          </div>
                          {t.varianceHours !== undefined && (
                            <div
                              className={
                                t.varianceHours > 0
                                  ? 'font-bold text-red-600'
                                  : 'font-semibold text-emerald-700'
                              }
                            >
                              {t.varianceHours > 0 ? `+${t.varianceHours}h` : `${t.varianceHours}h`}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            disabled={t.isLocked}
                            defaultValue={t.managerRedirectNote || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (t.managerRedirectNote || '')) {
                                onUpdateTodoTask(
                                  t.nodeId,
                                  t.id,
                                  { managerRedirectNote: e.target.value },
                                  'Directive manager enregistrée'
                                );
                              }
                            }}
                            placeholder="Réorienter / commenter..."
                            className="w-40 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 placeholder:text-slate-400"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* SOUS-VUE 4 : Dashboard par Auditeur, Évaluation annuelle, Points de revue & Formation */}
      {subTab === 'evaluation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {auditorDashboards.map((dash) => (
              <article
                key={dash.auditor}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                          {dash.auditor}
                        </span>
                        <h3 className="font-display text-sm font-bold text-slate-900">
                          {dash.displayName}
                        </h3>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">{dash.role}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg font-bold text-blue-700 tabular-nums">
                        {dash.annualScore}/100
                      </div>
                      <div className="text-[10px] font-semibold text-slate-600">
                        {dash.ratingLabel}
                      </div>
                    </div>
                  </div>

                  {/* Métriques performance + points de revue */}
                  <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                        <span>Tâches exécutées</span>
                      </div>
                      <div className="mt-0.5 font-mono font-bold text-slate-900">
                        {dash.doneTasks}/{dash.totalTasks}
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Clock className="h-3 w-3 text-blue-600" aria-hidden="true" />
                        <span>Heures &amp; Écart</span>
                      </div>
                      <div className="mt-0.5 font-mono font-bold text-slate-900">
                        {dash.actualHours}h{' '}
                        <span
                          className={
                            dash.varianceHours > 0 ? 'text-red-600' : 'text-emerald-700'
                          }
                        >
                          ({dash.varianceHours > 0 ? `+${dash.varianceHours}h` : `${dash.varianceHours}h`})
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <MessageSquareWarning className="h-3 w-3 text-amber-600" aria-hidden="true" />
                        <span>Points de revue (W/P)</span>
                      </div>
                      <div className="mt-0.5 font-mono font-bold text-slate-900">
                        <span className={dash.openReviewNotes > 0 ? 'text-amber-700' : 'text-slate-900'}>
                          {dash.openReviewNotes} ouvert(s)
                        </span>{' '}
                        <span className="text-[10px] font-normal text-slate-500">
                          / {dash.resolvedReviewNotes} levé(s)
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Award className="h-3 w-3 text-indigo-600" aria-hidden="true" />
                        <span>Conformité CRIPP</span>
                      </div>
                      <div className="mt-0.5 font-mono font-bold text-emerald-700">
                        {dash.crippConformityRate}%
                      </div>
                    </div>
                  </div>

                  {/* Barre de progression évaluation */}
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                      <span>Indice d&apos;évaluation annuelle</span>
                      <span>Efficience temps : {dash.efficiencyRate}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full transition-all ${
                          dash.annualScore >= 85
                            ? 'bg-emerald-600'
                            : dash.annualScore >= 70
                            ? 'bg-blue-600'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${dash.annualScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Plan de formation recommandé */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                      <BookOpen className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                      <span>Plan de formation recommandé (Évaluation &amp; Revue) :</span>
                    </div>
                    <ul className="space-y-1 text-[11px] text-slate-600">
                      {dash.trainingRecommendations.map((rec, i) => (
                        <li
                          key={i}
                          className="rounded border border-slate-100 bg-slate-50/70 px-2.5 py-1.5"
                        >
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Coaching & Team Building */}
                <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-2.5 text-[11px] text-indigo-900">
                  <div className="mb-0.5 flex items-center gap-1 font-semibold">
                    <Users className="h-3.5 w-3.5 text-indigo-700" aria-hidden="true" />
                    <span>Support &amp; Team Building :</span>
                  </div>
                  {dash.teamBuildingFocus}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {subTab === 'plan-annuel' && (
        <AuditPlanWorkflowPanel
          trees={trees}
          userSignature={userSignature}
          initialMode="integrer"
          onInjectPlanMissions={(targetNodeId, count) =>
            onInjectPlanMissions?.(targetNodeId, count)
          }
          onUpdateStepDates={(stepNodeId, dateDebut, dateFin, dateFinReelle) =>
            onUpdatePlanStepDates?.(stepNodeId, dateDebut, dateFin, dateFinReelle)
          }
          onUpdateMissionMeta={(missionNodeId, patch) =>
            onUpdatePlanMissionMeta?.(missionNodeId, patch)
          }
          onAddTodoTask={onAddTodoTask}
          onUpdateTodoTask={onUpdateTodoTask}
          onDeleteTodoTask={onDeleteTodoTask}
          onJumpToNode={onOpenNodeInWorkflow}
        />
      )}
    </div>
  );
};
