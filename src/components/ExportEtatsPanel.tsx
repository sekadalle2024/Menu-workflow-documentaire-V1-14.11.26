import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  RotateCcw,
  Search,
  Square,
  X,
} from 'lucide-react';
import { WorkflowTreeNode } from '../types/workflow';
import {
  extractSuiviRecosFromTrees,
  LiveSuiviRecoEntry,
} from '../data/suiviRecosSimulation';
import {
  AUDIT_PLAN_SCHEDULE_META,
  AUDIT_PLAN_STEPS_TEMPLATE,
  extractPlanMissionsFromTrees,
  LiveAuditPlanMission,
  LivePlanStepRow,
} from '../data/auditPlanWorkflowData';
import { WORKFLOW_SIDEBAR_ITEMS } from '../data/workflowCatalog';
import { findNodeById, findNodePath } from '../utils/workflowTreeOps';
import {
  DocExportItem,
  DocExportSectionBlock,
  ExportActivityType,
  ExportColumnDef,
  ExportFormatKind,
  exportDashboardToPdf,
  exportStructuredReportToDocx,
  exportStructuredReportToPdf,
  exportTableToExcelXlsx,
  extractYearFromExercice,
  getPlanAuditExportColumns,
  getSuiviRecosExportColumns,
  inferCycleForPlanMission,
  inferCycleForReco,
  PdfBarItem,
  PdfDashboardExportPayload,
  PdfSectionBlock,
  sanitizeFilenameSegment,
  StructuredReportExportPayload,
} from '../utils/etatExportEngine';

interface ExportEtatsPanelProps {
  trees: WorkflowTreeNode[];
  wordBodies?: Record<string, string>;
  initialActivity?: ExportActivityType;
  initialMode?: ExportFormatKind;
  scopeNodeId?: string;
  clientName: string;
  userSignature: string;
  onClose: () => void;
  onStatusMessage?: (msg: string) => void;
}

type PlanTableGranularity = 'missions' | 'steps' | 'tasks';

interface PlanStepExportRow {
  rowKey: string;
  missionCode: string;
  missionTitle: string;
  exercice: string;
  direction: string;
  cycle: string;
  phaseName: string;
  stepNumber: number;
  stepLabel: string;
  dateDebut: string;
  dateFin: string;
  dateFinReelle: string;
  ecartJours: number;
  progressionPct: number;
  statutLabel: string;
  tasksCount: number;
}

interface PlanTaskExportRow {
  rowKey: string;
  missionCode: string;
  missionTitle: string;
  exercice: string;
  direction: string;
  cycle: string;
  phaseName: string;
  stepLabel: string;
  auditor: string;
  title: string;
  plannedDate: string;
  plannedEndDate: string;
  plannedHours: number;
  actualHours: number;
  varianceHours: number;
  status: string;
  crippNormRef: string;
}

interface ExtractedWorkflowDoc {
  id: string;
  node: WorkflowTreeNode;
  rootLabel: string;
  natureId: string;
  natureLabel: string;
  exerciceLabel: string;
  sectionLabel: string;
  pathLabel: string;
  signatureLabel: string;
  statusKey: string;
  statusLabel: string;
  bodyText: string;
  hasCustomBody: boolean;
}

interface ExtractedPlanStep {
  id: string;
  mission: LiveAuditPlanMission;
  step: LivePlanStepRow;
  missionTitle: string;
  cycle: string;
  crippNorm: string;
  auditorsLabel: string;
  plannedHours: number;
  actualHours: number;
}

interface KpiCategoryOption {
  id: string;
  label: string;
  description: string;
  executiveDefault?: boolean;
}

const RECO_KPI_CATEGORIES: KpiCategoryOption[] = [
  {
    id: 'recos-exec',
    label: 'KPI Exécutifs & Taux de réalisation',
    description: 'Volume total, taux de clôture %, critiques ouvertes, reports et retards.',
    executiveDefault: true,
  },
  {
    id: 'recos-statut',
    label: 'Répartition par Statut',
    description: 'Effectifs et proportions Réalisé, En attente, Reporté, Non réalisé.',
    executiveDefault: true,
  },
  {
    id: 'recos-matrix',
    label: 'Matrice Criticité × Statut',
    description: 'Croisement Critique / Majeur / Modéré par statut de mise en œuvre.',
    executiveDefault: true,
  },
  {
    id: 'recos-directions',
    label: 'Avancement par Direction',
    description: 'Volume et taux de réalisation comparés par direction auditée.',
    executiveDefault: true,
  },
  {
    id: 'recos-cycles',
    label: 'Avancement par Cycle & Mission',
    description: 'Taux d’exécution ventilé par cycle et mission source.',
  },
  {
    id: 'recos-delais',
    label: 'Échéances & Reports par mois',
    description: 'Distribution mensuelle des échéances initiales et des délais reportés.',
  },
  {
    id: 'recos-table',
    label: 'Tableau synthétique des Recommandations',
    description: 'Extrait tabulaire des recommandations incluses dans le périmètre filtré.',
  },
];

const PLAN_KPI_CATEGORIES: KpiCategoryOption[] = [
  {
    id: 'plan-exec',
    label: 'KPI Exécution du Plan Annuel',
    description: 'Missions, avancement moyen %, heures planifiées vs réalisées, écart moyen.',
    executiveDefault: true,
  },
  {
    id: 'plan-status',
    label: 'Statut Planning (Avance / Normal / Retard)',
    description: 'Répartition des missions selon le respect des délais prévus.',
    executiveDefault: true,
  },
  {
    id: 'plan-directions',
    label: 'Ventilation par Direction',
    description: 'Nombre de missions, heures et avancement moyen par direction.',
    executiveDefault: true,
  },
  {
    id: 'plan-cycles',
    label: 'Ventilation par Cycle d’audit',
    description: 'Couverture du plan annuel regroupée par cycle métier/industriel.',
    executiveDefault: true,
  },
  {
    id: 'plan-auditors',
    label: 'Charge & Performance par Auditeur (08h/j)',
    description: 'Heures planifiées vs réalisées et taux d’achèvement par auditeur.',
  },
  {
    id: 'plan-table',
    label: 'Tableau récapitulatif des Missions',
    description: 'Synthèse des colonnes clés du plan annuel sur le périmètre filtré.',
  },
];

const DOC_SECTION_OPTIONS: KpiCategoryOption[] = [
  {
    id: 'doc-meta',
    label: 'Fiche signalétique & Références Drive',
    description: 'Workflow, exercice, dossier, signataire, statut, échéance et référence Drive.',
    executiveDefault: true,
  },
  {
    id: 'doc-body',
    label: 'Corps rédactionnel / Contenu du document',
    description: 'Texte saisi dans l’éditeur Word ou note structurée de cadrage documentaire.',
    executiveDefault: true,
  },
  {
    id: 'doc-reviews',
    label: 'Notes de revue & Points de supervision',
    description: 'Tableau des observations de revue, auteurs, statuts et dates.',
    executiveDefault: true,
  },
  {
    id: 'doc-tasks',
    label: 'Tâches d’audit rattachées (08h/j)',
    description: 'Diligences planifiées sur le document, auditeurs assignés et heures.',
  },
  {
    id: 'doc-versions',
    label: 'Historique des versions & Références croisées',
    description: 'Snapshots enregistrés et liens vers d’autres documents du dossier.',
  },
];

const STEP_SECTION_OPTIONS: KpiCategoryOption[] = [
  {
    id: 'step-mission',
    label: 'Cadrage Mission (Objectif, Périmètre, Équipe)',
    description: 'Identification de la mission parente, direction, cycle et niveau de risque.',
    executiveDefault: true,
  },
  {
    id: 'step-timeline',
    label: 'Chronogramme & Suivi des écarts par Étape',
    description: 'Dates début/fin prévue/fin réelle, progression % et écart en jours ouvrés.',
    executiveDefault: true,
  },
  {
    id: 'step-tasks',
    label: 'Programme des tâches par Auditeur (08h/j)',
    description: 'Tâches quotidiennes de l’étape avec heures prévues, réalisées et écarts.',
    executiveDefault: true,
  },
  {
    id: 'step-workload',
    label: 'Synthèse de charge horaire & Norme CRIPP',
    description: 'Ventilation des heures par auditeur et référentiel normatif de l’étape.',
    executiveDefault: true,
  },
];

const PLAN_STEP_COLUMNS: Array<ExportColumnDef<PlanStepExportRow>> = [
  { key: 'missionCode', label: 'Code Mission', width: 14, isDefaultKey: true, getValue: (r) => r.missionCode },
  { key: 'missionTitle', label: 'Mission', width: 34, isDefaultKey: true, getValue: (r) => r.missionTitle },
  { key: 'exercice', label: 'Exercice', width: 10, isDefaultKey: true, getValue: (r) => r.exercice },
  { key: 'direction', label: 'Direction', width: 28, isDefaultKey: true, getValue: (r) => r.direction },
  { key: 'cycle', label: 'Cycle', width: 24, isDefaultKey: true, getValue: (r) => r.cycle },
  { key: 'phaseName', label: 'Phase', width: 22, isDefaultKey: true, getValue: (r) => r.phaseName },
  { key: 'stepNumber', label: 'N° Étape', width: 10, isDefaultKey: true, getValue: (r) => r.stepNumber },
  { key: 'stepLabel', label: 'Étape de mission', width: 36, isDefaultKey: true, getValue: (r) => r.stepLabel },
  { key: 'dateDebut', label: 'Début', width: 13, isDefaultKey: true, getValue: (r) => r.dateDebut },
  { key: 'dateFin', label: 'Fin prévue', width: 13, isDefaultKey: true, getValue: (r) => r.dateFin },
  { key: 'dateFinReelle', label: 'Fin réelle', width: 13, isDefaultKey: false, getValue: (r) => r.dateFinReelle },
  { key: 'ecartJours', label: 'Écart (j)', width: 11, isDefaultKey: true, getValue: (r) => r.ecartJours },
  { key: 'progressionPct', label: 'Avancement (%)', width: 13, isDefaultKey: true, getValue: (r) => r.progressionPct },
  { key: 'statutLabel', label: 'Statut planning', width: 18, isDefaultKey: false, getValue: (r) => r.statutLabel },
  { key: 'tasksCount', label: 'Nb tâches', width: 11, isDefaultKey: false, getValue: (r) => r.tasksCount },
];

const PLAN_TASK_COLUMNS: Array<ExportColumnDef<PlanTaskExportRow>> = [
  { key: 'missionCode', label: 'Code Mission', width: 14, isDefaultKey: true, getValue: (r) => r.missionCode },
  { key: 'missionTitle', label: 'Mission', width: 30, isDefaultKey: true, getValue: (r) => r.missionTitle },
  { key: 'direction', label: 'Direction', width: 26, isDefaultKey: true, getValue: (r) => r.direction },
  { key: 'cycle', label: 'Cycle', width: 24, isDefaultKey: true, getValue: (r) => r.cycle },
  { key: 'phaseName', label: 'Phase', width: 20, isDefaultKey: false, getValue: (r) => r.phaseName },
  { key: 'stepLabel', label: 'Étape', width: 28, isDefaultKey: true, getValue: (r) => r.stepLabel },
  { key: 'auditor', label: 'Auditeur', width: 12, isDefaultKey: true, getValue: (r) => r.auditor },
  { key: 'title', label: 'Tâche d’audit', width: 38, isDefaultKey: true, getValue: (r) => r.title },
  { key: 'plannedDate', label: 'Date début', width: 13, isDefaultKey: true, getValue: (r) => r.plannedDate },
  { key: 'plannedEndDate', label: 'Date fin prévue', width: 13, isDefaultKey: true, getValue: (r) => r.plannedEndDate },
  { key: 'plannedHours', label: 'Heures prévues', width: 14, isDefaultKey: true, getValue: (r) => r.plannedHours },
  { key: 'actualHours', label: 'Heures réelles', width: 14, isDefaultKey: true, getValue: (r) => r.actualHours },
  { key: 'varianceHours', label: 'Écart (h)', width: 11, isDefaultKey: true, getValue: (r) => r.varianceHours },
  { key: 'status', label: 'Statut tâche', width: 14, isDefaultKey: true, getValue: (r) => r.status },
  { key: 'crippNormRef', label: 'Norme CRIPP', width: 30, isDefaultKey: false, getValue: (r) => r.crippNormRef },
];

const DOC_STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  'in-progress': 'En cours',
  'in-review': 'En revue',
  validated: 'Validé',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  'in-progress': 'En cours',
  blocked: 'Bloqué',
  done: 'Terminée',
};

