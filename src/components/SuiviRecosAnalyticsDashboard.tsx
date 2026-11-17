import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownUp,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Copy,
  Database,
  Download,
  ExternalLink,
  Filter,
  Info,
  Layers,
  Mail,
  Maximize2,
  MessageSquareWarning,
  Minimize2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Table2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  RecoSourceMetadata,
  WorkflowNodeStatus,
  WorkflowTreeNode,
} from '../types/workflow';
import { findRecoRecordByRefOrLabel } from '../data/suiviRecosSimulation';
import {
  countDocumentsInNode,
  isNodeLockedOrWithinLockedAncestor,
} from '../utils/workflowTreeOps';
import { RecoInfoManagerPanel, RecoPanelViewMode } from './RecoInfoManagerPanel';

export type RecoLiveStatut = 'Réalisé' | 'En attente' | 'Reporté' | 'Non réalisé';
export type RecoRiskLevel = 'Critique' | 'Majeur' | 'Modéré';

export interface RecoAnalyticsItem {
  node: WorkflowTreeNode;
  record: RecoSourceMetadata;
  exerciceLabel: string;
  exerciceYear: string;
  missionLabel: string;
  liveStatut: RecoLiveStatut;
  riskLevel: RecoRiskLevel;
  auditorLabel: string;
  hasReport: boolean;
  collectionNode: WorkflowTreeNode | null;
  collectionDocCount: number;
  openNotesCount: number;
  managerReviewed: boolean;
  effectiveDueDateIso: string;
}

type ReportPageId = 'executive' | 'trends' | 'manager' | 'details';
type FocusVisualId =
  | null
  | 'donut'
  | 'matrix'
  | 'missions'
  | 'timeline'
  | 'docs'
  | 'directions';

const STATUT_ORDER: RecoLiveStatut[] = [
  'Non réalisé',
  'Reporté',
  'En attente',
  'Réalisé',
];

const RISK_ORDER: RecoRiskLevel[] = ['Critique', 'Majeur', 'Modéré'];

const STATUT_COLORS: Record<RecoLiveStatut, string> = {
  Réalisé: '#107C10',
  'En attente': '#118DFF',
  Reporté: '#E66C37',
  'Non réalisé': '#D13438',
};

const MONTH_SHORT = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
];

function mapNodeStatusToLiveStatut(
  status: WorkflowNodeStatus | undefined,
  fallback: string
): RecoLiveStatut {
  switch (status) {
    case 'validated':
      return 'Réalisé';
    case 'in-review':
      return 'En attente';
    case 'in-progress':
      return 'Reporté';
    case 'todo':
      return 'Non réalisé';
    default: {
      const clean = fallback.trim();
      if (
        clean === 'Réalisé' ||
        clean === 'En attente' ||
        clean === 'Reporté' ||
        clean === 'Non réalisé'
      ) {
        return clean;
      }
      return 'Non réalisé';
    }
  }
}

function normalizeRisk(evalRisk: string): RecoRiskLevel {
  const clean = (evalRisk || '').trim().toLowerCase();
  if (clean === 'critique') return 'Critique';
  if (clean === 'majeur') return 'Majeur';
  return 'Modéré';
}

