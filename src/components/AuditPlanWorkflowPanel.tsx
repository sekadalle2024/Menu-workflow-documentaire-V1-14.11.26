import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  FolderKanban,
  GanttChart,
  Hash,
  Layers,
  ListTodo,
  Plus,
  RefreshCw,
  ShieldAlert,
  SquarePen,
  Target,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  AUDIT_PLAN_SCHEDULE_META,
  AUDIT_PLAN_STEP_TASK_EXAMPLES,
  computeAuditPlanMetrics,
  computeWorkingDaysBetween,
  convertUnitToHours,
  extractPlanMissionsFromTrees,
  formatHoursInUnit,
  LiveAuditPlanMission,
} from '../data/auditPlanWorkflowData';
import {
  AuditPlanMissionMeta,
  AuditPlanScheduleStatus,
  AuditPlanTaskUnit,
  MethodologyAssessment,
  MissionTodoTask,
  TodoTaskStatus,
  WorkflowTreeNode,
} from '../types/workflow';
import {
  addWorkingDays,
  DEFAULT_AUDITOR_PROFILES,
  round2,
  snapToWorkingDay,
  WORKDAY_HOURS,
} from '../utils/auditTodoOps';

export type AuditPlanPanelMode =
  | 'integrer'
  | 'integrale'
  | 'planification'
  | 'gantt-mission'
  | 'gantt-annuel';

interface AuditPlanWorkflowPanelProps {
  trees: WorkflowTreeNode[];
  scopeNodeId?: string;
  initialMode?: AuditPlanPanelMode;
  initialMissionId?: string;
  initialStepId?: string;
  userSignature: string;
  onClose?: () => void;
  onInjectPlanMissions: (targetNodeId: string, count: number) => void;
  onUpdateStepDates: (
    stepNodeId: string,
    dateDebut: string,
    dateFin: string,
    dateFinReelle?: string
  ) => void;
  onUpdateMissionMeta?: (
    missionNodeId: string,
    patch: Partial<AuditPlanMissionMeta> & { titre?: string }
  ) => void;
  onAddTodoTask: (
    nodeId: string,
    input: {
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
    }
  ) => void;
  onUpdateTodoTask: (
    nodeId: string,
    taskId: string,
    patch: Partial<MissionTodoTask>,
    auditLabel?: string
  ) => void;
  onDeleteTodoTask: (nodeId: string, taskId: string) => void;
  onJumpToNode?: (nodeId: string) => void;
  compact?: boolean;
}

const MONTHS_2026 = [
  { key: '2026-01', label: 'Jan', days: 31 },
  { key: '2026-02', label: 'Fév', days: 28 },
  { key: '2026-03', label: 'Mar', days: 31 },
  { key: '2026-04', label: 'Avr', days: 30 },
  { key: '2026-05', label: 'Mai', days: 31 },
  { key: '2026-06', label: 'Juin', days: 30 },
  { key: '2026-07', label: 'Juil', days: 31 },
  { key: '2026-08', label: 'Août', days: 31 },
  { key: '2026-09', label: 'Sep', days: 30 },
  { key: '2026-10', label: 'Oct', days: 31 },
  { key: '2026-11', label: 'Nov', days: 30 },
  { key: '2026-12', label: 'Déc', days: 31 },
];

function dayOfYear2026(isoDate: string): number {
  const start = new Date('2026-01-01T12:00:00').getTime();
  const target = new Date(`${isoDate}T12:00:00`).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.min(365, Math.round((target - start) / 86_400_000)));
}