function parseDateSafeFrOrIso(value?: string): Date | null {
  if (!value || value === 'Néant') return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`);
  }
  const fr = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (fr) {
    return new Date(`${fr[3]}-${fr[2]}-${fr[1]}T12:00:00`);
  }
  return null;
}

const MONTH_LABELS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
];

function resolveNatureLabel(natureId?: string, fallback?: string): string {
  if (natureId) {
    const found = WORKFLOW_SIDEBAR_ITEMS.find((item) => item.id === natureId);
    if (found) return found.shortLabel;
  }
  return fallback || 'Workflow général';
}

function defaultFormatForActivity(
  act: ExportActivityType,
  requested?: ExportFormatKind
): ExportFormatKind {
  if (act === 'document' || act === 'etape-mission') {
    if (requested === 'pdf' || requested === 'docx') return requested;
    return 'docx';
  }
  if (requested === 'dashboard' || requested === 'pdf') return 'dashboard';
  return 'table';
}

export const ExportEtatsPanel: React.FC<ExportEtatsPanelProps> = ({
  trees,
  wordBodies = {},
  initialActivity = 'suivi-recos',
  initialMode = 'table',
  scopeNodeId,
  clientName,
  userSignature,
  onClose,
  onStatusMessage,
}) => {
  const [activity, setActivity] = useState<ExportActivityType>(initialActivity);
  const [formatKind, setFormatKind] = useState<ExportFormatKind>(() =>
    defaultFormatForActivity(initialActivity, initialMode)
  );
  const [pdfOrientation, setPdfOrientation] = useState<'landscape' | 'portrait'>(() =>
    initialActivity === 'document' || initialActivity === 'etape-mission'
      ? 'portrait'
      : 'landscape'
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const [openBlocks, setOpenBlocks] = useState<Set<string>>(
    () => new Set(['params', 'columns', 'rows', 'kpis'])
  );

  // Données live extraites de l'arborescence
  const allRecoEntries = useMemo(() => extractSuiviRecosFromTrees(trees), [trees]);
  const allPlanMissions = useMemo(() => extractPlanMissionsFromTrees(trees), [trees]);

  // Extraction complète des Documents du workflow
  const allWorkflowDocuments: ExtractedWorkflowDoc[] = useMemo(() => {
    const out: ExtractedWorkflowDoc[] = [];
    const seen = new Set<string>();

    const walk = (nodes: WorkflowTreeNode[], ancestors: WorkflowTreeNode[]) => {
      for (const n of nodes) {
        const nextPath = [...ancestors, n];
        if (n.nodeType === 'document' && !seen.has(n.id)) {
          seen.add(n.id);
          const rootNode = ancestors.find((a) => a.nodeType === 'root');
          const natureNode = ancestors.find((a) => a.nodeType === 'nature');
          const exNode = [...ancestors].reverse().find((a) => a.nodeType === 'exercice');
          const folderAncestors = ancestors.filter(
            (a) =>
              a.nodeType === 'activite' ||
              a.nodeType === 'section' ||
              a.nodeType === 'sous-section'
          );
          const sigNode = [...ancestors].reverse().find((a) => a.nodeType === 'signature');

          const nId = n.natureId || natureNode?.natureId || 'general';
          const nLabel = resolveNatureLabel(nId, natureNode?.label);
          const exLabel = exNode?.label || 'Permanent / Sans exercice';
          const secLabel =
            folderAncestors.length > 0
              ? folderAncestors.map((a) => a.label).join(' / ')
              : exLabel;
          const sig =
            n.signature || n.owner || sigNode?.signature || sigNode?.label || userSignature;
          const stKey = n.status || 'todo';
          const rawBody = (wordBodies[n.id] ?? '').trim();

          out.push({
            id: n.id,
            node: n,
            rootLabel: rootNode?.label || 'Workflow',
            natureId: nId,
            natureLabel: nLabel,
            exerciceLabel: exLabel,
            sectionLabel: secLabel,
            pathLabel: nextPath.map((p) => p.label).join(' > '),
            signatureLabel: sig,
            statusKey: stKey,
            statusLabel: DOC_STATUS_LABELS[stKey] || 'À faire',
            bodyText: rawBody,
            hasCustomBody: rawBody.length > 0,
          });
        }
        if (n.children?.length) {
          walk(n.children, nextPath);
        }
      }
    };

    walk(trees, []);
    return out;
  }, [trees, wordBodies, userSignature]);

  // Extraction complète des Étapes de mission
  const allMissionSteps: ExtractedPlanStep[] = useMemo(() => {
    const out: ExtractedPlanStep[] = [];
    allPlanMissions.forEach((m) => {
      const mTitle = m.node.label.startsWith(`${m.meta.code} · `)
        ? m.node.label.slice(`${m.meta.code} · `.length)
        : m.node.label;
      const cycle = inferCycleForPlanMission(m.meta, m.node.label);

      m.phases.forEach((ph) => {
        ph.steps.forEach((st) => {
          const tpl = AUDIT_PLAN_STEPS_TEMPLATE.find(
            (t) => t.stepNumber === st.stepNumber
          );
          const plannedH = st.tasks.reduce(
            (sum, t) => sum + (t.plannedDurationHours || 0),
            0
          );
          const actualH = st.tasks.reduce(
            (sum, t) =>
              sum +
              (t.actualHours !== undefined ? t.actualHours : t.plannedDurationHours),
            0
          );
          const taskAuditors = Array.from(
            new Set(st.tasks.map((t) => t.auditor).filter(Boolean))
          );

          out.push({
            id: st.node.id,
            mission: m,
            step: st,
            missionTitle: mTitle,
            cycle,
            crippNorm: tpl?.defaultCripp || m.meta.normeCripp,
            auditorsLabel:
              taskAuditors.length > 0
                ? taskAuditors.join(', ')
                : m.meta.auditeurs.join(', '),
            plannedHours: Math.round(plannedH * 10) / 10,
            actualHours: Math.round(actualH * 10) / 10,
          });
        });
      });
    });
    return out;
  }, [allPlanMissions]);

  // Filtres liés — Suivi des Recos
  const [recoYear, setRecoYear] = useState<string>('all');
  const [recoDirection, setRecoDirection] = useState<string>('all');
  const [recoCycle, setRecoCycle] = useState<string>('all');
  const [recoMission, setRecoMission] = useState<string>('all');
  const [recoRisque, setRecoRisque] = useState<string>('all');
  const [recoStatut, setRecoStatut] = useState<string>('all');
  const [recoSearch, setRecoSearch] = useState<string>('');

  // Filtres liés — Plan d'audit
  const [planExercice, setPlanExercice] = useState<string>('all');
  const [planDirection, setPlanDirection] = useState<string>('all');
  const [planCycle, setPlanCycle] = useState<string>('all');
  const [planMissionId, setPlanMissionId] = useState<string>('all');
  const [planRisque, setPlanRisque] = useState<string>('all');
  const [planScheduleStatus, setPlanScheduleStatus] = useState<string>('all');
  const [planAuditor, setPlanAuditor] = useState<string>('all');
  const [planSearch, setPlanSearch] = useState<string>('');
  const [planGranularity, setPlanGranularity] = useState<PlanTableGranularity>('missions');

  // Filtres liés — Document
  const [docNature, setDocNature] = useState<string>('all');
  const [docExercice, setDocExercice] = useState<string>('all');
  const [docSection, setDocSection] = useState<string>('all');
  const [docSignature, setDocSignature] = useState<string>('all');
  const [docStatus, setDocStatus] = useState<string>('all');
  const [docOnlyWithBody, setDocOnlyWithBody] = useState<boolean>(false);
  const [docSearch, setDocSearch] = useState<string>('');

  // Filtres liés — Étape de mission
  const [stepExercice, setStepExercice] = useState<string>('all');
  const [stepDirection, setStepDirection] = useState<string>('all');
  const [stepMissionId, setStepMissionId] = useState<string>('all');
  const [stepPhase, setStepPhase] = useState<string>('all');
  const [stepScheduleStatus, setStepScheduleStatus] = useState<string>('all');
  const [stepAuditor, setStepAuditor] = useState<string>('all');
  const [stepSearch, setStepSearch] = useState<string>('');

  // Colonnes & lignes sélectionnées (Table)
  const recoColumns = useMemo(() => getSuiviRecosExportColumns(), []);
  const planMissionColumns = useMemo(() => getPlanAuditExportColumns(), []);

  const [selectedRecoColKeys, setSelectedRecoColKeys] = useState<Set<string>>(
    () => new Set(recoColumns.filter((c) => c.isDefaultKey).map((c) => c.key))
  );
  const [selectedPlanColKeys, setSelectedPlanColKeys] = useState<Set<string>>(
    () => new Set(planMissionColumns.filter((c) => c.isDefaultKey).map((c) => c.key))
  );
  const [selectedStepColKeys, setSelectedStepColKeys] = useState<Set<string>>(
    () => new Set(PLAN_STEP_COLUMNS.filter((c) => c.isDefaultKey).map((c) => c.key))
  );
  const [selectedTaskColKeys, setSelectedTaskColKeys] = useState<Set<string>>(
    () => new Set(PLAN_TASK_COLUMNS.filter((c) => c.isDefaultKey).map((c) => c.key))
  );

  // Sous-ensembles exclus manuellement
  const [excludedRecoRowIds, setExcludedRecoRowIds] = useState<Set<string>>(() => new Set());
  const [excludedPlanRowKeys, setExcludedPlanRowKeys] = useState<Set<string>>(() => new Set());
  const [excludedDocIds, setExcludedDocIds] = useState<Set<string>>(() => new Set());
  const [excludedStepIds, setExcludedStepIds] = useState<Set<string>>(() => new Set());

  // Catégories KPI (Dashboard PDF) & Rubriques (Document / Étape Word & PDF)
  const [selectedRecoKpiIds, setSelectedRecoKpiIds] = useState<Set<string>>(
    () => new Set(RECO_KPI_CATEGORIES.map((c) => c.id))
  );
  const [selectedPlanKpiIds, setSelectedPlanKpiIds] = useState<Set<string>>(
    () => new Set(PLAN_KPI_CATEGORIES.map((c) => c.id))
  );
  const [selectedDocSectionIds, setSelectedDocSectionIds] = useState<Set<string>>(
    () => new Set(DOC_SECTION_OPTIONS.filter((c) => c.executiveDefault).map((c) => c.id))
  );
  const [selectedStepSectionIds, setSelectedStepSectionIds] = useState<Set<string>>(
    () => new Set(STEP_SECTION_OPTIONS.map((c) => c.id))
  );

  // Initialisation depuis le clic droit contextuel
  useEffect(() => {
    setActivity(initialActivity);
    setFormatKind(defaultFormatForActivity(initialActivity, initialMode));
    if (initialActivity === 'document' || initialActivity === 'etape-mission') {
      setPdfOrientation('portrait');
    } else {
      setPdfOrientation('landscape');
    }
  }, [initialActivity, initialMode]);

  useEffect(() => {
    if (!scopeNodeId) return;
    const node = findNodeById(trees, scopeNodeId);
    const path = findNodePath(trees, scopeNodeId) || [];
    if (!node) return;

    if (initialActivity === 'suivi-recos' && node.natureId === 'suivi-recos') {
      const exNode = [...path].reverse().find((p) => p.nodeType === 'exercice');
      const secNode = [...path].reverse().find((p) => p.nodeType === 'section');
      const recoRecord = node.recoMeta;

      setRecoYear(exNode ? extractYearFromExercice(exNode.label) : 'all');
      if (recoRecord) {
        setRecoMission(recoRecord.mission);
        setRecoDirection(recoRecord.direction);
      } else if (secNode) {
        setRecoMission(secNode.label);
        setRecoDirection('all');
      } else {
        setRecoMission('all');
        setRecoDirection('all');
      }
      setRecoCycle('all');
      setRecoRisque('all');
      setRecoStatut('all');
    } else if (initialActivity === 'plan-audit' && node.natureId === 'plan-audit') {
      const missionNode = node.planMissionMeta
        ? node
        : [...path].reverse().find((p) => Boolean(p.planMissionMeta));
      const exNode = [...path].reverse().find((p) => p.nodeType === 'exercice');

      if (missionNode?.planMissionMeta) {
        setPlanExercice(missionNode.planMissionMeta.exercice || 'all');
        setPlanDirection(missionNode.planMissionMeta.direction || 'all');
        setPlanCycle(inferCycleForPlanMission(missionNode.planMissionMeta, missionNode.label));
        setPlanMissionId(missionNode.id);
      } else if (exNode) {
        const y = extractYearFromExercice(exNode.label);
        setPlanExercice(y);
        setPlanDirection('all');
        setPlanCycle('all');
        setPlanMissionId('all');
      } else {
        setPlanExercice('all');
        setPlanDirection('all');
        setPlanCycle('all');
        setPlanMissionId('all');
      }
      setPlanRisque('all');
      setPlanScheduleStatus('all');
      setPlanAuditor('all');
    } else if (initialActivity === 'document') {
      const natureNode = path.find((p) => p.nodeType === 'nature');
      const exNode = [...path].reverse().find((p) => p.nodeType === 'exercice');
      const folderAncestors = path.filter(
        (a) =>
          a.nodeType === 'activite' ||
          a.nodeType === 'section' ||
          a.nodeType === 'sous-section'
      );

      if (node.nodeType === 'document') {
        const matchedDoc = allWorkflowDocuments.find((d) => d.id === node.id);
        if (matchedDoc) {
          setDocNature(matchedDoc.natureLabel);
          setDocExercice(matchedDoc.exerciceLabel);
          setDocSection(matchedDoc.sectionLabel);
          setDocSignature('all');
          setDocStatus('all');
          setDocOnlyWithBody(false);
          const siblingsToExclude = allWorkflowDocuments
            .filter(
              (d) =>
                d.natureLabel === matchedDoc.natureLabel &&
                d.exerciceLabel === matchedDoc.exerciceLabel &&
                d.sectionLabel === matchedDoc.sectionLabel &&
                d.id !== matchedDoc.id
            )
            .map((d) => d.id);
          setExcludedDocIds(new Set(siblingsToExclude));
          return;
        }
      }

      const nLabel =
        node.natureId || natureNode?.natureId
          ? resolveNatureLabel(node.natureId || natureNode?.natureId, natureNode?.label)
          : 'all';
      setDocNature(nLabel);
      setDocExercice(exNode ? exNode.label : 'all');
      setDocSection(
        folderAncestors.length > 0
          ? folderAncestors.map((a) => a.label).join(' / ')
          : 'all'
      );
      setDocSignature('all');
      setDocStatus('all');
      setDocOnlyWithBody(false);
      setExcludedDocIds(new Set());
    } else if (initialActivity === 'etape-mission') {
      const missionNode = node.planMissionMeta
        ? node
        : [...path].reverse().find((p) => Boolean(p.planMissionMeta));
      const exNode = [...path].reverse().find((p) => p.nodeType === 'exercice');
      const phaseNode = [...path]
        .reverse()
        .find((p) => p.planStepMeta?.phase && !p.planStepMeta?.stepNumber);

      if (node.planStepMeta?.stepNumber) {
        const matchedStep = allMissionSteps.find((s) => s.id === node.id);
        if (matchedStep) {
          setStepExercice(matchedStep.mission.meta.exercice);
          setStepDirection(matchedStep.mission.meta.direction);
          setStepMissionId(matchedStep.mission.node.id);
          setStepPhase(matchedStep.step.phaseName);
          const others = allMissionSteps
            .filter(
              (s) =>
                s.mission.node.id === matchedStep.mission.node.id &&
                s.step.phaseName === matchedStep.step.phaseName &&
                s.id !== matchedStep.id
            )
            .map((s) => s.id);
          setExcludedStepIds(new Set(others));
          return;
        }
      }

      if (missionNode?.planMissionMeta) {
        setStepExercice(missionNode.planMissionMeta.exercice || 'all');
        setStepDirection(missionNode.planMissionMeta.direction || 'all');
        setStepMissionId(missionNode.id);
        setStepPhase(phaseNode?.planStepMeta?.phase || 'all');
      } else if (exNode) {
        setStepExercice(extractYearFromExercice(exNode.label));
        setStepDirection('all');
        setStepMissionId('all');
        setStepPhase('all');
      } else {
        setStepExercice('all');
        setStepDirection('all');
        setStepMissionId('all');
        setStepPhase('all');
      }
      setStepScheduleStatus('all');
      setStepAuditor('all');
      setExcludedStepIds(new Set());
    }
  }, [scopeNodeId, initialActivity, trees, allWorkflowDocuments, allMissionSteps]);

  const toggleBlock = (id: string) => {
    setOpenBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- OPTIONS LIÉES (SUIVI RECOS) ---
  const recoYearsOptions = useMemo(() => {
    const s = new Set<string>();
    allRecoEntries.forEach((e) => s.add(extractYearFromExercice(e.exerciceLabel)));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [allRecoEntries]);

  const recoByYear = useMemo(
    () =>
      allRecoEntries.filter(
        (e) => recoYear === 'all' || extractYearFromExercice(e.exerciceLabel) === recoYear
      ),
    [allRecoEntries, recoYear]
  );

  const recoDirectionOptions = useMemo(() => {
    const s = new Set<string>();
    recoByYear.forEach((e) => s.add(e.record.direction));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [recoByYear]);

  const recoCycleOptions = useMemo(() => {
    const s = new Set<string>();
    recoByYear
      .filter((e) => recoDirection === 'all' || e.record.direction === recoDirection)
      .forEach((e) => s.add(inferCycleForReco(e.record)));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [recoByYear, recoDirection]);

  const recoMissionOptions = useMemo(() => {
    const s = new Set<string>();
    recoByYear
      .filter((e) => recoDirection === 'all' || e.record.direction === recoDirection)
      .filter((e) => recoCycle === 'all' || inferCycleForReco(e.record) === recoCycle)
      .forEach((e) => s.add(e.record.mission));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [recoByYear, recoDirection, recoCycle]);

  useEffect(() => {
    if (recoDirection !== 'all' && !recoDirectionOptions.includes(recoDirection)) {
      setRecoDirection('all');
    }
  }, [recoDirection, recoDirectionOptions]);

  useEffect(() => {
    if (recoCycle !== 'all' && !recoCycleOptions.includes(recoCycle)) {
      setRecoCycle('all');
    }
  }, [recoCycle, recoCycleOptions]);

  useEffect(() => {
    if (recoMission !== 'all' && !recoMissionOptions.includes(recoMission)) {
      setRecoMission('all');
    }
  }, [recoMission, recoMissionOptions]);

  const filteredRecoEntries = useMemo(() => {
    const q = recoSearch.trim().toLowerCase();
    return recoByYear.filter((e) => {
      if (recoDirection !== 'all' && e.record.direction !== recoDirection) return false;
      if (recoCycle !== 'all' && inferCycleForReco(e.record) !== recoCycle) return false;
      if (recoMission !== 'all' && e.record.mission !== recoMission) return false;
      if (recoRisque !== 'all' && e.record.evaluationRisque !== recoRisque) return false;
      if (recoStatut !== 'all' && e.record.statut !== recoStatut) return false;
      if (q) {
        const hay = `${e.record.refRecos} ${e.record.intituleRecos} ${e.record.intitule} ${e.record.mission} ${e.record.direction} ${e.record.responsable}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    recoByYear,
    recoDirection,
    recoCycle,
    recoMission,
    recoRisque,
    recoStatut,
    recoSearch,
  ]);

  const selectedRecoEntries = useMemo(
    () => filteredRecoEntries.filter((e) => !excludedRecoRowIds.has(e.node.id)),
    [filteredRecoEntries, excludedRecoRowIds]
  );

  // --- OPTIONS LIÉES (PLAN D'AUDIT) ---
  const planExerciceOptions = useMemo(() => {
    const s = new Set<string>();
    allPlanMissions.forEach((m) => s.add(m.meta.exercice || '2026'));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [allPlanMissions]);

  const planByExercice = useMemo(
    () =>
      allPlanMissions.filter(
        (m) => planExercice === 'all' || (m.meta.exercice || '2026') === planExercice
      ),
    [allPlanMissions, planExercice]
  );

  const planDirectionOptions = useMemo(() => {
    const s = new Set<string>();
    planByExercice.forEach((m) => s.add(m.meta.direction));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [planByExercice]);

  const planCycleOptions = useMemo(() => {
    const s = new Set<string>();
    planByExercice
      .filter((m) => planDirection === 'all' || m.meta.direction === planDirection)
      .forEach((m) => s.add(inferCycleForPlanMission(m.meta, m.node.label)));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [planByExercice, planDirection]);

  const planMissionOptions = useMemo(
    () =>
      planByExercice
        .filter((m) => planDirection === 'all' || m.meta.direction === planDirection)
        .filter(
          (m) =>
            planCycle === 'all' ||
            inferCycleForPlanMission(m.meta, m.node.label) === planCycle
        ),
    [planByExercice, planDirection, planCycle]
  );

  const planAuditorOptions = useMemo(() => {
    const s = new Set<string>();
    planMissionOptions.forEach((m) => m.meta.auditeurs.forEach((a) => s.add(a)));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [planMissionOptions]);

  useEffect(() => {
    if (planDirection !== 'all' && !planDirectionOptions.includes(planDirection)) {
      setPlanDirection('all');
    }
  }, [planDirection, planDirectionOptions]);

  useEffect(() => {
    if (planCycle !== 'all' && !planCycleOptions.includes(planCycle)) {
      setPlanCycle('all');
    }
  }, [planCycle, planCycleOptions]);

  useEffect(() => {
    if (
      planMissionId !== 'all' &&
      !planMissionOptions.some((m) => m.node.id === planMissionId)
    ) {
      setPlanMissionId('all');
    }
  }, [planMissionId, planMissionOptions]);

  const filteredPlanMissions = useMemo(() => {
    const q = planSearch.trim().toLowerCase();
    return planByExercice.filter((m) => {
      if (planDirection !== 'all' && m.meta.direction !== planDirection) return false;
      if (
        planCycle !== 'all' &&
        inferCycleForPlanMission(m.meta, m.node.label) !== planCycle
      ) {
        return false;
      }
      if (planMissionId !== 'all' && m.node.id !== planMissionId) return false;
      if (planRisque !== 'all' && m.meta.risque !== planRisque) return false;
      if (
        planScheduleStatus !== 'all' &&
        m.meta.statutProgression !== planScheduleStatus
      ) {
        return false;
      }
      if (planAuditor !== 'all' && !m.meta.auditeurs.includes(planAuditor)) {
        return false;
      }
      if (q) {
        const hay = `${m.meta.code} ${m.node.label} ${m.meta.direction} ${m.meta.objectif} ${m.meta.chefMission}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    planByExercice,
    planDirection,
    planCycle,
    planMissionId,
    planRisque,
    planScheduleStatus,
    planAuditor,
    planSearch,
  ]);

  const filteredPlanStepRows: PlanStepExportRow[] = useMemo(() => {
    const out: PlanStepExportRow[] = [];
    filteredPlanMissions.forEach((m) => {
      const mTitle = m.node.label.startsWith(`${m.meta.code} · `)
        ? m.node.label.slice(`${m.meta.code} · `.length)
        : m.node.label;
      const cycle = inferCycleForPlanMission(m.meta, m.node.label);
      m.phases.forEach((ph) => {
        ph.steps.forEach((st) => {
          out.push({
            rowKey: st.node.id,
            missionCode: m.meta.code,
            missionTitle: mTitle,
            exercice: m.meta.exercice,
            direction: m.meta.direction,
            cycle,
            phaseName: ph.phaseName,
            stepNumber: st.stepNumber,
            stepLabel: st.node.label,
            dateDebut: st.dateDebut,
            dateFin: st.dateFin,
            dateFinReelle: st.dateFinReelle,
            ecartJours: st.ecartJours,
            progressionPct: st.progressionPct,
            statutLabel:
              st.statutProgression === 'en-avance'
                ? 'En avance'
                : st.statutProgression === 'en-retard'
                ? 'En retard'
                : 'Normal',
            tasksCount: st.tasks.length,
          });
        });
      });
    });
    return out;
  }, [filteredPlanMissions]);

  const filteredPlanTaskRows: PlanTaskExportRow[] = useMemo(() => {
    const out: PlanTaskExportRow[] = [];
    filteredPlanMissions.forEach((m) => {
      const mTitle = m.node.label.startsWith(`${m.meta.code} · `)
        ? m.node.label.slice(`${m.meta.code} · `.length)
        : m.node.label;
      const cycle = inferCycleForPlanMission(m.meta, m.node.label);
      m.allTasks.forEach((tRow) => {
        if (planAuditor !== 'all' && tRow.task.auditor !== planAuditor) return;
        out.push({
          rowKey: tRow.task.id,
          missionCode: m.meta.code,
          missionTitle: mTitle,
          exercice: m.meta.exercice,
          direction: m.meta.direction,
          cycle,
          phaseName: tRow.phaseName,
          stepLabel: tRow.stepLabel,
          auditor: tRow.task.auditor,
          title: tRow.task.title,
          plannedDate: tRow.task.plannedDate,
          plannedEndDate: tRow.task.plannedEndDate || tRow.task.plannedDate,
          plannedHours: tRow.task.plannedDurationHours,
          actualHours:
            tRow.task.actualHours !== undefined
              ? tRow.task.actualHours
              : tRow.task.plannedDurationHours,
          varianceHours: tRow.task.varianceHours ?? 0,
          status: tRow.task.status,
          crippNormRef: tRow.task.crippNormRef || m.meta.normeCripp,
        });
      });
    });
    return out;
  }, [filteredPlanMissions, planAuditor]);

  const activePlanTableRows: Array<{
    key: string;
    row: LiveAuditPlanMission | PlanStepExportRow | PlanTaskExportRow;
  }> = useMemo(() => {
    if (planGranularity === 'steps') {
      return filteredPlanStepRows.map((r) => ({ key: r.rowKey, row: r }));
    }
    if (planGranularity === 'tasks') {
      return filteredPlanTaskRows.map((r) => ({ key: r.rowKey, row: r }));
    }
    return filteredPlanMissions.map((m) => ({ key: m.node.id, row: m }));
  }, [
    planGranularity,
    filteredPlanMissions,
    filteredPlanStepRows,
    filteredPlanTaskRows,
  ]);

  const selectedPlanTableRows = useMemo(
    () => activePlanTableRows.filter((item) => !excludedPlanRowKeys.has(item.key)),
    [activePlanTableRows, excludedPlanRowKeys]
  );

  // --- OPTIONS LIÉES (SECTION DOCUMENT) ---
  const docNatureOptions = useMemo(() => {
    const s = new Set<string>();
    allWorkflowDocuments.forEach((d) => s.add(d.natureLabel));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [allWorkflowDocuments]);

  const docByNature = useMemo(
    () =>
      allWorkflowDocuments.filter(
        (d) => docNature === 'all' || d.natureLabel === docNature
      ),
    [allWorkflowDocuments, docNature]
  );

  const docExerciceOptions = useMemo(() => {
    const s = new Set<string>();
    docByNature.forEach((d) => s.add(d.exerciceLabel));
    return Array.from(s).sort((a, b) => b.localeCompare(a, 'fr'));
  }, [docByNature]);

  const docByExercice = useMemo(
    () =>
      docByNature.filter(
        (d) => docExercice === 'all' || d.exerciceLabel === docExercice
      ),
    [docByNature, docExercice]
  );

  const docSectionOptions = useMemo(() => {
    const s = new Set<string>();
    docByExercice.forEach((d) => s.add(d.sectionLabel));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [docByExercice]);

  const docSignatureOptions = useMemo(() => {
    const s = new Set<string>();
    docByExercice
      .filter((d) => docSection === 'all' || d.sectionLabel === docSection)
      .forEach((d) => s.add(d.signatureLabel));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [docByExercice, docSection]);

  useEffect(() => {
    if (docNature !== 'all' && !docNatureOptions.includes(docNature)) {
      setDocNature('all');
    }
  }, [docNature, docNatureOptions]);

  useEffect(() => {
    if (docExercice !== 'all' && !docExerciceOptions.includes(docExercice)) {
      setDocExercice('all');
    }
  }, [docExercice, docExerciceOptions]);

  useEffect(() => {
    if (docSection !== 'all' && !docSectionOptions.includes(docSection)) {
      setDocSection('all');
    }
  }, [docSection, docSectionOptions]);

  useEffect(() => {
    if (docSignature !== 'all' && !docSignatureOptions.includes(docSignature)) {
      setDocSignature('all');
    }
  }, [docSignature, docSignatureOptions]);

  const filteredDocuments = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return docByExercice.filter((d) => {
      if (docSection !== 'all' && d.sectionLabel !== docSection) return false;
      if (docSignature !== 'all' && d.signatureLabel !== docSignature) return false;
      if (docStatus !== 'all' && d.statusKey !== docStatus) return false;
      if (docOnlyWithBody && !d.hasCustomBody) return false;
      if (q) {
        const hay = `${d.node.label} ${d.node.driveId || ''} ${d.sectionLabel} ${d.signatureLabel} ${d.bodyText}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    docByExercice,
    docSection,
    docSignature,
    docStatus,
    docOnlyWithBody,
    docSearch,
  ]);

  const selectedDocItems = useMemo(
    () => filteredDocuments.filter((d) => !excludedDocIds.has(d.id)),
    [filteredDocuments, excludedDocIds]
  );

  // --- OPTIONS LIÉES (SECTION ÉTAPE DE MISSION) ---
  const stepExerciceOptions = useMemo(() => {
    const s = new Set<string>();
    allMissionSteps.forEach((st) => s.add(st.mission.meta.exercice || '2026'));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [allMissionSteps]);

  const stepByExercice = useMemo(
    () =>
      allMissionSteps.filter(
        (st) =>
          stepExercice === 'all' || (st.mission.meta.exercice || '2026') === stepExercice
      ),
    [allMissionSteps, stepExercice]
  );

  const stepDirectionOptions = useMemo(() => {
    const s = new Set<string>();
    stepByExercice.forEach((st) => s.add(st.mission.meta.direction));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [stepByExercice]);

  const stepMissionOptions = useMemo(() => {
    const map = new Map<string, string>();
    stepByExercice
      .filter((st) => stepDirection === 'all' || st.mission.meta.direction === stepDirection)
      .forEach((st) => map.set(st.mission.node.id, st.mission.node.label));
    return Array.from(map.entries());
  }, [stepByExercice, stepDirection]);

  const stepPhaseOptions = useMemo(() => {
    const s = new Set<string>();
    stepByExercice
      .filter((st) => stepDirection === 'all' || st.mission.meta.direction === stepDirection)
      .filter((st) => stepMissionId === 'all' || st.mission.node.id === stepMissionId)
      .forEach((st) => s.add(st.step.phaseName));
    return Array.from(s);
  }, [stepByExercice, stepDirection, stepMissionId]);

  const stepAuditorOptions = useMemo(() => {
    const s = new Set<string>();
    stepByExercice
      .filter((st) => stepDirection === 'all' || st.mission.meta.direction === stepDirection)
      .filter((st) => stepMissionId === 'all' || st.mission.node.id === stepMissionId)
      .forEach((st) => {
        st.mission.meta.auditeurs.forEach((a) => s.add(a));
        st.step.tasks.forEach((t) => {
          if (t.auditor) s.add(t.auditor);
        });
      });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [stepByExercice, stepDirection, stepMissionId]);

  useEffect(() => {
    if (stepDirection !== 'all' && !stepDirectionOptions.includes(stepDirection)) {
      setStepDirection('all');
    }
  }, [stepDirection, stepDirectionOptions]);

  useEffect(() => {
    if (
      stepMissionId !== 'all' &&
      !stepMissionOptions.some(([id]) => id === stepMissionId)
    ) {
      setStepMissionId('all');
    }
  }, [stepMissionId, stepMissionOptions]);

  useEffect(() => {
    if (stepPhase !== 'all' && !stepPhaseOptions.includes(stepPhase)) {
      setStepPhase('all');
    }
  }, [stepPhase, stepPhaseOptions]);

  const filteredMissionSteps = useMemo(() => {
    const q = stepSearch.trim().toLowerCase();
    return stepByExercice.filter((st) => {
      if (stepDirection !== 'all' && st.mission.meta.direction !== stepDirection) return false;
      if (stepMissionId !== 'all' && st.mission.node.id !== stepMissionId) return false;
      if (stepPhase !== 'all' && st.step.phaseName !== stepPhase) return false;
      if (
        stepScheduleStatus !== 'all' &&
        st.step.statutProgression !== stepScheduleStatus
      ) {
        return false;
      }
      if (
        stepAuditor !== 'all' &&
        !st.step.tasks.some((t) => t.auditor === stepAuditor) &&
        !st.mission.meta.auditeurs.includes(stepAuditor)
      ) {
        return false;
      }
      if (q) {
        const hay = `${st.mission.meta.code} ${st.missionTitle} ${st.step.phaseName} ${st.step.node.label} ${st.crippNorm} ${st.step.tasks.map((t) => t.title).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    stepByExercice,
    stepDirection,
    stepMissionId,
    stepPhase,
    stepScheduleStatus,
    stepAuditor,
    stepSearch,
  ]);

  const selectedStepItems = useMemo(
    () => filteredMissionSteps.filter((st) => !excludedStepIds.has(st.id)),
    [filteredMissionSteps, excludedStepIds]
  );

  // --- BLOCS KPI DASHBOARD PDF (RECOS & PLAN) ---
  const recoPdfSections: PdfSectionBlock[] = useMemo(() => {
    const items = selectedRecoEntries;
    const total = items.length;
    const realised = items.filter((e) => e.record.statut === 'Réalisé').length;
    const waiting = items.filter((e) => e.record.statut === 'En attente').length;
    const reported = items.filter((e) => e.record.statut === 'Reporté').length;
    const notDone = items.filter((e) => e.record.statut === 'Non réalisé').length;
    const implRate = total > 0 ? Math.round((realised / total) * 100) : 0;
    const critOpen = items.filter(
      (e) => e.record.evaluationRisque === 'Critique' && e.record.statut !== 'Réalisé'
    ).length;
    const hasReportCount = items.filter(
      (e) => e.record.reportDelai && e.record.reportDelai !== 'Néant'
    ).length;

    const now = new Date();
    const overdueCount = items.filter((e) => {
      if (e.record.statut === 'Réalisé') return false;
      const eff =
        e.record.reportDelai && e.record.reportDelai !== 'Néant'
          ? e.record.reportDelai
          : e.record.delai;
      const dt = parseDateSafeFrOrIso(eff);
      return dt ? dt.getTime() < now.getTime() : false;
    }).length;

    const sections: PdfSectionBlock[] = [];

    if (selectedRecoKpiIds.has('recos-exec')) {
      sections.push({
        kind: 'kpis',
        id: 'recos-exec',
        title: 'KPI Exécutifs — Suivi des Recommandations',
        subtitle: `${total} recommandation(s) incluse(s)`,
        items: [
          {
            label: 'Total Recommandations',
            value: String(total),
            sublabel: 'Périmètre filtré',
            accentHex: '#0F172A',
          },
          {
            label: 'Taux de réalisation',
            value: `${implRate} %`,
            sublabel: `${realised} clôturées / ${total}`,
            accentHex: '#16A34A',
          },
          {
            label: 'Critiques ouvertes',
            value: String(critOpen),
            sublabel: 'Risque Critique non réalisé',
            accentHex: '#DC2626',
          },
          {
            label: 'Échéance dépassée',
            value: String(overdueCount),
            sublabel: 'Non clôturées à date',
            accentHex: '#D97706',
          },
          {
            label: 'Reports accordés',
            value: String(hasReportCount),
            sublabel: `${total > 0 ? Math.round((hasReportCount / total) * 100) : 0} % du portefeuille`,
            accentHex: '#0284C7',
          },
        ],
      });
    }

    if (selectedRecoKpiIds.has('recos-statut')) {
      const denom = Math.max(1, total);
      const bars: PdfBarItem[] = [
        {
          label: 'Réalisé',
          value: realised,
          displayValue: `${realised} (${Math.round((realised / denom) * 100)} %)`,
          pct: (realised / denom) * 100,
          colorHex: '#16A34A',
        },
        {
          label: 'En attente',
          value: waiting,
          displayValue: `${waiting} (${Math.round((waiting / denom) * 100)} %)`,
          pct: (waiting / denom) * 100,
          colorHex: '#0284C7',
        },
        {
          label: 'Reporté',
          value: reported,
          displayValue: `${reported} (${Math.round((reported / denom) * 100)} %)`,
          pct: (reported / denom) * 100,
          colorHex: '#D97706',
        },
        {
          label: 'Non réalisé',
          value: notDone,
          displayValue: `${notDone} (${Math.round((notDone / denom) * 100)} %)`,
          pct: (notDone / denom) * 100,
          colorHex: '#DC2626',
        },
      ];
      sections.push({
        kind: 'bars',
        id: 'recos-statut',
        title: 'Répartition par Statut de mise en œuvre',
        subtitle: `Base : ${total} recos`,
        items: bars,
      });
    }

    if (selectedRecoKpiIds.has('recos-matrix')) {
      const risks = ['Critique', 'Majeur', 'Modéré'];
      const statuses = ['Réalisé', 'En attente', 'Reporté', 'Non réalisé'];
      const rows = risks.map((r) => {
        const rowMatches = items.filter((e) => e.record.evaluationRisque === r);
        const cells = statuses.map((s) =>
          String(rowMatches.filter((e) => e.record.statut === s).length)
        );
        return [r, ...cells, String(rowMatches.length)];
      });
      sections.push({
        kind: 'table',
        id: 'recos-matrix',
        title: 'Matrice Criticité × Statut',
        table: {
          headers: ['Criticité', 'Réalisé', 'En attente', 'Reporté', 'Non réalisé', 'Total'],
          colWeights: [2, 1, 1, 1, 1, 1],
          rows,
        },
      });
    }

    if (selectedRecoKpiIds.has('recos-directions')) {
      const map = new Map<string, { total: number; done: number }>();
      items.forEach((e) => {
        const cur = map.get(e.record.direction) || { total: 0, done: 0 };
        cur.total += 1;
        if (e.record.statut === 'Réalisé') cur.done += 1;
        map.set(e.record.direction, cur);
      });
      const bars: PdfBarItem[] = Array.from(map.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .map(([dir, v]) => {
          const pct = Math.round((v.done / Math.max(1, v.total)) * 100);
          return {
            label: dir,
            value: pct,
            displayValue: `${v.done}/${v.total} (${pct} %)`,
            pct,
            colorHex: pct >= 70 ? '#16A34A' : pct >= 40 ? '#0284C7' : '#DC2626',
          };
        });
      sections.push({
        kind: 'bars',
        id: 'recos-directions',
        title: 'Taux d’avancement par Direction',
        subtitle: `${bars.length} direction(s)`,
        items: bars,
      });
    }

    if (selectedRecoKpiIds.has('recos-cycles')) {
      const map = new Map<string, { total: number; done: number; critOpen: number }>();
      items.forEach((e) => {
        const cyc = inferCycleForReco(e.record);
        const cur = map.get(cyc) || { total: 0, done: 0, critOpen: 0 };
        cur.total += 1;
        if (e.record.statut === 'Réalisé') cur.done += 1;
        if (e.record.evaluationRisque === 'Critique' && e.record.statut !== 'Réalisé') {
          cur.critOpen += 1;
        }
        map.set(cyc, cur);
      });
      const rows = Array.from(map.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .map(([cyc, v]) => [
          cyc,
          String(v.total),
          String(v.done),
          `${Math.round((v.done / Math.max(1, v.total)) * 100)} %`,
          String(v.critOpen),
        ]);
      sections.push({
        kind: 'table',
        id: 'recos-cycles',
        title: 'Avancement par Cycle d’audit',
        table: {
          headers: ['Cycle', 'Total', 'Réalisées', 'Taux', 'Crit. ouvertes'],
          colWeights: [3.2, 0.9, 1, 1, 1.2],
          rows,
        },
      });
    }

    if (selectedRecoKpiIds.has('recos-delais')) {
      const monthCounts = Array.from({ length: 12 }, (_, idx) => ({
        month: MONTH_LABELS[idx],
        init: 0,
        rep: 0,
      }));
      items.forEach((e) => {
        const d1 = parseDateSafeFrOrIso(e.record.delai);
        if (d1) monthCounts[d1.getMonth()].init += 1;
        if (e.record.reportDelai && e.record.reportDelai !== 'Néant') {
          const d2 = parseDateSafeFrOrIso(e.record.reportDelai);
          if (d2) monthCounts[d2.getMonth()].rep += 1;
        }
      });
      const activeMonths = monthCounts.filter((m) => m.init > 0 || m.rep > 0);
      const maxM = Math.max(1, ...activeMonths.map((m) => m.init + m.rep));
      sections.push({
        kind: 'bars',
        id: 'recos-delais',
        title: 'Échéances initiales & Reports par mois',
        subtitle: 'Cumul éch. + rep.',
        items: activeMonths.map((m) => ({
          label: m.month,
          value: m.init + m.rep,
          displayValue: `${m.init} éch. · ${m.rep} rep.`,
          pct: ((m.init + m.rep) / maxM) * 100,
          colorHex: m.rep > 0 ? '#D97706' : '#0284C7',
        })),
      });
    }

    if (selectedRecoKpiIds.has('recos-table')) {
      const rows = items.slice(0, 40).map((e) => [
        e.record.refRecos,
        e.record.intituleRecos || e.record.intitule,
        e.record.direction,
        e.record.evaluationRisque,
        e.record.statut,
        e.record.reportDelai && e.record.reportDelai !== 'Néant'
          ? `${e.record.reportDelai} (rep.)`
          : e.record.delai,
      ]);
      sections.push({
        kind: 'table',
        id: 'recos-table',
        title: `Synthèse des Recommandations (${items.length > 40 ? '40 premières sur ' + items.length : items.length})`,
        table: {
          headers: ['Référence', 'Intitulé', 'Direction', 'Risque', 'Statut', 'Échéance'],
          colWeights: [1.5, 3, 2, 1, 1.1, 1.3],
          rows,
        },
      });
    }

    return sections;
  }, [selectedRecoEntries, selectedRecoKpiIds]);

  const planPdfSections: PdfSectionBlock[] = useMemo(() => {
    const missions =
      planGranularity === 'missions'
        ? filteredPlanMissions.filter((m) => !excludedPlanRowKeys.has(m.node.id))
        : filteredPlanMissions;
    const total = missions.length;
    const avgProgress =
      total > 0
        ? Math.round(missions.reduce((s, m) => s + m.meta.progressionPct, 0) / total)
        : 0;
    const plannedH = missions.reduce(
      (s, m) => s + (m.plannedTaskHours || m.meta.budgetHeures),
      0
    );
    const actualH = missions.reduce(
      (s, m) => s + (m.actualTaskHours || m.meta.heuresRealisees),
      0
    );
    const avgEcart =
      total > 0
        ? (missions.reduce((s, m) => s + m.meta.ecartJours, 0) / total).toFixed(1)
        : '0.0';
    const aheadCount = missions.filter(
      (m) => m.meta.statutProgression === 'en-avance'
    ).length;
    const normalCount = missions.filter(
      (m) => m.meta.statutProgression === 'normal'
    ).length;
    const lateCount = missions.filter(
      (m) => m.meta.statutProgression === 'en-retard'
    ).length;

    const sections: PdfSectionBlock[] = [];

    if (selectedPlanKpiIds.has('plan-exec')) {
      sections.push({
        kind: 'kpis',
        id: 'plan-exec',
        title: 'KPI Exécution du Plan Annuel d’Audit',
        subtitle: `${total} mission(s) dans le périmètre`,
        items: [
          {
            label: 'Missions planifiées',
            value: String(total),
            sublabel: `${missions.reduce((s, m) => s + m.meta.dureeSemaines, 0)} sem. cumulées`,
            accentHex: '#0F172A',
          },
          {
            label: 'Avancement moyen',
            value: `${avgProgress} %`,
            sublabel: `${missions.filter((m) => m.meta.progressionPct === 100).length} clôturées`,
            accentHex: '#16A34A',
          },
          {
            label: 'Heures planifiées',
            value: `${Math.round(plannedH)} h`,
            sublabel: 'Capacité 08h/jour ouvré',
            accentHex: '#0284C7',
          },
          {
            label: 'Heures réalisées',
            value: `${Math.round(actualH)} h`,
            sublabel: `${Math.round(actualH - plannedH) >= 0 ? '+' : ''}${Math.round(
              actualH - plannedH
            )} h écart`,
            accentHex: '#D97706',
          },
          {
            label: 'Écart moyen délai',
            value: `${Number(avgEcart) > 0 ? `+${avgEcart}` : avgEcart} j`,
            sublabel: `${lateCount} mission(s) en retard`,
            accentHex: lateCount > 0 ? '#DC2626' : '#16A34A',
          },
        ],
      });
    }

    if (selectedPlanKpiIds.has('plan-status')) {
      const denom = Math.max(1, total);
      sections.push({
        kind: 'bars',
        id: 'plan-status',
        title: 'Statut Planning des Missions',
        subtitle: `Base : ${total} mission(s)`,
        items: [
          {
            label: 'En avance',
            value: aheadCount,
            displayValue: `${aheadCount} (${Math.round((aheadCount / denom) * 100)} %)`,
            pct: (aheadCount / denom) * 100,
            colorHex: '#0284C7',
          },
          {
            label: 'Progression normale',
            value: normalCount,
            displayValue: `${normalCount} (${Math.round((normalCount / denom) * 100)} %)`,
            pct: (normalCount / denom) * 100,
            colorHex: '#16A34A',
          },
          {
            label: 'En retard',
            value: lateCount,
            displayValue: `${lateCount} (${Math.round((lateCount / denom) * 100)} %)`,
            pct: (lateCount / denom) * 100,
            colorHex: '#DC2626',
          },
        ],
      });
    }

    if (selectedPlanKpiIds.has('plan-directions')) {
      const map = new Map<string, { count: number; progSum: number; hours: number }>();
      missions.forEach((m) => {
        const cur = map.get(m.meta.direction) || { count: 0, progSum: 0, hours: 0 };
        cur.count += 1;
        cur.progSum += m.meta.progressionPct;
        cur.hours += m.plannedTaskHours || m.meta.budgetHeures;
        map.set(m.meta.direction, cur);
      });
      sections.push({
        kind: 'bars',
        id: 'plan-directions',
        title: 'Avancement moyen par Direction',
        subtitle: `${map.size} direction(s)`,
        items: Array.from(map.entries())
          .sort((a, b) => b[1].count - a[1].count)
          .map(([dir, v]) => {
            const pct = Math.round(v.progSum / Math.max(1, v.count));
            return {
              label: dir,
              value: pct,
              displayValue: `${v.count} miss. · ${pct} % (${Math.round(v.hours)}h)`,
              pct,
              colorHex: '#0284C7',
            };
          }),
      });
    }

    if (selectedPlanKpiIds.has('plan-cycles')) {
      const map = new Map<
        string,
        { count: number; progSum: number; budgetH: number; late: number }
      >();
      missions.forEach((m) => {
        const cyc = inferCycleForPlanMission(m.meta, m.node.label);
        const cur = map.get(cyc) || { count: 0, progSum: 0, budgetH: 0, late: 0 };
        cur.count += 1;
        cur.progSum += m.meta.progressionPct;
        cur.budgetH += m.plannedTaskHours || m.meta.budgetHeures;
        if (m.meta.statutProgression === 'en-retard') cur.late += 1;
        map.set(cyc, cur);
      });
      sections.push({
        kind: 'table',
        id: 'plan-cycles',
        title: 'Ventilation par Cycle d’audit',
        table: {
          headers: ['Cycle', 'Missions', 'Heures prév.', 'Avancement moy.', 'En retard'],
          colWeights: [3, 0.9, 1.1, 1.2, 0.9],
          rows: Array.from(map.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .map(([cyc, v]) => [
              cyc,
              String(v.count),
              `${Math.round(v.budgetH)} h`,
              `${Math.round(v.progSum / Math.max(1, v.count))} %`,
              String(v.late),
            ]),
        },
      });
    }

    if (selectedPlanKpiIds.has('plan-auditors')) {
      const map = new Map<
        string,
        { planned: number; actual: number; tasks: number; done: number }
      >();
      missions.forEach((m) => {
        m.allTasks.forEach((tr) => {
          if (planAuditor !== 'all' && tr.task.auditor !== planAuditor) return;
          const cur = map.get(tr.task.auditor) || {
            planned: 0,
            actual: 0,
            tasks: 0,
            done: 0,
          };
          cur.planned += tr.task.plannedDurationHours;
          cur.actual +=
            tr.task.actualHours !== undefined
              ? tr.task.actualHours
              : tr.task.plannedDurationHours;
          cur.tasks += 1;
          if (tr.task.status === 'done') cur.done += 1;
          map.set(tr.task.auditor, cur);
        });
      });
      sections.push({
        kind: 'table',
        id: 'plan-auditors',
        title: 'Charge & Performance par Auditeur (Base 08h/j)',
        table: {
          headers: ['Auditeur', 'Tâches', 'Terminées', 'Heures prév.', 'Heures réelles', 'Écart'],
          colWeights: [1.3, 0.9, 1, 1.2, 1.2, 1],
          rows: Array.from(map.entries())
            .sort((a, b) => b[1].planned - a[1].planned)
            .map(([aud, v]) => {
              const delta = Math.round(v.actual - v.planned);
              return [
                aud,
                String(v.tasks),
                `${v.done}/${v.tasks}`,
                `${Math.round(v.planned)} h`,
                `${Math.round(v.actual)} h`,
                `${delta > 0 ? `+${delta}` : delta} h`,
              ];
            }),
        },
      });
    }

    if (selectedPlanKpiIds.has('plan-table')) {
      sections.push({
        kind: 'table',
        id: 'plan-table',
        title: `Tableau des Missions du Plan d’Audit (${missions.length})`,
        table: {
          headers: [
            'Code',
            'Mission',
            'Direction',
            'Cycle',
            'Risque',
            'Début -> Fin',
            'Avanc.',
            'Écart',
          ],
          colWeights: [1.1, 2.7, 2.1, 1.8, 0.9, 1.8, 0.8, 0.8],
          rows: missions.map((m) => [
            m.meta.code,
            m.node.label.startsWith(`${m.meta.code} · `)
              ? m.node.label.slice(`${m.meta.code} · `.length)
              : m.node.label,
            m.meta.direction,
            inferCycleForPlanMission(m.meta, m.node.label),
            m.meta.risque,
            `${m.meta.dateDebut} -> ${m.meta.dateFinPrevue}`,
            `${m.meta.progressionPct} %`,
            `${m.meta.ecartJours > 0 ? `+${m.meta.ecartJours}` : m.meta.ecartJours} j`,
          ]),
        },
      });
    }

    return sections;
  }, [
    filteredPlanMissions,
    excludedPlanRowKeys,
    planGranularity,
    selectedPlanKpiIds,
    planAuditor,
  ]);

  // --- CONSTRUCTION PAYLOADS STRUCTURÉS (DOCUMENT & ÉTAPE DE MISSION) ---
  const documentReportPayload: StructuredReportExportPayload = useMemo(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    const scopePart = sanitizeFilenameSegment(
      selectedDocItems.length === 1
        ? selectedDocItems[0].node.label
        : docSection !== 'all'
        ? docSection
        : docNature !== 'all'
        ? docNature
        : 'Documents'
    );

    const items: DocExportItem[] = selectedDocItems.map((d) => {
      const blocks: DocExportSectionBlock[] = [];

      if (selectedDocSectionIds.has('doc-body')) {
        const fallbackBody = [
          `Document de travail rattaché au workflow « ${d.natureLabel} » (${d.exerciceLabel}).`,
          `Dossier parent : ${d.sectionLabel}.`,
          `Signataire / Responsable : ${d.signatureLabel} · Référence Drive : ${d.node.driveId || 'Non attribuée'}.`,
          `Aucun corps rédactionnel libre n’a encore été saisi dans l’éditeur Word pour ce document ; cette fiche consolide les métadonnées, revues et diligences rattachées.`,
        ].join('\n');

        blocks.push({
          heading: 'Corps rédactionnel & Diligences documentaires',
          subheading: d.hasCustomBody
            ? `Contenu issu de l’éditeur Word (${d.bodyText.length} caractères)`
            : 'Notice structurée générée depuis le référentiel workflow',
          paragraphs: [d.bodyText || fallbackBody],
        });
      }

      if (selectedDocSectionIds.has('doc-reviews')) {
        const notes = d.node.reviewNotes || [];
        blocks.push({
          heading: `Notes de revue & Points de supervision (${notes.length})`,
          table: {
            headers: ['Auteur', 'Observation / Note', 'Statut', 'Date'],
            colWeights: [1, 3.2, 1, 1.2],
            rows: notes.map((rn) => [
              rn.author,
              rn.text,
              rn.status === 'resolved' ? 'Résolue' : 'Ouverte',
              rn.createdAt ? rn.createdAt.slice(0, 10) : '—',
            ]),
          },
        });
      }

      if (selectedDocSectionIds.has('doc-tasks')) {
        const tasks = d.node.todoTasks || [];
        blocks.push({
          heading: `Tâches d’audit rattachées (${tasks.length})`,
          table: {
            headers: ['Tâche', 'Auditeur', 'Date prévue', 'Durée (h)', 'Statut'],
            colWeights: [2.8, 1, 1.2, 0.9, 1],
            rows: tasks.map((t) => [
              t.title,
              t.auditor,
              t.plannedDate,
              `${t.plannedDurationHours} h`,
              TASK_STATUS_LABELS[t.status] || t.status,
            ]),
          },
        });
      }

      if (selectedDocSectionIds.has('doc-versions')) {
        const versions = d.node.versions || [];
        const refs = d.node.crossRefs || [];
        blocks.push({
          heading: `Historique des versions (${versions.length}) & Références croisées`,
          paragraphs:
            refs.length > 0
              ? [`Références croisées liées : ${refs.join(', ')}`]
              : ['Aucune référence croisée attachée.'],
          table: {
            headers: ['Version', 'Auteur', 'Horodatage', 'Résumé'],
            colWeights: [1, 1, 1.4, 2.6],
            rows: versions.map((v) => [
              v.versionLabel,
              v.author,
              v.timestamp,
              v.summary,
            ]),
          },
        });
      }

      return {
        title: d.node.label,
        badge: d.statusLabel,
        pathSubtitle: `${d.rootLabel} · ${d.natureLabel} · ${d.exerciceLabel} · ${d.sectionLabel}`,
        metaPairs: selectedDocSectionIds.has('doc-meta')
          ? [
              { label: 'Workflow / Nature', value: d.natureLabel },
              { label: 'Exercice', value: d.exerciceLabel },
              { label: 'Dossier / Section', value: d.sectionLabel },
              { label: 'Signataire / Owner', value: d.signatureLabel },
              { label: 'Réf. Google Drive', value: d.node.driveId || 'N/A' },
              { label: 'Statut workflow', value: d.statusLabel },
              { label: 'Échéance', value: d.node.dueDate || 'Non fixée' },
              {
                label: 'Contrôles & Verrou',
                value: `${d.node.managerReviewed ? 'Revu Manager' : 'En attente revue'} · ${
                  d.node.locked ? 'Verrouillé PIN' : 'Éditable'
                }`,
              },
            ]
          : [],
        blocks,
      };
    });

    return {
      filename: `Export_Documents_${scopePart}_${stamp}`,
      docTitle:
        selectedDocItems.length === 1
          ? selectedDocItems[0].node.label
          : 'Dossier Documentaire d’Audit — Consolidation',
      docSubtitle: `${selectedDocItems.length} document(s) exporté(s) · ${selectedDocSectionIds.size} rubrique(s)`,
      categoryLabel: 'Workflow Documentaire',
      client: clientName,
      signature: userSignature,
      orientation: pdfOrientation,
      filterLines: [
        `Nature : ${docNature === 'all' ? 'Toutes' : docNature}  |  Exercice : ${
          docExercice === 'all' ? 'Tous' : docExercice
        }  |  Dossier : ${docSection === 'all' ? 'Tous' : docSection}`,
        `Signataire : ${docSignature === 'all' ? 'Tous' : docSignature}  |  Statut : ${
          docStatus === 'all' ? 'Tous' : DOC_STATUS_LABELS[docStatus] || docStatus
        }  |  Documents sélectionnés : ${selectedDocItems.length}`,
      ],
      summaryTable:
        selectedDocItems.length > 1
          ? {
              title: `Sommaire des Documents exportés (${selectedDocItems.length})`,
              headers: ['N°', 'Document', 'Workflow', 'Dossier', 'Signataire', 'Statut'],
              colWeights: [0.5, 2.5, 1.4, 1.8, 0.9, 1],
              rows: selectedDocItems.map((d, idx) => [
                String(idx + 1),
                d.node.label,
                d.natureLabel,
                d.sectionLabel,
                d.signatureLabel,
                d.statusLabel,
              ]),
            }
          : undefined,
      items,
    };
  }, [
    selectedDocItems,
    selectedDocSectionIds,
    docNature,
    docExercice,
    docSection,
    docSignature,
    docStatus,
    clientName,
    userSignature,
    pdfOrientation,
  ]);

  const stepReportPayload: StructuredReportExportPayload = useMemo(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    const scopePart = sanitizeFilenameSegment(
      selectedStepItems.length === 1
        ? `${selectedStepItems[0].mission.meta.code}_Etape_${selectedStepItems[0].step.stepNumber}`
        : stepMissionId !== 'all'
        ? selectedStepItems[0]?.mission.meta.code || 'Mission'
        : stepPhase !== 'all'
        ? stepPhase
        : 'Etapes_Mission'
    );

    const items: DocExportItem[] = selectedStepItems.map((s) => {
      const m = s.mission;
      const st = s.step;
      const statusMeta = AUDIT_PLAN_SCHEDULE_META[st.statutProgression];
      const blocks: DocExportSectionBlock[] = [];

      if (selectedStepSectionIds.has('step-mission')) {
        blocks.push({
          heading: 'Cadrage de la mission d’audit parente',
          metaPairs: [
            { label: 'Code & Mission', value: `${m.meta.code} · ${s.missionTitle}` },
            { label: 'Direction auditée', value: m.meta.direction },
            { label: 'Cycle d’audit', value: s.cycle },
            { label: 'Niveau de risque', value: m.meta.risque },
            { label: 'Chef de mission', value: m.meta.chefMission },
            { label: 'Équipe assignée', value: m.meta.auditeurs.join(', ') },
          ],
          paragraphs: [
            `Objectif de la mission : ${m.meta.objectif}`,
            `Périmètre d’intervention : ${m.meta.perimetre}`,
          ],
        });
      }

      if (selectedStepSectionIds.has('step-timeline')) {
        blocks.push({
          heading: 'Chronogramme & Suivi des écarts de l’étape',
          metaPairs: [
            { label: 'Phase de mission', value: st.phaseName },
            { label: 'Étape N°', value: `${st.stepNumber} — ${st.node.label}` },
            { label: 'Date début étape', value: st.dateDebut },
            { label: 'Date fin prévue', value: st.dateFin },
            { label: 'Date fin réelle', value: st.dateFinReelle },
            {
              label: 'Écart planning',
              value: `${st.ecartJours > 0 ? `+${st.ecartJours}` : st.ecartJours} jour(s) · ${statusMeta.label}`,
            },
            { label: 'Progression étape', value: `${st.progressionPct} %` },
            {
              label: 'Volume horaire étape',
              value: `${s.plannedHours} h prévues / ${s.actualHours} h réalisées`,
            },
          ],
        });
      }

      if (selectedStepSectionIds.has('step-tasks')) {
        const tasksToShow =
          stepAuditor === 'all'
            ? st.tasks
            : st.tasks.filter((t) => t.auditor === stepAuditor);
        blocks.push({
          heading: `Programme détaillé des tâches (Base 08h/j · ${tasksToShow.length} tâche(s))`,
          table: {
            headers: [
              'Tâche d’audit',
              'Auditeur',
              'Début',
              'Fin prév.',
              'Prév.',
              'Réel',
              'Écart',
              'Statut',
            ],
            colWeights: [2.8, 0.8, 1.1, 1.1, 0.7, 0.7, 0.7, 0.9],
            rows: tasksToShow.map((t) => {
              const actual =
                t.actualHours !== undefined ? t.actualHours : t.plannedDurationHours;
              const delta =
                t.varianceHours !== undefined
                  ? t.varianceHours
                  : Math.round((actual - t.plannedDurationHours) * 10) / 10;
              return [
                t.title,
                t.auditor,
                t.plannedDate,
                t.plannedEndDate || t.plannedDate,
                `${t.plannedDurationHours}h`,
                `${actual}h`,
                `${delta > 0 ? `+${delta}` : delta}h`,
                TASK_STATUS_LABELS[t.status] || t.status,
              ];
            }),
          },
        });
      }

      if (selectedStepSectionIds.has('step-workload')) {
        const audMap = new Map<
          string,
          { count: number; done: number; planned: number; actual: number }
        >();
        st.tasks.forEach((t) => {
          if (stepAuditor !== 'all' && t.auditor !== stepAuditor) return;
          const cur = audMap.get(t.auditor) || {
            count: 0,
            done: 0,
            planned: 0,
            actual: 0,
          };
          cur.count += 1;
          if (t.status === 'done') cur.done += 1;
          cur.planned += t.plannedDurationHours || 0;
          cur.actual +=
            t.actualHours !== undefined ? t.actualHours : t.plannedDurationHours;
          audMap.set(t.auditor, cur);
        });

        blocks.push({
          heading: 'Synthèse de charge par Auditeur & Référentiel CRIPP',
          paragraphs: [
            `Référentiel normatif applicable à l’étape : ${s.crippNorm}`,
          ],
          table: {
            headers: ['Auditeur', 'Nb Tâches', 'Clôturées', 'Heures prévues', 'Heures réelles', 'Écart (h)'],
            colWeights: [1.2, 0.9, 1, 1.1, 1.1, 1],
            rows: Array.from(audMap.entries()).map(([aud, v]) => {
              const diff = Math.round((v.actual - v.planned) * 10) / 10;
              return [
                aud,
                String(v.count),
                `${v.done}/${v.count}`,
                `${Math.round(v.planned * 10) / 10} h`,
                `${Math.round(v.actual * 10) / 10} h`,
                `${diff > 0 ? `+${diff}` : diff} h`,
              ];
            }),
          },
        });
      }

      return {
        title: `${m.meta.code} · Étape ${st.stepNumber} : ${st.node.label}`,
        badge: `${st.progressionPct}% · ${statusMeta.label}`,
        pathSubtitle: `${s.missionTitle} · ${st.phaseName} · ${m.meta.direction}`,
        metaPairs: [
          { label: 'Mission', value: `${m.meta.code} · ${s.missionTitle}` },
          { label: 'Phase', value: st.phaseName },
          { label: 'Période étape', value: `${st.dateDebut} -> ${st.dateFin}` },
          { label: 'Fin réelle / Écart', value: `${st.dateFinReelle} (${st.ecartJours > 0 ? `+${st.ecartJours}` : st.ecartJours} j)` },
          { label: 'Auditeurs', value: s.auditorsLabel },
          { label: 'Norme CRIPP', value: s.crippNorm },
        ],
        blocks,
      };
    });

    return {
      filename: `Export_Etapes_Mission_${scopePart}_${stamp}`,
      docTitle:
        selectedStepItems.length === 1
          ? `${selectedStepItems[0].mission.meta.code} · ${selectedStepItems[0].step.node.label}`
          : 'Dossier d’Exécution — Étapes de Mission d’Audit',
      docSubtitle: `${selectedStepItems.length} étape(s) de mission · ${selectedStepSectionIds.size} rubrique(s)`,
      categoryLabel: 'Plan d’Audit · Étapes de Mission',
      client: clientName,
      signature: userSignature,
      orientation: pdfOrientation,
      filterLines: [
        `Exercice : ${stepExercice === 'all' ? 'Tous' : stepExercice}  |  Direction : ${
          stepDirection === 'all' ? 'Toutes' : stepDirection
        }  |  Phase : ${stepPhase === 'all' ? 'Toutes' : stepPhase}`,
        `Statut : ${
          stepScheduleStatus === 'all'
            ? 'Tous'
            : AUDIT_PLAN_SCHEDULE_META[
                stepScheduleStatus as keyof typeof AUDIT_PLAN_SCHEDULE_META
              ]?.label || stepScheduleStatus
        }  |  Auditeur : ${stepAuditor === 'all' ? 'Tous' : stepAuditor}  |  Étapes : ${
          selectedStepItems.length
        }`,
      ],
      summaryTable:
        selectedStepItems.length > 1
          ? {
              title: `Récapitulatif des Étapes exportées (${selectedStepItems.length})`,
              headers: [
                'Mission',
                'Phase',
                'Étape',
                'Début -> Fin',
                'Avanc.',
                'Écart',
                'Tâches',
              ],
              colWeights: [0.9, 1.5, 2.3, 1.5, 0.7, 0.7, 0.7],
              rows: selectedStepItems.map((s) => [
                s.mission.meta.code,
                s.step.phaseName.replace('Phase de ', ''),
                `${s.step.stepNumber}. ${s.step.node.label}`,
                `${s.step.dateDebut} -> ${s.step.dateFin}`,
                `${s.step.progressionPct} %`,
                `${s.step.ecartJours > 0 ? `+${s.step.ecartJours}` : s.step.ecartJours} j`,
                String(s.step.tasks.length),
              ]),
            }
          : undefined,
      items,
    };
  }, [
    selectedStepItems,
    selectedStepSectionIds,
    stepExercice,
    stepDirection,
    stepMissionId,
    stepPhase,
    stepScheduleStatus,
    stepAuditor,
    clientName,
    userSignature,
    pdfOrientation,
  ]);

  // --- ACTIONS D'EXPORTATION ---
  const handleResetFilters = () => {
    if (activity === 'suivi-recos') {
      setRecoYear('all');
      setRecoDirection('all');
      setRecoCycle('all');
      setRecoMission('all');
      setRecoRisque('all');
      setRecoStatut('all');
      setRecoSearch('');
      setExcludedRecoRowIds(new Set());
    } else if (activity === 'plan-audit') {
      setPlanExercice('all');
      setPlanDirection('all');
      setPlanCycle('all');
      setPlanMissionId('all');
      setPlanRisque('all');
      setPlanScheduleStatus('all');
      setPlanAuditor('all');
      setPlanSearch('');
      setExcludedPlanRowKeys(new Set());
    } else if (activity === 'document') {
      setDocNature('all');
      setDocExercice('all');
      setDocSection('all');
      setDocSignature('all');
      setDocStatus('all');
      setDocOnlyWithBody(false);
      setDocSearch('');
      setExcludedDocIds(new Set());
    } else {
      setStepExercice('all');
      setStepDirection('all');
      setStepMissionId('all');
      setStepPhase('all');
      setStepScheduleStatus('all');
      setStepAuditor('all');
      setStepSearch('');
      setExcludedStepIds(new Set());
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    setExportFeedback(null);
    try {
      const stamp = new Date().toISOString().slice(0, 10);

      if (activity === 'suivi-recos') {
        const cols = recoColumns.filter((c) => selectedRecoColKeys.has(c.key));
        if (cols.length === 0 || selectedRecoEntries.length === 0) return;

        const scopePart = sanitizeFilenameSegment(
          recoMission !== 'all'
            ? recoMission
            : recoDirection !== 'all'
            ? recoDirection
            : recoYear !== 'all'
            ? recoYear
            : 'Complet'
        );

        await exportTableToExcelXlsx({
          filename: `Export_Suivi_Recos_${scopePart}_${stamp}.xlsx`,
          sheetName: 'Suivi Recos',
          title: 'Table Suivi des Recommandations d’Audit',
          headers: cols.map((c) => c.label),
          preferredWidths: cols.map((c) => c.width ?? 18),
          rows: selectedRecoEntries.map((entry) =>
            cols.map((c) => c.getValue(entry))
          ),
          metadataPairs: [
            ['Client', clientName],
            ['Auteur export', userSignature],
            ['Exercice / Année', recoYear === 'all' ? 'Tous les exercices' : recoYear],
            ['Direction', recoDirection === 'all' ? 'Toutes' : recoDirection],
            ['Cycle', recoCycle === 'all' ? 'Tous' : recoCycle],
            ['Mission', recoMission === 'all' ? 'Toutes' : recoMission],
            ['Risque / Statut', `${recoRisque === 'all' ? 'Tous risques' : recoRisque} · ${recoStatut === 'all' ? 'Tous statuts' : recoStatut}`],
          ],
        });

        const msg = `Excel exporté : ${selectedRecoEntries.length} recommandation(s), ${cols.length} colonne(s).`;
        setExportFeedback(msg);
        onStatusMessage?.(msg);
      } else {
        let headers: string[] = [];
        let preferredWidths: number[] = [];
        let rows: Array<Array<string | number>> = [];
        let sheetName = 'Plan Audit';
        let title = 'Plan Annuel d’Audit';

        if (planGranularity === 'steps') {
          const cols = PLAN_STEP_COLUMNS.filter((c) => selectedStepColKeys.has(c.key));
          const sel = filteredPlanStepRows.filter((r) => !excludedPlanRowKeys.has(r.rowKey));
          if (cols.length === 0 || sel.length === 0) return;
          headers = cols.map((c) => c.label);
          preferredWidths = cols.map((c) => c.width ?? 18);
          rows = sel.map((r) => cols.map((c) => c.getValue(r)));
          sheetName = 'Etapes Plan Audit';
          title = 'Plan Annuel d’Audit — Phases & Étapes';
        } else if (planGranularity === 'tasks') {
          const cols = PLAN_TASK_COLUMNS.filter((c) => selectedTaskColKeys.has(c.key));
          const sel = filteredPlanTaskRows.filter((r) => !excludedPlanRowKeys.has(r.rowKey));
          if (cols.length === 0 || sel.length === 0) return;
          headers = cols.map((c) => c.label);
          preferredWidths = cols.map((c) => c.width ?? 18);
          rows = sel.map((r) => cols.map((c) => c.getValue(r)));
          sheetName = 'Taches Auditeurs';
          title = 'Plan Annuel d’Audit — Tâches auditeurs (08h/j)';
        } else {
          const cols = planMissionColumns.filter((c) => selectedPlanColKeys.has(c.key));
          const sel = filteredPlanMissions.filter((m) => !excludedPlanRowKeys.has(m.node.id));
          if (cols.length === 0 || sel.length === 0) return;
          headers = cols.map((c) => c.label);
          preferredWidths = cols.map((c) => c.width ?? 18);
          rows = sel.map((m) => cols.map((c) => c.getValue(m)));
        }

        const scopePart = sanitizeFilenameSegment(
          planDirection !== 'all'
            ? planDirection
            : planCycle !== 'all'
            ? planCycle
            : planExercice !== 'all'
            ? planExercice
            : 'Plan_Annuel'
        );

        await exportTableToExcelXlsx({
          filename: `Export_Plan_Audit_${scopePart}_${stamp}.xlsx`,
          sheetName,
          title,
          headers,
          preferredWidths,
          rows,
          metadataPairs: [
            ['Client', clientName],
            ['Auteur export', userSignature],
            ['Exercice', planExercice === 'all' ? 'Tous' : planExercice],
            ['Direction', planDirection === 'all' ? 'Toutes' : planDirection],
            ['Cycle', planCycle === 'all' ? 'Tous' : planCycle],
            ['Mission', planMissionId === 'all' ? 'Toutes' : planMissionId],
            ['Granularité', planGranularity],
          ],
        });

        const msg = `Excel exporté : ${rows.length} ligne(s), ${headers.length} colonne(s).`;
        setExportFeedback(msg);
        onStatusMessage?.(msg);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = () => {
    setIsExporting(true);
    setExportFeedback(null);
    try {
      const stamp = new Date().toISOString().slice(0, 10);

      if (activity === 'suivi-recos') {
        if (recoPdfSections.length === 0) return;
        const filterSummary = [
          `Exercice : ${recoYear === 'all' ? 'Tous' : recoYear}  |  Direction : ${
            recoDirection === 'all' ? 'Toutes' : recoDirection
          }  |  Cycle : ${recoCycle === 'all' ? 'Tous' : recoCycle}`,
          `Mission : ${recoMission === 'all' ? 'Toutes' : recoMission}  |  Risque : ${
            recoRisque === 'all' ? 'Tous' : recoRisque
          }  |  Statut : ${recoStatut === 'all' ? 'Tous' : recoStatut}  |  Lignes : ${
            selectedRecoEntries.length
          }`,
        ];
        const payload: PdfDashboardExportPayload = {
          filename: `Dashboard_Suivi_Recos_${recoYear === 'all' ? 'Tous' : recoYear}_${stamp}.pdf`,
          title: 'Dashboard — Suivi des Recommandations d’Audit',
          subtitle: `${selectedRecoKpiIds.size} catégorie(s) KPI · ${selectedRecoEntries.length} recommandation(s)`,
          filterLines: filterSummary,
          client: clientName,
          signature: userSignature,
          orientation: pdfOrientation,
          sections: recoPdfSections,
        };
        exportDashboardToPdf(payload);
        const msg = `Dashboard PDF téléchargé (${recoPdfSections.length} bloc(s) KPI, ${selectedRecoEntries.length} recos).`;
        setExportFeedback(msg);
        onStatusMessage?.(msg);
      } else if (activity === 'plan-audit') {
        if (planPdfSections.length === 0) return;
        const selectedMissionObj = filteredPlanMissions.find((m) => m.node.id === planMissionId);
        const filterSummary = [
          `Exercice : ${planExercice === 'all' ? 'Tous' : planExercice}  |  Direction : ${
            planDirection === 'all' ? 'Toutes' : planDirection
          }  |  Cycle : ${planCycle === 'all' ? 'Tous' : planCycle}`,
          `Mission : ${
            selectedMissionObj ? selectedMissionObj.meta.code : 'Toutes'
          }  |  Risque : ${planRisque === 'all' ? 'Tous' : planRisque}  |  Planning : ${
            planScheduleStatus === 'all' ? 'Tous' : planScheduleStatus
          }  |  Auditeur : ${planAuditor === 'all' ? 'Tous' : planAuditor}`,
        ];
        const payload: PdfDashboardExportPayload = {
          filename: `Dashboard_Plan_Audit_${planExercice === 'all' ? 'Tous' : planExercice}_${stamp}.pdf`,
          title: 'Dashboard — Plan Annuel d’Audit',
          subtitle: `${selectedPlanKpiIds.size} catégorie(s) KPI · ${filteredPlanMissions.length} mission(s)`,
          filterLines: filterSummary,
          client: clientName,
          signature: userSignature,
          orientation: pdfOrientation,
          sections: planPdfSections,
        };
        exportDashboardToPdf(payload);
        const msg = `Dashboard PDF téléchargé (${planPdfSections.length} bloc(s) KPI, ${filteredPlanMissions.length} missions).`;
        setExportFeedback(msg);
        onStatusMessage?.(msg);
      } else if (activity === 'document') {
        if (selectedDocItems.length === 0 || selectedDocSectionIds.size === 0) return;
        exportStructuredReportToPdf(documentReportPayload);
        const msg = `PDF Document exporté (${selectedDocItems.length} document(s), ${selectedDocSectionIds.size} rubrique(s)).`;
        setExportFeedback(msg);
        onStatusMessage?.(msg);
      } else {
        if (selectedStepItems.length === 0 || selectedStepSectionIds.size === 0) return;
        exportStructuredReportToPdf(stepReportPayload);
        const msg = `PDF Étapes de mission exporté (${selectedStepItems.length} étape(s)).`;
        setExportFeedback(msg);
        onStatusMessage?.(msg);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDocx = async () => {
    setIsExporting(true);
    setExportFeedback(null);
    try {
      if (activity === 'document') {
        if (selectedDocItems.length === 0 || selectedDocSectionIds.size === 0) return;
        await exportStructuredReportToDocx(documentReportPayload);
        const msg = `Word (.docx) exporté : ${selectedDocItems.length} document(s), ${selectedDocSectionIds.size} rubrique(s).`;
        setExportFeedback(msg);
        onStatusMessage?.(msg);
      } else if (activity === 'etape-mission') {
        if (selectedStepItems.length === 0 || selectedStepSectionIds.size === 0) return;
        await exportStructuredReportToDocx(stepReportPayload);
        const msg = `Word (.docx) exporté : ${selectedStepItems.length} étape(s) de mission.`;
        setExportFeedback(msg);
        onStatusMessage?.(msg);
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Calculs d'activation
  const activeColumnsCount =
    activity === 'suivi-recos'
      ? selectedRecoColKeys.size
      : planGranularity === 'steps'
      ? selectedStepColKeys.size
      : planGranularity === 'tasks'
      ? selectedTaskColKeys.size
      : selectedPlanColKeys.size;

  const activeRowsCount =
    activity === 'suivi-recos'
      ? selectedRecoEntries.length
      : selectedPlanTableRows.length;

  const activeKpiCount =
    activity === 'suivi-recos' ? recoPdfSections.length : planPdfSections.length;

  const isDocOrStepMode = activity === 'document' || activity === 'etape-mission';
  const activeStructuredItemsCount =
    activity === 'document' ? selectedDocItems.length : selectedStepItems.length;
  const activeStructuredRubricsCount =
    activity === 'document' ? selectedDocSectionIds.size : selectedStepSectionIds.size;

  const canExport = isDocOrStepMode
    ? activeStructuredItemsCount > 0 && activeStructuredRubricsCount > 0
    : formatKind === 'table'
    ? activeColumnsCount > 0 && activeRowsCount > 0
    : activeKpiCount > 0;

  const activeReportPayload =
    activity === 'document' ? documentReportPayload : stepReportPayload;

  const switchActivity = (nextAct: ExportActivityType) => {
    setActivity(nextAct);
    setExportFeedback(null);
    if (nextAct === 'document' || nextAct === 'etape-mission') {
      if (formatKind !== 'docx' && formatKind !== 'pdf') setFormatKind('docx');
      setPdfOrientation('portrait');
    } else {
      if (formatKind !== 'table' && formatKind !== 'dashboard') setFormatKind('table');
      setPdfOrientation('landscape');
    }
  };

  const triggerPrimaryExport = () => {
    if (isDocOrStepMode) {
      if (formatKind === 'pdf') handleExportPdf();
      else void handleExportDocx();
      return;
    }
    if (formatKind === 'table') void handleExportExcel();
    else handleExportPdf();
  };

  return (
    <div
      aria-label="Fenêtre d'exportation des états"
      className="flex min-h-0 flex-1 flex-col border-b border-slate-200 bg-white text-slate-900 lg:border-b-0 lg:border-r lg:border-slate-200"
    >
      {/* En-tête minimaliste blanc */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display truncate text-sm font-semibold text-slate-900">
              Exporter état ·{' '}
              {activity === 'suivi-recos'
                ? 'Suivi des recos'
                : activity === 'plan-audit'
                ? 'Plan d’audit'
                : activity === 'document'
                ? 'Document'
                : 'Étape de mission'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {isDocOrStepMode
                ? 'Paramètres liés & sélection partielle ou complète · Export Word (.docx) et PDF (.pdf)'
                : 'Paramètres liés par nature d’activité · Table en Excel (.xlsx) et Dashboard en PDF (.pdf)'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Switch Section d'export */}
            <div className="inline-flex flex-wrap items-center rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
              {(
                [
                  ['suivi-recos', 'Suivi des recos'],
                  ['plan-audit', 'Plan d’audit'],
                  ['document', 'Document'],
                  ['etape-mission', 'Étape de mission'],
                ] as Array<[ExportActivityType, string]>
              ).map(([actKey, actLabel]) => (
                <button
                  key={actKey}
                  type="button"
                  onClick={() => switchActivity(actKey)}
                  className={`rounded px-2.5 py-1 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activity === actKey
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {actLabel}
                </button>
              ))}
            </div>

            {/* Switch Format selon la section */}
            {isDocOrStepMode ? (
              <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setFormatKind('docx');
                    setExportFeedback(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    formatKind === 'docx'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Word (.docx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormatKind('pdf');
                    setExportFeedback(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    formatKind === 'pdf'
                      ? 'bg-white text-rose-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>PDF (.pdf)</span>
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setFormatKind('table');
                    setExportFeedback(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    formatKind === 'table'
                      ? 'bg-white text-emerald-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Table (Excel)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormatKind('dashboard');
                    setExportFeedback(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    formatKind === 'dashboard'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Dashboard (PDF)</span>
                </button>
              </div>
            )}

            {/* Bouton principal d'exportation */}
            <button
              type="button"
              disabled={!canExport || isExporting}
              onClick={triggerPrimaryExport}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {isDocOrStepMode
                  ? formatKind === 'pdf'
                    ? `Exporter PDF (${activeStructuredItemsCount})`
                    : `Exporter Word .docx (${activeStructuredItemsCount})`
                  : formatKind === 'table'
                  ? `Exporter Excel (${activeRowsCount} lign.)`
                  : `Exporter PDF (${activeKpiCount} KPI)`}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la fenêtre d'exportation"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {exportFeedback && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {exportFeedback}
            </span>
            <button
              type="button"
              onClick={() => setExportFeedback(null)}
              className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Corps scrollable en accordéons propres */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4">
        {/* BLOC 1 : PARAMÈTRES LIÉS */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <button
              type="button"
              onClick={() => toggleBlock('params')}
              className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
            >
              {openBlocks.has('params') ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              )}
              <Filter className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              <span className="text-xs font-semibold text-slate-900">
                Paramètres liés (
                {activity === 'suivi-recos'
                  ? 'Année, Direction, Cycle, Mission, Risque, Statut'
                  : activity === 'plan-audit'
                  ? 'Exercice, Direction, Cycle, Mission, Planning, Auditeur'
                  : activity === 'document'
                  ? 'Workflow, Exercice, Dossier, Signataire, Statut'
                  : 'Exercice, Direction, Mission, Phase, Statut, Auditeur'}
                )
              </span>
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Réinitialiser
            </button>
          </div>

          {openBlocks.has('params') && (
            <div className="border-t border-slate-100 px-4 py-3">
              {activity === 'suivi-recos' ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Exercice / Année</span>
                    <select
                      value={recoYear}
                      onChange={(e) => setRecoYear(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les exercices ({allRecoEntries.length})</option>
                      {recoYearsOptions.map((y) => (
                        <option key={y} value={y}>
                          Exercice {y}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Direction</span>
                    <select
                      value={recoDirection}
                      onChange={(e) => setRecoDirection(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Toutes les directions ({recoDirectionOptions.length})</option>
                      {recoDirectionOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Cycle</span>
                    <select
                      value={recoCycle}
                      onChange={(e) => setRecoCycle(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les cycles ({recoCycleOptions.length})</option>
                      {recoCycleOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Mission</span>
                    <select
                      value={recoMission}
                      onChange={(e) => setRecoMission(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Toutes les missions ({recoMissionOptions.length})</option>
                      {recoMissionOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Évaluation Risque</span>
                    <select
                      value={recoRisque}
                      onChange={(e) => setRecoRisque(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les risques</option>
                      <option value="Critique">Critique</option>
                      <option value="Majeur">Majeur</option>
                      <option value="Modéré">Modéré</option>
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Statut</span>
                    <select
                      value={recoStatut}
                      onChange={(e) => setRecoStatut(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les statuts</option>
                      <option value="Réalisé">Réalisé</option>
                      <option value="En attente">En attente</option>
                      <option value="Reporté">Reporté</option>
                      <option value="Non réalisé">Non réalisé</option>
                    </select>
                  </label>

                  <label className="space-y-1 text-xs sm:col-span-2">
                    <span className="block font-medium text-slate-600">Recherche texte</span>
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={recoSearch}
                        onChange={(e) => setRecoSearch(e.target.value)}
                        placeholder="Référence, intitulé, responsable..."
                        className="w-full rounded border border-slate-300 bg-white py-1.5 pr-2.5 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                  </label>
                </div>
              ) : activity === 'plan-audit' ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Exercice</span>
                    <select
                      value={planExercice}
                      onChange={(e) => setPlanExercice(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les exercices ({allPlanMissions.length} missions)</option>
                      {planExerciceOptions.map((y) => (
                        <option key={y} value={y}>
                          Exercice {y}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Direction</span>
                    <select
                      value={planDirection}
                      onChange={(e) => setPlanDirection(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Toutes les directions ({planDirectionOptions.length})</option>
                      {planDirectionOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Cycle d’audit</span>
                    <select
                      value={planCycle}
                      onChange={(e) => setPlanCycle(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les cycles ({planCycleOptions.length})</option>
                      {planCycleOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Mission</span>
                    <select
                      value={planMissionId}
                      onChange={(e) => setPlanMissionId(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Toutes les missions ({planMissionOptions.length})</option>
                      {planMissionOptions.map((m) => (
                        <option key={m.node.id} value={m.node.id}>
                          {m.node.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Niveau de risque</span>
                    <select
                      value={planRisque}
                      onChange={(e) => setPlanRisque(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les risques</option>
                      <option value="Critique">Critique</option>
                      <option value="Élevé">Élevé</option>
                      <option value="Moyen">Moyen</option>
                      <option value="Faible">Faible</option>
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Statut planning</span>
                    <select
                      value={planScheduleStatus}
                      onChange={(e) => setPlanScheduleStatus(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les statuts</option>
                      <option value="en-avance">En avance</option>
                      <option value="normal">Progression normale</option>
                      <option value="en-retard">En retard</option>
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Auditeur</span>
                    <select
                      value={planAuditor}
                      onChange={(e) => setPlanAuditor(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les auditeurs ({planAuditorOptions.length})</option>
                      {planAuditorOptions.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Recherche texte</span>
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={planSearch}
                        onChange={(e) => setPlanSearch(e.target.value)}
                        placeholder="Code, mission, objectif..."
                        className="w-full rounded border border-slate-300 bg-white py-1.5 pr-2.5 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                  </label>
                </div>
              ) : activity === 'document' ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Workflow / Nature</span>
                    <select
                      value={docNature}
                      onChange={(e) => {
                        setDocNature(e.target.value);
                        setExcludedDocIds(new Set());
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les workflows ({allWorkflowDocuments.length} docs)</option>
                      {docNatureOptions.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Exercice</span>
                    <select
                      value={docExercice}
                      onChange={(e) => {
                        setDocExercice(e.target.value);
                        setExcludedDocIds(new Set());
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les exercices ({docExerciceOptions.length})</option>
                      {docExerciceOptions.map((ex) => (
                        <option key={ex} value={ex}>
                          {ex}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Dossier / Section</span>
                    <select
                      value={docSection}
                      onChange={(e) => {
                        setDocSection(e.target.value);
                        setExcludedDocIds(new Set());
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les dossiers ({docSectionOptions.length})</option>
                      {docSectionOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Signataire / Owner</span>
                    <select
                      value={docSignature}
                      onChange={(e) => setDocSignature(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous ({docSignatureOptions.length})</option>
                      {docSignatureOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Statut document</span>
                    <select
                      value={docStatus}
                      onChange={(e) => setDocStatus(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les statuts</option>
                      <option value="todo">À faire</option>
                      <option value="in-progress">En cours</option>
                      <option value="in-review">En revue</option>
                      <option value="validated">Validé</option>
                    </select>
                  </label>

                  <label className="space-y-1 text-xs sm:col-span-2">
                    <span className="block font-medium text-slate-600">Recherche texte</span>
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={docSearch}
                        onChange={(e) => setDocSearch(e.target.value)}
                        placeholder="Titre document, réf. Drive, contenu Word..."
                        className="w-full rounded border border-slate-300 bg-white py-1.5 pr-2.5 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 self-end rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={docOnlyWithBody}
                      onChange={(e) => setDocOnlyWithBody(e.target.checked)}
                      className="accent-slate-900"
                    />
                    <span className="font-medium">Contenu rédigé uniquement</span>
                  </label>
                </div>
              ) : (
                /* ÉTAPE DE MISSION */
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Exercice</span>
                    <select
                      value={stepExercice}
                      onChange={(e) => {
                        setStepExercice(e.target.value);
                        setExcludedStepIds(new Set());
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les exercices ({allMissionSteps.length} étapes)</option>
                      {stepExerciceOptions.map((y) => (
                        <option key={y} value={y}>
                          Exercice {y}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Direction</span>
                    <select
                      value={stepDirection}
                      onChange={(e) => {
                        setStepDirection(e.target.value);
                        setExcludedStepIds(new Set());
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Toutes les directions ({stepDirectionOptions.length})</option>
                      {stepDirectionOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Mission</span>
                    <select
                      value={stepMissionId}
                      onChange={(e) => {
                        setStepMissionId(e.target.value);
                        setExcludedStepIds(new Set());
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Toutes les missions ({stepMissionOptions.length})</option>
                      {stepMissionOptions.map(([mId, mLabel]) => (
                        <option key={mId} value={mId}>
                          {mLabel}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Phase de mission</span>
                    <select
                      value={stepPhase}
                      onChange={(e) => {
                        setStepPhase(e.target.value);
                        setExcludedStepIds(new Set());
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Toutes les phases ({stepPhaseOptions.length})</option>
                      {stepPhaseOptions.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Statut planning</span>
                    <select
                      value={stepScheduleStatus}
                      onChange={(e) => setStepScheduleStatus(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les statuts</option>
                      <option value="en-avance">En avance</option>
                      <option value="normal">Progression normale</option>
                      <option value="en-retard">En retard</option>
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">Auditeur</span>
                    <select
                      value={stepAuditor}
                      onChange={(e) => setStepAuditor(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    >
                      <option value="all">Tous les auditeurs ({stepAuditorOptions.length})</option>
                      {stepAuditorOptions.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs sm:col-span-2">
                    <span className="block font-medium text-slate-600">Recherche étape / tâche</span>
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={stepSearch}
                        onChange={(e) => setStepSearch(e.target.value)}
                        placeholder="Nom de l'étape, norme CRIPP, tâche..."
                        className="w-full rounded border border-slate-300 bg-white py-1.5 pr-2.5 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CONTENU PRINCIPAL SELON LA SECTION */}
        {isDocOrStepMode ? (
          /* SECTION DOCUMENT OU ÉTAPE DE MISSION (.docx / .pdf) */
          <>
            {/* Liste cochable des Documents ou Étapes à exporter */}
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleBlock('rows')}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                >
                  {openBlocks.has('rows') ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  )}
                  <Layers className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="text-xs font-semibold text-slate-900 tabular-nums">
                    {activity === 'document'
                      ? `Documents à exporter : ${selectedDocItems.length} / ${filteredDocuments.length} coché(s)`
                      : `Étapes de mission à exporter : ${selectedStepItems.length} / ${filteredMissionSteps.length} cochée(s)`}
                  </span>
                </button>

                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      if (activity === 'document') setExcludedDocIds(new Set());
                      else setExcludedStepIds(new Set());
                    }}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <CheckSquare className="h-3 w-3" aria-hidden="true" />
                    Tout sélectionner
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (activity === 'document') {
                        setExcludedDocIds(new Set(filteredDocuments.map((d) => d.id)));
                      } else {
                        setExcludedStepIds(new Set(filteredMissionSteps.map((s) => s.id)));
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-50 cursor-pointer"
                  >
                    <Square className="h-3 w-3" aria-hidden="true" />
                    Tout désélectionner
                  </button>
                </div>
              </div>

              {openBlocks.has('rows') && (
                <div className="max-h-[260px] overflow-auto border-t border-slate-200">
                  {activity === 'document' ? (
                    filteredDocuments.length === 0 ? (
                      <p className="p-6 text-center text-xs text-slate-500">
                        Aucun document ne correspond aux filtres sélectionnés.
                      </p>
                    ) : (
                      <table className="w-full border-collapse text-left text-xs">
                        <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] font-semibold text-slate-700">
                          <tr className="border-b border-slate-200">
                            <th className="w-9 px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={selectedDocItems.length === filteredDocuments.length}
                                onChange={() => {
                                  if (selectedDocItems.length === filteredDocuments.length) {
                                    setExcludedDocIds(
                                      new Set(filteredDocuments.map((d) => d.id))
                                    );
                                  } else {
                                    setExcludedDocIds(new Set());
                                  }
                                }}
                                aria-label="Tout sélectionner"
                                className="accent-slate-900"
                              />
                            </th>
                            <th className="px-3 py-2">Document</th>
                            <th className="px-3 py-2 whitespace-nowrap">Workflow</th>
                            <th className="px-3 py-2 whitespace-nowrap">Dossier</th>
                            <th className="px-3 py-2 whitespace-nowrap">Sign.</th>
                            <th className="px-3 py-2 whitespace-nowrap">Contenu</th>
                            <th className="px-3 py-2 whitespace-nowrap">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredDocuments.slice(0, 180).map((docItem) => {
                            const isSelected = !excludedDocIds.has(docItem.id);
                            return (
                              <tr
                                key={docItem.id}
                                onClick={() => {
                                  setExcludedDocIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(docItem.id)) next.delete(docItem.id);
                                    else next.add(docItem.id);
                                    return next;
                                  });
                                }}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-white hover:bg-slate-50'
                                    : 'bg-slate-50/50 text-slate-400'
                                }`}
                              >
                                <td
                                  className="px-3 py-2 text-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      setExcludedDocIds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(docItem.id)) next.delete(docItem.id);
                                        else next.add(docItem.id);
                                        return next;
                                      });
                                    }}
                                    aria-label={`Sélectionner ${docItem.node.label}`}
                                    className="accent-slate-900"
                                  />
                                </td>
                                <td
                                  className="max-w-[260px] truncate px-3 py-2 font-medium text-slate-900"
                                  title={docItem.node.label}
                                >
                                  {docItem.node.label}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                                  {docItem.natureLabel}
                                </td>
                                <td
                                  className="max-w-[180px] truncate px-3 py-2 text-slate-600"
                                  title={docItem.sectionLabel}
                                >
                                  {docItem.sectionLabel}
                                </td>
                                <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">
                                  {docItem.signatureLabel}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-[11px]">
                                  {docItem.hasCustomBody ? (
                                    <span className="font-medium text-emerald-700">
                                      Rédigé ({docItem.bodyText.length} c.)
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">Fiche méta</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {docItem.statusLabel}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )
                  ) : filteredMissionSteps.length === 0 ? (
                    <p className="p-6 text-center text-xs text-slate-500">
                      Aucune étape de mission ne correspond aux filtres sélectionnés.
                    </p>
                  ) : (
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] font-semibold text-slate-700">
                        <tr className="border-b border-slate-200">
                          <th className="w-9 px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedStepItems.length === filteredMissionSteps.length}
                              onChange={() => {
                                if (selectedStepItems.length === filteredMissionSteps.length) {
                                  setExcludedStepIds(
                                    new Set(filteredMissionSteps.map((s) => s.id))
                                  );
                                } else {
                                  setExcludedStepIds(new Set());
                                }
                              }}
                              aria-label="Tout sélectionner"
                              className="accent-slate-900"
                            />
                          </th>
                          <th className="px-3 py-2 whitespace-nowrap">Mission</th>
                          <th className="px-3 py-2 whitespace-nowrap">Phase</th>
                          <th className="px-3 py-2">Étape de mission</th>
                          <th className="px-3 py-2 whitespace-nowrap">Période</th>
                          <th className="px-3 py-2 whitespace-nowrap">Avanc.</th>
                          <th className="px-3 py-2 whitespace-nowrap">Écart</th>
                          <th className="px-3 py-2 whitespace-nowrap">Tâches</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredMissionSteps.map((stItem) => {
                          const isSelected = !excludedStepIds.has(stItem.id);
                          const stMeta =
                            AUDIT_PLAN_SCHEDULE_META[stItem.step.statutProgression];
                          return (
                            <tr
                              key={stItem.id}
                              onClick={() => {
                                setExcludedStepIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(stItem.id)) next.delete(stItem.id);
                                  else next.add(stItem.id);
                                  return next;
                                });
                              }}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-white hover:bg-slate-50'
                                  : 'bg-slate-50/50 text-slate-400'
                              }`}
                            >
                              <td
                                className="px-3 py-2 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setExcludedStepIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(stItem.id)) next.delete(stItem.id);
                                      else next.add(stItem.id);
                                      return next;
                                    });
                                  }}
                                  aria-label={`Sélectionner étape ${stItem.step.stepNumber}`}
                                  className="accent-slate-900"
                                />
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] font-semibold whitespace-nowrap">
                                {stItem.mission.meta.code}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                                {stItem.step.phaseName.replace('Phase de ', '')}
                              </td>
                              <td
                                className="max-w-[260px] truncate px-3 py-2 font-medium text-slate-900"
                                title={stItem.step.node.label}
                              >
                                {stItem.step.stepNumber}. {stItem.step.node.label}
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap tabular-nums">
                                {stItem.step.dateDebut} → {stItem.step.dateFin}
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap tabular-nums">
                                {stItem.step.progressionPct}%
                              </td>
                              <td
                                className={`px-3 py-2 font-mono text-[11px] font-semibold whitespace-nowrap tabular-nums ${stMeta.textClass}`}
                              >
                                {stItem.step.ecartJours > 0
                                  ? `+${stItem.step.ecartJours}j`
                                  : `${stItem.step.ecartJours}j`}
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap tabular-nums">
                                {stItem.step.tasks.length} ({stItem.plannedHours}h)
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Grille Options de rubriques + Aperçu structuré Word / PDF */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[330px_1fr]">
              {/* Colonne Rubriques à inclure */}
              <div className="space-y-3">
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">
                        Rubriques à inclure ({activeStructuredRubricsCount})
                      </span>
                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            if (activity === 'document') {
                              setSelectedDocSectionIds(
                                new Set(DOC_SECTION_OPTIONS.map((c) => c.id))
                              );
                            } else {
                              setSelectedStepSectionIds(
                                new Set(STEP_SECTION_OPTIONS.map((c) => c.id))
                              );
                            }
                          }}
                          className="rounded border border-slate-200 px-1.5 py-0.5 text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          Tout
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (activity === 'document') setSelectedDocSectionIds(new Set());
                            else setSelectedStepSectionIds(new Set());
                          }}
                          className="rounded border border-slate-200 px-1.5 py-0.5 text-slate-500 hover:bg-slate-50 cursor-pointer"
                        >
                          Aucun
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {(activity === 'document'
                      ? DOC_SECTION_OPTIONS
                      : STEP_SECTION_OPTIONS
                    ).map((opt) => {
                      const activeSet =
                        activity === 'document'
                          ? selectedDocSectionIds
                          : selectedStepSectionIds;
                      const isChecked = activeSet.has(opt.id);
                      return (
                        <label
                          key={opt.id}
                          className={`flex cursor-pointer items-start gap-2.5 px-4 py-2.5 transition-colors ${
                            isChecked
                              ? 'bg-white hover:bg-slate-50'
                              : 'bg-slate-50/50 text-slate-500'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const toggle = (prev: Set<string>) => {
                                const next = new Set(prev);
                                if (next.has(opt.id)) next.delete(opt.id);
                                else next.add(opt.id);
                                return next;
                              };
                              if (activity === 'document') setSelectedDocSectionIds(toggle);
                              else setSelectedStepSectionIds(toggle);
                            }}
                            className="mt-0.5 accent-slate-900"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-900">
                              {opt.label}
                            </div>
                            <div className="mt-0.5 text-[11px] leading-snug text-slate-500">
                              {opt.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">Mise en page A4</span>
                      <div className="inline-flex rounded border border-slate-200 bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() => setPdfOrientation('portrait')}
                          className={`rounded px-2 py-0.5 text-[11px] font-medium cursor-pointer ${
                            pdfOrientation === 'portrait'
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600'
                          }`}
                        >
                          Portrait
                        </button>
                        <button
                          type="button"
                          onClick={() => setPdfOrientation('landscape')}
                          className={`rounded px-2 py-0.5 text-[11px] font-medium cursor-pointer ${
                            pdfOrientation === 'landscape'
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600'
                          }`}
                        >
                          Paysage
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={!canExport || isExporting}
                        onClick={() => void handleExportDocx()}
                        className="inline-flex items-center justify-center gap-1.5 rounded border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        Word (.docx)
                      </button>
                      <button
                        type="button"
                        disabled={!canExport || isExporting}
                        onClick={handleExportPdf}
                        className="inline-flex items-center justify-center gap-1.5 rounded border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        PDF (.pdf)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Aperçu en direct du Dossier Word / PDF */}
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-900 px-5 py-3 text-white">
                  <div className="min-w-0">
                    <h4 className="font-display truncate text-sm font-semibold">
                      Aperçu {formatKind === 'pdf' ? 'PDF (.pdf)' : 'Word (.docx)'} ·{' '}
                      {activeReportPayload.docTitle}
                    </h4>
                    <p className="mt-0.5 text-[11px] text-slate-300 tabular-nums">
                      {activeReportPayload.docSubtitle}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-amber-300">
                    A4 {pdfOrientation === 'landscape' ? 'Paysage' : 'Portrait'}
                  </span>
                </div>

                <div className="max-h-[480px] space-y-4 overflow-y-auto p-5">
                  {activeReportPayload.items.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-500">
                      Cochez au moins un élément ci-dessus pour générer et exporter le fichier Word (.docx) ou PDF (.pdf).
                    </div>
                  ) : activeStructuredRubricsCount === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-500">
                      Cochez au moins une rubrique à gauche pour structurer le contenu exporté.
                    </div>
                  ) : (
                    <>
                      {activeReportPayload.summaryTable && (
                        <div className="overflow-hidden rounded border border-slate-200">
                          <div className="border-b border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900">
                            {activeReportPayload.summaryTable.title}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-xs">
                              <thead>
                                <tr className="bg-slate-900 text-[11px] font-semibold text-white">
                                  {activeReportPayload.summaryTable.headers.map((h) => (
                                    <th key={h} className="px-3 py-1.5 whitespace-nowrap">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {activeReportPayload.summaryTable.rows.slice(0, 10).map((r, rIdx) => (
                                  <tr
                                    key={rIdx}
                                    className={rIdx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                                  >
                                    {r.map((cell, cIdx) => (
                                      <td
                                        key={cIdx}
                                        className="max-w-[200px] truncate px-3 py-1.5 text-slate-800 tabular-nums"
                                      >
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {activeReportPayload.items.slice(0, 8).map((item, idx) => (
                        <div
                          key={`${item.title}-${idx}`}
                          className="overflow-hidden rounded border border-slate-200 bg-white"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                            <div className="min-w-0">
                              <h5 className="truncate text-xs font-bold text-slate-900">
                                {idx + 1}. {item.title}
                              </h5>
                              <p className="truncate text-[11px] text-slate-500">
                                {item.pathSubtitle}
                              </p>
                            </div>
                            {item.badge && (
                              <span className="font-mono text-[11px] font-semibold text-sky-700">
                                {item.badge}
                              </span>
                            )}
                          </div>

                          <div className="space-y-3 p-4">
                            {item.metaPairs.length > 0 && (
                              <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 rounded border border-slate-100 bg-slate-50/70 p-2.5 text-[11px] sm:grid-cols-2">
                                {item.metaPairs.map((kv) => (
                                  <div key={kv.label} className="flex gap-2">
                                    <span className="shrink-0 font-semibold text-slate-500">
                                      {kv.label} :
                                    </span>
                                    <span className="truncate text-slate-900" title={kv.value}>
                                      {kv.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {item.blocks.map((blk) => (
                              <div key={blk.heading} className="space-y-1.5">
                                <div className="text-xs font-semibold text-slate-800">
                                  {blk.heading}
                                </div>
                                {blk.subheading && (
                                  <div className="text-[11px] italic text-slate-500">
                                    {blk.subheading}
                                  </div>
                                )}
                                {blk.metaPairs && blk.metaPairs.length > 0 && (
                                  <div className="grid grid-cols-1 gap-1.5 rounded border border-slate-100 bg-slate-50 p-2 text-[11px] sm:grid-cols-2">
                                    {blk.metaPairs.map((kv) => (
                                      <div key={kv.label} className="flex gap-1.5">
                                        <span className="font-semibold text-slate-500">
                                          {kv.label} :
                                        </span>
                                        <span className="text-slate-900">{kv.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {blk.paragraphs && blk.paragraphs.length > 0 && (
                                  <div className="whitespace-pre-line rounded border border-slate-100 bg-white p-2.5 text-xs leading-relaxed text-slate-700">
                                    {blk.paragraphs.join('\n\n')}
                                  </div>
                                )}
                                {blk.table && (
                                  <div className="overflow-x-auto rounded border border-slate-200">
                                    <table className="w-full border-collapse text-left text-[11px]">
                                      <thead>
                                        <tr className="bg-slate-900 text-white">
                                          {blk.table.headers.map((h) => (
                                            <th key={h} className="px-2.5 py-1 whitespace-nowrap">
                                              {h}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {blk.table.rows.length === 0 ? (
                                          <tr>
                                            <td
                                              colSpan={blk.table.headers.length}
                                              className="px-2.5 py-2 text-center italic text-slate-400"
                                            >
                                              Aucune ligne associée.
                                            </td>
                                          </tr>
                                        ) : (
                                          blk.table.rows.slice(0, 6).map((row, rIdx) => (
                                            <tr
                                              key={rIdx}
                                              className={
                                                rIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                                              }
                                            >
                                              {row.map((cell, cIdx) => (
                                                <td
                                                  key={cIdx}
                                                  className="max-w-[180px] truncate px-2.5 py-1 text-slate-800"
                                                  title={cell}
                                                >
                                                  {cell}
                                                </td>
                                              ))}
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {activeReportPayload.items.length > 8 && (
                        <p className="text-center text-[11px] italic text-slate-500">
                          Aperçu limité aux 8 premiers éléments — l’export téléchargé inclura l’intégralité des{' '}
                          {activeReportPayload.items.length} éléments cochés.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : formatKind === 'table' ? (
          /* MODE TABLE EXCEL (SUIVI RECOS / PLAN D'AUDIT) */
          <>
            {activity === 'plan-audit' && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
                <span className="text-xs font-semibold text-slate-800">
                  Niveau du tableau source à exporter
                </span>
                <div className="inline-flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                  {(
                    [
                      ['missions', 'Missions (Plan annuel)'],
                      ['steps', 'Phases & Étapes (17/mission)'],
                      ['tasks', 'Tâches auditeurs (08h/j)'],
                    ] as Array<[PlanTableGranularity, string]>
                  ).map(([gId, gLabel]) => (
                    <button
                      key={gId}
                      type="button"
                      onClick={() => {
                        setPlanGranularity(gId);
                        setExcludedPlanRowKeys(new Set());
                      }}
                      className={`rounded px-2.5 py-1 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        planGranularity === gId
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {gLabel}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* BLOC 2 : LISTE DES COLONNES SOURCES */}
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleBlock('columns')}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                >
                  {openBlocks.has('columns') ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  )}
                  <span className="text-xs font-semibold text-slate-900">
                    Colonnes du tableau source à exporter ({activeColumnsCount} sélectionnée(s))
                  </span>
                </button>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      if (activity === 'suivi-recos') {
                        setSelectedRecoColKeys(
                          new Set(recoColumns.filter((c) => c.isDefaultKey).map((c) => c.key))
                        );
                      } else if (planGranularity === 'steps') {
                        setSelectedStepColKeys(
                          new Set(PLAN_STEP_COLUMNS.filter((c) => c.isDefaultKey).map((c) => c.key))
                        );
                      } else if (planGranularity === 'tasks') {
                        setSelectedTaskColKeys(
                          new Set(PLAN_TASK_COLUMNS.filter((c) => c.isDefaultKey).map((c) => c.key))
                        );
                      } else {
                        setSelectedPlanColKeys(
                          new Set(planMissionColumns.filter((c) => c.isDefaultKey).map((c) => c.key))
                        );
                      }
                    }}
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Colonnes clés
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (activity === 'suivi-recos') {
                        setSelectedRecoColKeys(new Set(recoColumns.map((c) => c.key)));
                      } else if (planGranularity === 'steps') {
                        setSelectedStepColKeys(new Set(PLAN_STEP_COLUMNS.map((c) => c.key)));
                      } else if (planGranularity === 'tasks') {
                        setSelectedTaskColKeys(new Set(PLAN_TASK_COLUMNS.map((c) => c.key)));
                      } else {
                        setSelectedPlanColKeys(new Set(planMissionColumns.map((c) => c.key)));
                      }
                    }}
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Tout cocher
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (activity === 'suivi-recos') setSelectedRecoColKeys(new Set());
                      else if (planGranularity === 'steps') setSelectedStepColKeys(new Set());
                      else if (planGranularity === 'tasks') setSelectedTaskColKeys(new Set());
                      else setSelectedPlanColKeys(new Set());
                    }}
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-50 cursor-pointer"
                  >
                    Tout décocher
                  </button>
                </div>
              </div>

              {openBlocks.has('columns') && (
                <div className="border-t border-slate-100 px-4 py-3">
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                    {(activity === 'suivi-recos'
                      ? recoColumns
                      : planGranularity === 'steps'
                      ? PLAN_STEP_COLUMNS
                      : planGranularity === 'tasks'
                      ? PLAN_TASK_COLUMNS
                      : planMissionColumns
                    ).map((col) => {
                      const activeSet =
                        activity === 'suivi-recos'
                          ? selectedRecoColKeys
                          : planGranularity === 'steps'
                          ? selectedStepColKeys
                          : planGranularity === 'tasks'
                          ? selectedTaskColKeys
                          : selectedPlanColKeys;
                      const isChecked = activeSet.has(col.key);

                      return (
                        <label
                          key={col.key}
                          className={`flex cursor-pointer items-center gap-2 rounded border px-2.5 py-1.5 text-xs transition-colors ${
                            isChecked
                              ? 'border-slate-300 bg-slate-50 font-medium text-slate-900'
                              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const toggleIn = (prev: Set<string>) => {
                                const next = new Set(prev);
                                if (next.has(col.key)) next.delete(col.key);
                                else next.add(col.key);
                                return next;
                              };
                              if (activity === 'suivi-recos') setSelectedRecoColKeys(toggleIn);
                              else if (planGranularity === 'steps') setSelectedStepColKeys(toggleIn);
                              else if (planGranularity === 'tasks') setSelectedTaskColKeys(toggleIn);
                              else setSelectedPlanColKeys(toggleIn);
                            }}
                            className="accent-slate-900"
                          />
                          <span className="truncate">{col.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* BLOC 3 : LISTE DES LIGNES SOURCES (TOUT OU PARTIE) */}
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleBlock('rows')}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                >
                  {openBlocks.has('rows') ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  )}
                  <span className="text-xs font-semibold text-slate-900 tabular-nums">
                    Lignes sources à exporter : {activeRowsCount} /{' '}
                    {activity === 'suivi-recos'
                      ? filteredRecoEntries.length
                      : activePlanTableRows.length}{' '}
                    cochée(s)
                  </span>
                </button>

                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      if (activity === 'suivi-recos') setExcludedRecoRowIds(new Set());
                      else setExcludedPlanRowKeys(new Set());
                    }}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <CheckSquare className="h-3 w-3" aria-hidden="true" />
                    Tout sélectionner
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (activity === 'suivi-recos') {
                        setExcludedRecoRowIds(
                          new Set(filteredRecoEntries.map((e) => e.node.id))
                        );
                      } else {
                        setExcludedPlanRowKeys(
                          new Set(activePlanTableRows.map((r) => r.key))
                        );
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-50 cursor-pointer"
                  >
                    <Square className="h-3 w-3" aria-hidden="true" />
                    Tout désélectionner
                  </button>
                </div>
              </div>

              {openBlocks.has('rows') && (
                <div className="max-h-[420px] overflow-auto border-t border-slate-200">
                  {activity === 'suivi-recos' ? (
                    (() => {
                      const activeCols = recoColumns.filter((c) =>
                        selectedRecoColKeys.has(c.key)
                      );
                      if (activeCols.length === 0) {
                        return (
                          <p className="p-6 text-center text-xs text-slate-500">
                            Cochez au moins une colonne ci-dessus pour prévisualiser et exporter le tableau.
                          </p>
                        );
                      }
                      if (filteredRecoEntries.length === 0) {
                        return (
                          <p className="p-6 text-center text-xs text-slate-500">
                            Aucune recommandation ne correspond aux paramètres sélectionnés.
                          </p>
                        );
                      }
                      return (
                        <table className="w-full border-collapse text-left text-xs">
                          <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] font-semibold text-slate-700">
                            <tr className="border-b border-slate-200">
                              <th className="w-9 px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedRecoEntries.length === filteredRecoEntries.length}
                                  onChange={() => {
                                    if (selectedRecoEntries.length === filteredRecoEntries.length) {
                                      setExcludedRecoRowIds(
                                        new Set(filteredRecoEntries.map((e) => e.node.id))
                                      );
                                    } else {
                                      setExcludedRecoRowIds(new Set());
                                    }
                                  }}
                                  aria-label="Tout sélectionner"
                                  className="accent-slate-900"
                                />
                              </th>
                              {activeCols.map((c) => (
                                <th key={c.key} className="px-3 py-2 whitespace-nowrap">
                                  {c.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredRecoEntries.map((entry) => {
                              const isSelected = !excludedRecoRowIds.has(entry.node.id);
                              return (
                                <tr
                                  key={entry.node.id}
                                  onClick={() => {
                                    setExcludedRecoRowIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(entry.node.id)) next.delete(entry.node.id);
                                      else next.add(entry.node.id);
                                      return next;
                                    });
                                  }}
                                  className={`cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-white hover:bg-slate-50'
                                      : 'bg-slate-50/50 text-slate-400'
                                  }`}
                                >
                                  <td
                                    className="px-3 py-2 text-center"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        setExcludedRecoRowIds((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(entry.node.id)) next.delete(entry.node.id);
                                          else next.add(entry.node.id);
                                          return next;
                                        });
                                      }}
                                      aria-label={`Sélectionner ${entry.record.refRecos}`}
                                      className="accent-slate-900"
                                    />
                                  </td>
                                  {activeCols.map((c) => (
                                    <td
                                      key={c.key}
                                      className="max-w-[240px] truncate px-3 py-2 tabular-nums"
                                      title={String(c.getValue(entry))}
                                    >
                                      {c.getValue(entry)}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    })()
                  ) : (
                    (() => {
                      const activeCols =
                        planGranularity === 'steps'
                          ? PLAN_STEP_COLUMNS.filter((c) => selectedStepColKeys.has(c.key))
                          : planGranularity === 'tasks'
                          ? PLAN_TASK_COLUMNS.filter((c) => selectedTaskColKeys.has(c.key))
                          : planMissionColumns.filter((c) => selectedPlanColKeys.has(c.key));

                      if (activeCols.length === 0) {
                        return (
                          <p className="p-6 text-center text-xs text-slate-500">
                            Cochez au moins une colonne ci-dessus pour prévisualiser et exporter le tableau.
                          </p>
                        );
                      }
                      if (activePlanTableRows.length === 0) {
                        return (
                          <p className="p-6 text-center text-xs text-slate-500">
                            Aucune ligne ne correspond aux filtres Direction / Exercice / Cycle sélectionnés.
                          </p>
                        );
                      }
                      return (
                        <table className="w-full border-collapse text-left text-xs">
                          <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] font-semibold text-slate-700">
                            <tr className="border-b border-slate-200">
                              <th className="w-9 px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedPlanTableRows.length === activePlanTableRows.length}
                                  onChange={() => {
                                    if (selectedPlanTableRows.length === activePlanTableRows.length) {
                                      setExcludedPlanRowKeys(
                                        new Set(activePlanTableRows.map((r) => r.key))
                                      );
                                    } else {
                                      setExcludedPlanRowKeys(new Set());
                                    }
                                  }}
                                  aria-label="Tout sélectionner"
                                  className="accent-slate-900"
                                />
                              </th>
                              {activeCols.map((c) => (
                                <th key={c.key} className="px-3 py-2 whitespace-nowrap">
                                  {c.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activePlanTableRows.map(({ key, row }) => {
                              const isSelected = !excludedPlanRowKeys.has(key);
                              return (
                                <tr
                                  key={key}
                                  onClick={() => {
                                    setExcludedPlanRowKeys((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(key)) next.delete(key);
                                      else next.add(key);
                                      return next;
                                    });
                                  }}
                                  className={`cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-white hover:bg-slate-50'
                                      : 'bg-slate-50/50 text-slate-400'
                                  }`}
                                >
                                  <td
                                    className="px-3 py-2 text-center"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        setExcludedPlanRowKeys((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(key)) next.delete(key);
                                          else next.add(key);
                                          return next;
                                        });
                                      }}
                                      aria-label={`Sélectionner ligne ${key}`}
                                      className="accent-slate-900"
                                    />
                                  </td>
                                  {activeCols.map((c) => {
                                    const val = (
                                      c.getValue as (r: typeof row) => string | number
                                    )(row);
                                    return (
                                      <td
                                        key={c.key}
                                        className="max-w-[240px] truncate px-3 py-2 tabular-nums"
                                        title={String(val)}
                                      >
                                        {val}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    })()
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* MODE DASHBOARD PDF (SUIVI RECOS / PLAN D'AUDIT) */
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
            <div className="space-y-3">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      Catégories de KPI à exporter ({activeKpiCount})
                    </span>
                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          if (activity === 'suivi-recos') {
                            setSelectedRecoKpiIds(
                              new Set(RECO_KPI_CATEGORIES.map((c) => c.id))
                            );
                          } else {
                            setSelectedPlanKpiIds(
                              new Set(PLAN_KPI_CATEGORIES.map((c) => c.id))
                            );
                          }
                        }}
                        className="rounded border border-slate-200 px-1.5 py-0.5 text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Tout
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (activity === 'suivi-recos') {
                            setSelectedRecoKpiIds(
                              new Set(
                                RECO_KPI_CATEGORIES.filter((c) => c.executiveDefault).map(
                                  (c) => c.id
                                )
                              )
                            );
                          } else {
                            setSelectedPlanKpiIds(
                              new Set(
                                PLAN_KPI_CATEGORIES.filter((c) => c.executiveDefault).map(
                                  (c) => c.id
                                )
                              )
                            );
                          }
                        }}
                        className="rounded border border-slate-200 px-1.5 py-0.5 text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Essentiel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (activity === 'suivi-recos') setSelectedRecoKpiIds(new Set());
                          else setSelectedPlanKpiIds(new Set());
                        }}
                        className="rounded border border-slate-200 px-1.5 py-0.5 text-slate-500 hover:bg-slate-50 cursor-pointer"
                      >
                        Aucun
                      </button>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {(activity === 'suivi-recos'
                    ? RECO_KPI_CATEGORIES
                    : PLAN_KPI_CATEGORIES
                  ).map((cat) => {
                    const activeSet =
                      activity === 'suivi-recos' ? selectedRecoKpiIds : selectedPlanKpiIds;
                    const isChecked = activeSet.has(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className={`flex cursor-pointer items-start gap-2.5 px-4 py-2.5 transition-colors ${
                          isChecked ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 text-slate-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const toggle = (prev: Set<string>) => {
                              const next = new Set(prev);
                              if (next.has(cat.id)) next.delete(cat.id);
                              else next.add(cat.id);
                              return next;
                            };
                            if (activity === 'suivi-recos') setSelectedRecoKpiIds(toggle);
                            else setSelectedPlanKpiIds(toggle);
                          }}
                          className="mt-0.5 accent-slate-900"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-900">
                            {cat.label}
                          </div>
                          <div className="mt-0.5 text-[11px] leading-snug text-slate-500">
                            {cat.description}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">Mise en page PDF</span>
                    <div className="inline-flex rounded border border-slate-200 bg-white p-0.5">
                      <button
                        type="button"
                        onClick={() => setPdfOrientation('landscape')}
                        className={`rounded px-2 py-0.5 text-[11px] font-medium cursor-pointer ${
                          pdfOrientation === 'landscape'
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600'
                        }`}
                      >
                        Paysage
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfOrientation('portrait')}
                        className={`rounded px-2 py-0.5 text-[11px] font-medium cursor-pointer ${
                          pdfOrientation === 'portrait'
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600'
                        }`}
                      >
                        Portrait
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Aperçu en direct du Dashboard PDF */}
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-3 text-white">
                <div>
                  <h4 className="font-display text-sm font-semibold">
                    {activity === 'suivi-recos'
                      ? 'Aperçu PDF · Dashboard Suivi des Recommandations'
                      : 'Aperçu PDF · Dashboard Plan Annuel d’Audit'}
                  </h4>
                  <p className="mt-0.5 text-[11px] text-slate-300 tabular-nums">
                    {activity === 'suivi-recos'
                      ? `${selectedRecoEntries.length} recommandation(s) · ${recoPdfSections.length} catégorie(s) KPI cochée(s)`
                      : `${filteredPlanMissions.length} mission(s) · ${planPdfSections.length} catégorie(s) KPI cochée(s)`}
                  </p>
                </div>
                <span className="font-mono text-[11px] text-amber-300">
                  {pdfOrientation === 'landscape' ? 'A4 Paysage' : 'A4 Portrait'}
                </span>
              </div>

              <div className="max-h-[540px] space-y-4 overflow-y-auto p-5">
                {(activity === 'suivi-recos' ? recoPdfSections : planPdfSections).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-500">
                    Cochez au moins une catégorie de KPI à gauche pour afficher et exporter le Dashboard PDF.
                  </div>
                ) : (
                  (activity === 'suivi-recos' ? recoPdfSections : planPdfSections).map((sec) => {
                    if (sec.kind === 'kpis') {
                      return (
                        <div key={sec.id} className="space-y-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <h5 className="text-xs font-semibold text-slate-900">{sec.title}</h5>
                            {sec.subtitle && (
                              <span className="text-[11px] text-slate-500 tabular-nums">
                                {sec.subtitle}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
                            {sec.items.map((kpi) => (
                              <div
                                key={kpi.label}
                                className="overflow-hidden rounded border border-slate-200 bg-white"
                              >
                                <div
                                  className="h-1 w-full"
                                  style={{ backgroundColor: kpi.accentHex || '#0284C7' }}
                                />
                                <div className="p-2.5">
                                  <div className="text-[11px] font-medium text-slate-500">
                                    {kpi.label}
                                  </div>
                                  <div className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
                                    {kpi.value}
                                  </div>
                                  {kpi.sublabel && (
                                    <div className="mt-0.5 text-[10px] text-slate-500 tabular-nums">
                                      {kpi.sublabel}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    if (sec.kind === 'bars') {
                      return (
                        <div
                          key={sec.id}
                          className="overflow-hidden rounded border border-slate-200 bg-white"
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-2">
                            <span className="text-xs font-semibold text-slate-900">
                              {sec.title}
                            </span>
                            {sec.subtitle && (
                              <span className="text-[11px] text-slate-500 tabular-nums">
                                {sec.subtitle}
                              </span>
                            )}
                          </div>
                          <div className="space-y-2 p-3.5">
                            {sec.items.length === 0 ? (
                              <p className="text-xs text-slate-500">
                                Aucune donnée pour les filtres appliqués.
                              </p>
                            ) : (
                              sec.items.map((b) => (
                                <div key={b.label} className="space-y-1">
                                  <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="truncate text-slate-700">{b.label}</span>
                                    <span className="shrink-0 font-mono text-[11px] font-semibold text-slate-900 tabular-nums">
                                      {b.displayValue}
                                    </span>
                                  </div>
                                  <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
                                    <div
                                      className="h-full"
                                      style={{
                                        width: `${Math.min(100, Math.max(2, b.pct))}%`,
                                        backgroundColor: b.colorHex || '#0284C7',
                                      }}
                                    />
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={sec.id}
                        className="overflow-hidden rounded border border-slate-200 bg-white"
                      >
                        <div className="border-b border-slate-100 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900">
                          {sec.title}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-900 text-[11px] font-semibold text-white">
                                {sec.table.headers.map((h) => (
                                  <th key={h} className="px-3 py-1.5 whitespace-nowrap">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {sec.table.rows.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={sec.table.headers.length}
                                    className="px-3 py-4 text-center text-slate-500"
                                  >
                                    Aucune donnée pour les filtres appliqués.
                                  </td>
                                </tr>
                              ) : (
                                sec.table.rows.map((r, rIdx) => (
                                  <tr
                                    key={rIdx}
                                    className={rIdx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                                  >
                                    {r.map((cell, cIdx) => (
                                      <td
                                        key={cIdx}
                                        className="max-w-[220px] truncate px-3 py-1.5 text-slate-800 tabular-nums"
                                        title={cell}
                                      >
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