function parseFrDateIso(dateStr: string): string {
  const m = (dateStr || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '2025-12-31';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseMonthIndex(dateStr: string): number | null {
  const m = (dateStr || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const idx = Number(m[2]) - 1;
  return idx >= 0 && idx < 12 ? idx : null;
}

function mapAuditorDisplay(email: string, fallbackAssignee?: string): string {
  if (fallbackAssignee) return fallbackAssignee;
  const lower = (email || '').toLowerCase();
  if (lower.includes('senior')) return 'Auditeur Senior';
  if (lower.includes('auditeur1')) return 'Auditeur 1';
  if (lower.includes('auditeur2')) return 'Auditeur 2';
  if (lower.includes('auditeur3')) return 'Auditeur 3';
  return email || 'Non assigné';
}

export function extractRecoAnalyticsRows(
  trees: WorkflowTreeNode[],
  scopeRootId: 'root-workflow' | 'root-team-workflow'
): RecoAnalyticsItem[] {
  const root = trees.find((t) => t.id === scopeRootId) ?? trees[0];
  if (!root) return [];

  const rows: RecoAnalyticsItem[] = [];

  const walk = (
    node: WorkflowTreeNode,
    currentExercice: string,
    currentMission: string,
    insideSuiviRecos = false
  ) => {
    const isExercice =
      node.nodeType === 'exercice' || /^Exercice\s+\d{4}/i.test(node.label);
    const nextExercice = isExercice ? node.label : currentExercice;
    const isSuiviBranch =
      insideSuiviRecos ||
      /workflow\s+suivi\s+recos/i.test(node.label) ||
      Boolean(node.recoMeta);

    const looksLikeMissionFolder =
      isSuiviBranch &&
      (node.nodeType === 'section' || node.nodeType === 'activite') &&
      !node.recoMeta &&
      !/^workflow\s+suivi\s+recos/i.test(node.label);
    const nextMission = looksLikeMissionFolder ? node.label : currentMission;

    const record =
      node.recoMeta ??
      (isSuiviBranch &&
      (node.nodeType === 'document' ||
        node.nodeType === 'sous-section' ||
        /^Recos-/i.test(node.label))
        ? findRecoRecordByRefOrLabel(node.label)
        : undefined);

    if (record) {
      const collectionNode =
        node.children?.find((c) => c.nodeType === 'collection') ?? null;
      const collectionDocCount = collectionNode
        ? countDocumentsInNode(collectionNode)
        : 0;
      const openNotesCount = (node.reviewNotes ?? []).filter(
        (n) => n.status === 'open'
      ).length;
      const yearMatch = (nextExercice || record.refRecos).match(/(2024|2025)/);
      const exerciceYear = yearMatch ? yearMatch[1] : '2025';
      const hasReport = Boolean(
        record.reportDelai && record.reportDelai.trim().length > 0
      );

      rows.push({
        node,
        record,
        exerciceLabel: nextExercice || `Exercice ${exerciceYear}`,
        exerciceYear,
        missionLabel: nextMission || record.intitule || 'Mission Audit',
        liveStatut: mapNodeStatusToLiveStatut(node.status, record.statut),
        riskLevel: normalizeRisk(record.evaluationRisque),
        auditorLabel: mapAuditorDisplay(record.emailAuditeur, node.assignee),
        hasReport,
        collectionNode,
        collectionDocCount,
        openNotesCount,
        managerReviewed: Boolean(node.managerReviewed),
        effectiveDueDateIso: parseFrDateIso(
          hasReport ? record.reportDelai : record.delai
        ),
      });
      return;
    }

    if (node.children) {
      for (const child of node.children) {
        walk(child, nextExercice, nextMission, isSuiviBranch);
      }
    }
  };

  walk(root, 'Exercice 2025', '');
  return rows;
}

interface SuiviRecosAnalyticsDashboardProps {
  trees: WorkflowTreeNode[];
  onToggleManagerReview: (nodeId: string) => void;
  onSetNodeStatus: (status: WorkflowNodeStatus, nodeId: string) => void;
  onAddReviewNote: (nodeId: string, text: string) => void;
  onToggleReviewNote: (nodeId: string, noteId: string) => void;
  onDeleteReviewNote: (nodeId: string, noteId: string) => void;
  onOpenWordDoc: (node: WorkflowTreeNode) => void;
  onIntegrateCollection: (collectionNode: WorkflowTreeNode) => void;
  onOpenNodeInWorkflow: (nodeId: string) => void;
  onUpdateRecoMeta?: (
    recoNodeId: string,
    patch: Partial<RecoSourceMetadata>
  ) => void;
}

type SortKey = 'no' | 'risk' | 'statut' | 'delai' | 'docs' | 'mission';

const RISK_RANK: Record<RecoRiskLevel, number> = {
  Critique: 0,
  Majeur: 1,
  Modéré: 2,
};

const STATUT_RANK: Record<RecoLiveStatut, number> = {
  'Non réalisé': 0,
  Reporté: 1,
  'En attente': 2,
  Réalisé: 3,
};

const REPORT_PAGES: Array<{
  id: ReportPageId;
  label: string;
  subtitle: string;
}> = [
  { id: 'executive', label: 'Vue Exécutive', subtitle: 'KPI, Donut, Matrice & Missions' },
  { id: 'trends', label: 'Délais & Preuves', subtitle: 'Tendances mensuelles, Collections & Directions' },
  { id: 'manager', label: 'Pilotage Manager', subtitle: 'Watchlist & Relances auditées' },
  { id: 'details', label: 'Détail Recos', subtitle: 'Table Power BI & Revue Manager' },
];

export const SuiviRecosAnalyticsDashboard: React.FC<
  SuiviRecosAnalyticsDashboardProps
> = ({
  trees,
  onToggleManagerReview,
  onSetNodeStatus,
  onAddReviewNote,
  onToggleReviewNote,
  onDeleteReviewNote,
  onOpenWordDoc,
  onIntegrateCollection,
  onOpenNodeInWorkflow,
  onUpdateRecoMeta,
}) => {
  // Navigation & Power BI side panes
  const [activePage, setActivePage] = useState<ReportPageId>('executive');
  const [showFiltersPane, setShowFiltersPane] = useState(true);
  const [showFieldsPane, setShowFieldsPane] = useState(false);
  const [focusVisual, setFocusVisual] = useState<FocusVisualId>(null);

  // Slicers & Cross-Filters
  const [scopeRootId, setScopeRootId] = useState<'root-workflow' | 'root-team-workflow'>(
    'root-workflow'
  );
  const [exerciceFilter, setExerciceFilter] = useState<'all' | '2025' | '2024'>('2025');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [missionFilter, setMissionFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<RecoRiskLevel | 'all'>('all');
  const [statutFilter, setStatutFilter] = useState<RecoLiveStatut | 'all'>('all');
  const [auditorFilter, setAuditorFilter] = useState<string>('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'reviewed' | 'pending'>('all');
  const [docCountFilter, setDocCountFilter] = useState<'all' | '0' | '1-4'>('all');
  const [monthFilter, setMonthFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive tooltips & drill state
  const [hoveredStatutSlice, setHoveredStatutSlice] = useState<RecoLiveStatut | null>(null);
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('risk');
  const [sortAsc, setSortAsc] = useState(true);
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);
  const [inspectedInitialView, setInspectedInitialView] =
    useState<RecoPanelViewMode>('accordeon');
  const [relanceModalItem, setRelanceModalItem] = useState<RecoAnalyticsItem | null>(null);
  const [copiedRelanceId, setCopiedRelanceId] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);
  const [lastRefreshLabel, setLastRefreshLabel] = useState<string>(() =>
    new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectedNodeId) {
          setInspectedNodeId(null);
        } else if (focusVisual) {
          setFocusVisual(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inspectedNodeId, focusVisual]);

  const allScopeRows = useMemo(
    () => extractRecoAnalyticsRows(trees, scopeRootId),
    [trees, scopeRootId]
  );

  const stats2024 = useMemo(() => {
    const r2024 = allScopeRows.filter((r) => r.exerciceYear === '2024');
    const done = r2024.filter((r) => r.liveStatut === 'Réalisé').length;
    const rate = r2024.length > 0 ? (done / r2024.length) * 100 : 0;
    return { total: r2024.length, done, rate };
  }, [allScopeRows]);

  const stats2025 = useMemo(() => {
    const r2025 = allScopeRows.filter((r) => r.exerciceYear === '2025');
    const done = r2025.filter((r) => r.liveStatut === 'Réalisé').length;
    const rate = r2025.length > 0 ? (done / r2025.length) * 100 : 0;
    return { total: r2025.length, done, rate };
  }, [allScopeRows]);

  const baseExerciceRows = useMemo(() => {
    if (exerciceFilter === 'all') return allScopeRows;
    return allScopeRows.filter((r) => r.exerciceYear === exerciceFilter);
  }, [allScopeRows, exerciceFilter]);

  const availableDirections = useMemo(
    () => Array.from(new Set(baseExerciceRows.map((r) => r.record.direction))).sort(),
    [baseExerciceRows]
  );

  const availableAuditors = useMemo(
    () => Array.from(new Set(baseExerciceRows.map((r) => r.auditorLabel))).sort(),
    [baseExerciceRows]
  );

  const directionCounts = useMemo(() => {
    const m = new Map<string, number>();
    baseExerciceRows.forEach((r) => {
      m.set(r.record.direction, (m.get(r.record.direction) ?? 0) + 1);
    });
    return m;
  }, [baseExerciceRows]);

  const riskCounts = useMemo(() => {
    const m: Record<RecoRiskLevel, number> = { Critique: 0, Majeur: 0, Modéré: 0 };
    baseExerciceRows.forEach((r) => {
      m[r.riskLevel] += 1;
    });
    return m;
  }, [baseExerciceRows]);

  const statutBaseCounts = useMemo(() => {
    const m: Record<RecoLiveStatut, number> = {
      'Non réalisé': 0,
      Reporté: 0,
      'En attente': 0,
      Réalisé: 0,
    };
    baseExerciceRows.forEach((r) => {
      m[r.liveStatut] += 1;
    });
    return m;
  }, [baseExerciceRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return baseExerciceRows.filter((r) => {
      if (directionFilter !== 'all' && r.record.direction !== directionFilter) return false;
      if (missionFilter !== 'all' && r.missionLabel !== missionFilter) return false;
      if (riskFilter !== 'all' && r.riskLevel !== riskFilter) return false;
      if (statutFilter !== 'all' && r.liveStatut !== statutFilter) return false;
      if (auditorFilter !== 'all' && r.auditorLabel !== auditorFilter) return false;
      if (reviewFilter === 'reviewed' && !r.managerReviewed) return false;
      if (reviewFilter === 'pending' && r.managerReviewed) return false;
      if (docCountFilter === '0' && r.collectionDocCount !== 0) return false;
      if (docCountFilter === '1-4' && r.collectionDocCount === 0) return false;
      if (monthFilter !== null) {
        const mInit = parseMonthIndex(r.record.delai);
        const mRep = r.hasReport ? parseMonthIndex(r.record.reportDelai) : null;
        if (mInit !== monthFilter && mRep !== monthFilter) return false;
      }
      if (q) {
        const hay = `${r.record.refRecos} ${r.record.intituleRecos} ${r.record.intitule} ${r.missionLabel} ${r.record.direction} ${r.record.responsable} ${r.record.constat}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    baseExerciceRows,
    directionFilter,
    missionFilter,
    riskFilter,
    statutFilter,
    auditorFilter,
    reviewFilter,
    docCountFilter,
    monthFilter,
    searchQuery,
  ]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'no') {
        cmp = a.record.no - b.record.no;
      } else if (sortKey === 'risk') {
        cmp =
          RISK_RANK[a.riskLevel] - RISK_RANK[b.riskLevel] ||
          STATUT_RANK[a.liveStatut] - STATUT_RANK[b.liveStatut] ||
          a.record.no - b.record.no;
      } else if (sortKey === 'statut') {
        cmp =
          STATUT_RANK[a.liveStatut] - STATUT_RANK[b.liveStatut] ||
          RISK_RANK[a.riskLevel] - RISK_RANK[b.riskLevel];
      } else if (sortKey === 'delai') {
        cmp = a.effectiveDueDateIso.localeCompare(b.effectiveDueDateIso);
      } else if (sortKey === 'docs') {
        cmp = a.collectionDocCount - b.collectionDocCount;
      } else if (sortKey === 'mission') {
        cmp = a.missionLabel.localeCompare(b.missionLabel);
      }
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [filteredRows, sortKey, sortAsc]);

  const kpis = useMemo(() => {
    const total = filteredRows.length;
    const realised = filteredRows.filter((r) => r.liveStatut === 'Réalisé').length;
    const implRate = total > 0 ? (realised / total) * 100 : 0;

    const critAll = filteredRows.filter((r) => r.riskLevel === 'Critique');
    const critOpen = critAll.filter((r) => r.liveStatut !== 'Réalisé');
    const critOpenRate = critAll.length > 0 ? (critOpen.length / critAll.length) * 100 : 0;

    const reported = filteredRows.filter((r) => r.hasReport).length;
    const reportRate = total > 0 ? (reported / total) * 100 : 0;

    const withDocs = filteredRows.filter((r) => r.collectionDocCount > 0).length;
    const emptyDocs = filteredRows.filter((r) => r.collectionDocCount === 0).length;
    const docsRate = total > 0 ? (withDocs / total) * 100 : 0;

    const reviewed = filteredRows.filter((r) => r.managerReviewed).length;
    const openNotes = filteredRows.reduce((s, r) => s + r.openNotesCount, 0);

    return {
      total,
      realised,
      implRate,
      critTotal: critAll.length,
      critOpenCount: critOpen.length,
      critOpenRate,
      reported,
      reportRate,
      withDocs,
      emptyDocs,
      docsRate,
      reviewed,
      openNotes,
    };
  }, [filteredRows]);

  // Statut breakdown for Donut (keeps risk/statut cross-filters outside statut itself so user can click any segment directly)
  const statutDonutRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return baseExerciceRows.filter((r) => {
      if (directionFilter !== 'all' && r.record.direction !== directionFilter) return false;
      if (missionFilter !== 'all' && r.missionLabel !== missionFilter) return false;
      if (riskFilter !== 'all' && r.riskLevel !== riskFilter) return false;
      if (auditorFilter !== 'all' && r.auditorLabel !== auditorFilter) return false;
      if (reviewFilter === 'reviewed' && !r.managerReviewed) return false;
      if (reviewFilter === 'pending' && r.managerReviewed) return false;
      if (docCountFilter === '0' && r.collectionDocCount !== 0) return false;
      if (docCountFilter === '1-4' && r.collectionDocCount === 0) return false;
      if (monthFilter !== null) {
        const mInit = parseMonthIndex(r.record.delai);
        const mRep = r.hasReport ? parseMonthIndex(r.record.reportDelai) : null;
        if (mInit !== monthFilter && mRep !== monthFilter) return false;
      }
      if (q) {
        const hay = `${r.record.refRecos} ${r.record.intituleRecos} ${r.record.intitule} ${r.missionLabel} ${r.record.direction} ${r.record.responsable} ${r.record.constat}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    baseExerciceRows,
    directionFilter,
    missionFilter,
    riskFilter,
    auditorFilter,
    reviewFilter,
    docCountFilter,
    monthFilter,
    searchQuery,
  ]);

  const donutStats = useMemo(() => {
    const counts: Record<RecoLiveStatut, number> = {
      Réalisé: 0,
      'En attente': 0,
      Reporté: 0,
      'Non réalisé': 0,
    };
    statutDonutRows.forEach((r) => {
      counts[r.liveStatut] += 1;
    });
    const total = statutDonutRows.length;
    const order: RecoLiveStatut[] = ['Réalisé', 'En attente', 'Reporté', 'Non réalisé'];
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    let cumulative = 0;

    const segments = order.map((st) => {
      const count = counts[st];
      const fraction = total > 0 ? count / total : 0;
      const arcLength = fraction * circumference;
      const offset = -cumulative;
      cumulative += arcLength;
      return {
        statut: st,
        count,
        pct: total > 0 ? (count / total) * 100 : 0,
        color: STATUT_COLORS[st],
        arcLength,
        offset,
        circumference,
      };
    });

    return { total, counts, segments, radius, circumference };
  }, [statutDonutRows]);

  // Matrix rows (hors risk/statut afin de permettre de cliquer facilement sur n'importe quelle cellule)
  const matrixRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return baseExerciceRows.filter((r) => {
      if (directionFilter !== 'all' && r.record.direction !== directionFilter) return false;
      if (missionFilter !== 'all' && r.missionLabel !== missionFilter) return false;
      if (auditorFilter !== 'all' && r.auditorLabel !== auditorFilter) return false;
      if (reviewFilter === 'reviewed' && !r.managerReviewed) return false;
      if (reviewFilter === 'pending' && r.managerReviewed) return false;
      if (docCountFilter === '0' && r.collectionDocCount !== 0) return false;
      if (docCountFilter === '1-4' && r.collectionDocCount === 0) return false;
      if (monthFilter !== null) {
        const mInit = parseMonthIndex(r.record.delai);
        const mRep = r.hasReport ? parseMonthIndex(r.record.reportDelai) : null;
        if (mInit !== monthFilter && mRep !== monthFilter) return false;
      }
      if (q) {
        const hay = `${r.record.refRecos} ${r.record.intituleRecos} ${r.record.intitule} ${r.missionLabel} ${r.record.direction} ${r.record.responsable} ${r.record.constat}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    baseExerciceRows,
    directionFilter,
    missionFilter,
    auditorFilter,
    reviewFilter,
    docCountFilter,
    monthFilter,
    searchQuery,
  ]);

  const heatmap = useMemo(() => {
    const grid: Record<RecoRiskLevel, Record<RecoLiveStatut, number>> = {
      Critique: { 'Non réalisé': 0, Reporté: 0, 'En attente': 0, Réalisé: 0 },
      Majeur: { 'Non réalisé': 0, Reporté: 0, 'En attente': 0, Réalisé: 0 },
      Modéré: { 'Non réalisé': 0, Reporté: 0, 'En attente': 0, Réalisé: 0 },
    };
    matrixRows.forEach((r) => {
      grid[r.riskLevel][r.liveStatut] += 1;
    });
    return grid;
  }, [matrixRows]);

  const missionStats = useMemo(() => {
    const map = new Map<
      string,
      {
        mission: string;
        total: number;
        realise: number;
        enAttente: number;
        reporte: number;
        nonRealise: number;
        critOpen: number;
      }
    >();
    filteredRows.forEach((r) => {
      const cur = map.get(r.missionLabel) || {
        mission: r.missionLabel,
        total: 0,
        realise: 0,
        enAttente: 0,
        reporte: 0,
        nonRealise: 0,
        critOpen: 0,
      };
      cur.total += 1;
      if (r.liveStatut === 'Réalisé') cur.realise += 1;
      else if (r.liveStatut === 'En attente') cur.enAttente += 1;
      else if (r.liveStatut === 'Reporté') cur.reporte += 1;
      else cur.nonRealise += 1;

      if (r.riskLevel === 'Critique' && r.liveStatut !== 'Réalisé') {
        cur.critOpen += 1;
      }
      map.set(r.missionLabel, cur);
    });
    return Array.from(map.values()).sort(
      (a, b) => b.critOpen - a.critOpen || b.nonRealise - a.nonRealise || a.realise - b.realise
    );
  }, [filteredRows]);

  const directionStats = useMemo(() => {
    const map = new Map<
      string,
      {
        direction: string;
        total: number;
        realise: number;
        open: number;
        critOpen: number;
        withDocs: number;
      }
    >();
    filteredRows.forEach((r) => {
      const cur = map.get(r.record.direction) || {
        direction: r.record.direction,
        total: 0,
        realise: 0,
        open: 0,
        critOpen: 0,
        withDocs: 0,
      };
      cur.total += 1;
      if (r.liveStatut === 'Réalisé') cur.realise += 1;
      else cur.open += 1;
      if (r.riskLevel === 'Critique' && r.liveStatut !== 'Réalisé') cur.critOpen += 1;
      if (r.collectionDocCount > 0) cur.withDocs += 1;
      map.set(r.record.direction, cur);
    });
    return Array.from(map.values()).sort(
      (a, b) => b.critOpen - a.critOpen || b.open - a.open || b.total - a.total
    );
  }, [filteredRows]);

  const docDistribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    filteredRows.forEach((r) => {
      const idx = Math.min(4, Math.max(0, r.collectionDocCount));
      counts[idx] += 1;
    });
    return counts;
  }, [filteredRows]);

  const auditorStats = useMemo(() => {
    const map = new Map<
      string,
      { auditor: string; total: number; realised: number; critOpen: number; reviewed: number }
    >();
    filteredRows.forEach((r) => {
      const cur = map.get(r.auditorLabel) || {
        auditor: r.auditorLabel,
        total: 0,
        realised: 0,
        critOpen: 0,
        reviewed: 0,
      };
      cur.total += 1;
      if (r.liveStatut === 'Réalisé') cur.realised += 1;
      if (r.riskLevel === 'Critique' && r.liveStatut !== 'Réalisé') cur.critOpen += 1;
      if (r.managerReviewed) cur.reviewed += 1;
      map.set(r.auditorLabel, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredRows]);

  const monthlyTimeline = useMemo(() => {
    const initialByMonth = new Array(12).fill(0) as number[];
    const reportedByMonth = new Array(12).fill(0) as number[];
    const realisedByMonth = new Array(12).fill(0) as number[];
    filteredRows.forEach((r) => {
      const mInit = parseMonthIndex(r.record.delai);
      if (mInit !== null) {
        initialByMonth[mInit] += 1;
        if (r.liveStatut === 'Réalisé') realisedByMonth[mInit] += 1;
      }
      if (r.hasReport) {
        const mRep = parseMonthIndex(r.record.reportDelai);
        if (mRep !== null) reportedByMonth[mRep] += 1;
      }
    });
    const maxVal = Math.max(1, ...initialByMonth, ...reportedByMonth);
    return { initialByMonth, reportedByMonth, realisedByMonth, maxVal };
  }, [filteredRows]);

  const watchlistAlerts = useMemo(() => {
    const alerts: Array<{
      item: RecoAnalyticsItem;
      reason: string;
      severity: 'critical' | 'warning';
    }> = [];

    filteredRows.forEach((r) => {
      if (r.riskLevel === 'Critique' && r.liveStatut === 'Non réalisé') {
        alerts.push({
          item: r,
          reason: `Critique Non réalisée · ${r.collectionDocCount} doc`,
          severity: 'critical',
        });
      } else if (r.riskLevel === 'Critique' && r.liveStatut === 'Reporté') {
        alerts.push({
          item: r,
          reason: `Critique reportée au ${r.record.reportDelai}`,
          severity: 'critical',
        });
      } else if (r.liveStatut === 'Réalisé' && r.collectionDocCount === 0) {
        alerts.push({
          item: r,
          reason: 'Statut Réalisé sans preuve (0 doc)',
          severity: 'warning',
        });
      } else if (!r.managerReviewed && r.liveStatut === 'En attente' && r.riskLevel === 'Critique') {
        alerts.push({
          item: r,
          reason: 'Critique en attente de validation Manager',
          severity: 'warning',
        });
      }
    });

    return alerts.slice(0, 10);
  }, [filteredRows]);

  const topResponsablesOpen = useMemo(() => {
    const map = new Map<
      string,
      {
        responsable: string;
        direction: string;
        email: string;
        openCount: number;
        critOpen: number;
        sampleItem: RecoAnalyticsItem;
      }
    >();
    filteredRows
      .filter((r) => r.liveStatut !== 'Réalisé')
      .forEach((r) => {
        const key = `${r.record.responsable}::${r.record.emailAudite}`;
        const cur = map.get(key) || {
          responsable: r.record.responsable,
          direction: r.record.direction,
          email: r.record.emailAudite,
          openCount: 0,
          critOpen: 0,
          sampleItem: r,
        };
        cur.openCount += 1;
        if (r.riskLevel === 'Critique') cur.critOpen += 1;
        map.set(key, cur);
      });
    return Array.from(map.values())
      .sort((a, b) => b.critOpen - a.critOpen || b.openCount - a.openCount)
      .slice(0, 6);
  }, [filteredRows]);

  const inspectedItem = useMemo(
    () =>
      inspectedNodeId
        ? allScopeRows.find((r) => r.node.id === inspectedNodeId) ?? null
        : null,
    [allScopeRows, inspectedNodeId]
  );

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onClear: () => void }> = [];
    if (directionFilter !== 'all') {
      chips.push({
        id: 'dir',
        label: `Direction = ${directionFilter}`,
        onClear: () => setDirectionFilter('all'),
      });
    }
    if (missionFilter !== 'all') {
      chips.push({
        id: 'mission',
        label: `Mission = ${missionFilter}`,
        onClear: () => setMissionFilter('all'),
      });
    }
    if (riskFilter !== 'all') {
      chips.push({
        id: 'risk',
        label: `Risque = ${riskFilter}`,
        onClear: () => setRiskFilter('all'),
      });
    }
    if (statutFilter !== 'all') {
      chips.push({
        id: 'statut',
        label: `Statut = ${statutFilter}`,
        onClear: () => setStatutFilter('all'),
      });
    }
    if (auditorFilter !== 'all') {
      chips.push({
        id: 'auditor',
        label: `Auditeur = ${auditorFilter}`,
        onClear: () => setAuditorFilter('all'),
      });
    }
    if (reviewFilter !== 'all') {
      chips.push({
        id: 'review',
        label: `Revue = ${reviewFilter === 'reviewed' ? 'Validée' : 'À revoir'}`,
        onClear: () => setReviewFilter('all'),
      });
    }
    if (docCountFilter !== 'all') {
      chips.push({
        id: 'docs',
        label: `Collection = ${docCountFilter === '0' ? '0 doc' : '1–4 docs'}`,
        onClear: () => setDocCountFilter('all'),
      });
    }
    if (monthFilter !== null) {
      chips.push({
        id: 'month',
        label: `Mois = ${MONTH_SHORT[monthFilter]}`,
        onClear: () => setMonthFilter(null),
      });
    }
    if (searchQuery.trim()) {
      chips.push({
        id: 'q',
        label: `Recherche = "${searchQuery.trim()}"`,
        onClear: () => setSearchQuery(''),
      });
    }
    return chips;
  }, [
    directionFilter,
    missionFilter,
    riskFilter,
    statutFilter,
    auditorFilter,
    reviewFilter,
    docCountFilter,
    monthFilter,
    searchQuery,
  ]);

  const resetAllFilters = () => {
    setDirectionFilter('all');
    setMissionFilter('all');
    setRiskFilter('all');
    setStatutFilter('all');
    setAuditorFilter('all');
    setReviewFilter('all');
    setDocCountFilter('all');
    setMonthFilter(null);
    setSearchQuery('');
  };

  const handleSortClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const handleRefreshModel = () => {
    setLastRefreshLabel(
      new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
    setExportToast(`Modèle sémantique actualisé (${allScopeRows.length} enregistrements).`);
    window.setTimeout(() => setExportToast(null), 2400);
  };

  const buildRelanceText = (item: RecoAnalyticsItem) => {
    const rec = item.record;
    return [
      `À : ${rec.emailAudite} (${rec.responsable})`,
      `Cc : ${rec.emailAuditeur}`,
      `Objet : [RELANCE AUDIT] Suivi ${rec.refRecos} — ${rec.intituleRecos} (${rec.evaluationRisque})`,
      ``,
      `Bonjour ${rec.responsable},`,
      ``,
      `Dans le cadre du suivi des recommandations de la mission « ${item.missionLabel} », nous attirons votre attention sur le point suivant :`,
      `- Référence : ${rec.refRecos} (N°${rec.no})`,
      `- Criticité : ${rec.evaluationRisque}`,
      `- Statut actuel : ${item.liveStatut}`,
      `- Délai initial : ${rec.delai}${item.hasReport ? ` (reporté au ${rec.reportDelai})` : ''}`,
      `- Preuves déposées dans ${item.collectionNode?.label || 'Collection'} : ${item.collectionDocCount} / 4 document(s)`,
      ``,
      `Constat rappelé : ${rec.constat}`,
      `Action attendue : ${rec.planAction}`,
      `Pièces justificatives requises : ${rec.document}`,
      ``,
      `Merci de nous transmettre les justificatifs actualisés pour validation et clôture.`,
      `Cordialement,`,
      `Direction de l'Audit Interne`,
    ].join('\n');
  };

  const handleCopyRelance = async (item: RecoAnalyticsItem) => {
    try {
      await navigator.clipboard.writeText(buildRelanceText(item));
      setCopiedRelanceId(item.node.id);
      window.setTimeout(() => setCopiedRelanceId(null), 2000);
    } catch {
      setCopiedRelanceId(null);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'no',
      'Ref recos',
      'Intitule recos',
      'Mission',
      'Direction',
      'Processus',
      'Evaluation Risque',
      'Statut Source',
      'Statut Workflow',
      'Revue Manager',
      'Responsable',
      'Email audite',
      'Auditeur',
      'Delai',
      'Report delai',
      'Docs Collection',
      'Notes ouvertes',
    ];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvLines = [
      headers.map(escape).join(';'),
      ...sortedRows.map((r) =>
        [
          r.record.no,
          r.record.refRecos,
          r.record.intituleRecos,
          r.missionLabel,
          r.record.direction,
          r.record.processus,
          r.riskLevel,
          r.record.statut,
          r.liveStatut,
          r.managerReviewed ? 'Validée' : 'À revoir',
          r.record.responsable,
          r.record.emailAudite,
          r.auditorLabel,
          r.record.delai,
          r.record.reportDelai,
          `${r.collectionDocCount}/4`,
          r.openNotesCount,
        ]
          .map(escape)
          .join(';')
      ),
    ];
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `powerbi_suivi_recos_${exerciceFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExportToast(`Export CSV généré (${sortedRows.length} recommandations).`);
    window.setTimeout(() => setExportToast(null), 2800);
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      scope: scopeRootId === 'root-workflow' ? 'Workflow' : 'Team Workflow',
      exerciceFilter,
      summary: kpis,
      recommendations: sortedRows.map((r) => ({
        ...r.record,
        liveStatut: r.liveStatut,
        managerReviewed: r.managerReviewed,
        collectionDocCount: r.collectionDocCount,
        openNotesCount: r.openNotesCount,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `powerbi_comite_audit_${exerciceFilter}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExportToast(`Export JSON Comité d'Audit téléchargé (${sortedRows.length} recos).`);
    window.setTimeout(() => setExportToast(null), 2800);
  };

  const deltaVs2024 = kpis.implRate - stats2024.rate;

  // Radial Gauge SVG calculation (0% -> 100% over 180° semi-circle)
  const gaugeRadius = 56;
  const gaugeArcLen = Math.PI * gaugeRadius;
  const gaugeFillLen = (Math.min(100, Math.max(0, kpis.implRate)) / 100) * gaugeArcLen;
  const targetAngleRad = Math.PI * (1 - 0.75); // 75% cible Comité
  const targetMarkerX = 72 + gaugeRadius * Math.cos(targetAngleRad);
  const targetMarkerY = 74 - gaugeRadius * Math.sin(targetAngleRad);

  // Visual blocks extracted cleanly so they can render inline OR in Power BI Focus Mode!
  const renderVisualHeader = (
    title: string,
    subtitle: string,
    visualId: FocusVisualId,
    drillFilterAction?: () => void
  ) => (
    <div className="flex items-start justify-between gap-2 border-b border-[#EDEBE9] px-3.5 py-2.5">
      <div className="min-w-0">
        <h2 className="truncate text-[13px] font-semibold text-[#252423]">{title}</h2>
        <p className="truncate text-[11px] text-[#605E5C]">{subtitle}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {drillFilterAction && (
          <button
            type="button"
            onClick={drillFilterAction}
            title="Voir les enregistrements dans Détail Recos"
            className="rounded p-1 text-[#605E5C] transition-colors hover:bg-[#F3F2F1] hover:text-[#252423] cursor-pointer"
          >
            <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setFocusVisual(focusVisual === visualId ? null : visualId)}
          title={focusVisual === visualId ? 'Revenir au rapport' : 'Mode Focus (Agrandir ce visuel)'}
          className="rounded p-1 text-[#605E5C] transition-colors hover:bg-[#F3F2F1] hover:text-[#252423] cursor-pointer"
        >
          {focusVisual === visualId ? (
            <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );

  const renderDonutVisual = (inFocus = false) => {
    const activeHover = hoveredStatutSlice
      ? donutStats.segments.find((s) => s.statut === hoveredStatutSlice)
      : null;
    return (
      <div className="flex h-full flex-col bg-white border border-[#E1DFDD]">
        {renderVisualHeader(
          'Répartition par Statut',
          'Clic tranche ou légende = filtrage croisé du rapport',
          'donut',
          () => setActivePage('details')
        )}
        <div
          className={`flex flex-1 flex-col items-center justify-center gap-5 p-4 ${
            inFocus ? 'sm:flex-row sm:gap-10 py-10' : 'sm:flex-row'
          }`}
        >
          <div className="relative shrink-0">
            <svg
              viewBox="0 0 144 144"
              role="img"
              aria-label="Graphique en anneau des statuts de recommandations"
              className={inFocus ? 'h-56 w-56' : 'h-36 w-36'}
            >
              <circle
                cx="72"
                cy="72"
                r={donutStats.radius}
                fill="none"
                stroke="#F3F2F1"
                strokeWidth="20"
              />
              <g transform="rotate(-90 72 72)">
                {donutStats.segments.map((seg) => {
                  const isSelected = statutFilter === seg.statut;
                  const isDimmed =
                    (statutFilter !== 'all' && !isSelected) ||
                    (hoveredStatutSlice !== null && hoveredStatutSlice !== seg.statut);
                  if (seg.count === 0) return null;
                  return (
                    <circle
                      key={seg.statut}
                      cx="72"
                      cy="72"
                      r={donutStats.radius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={isSelected || hoveredStatutSlice === seg.statut ? 24 : 20}
                      strokeDasharray={`${seg.arcLength} ${donutStats.circumference}`}
                      strokeDashoffset={seg.offset}
                      opacity={isDimmed ? 0.32 : 1}
                      className="cursor-pointer transition-opacity duration-150"
                      onMouseEnter={() => setHoveredStatutSlice(seg.statut)}
                      onMouseLeave={() => setHoveredStatutSlice(null)}
                      onClick={() =>
                        setStatutFilter(statutFilter === seg.statut ? 'all' : seg.statut)
                      }
                    />
                  );
                })}
              </g>
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-mono text-xl font-bold text-[#252423] tabular-nums">
                {activeHover ? activeHover.count : donutStats.total}
              </span>
              <span className="text-[10px] font-medium text-[#605E5C]">
                {activeHover
                  ? `${activeHover.statut} (${activeHover.pct.toFixed(0)} %)`
                  : 'Recos total'}
              </span>
            </div>
          </div>

          <div className="w-full flex-1 space-y-1.5">
            {donutStats.segments.map((seg) => {
              const isSelected = statutFilter === seg.statut;
              return (
                <button
                  key={seg.statut}
                  type="button"
                  onMouseEnter={() => setHoveredStatutSlice(seg.statut)}
                  onMouseLeave={() => setHoveredStatutSlice(null)}
                  onClick={() =>
                    setStatutFilter(isSelected ? 'all' : seg.statut)
                  }
                  className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#FFF9DB] font-semibold text-[#252423] outline-1 outline-[#F2C811]'
                      : 'hover:bg-[#F3F2F1] text-[#323130]'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="h-2.5 w-2.5 shrink-0"
                      style={{ backgroundColor: seg.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{seg.statut}</span>
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#252423] tabular-nums shrink-0">
                    {seg.count} ({seg.pct.toFixed(1).replace('.', ',')} %)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMatrixVisual = (inFocus = false) => {
    const colTotals: Record<RecoLiveStatut, number> = {
      'Non réalisé': 0,
      Reporté: 0,
      'En attente': 0,
      Réalisé: 0,
    };
    STATUT_ORDER.forEach((st) => {
      colTotals[st] = RISK_ORDER.reduce((s, rk) => s + heatmap[rk][st], 0);
    });

    return (
      <div className="flex h-full flex-col bg-white border border-[#E1DFDD]">
        {renderVisualHeader(
          'Matrice Risque × Statut',
          'Cliquer sur une cellule, ligne ou colonne pour filtrer',
          'matrix',
          () => setActivePage('details')
        )}
        <div className={`flex-1 overflow-x-auto p-3.5 ${inFocus ? 'p-6' : ''}`}>
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr className="border-b border-[#E1DFDD] text-[11px] font-semibold text-[#605E5C]">
                <th className="py-2 pr-2 text-left">Criticité</th>
                {STATUT_ORDER.map((st) => (
                  <th key={st} className="px-1.5 py-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setStatutFilter(statutFilter === st ? 'all' : st)}
                      className={`hover:text-[#252423] hover:underline cursor-pointer ${
                        statutFilter === st ? 'text-[#252423] underline decoration-[#F2C811] decoration-2' : ''
                      }`}
                    >
                      {st}
                    </button>
                  </th>
                ))}
                <th className="pl-2 py-2 text-right whitespace-nowrap text-[#252423]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F2F1]">
              {RISK_ORDER.map((rk) => {
                const rowTotal = STATUT_ORDER.reduce((s, st) => s + heatmap[rk][st], 0);
                return (
                  <tr key={rk}>
                    <td className="py-2 pr-2 text-left whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setRiskFilter(riskFilter === rk ? 'all' : rk)}
                        className={`text-xs font-semibold hover:underline cursor-pointer ${
                          riskFilter === rk
                            ? 'text-[#252423] underline decoration-[#F2C811] decoration-2'
                            : 'text-[#323130]'
                        }`}
                      >
                        {rk}
                      </button>
                    </td>
                    {STATUT_ORDER.map((st) => {
                      const count = heatmap[rk][st];
                      const isActive = riskFilter === rk && statutFilter === st;
                      const cellStyle =
                        count === 0
                          ? 'bg-[#FAF9F8] text-[#A19F9D] hover:bg-[#F3F2F1]'
                          : st === 'Non réalisé'
                          ? rk === 'Critique'
                            ? 'bg-[#D13438] text-white hover:bg-[#A4262C]'
                            : 'bg-[#FDE7E9] text-[#A4262C] hover:bg-[#F9D0D4]'
                          : st === 'Reporté'
                          ? rk === 'Critique'
                            ? 'bg-[#E66C37] text-white hover:bg-[#CA5010]'
                            : 'bg-[#FFF4CE] text-[#8A5000] hover:bg-[#FDE8A8]'
                          : st === 'En attente'
                          ? 'bg-[#EFF6FC] text-[#005A9E] hover:bg-[#DEECF9]'
                          : 'bg-[#107C10] text-white hover:bg-[#0B5A0B]';

                      return (
                        <td key={st} className="p-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (isActive) {
                                setRiskFilter('all');
                                setStatutFilter('all');
                              } else {
                                setRiskFilter(rk);
                                setStatutFilter(st);
                              }
                            }}
                            title={`${rk} · ${st} : ${count} reco(s)`}
                            className={`flex ${
                              inFocus ? 'h-14 text-base' : 'h-10 text-sm'
                            } w-full items-center justify-center font-mono font-bold tabular-nums transition-colors cursor-pointer ${cellStyle} ${
                              isActive ? 'ring-2 ring-[#252423] ring-offset-1' : ''
                            }`}
                          >
                            {count}
                          </button>
                        </td>
                      );
                    })}
                    <td className="pl-2 py-2 text-right font-mono text-xs font-bold text-[#252423] tabular-nums">
                      {rowTotal}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#E1DFDD] bg-[#FAF9F8] font-mono text-xs font-bold text-[#252423] tabular-nums">
                <td className="py-2 pr-2 text-left font-sans text-[11px]">Total</td>
                {STATUT_ORDER.map((st) => (
                  <td key={st} className="px-1.5 py-2">
                    {colTotals[st]}
                  </td>
                ))}
                <td className="pl-2 py-2 text-right">{matrixRows.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const renderMissionsVisual = (inFocus = false) => (
    <div className="flex h-full flex-col bg-white border border-[#E1DFDD]">
      {renderVisualHeader(
        `Avancement par Mission (${missionStats.length})`,
        'Barres empilées triées par criticité ouverte · Cliquer pour filtrer',
        'missions',
        () => setActivePage('details')
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F3F2F1] bg-[#FAF9F8] px-3.5 py-1.5 text-[10px] font-medium text-[#605E5C]">
        <div className="flex flex-wrap items-center gap-3">
          {(['Réalisé', 'En attente', 'Reporté', 'Non réalisé'] as RecoLiveStatut[]).map((st) => (
            <span key={st} className="inline-flex items-center gap-1">
              <span
                className="h-2.5 w-2.5"
                style={{ backgroundColor: STATUT_COLORS[st] }}
                aria-hidden="true"
              />
              {st}
            </span>
          ))}
        </div>
        {missionFilter !== 'all' && (
          <button
            type="button"
            onClick={() => setMissionFilter('all')}
            className="font-semibold text-[#005A9E] hover:underline cursor-pointer"
          >
            Effacer filtre mission
          </button>
        )}
      </div>

      <div
        className={`flex-1 space-y-2 overflow-y-auto p-3.5 ${
          inFocus ? 'max-h-none' : 'max-h-[260px]'
        }`}
      >
        {missionStats.length === 0 ? (
          <div className="border border-dashed border-[#E1DFDD] p-6 text-center text-xs text-[#605E5C]">
            Aucune mission ne correspond aux filtres actifs.
          </div>
        ) : (
          missionStats.map((m) => {
            const isSelected = missionFilter === m.mission;
            const pctDone = Math.round((m.realise / Math.max(1, m.total)) * 100);
            return (
              <button
                key={m.mission}
                type="button"
                onClick={() => setMissionFilter(isSelected ? 'all' : m.mission)}
                className={`w-full border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-[#F2C811] bg-[#FFFDF2]'
                    : 'border-transparent hover:border-[#E1DFDD] hover:bg-[#FAF9F8]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-semibold text-[#252423]" title={m.mission}>
                    {m.mission}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.critOpen > 0 && (
                      <span className="font-mono text-[10px] font-semibold text-[#A4262C] tabular-nums">
                        {m.critOpen} crit. ouv.
                      </span>
                    )}
                    <span className="font-mono text-[11px] font-semibold text-[#323130] tabular-nums">
                      {m.realise}/{m.total} ({pctDone} %)
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 flex h-2.5 w-full overflow-hidden bg-[#F3F2F1]">
                  {m.realise > 0 && (
                    <div
                      style={{
                        width: `${(m.realise / m.total) * 100}%`,
                        backgroundColor: STATUT_COLORS['Réalisé'],
                      }}
                      title={`Réalisé : ${m.realise}`}
                    />
                  )}
                  {m.enAttente > 0 && (
                    <div
                      style={{
                        width: `${(m.enAttente / m.total) * 100}%`,
                        backgroundColor: STATUT_COLORS['En attente'],
                      }}
                      title={`En attente : ${m.enAttente}`}
                    />
                  )}
                  {m.reporte > 0 && (
                    <div
                      style={{
                        width: `${(m.reporte / m.total) * 100}%`,
                        backgroundColor: STATUT_COLORS['Reporté'],
                      }}
                      title={`Reporté : ${m.reporte}`}
                    />
                  )}
                  {m.nonRealise > 0 && (
                    <div
                      style={{
                        width: `${(m.nonRealise / m.total) * 100}%`,
                        backgroundColor: STATUT_COLORS['Non réalisé'],
                      }}
                      title={`Non réalisé : ${m.nonRealise}`}
                    />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const renderTimelineVisual = (inFocus = false) => {
    const hoveredMonthData =
      hoveredMonthIdx !== null
        ? {
            name: MONTH_SHORT[hoveredMonthIdx],
            init: monthlyTimeline.initialByMonth[hoveredMonthIdx],
            rep: monthlyTimeline.reportedByMonth[hoveredMonthIdx],
            real: monthlyTimeline.realisedByMonth[hoveredMonthIdx],
          }
        : null;

    return (
      <div className="flex h-full flex-col bg-white border border-[#E1DFDD]">
        {renderVisualHeader(
          'Chronologie Échéances Initiales vs Reports',
          'Cliquer sur un mois pour croiser les recommandations échues ou reportées',
          'timeline',
          () => setActivePage('details')
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F3F2F1] bg-[#FAF9F8] px-3.5 py-1.5 text-[10px] font-medium text-[#605E5C]">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-[#118DFF]" aria-hidden="true" />
              Échéance initiale (Delai)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-[#E66C37]" aria-hidden="true" />
              Report accordé (Report delai)
            </span>
          </div>
          {hoveredMonthData ? (
            <span className="font-mono text-[11px] font-semibold text-[#252423] tabular-nums">
              {hoveredMonthData.name} : {hoveredMonthData.init} éch. · {hoveredMonthData.rep} rep. · {hoveredMonthData.real} réal.
            </span>
          ) : monthFilter !== null ? (
            <button
              type="button"
              onClick={() => setMonthFilter(null)}
              className="font-semibold text-[#005A9E] hover:underline cursor-pointer"
            >
              Mois {MONTH_SHORT[monthFilter]} sélectionné (Réinitialiser)
            </button>
          ) : (
            <span>Survoler ou cliquer un mois</span>
          )}
        </div>

        <div className="flex-1 p-4">
          <svg
            viewBox="0 0 600 180"
            role="img"
            aria-label="Histogramme mensuel des échéances initiales et reports de délai"
            className={`w-full overflow-visible ${inFocus ? 'h-72' : 'h-44'}`}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = 142 - t * 112;
              const tickVal = Math.round(t * monthlyTimeline.maxVal);
              return (
                <g key={t}>
                  <line
                    x1="28"
                    x2="590"
                    y1={y}
                    y2={y}
                    stroke="#E1DFDD"
                    strokeDasharray={t === 0 ? undefined : '3 3'}
                  />
                  <text
                    x="22"
                    y={y + 3}
                    textAnchor="end"
                    fontSize="9"
                    fill="#605E5C"
                    fontFamily="var(--font-mono)"
                  >
                    {tickVal}
                  </text>
                </g>
              );
            })}
            {MONTH_SHORT.map((mName, idx) => {
              const xBase = 36 + idx * 46;
              const initVal = monthlyTimeline.initialByMonth[idx];
              const repVal = monthlyTimeline.reportedByMonth[idx];
              const hInit = (initVal / monthlyTimeline.maxVal) * 108;
              const hRep = (repVal / monthlyTimeline.maxVal) * 108;
              const isSelected = monthFilter === idx;
              const isDimmed = monthFilter !== null && !isSelected;

              return (
                <g
                  key={mName}
                  className="cursor-pointer"
                  opacity={isDimmed ? 0.35 : 1}
                  onMouseEnter={() => setHoveredMonthIdx(idx)}
                  onMouseLeave={() => setHoveredMonthIdx(null)}
                  onClick={() => setMonthFilter(isSelected ? null : idx)}
                >
                  <rect
                    x={xBase - 4}
                    y="22"
                    width="38"
                    height="140"
                    fill={isSelected ? '#FFFDF2' : 'transparent'}
                    stroke={isSelected ? '#F2C811' : 'none'}
                  />
                  {initVal > 0 && (
                    <>
                      <rect
                        x={xBase}
                        y={142 - hInit}
                        width="14"
                        height={Math.max(2, hInit)}
                        fill="#118DFF"
                      />
                      <text
                        x={xBase + 7}
                        y={137 - hInit}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#004578"
                        fontWeight="600"
                        fontFamily="var(--font-mono)"
                      >
                        {initVal}
                      </text>
                    </>
                  )}
                  {repVal > 0 && (
                    <>
                      <rect
                        x={xBase + 16}
                        y={142 - hRep}
                        width="14"
                        height={Math.max(2, hRep)}
                        fill="#E66C37"
                      />
                      <text
                        x={xBase + 23}
                        y={137 - hRep}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#8A3B12"
                        fontWeight="600"
                        fontFamily="var(--font-mono)"
                      >
                        {repVal}
                      </text>
                    </>
                  )}
                  <text
                    x={xBase + 15}
                    y="158"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight={isSelected ? '700' : '500'}
                    fill={isSelected ? '#252423' : '#605E5C'}
                  >
                    {mName}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  const renderDocsVisual = (inFocus = false) => (
    <div className="flex h-full flex-col bg-white border border-[#E1DFDD]">
      {renderVisualHeader(
        'Couverture des Preuves (Collections 0..4 docs)',
        'Cliquer 0 document pour isoler les recommandations sans preuve',
        'docs',
        () => setActivePage('details')
      )}
      <div className={`flex-1 space-y-3 p-4 ${inFocus ? 'p-6' : ''}`}>
        {docDistribution.map((cnt, docNb) => {
          const pct =
            filteredRows.length > 0 ? Math.round((cnt / filteredRows.length) * 100) : 0;
          const barColor =
            docNb === 0
              ? '#D13438'
              : docNb === 1
              ? '#E66C37'
              : docNb === 2
              ? '#118DFF'
              : docNb === 3
              ? '#744DA9'
              : '#107C10';
          const isZeroSelected = docNb === 0 && docCountFilter === '0';
          const isDocsSelected = docNb > 0 && docCountFilter === '1-4';

          return (
            <button
              key={docNb}
              type="button"
              onClick={() => {
                if (docNb === 0) {
                  setDocCountFilter((prev) => (prev === '0' ? 'all' : '0'));
                } else {
                  setDocCountFilter((prev) => (prev === '1-4' ? 'all' : '1-4'));
                }
              }}
              className={`block w-full border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                isZeroSelected || isDocsSelected
                  ? 'border-[#F2C811] bg-[#FFFDF2]'
                  : 'border-transparent hover:border-[#E1DFDD] hover:bg-[#FAF9F8]'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#252423]">
                  {docNb} document{docNb > 1 ? 's' : ''}
                  {docNb === 0 ? ' (sans justificatif)' : ''}
                </span>
                <span className="font-mono font-semibold text-[#323130] tabular-nums">
                  {cnt} ({pct} %)
                </span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden bg-[#F3F2F1]">
                <div
                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                  className="h-full"
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderDirectionsVisual = (inFocus = false) => (
    <div className="flex h-full flex-col bg-white border border-[#E1DFDD]">
      {renderVisualHeader(
        `Exposition par Direction (${directionStats.length})`,
        'Cliquer sur une direction pour filtrer le rapport',
        'directions',
        () => setActivePage('details')
      )}
      <div className={`flex-1 space-y-2 overflow-y-auto p-4 ${inFocus ? 'max-h-none' : 'max-h-[290px]'}`}>
        {directionStats.map((d) => {
          const isSelected = directionFilter === d.direction;
          const pctDone = Math.round((d.realise / Math.max(1, d.total)) * 100);
          return (
            <button
              key={d.direction}
              type="button"
              onClick={() => setDirectionFilter(isSelected ? 'all' : d.direction)}
              className={`w-full border px-3 py-2 text-left transition-colors cursor-pointer ${
                isSelected
                  ? 'border-[#F2C811] bg-[#FFFDF2]'
                  : 'border-[#EDEBE9] bg-[#FAF9F8] hover:border-[#C8C6C4]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-semibold text-[#252423]">{d.direction}</span>
                <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] tabular-nums">
                  {d.critOpen > 0 && (
                    <span className="font-semibold text-[#A4262C]">
                      {d.critOpen} crit. ouv.
                    </span>
                  )}
                  <span className="text-[#323130]">
                    {d.realise}/{d.total} ({pctDone} %)
                  </span>
                </div>
              </div>
              <div className="mt-1.5 flex h-2 w-full overflow-hidden bg-[#E1DFDD]">
                <div
                  style={{
                    width: `${pctDone}%`,
                    backgroundColor: STATUT_COLORS['Réalisé'],
                  }}
                />
                <div
                  style={{
                    width: `${100 - pctDone}%`,
                    backgroundColor: d.critOpen > 0 ? STATUT_COLORS['Non réalisé'] : '#C8C6C4',
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderDetailsTableSection = () => (
    <section
      aria-label="Registre analytique Power BI des recommandations"
      className="overflow-hidden border border-[#E1DFDD] bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1DFDD] bg-[#FAF9F8] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Table2 className="h-4 w-4 text-[#005A9E]" aria-hidden="true" />
          <h2 className="text-[13px] font-semibold text-[#252423]">
            Registre des Recommandations ({sortedRows.length} affichée(s))
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] text-[#605E5C]">
            Cliquer sur <strong className="text-[#005A9E]">Info recos</strong> pour l&apos;accordéon 10 colonnes.
          </span>
          {(sortedRows[0] ?? allScopeRows[0]) && (
            <button
              type="button"
              onClick={() => {
                const target = sortedRows[0] ?? allScopeRows[0];
                if (!target) return;
                setInspectedInitialView('source-file');
                setInspectedNodeId(target.node.id);
              }}
              className="inline-flex items-center gap-1.5 border border-[#005A9E] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#005A9E] hover:bg-[#F3F9FD] cursor-pointer"
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
              Détail informations sources (22 col.)
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#E1DFDD] bg-[#F3F2F1] text-[11px] font-semibold text-[#323130]">
              <th className="px-3 py-2 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSortClick('no')}
                  className="inline-flex items-center gap-1 hover:text-[#252423] cursor-pointer"
                >
                  Réf Recos
                  <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => handleSortClick('mission')}
                  className="inline-flex items-center gap-1 hover:text-[#252423] cursor-pointer"
                >
                  Intitulé &amp; Mission
                  <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="px-3 py-2 whitespace-nowrap">Direction</th>
              <th className="px-3 py-2 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSortClick('risk')}
                  className="inline-flex items-center gap-1 hover:text-[#252423] cursor-pointer"
                >
                  Risque
                  <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="px-3 py-2 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSortClick('statut')}
                  className="inline-flex items-center gap-1 hover:text-[#252423] cursor-pointer"
                >
                  Statut
                  <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="px-3 py-2 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSortClick('delai')}
                  className="inline-flex items-center gap-1 hover:text-[#252423] cursor-pointer"
                >
                  Délai / Report
                  <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="px-3 py-2 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSortClick('docs')}
                  className="inline-flex items-center gap-1 hover:text-[#252423] cursor-pointer"
                >
                  Preuves (Data bar)
                  <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="px-3 py-2 whitespace-nowrap">Revue Manager</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EDEBE9]">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-xs text-[#605E5C]">
                  Aucune recommandation ne correspond aux filtres Power BI sélectionnés.
                </td>
              </tr>
            ) : (
              sortedRows.map((item) => {
                const rec = item.record;
                const docRatio = Math.min(100, (item.collectionDocCount / 4) * 100);
                return (
                  <tr
                    key={item.node.id}
                    className="transition-colors hover:bg-[#FAF9F8]"
                  >
                    <td className="px-3 py-2 font-mono font-semibold text-[#252423] whitespace-nowrap tabular-nums">
                      <div>{rec.refRecos}</div>
                      <div className="text-[10px] font-normal text-[#605E5C]">
                        N°{rec.no} · {item.exerciceYear}
                      </div>
                    </td>
                    <td className="px-3 py-2 max-w-[320px]">
                      <div className="font-medium text-[#252423]">{rec.intituleRecos}</div>
                      <div className="mt-0.5 truncate text-[11px] text-[#605E5C]">
                        {item.missionLabel} · {rec.responsable}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-[#323130] whitespace-nowrap">
                      {rec.direction}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`text-[11px] font-semibold ${
                          item.riskLevel === 'Critique'
                            ? 'text-[#A4262C]'
                            : item.riskLevel === 'Majeur'
                            ? 'text-[#CA5010]'
                            : 'text-[#005A9E]'
                        }`}
                      >
                        {item.riskLevel}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
                        style={{ color: STATUT_COLORS[item.liveStatut] }}
                      >
                        {item.liveStatut}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap tabular-nums">
                      <div className="text-[#252423]">{rec.delai}</div>
                      {item.hasReport && (
                        <div className="text-[10px] font-semibold text-[#CA5010]">
                          → {rec.reportDelai}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden bg-[#EDEBE9]">
                          <div
                            style={{
                              width: `${docRatio}%`,
                              backgroundColor:
                                item.collectionDocCount === 0 ? '#D13438' : '#744DA9',
                            }}
                            className="h-full"
                          />
                        </div>
                        <span
                          className={`font-mono text-[11px] font-semibold tabular-nums ${
                            item.collectionDocCount === 0
                              ? 'text-[#A4262C]'
                              : 'text-[#323130]'
                          }`}
                        >
                          {item.collectionDocCount}/4
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onToggleManagerReview(item.node.id)}
                        title="Basculer validation Revue Manager"
                        className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-semibold cursor-pointer ${
                          item.managerReviewed
                            ? 'border-[#107C10]/40 bg-[#DFF6DD] text-[#107C10]'
                            : 'border-[#E1DFDD] bg-[#F3F2F1] text-[#323130] hover:bg-[#EDEBE9]'
                        }`}
                      >
                        <ClipboardCheck className="h-3 w-3" aria-hidden="true" />
                        {item.managerReviewed ? 'Validée' : 'À revoir'}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectedInitialView('accordeon');
                            setInspectedNodeId(item.node.id);
                          }}
                          className="inline-flex items-center gap-1 bg-[#005A9E] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#004578] cursor-pointer"
                        >
                          <Info className="h-3 w-3" aria-hidden="true" />
                          Info recos
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenNodeInWorkflow(item.node.id)}
                          title="Ouvrir dans l'arborescence Workflow"
                          className="border border-[#E1DFDD] bg-white p-1 text-[#323130] hover:bg-[#F3F2F1] cursor-pointer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="flex flex-col overflow-hidden border border-[#E1DFDD] bg-[#F3F2F1] text-[#252423] shadow-xs">
      {/* RUBAN SUPÉRIEUR POWER BI */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1DFDD] bg-white px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex h-7 w-7 items-center justify-center bg-[#252423] text-[#F2C811]">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display truncate text-sm font-bold text-[#252423]">
                  Suivi des Recommandations d&apos;Audit
                </h1>
              </div>
              <p className="text-[11px] text-[#605E5C] truncate">
                Rapport Power BI · Modèle en direct · Actualisé à {lastRefreshLabel}
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-[#E1DFDD] hidden sm:block" aria-hidden="true" />

          {/* Sélecteur source Workflow vs Team Workflow */}
          <div className="inline-flex items-center border border-[#E1DFDD] bg-[#F3F2F1] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setScopeRootId('root-workflow')}
              className={`px-2.5 py-1 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scopeRootId === 'root-workflow'
                  ? 'bg-white text-[#252423] shadow-2xs border-b-2 border-[#F2C811]'
                  : 'text-[#605E5C] hover:text-[#252423]'
              }`}
            >
              Workflow (Personnel)
            </button>
            <button
              type="button"
              onClick={() => setScopeRootId('root-team-workflow')}
              className={`px-2.5 py-1 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scopeRootId === 'root-team-workflow'
                  ? 'bg-white text-[#252423] shadow-2xs border-b-2 border-[#F2C811]'
                  : 'text-[#605E5C] hover:text-[#252423]'
              }`}
            >
              Team Workflow
            </button>
          </div>
        </div>

        {/* Boutons d'action du ruban BI */}
        <div className="flex flex-wrap items-center gap-1.5">
          {exportToast && (
            <span className="inline-flex items-center gap-1 border border-[#107C10]/30 bg-[#DFF6DD] px-2.5 py-1 text-[11px] font-medium text-[#107C10]">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {exportToast}
            </span>
          )}

          <button
            type="button"
            onClick={handleRefreshModel}
            className="inline-flex items-center gap-1.5 border border-[#E1DFDD] bg-white px-2.5 py-1.5 text-xs font-medium text-[#323130] hover:bg-[#FAF9F8] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[#005A9E]" aria-hidden="true" />
            Actualiser
          </button>

          {activeFilterChips.length > 0 && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1.5 border border-[#F2C811] bg-[#FFF9DB] px-2.5 py-1.5 text-xs font-semibold text-[#252423] hover:bg-[#FFF2B2] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Réinitialiser ({activeFilterChips.length})
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowFiltersPane((v) => !v)}
            className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
              showFiltersPane
                ? 'border-[#252423] bg-[#252423] text-white'
                : 'border-[#E1DFDD] bg-white text-[#323130] hover:bg-[#FAF9F8]'
            }`}
          >
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            Filtres
          </button>

          <button
            type="button"
            onClick={() => setShowFieldsPane((v) => !v)}
            className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
              showFieldsPane
                ? 'border-[#252423] bg-[#252423] text-white'
                : 'border-[#E1DFDD] bg-white text-[#323130] hover:bg-[#FAF9F8]'
            }`}
          >
            <Database className="h-3.5 w-3.5" aria-hidden="true" />
            Champs
          </button>

          {(filteredRows[0] ?? allScopeRows[0]) && (
            <button
              type="button"
              onClick={() => {
                const target = filteredRows[0] ?? allScopeRows[0];
                if (!target) return;
                setInspectedInitialView('source-file');
                setInspectedNodeId(target.node.id);
              }}
              title="Afficher le détail complet des 22 colonnes sources du fichier Suivi Recos"
              className="inline-flex items-center gap-1.5 border border-[#005A9E] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#005A9E] hover:bg-[#F3F9FD] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
              Détail source
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 border border-[#E1DFDD] bg-white px-2.5 py-1.5 text-xs font-medium text-[#323130] hover:bg-[#FAF9F8] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            CSV
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 bg-[#005A9E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#004578] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            JSON Comité
          </button>
        </div>
      </header>

      {/* BARRE DES FILTRES CROISÉS ACTIFS */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E1DFDD] bg-[#FAF9F8] px-4 py-1.5 text-xs">
          <span className="font-semibold text-[#605E5C]">Filtres appliqués :</span>
          {activeFilterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onClear}
              className="inline-flex items-center gap-1 border border-[#C8C6C4] bg-white px-2 py-0.5 text-[11px] font-medium text-[#252423] hover:bg-[#F3F2F1] cursor-pointer"
            >
              <span>{chip.label}</span>
              <X className="h-3 w-3 text-[#605E5C]" aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={resetAllFilters}
            className="ml-auto text-[11px] font-semibold text-[#005A9E] hover:underline cursor-pointer"
          >
            Tout effacer
          </button>
        </div>
      )}

      {/* CORPS PRINCIPAL : CANEVAS POWER BI + VOLETS DROITS */}
      <div className="flex min-h-[640px] flex-col lg:flex-row">
        {/* CANEVAS DU RAPPORT */}
        <div className="min-w-0 flex-1 space-y-4 p-4">
          {/* SEGMENTS / SLICERS RAPIDES SUR CANEVAS */}
          <section
            aria-label="Segments Power BI"
            className="grid grid-cols-1 gap-2.5 border border-[#E1DFDD] bg-white p-3 sm:grid-cols-2 xl:grid-cols-6"
          >
            <div className="xl:col-span-2">
              <div className="mb-1 text-[10px] font-semibold text-[#605E5C]">
                Segment · Exercice
              </div>
              <div className="inline-flex w-full border border-[#E1DFDD] bg-[#F3F2F1] p-0.5 text-xs">
                {(
                  [
                    { id: '2025', label: `2025 (${stats2025.total})` },
                    { id: '2024', label: `2024 (${stats2024.total})` },
                    { id: 'all', label: `Tous (${allScopeRows.length})` },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setExerciceFilter(opt.id);
                      setMissionFilter('all');
                    }}
                    className={`flex-1 py-1 text-center font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      exerciceFilter === opt.id
                        ? 'bg-[#252423] text-[#F2C811]'
                        : 'text-[#605E5C] hover:text-[#252423]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold text-[#605E5C]">
                Segment · Direction
              </label>
              <select
                aria-label="Filtrer par Direction"
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value)}
                className="w-full border border-[#C8C6C4] bg-white px-2 py-1 text-xs text-[#252423] focus:border-[#005A9E] focus:outline-none"
              >
                <option value="all">Toutes ({availableDirections.length})</option>
                {availableDirections.map((d) => (
                  <option key={d} value={d}>
                    {d} ({directionCounts.get(d) ?? 0})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold text-[#605E5C]">
                Segment · Criticité
              </label>
              <select
                aria-label="Filtrer par Criticité"
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value as RecoRiskLevel | 'all')}
                className="w-full border border-[#C8C6C4] bg-white px-2 py-1 text-xs text-[#252423] focus:border-[#005A9E] focus:outline-none"
              >
                <option value="all">Tous Risques</option>
                {RISK_ORDER.map((rk) => (
                  <option key={rk} value={rk}>
                    {rk} ({riskCounts[rk]})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold text-[#605E5C]">
                Segment · Statut
              </label>
              <select
                aria-label="Filtrer par Statut"
                value={statutFilter}
                onChange={(e) => setStatutFilter(e.target.value as RecoLiveStatut | 'all')}
                className="w-full border border-[#C8C6C4] bg-white px-2 py-1 text-xs text-[#252423] focus:border-[#005A9E] focus:outline-none"
              >
                <option value="all">Tous Statuts</option>
                {STATUT_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {st} ({statutBaseCounts[st]})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold text-[#605E5C]">
                Segment · Auditeur
              </label>
              <select
                aria-label="Filtrer par Auditeur"
                value={auditorFilter}
                onChange={(e) => setAuditorFilter(e.target.value)}
                className="w-full border border-[#C8C6C4] bg-white px-2 py-1 text-xs text-[#252423] focus:border-[#005A9E] focus:outline-none"
              >
                <option value="all">Tous ({availableAuditors.length})</option>
                {availableAuditors.map((aud) => (
                  <option key={aud} value={aud}>
                    {aud}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* MODE FOCUS D'UN VISUEL */}
          {focusVisual ? (
            <section aria-label="Mode Focus Power BI" className="space-y-3">
              <div className="flex items-center justify-between border border-[#E1DFDD] bg-white px-3.5 py-2 text-xs">
                <span className="font-semibold text-[#252423]">
                  Mode Focus · Inspection agrandie du visuel
                </span>
                <button
                  type="button"
                  onClick={() => setFocusVisual(null)}
                  className="inline-flex items-center gap-1 border border-[#C8C6C4] bg-[#F3F2F1] px-2.5 py-1 font-medium text-[#252423] hover:bg-[#EDEBE9] cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Revenir au rapport
                </button>
              </div>
              <div className="min-h-[420px]">
                {focusVisual === 'donut' && renderDonutVisual(true)}
                {focusVisual === 'matrix' && renderMatrixVisual(true)}
                {focusVisual === 'missions' && renderMissionsVisual(true)}
                {focusVisual === 'timeline' && renderTimelineVisual(true)}
                {focusVisual === 'docs' && renderDocsVisual(true)}
                {focusVisual === 'directions' && renderDirectionsVisual(true)}
              </div>
            </section>
          ) : (
            <>
              {/* PAGE 1 : VUE EXÉCUTIVE */}
              {activePage === 'executive' && (
                <div className="space-y-4">
                  {/* LIGNE KPI : JAUGE POWER BI + 4 CARTES KPI */}
                  <section
                    aria-label="Cartes KPI et Jauge Power BI"
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
                  >
                    {/* Jauge Power BI : Taux de mise en œuvre */}
                    <div className="flex flex-col justify-between border border-[#E1DFDD] bg-white p-3.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#605E5C]">
                        <span>Taux de mise en œuvre</span>
                        <span className="font-mono text-[10px] text-[#605E5C] tabular-nums">
                          Cible 75 %
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <svg
                          viewBox="0 0 144 82"
                          role="img"
                          aria-label={`Jauge ${kpis.implRate.toFixed(1)} pour cent`}
                          className="h-16 w-28 shrink-0"
                        >
                          <path
                            d="M 16 74 A 56 56 0 0 1 128 74"
                            fill="none"
                            stroke="#EDEBE9"
                            strokeWidth="12"
                          />
                          <path
                            d="M 16 74 A 56 56 0 0 1 128 74"
                            fill="none"
                            stroke={kpis.implRate >= 70 ? '#107C10' : '#118DFF'}
                            strokeWidth="12"
                            strokeDasharray={`${gaugeFillLen} ${gaugeArcLen}`}
                          />
                          <circle
                            cx={targetMarkerX}
                            cy={targetMarkerY}
                            r="3"
                            fill="#252423"
                          />
                          <text
                            x="72"
                            y="68"
                            textAnchor="middle"
                            fontSize="15"
                            fontWeight="700"
                            fill="#252423"
                            fontFamily="var(--font-mono)"
                          >
                            {kpis.implRate.toFixed(1).replace('.', ',')}%
                          </text>
                        </svg>
                        <div className="text-right text-[11px] text-[#605E5C] tabular-nums">
                          <div className="font-mono text-sm font-bold text-[#252423]">
                            {kpis.realised}/{kpis.total}
                          </div>
                          <div>clôturées</div>
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-[#605E5C]">
                        {deltaVs2024 >= 0 ? (
                          <TrendingUp className="h-3 w-3 text-[#107C10]" aria-hidden="true" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-[#CA5010]" aria-hidden="true" />
                        )}
                        <span className="tabular-nums">
                          Réf. 2024 : <strong>{stats2024.rate.toFixed(1).replace('.', ',')} %</strong>
                        </span>
                      </div>
                    </div>

                    {/* KPI 2 : Critiques ouvertes */}
                    <button
                      type="button"
                      onClick={() =>
                        setRiskFilter(riskFilter === 'Critique' ? 'all' : 'Critique')
                      }
                      className={`flex flex-col justify-between border p-3.5 text-left transition-colors cursor-pointer ${
                        riskFilter === 'Critique'
                          ? 'border-[#D13438] bg-[#FDF3F4]'
                          : 'border-[#E1DFDD] bg-white hover:border-[#C8C6C4]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#605E5C]">
                        <span>Critiques ouvertes</span>
                        <ShieldAlert className="h-4 w-4 text-[#D13438]" aria-hidden="true" />
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="font-mono text-2xl font-bold text-[#A4262C] tabular-nums">
                          {kpis.critOpenCount}
                        </span>
                        <span className="font-mono text-xs text-[#605E5C] tabular-nums">
                          / {kpis.critTotal} ({kpis.critOpenRate.toFixed(0)} %)
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] text-[#605E5C]">
                        Cliquer pour croiser sur <strong className="text-[#A4262C]">Critique</strong>
                      </div>
                    </button>

                    {/* KPI 3 : Reports de délai */}
                    <button
                      type="button"
                      onClick={() =>
                        setStatutFilter(statutFilter === 'Reporté' ? 'all' : 'Reporté')
                      }
                      className={`flex flex-col justify-between border p-3.5 text-left transition-colors cursor-pointer ${
                        statutFilter === 'Reporté'
                          ? 'border-[#E66C37] bg-[#FFF8F4]'
                          : 'border-[#E1DFDD] bg-white hover:border-[#C8C6C4]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#605E5C]">
                        <span>Reports de délai</span>
                        <Clock className="h-4 w-4 text-[#E66C37]" aria-hidden="true" />
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="font-mono text-2xl font-bold text-[#252423] tabular-nums">
                          {kpis.reported}
                        </span>
                        <span className="font-mono text-xs text-[#CA5010] tabular-nums">
                          ({kpis.reportRate.toFixed(1).replace('.', ',')} %)
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] text-[#605E5C]">
                        Cliquer pour isoler le statut <strong>Reporté</strong>
                      </div>
                    </button>

                    {/* KPI 4 : Collections justifiées */}
                    <button
                      type="button"
                      onClick={() =>
                        setDocCountFilter((prev) => (prev === '0' ? 'all' : '0'))
                      }
                      className={`flex flex-col justify-between border p-3.5 text-left transition-colors cursor-pointer ${
                        docCountFilter === '0'
                          ? 'border-[#744DA9] bg-[#F8F5FC]'
                          : 'border-[#E1DFDD] bg-white hover:border-[#C8C6C4]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#605E5C]">
                        <span>Collections justifiées</span>
                        <Layers className="h-4 w-4 text-[#744DA9]" aria-hidden="true" />
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="font-mono text-2xl font-bold text-[#252423] tabular-nums">
                          {kpis.withDocs} / {kpis.total}
                        </span>
                        <span className="font-mono text-xs text-[#744DA9] tabular-nums">
                          ({kpis.docsRate.toFixed(0)} %)
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] text-[#605E5C]">
                        <strong className="text-[#A4262C]">{kpis.emptyDocs}</strong> à 0 doc (filtrer)
                      </div>
                    </button>

                    {/* KPI 5 : Revue Manager validée */}
                    <button
                      type="button"
                      onClick={() =>
                        setReviewFilter((prev) => (prev === 'pending' ? 'all' : 'pending'))
                      }
                      className={`flex flex-col justify-between border p-3.5 text-left transition-colors cursor-pointer ${
                        reviewFilter === 'pending'
                          ? 'border-[#005A9E] bg-[#F3F9FD]'
                          : 'border-[#E1DFDD] bg-white hover:border-[#C8C6C4]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#605E5C]">
                        <span>Revue Manager</span>
                        <ClipboardCheck className="h-4 w-4 text-[#005A9E]" aria-hidden="true" />
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="font-mono text-2xl font-bold text-[#252423] tabular-nums">
                          {kpis.reviewed} / {kpis.total}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-[#605E5C]">
                        <MessageSquareWarning className="h-3.5 w-3.5 text-[#CA5010]" aria-hidden="true" />
                        <span>
                          <strong>{kpis.openNotes}</strong> note(s) ouverte(s)
                        </span>
                      </div>
                    </button>
                  </section>

                  {/* GRILLE VISUELS PRINCIPALE POWER BI */}
                  <section
                    aria-label="Visuels analytiques croisés"
                    className="grid grid-cols-1 gap-4 lg:grid-cols-12"
                  >
                    <div className="lg:col-span-4">{renderDonutVisual(false)}</div>
                    <div className="lg:col-span-4">{renderMatrixVisual(false)}</div>
                    <div className="lg:col-span-4">{renderMissionsVisual(false)}</div>
                  </section>

                  {/* APERÇU CHRONOLOGIE + RADAR SYNTHÉTIQUE */}
                  <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                    <div className="lg:col-span-7">{renderTimelineVisual(false)}</div>
                    <div className="flex flex-col border border-[#E1DFDD] bg-white lg:col-span-5">
                      <div className="flex items-center justify-between border-b border-[#EDEBE9] px-3.5 py-2.5">
                        <div>
                          <h2 className="text-[13px] font-semibold text-[#252423]">
                            Watchlist Manager ({watchlistAlerts.length})
                          </h2>
                          <p className="text-[11px] text-[#605E5C]">
                            Critiques non soldées &amp; preuves manquantes
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActivePage('manager')}
                          className="text-[11px] font-semibold text-[#005A9E] hover:underline cursor-pointer"
                        >
                          Ouvrir Pilotage Manager →
                        </button>
                      </div>
                      <div className="flex-1 divide-y divide-[#F3F2F1] overflow-y-auto px-3.5 py-1 max-h-[210px]">
                        {watchlistAlerts.slice(0, 5).map(({ item, reason, severity }) => (
                          <div
                            key={item.node.id}
                            className="flex items-center justify-between gap-2 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-[#252423]">
                                <span className="font-mono">{item.record.refRecos}</span> ·{' '}
                                {item.record.intituleRecos}
                              </div>
                              <div
                                className={`text-[11px] ${
                                  severity === 'critical' ? 'text-[#A4262C]' : 'text-[#8A5000]'
                                }`}
                              >
                                {reason} · {item.record.responsable}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setInspectedNodeId(item.node.id)}
                              className="shrink-0 bg-[#005A9E] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#004578] cursor-pointer"
                            >
                              Info recos
                            </button>
                          </div>
                        ))}
                        {watchlistAlerts.length === 0 && (
                          <div className="py-6 text-center text-xs text-[#107C10]">
                            Aucune alerte critique active sur le périmètre filtré.
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  {renderDetailsTableSection()}
                </div>
              )}

              {/* PAGE 2 : DÉLAIS, DIRECTIONS & PREUVES */}
              {activePage === 'trends' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                    <div className="lg:col-span-7">{renderTimelineVisual(false)}</div>
                    <div className="lg:col-span-5">{renderDocsVisual(false)}</div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                    <div className="lg:col-span-7">{renderDirectionsVisual(false)}</div>
                    <div className="flex flex-col border border-[#E1DFDD] bg-white lg:col-span-5">
                      <div className="border-b border-[#EDEBE9] px-3.5 py-2.5">
                        <h2 className="text-[13px] font-semibold text-[#252423]">
                          Performance par Auditeur
                        </h2>
                        <p className="text-[11px] text-[#605E5C]">
                          Portefeuille suivi, taux de clôture &amp; revue manager
                        </p>
                      </div>
                      <div className="space-y-2 p-4">
                        {auditorStats.map((a) => {
                          const pct = Math.round((a.realised / Math.max(1, a.total)) * 100);
                          const isSelected = auditorFilter === a.auditor;
                          return (
                            <button
                              key={a.auditor}
                              type="button"
                              onClick={() =>
                                setAuditorFilter(isSelected ? 'all' : a.auditor)
                              }
                              className={`w-full border p-2.5 text-left transition-colors cursor-pointer ${
                                isSelected
                                  ? 'border-[#F2C811] bg-[#FFFDF2]'
                                  : 'border-[#EDEBE9] bg-[#FAF9F8] hover:border-[#C8C6C4]'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-[#252423]">{a.auditor}</span>
                                <span className="font-mono text-[11px] font-semibold text-[#323130] tabular-nums">
                                  {a.realised}/{a.total} ({pct} %)
                                </span>
                              </div>
                              <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#605E5C]">
                                <span>{a.critOpen} critique(s) ouverte(s)</span>
                                <span>{a.reviewed} revue(s) OK</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PAGE 3 : PILOTAGE MANAGER & RELANCES */}
              {activePage === 'manager' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                    <div className="border border-[#E1DFDD] bg-white p-4 lg:col-span-7">
                      <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-2.5">
                        <div className="flex items-center gap-2">
                          <AlertOctagon className="h-4 w-4 text-[#D13438]" aria-hidden="true" />
                          <h2 className="text-[13px] font-semibold text-[#252423]">
                            Radar Watchlist Manager ({watchlistAlerts.length} alerte(s))
                          </h2>
                        </div>
                        <span className="text-[11px] text-[#605E5C]">
                          Priorité revue &amp; relance
                        </span>
                      </div>

                      <div className="mt-3 space-y-2">
                        {watchlistAlerts.length === 0 ? (
                          <div className="border border-dashed border-[#107C10]/40 bg-[#DFF6DD] p-4 text-center text-xs font-medium text-[#107C10]">
                            Aucune anomalie critique active sur le périmètre filtré.
                          </div>
                        ) : (
                          watchlistAlerts.map(({ item, reason, severity }) => (
                            <div
                              key={item.node.id}
                              className={`flex flex-wrap items-center justify-between gap-2 border px-3 py-2 text-xs ${
                                severity === 'critical'
                                  ? 'border-[#D13438]/30 bg-[#FDF3F4]'
                                  : 'border-[#E66C37]/30 bg-[#FFF8F4]'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-[#252423]">
                                    {item.record.refRecos}
                                  </span>
                                  <span className="truncate font-medium text-[#323130]">
                                    {item.record.intituleRecos}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[#605E5C]">
                                  <span
                                    className={
                                      severity === 'critical'
                                        ? 'font-semibold text-[#A4262C]'
                                        : 'font-semibold text-[#8A5000]'
                                    }
                                  >
                                    {reason}
                                  </span>
                                  <span>·</span>
                                  <span>{item.record.responsable}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setRelanceModalItem(item)}
                                  className="inline-flex items-center gap-1 border border-[#C8C6C4] bg-white px-2 py-1 text-[11px] font-medium text-[#323130] hover:bg-[#F3F2F1] cursor-pointer"
                                >
                                  <Mail className="h-3 w-3 text-[#E66C37]" aria-hidden="true" />
                                  Relancer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInspectedNodeId(item.node.id)}
                                  className="inline-flex items-center gap-1 bg-[#005A9E] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#004578] cursor-pointer"
                                >
                                  <Info className="h-3 w-3" aria-hidden="true" />
                                  Revue Manager
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="border border-[#E1DFDD] bg-white p-4 lg:col-span-5">
                      <div className="flex items-center gap-2 border-b border-[#EDEBE9] pb-2.5">
                        <AlertTriangle className="h-4 w-4 text-[#E66C37]" aria-hidden="true" />
                        <h2 className="text-[13px] font-semibold text-[#252423]">
                          Top Responsables à relancer
                        </h2>
                      </div>
                      <p className="mt-1.5 text-[11px] text-[#605E5C]">
                        Cumul des recommandations ouvertes par pilote audité.
                      </p>

                      <div className="mt-3 space-y-2">
                        {topResponsablesOpen.length === 0 ? (
                          <div className="border border-dashed border-[#E1DFDD] p-4 text-center text-xs text-[#605E5C]">
                            Toutes les recommandations de ce périmètre sont clôturées.
                          </div>
                        ) : (
                          topResponsablesOpen.map((resp) => (
                            <div
                              key={`${resp.responsable}-${resp.email}`}
                              className="flex items-center justify-between gap-2 border border-[#EDEBE9] bg-[#FAF9F8] px-3 py-2 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-[#252423]">
                                  {resp.responsable}
                                </div>
                                <div className="truncate text-[11px] text-[#605E5C]">
                                  {resp.direction} ·{' '}
                                  <span className="font-mono">{resp.email}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-[11px] font-bold text-[#252423] tabular-nums">
                                  {resp.openCount} ouv.
                                </span>
                                {resp.critOpen > 0 && (
                                  <span className="font-mono text-[11px] font-bold text-[#A4262C] tabular-nums">
                                    {resp.critOpen} crit.
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setRelanceModalItem(resp.sampleItem)}
                                  title="Préparer un message de relance"
                                  className="border border-[#C8C6C4] bg-white p-1 text-[#005A9E] hover:bg-[#F3F2F1] cursor-pointer"
                                >
                                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {relanceModalItem && (
                    <section
                      aria-label="Modèle de relance audité"
                      className="border border-[#E66C37]/50 bg-[#FFF8F4] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#252423]">
                          <Mail className="h-4 w-4 text-[#E66C37]" aria-hidden="true" />
                          <span>
                            Relance préparée pour {relanceModalItem.record.responsable} (
                            {relanceModalItem.record.emailAudite}) · {relanceModalItem.record.refRecos}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyRelance(relanceModalItem)}
                            className="inline-flex items-center gap-1 bg-[#CA5010] px-3 py-1 text-xs font-semibold text-white hover:bg-[#A43700] cursor-pointer"
                          >
                            {copiedRelanceId === relanceModalItem.node.id ? (
                              <>
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                Copié
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                Copier le mail de relance
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRelanceModalItem(null)}
                            className="border border-[#C8C6C4] bg-white px-2.5 py-1 text-xs font-medium text-[#323130] hover:bg-[#F3F2F1] cursor-pointer"
                          >
                            Fermer
                          </button>
                        </div>
                      </div>
                      <pre className="mt-2.5 max-h-48 overflow-y-auto border border-[#E1DFDD] bg-white p-3 font-sans text-xs leading-relaxed text-[#252423] whitespace-pre-wrap">
                        {buildRelanceText(relanceModalItem)}
                      </pre>
                    </section>
                  )}
                </div>
              )}

              {/* PAGE 4 : TABLE DÉTAILLÉE POWER BI */}
              {activePage === 'details' && renderDetailsTableSection()}
            </>
          )}
        </div>

        {/* VOLET DROIT POWER BI : FILTRES */}
        {showFiltersPane && (
          <aside
            aria-label="Volet Filtres Power BI"
            className="w-full shrink-0 border-t border-[#E1DFDD] bg-[#FAF9F8] lg:w-64 lg:border-t-0 lg:border-l"
          >
            <div className="flex items-center justify-between border-b border-[#E1DFDD] bg-white px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#252423]">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[#005A9E]" aria-hidden="true" />
                <span>Filtres</span>
              </div>
              <button
                type="button"
                onClick={() => setShowFiltersPane(false)}
                title="Réduire le volet Filtres"
                className="p-0.5 text-[#605E5C] hover:text-[#252423] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3 p-3 text-xs">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-[#605E5C]">
                  Recherche plein texte
                </div>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-[#605E5C]"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Réf, constat, responsable..."
                    className="w-full border border-[#C8C6C4] bg-white py-1.5 pl-7 pr-2 text-xs text-[#252423] placeholder:text-[#A19F9D] focus:border-[#005A9E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="border border-[#E1DFDD] bg-white p-2.5">
                <div className="mb-1.5 font-semibold text-[#252423]">Niveau de Risque</div>
                <div className="space-y-1">
                  {RISK_ORDER.map((rk) => {
                    const checked = riskFilter === rk;
                    return (
                      <button
                        key={rk}
                        type="button"
                        onClick={() => setRiskFilter(checked ? 'all' : rk)}
                        className={`flex w-full items-center justify-between px-1.5 py-1 text-[11px] cursor-pointer ${
                          checked ? 'bg-[#FFF9DB] font-semibold text-[#252423]' : 'hover:bg-[#F3F2F1] text-[#323130]'
                        }`}
                      >
                        <span>{rk}</span>
                        <span className="font-mono text-[#605E5C] tabular-nums">
                          {riskCounts[rk]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border border-[#E1DFDD] bg-white p-2.5">
                <div className="mb-1.5 font-semibold text-[#252423]">Statut Workflow</div>
                <div className="space-y-1">
                  {STATUT_ORDER.map((st) => {
                    const checked = statutFilter === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatutFilter(checked ? 'all' : st)}
                        className={`flex w-full items-center justify-between px-1.5 py-1 text-[11px] cursor-pointer ${
                          checked ? 'bg-[#FFF9DB] font-semibold text-[#252423]' : 'hover:bg-[#F3F2F1] text-[#323130]'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2"
                            style={{ backgroundColor: STATUT_COLORS[st] }}
                            aria-hidden="true"
                          />
                          {st}
                        </span>
                        <span className="font-mono text-[#605E5C] tabular-nums">
                          {statutBaseCounts[st]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border border-[#E1DFDD] bg-white p-2.5">
                <div className="mb-1.5 font-semibold text-[#252423]">Preuves Collection</div>
                <div className="space-y-1 text-[11px]">
                  {(
                    [
                      { id: 'all', label: 'Toutes les collections' },
                      { id: '0', label: '0 document (sans preuve)' },
                      { id: '1-4', label: '1 à 4 documents déposés' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDocCountFilter(opt.id)}
                      className={`block w-full px-1.5 py-1 text-left cursor-pointer ${
                        docCountFilter === opt.id
                          ? 'bg-[#FFF9DB] font-semibold text-[#252423]'
                          : 'hover:bg-[#F3F2F1] text-[#323130]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border border-[#E1DFDD] bg-white p-2.5">
                <div className="mb-1.5 font-semibold text-[#252423]">Revue Manager</div>
                <div className="space-y-1 text-[11px]">
                  {(
                    [
                      { id: 'all', label: 'Toutes' },
                      { id: 'reviewed', label: 'Validée par Manager' },
                      { id: 'pending', label: 'À revoir' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setReviewFilter(opt.id)}
                      className={`block w-full px-1.5 py-1 text-left cursor-pointer ${
                        reviewFilter === opt.id
                          ? 'bg-[#FFF9DB] font-semibold text-[#252423]'
                          : 'hover:bg-[#F3F2F1] text-[#323130]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* VOLET DROIT POWER BI : CHAMPS & MODÈLE SÉMANTIQUE */}
        {showFieldsPane && (
          <aside
            aria-label="Volet Champs Power BI"
            className="w-full shrink-0 border-t border-[#E1DFDD] bg-[#FAF9F8] lg:w-60 lg:border-t-0 lg:border-l"
          >
            <div className="flex items-center justify-between border-b border-[#E1DFDD] bg-white px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#252423]">
                <Database className="h-3.5 w-3.5 text-[#F2C811]" aria-hidden="true" />
                <span>Données &amp; Mesures</span>
              </div>
              <button
                type="button"
                onClick={() => setShowFieldsPane(false)}
                title="Fermer le volet Champs"
                className="p-0.5 text-[#605E5C] hover:text-[#252423] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3 p-3 text-[11px]">
              <div className="border border-[#E1DFDD] bg-white p-2.5">
                <div className="font-semibold text-[#252423]">T_Recos_Sources (22 col.)</div>
                <div className="mt-1.5 space-y-1 text-[#323130]">
                  {(
                    [
                      { label: 'Ref recos', sort: 'no' },
                      { label: 'Evaluation Risque', sort: 'risk' },
                      { label: 'Statut Workflow', sort: 'statut' },
                      { label: 'Delai / Report delai', sort: 'delai' },
                      { label: 'Mission / Intitule', sort: 'mission' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.label}
                      type="button"
                      onClick={() => {
                        setSortKey(f.sort);
                        setActivePage('details');
                      }}
                      className="flex w-full items-center justify-between px-1.5 py-1 text-left hover:bg-[#F3F2F1] cursor-pointer"
                    >
                      <span>{f.label}</span>
                      <span className="text-[10px] text-[#005A9E]">Trier</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border border-[#E1DFDD] bg-white p-2.5">
                <div className="font-semibold text-[#252423]">T_Collections_Preuves</div>
                <div className="mt-1.5 space-y-1 text-[#323130]">
                  <button
                    type="button"
                    onClick={() => {
                      setSortKey('docs');
                      setActivePage('trends');
                    }}
                    className="flex w-full items-center justify-between px-1.5 py-1 text-left hover:bg-[#F3F2F1] cursor-pointer"
                  >
                    <span>Nb Docs Collection (0..4)</span>
                    <span className="font-mono text-[#744DA9] tabular-nums">{kpis.withDocs}</span>
                  </button>
                </div>
              </div>

              <div className="border border-[#E1DFDD] bg-white p-2.5">
                <div className="font-semibold text-[#252423]">Mesures calculées</div>
                <div className="mt-1.5 space-y-1 font-mono text-[10px] text-[#323130] tabular-nums">
                  <div className="flex justify-between">
                    <span>Σ Taux clôture</span>
                    <strong>{kpis.implRate.toFixed(1)} %</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Σ Crit. ouvertes</span>
                    <strong className="text-[#A4262C]">{kpis.critOpenCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Σ Reports délai</span>
                    <strong className="text-[#CA5010]">{kpis.reported}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Σ Notes ouvertes</span>
                    <strong>{kpis.openNotes}</strong>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* BARRE D'ONGLETS DE PAGES EN BAS — STYLE POWER BI DESKTOP */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E1DFDD] bg-[#EAEAEA] px-3">
        <div className="flex items-center overflow-x-auto" role="tablist" aria-label="Pages du rapport Power BI">
          {REPORT_PAGES.map((page, idx) => {
            const isActive = activePage === page.id && focusVisual === null;
            return (
              <button
                key={page.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                title={page.subtitle}
                onClick={() => {
                  setFocusVisual(null);
                  setActivePage(page.id);
                }}
                className={`border-r border-[#D2D0CE] px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-b-3 border-b-[#F2C811] bg-white font-semibold text-[#252423]'
                    : 'text-[#605E5C] hover:bg-[#F3F2F1] hover:text-[#252423]'
                }`}
              >
                {idx + 1}. {page.label}
              </button>
            );
          })}
        </div>

        <div className="py-1.5 text-[11px] font-mono text-[#605E5C] tabular-nums">
          {filteredRows.length} / {baseExerciceRows.length} lignes affichées ({exerciceFilter === 'all' ? '2024+2025' : exerciceFilter})
        </div>
      </footer>

      {/* TIROIR LATÉRAL DÉTAIL SUIVI RECOS (ACCORDÉON 10 COL. & FICHIER SOURCE 22 COL.) */}
      {inspectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Détail du suivi : ${inspectedItem.record.refRecos}`}
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-[1px]"
          onClick={() => setInspectedNodeId(null)}
        >
          <div
            className="flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <RecoInfoManagerPanel
              node={inspectedItem.node}
              record={inspectedItem.record}
              isLocked={
                isNodeLockedOrWithinLockedAncestor(trees, inspectedItem.node.id) ||
                Boolean(inspectedItem.node.locked)
              }
              trees={trees}
              initialView={inspectedInitialView}
              onClose={() => setInspectedNodeId(null)}
              onSelectRecoNode={(id) => setInspectedNodeId(id)}
              onUpdateRecoMeta={onUpdateRecoMeta}
              onToggleManagerReview={onToggleManagerReview}
              onSetNodeStatus={onSetNodeStatus}
              onAddReviewNote={onAddReviewNote}
              onToggleReviewNote={onToggleReviewNote}
              onDeleteReviewNote={onDeleteReviewNote}
              onOpenWordDoc={(n) => {
                setInspectedNodeId(null);
                onOpenWordDoc(n);
              }}
              onIntegrateCollection={(col) => {
                setInspectedNodeId(null);
                onIntegrateCollection(col);
              }}
              onExpandBranch={(n) => {
                setInspectedNodeId(null);
                onOpenNodeInWorkflow(n.id);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
