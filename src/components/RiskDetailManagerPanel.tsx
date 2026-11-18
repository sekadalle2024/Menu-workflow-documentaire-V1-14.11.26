import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRightLeft,
  ArrowUpDown,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Copy,
  CopyPlus,
  FileText,
  Filter,
  FolderKanban,
  Gauge,
  GitBranch,
  Hash,
  Layers,
  ListPlus,
  ListTree,
  Plus,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  SquarePen,
  Tag,
  Trash2,
  TrendingUp,
  UserCheck,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import {
  buildFormattedRiskRefForNode,
  extractRisksFromTrees,
  formatRiskNodeTitle,
  LiveRiskEntry,
  RISK_MANAGEMENT_COLUMNS,
  RiskDirectionDestination,
  sortRiskEntries,
} from '../data/riskManagementData';
import {
  RiskCustomRubrique,
  RiskManagementMetadata,
  RiskSortDirection,
  RiskSortField,
  WorkflowTreeNode,
} from '../types/workflow';

export type RiskDetailPanelMode =
  | 'detail'
  | 'blank-new'
  | 'edit-all'
  | 'transfer'
  | 'add-rubrique'
  | 'filter'
  | 'sort';

interface RiskDetailManagerPanelProps {
  node: WorkflowTreeNode;
  record: RiskManagementMetadata;
  isLocked: boolean;
  trees?: WorkflowTreeNode[];
  scopeNodeId?: string;
  initialMode?: RiskDetailPanelMode;
  modeNonce?: number;
  actionBanner?: string | null;
  customRubriques?: RiskCustomRubrique[];
  directionOptions?: RiskDirectionDestination[];
  onClose: () => void;
  onSelectRiskNode?: (nodeId: string) => void;
  onUpdateRiskMeta?: (
    riskNodeId: string,
    patch: Partial<RiskManagementMetadata>
  ) => void;
  onAddRisk?: () => void;
  onDeleteRisk?: (riskNodeId: string) => void;
  onDuplicateRisk?: (riskNodeId: string) => void;
  onTransferRisk?: (
    riskNodeId: string,
    destinationDirectionNodeId: string
  ) => void;
  onAddCustomRubrique?: (input: {
    label: string;
    multiline?: boolean;
    initialValueForCurrent?: string;
    riskNodeId: string;
  }) => void;
  onSortRisks?: (
    field: RiskSortField,
    direction: RiskSortDirection,
    scopeNodeId?: string
  ) => void;
}

const COLUMN_ICONS: Record<
  Exclude<keyof RiskManagementMetadata, 'customFields'>,
  React.ComponentType<{ className?: string }>
> = {
  no: Hash,
  cycle: GitBranch,
  processus: Workflow,
  direction: Building2,
  operationnel: UserCheck,
  refRisque: Tag,
  risque: ShieldAlert,
  probabilite: Gauge,
  impact: AlertTriangle,
  evaluationRisque: TrendingUp,
  planAction: ClipboardList,
  controleNiveau1: Shield,
  controleNiveau2: ShieldCheck,
  controleNiveau3: ClipboardCheck,
  causes: Search,
  consequences: AlertOctagon,
  facteursRisque: Sliders,
  facteurDeclencheur: Zap,
  familleBale: Layers,
  ligneMetierBale: Briefcase,
  categorieBale: FolderKanban,
  sousCategorieBale: ListTree,
  natureRisque: FileText,
};

const LEVEL_OPTIONS = ['Faible', 'Moyen', 'Élevé', 'Critique'];

const SORT_FIELD_LABELS: Record<RiskSortField, string> = {
  no: 'N° séquentiel',
  refRisque: 'Réf. risque',
  risque: 'Intitulé du risque',
  evaluationRisque: 'Évaluation du risque',
  probabilite: 'Probabilité',
  impact: 'Impact',
  cycle: 'Cycle',
  direction: 'Direction',
};