function formatDateFr(iso?: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatVarianceText(ecartJours: number): string {
  if (ecartJours < 0) return `${ecartJours} j (avance)`;
  if (ecartJours > 0) return `+${ecartJours} j (retard)`;
  return '0 j (normal)';
}

function renderScheduleStatusBadge(status: AuditPlanScheduleStatus, ecartJours?: number) {
  const meta = AUDIT_PLAN_SCHEDULE_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${meta.badgeBg}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${meta.barBg}`}
        aria-hidden="true"
      />
      <span>{meta.label}</span>
      {ecartJours !== undefined && ecartJours !== 0 && (
        <span className="font-mono tabular-nums">
          ({ecartJours > 0 ? `+${ecartJours}j` : `${ecartJours}j`})
        </span>
      )}
    </span>
  );
}

export const AuditPlanWorkflowPanel: React.FC<AuditPlanWorkflowPanelProps> = ({
  trees,
  scopeNodeId,
  initialMode = 'integrer',
  initialMissionId,
  initialStepId,
  userSignature,
  onClose,
  onInjectPlanMissions,
  onUpdateStepDates,
  onUpdateMissionMeta,
  onAddTodoTask,
  onUpdateTodoTask,
  onDeleteTodoTask,
  onJumpToNode,
  compact = false,
}) => {
  const [mode, setMode] = useState<AuditPlanPanelMode>(initialMode);
  const [expandedAccordionIds, setExpandedAccordionIds] = useState<Set<string>>(
    () => new Set(['col-mission'])
  );
  const [activeAccordionId, setActiveAccordionId] = useState<string>('col-mission');
  const [editingAccordionId, setEditingAccordionId] = useState<string | null>(null);
  const [editCodeDraft, setEditCodeDraft] = useState('');
  const [editTitreDraft, setEditTitreDraft] = useState('');
  const [editSecteurDraft, setEditSecteurDraft] = useState('');
  const [editExerciceDraft, setEditExerciceDraft] = useState('');
  const [editDirectionDraft, setEditDirectionDraft] = useState('');
  const [editPerimetreDraft, setEditPerimetreDraft] = useState('');
  const [editObjectifDraft, setEditObjectifDraft] = useState('');
  const [editRisqueDraft, setEditRisqueDraft] = useState<AuditPlanMissionMeta['risque']>('Élevé');
  const [editChefDraft, setEditChefDraft] = useState('');
  const [editAuditeursDraft, setEditAuditeursDraft] = useState<string[]>([]);
  const [editDureeDraft, setEditDureeDraft] = useState<number>(3);
  const [editDebutDraft, setEditDebutDraft] = useState('');
  const [editFinPrevueDraft, setEditFinPrevueDraft] = useState('');
  const [editFinReelleDraft, setEditFinReelleDraft] = useState('');
  const [editProgDraft, setEditProgDraft] = useState<number>(0);
  const [injectCount, setInjectCount] = useState<number>(12);
  const [scheduleFilter, setScheduleFilter] = useState<'all' | AuditPlanScheduleStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [ganttUnit, setGanttUnit] = useState<AuditPlanTaskUnit>('jour');

  // Résoudre la racine Plan annuel d'audit cible
  const planNatureNode = useMemo(() => {
    const findPlanNature = (nodes: WorkflowTreeNode[]): WorkflowTreeNode | null => {
      for (const n of nodes) {
        if (n.nodeType === 'nature' && n.natureId === 'plan-audit') {
          if (!scopeNodeId) return n;
          const contains = (sub: WorkflowTreeNode): boolean =>
            sub.id === scopeNodeId || Boolean(sub.children?.some(contains));
          if (contains(n)) return n;
        }
        if (n.children?.length) {
          const found = findPlanNature(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findPlanNature(trees) || findPlanNature(trees.slice(0, 1));
  }, [trees, scopeNodeId]);

  const missions = useMemo(
    () => extractPlanMissionsFromTrees(trees, planNatureNode?.id || scopeNodeId),
    [trees, planNatureNode?.id, scopeNodeId]
  );

  const metrics = useMemo(() => computeAuditPlanMetrics(missions), [missions]);

  const [selectedMissionId, setSelectedMissionId] = useState<string>(
    initialMissionId || missions[0]?.node.id || ''
  );

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, initialMissionId, initialStepId]);

  useEffect(() => {
    if (initialMissionId && missions.some((m) => m.node.id === initialMissionId)) {
      setSelectedMissionId(initialMissionId);
      return;
    }
    setSelectedMissionId((prev) => {
      if (missions.some((m) => m.node.id === prev)) return prev;
      return missions[0]?.node.id || '';
    });
  }, [initialMissionId, missions]);

  const selectedMission: LiveAuditPlanMission | undefined = useMemo(
    () => missions.find((m) => m.node.id === selectedMissionId) || missions[0],
    [missions, selectedMissionId]
  );

  useEffect(() => {
    setEditingAccordionId(null);
  }, [selectedMission?.node.id]);

  const toggleAccordionTab = (tabId: string) => {
    setActiveAccordionId(tabId);
    setExpandedAccordionIds((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) next.delete(tabId);
      else next.add(tabId);
      return next;
    });
  };

  const startEditingAccordionTab = (tabId: string) => {
    if (!selectedMission) return;
    const rawTitre = selectedMission.node.label.startsWith(`${selectedMission.meta.code} · `)
      ? selectedMission.node.label.slice(`${selectedMission.meta.code} · `.length)
      : selectedMission.node.label;
    setEditCodeDraft(selectedMission.meta.code);
    setEditTitreDraft(rawTitre);
    setEditSecteurDraft(selectedMission.meta.secteur);
    setEditExerciceDraft(selectedMission.meta.exercice);
    setEditDirectionDraft(selectedMission.meta.direction);
    setEditPerimetreDraft(selectedMission.meta.perimetre);
    setEditObjectifDraft(selectedMission.meta.objectif);
    setEditRisqueDraft(selectedMission.meta.risque);
    setEditChefDraft(selectedMission.meta.chefMission);
    setEditAuditeursDraft([...selectedMission.meta.auditeurs]);
    setEditDureeDraft(selectedMission.meta.dureeSemaines);
    setEditDebutDraft(selectedMission.meta.dateDebut);
    setEditFinPrevueDraft(selectedMission.meta.dateFinPrevue);
    setEditFinReelleDraft(
      selectedMission.meta.dateFinReelle || selectedMission.meta.dateFinPrevue
    );
    setEditProgDraft(selectedMission.meta.progressionPct);

    setActiveAccordionId(tabId);
    setExpandedAccordionIds((prev) => {
      const next = new Set(prev);
      next.add(tabId);
      return next;
    });
    setEditingAccordionId((prev) => (prev === tabId ? null : tabId));
  };

  // Sélection Phase / Étape dans le planificateur
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('');
  const [selectedStepId, setSelectedStepId] = useState<string>(initialStepId || '');

  useEffect(() => {
    if (!selectedMission) return;
    if (initialStepId) {
      const matchingPhase = selectedMission.phases.find((p) =>
        p.steps.some((s) => s.node.id === initialStepId)
      );
      if (matchingPhase) {
        setSelectedPhaseId(matchingPhase.node.id);
        setSelectedStepId(initialStepId);
        return;
      }
    }
    const validPhase =
      selectedMission.phases.find((p) => p.node.id === selectedPhaseId) ||
      selectedMission.phases[0];
    if (validPhase) {
      setSelectedPhaseId(validPhase.node.id);
      const validStep =
        validPhase.steps.find((s) => s.node.id === selectedStepId) || validPhase.steps[0];
      if (validStep) setSelectedStepId(validStep.node.id);
    }
  }, [selectedMission, selectedPhaseId, selectedStepId, initialStepId]);

  const selectedPhase = useMemo(
    () =>
      selectedMission?.phases.find((p) => p.node.id === selectedPhaseId) ||
      selectedMission?.phases[0],
    [selectedMission, selectedPhaseId]
  );

  const selectedStep = useMemo(
    () =>
      selectedPhase?.steps.find((s) => s.node.id === selectedStepId) ||
      selectedPhase?.steps[0],
    [selectedPhase, selectedStepId]
  );

  // État formulaire d'édition des dates d'étape
  const [stepStartDraft, setStepStartDraft] = useState('');
  const [stepEndDraft, setStepEndDraft] = useState('');
  const [stepRealEndDraft, setStepRealEndDraft] = useState('');

  useEffect(() => {
    if (!selectedStep) return;
    setStepStartDraft(selectedStep.dateDebut);
    setStepEndDraft(selectedStep.dateFin);
    setStepRealEndDraft(selectedStep.dateFinReelle);
  }, [selectedStep]);

  // État formulaire ajout tâche auditeur (Planification des tâches)
  const [taskPreset, setTaskPreset] = useState<string>(AUDIT_PLAN_STEP_TASK_EXAMPLES[0]);
  const [taskTitleDraft, setTaskTitleDraft] = useState<string>(AUDIT_PLAN_STEP_TASK_EXAMPLES[0]);
  const [taskAuditorDraft, setTaskAuditorDraft] = useState<string>(userSignature || 'SEK');
  const [taskUnitDraft, setTaskUnitDraft] = useState<AuditPlanTaskUnit>('heure');
  const [taskQuantityDraft, setTaskQuantityDraft] = useState<number>(4);
  const [taskStartDraft, setTaskStartDraft] = useState<string>('2026-01-12');
  const [taskStartHourDraft, setTaskStartHourDraft] = useState<number>(8);
  const [taskPlannedEndDraft, setTaskPlannedEndDraft] = useState<string>('2026-01-12');
  const [taskActualHoursDraft, setTaskActualHoursDraft] = useState<string>('');
  const [taskActualEndDraft, setTaskActualEndDraft] = useState<string>('');

  useEffect(() => {
    if (!selectedStep) return;
    setTaskStartDraft(selectedStep.dateDebut);
    setTaskPlannedEndDraft(selectedStep.dateFin);
    if (selectedMission?.meta.auditeurs.length) {
      setTaskAuditorDraft(selectedMission.meta.auditeurs[0]);
    }
  }, [selectedStep, selectedMission]);

  // Auto-calcul date de fin prévue si quantité/unité change
  const plannedTaskHoursComputed = useMemo(
    () => convertUnitToHours(taskQuantityDraft, taskUnitDraft),
    [taskQuantityDraft, taskUnitDraft]
  );

  const previewVarianceHours = useMemo(() => {
    const parsedActual = Number.parseFloat(taskActualHoursDraft);
    if (!Number.isNaN(parsedActual) && taskActualHoursDraft.trim() !== '') {
      return round2(parsedActual - plannedTaskHoursComputed);
    }
    if (taskActualEndDraft && taskPlannedEndDraft) {
      const daysDelta = computeWorkingDaysBetween(taskPlannedEndDraft, taskActualEndDraft);
      return round2(daysDelta * WORKDAY_HOURS);
    }
    return 0;
  }, [taskActualHoursDraft, plannedTaskHoursComputed, taskActualEndDraft, taskPlannedEndDraft]);

  // État dépliage Gantt Niveau 1 (Mission -> Phase -> Étape -> Auditeur -> Tâches)
  const [expandedGanttKeys, setExpandedGanttKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!selectedMission) return;
    const next = new Set<string>();
    next.add(`m:${selectedMission.node.id}`);
    selectedMission.phases.forEach((p) => {
      next.add(`p:${p.node.id}`);
      p.steps.slice(0, 3).forEach((s) => {
        next.add(`s:${s.node.id}`);
        selectedMission.meta.auditeurs.forEach((aud) => {
          next.add(`a:${s.node.id}:${aud}`);
        });
      });
    });
    setExpandedGanttKeys(next);
  }, [selectedMission?.node.id]);

  const toggleGanttKey = (key: string) => {
    setExpandedGanttKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAllGanttMission = () => {
    if (!selectedMission) return;
    const next = new Set<string>([`m:${selectedMission.node.id}`]);
    selectedMission.phases.forEach((p) => {
      next.add(`p:${p.node.id}`);
      p.steps.forEach((s) => {
        next.add(`s:${s.node.id}`);
        const auds = new Set(s.tasks.map((t) => t.auditor));
        auds.forEach((a) => next.add(`a:${s.node.id}:${a}`));
      });
    });
    setExpandedGanttKeys(next);
  };

  const filteredMissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return missions.filter((m) => {
      if (scheduleFilter !== 'all' && m.meta.statutProgression !== scheduleFilter) return false;
      if (!q) return true;
      return (
        m.meta.code.toLowerCase().includes(q) ||
        m.node.label.toLowerCase().includes(q) ||
        m.meta.direction.toLowerCase().includes(q) ||
        m.meta.objectif.toLowerCase().includes(q) ||
        m.meta.auditeurs.some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [missions, scheduleFilter, searchQuery]);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStep) return;
    const safeStart = snapToWorkingDay(taskStartDraft || selectedStep.dateDebut);
    const spanDays = Math.max(1, Math.ceil(plannedTaskHoursComputed / WORKDAY_HOURS));
    const autoEnd = addWorkingDays(safeStart, spanDays - 1);
    const plannedEnd = taskPlannedEndDraft ? snapToWorkingDay(taskPlannedEndDraft) : autoEnd;
    const parsedActual = Number.parseFloat(taskActualHoursDraft);
    const actualHrs =
      !Number.isNaN(parsedActual) && taskActualHoursDraft.trim() !== ''
        ? Math.max(0, round2(parsedActual))
        : undefined;

    onAddTodoTask(selectedStep.node.id, {
      title: taskTitleDraft.trim() || taskPreset,
      auditor: taskAuditorDraft || 'SEK',
      plannedDate: safeStart,
      plannedEndDate: plannedEnd,
      actualEndDate: taskActualEndDraft || undefined,
      plannedStartHour: taskStartHourDraft,
      plannedDurationHours: plannedTaskHoursComputed,
      unit: taskUnitDraft,
      actualHours: actualHrs,
      status: actualHrs !== undefined ? 'done' : 'in-progress',
      crippNormRef: 'Norme 13.6 — Programme de travail',
      methodologyAssessment: 'conforme',
    });
    setTaskActualHoursDraft('');
    setTaskActualEndDraft('');
  };

  return (
    <section
      aria-label="Workflow Plan annuel d’audit — Exercice 2026"
      className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 text-slate-900 ${
        compact ? 'border-b border-slate-700 lg:border-b-0 lg:border-r lg:border-slate-800' : 'rounded-xl border border-slate-200'
      }`}
    >
      {/* En-tête : sobre et épuré en mode détail du plan (compact), complet pour les vues Gantt/Planification */}
      {compact && mode === 'integrale' ? (
        <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3.5 text-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-500">
                Plan annuel d&apos;audit · Exercice {selectedMission?.meta.exercice || '2026'}
              </div>
              <h2 className="mt-0.5 truncate text-base font-semibold text-slate-900">
                Détail du plan — {selectedMission?.node.label || 'Mission'}
              </h2>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer le détail du plan"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <CalendarRange className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                <span>Workflow Plan annuel d&apos;audit · Industrie 2026</span>
                {mode !== 'integrale' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-sky-300">
                      {metrics.nbMissions} missions
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-slate-300">
                      Moy. {metrics.avgDurationWeeks} sem. / {metrics.avgAuditorsPerMission} auditeurs
                    </span>
                  </>
                )}
              </div>
              <h2 className="mt-0.5 truncate font-display text-base font-semibold text-white">
                {mode === 'integrale'
                  ? 'Détail du Plan annuel d’audit (10 colonnes clés)'
                  : 'Pilotage Plan d’Audit Annuel, Planification 08h/j & Gantt Multi-Niveau'}
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {mode !== 'integrale' && (
                <div className="hidden xl:flex items-center gap-4 border-r border-slate-700 pr-4 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Avancement</div>
                    <div className="font-mono font-semibold text-white tabular-nums">
                      {metrics.avgProgressionPct}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Normal</div>
                    <div className="font-mono font-semibold text-emerald-400 tabular-nums">
                      {metrics.countNormal}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">En avance</div>
                    <div className="font-mono font-semibold text-sky-400 tabular-nums">
                      {metrics.countAhead}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">En retard</div>
                    <div className="font-mono font-semibold text-red-400 tabular-nums">
                      {metrics.countLate}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Écart cumulé</div>
                    <div className="font-mono font-semibold text-amber-300 tabular-nums">
                      {metrics.totalVarianceHours > 0
                        ? `+${metrics.totalVarianceHours}h`
                        : `${metrics.totalVarianceHours}h`}
                    </div>
                  </div>
                </div>
              )}

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer le panneau Plan annuel d’audit"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Navigation entre les 5 vues du Workflow Plan annuel d'audit */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div
              role="tablist"
              aria-label="Vues du Plan annuel d'audit"
              className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-800 p-1"
            >
              {(
                [
                  { id: 'integrer', label: 'Intégrer le plan d’audit', icon: FileSpreadsheet },
                  { id: 'integrale', label: 'Plan d’audit intégrale', icon: FolderKanban },
                  { id: 'planification', label: 'Planification des tâches', icon: ListTodo },
                  { id: 'gantt-mission', label: 'Gantt par Mission (Niv. 1)', icon: Layers },
                  { id: 'gantt-annuel', label: 'Gantt Plan annuel (Niv. 2)', icon: GanttChart },
                ] as Array<{
                  id: AuditPlanPanelMode;
                  label: string;
                  icon: React.ComponentType<{ className?: string }>;
                }>
              ).map((tab) => {
                const Icon = tab.icon;
                const isActive = mode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setMode(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-300 hover:bg-slate-700/70 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {mode !== 'integrale' && (
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-xs bg-sky-500" aria-hidden="true" />
                  <span>En avance</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" aria-hidden="true" />
                  <span>Progression normale</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-xs bg-red-500" aria-hidden="true" />
                  <span>En retard</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Corps scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        {/* Bandeau KPI synthétique 4 colonnes (masqué dans Détail du plan) */}
        {mode !== 'integrale' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500">Missions &amp; Risques critiques</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {metrics.nbMissions}
                </span>
                <span className="text-xs text-red-700 font-medium tabular-nums">
                  {metrics.criticalCount} critiques
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500">Budget / Heures pointées</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {metrics.totalActualHours}h
                </span>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  / {metrics.totalBudgetHours}h
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500">Tâches auditeurs (08h/j)</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {metrics.doneTasks}/{metrics.totalTasks}
                </span>
                <span className="text-xs text-slate-500">clôturées</span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500">Écart moyen planning</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`font-mono text-lg font-bold tabular-nums ${
                    metrics.avgVarianceDays > 0
                      ? 'text-red-700'
                      : metrics.avgVarianceDays < 0
                      ? 'text-sky-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {metrics.avgVarianceDays > 0
                    ? `+${metrics.avgVarianceDays} j`
                    : `${metrics.avgVarianceDays} j`}
                </span>
                <span className="text-xs text-slate-500">
                  ({metrics.countLate} en retard · {metrics.countAhead} en avance)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            VUE 1 : INTÉGRER LE PLAN D'AUDIT (TABLEAU 10 COLONNES + GÉNÉRATEUR 10-15)
        ================================================================ */}
        {mode === 'integrer' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span>Nb missions à injecter (10–15) :</span>
                  <input
                    type="number"
                    min={10}
                    max={15}
                    value={injectCount}
                    onChange={(e) =>
                      setInjectCount(
                        Math.min(15, Math.max(10, Number.parseInt(e.target.value, 10) || 12))
                      )
                    }
                    className="w-16 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-center font-mono text-xs text-slate-900"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    if (planNatureNode) {
                      onInjectPlanMissions(planNatureNode.id, injectCount);
                    }
                  }}
                  disabled={!planNatureNode}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-40 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Intégrer / Générer {injectCount} missions Industrie 2026</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrer mission, direction, auditeur..."
                  aria-label="Filtrer les missions du plan d’audit"
                  className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-blue-600"
                />
                <select
                  value={scheduleFilter}
                  onChange={(e) =>
                    setScheduleFilter(e.target.value as 'all' | AuditPlanScheduleStatus)
                  }
                  aria-label="Filtrer par état de progression"
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                >
                  <option value="all">Tous les états ({missions.length})</option>
                  <option value="en-avance">En avance ({metrics.countAhead})</option>
                  <option value="normal">Progression normale ({metrics.countNormal})</option>
                  <option value="en-retard">En retard ({metrics.countLate})</option>
                </select>
              </div>
            </div>

            {/* Tableau 10 colonnes du Plan annuel d'audit */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[1040px] border-collapse text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-700">
                  <tr>
                    <th className="px-3 py-2.5">1. Code</th>
                    <th className="px-3 py-2.5">2. Mission d&apos;audit</th>
                    <th className="px-3 py-2.5">3. Direction</th>
                    <th className="px-3 py-2.5">4. Objectif principal</th>
                    <th className="px-3 py-2.5">5. Risque</th>
                    <th className="px-3 py-2.5">6. Équipe (Auditeurs)</th>
                    <th className="px-3 py-2.5 text-right">7. Durée</th>
                    <th className="px-3 py-2.5">8. Début</th>
                    <th className="px-3 py-2.5">9. Fin prévue</th>
                    <th className="px-3 py-2.5">10. Avancement &amp; Écart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredMissions.map((m) => (
                    <tr
                      key={m.node.id}
                      className="transition-colors hover:bg-blue-50/40"
                    >
                      <td className="px-3 py-2 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {m.meta.code}
                      </td>
                      <td className="px-3 py-2 max-w-[230px]">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMissionId(m.node.id);
                            setMode('integrale');
                          }}
                          className="text-left font-medium text-blue-800 hover:underline cursor-pointer"
                        >
                          {m.node.label.replace(`${m.meta.code} · `, '')}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-slate-700 max-w-[160px]">
                        {m.meta.direction}
                      </td>
                      <td className="px-3 py-2 text-slate-600 max-w-[240px]">
                        <span className="line-clamp-2" title={m.meta.objectif}>
                          {m.meta.objectif}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={`font-medium ${
                            m.meta.risque === 'Critique'
                              ? 'text-red-700'
                              : m.meta.risque === 'Élevé'
                              ? 'text-amber-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {m.meta.risque}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">
                        {m.meta.nbAuditeurs} ({m.meta.auditeurs.join(', ')})
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                        {m.meta.dureeSemaines} sem.
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatDateFr(m.meta.dateDebut)}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatDateFr(m.meta.dateFinPrevue)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold tabular-nums text-slate-900">
                            {m.meta.progressionPct}%
                          </span>
                          {renderScheduleStatusBadge(m.meta.statutProgression, m.meta.ecartJours)}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMissionId(m.node.id);
                              setMode('gantt-mission');
                            }}
                            title="Voir le Gantt multi-niveau de cette mission"
                            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:border-blue-600 hover:text-blue-700 cursor-pointer"
                          >
                            Gantt
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredMissions.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                        Aucune mission ne correspond aux filtres. Cliquez sur « Intégrer / Générer » pour peupler le plan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================
            VUE 2 : PLAN D'AUDIT INTÉGRALE (10 COLONNES CLÉS DU TABLEAU EXCEL, SANS METRICS NI GANTT)
        ================================================================ */}
        {mode === 'integrale' && selectedMission && (() => {
          const m = selectedMission.meta;
          const cleanMissionTitle = selectedMission.node.label.startsWith(`${m.code} · `)
            ? selectedMission.node.label.slice(`${m.code} · `.length)
            : selectedMission.node.label;

          const allTabIds = [
            'col-code',
            'col-mission',
            'col-direction',
            'col-objectif',
            'col-risque',
            'col-equipe',
            'col-duree',
            'col-debut',
            'col-fin',
            'col-avancement',
          ];

          const accordionTabs: Array<{
            id: string;
            label: string;
            icon: React.ComponentType<{ className?: string }>;
          }> = [
            { id: 'col-code', label: '1. Code', icon: Hash },
            { id: 'col-mission', label: '2. Mission d’audit', icon: Briefcase },
            { id: 'col-direction', label: '3. Direction', icon: Building2 },
            { id: 'col-objectif', label: '4. Objectif principal', icon: Target },
            { id: 'col-risque', label: '5. Risque', icon: ShieldAlert },
            { id: 'col-equipe', label: '6. Équipe (Auditeurs)', icon: Users },
            { id: 'col-duree', label: '7. Durée', icon: Clock },
            { id: 'col-debut', label: '8. Début', icon: CalendarRange },
            { id: 'col-fin', label: '9. Fin prévue', icon: CalendarRange },
            { id: 'col-avancement', label: '10. Avancement & Écart', icon: TrendingUp },
          ];

          const renderFormButtons = () => (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => setEditingAccordionId(null)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
            </div>
          );

          const renderTabBody = (tabId: string) => {
            const isEditing = editingAccordionId === tabId;

            if (tabId === 'col-code') {
              if (isEditing) {
                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onUpdateMissionMeta?.(selectedMission.node.id, {
                        code: editCodeDraft,
                        secteur: editSecteurDraft,
                        exercice: editExerciceDraft,
                      });
                      setEditingAccordionId(null);
                    }}
                    className="space-y-2.5 text-xs"
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <label className="block">
                        <span className="text-[11px] text-slate-500">Code</span>
                        <input
                          type="text"
                          value={editCodeDraft}
                          onChange={(e) => setEditCodeDraft(e.target.value)}
                          className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-500">Secteur</span>
                        <input
                          type="text"
                          value={editSecteurDraft}
                          onChange={(e) => setEditSecteurDraft(e.target.value)}
                          className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-500">Exercice</span>
                        <input
                          type="text"
                          value={editExerciceDraft}
                          onChange={(e) => setEditExerciceDraft(e.target.value)}
                          className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </label>
                    </div>
                    {renderFormButtons()}
                  </form>
                );
              }
              return (
                <div className="space-y-1 text-[13px] text-slate-700">
                  <div className="font-mono font-medium text-slate-900">{m.code}</div>
                  <div className="text-xs text-slate-500">
                    Mission n° {m.no} · Secteur {m.secteur} · Exercice {m.exercice}
                  </div>
                </div>
              );
            }

            if (tabId === 'col-mission') {
              if (isEditing) {
                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onUpdateMissionMeta?.(selectedMission.node.id, {
                        titre: editTitreDraft,
                      });
                      setEditingAccordionId(null);
                    }}
                    className="space-y-2.5 text-xs"
                  >
                    <label className="block">
                      <span className="text-[11px] text-slate-500">Intitulé de la mission</span>
                      <input
                        type="text"
                        value={editTitreDraft}
                        onChange={(e) => setEditTitreDraft(e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </label>
                    {renderFormButtons()}
                  </form>
                );
              }
              return (
                <div className="text-[13px] text-slate-800">{cleanMissionTitle}</div>
              );
            }

            if (tabId === 'col-direction') {
              if (isEditing) {
                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onUpdateMissionMeta?.(selectedMission.node.id, {
                        direction: editDirectionDraft,
                        perimetre: editPerimetreDraft,
                      });
                      setEditingAccordionId(null);
                    }}
                    className="space-y-2.5 text-xs"
                  >
                    <label className="block">
                      <span className="text-[11px] text-slate-500">Direction</span>
                      <input
                        type="text"
                        value={editDirectionDraft}
                        onChange={(e) => setEditDirectionDraft(e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-500">Périmètre</span>
                      <textarea
                        rows={2}
                        value={editPerimetreDraft}
                        onChange={(e) => setEditPerimetreDraft(e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </label>
                    {renderFormButtons()}
                  </form>
                );
              }
              return (
                <div className="space-y-1 text-[13px] text-slate-700">
                  <div className="text-slate-900">{m.direction}</div>
                  {m.perimetre && (
                    <div className="text-xs text-slate-500">{m.perimetre}</div>
                  )}
                </div>
              );
            }

            if (tabId === 'col-objectif') {
              if (isEditing) {
                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onUpdateMissionMeta?.(selectedMission.node.id, {
                        objectif: editObjectifDraft,
                      });
                      setEditingAccordionId(null);
                    }}
                    className="space-y-2.5 text-xs"
                  >
                    <label className="block">
                      <span className="text-[11px] text-slate-500">Objectif principal</span>
                      <textarea
                        rows={2}
                        value={editObjectifDraft}
                        onChange={(e) => setEditObjectifDraft(e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </label>
                    {renderFormButtons()}
                  </form>
                );
              }
              return (
                <div className="text-[13px] text-slate-700">{m.objectif}</div>
              );
            }

            if (tabId === 'col-risque') {
              if (isEditing) {
                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onUpdateMissionMeta?.(selectedMission.node.id, {
                        risque: editRisqueDraft,
                      });
                      setEditingAccordionId(null);
                    }}
                    className="space-y-2.5 text-xs"
                  >
                    <label className="block max-w-xs">
                      <span className="text-[11px] text-slate-500">Niveau de risque</span>
                      <select
                        value={editRisqueDraft}
                        onChange={(e) =>
                          setEditRisqueDraft(e.target.value as AuditPlanMissionMeta['risque'])
                        }
                        className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      >
                        <option value="Critique">Critique</option>
                        <option value="Élevé">Élevé</option>
                        <option value="Moyen">Moyen</option>
                        <option value="Faible">Faible</option>
                      </select>
                    </label>
                    {renderFormButtons()}
                  </form>
                );
              }
              return (
                <div className="text-[13px] font-medium text-slate-800">{m.risque}</div>
              );
            }

            if (tabId === 'col-equipe') {
              if (isEditing) {
                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const cleanAuds =
                        editAuditeursDraft.length > 0 ? editAuditeursDraft : [editChefDraft || 'SEK'];
                      onUpdateMissionMeta?.(selectedMission.node.id, {
                        chefMission: editChefDraft,
                        auditeurs: cleanAuds,
                        nbAuditeurs: cleanAuds.length,
                      });
                      setEditingAccordionId(null);
                    }}
                    className="space-y-2.5 text-xs"
                  >
                    <label className="block max-w-xs">
                      <span className="text-[11px] text-slate-500">Chef de mission</span>
                      <select
                        value={editChefDraft}
                        onChange={(e) => setEditChefDraft(e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                      >
                        {DEFAULT_AUDITOR_PROFILES.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.code} · {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <span className="block text-[11px] text-slate-500 mb-1">
                        Auditeurs affectés ({editAuditeursDraft.length})
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {DEFAULT_AUDITOR_PROFILES.map((p) => {
                          const checked = editAuditeursDraft.includes(p.code);
                          return (
                            <label
                              key={p.code}
                              className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setEditAuditeursDraft((prev) =>
                                    checked
                                      ? prev.filter((c) => c !== p.code)
                                      : [...prev, p.code]
                                  )
                                }
                                className="accent-blue-600"
                              />
                              <span className="font-mono">{p.code}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    {renderFormButtons()}
                  </form>
                );
              }
              return (
                <div className="space-y-1 text-[13px] text-slate-700">
                  <div className="font-mono tabular-nums text-slate-900">
                    {m.nbAuditeurs} auditeurs · {m.auditeurs.join(', ')}
                  </div>
                  <div className="text-xs text-slate-500">
                    Chef de mission : {m.chefMission}
                  </div>
                </div>
              );
            }

            if (tabId === 'col-duree') {
              if (isEditing) {
                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onUpdateMissionMeta?.(selectedMission.node.id, {
                        dureeSemaines: editDureeDraft,
                      });
                      setEditingAccordionId(null);
                    }}
                    className="space-y-2.5 text-xs"
                  >
                    <label className="block max-w-xs">
                      <span className="text-[11px] text-slate-500">Durée (semaines)</span>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={editDureeDraft}
                        onChange={(e) =>
                          setEditDureeDraft(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
                        }
                        className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
                      />
                    </label>
                    {renderFormButtons()}
                  </form>
                );
              }
              return (
                <div className="font-mono tabular-nums text-[13px] text-slate-800">
                  {m.dureeSemaines} semaine{m.dureeSemaines > 1 ? 's' : ''}
                </div>
              );
            }

            if (tabId === 'col-debut') {
              if (isEditing) {
                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onUpdateMissionMeta?.(selectedMission.node.id, {
                        dateDebut: editDebutDraft,
                      });
                      setEditingAccordionId(null);
                    }}
                    className="space-y-2.5 text-xs"
                  >
                    <label className="block max-w-xs">
                      <span className="text-[11px] text-slate-500">Date de début</span>
                      <input
                        type="date"
                        value={editDebutDraft}
                        onChange={(e) => setEditDebutDraft(e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
                      />
                    </label>
                    {renderFormButtons()}
                  </form>
                );
              }
              return (
                <div className="font-mono tabular-nums text-[13px] text-slate-800">
                  {formatDateFr(m.dateDebut)}
                </div>
              );
            }

            if (tabId === 'col-fin') {
              if (isEditing) {
                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onUpdateMissionMeta?.(selectedMission.node.id, {
                        dateFinPrevue: editFinPrevueDraft,
                        dateFinReelle: editFinReelleDraft,
                      });
                      setEditingAccordionId(null);
                    }}
                    className="space-y-2.5 text-xs"
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-w-md">
                      <label className="block">
                        <span className="text-[11px] text-slate-500">Date fin prévue</span>
                        <input
                          type="date"
                          value={editFinPrevueDraft}
                          onChange={(e) => setEditFinPrevueDraft(e.target.value)}
                          className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-slate-900"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-500">Date fin réelle / estimée</span>
                        <input
                          type="date"
                          value={editFinReelleDraft}
                          onChange={(e) => setEditFinReelleDraft(e.target.value)}
                          className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-slate-900"
                        />
                      </label>
                    </div>
                    {renderFormButtons()}
                  </form>
                );
              }
              return (
                <div className="space-y-1 text-[13px] font-mono tabular-nums text-slate-800">
                  <div>{formatDateFr(m.dateFinPrevue)}</div>
                  {m.dateFinReelle && m.dateFinReelle !== m.dateFinPrevue && (
                    <div className="text-xs text-slate-500">
                      Fin réelle / estimée : {formatDateFr(m.dateFinReelle)}
                    </div>
                  )}
                </div>
              );
            }

            // col-avancement (10. Avancement & Écart)
            if (isEditing) {
              return (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onUpdateMissionMeta?.(selectedMission.node.id, {
                      progressionPct: editProgDraft,
                      dateFinReelle: editFinReelleDraft,
                    });
                    setEditingAccordionId(null);
                  }}
                  className="space-y-2.5 text-xs"
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-w-md">
                    <label className="block">
                      <span className="text-[11px] text-slate-500">Avancement (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editProgDraft}
                        onChange={(e) =>
                          setEditProgDraft(
                            Math.min(100, Math.max(0, Number.parseInt(e.target.value, 10) || 0))
                          )
                        }
                        className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-500">Date fin réelle / estimée</span>
                      <input
                        type="date"
                        value={editFinReelleDraft}
                        onChange={(e) => setEditFinReelleDraft(e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-slate-900"
                      />
                    </label>
                  </div>
                  {renderFormButtons()}
                </form>
              );
            }
            return (
              <div className="font-mono tabular-nums text-[13px] text-slate-800">
                Avancement : {m.progressionPct}% · Écart : {formatVarianceText(m.ecartJours)}
              </div>
            );
          };

          return (
            <div className="space-y-3">
              {/* Sélecteur simple de mission sans metrics ni gantt */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <label className="text-xs font-medium text-slate-600">
                    Mission :
                  </label>
                  <select
                    value={selectedMission.node.id}
                    onChange={(e) => setSelectedMissionId(e.target.value)}
                    className="max-w-md rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-900"
                  >
                    {missions.map((mi) => (
                      <option key={mi.node.id} value={mi.node.id}>
                        {mi.node.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setExpandedAccordionIds((prev) =>
                      prev.size >= allTabIds.length ? new Set() : new Set(allTabIds)
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {expandedAccordionIds.size >= allTabIds.length
                    ? 'Tout replier'
                    : 'Tout déplier'}
                </button>
              </div>

              {/* Menu accordéon blanc épuré : les 10 colonnes clés du tableau Plan annuel d'audit */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2.5 space-y-1">
                {accordionTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isTabExpanded = expandedAccordionIds.has(tab.id);
                  const isTabHighlighted =
                    activeAccordionId === tab.id || editingAccordionId === tab.id;

                  return (
                    <div key={tab.id} className="rounded-lg">
                      <div
                        className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors ${
                          isTabHighlighted ? 'bg-blue-50/75' : 'hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleAccordionTab(tab.id)}
                          aria-expanded={isTabExpanded}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
                        >
                          {isTabExpanded ? (
                            <ChevronDown
                              className="h-4 w-4 shrink-0 text-slate-500"
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronRight
                              className="h-4 w-4 shrink-0 text-slate-400"
                              aria-hidden="true"
                            />
                          )}
                          <Icon
                            className={`h-4 w-4 shrink-0 ${
                              isTabHighlighted ? 'text-blue-600' : 'text-slate-500'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="truncate text-sm font-medium text-slate-800">
                            {tab.label}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingAccordionTab(tab.id);
                          }}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap cursor-pointer"
                        >
                          <SquarePen className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                          <span>Modifier</span>
                        </button>
                      </div>

                      {isTabExpanded && (
                        <div className="ml-6 border-l border-slate-200 pl-6 pr-3 py-2.5 my-1">
                          {renderTabBody(tab.id)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ================================================================
            VUE 3 : PLANIFICATION DES TÂCHES (MISSION -> PHASE -> ÉTAPE + DATES + ÉCART AUTO)
        ================================================================ */}
        {mode === 'planification' && selectedMission && selectedPhase && selectedStep && (
          <div className="space-y-4">
            {/* Sélecteurs hiérarchiques : Mission / Phase (3) / Étape (17) */}
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3.5 md:grid-cols-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  1. Mission d&apos;audit
                </label>
                <select
                  value={selectedMission.node.id}
                  onChange={(e) => setSelectedMissionId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-900"
                >
                  {missions.map((m) => (
                    <option key={m.node.id} value={m.node.id}>
                      {m.meta.code} · {m.node.label.replace(`${m.meta.code} · `, '')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  2. Phase de mission (3 phases)
                </label>
                <select
                  value={selectedPhase.node.id}
                  onChange={(e) => {
                    const nextP = selectedMission.phases.find(
                      (p) => p.node.id === e.target.value
                    );
                    setSelectedPhaseId(e.target.value);
                    if (nextP?.steps[0]) setSelectedStepId(nextP.steps[0].node.id);
                  }}
                  className="w-full rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-900"
                >
                  {selectedMission.phases.map((p) => (
                    <option key={p.node.id} value={p.node.id}>
                      {p.phaseName} ({p.steps.length} étapes)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  3. Étape de mission
                </label>
                <select
                  value={selectedStep.node.id}
                  onChange={(e) => setSelectedStepId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-900"
                >
                  {selectedPhase.steps.map((s) => (
                    <option key={s.node.id} value={s.node.id}>
                      {s.stepNumber}. {s.node.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Éditeur des dates de l'étape sélectionnée */}
            <div className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <span className="font-semibold text-slate-900">
                  Période de l&apos;étape : {selectedStep.stepNumber}. {selectedStep.node.label}
                </span>
                {renderScheduleStatusBadge(
                  selectedStep.statutProgression,
                  selectedStep.ecartJours
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">
                    Date début étape
                  </label>
                  <input
                    type="date"
                    value={stepStartDraft}
                    onChange={(e) => setStepStartDraft(e.target.value)}
                    className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">
                    Date fin prévue étape
                  </label>
                  <input
                    type="date"
                    value={stepEndDraft}
                    onChange={(e) => setStepEndDraft(e.target.value)}
                    className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">
                    Date fin réelle / révisée
                  </label>
                  <input
                    type="date"
                    value={stepRealEndDraft}
                    onChange={(e) => setStepRealEndDraft(e.target.value)}
                    className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateStepDates(
                      selectedStep.node.id,
                      stepStartDraft,
                      stepEndDraft,
                      stepRealEndDraft
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Mettre à jour dates étape (impacte Gantts)</span>
                </button>
              </div>
            </div>

            {/* Formulaire ajout tâche quotidienne sur plage 08h/j */}
            <form
              onSubmit={handleCreateTask}
              className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="font-semibold text-slate-900">
                  Ajouter une tâche quotidienne d&apos;audit (répartition base 08h / jour ouvrable)
                </div>
                <div className="font-mono text-[11px] text-slate-600 tabular-nums">
                  Équivalent : {plannedTaskHoursComputed}h · Écart simulé :{' '}
                  <span
                    className={
                      previewVarianceHours > 0
                        ? 'font-semibold text-red-700'
                        : previewVarianceHours < 0
                        ? 'font-semibold text-sky-700'
                        : 'font-semibold text-emerald-700'
                    }
                  >
                    {previewVarianceHours > 0
                      ? `+${previewVarianceHours}h`
                      : `${previewVarianceHours}h`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">
                    Modèle de tâche spécifique (19 exemples)
                  </label>
                  <select
                    value={taskPreset}
                    onChange={(e) => {
                      setTaskPreset(e.target.value);
                      setTaskTitleDraft(e.target.value);
                    }}
                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900"
                  >
                    {AUDIT_PLAN_STEP_TASK_EXAMPLES.map((ex) => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">
                    Intitulé de la tâche d&apos;audit
                  </label>
                  <input
                    type="text"
                    required
                    value={taskTitleDraft}
                    onChange={(e) => setTaskTitleDraft(e.target.value)}
                    placeholder="Intitulé de la tâche quotidienne..."
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Auditeur</label>
                  <select
                    value={taskAuditorDraft}
                    onChange={(e) => setTaskAuditorDraft(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs"
                  >
                    {DEFAULT_AUDITOR_PROFILES.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Unité</label>
                  <select
                    value={taskUnitDraft}
                    onChange={(e) =>
                      setTaskUnitDraft(e.target.value as AuditPlanTaskUnit)
                    }
                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs"
                  >
                    <option value="heure">Heures</option>
                    <option value="jour">Jours (8h/j)</option>
                    <option value="semaine">Semaines (40h)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">
                    Durée prévue
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={taskQuantityDraft}
                    onChange={(e) =>
                      setTaskQuantityDraft(Number.parseFloat(e.target.value) || 1)
                    }
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Date début</label>
                  <input
                    type="date"
                    value={taskStartDraft}
                    onChange={(e) => setTaskStartDraft(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">
                    Date fin prévue
                  </label>
                  <input
                    type="date"
                    value={taskPlannedEndDraft}
                    onChange={(e) => setTaskPlannedEndDraft(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">
                    Heure départ
                  </label>
                  <select
                    value={taskStartHourDraft}
                    onChange={(e) =>
                      setTaskStartHourDraft(Number.parseInt(e.target.value, 10) || 8)
                    }
                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs"
                  >
                    {[8, 9, 10, 11, 13, 14, 15, 16].map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}h00
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">
                    Heures réelles (opt.)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="Auto"
                    value={taskActualHoursDraft}
                    onChange={(e) => setTaskActualHoursDraft(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    La répartition quotidienne par auditeur s&apos;inscrit dans la plage de 08 h / jour ouvrable et met à jour les deux niveaux de Gantt.
                  </span>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ajouter la tâche</span>
                </button>
              </div>
            </form>

            {/* Liste des tâches planifiées sur l'étape */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-700">
                  <tr>
                    <th className="px-3 py-2">Tâche d&apos;audit</th>
                    <th className="px-3 py-2">Auditeur</th>
                    <th className="px-3 py-2">Début → Fin prévue</th>
                    <th className="px-3 py-2 text-right">Prévu (08h/j)</th>
                    <th className="px-3 py-2 text-right">Réel (h)</th>
                    <th className="px-3 py-2 text-right">Écart auto</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedStep.tasks.map((task) => {
                    const variance = task.varianceHours;
                    const schedStatus: AuditPlanScheduleStatus =
                      task.scheduleStatus ||
                      (variance !== undefined && variance > 0
                        ? 'en-retard'
                        : variance !== undefined && variance < 0
                        ? 'en-avance'
                        : 'normal');
                    return (
                      <tr key={task.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {task.title}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-700">
                          {task.auditor}
                        </td>
                        <td className="px-3 py-2 font-mono tabular-nums text-slate-600">
                          {formatDateFr(task.plannedDate)} →{' '}
                          {formatDateFr(task.plannedEndDate || task.plannedDate)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {task.plannedDurationHours}h (
                          {formatHoursInUnit(
                            task.plannedDurationHours,
                            task.unit || 'heure'
                          )}
                          )
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={
                              task.actualHours !== undefined ? task.actualHours : ''
                            }
                            placeholder={String(task.plannedDurationHours)}
                            aria-label={`Heures réelles pour ${task.title}`}
                            onChange={(e) => {
                              const v = Number.parseFloat(e.target.value);
                              if (Number.isNaN(v)) return;
                              onUpdateTodoTask(
                                selectedStep.node.id,
                                task.id,
                                { actualHours: round2(Math.max(0, v)), status: 'done' },
                                'Heures réelles plan d’audit ajustées'
                              );
                            }}
                            className="w-16 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-right font-mono text-xs"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          <span className={AUDIT_PLAN_SCHEDULE_META[schedStatus].textClass}>
                            {variance === undefined
                              ? '0h'
                              : variance > 0
                              ? `+${variance}h`
                              : `${variance}h`}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={task.status}
                            onChange={(e) =>
                              onUpdateTodoTask(
                                selectedStep.node.id,
                                task.id,
                                { status: e.target.value as TodoTaskStatus },
                                'Statut tâche mis à jour'
                              )
                            }
                            aria-label={`Statut pour ${task.title}`}
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px]"
                          >
                            <option value="todo">À faire</option>
                            <option value="in-progress">En cours</option>
                            <option value="done">Terminé</option>
                            <option value="blocked">Bloqué</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              onDeleteTodoTask(selectedStep.node.id, task.id)
                            }
                            aria-label={`Supprimer ${task.title}`}
                            className="inline-flex items-center justify-center rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {selectedStep.tasks.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                        Aucune tâche sur cette étape. Utilisez le formulaire ci-dessus pour ajouter les tâches quotidiennes des auditeurs.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================
            VUE 4 : GANTT NIVEAU 1 — GANTT PAR MISSION (MISSION -> PHASE -> ÉTAPE -> AUDITEUR -> TÂCHES 08H/J)
        ================================================================ */}
        {mode === 'gantt-mission' && selectedMission && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5 text-xs">
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="font-medium text-slate-700">Mission :</label>
                <select
                  value={selectedMission.node.id}
                  onChange={(e) => setSelectedMissionId(e.target.value)}
                  className="max-w-sm rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-900"
                >
                  {missions.map((m) => (
                    <option key={m.node.id} value={m.node.id}>
                      {m.node.label}
                    </option>
                  ))}
                </select>
                {renderScheduleStatusBadge(
                  selectedMission.meta.statutProgression,
                  selectedMission.meta.ecartJours
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center rounded-md bg-slate-100 p-0.5">
                  {(
                    [
                      { id: 'heure', label: 'Heures (08h/j)' },
                      { id: 'jour', label: 'Jours' },
                      { id: 'semaine', label: 'Semaines' },
                    ] as Array<{ id: AuditPlanTaskUnit; label: string }>
                  ).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setGanttUnit(u.id)}
                      className={`rounded px-2 py-1 text-[11px] font-medium cursor-pointer ${
                        ganttUnit === u.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={expandAllGanttMission}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Tout déplier
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedGanttKeys(new Set([`m:${selectedMission.node.id}`]))}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Replier étapes
                </button>
              </div>
            </div>

            {/* Gantt Hiérarchique Multi-Niveau */}
            {(() => {
              const mStartDay = dayOfYear2026(selectedMission.meta.dateDebut);
              const mEndRef =
                selectedMission.meta.dateFinReelle &&
                selectedMission.meta.dateFinReelle > selectedMission.meta.dateFinPrevue
                  ? selectedMission.meta.dateFinReelle
                  : selectedMission.meta.dateFinPrevue;
              const mEndDay = Math.max(mStartDay + 14, dayOfYear2026(mEndRef) + 2);
              const totalSpan = Math.max(15, mEndDay - mStartDay + 1);

              const pctPos = (iso: string) => {
                const d = dayOfYear2026(iso);
                return Math.max(0, Math.min(100, ((d - mStartDay) / totalSpan) * 100));
              };
              const pctWidth = (startIso: string, endIso: string) => {
                const s = dayOfYear2026(startIso);
                const e = Math.max(s + 1, dayOfYear2026(endIso) + 1);
                return Math.max(2.5, Math.min(100, ((e - s) / totalSpan) * 100));
              };

              const mKey = `m:${selectedMission.node.id}`;
              const isMissionOpen = expandedGanttKeys.has(mKey);
              const weekLabels = Array.from(
                { length: Math.max(3, Math.ceil(totalSpan / 7)) },
                (_, idx) => `Sem. ${idx + 1}`
              );

              return (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <div className="min-w-[880px]">
                    {/* En-tête Timeline Mission */}
                    <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-700">
                      <div className="col-span-5 border-r border-slate-200 px-3 py-2">
                        Hiérarchie : Mission → Phase → Étape → Auditeur (08h/j) → Tâches
                      </div>
                      <div className="col-span-2 border-r border-slate-200 px-2 py-2 text-right font-mono">
                        Charge / Écart
                      </div>
                      <div className="col-span-5 grid px-2 py-2" style={{ gridTemplateColumns: `repeat(${weekLabels.length}, minmax(0, 1fr))` }}>
                        {weekLabels.map((wl) => (
                          <div key={wl} className="border-l border-slate-200/80 pl-1 font-mono text-[10px] text-slate-600">
                            {wl}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ligne Niveau Mission */}
                    <div className="grid grid-cols-12 items-center border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900">
                      <div className="col-span-5 flex items-center gap-1.5 border-r border-slate-200 px-2.5 py-2">
                        <button
                          type="button"
                          onClick={() => toggleGanttKey(mKey)}
                          className="rounded p-0.5 hover:bg-slate-200 cursor-pointer"
                          aria-label="Déplier la mission"
                        >
                          {isMissionOpen ? (
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>
                        <span className="truncate">{selectedMission.node.label}</span>
                      </div>
                      <div className="col-span-2 border-r border-slate-200 px-2 py-2 text-right font-mono text-[11px] tabular-nums">
                        {formatHoursInUnit(selectedMission.plannedTaskHours, ganttUnit)} ·{' '}
                        <span className={AUDIT_PLAN_SCHEDULE_META[selectedMission.meta.statutProgression].textClass}>
                          {selectedMission.meta.ecartJours > 0
                            ? `+${selectedMission.meta.ecartJours}j`
                            : `${selectedMission.meta.ecartJours}j`}
                        </span>
                      </div>
                      <div className="col-span-5 relative h-7 px-2 flex items-center">
                        <div
                          className={`relative h-4 rounded-sm ${AUDIT_PLAN_SCHEDULE_META[selectedMission.meta.statutProgression].barBg} text-[10px] text-white flex items-center px-1.5 font-mono truncate`}
                          style={{
                            marginLeft: `${pctPos(selectedMission.meta.dateDebut)}%`,
                            width: `${pctWidth(
                              selectedMission.meta.dateDebut,
                              selectedMission.meta.dateFinReelle || selectedMission.meta.dateFinPrevue
                            )}%`,
                          }}
                        >
                          {selectedMission.meta.progressionPct}%
                        </div>
                      </div>
                    </div>

                    {/* Lignes Phases */}
                    {isMissionOpen &&
                      selectedMission.phases.map((phase) => {
                        const pKey = `p:${phase.node.id}`;
                        const isPhaseOpen = expandedGanttKeys.has(pKey);
                        const phaseMeta = AUDIT_PLAN_SCHEDULE_META[phase.statutProgression];
                        return (
                          <React.Fragment key={phase.node.id}>
                            <div className="grid grid-cols-12 items-center border-b border-slate-100 bg-white text-xs font-medium text-slate-900">
                              <div className="col-span-5 flex items-center gap-1.5 border-r border-slate-200 pl-6 pr-2 py-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleGanttKey(pKey)}
                                  className="rounded p-0.5 hover:bg-slate-100 cursor-pointer"
                                  aria-label={`Déplier ${phase.phaseName}`}
                                >
                                  {isPhaseOpen ? (
                                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                                  )}
                                </button>
                                <span className="truncate">{phase.phaseName}</span>
                              </div>
                              <div className="col-span-2 border-r border-slate-200 px-2 py-1.5 text-right font-mono text-[11px] tabular-nums text-slate-600">
                                {phase.steps.length} étapes ·{' '}
                                <span className={phaseMeta.textClass}>
                                  {phase.ecartJours > 0 ? `+${phase.ecartJours}j` : `${phase.ecartJours}j`}
                                </span>
                              </div>
                              <div className="col-span-5 relative h-6 px-2 flex items-center">
                                <div
                                  className={`h-3 rounded-sm ${phaseMeta.barBg} opacity-90`}
                                  style={{
                                    marginLeft: `${pctPos(phase.dateDebut)}%`,
                                    width: `${pctWidth(phase.dateDebut, phase.dateFinReelle)}%`,
                                  }}
                                  title={`${phase.phaseName} : ${formatDateFr(phase.dateDebut)} → ${formatDateFr(phase.dateFinReelle)}`}
                                />
                              </div>
                            </div>

                            {/* Lignes Étapes */}
                            {isPhaseOpen &&
                              phase.steps.map((step) => {
                                const sKey = `s:${step.node.id}`;
                                const isStepOpen = expandedGanttKeys.has(sKey);
                                const stepMeta = AUDIT_PLAN_SCHEDULE_META[step.statutProgression];

                                // Grouper les tâches par auditeur (SEK, JFK, TAK, OHA...)
                                const byAuditor = new Map<string, MissionTodoTask[]>();
                                step.tasks.forEach((t) => {
                                  const arr = byAuditor.get(t.auditor) || [];
                                  arr.push(t);
                                  byAuditor.set(t.auditor, arr);
                                });

                                return (
                                  <React.Fragment key={step.node.id}>
                                    <div className="grid grid-cols-12 items-center border-b border-slate-100 bg-slate-50/40 text-xs text-slate-800">
                                      <div className="col-span-5 flex items-center gap-1.5 border-r border-slate-200 pl-10 pr-2 py-1.5">
                                        <button
                                          type="button"
                                          onClick={() => toggleGanttKey(sKey)}
                                          className="rounded p-0.5 hover:bg-slate-200 cursor-pointer"
                                          aria-label={`Déplier l'étape ${step.node.label}`}
                                        >
                                          {isStepOpen ? (
                                            <ChevronDown className="h-3 w-3" aria-hidden="true" />
                                          ) : (
                                            <ChevronRight className="h-3 w-3" aria-hidden="true" />
                                          )}
                                        </button>
                                        <span className="truncate" title={step.node.label}>
                                          {step.stepNumber}. {step.node.label}
                                        </span>
                                      </div>
                                      <div className="col-span-2 border-r border-slate-200 px-2 py-1.5 text-right font-mono text-[10px] tabular-nums text-slate-600">
                                        {byAuditor.size} aud. · {step.tasks.length} tâches
                                      </div>
                                      <div className="col-span-5 relative h-6 px-2 flex items-center">
                                        <div
                                          className={`h-2.5 rounded-sm ${stepMeta.barBg} opacity-80`}
                                          style={{
                                            marginLeft: `${pctPos(step.dateDebut)}%`,
                                            width: `${pctWidth(step.dateDebut, step.dateFinReelle)}%`,
                                          }}
                                          title={`${step.node.label} : ${formatDateFr(step.dateDebut)} → ${formatDateFr(step.dateFinReelle)}`}
                                        />
                                      </div>
                                    </div>

                                    {/* Lignes Auditeurs -> Tâches (base 08h/jour) */}
                                    {isStepOpen &&
                                      Array.from(byAuditor.entries()).map(([auditor, audTasks]) => {
                                        const aKey = `a:${step.node.id}:${auditor}`;
                                        const isAudOpen = expandedGanttKeys.has(aKey);
                                        const audPlanned = round2(
                                          audTasks.reduce((s, t) => s + t.plannedDurationHours, 0)
                                        );
                                        const audVar = round2(
                                          audTasks.reduce((s, t) => s + (t.varianceHours || 0), 0)
                                        );
                                        const audStatus: AuditPlanScheduleStatus =
                                          audVar > 0
                                            ? 'en-retard'
                                            : audVar < 0
                                            ? 'en-avance'
                                            : 'normal';
                                        const audMeta = AUDIT_PLAN_SCHEDULE_META[audStatus];

                                        return (
                                          <React.Fragment key={aKey}>
                                            <div className="grid grid-cols-12 items-center border-b border-slate-100 bg-white text-[11px] text-slate-800">
                                              <div className="col-span-5 flex items-center gap-1.5 border-r border-slate-200 pl-14 pr-2 py-1">
                                                <button
                                                  type="button"
                                                  onClick={() => toggleGanttKey(aKey)}
                                                  className="rounded p-0.5 hover:bg-slate-100 cursor-pointer"
                                                  aria-label={`Déplier auditeur ${auditor}`}
                                                >
                                                  {isAudOpen ? (
                                                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                                                  ) : (
                                                    <ChevronRight className="h-3 w-3" aria-hidden="true" />
                                                  )}
                                                </button>
                                                <Users className="h-3 w-3 text-slate-500" aria-hidden="true" />
                                                <span className="font-mono font-semibold text-slate-900">
                                                  {auditor}
                                                </span>
                                                <span className="text-slate-500">
                                                  ({audTasks.length} tâches · plage 08h/j)
                                                </span>
                                              </div>
                                              <div className="col-span-2 border-r border-slate-200 px-2 py-1 text-right font-mono text-[10px] tabular-nums">
                                                {formatHoursInUnit(audPlanned, ganttUnit)} ·{' '}
                                                <span className={audMeta.textClass}>
                                                  {audVar > 0 ? `+${audVar}h` : `${audVar}h`}
                                                </span>
                                              </div>
                                              <div className="col-span-5 relative h-5 px-2 flex items-center">
                                                <div
                                                  className={`h-2 rounded-sm ${audMeta.barBg} opacity-75`}
                                                  style={{
                                                    marginLeft: `${pctPos(audTasks[0].plannedDate)}%`,
                                                    width: `${pctWidth(
                                                      audTasks[0].plannedDate,
                                                      audTasks[audTasks.length - 1].plannedEndDate ||
                                                        audTasks[audTasks.length - 1].plannedDate
                                                    )}%`,
                                                  }}
                                                />
                                              </div>
                                            </div>

                                            {/* Tâches quotidiennes de l'auditeur */}
                                            {isAudOpen &&
                                              audTasks.map((t) => {
                                                const tVar = t.varianceHours || 0;
                                                const tStatus: AuditPlanScheduleStatus =
                                                  t.scheduleStatus ||
                                                  (tVar > 0
                                                    ? 'en-retard'
                                                    : tVar < 0
                                                    ? 'en-avance'
                                                    : 'normal');
                                                const tMeta = AUDIT_PLAN_SCHEDULE_META[tStatus];
                                                const tEnd = t.actualEndDate || t.plannedEndDate || t.plannedDate;

                                                return (
                                                  <div
                                                    key={t.id}
                                                    className="grid grid-cols-12 items-center border-b border-slate-100/80 bg-slate-50/30 text-[11px] text-slate-700"
                                                  >
                                                    <div className="col-span-5 flex items-center gap-2 border-r border-slate-200 pl-20 pr-2 py-1">
                                                      <span
                                                        className={`h-2 w-2 shrink-0 rounded-full ${tMeta.barBg}`}
                                                        aria-hidden="true"
                                                      />
                                                      <span className="truncate" title={t.title}>
                                                        {t.title}
                                                      </span>
                                                    </div>
                                                    <div className="col-span-2 border-r border-slate-200 px-2 py-1 text-right font-mono text-[10px] tabular-nums">
                                                      {formatHoursInUnit(t.plannedDurationHours, ganttUnit)} ·{' '}
                                                      <span className={tMeta.textClass}>
                                                        {tVar > 0 ? `+${tVar}h` : `${tVar}h`}
                                                      </span>
                                                    </div>
                                                    <div className="col-span-5 relative h-5 px-2 flex items-center">
                                                      <div
                                                        className={`h-2.5 rounded-sm ${tMeta.barBg} text-[9px] text-white px-1 font-mono flex items-center truncate`}
                                                        style={{
                                                          marginLeft: `${pctPos(t.plannedDate)}%`,
                                                          width: `${pctWidth(t.plannedDate, tEnd)}%`,
                                                        }}
                                                        title={`${t.title} (${t.plannedStartHour}h · ${t.plannedDurationHours}h prévus · écart ${tVar}h)`}
                                                      >
                                                        {String(t.plannedStartHour).padStart(2, '0')}h
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                          </React.Fragment>
                                        );
                                      })}
                                  </React.Fragment>
                                );
                              })}
                          </React.Fragment>
                        );
                      })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ================================================================
            VUE 5 : GANTT NIVEAU 2 — GANTT PLAN ANNUEL D'AUDIT (EXERCICE 2026)
        ================================================================ */}
        {mode === 'gantt-annuel' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5 text-xs">
              <div className="flex items-center gap-2">
                <GanttChart className="h-4 w-4 text-blue-700" aria-hidden="true" />
                <span className="font-semibold text-slate-900">
                  Gantt Plan annuel d&apos;audit — Exercice 2026 (Secteur Industrie · {filteredMissions.length} missions)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: 'all', label: `Toutes (${missions.length})` },
                    { id: 'en-avance', label: `En avance (${metrics.countAhead})` },
                    { id: 'normal', label: `Normal (${metrics.countNormal})` },
                    { id: 'en-retard', label: `En retard (${metrics.countLate})` },
                  ] as Array<{ id: 'all' | AuditPlanScheduleStatus; label: string }>
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setScheduleFilter(f.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                      scheduleFilter === f.id
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <div className="min-w-[1000px]">
                {/* En-tête 12 mois 2026 */}
                <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-700">
                  <div className="col-span-4 border-r border-slate-200 px-3 py-2">
                    Mission (Code · Direction · Auditeurs)
                  </div>
                  <div className="col-span-2 border-r border-slate-200 px-2 py-2 text-right font-mono">
                    Avanc. / Écart
                  </div>
                  <div className="col-span-6 grid grid-cols-12">
                    {MONTHS_2026.map((mo) => (
                      <div
                        key={mo.key}
                        className="border-l border-slate-200 py-2 text-center font-mono text-[10px]"
                      >
                        {mo.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lignes des missions sur la ligne de temps 2026 */}
                <div className="divide-y divide-slate-200">
                  {filteredMissions.map((m) => {
                    const startDoy = dayOfYear2026(m.meta.dateDebut);
                    const endRef =
                      m.meta.dateFinReelle && m.meta.dateFinReelle > m.meta.dateFinPrevue
                        ? m.meta.dateFinReelle
                        : m.meta.dateFinPrevue;
                    const endDoy = Math.max(startDoy + 7, dayOfYear2026(endRef));
                    const leftPct = (startDoy / 365) * 100;
                    const widthPct = Math.max(3, ((endDoy - startDoy) / 365) * 100);
                    const schedMeta = AUDIT_PLAN_SCHEDULE_META[m.meta.statutProgression];

                    return (
                      <div
                        key={m.node.id}
                        className="grid grid-cols-12 items-center text-xs hover:bg-blue-50/40"
                      >
                        <div className="col-span-4 border-r border-slate-200 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMissionId(m.node.id);
                              setMode('gantt-mission');
                            }}
                            className="block w-full truncate text-left font-medium text-blue-800 hover:underline cursor-pointer"
                            title="Cliquer pour ouvrir le Gantt Niveau 1 de cette mission"
                          >
                            {m.node.label}
                          </button>
                          <div className="mt-0.5 truncate text-[11px] text-slate-500">
                            {m.meta.direction} · Équipe : {m.meta.auditeurs.join(', ')} ({m.meta.dureeSemaines} sem.)
                          </div>
                        </div>

                        <div className="col-span-2 border-r border-slate-200 px-2 py-2 text-right">
                          <div className="font-mono font-semibold tabular-nums text-slate-900">
                            {m.meta.progressionPct}%
                          </div>
                          <div className={`font-mono text-[10px] tabular-nums ${schedMeta.textClass}`}>
                            {schedMeta.shortLabel} (
                            {m.meta.ecartJours > 0 ? `+${m.meta.ecartJours}j` : `${m.meta.ecartJours}j`})
                          </div>
                        </div>

                        <div className="col-span-6 relative h-10 flex items-center bg-[linear-gradient(to_right,rgba(226,232,240,0.45)_1px,transparent_1px)] bg-[length:8.3333%_100%]">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMissionId(m.node.id);
                              setMode('gantt-mission');
                            }}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            title={`${m.node.label} · ${formatDateFr(m.meta.dateDebut)} → ${formatDateFr(
                              endRef
                            )} · ${schedMeta.label}`}
                            className={`absolute h-5 rounded-sm ${schedMeta.barBg} px-1.5 text-left font-mono text-[10px] font-semibold text-white shadow-xs transition-opacity hover:opacity-90 cursor-pointer truncate`}
                          >
                            {m.meta.code}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
