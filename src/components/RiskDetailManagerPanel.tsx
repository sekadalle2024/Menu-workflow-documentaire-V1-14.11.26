import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Copy,
  FileText,
  FolderKanban,
  Gauge,
  GitBranch,
  Hash,
  Layers,
  ListTree,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  SquarePen,
  Tag,
  TrendingUp,
  UserCheck,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import {
  extractRisksFromTrees,
  formatRiskNodeTitle,
  LiveRiskEntry,
  RISK_MANAGEMENT_COLUMNS,
} from '../data/riskManagementData';
import { RiskManagementMetadata, WorkflowTreeNode } from '../types/workflow';

interface RiskDetailManagerPanelProps {
  node: WorkflowTreeNode;
  record: RiskManagementMetadata;
  isLocked: boolean;
  trees?: WorkflowTreeNode[];
  scopeNodeId?: string;
  onClose: () => void;
  onSelectRiskNode?: (nodeId: string) => void;
  onUpdateRiskMeta?: (
    riskNodeId: string,
    patch: Partial<RiskManagementMetadata>
  ) => void;
}

const COLUMN_ICONS: Record<
  keyof RiskManagementMetadata,
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

function renderLevelBadgeClass(value: string): string {
  const v = value.trim().toLowerCase();
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
  onClose,
  onSelectRiskNode,
  onUpdateRiskMeta,
}) => {
  const [expandedAccordionIds, setExpandedAccordionIds] = useState<Set<string>>(
    () => new Set(['risque', 'evaluationRisque', 'planAction'])
  );
  const [activeAccordionId, setActiveAccordionId] = useState<string>('risque');
  const [editingColumnKey, setEditingColumnKey] =
    useState<keyof RiskManagementMetadata | null>(null);
  const [editDraft, setEditDraft] = useState<string>('');
  const [copiedRow, setCopiedRow] = useState(false);

  useEffect(() => {
    setEditingColumnKey(null);
  }, [node.id]);

  const liveEntries: LiveRiskEntry[] = useMemo(() => {
    if (!trees || trees.length === 0) return [];
    const scoped = extractRisksFromTrees(trees, scopeNodeId);
    if (scoped.some((e) => e.node.id === node.id)) return scoped;
    return extractRisksFromTrees(trees);
  }, [trees, scopeNodeId, node.id]);

  const allTabIds = useMemo(
    () => RISK_MANAGEMENT_COLUMNS.map((col) => String(col.key)),
    []
  );

  const toggleAccordionTab = (colKey: string) => {
    setActiveAccordionId(colKey);
    setExpandedAccordionIds((prev) => {
      const next = new Set(prev);
      if (next.has(colKey)) next.delete(colKey);
      else next.add(colKey);
      return next;
    });
  };

  const startEditingColumn = (colKey: keyof RiskManagementMetadata) => {
    setEditDraft(String(record[colKey] ?? ''));
    setActiveAccordionId(colKey);
    setExpandedAccordionIds((prev) => {
      const next = new Set(prev);
      next.add(colKey);
      return next;
    });
    setEditingColumnKey((prev) => (prev === colKey ? null : colKey));
  };

  const handleSaveColumn = (
    e: React.FormEvent,
    colKey: keyof RiskManagementMetadata
  ) => {
    e.preventDefault();
    if (!onUpdateRiskMeta) return;
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
    setEditingColumnKey(null);
  };

  const handleCopyMarkdownRow = async () => {
    const headerRow = `| ${RISK_MANAGEMENT_COLUMNS.map((c) => c.header).join(' | ')} |`;
    const sepRow = `| ${RISK_MANAGEMENT_COLUMNS.map(() => '---').join(' | ')} |`;
    const valRow = `| ${RISK_MANAGEMENT_COLUMNS.map((c) =>
      String(record[c.key] ?? '').replace(/\|/g, '/')
    ).join(' | ')} |`;
    try {
      await navigator.clipboard.writeText(`${headerRow}\n${sepRow}\n${valRow}`);
      setCopiedRow(true);
      window.setTimeout(() => setCopiedRow(false), 1800);
    } catch {
      setCopiedRow(false);
    }
  };

  return (
    <section
      aria-label={`Détail du risque : ${record.refRisque}`}
      className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-slate-700 bg-slate-50 text-slate-900 lg:border-b-0 lg:border-r lg:border-slate-800"
    >
      {/* En-tête blanc sobre identique au Plan annuel d'audit / Suivi des recos */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3.5 text-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500">
              Workflow Risk management · Exercice 2026 · {record.cycle} · {record.direction}
            </div>
            <h2 className="mt-0.5 truncate text-base font-semibold text-slate-900">
              Détail du risque — {formatRiskNodeTitle(record)}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyMarkdownRow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap cursor-pointer"
            >
              {copiedRow ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Ligne copiée</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <span>Copier la ligne</span>
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
      </div>

      {/* Corps scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
        {/* Sélecteur de risque + bouton Tout déplier / Tout replier */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0 flex-1">
            <label className="text-xs font-medium text-slate-600 shrink-0">
              Risque ({liveEntries.length || 1}) :
            </label>
            {liveEntries.length > 0 && onSelectRiskNode ? (
              <select
                value={node.id}
                onChange={(e) => onSelectRiskNode(e.target.value)}
                aria-label="Sélectionner un risque"
                className="min-w-0 max-w-lg flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-900"
              >
                {liveEntries.map((entry) => (
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
        </div>

        {/* Menu accordéon complet : 23 menus déroulants (1 par colonne de [Workflow Risk management]) */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2.5 space-y-1">
          {RISK_MANAGEMENT_COLUMNS.map((col) => {
            const Icon = COLUMN_ICONS[col.key] || FileText;
            const colId = String(col.key);
            const isTabExpanded = expandedAccordionIds.has(colId);
            const isTabHighlighted =
              activeAccordionId === colId || editingColumnKey === col.key;
            const isEditing = editingColumnKey === col.key;
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
                        startEditingColumn(col.key);
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
                        onSubmit={(e) => handleSaveColumn(e, col.key)}
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
                            <input
                              type={col.key === 'no' ? 'number' : 'text'}
                              min={col.key === 'no' ? 1 : undefined}
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                            />
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
                            onClick={() => setEditingColumnKey(null)}
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
                          {rawValue || '—'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Colonne source : {col.header}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1 text-[13px] leading-relaxed text-slate-800">
                        <div className={col.key === 'refRisque' || col.key === 'no' ? 'font-mono font-medium text-slate-900' : ''}>
                          {rawValue || '—'}
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
        </div>
      </div>
    </section>
  );
};