function renderLevelBadgeClass(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return 'border-slate-200 bg-slate-50 text-slate-400';
  if (v.includes('critique') || v.includes('élevé') || v.includes('eleve')) {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (v.includes('moyen')) {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  if (v.includes('faible')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

export const RiskDetailManagerPanel: React.FC<RiskDetailManagerPanelProps> = ({
  node,
  record,
  isLocked,
  trees,
  scopeNodeId,
  initialMode = 'detail',
  modeNonce = 0,
  actionBanner,
  customRubriques = [],
  directionOptions = [],
  onClose,
  onSelectRiskNode,
  onUpdateRiskMeta,
  onAddRisk,
  onDeleteRisk,
  onDuplicateRisk,
  onTransferRisk,
  onAddCustomRubrique,
  onSortRisks,
}) => {
  const [panelMode, setPanelMode] = useState<RiskDetailPanelMode>(initialMode);
  const [expandedAccordionIds, setExpandedAccordionIds] = useState<Set<string>>(
    () => new Set(['risque', 'evaluationRisque', 'planAction'])
  );
  const [activeAccordionId, setActiveAccordionId] = useState<string>('risque');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>('');
  const [copiedRow, setCopiedRow] = useState(false);

  // Édition globale ("Modifier données risque")
  const [bulkDraft, setBulkDraft] = useState<Record<string, string>>({});
  const [bulkCustomDraft, setBulkCustomDraft] = useState<Record<string, string>>({});

  // Ajouter Rubrique (globale à tous les risques)
  const [newRubriqueLabel, setNewRubriqueLabel] = useState('');
  const [newRubriqueMultiline, setNewRubriqueMultiline] = useState(true);
  const [newRubriqueValue, setNewRubriqueValue] = useState('');

  // Transférer risque
  const [transferSearch, setTransferSearch] = useState('');
  const [selectedTransferDestId, setSelectedTransferDestId] = useState('');

  // Filtrer risque
  const [filterText, setFilterText] = useState('');
  const [filterCycle, setFilterCycle] = useState('all');
  const [filterDirection, setFilterDirection] = useState('all');
  const [filterEval, setFilterEval] = useState('all');
  const [filterProb, setFilterProb] = useState('all');
  const [filterImpact, setFilterImpact] = useState('all');

  // Trier risques
  const [sortField, setSortField] = useState<RiskSortField>('no');
  const [sortDir, setSortDir] = useState<RiskSortDirection>('asc');
  const [sortApplied, setSortApplied] = useState(false);

  const allTabIds = useMemo(
    () => [
      ...RISK_MANAGEMENT_COLUMNS.map((col) => String(col.key)),
      ...customRubriques.map((r) => `custom:${r.key}`),
    ],
    [customRubriques]
  );

  // Synchroniser le mode demandé depuis le menu contextuel
  useEffect(() => {
    setPanelMode(initialMode);
    setEditingFieldId(null);

    if (initialMode === 'blank-new') {
      setExpandedAccordionIds(
        new Set(['refRisque', 'risque', 'cycle', 'processus', 'direction', 'evaluationRisque', 'planAction'])
      );
      const nextBulk: Record<string, string> = {};
      RISK_MANAGEMENT_COLUMNS.forEach((col) => {
        nextBulk[String(col.key)] = String(record[col.key] ?? '');
      });
      const nextCustom: Record<string, string> = {};
      customRubriques.forEach((rub) => {
        nextCustom[rub.key] = record.customFields?.[rub.key] ?? '';
      });
      setBulkDraft(nextBulk);
      setBulkCustomDraft(nextCustom);
    } else if (initialMode === 'edit-all') {
      const nextBulk: Record<string, string> = {};
      RISK_MANAGEMENT_COLUMNS.forEach((col) => {
        nextBulk[String(col.key)] = String(record[col.key] ?? '');
      });
      const nextCustom: Record<string, string> = {};
      customRubriques.forEach((rub) => {
        nextCustom[rub.key] = record.customFields?.[rub.key] ?? '';
      });
      setBulkDraft(nextBulk);
      setBulkCustomDraft(nextCustom);
      setExpandedAccordionIds(new Set(allTabIds));
    } else if (initialMode === 'transfer') {
      setExpandedAccordionIds(new Set(['cycle', 'processus', 'direction', 'risque']));
    }
  }, [initialMode, modeNonce, node.id]);

  // Lorsqu'une nouvelle rubrique globale est ajoutée, l'étendre automatiquement sur le détail
  useEffect(() => {
    if (customRubriques.length > 0) {
      const latest = customRubriques[customRubriques.length - 1];
      setExpandedAccordionIds((prev) => {
        const next = new Set(prev);
        next.add(`custom:${latest.key}`);
        return next;
      });
      setActiveAccordionId(`custom:${latest.key}`);
    }
  }, [customRubriques.length]);

  useEffect(() => {
    if (!selectedTransferDestId && directionOptions.length > 0) {
      const different = directionOptions.find(
        (d) =>
          d.direction !== record.direction ||
          d.processus !== record.processus ||
          d.cycle !== record.cycle
      );
      setSelectedTransferDestId((different ?? directionOptions[0]).id);
    }
  }, [directionOptions, record.cycle, record.direction, record.processus, selectedTransferDestId]);

  const liveEntries: LiveRiskEntry[] = useMemo(() => {
    if (!trees || trees.length === 0) return [];
    const scoped = extractRisksFromTrees(trees, scopeNodeId);
    if (scoped.some((e) => e.node.id === node.id)) return scoped;
    return extractRisksFromTrees(trees);
  }, [trees, scopeNodeId, node.id]);

  const filterFacetOptions = useMemo(() => {
    const cycles = new Set<string>();
    const dirs = new Set<string>();
    const evals = new Set<string>();
    const probs = new Set<string>();
    const impacts = new Set<string>();
    liveEntries.forEach(({ record: r }) => {
      if (r.cycle.trim()) cycles.add(r.cycle.trim());
      if (r.direction.trim()) dirs.add(r.direction.trim());
      if (r.evaluationRisque.trim()) evals.add(r.evaluationRisque.trim());
      if (r.probabilite.trim()) probs.add(r.probabilite.trim());
      if (r.impact.trim()) impacts.add(r.impact.trim());
    });
    return {
      cycles: Array.from(cycles),
      dirs: Array.from(dirs).sort(),
      evals: Array.from(evals),
      probs: Array.from(probs),
      impacts: Array.from(impacts),
    };
  }, [liveEntries]);

  const filteredAndSortedEntries = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const filtered = liveEntries.filter(({ record: r }) => {
      if (filterCycle !== 'all' && r.cycle.trim() !== filterCycle) return false;
      if (filterDirection !== 'all' && r.direction.trim() !== filterDirection) return false;
      if (filterEval !== 'all' && r.evaluationRisque.trim() !== filterEval) return false;
      if (filterProb !== 'all' && r.probabilite.trim() !== filterProb) return false;
      if (filterImpact !== 'all' && r.impact.trim() !== filterImpact) return false;
      if (!q) return true;
      return (
        r.refRisque.toLowerCase().includes(q) ||
        r.risque.toLowerCase().includes(q) ||
        r.cycle.toLowerCase().includes(q) ||
        r.processus.toLowerCase().includes(q) ||
        r.direction.toLowerCase().includes(q) ||
        r.operationnel.toLowerCase().includes(q) ||
        r.planAction.toLowerCase().includes(q) ||
        r.causes.toLowerCase().includes(q) ||
        r.natureRisque.toLowerCase().includes(q) ||
        String(r.no).includes(q)
      );
    });

    if (sortApplied || panelMode === 'sort') {
      return sortRiskEntries(filtered, sortField, sortDir);
    }
    return filtered;
  }, [
    liveEntries,
    filterText,
    filterCycle,
    filterDirection,
    filterEval,
    filterProb,
    filterImpact,
    sortApplied,
    panelMode,
    sortField,
    sortDir,
  ]);

  const hasActiveFilter =
    filterText.trim().length > 0 ||
    filterCycle !== 'all' ||
    filterDirection !== 'all' ||
    filterEval !== 'all' ||
    filterProb !== 'all' ||
    filterImpact !== 'all';

  const filteredTransferDestinations = useMemo(() => {
    const q = transferSearch.trim().toLowerCase();
    if (!q) return directionOptions;
    return directionOptions.filter(
      (d) =>
        d.direction.toLowerCase().includes(q) ||
        d.processus.toLowerCase().includes(q) ||
        d.cycle.toLowerCase().includes(q) ||
        d.rootLabel.toLowerCase().includes(q)
    );
  }, [directionOptions, transferSearch]);

  const toggleAccordionTab = (tabId: string) => {
    setActiveAccordionId(tabId);
    setExpandedAccordionIds((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) next.delete(tabId);
      else next.add(tabId);
      return next;
    });
  };

  const startEditingBaseColumn = (colKey: keyof RiskManagementMetadata) => {
    if (colKey === 'customFields') return;
    setEditDraft(String(record[colKey] ?? ''));
    setActiveAccordionId(colKey);
    setExpandedAccordionIds((prev) => {
      const next = new Set(prev);
      next.add(colKey);
      return next;
    });
    setEditingFieldId((prev) => (prev === colKey ? null : colKey));
  };

  const startEditingCustomRubrique = (rubrique: RiskCustomRubrique) => {
    const fieldId = `custom:${rubrique.key}`;
    setEditDraft(record.customFields?.[rubrique.key] ?? '');
    setActiveAccordionId(fieldId);
    setExpandedAccordionIds((prev) => {
      const next = new Set(prev);
      next.add(fieldId);
      return next;
    });
    setEditingFieldId((prev) => (prev === fieldId ? null : fieldId));
  };

  const handleSaveBaseColumn = (
    e: React.FormEvent,
    colKey: keyof RiskManagementMetadata
  ) => {
    e.preventDefault();
    if (!onUpdateRiskMeta || colKey === 'customFields') return;
    if (colKey === 'no') {
      const parsed = Number.parseInt(editDraft, 10);
      onUpdateRiskMeta(node.id, {
        no: Number.isFinite(parsed) && parsed > 0 ? parsed : record.no,
      });
    } else {
      onUpdateRiskMeta(node.id, {
        [colKey]: editDraft.trim(),
      } as Partial<RiskManagementMetadata>);
    }
    setEditingFieldId(null);
  };

  const handleSaveCustomRubriqueValue = (
    e: React.FormEvent,
    rubrique: RiskCustomRubrique
  ) => {
    e.preventDefault();
    if (!onUpdateRiskMeta) return;
    onUpdateRiskMeta(node.id, {
      customFields: {
        ...(record.customFields || {}),
        [rubrique.key]: editDraft.trim(),
      },
    });
    setEditingFieldId(null);
  };

  const handleSaveBulkEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateRiskMeta) return;
    const nextPatch: Partial<RiskManagementMetadata> = {
      customFields: {
        ...(record.customFields || {}),
        ...bulkCustomDraft,
      },
    };
    RISK_MANAGEMENT_COLUMNS.forEach((col) => {
      const raw = bulkDraft[String(col.key)] ?? '';
      if (col.key === 'no') {
        const n = Number.parseInt(raw, 10);
        nextPatch.no = Number.isFinite(n) && n > 0 ? n : record.no;
      } else if (col.key !== 'customFields') {
        (nextPatch as Record<string, unknown>)[String(col.key)] = raw.trim();
      }
    });
    if (
      (!nextPatch.refRisque || !nextPatch.refRisque.trim()) &&
      nextPatch.direction?.trim()
    ) {
      nextPatch.refRisque = buildFormattedRiskRefForNode(
        trees || [],
        nextPatch.direction,
        record.refRisque,
        '2026'
      );
    }
    onUpdateRiskMeta(node.id, nextPatch);
    setPanelMode('detail');
  };

  const handleCopyMarkdownRow = async () => {
    const allCols = [
      ...RISK_MANAGEMENT_COLUMNS.map((c) => ({
        header: c.header,
        val: String(record[c.key] ?? ''),
      })),
      ...customRubriques.map((r) => ({
        header: r.header,
        val: record.customFields?.[r.key] ?? '',
      })),
    ];
    const headerRow = `| ${allCols.map((c) => c.header).join(' | ')} |`;
    const sepRow = `| ${allCols.map(() => '---').join(' | ')} |`;
    const valRow = `| ${allCols
      .map((c) => c.val.replace(/\|/g, '/'))
      .join(' | ')} |`;
    try {
      await navigator.clipboard.writeText(`${headerRow}\n${sepRow}\n${valRow}`);
      setCopiedRow(true);
      window.setTimeout(() => setCopiedRow(false), 1800);
    } catch {
      setCopiedRow(false);
    }
  };

  const enterBulkEditMode = () => {
    const nextBulk: Record<string, string> = {};
    RISK_MANAGEMENT_COLUMNS.forEach((col) => {
      nextBulk[String(col.key)] = String(record[col.key] ?? '');
    });
    const nextCustom: Record<string, string> = {};
    customRubriques.forEach((rub) => {
      nextCustom[rub.key] = record.customFields?.[rub.key] ?? '';
    });
    setBulkDraft(nextBulk);
    setBulkCustomDraft(nextCustom);
    setPanelMode('edit-all');
  };

  const isBlankRecord =
    !record.refRisque.trim() && !record.risque.trim() && !record.cycle.trim();

  return (
    <section
      aria-label={`Détail du risque : ${record.refRisque || `#${record.no}`}`}
      className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-slate-700 bg-slate-50 text-slate-900 lg:border-b-0 lg:border-r lg:border-slate-800"
    >
      {/* En-tête blanc sobre */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3 text-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500">
              Workflow Risk management · Exercice 2026
              {record.cycle ? ` · ${record.cycle}` : ''}
              {record.direction ? ` · ${record.direction}` : ''}
            </div>
            <h2 className="mt-0.5 truncate text-base font-semibold text-slate-900">
              {panelMode === 'blank-new' || isBlankRecord
                ? `Nouveau risque #${record.no} — Page de détail vierge`
                : `Détail du risque — ${formatRiskNodeTitle(record)}`}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyMarkdownRow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap cursor-pointer"
            >
              {copiedRow ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Copié</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <span>Copier</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer le détail du risque"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Barre d'actions Risk management synchronisée avec le menu contextuel */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
          {!isLocked && onAddRisk && (
            <button
              type="button"
              onClick={onAddRisk}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                panelMode === 'blank-new'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Plus className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>Ajouter risque</span>
            </button>
          )}

          {!isLocked && onDuplicateRisk && (
            <button
              type="button"
              onClick={() => onDuplicateRisk(node.id)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              <CopyPlus className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
              <span>Dupliquer</span>
            </button>
          )}

          {!isLocked && onTransferRisk && (
            <button
              type="button"
              onClick={() =>
                setPanelMode((prev) => (prev === 'transfer' ? 'detail' : 'transfer'))
              }
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                panelMode === 'transfer'
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
              <span>Transférer</span>
            </button>
          )}

          {!isLocked && onUpdateRiskMeta && (
            <button
              type="button"
              onClick={() =>
                panelMode === 'edit-all' ? setPanelMode('detail') : enterBulkEditMode()
              }
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                panelMode === 'edit-all'
                  ? 'border-blue-700 bg-blue-700 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SquarePen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {panelMode === 'edit-all' ? 'Fermer édition globale' : 'Modifier données risque'}
              </span>
            </button>
          )}

          {!isLocked && onAddCustomRubrique && (
            <button
              type="button"
              onClick={() =>
                setPanelMode((prev) => (prev === 'add-rubrique' ? 'detail' : 'add-rubrique'))
              }
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                panelMode === 'add-rubrique'
                  ? 'border-violet-600 bg-violet-50 text-violet-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ListPlus className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" />
              <span>Ajouter Rubrique</span>
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              setPanelMode((prev) => (prev === 'filter' ? 'detail' : 'filter'))
            }
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              panelMode === 'filter' || hasActiveFilter
                ? 'border-amber-600 bg-amber-50 text-amber-800'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
            <span>
              Filtrer
              {hasActiveFilter ? ` (${filteredAndSortedEntries.length})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setPanelMode((prev) => (prev === 'sort' ? 'detail' : 'sort'))
            }
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              panelMode === 'sort' || sortApplied
                ? 'border-sky-600 bg-sky-50 text-sky-800'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
            <span>Trier</span>
          </button>

          {!isLocked && onDeleteRisk && (
            <button
              type="button"
              onClick={() => onDeleteRisk(node.id)}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Supprimer risque</span>
            </button>
          )}
        </div>
      </div>

      {/* Corps scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
        {actionBanner && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-900">
            {actionBanner}
          </div>
        )}

        {(panelMode === 'blank-new' || isBlankRecord) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
            <span>
              Nouvelle fiche risque #{record.no} créée à vide — renseignez les rubriques souhaitées ci-dessous.
            </span>
            {!isLocked && onUpdateRiskMeta && panelMode !== 'edit-all' && (
              <button
                type="button"
                onClick={enterBulkEditMode}
                className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800 cursor-pointer"
              >
                Tout saisir en une fois
              </button>
            )}
          </div>
        )}

        {/* Mode Ajouter Rubrique (ajout global pour ce risque et tous les autres risques) */}
        {panelMode === 'add-rubrique' && onAddCustomRubrique && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newRubriqueLabel.trim()) return;
              onAddCustomRubrique({
                label: newRubriqueLabel.trim(),
                multiline: newRubriqueMultiline,
                initialValueForCurrent: newRubriqueValue.trim(),
                riskNodeId: node.id,
              });
              setNewRubriqueLabel('');
              setNewRubriqueValue('');
              setPanelMode('detail');
            }}
            className="rounded-xl border border-violet-200 bg-white p-4 space-y-3 shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Ajouter une rubrique globale (tous les risques)
                </h3>
                <p className="text-xs text-slate-500">
                  La nouvelle rubrique sera ajoutée immédiatement au détail de ce risque ainsi qu&apos;à l&apos;ensemble des autres risques.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanelMode('detail')}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-slate-700">
                  Intitulé de la rubrique *
                </span>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newRubriqueLabel}
                  onChange={(e) => setNewRubriqueLabel(e.target.value)}
                  placeholder="Ex. Score résiduel, Commentaire Comité Risques..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-violet-600 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-700">Format de saisie</span>
                <select
                  value={newRubriqueMultiline ? 'multiline' : 'short'}
                  onChange={(e) => setNewRubriqueMultiline(e.target.value === 'multiline')}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                >
                  <option value="multiline">Texte détaillé (multiligne)</option>
                  <option value="short">Texte court (1 ligne)</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">
                Valeur pour le risque en cours (optionnel)
              </span>
              <input
                type="text"
                value={newRubriqueValue}
                onChange={(e) => setNewRubriqueValue(e.target.value)}
                placeholder="Saisissez une valeur initiale pour ce risque..."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-violet-600 focus:outline-none"
              />
            </label>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="rounded-lg bg-violet-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-violet-800 cursor-pointer"
              >
                Ajouter la rubrique à tous les risques
              </button>
              <button
                type="button"
                onClick={() => setPanelMode('detail')}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {/* Mode Transférer risque */}
        {panelMode === 'transfer' && onTransferRisk && (
          <div className="rounded-xl border border-blue-200 bg-white p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Transférer ce risque vers un autre Cycle / Processus / Direction
                </h3>
                <p className="text-xs text-slate-500">
                  Emplacement actuel : {record.cycle || '—'} → {record.processus || '—'} → {record.direction || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanelMode('detail')}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-medium text-slate-600">
                  Rechercher une destination
                </span>
                <input
                  type="text"
                  value={transferSearch}
                  onChange={(e) => setTransferSearch(e.target.value)}
                  placeholder="Filtrer par Cycle, Processus ou Direction..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-medium text-slate-600">
                  Destination cible ({filteredTransferDestinations.length})
                </span>
                <select
                  value={selectedTransferDestId}
                  onChange={(e) => setSelectedTransferDestId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                >
                  {filteredTransferDestinations.map((dest) => (
                    <option key={dest.id} value={dest.id}>
                      [{dest.rootLabel}] {dest.cycle} → {dest.processus} → {dest.direction} ({dest.riskCount})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!selectedTransferDestId}
                onClick={() => {
                  if (!selectedTransferDestId) return;
                  onTransferRisk(node.id, selectedTransferDestId);
                  setPanelMode('detail');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-40 cursor-pointer"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Confirmer le transfert du risque</span>
              </button>
              <button
                type="button"
                onClick={() => setPanelMode('detail')}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Mode Filtrer risque */}
        {panelMode === 'filter' && (
          <div className="rounded-xl border border-amber-200 bg-white p-4 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Filtrer les risques ({filteredAndSortedEntries.length} / {liveEntries.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Filtrez la cartographie puis sélectionnez un résultat pour actualiser la vue détail.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterText('');
                      setFilterCycle('all');
                      setFilterDirection('all');
                      setFilterEval('all');
                      setFilterProb('all');
                      setFilterImpact('all');
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    <span>Réinitialiser</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPanelMode('detail')}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Mot-clé, Réf, N°..."
                className="sm:col-span-2 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900"
              />
              <select
                value={filterCycle}
                onChange={(e) => setFilterCycle(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800"
              >
                <option value="all">Tous cycles</option>
                {filterFacetOptions.cycles.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={filterDirection}
                onChange={(e) => setFilterDirection(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800"
              >
                <option value="all">Toutes directions</option>
                {filterFacetOptions.dirs.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={filterEval}
                onChange={(e) => setFilterEval(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800"
              >
                <option value="all">Évaluation : toutes</option>
                {filterFacetOptions.evals.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={filterProb}
                onChange={(e) => setFilterProb(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800"
              >
                <option value="all">Probabilité : toutes</option>
                {filterFacetOptions.probs.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {filteredAndSortedEntries.slice(0, 60).map((entry) => {
                const isSelected = entry.node.id === node.id;
                return (
                  <button
                    key={entry.node.id}
                    type="button"
                    onClick={() => onSelectRiskNode?.(entry.node.id)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50 text-blue-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="truncate">
                      <span className="font-mono text-slate-500 mr-2">#{entry.record.no}</span>
                      {formatRiskNodeTitle(entry.record)}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {entry.record.direction && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                          {entry.record.direction}
                        </span>
                      )}
                      {entry.record.evaluationRisque && (
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${renderLevelBadgeClass(
                            entry.record.evaluationRisque
                          )}`}
                        >
                          {entry.record.evaluationRisque}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              {filteredAndSortedEntries.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-slate-500">
                  Aucun risque ne correspond à ces critères.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mode Trier Risques */}
        {panelMode === 'sort' && (
          <div className="rounded-xl border border-sky-200 bg-white p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Trier les risques (Détail &amp; TreeView)
                </h3>
                <p className="text-xs text-slate-500">
                  Choisissez le critère de tri et appliquez-le à la liste des risques et à l&apos;arborescence.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanelMode('detail')}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Fermer
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="block min-w-[200px] flex-1">
                <span className="text-[11px] font-medium text-slate-600">Critère de tri</span>
                <select
                  value={sortField}
                  onChange={(e) => {
                    const nextField = e.target.value as RiskSortField;
                    setSortField(nextField);
                    setSortApplied(true);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                >
                  {(Object.keys(SORT_FIELD_LABELS) as RiskSortField[]).map((k) => (
                    <option key={k} value={k}>
                      {SORT_FIELD_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block min-w-[180px]">
                <span className="text-[11px] font-medium text-slate-600">Ordre</span>
                <select
                  value={sortDir}
                  onChange={(e) => {
                    const nextDir = e.target.value as RiskSortDirection;
                    setSortDir(nextDir);
                    setSortApplied(true);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                >
                  <option value="asc">Croissant (1→N / A→Z / Faible→Critique)</option>
                  <option value="desc">Décroissant (N→1 / Z→A / Critique→Faible)</option>
                </select>
              </label>

              {onSortRisks && (
                <button
                  type="button"
                  onClick={() => {
                    setSortApplied(true);
                    onSortRisks(sortField, sortDir, scopeNodeId);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-sky-800 cursor-pointer"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Appliquer le tri dans l&apos;arborescence</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Barre de sélection du risque + Tout déplier / Tout replier */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0 flex-1">
            <label className="text-xs font-medium text-slate-600 shrink-0">
              Risque ({filteredAndSortedEntries.length || 1}) :
            </label>
            {filteredAndSortedEntries.length > 0 && onSelectRiskNode ? (
              <select
                value={node.id}
                onChange={(e) => onSelectRiskNode(e.target.value)}
                aria-label="Sélectionner un risque"
                className="min-w-0 max-w-lg flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-900"
              >
                {!filteredAndSortedEntries.some((e) => e.node.id === node.id) && (
                  <option value={node.id}>
                    #{record.no} · {formatRiskNodeTitle(record)}
                  </option>
                )}
                {filteredAndSortedEntries.map((entry) => (
                  <option key={entry.node.id} value={entry.node.id}>
                    #{entry.record.no} · {formatRiskNodeTitle(entry.record)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="truncate text-xs font-medium text-slate-900">
                #{record.no} · {formatRiskNodeTitle(record)}
              </span>
            )}
          </div>

          {panelMode !== 'edit-all' && (
            <button
              type="button"
              onClick={() =>
                setExpandedAccordionIds((prev) =>
                  prev.size >= allTabIds.length ? new Set() : new Set(allTabIds)
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0"
            >
              {expandedAccordionIds.size >= allTabIds.length
                ? 'Tout replier'
                : 'Tout déplier'}
            </button>
          )}
        </div>

        {/* Mode "Modifier données risque" : édition groupée de toutes les rubriques */}
        {panelMode === 'edit-all' && !isLocked && onUpdateRiskMeta ? (
          <form
            onSubmit={handleSaveBulkEdit}
            className="rounded-xl border border-blue-200 bg-white p-4 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Modification complète des données du risque ({allTabIds.length} rubriques)
                </h3>
                <p className="text-xs text-slate-500">
                  Modifiez librement l&apos;ensemble des colonnes puis cliquez sur Enregistrer.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
                >
                  Enregistrer toutes les modifications
                </button>
                <button
                  type="button"
                  onClick={() => setPanelMode('detail')}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {RISK_MANAGEMENT_COLUMNS.map((col) => {
                const k = String(col.key);
                const val = bulkDraft[k] ?? '';
                return (
                  <label
                    key={k}
                    className={`block ${col.multiline ? 'md:col-span-2' : ''}`}
                  >
                    <span className="text-xs font-medium text-slate-700">
                      {col.label}
                    </span>
                    {col.levelBadge ? (
                      <select
                        value={val}
                        onChange={(e) =>
                          setBulkDraft((prev) => ({ ...prev, [k]: e.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                      >
                        <option value="">— Non renseigné —</option>
                        {LEVEL_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                        {!LEVEL_OPTIONS.includes(val) && val && (
                          <option value={val}>{val}</option>
                        )}
                      </select>
                    ) : col.multiline ? (
                      <textarea
                        rows={2}
                        value={val}
                        onChange={(e) =>
                          setBulkDraft((prev) => ({ ...prev, [k]: e.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    ) : (
                      <div className="mt-1 flex items-center gap-1.5">
                        <input
                          type={col.key === 'no' ? 'number' : 'text'}
                          min={col.key === 'no' ? 1 : undefined}
                          value={val}
                          placeholder={
                            col.key === 'refRisque'
                              ? 'Risk-<Direction>-<Numéro>-<Année>'
                              : undefined
                          }
                          onChange={(e) =>
                            setBulkDraft((prev) => ({ ...prev, [k]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                        {col.key === 'refRisque' && (
                          <button
                            type="button"
                            onClick={() => {
                              const dir = (bulkDraft.direction || record.direction || '').trim();
                              if (!dir) return;
                              const generated = buildFormattedRiskRefForNode(
                                trees || [],
                                dir,
                                val || record.refRisque,
                                '2026'
                              );
                              setBulkDraft((prev) => ({ ...prev, refRisque: generated }));
                            }}
                            disabled={!(bulkDraft.direction || record.direction || '').trim()}
                            title="Générer Risk-<Direction>-<Numéro>-<Année>"
                            className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40 cursor-pointer"
                          >
                            Générer
                          </button>
                        )}
                      </div>
                    )}
                  </label>
                );
              })}

              {customRubriques.map((rub, idx) => {
                const val = bulkCustomDraft[rub.key] ?? '';
                return (
                  <label
                    key={rub.id}
                    className={`block ${rub.multiline ? 'md:col-span-2' : ''}`}
                  >
                    <span className="text-xs font-medium text-violet-800">
                      {24 + idx}. {rub.label} (Rubrique globale)
                    </span>
                    {rub.multiline ? (
                      <textarea
                        rows={2}
                        value={val}
                        onChange={(e) =>
                          setBulkCustomDraft((prev) => ({
                            ...prev,
                            [rub.key]: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-violet-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-violet-600 focus:outline-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={val}
                        onChange={(e) =>
                          setBulkCustomDraft((prev) => ({
                            ...prev,
                            [rub.key]: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-violet-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-violet-600 focus:outline-none"
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </form>
        ) : (
          /* Menu accordéon complet : 23 colonnes de base + rubriques globales ajoutées */
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2.5 space-y-1">
            {RISK_MANAGEMENT_COLUMNS.map((col) => {
              const Icon =
                col.key !== 'customFields' ? COLUMN_ICONS[col.key] || FileText : FileText;
              const colId = String(col.key);
              const isTabExpanded = expandedAccordionIds.has(colId);
              const isTabHighlighted =
                activeAccordionId === colId || editingFieldId === colId;
              const isEditing = editingFieldId === colId;
              const rawValue = String(record[col.key] ?? '');

              return (
                <div key={colId} className="rounded-lg">
                  <div
                    className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors ${
                      isTabHighlighted ? 'bg-blue-50/75' : 'hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleAccordionTab(colId)}
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
                        {col.label}
                      </span>
                      {!isTabExpanded && rawValue && (
                        <span
                          className={
                            col.levelBadge
                              ? `ml-2 shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${renderLevelBadgeClass(
                                  rawValue
                                )}`
                              : 'ml-2 hidden truncate text-xs text-slate-400 sm:inline'
                          }
                        >
                          {rawValue}
                        </span>
                      )}
                    </button>

                    {!isLocked && onUpdateRiskMeta && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingBaseColumn(col.key);
                        }}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap cursor-pointer"
                      >
                        <SquarePen className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        <span>Modifier</span>
                      </button>
                    )}
                  </div>

                  {isTabExpanded && (
                    <div className="ml-6 border-l border-slate-200 pl-6 pr-3 py-2.5 my-1">
                      {isEditing ? (
                        <form
                          onSubmit={(e) => handleSaveBaseColumn(e, col.key)}
                          className="space-y-2.5 text-xs"
                        >
                          <label className="block">
                            <span className="text-[11px] text-slate-500">
                              {col.header}
                            </span>
                            {col.levelBadge ? (
                              <select
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                className="mt-0.5 w-full max-w-xs rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                              >
                                <option value="">— Sélectionner —</option>
                                {LEVEL_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                                {!LEVEL_OPTIONS.includes(editDraft) && editDraft && (
                                  <option value={editDraft}>{editDraft}</option>
                                )}
                              </select>
                            ) : col.multiline ? (
                              <textarea
                                rows={3}
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                              />
                            ) : (
                              <div className="mt-0.5 flex items-center gap-2">
                                <input
                                  type={col.key === 'no' ? 'number' : 'text'}
                                  min={col.key === 'no' ? 1 : undefined}
                                  value={editDraft}
                                  placeholder={
                                    col.key === 'refRisque'
                                      ? 'Risk-<Direction>-<Numéro>-<Année>'
                                      : undefined
                                  }
                                  onChange={(e) => setEditDraft(e.target.value)}
                                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                                />
                                {col.key === 'refRisque' && record.direction.trim() && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditDraft(
                                        buildFormattedRiskRefForNode(
                                          trees || [],
                                          record.direction,
                                          editDraft || record.refRisque,
                                          '2026'
                                        )
                                      )
                                    }
                                    className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 cursor-pointer"
                                  >
                                    Générer Risk-{record.direction}
                                  </button>
                                )}
                              </div>
                            )}
                          </label>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="submit"
                              className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
                            >
                              Enregistrer
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingFieldId(null)}
                              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        </form>
                      ) : col.levelBadge ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${renderLevelBadgeClass(
                              rawValue
                            )}`}
                          >
                            {rawValue || 'Non renseigné'}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Colonne source : {col.header}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1 text-[13px] leading-relaxed text-slate-800">
                          <div
                            className={
                              col.key === 'refRisque' || col.key === 'no'
                                ? 'font-mono font-medium text-slate-900'
                                : ''
                            }
                          >
                            {rawValue || (
                              <span className="italic text-slate-400">Non renseigné</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Colonne cartographie : {col.header}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Sections personnalisées ajoutées globalement ("Ajouter Rubrique") */}
            {customRubriques.map((rub, idx) => {
              const colId = `custom:${rub.key}`;
              const isTabExpanded = expandedAccordionIds.has(colId);
              const isTabHighlighted =
                activeAccordionId === colId || editingFieldId === colId;
              const isEditing = editingFieldId === colId;
              const rawValue = record.customFields?.[rub.key] ?? '';
              const numberedLabel = `${24 + idx}. ${rub.label}`;

              return (
                <div key={rub.id} className="rounded-lg">
                  <div
                    className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors ${
                      isTabHighlighted ? 'bg-violet-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleAccordionTab(colId)}
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
                      <ListPlus
                        className={`h-4 w-4 shrink-0 ${
                          isTabHighlighted ? 'text-violet-600' : 'text-violet-500'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm font-medium text-slate-800">
                        {numberedLabel}
                      </span>
                      <span className="shrink-0 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                        Rubrique ajoutée
                      </span>
                      {!isTabExpanded && rawValue && (
                        <span className="ml-2 hidden truncate text-xs text-slate-400 sm:inline">
                          {rawValue}
                        </span>
                      )}
                    </button>

                    {!isLocked && onUpdateRiskMeta && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingCustomRubrique(rub);
                        }}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap cursor-pointer"
                      >
                        <SquarePen className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        <span>Modifier</span>
                      </button>
                    )}
                  </div>

                  {isTabExpanded && (
                    <div className="ml-6 border-l border-violet-200 pl-6 pr-3 py-2.5 my-1">
                      {isEditing ? (
                        <form
                          onSubmit={(e) => handleSaveCustomRubriqueValue(e, rub)}
                          className="space-y-2.5 text-xs"
                        >
                          <label className="block">
                            <span className="text-[11px] text-slate-500">
                              {rub.label}
                            </span>
                            {rub.multiline ? (
                              <textarea
                                rows={3}
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-violet-600 focus:outline-none"
                              />
                            ) : (
                              <input
                                type="text"
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-violet-600 focus:outline-none"
                              />
                            )}
                          </label>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="submit"
                              className="rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800 cursor-pointer"
                            >
                              Enregistrer
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingFieldId(null)}
                              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="space-y-1 text-[13px] leading-relaxed text-slate-800">
                          <div>
                            {rawValue || (
                              <span className="italic text-slate-400">Non renseigné</span>
                            )}
                          </div>
                          <div className="text-[11px] text-violet-500">
                            Rubrique personnalisée globale (active sur tous les risques)
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
