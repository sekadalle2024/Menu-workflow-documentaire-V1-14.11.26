import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  FileText,
  FolderKanban,
  Hash,
  Search,
  ShieldAlert,
  SquarePen,
  Table2,
  Target,
  TrendingUp,
  UserCheck,
  X,
} from 'lucide-react';
import {
  extractSuiviRecosFromTrees,
  LiveSuiviRecoEntry,
  SUIVI_RECOS_2024_DATA,
  SUIVI_RECOS_2025_DATA,
} from '../data/suiviRecosSimulation';
import {
  RecoSourceMetadata,
  WorkflowNodeStatus,
  WorkflowTreeNode,
} from '../types/workflow';

export type RecoPanelViewMode = 'accordeon' | 'source-file';
export type RecoSourceSubTab = 'ligne' | 'fichier';

interface RecoInfoManagerPanelProps {
  node: WorkflowTreeNode;
  record: RecoSourceMetadata;
  isLocked: boolean;
  trees?: WorkflowTreeNode[];
  scopeNodeId?: string;
  initialView?: RecoPanelViewMode;
  onClose: () => void;
  onSelectRecoNode?: (nodeId: string) => void;
  onUpdateRecoMeta?: (recoNodeId: string, patch: Partial<RecoSourceMetadata>) => void;
  onToggleManagerReview?: (nodeId: string) => void;
  onSetNodeStatus?: (status: WorkflowNodeStatus, nodeId: string) => void;
  onAddReviewNote?: (nodeId: string, text: string) => void;
  onToggleReviewNote?: (nodeId: string, noteId: string) => void;
  onDeleteReviewNote?: (nodeId: string, noteId: string) => void;
  onOpenWordDoc?: (node: WorkflowTreeNode) => void;
  onIntegrateCollection?: (collectionNode: WorkflowTreeNode) => void;
  onExpandBranch?: (node: WorkflowTreeNode) => void;
}

const SOURCE_COLUMNS: Array<{ header: string; key: keyof RecoSourceMetadata }> = [
  { header: 'no', key: 'no' },
  { header: 'Intitule', key: 'intitule' },
  { header: 'Observation', key: 'observation' },
  { header: 'Constat', key: 'constat' },
  { header: 'Risque', key: 'risque' },
  { header: 'Recommandation', key: 'recommandation' },
  { header: 'Commentaire audite', key: 'commentaireAudite' },
  { header: 'Commentaire auditeur', key: 'commentaireAuditeur' },
  { header: 'Plan action', key: 'planAction' },
  { header: 'Responsable', key: 'responsable' },
  { header: 'Delai', key: 'delai' },
  { header: 'Evaluation Risque', key: 'evaluationRisque' },
  { header: 'Mission', key: 'mission' },
  { header: 'statut', key: 'statut' },
  { header: 'Document', key: 'document' },
  { header: 'Direction', key: 'direction' },
  { header: 'Processus', key: 'processus' },
  { header: 'Email audite', key: 'emailAudite' },
  { header: 'Email auditeur', key: 'emailAuditeur' },
  { header: 'Report delai', key: 'reportDelai' },
  { header: 'Ref recos', key: 'refRecos' },
  { header: 'Intitule recos', key: 'intituleRecos' },
];

export const RecoInfoManagerPanel: React.FC<RecoInfoManagerPanelProps> = ({
  node,
  record,
  isLocked,
  trees,
  scopeNodeId,
  initialView = 'accordeon',
  onClose,
  onSelectRecoNode,
  onUpdateRecoMeta,
}) => {
  const [viewMode, setViewMode] = useState<RecoPanelViewMode>(initialView);
  const [sourceSubTab, setSourceSubTab] = useState<RecoSourceSubTab>('ligne');
  const [sourceYearFilter, setSourceYearFilter] = useState<'all' | '2025' | '2024'>('all');
  const [sourceSearch, setSourceSearch] = useState('');
  const [copiedRow, setCopiedRow] = useState(false);

  const [expandedAccordionIds, setExpandedAccordionIds] = useState<Set<string>>(
    () => new Set(['col-intitule'])
  );
  const [activeAccordionId, setActiveAccordionId] = useState<string>('col-intitule');
  const [editingAccordionId, setEditingAccordionId] = useState<string | null>(null);

  // Drafts d'édition des 10 colonnes clés
  const [editNoDraft, setEditNoDraft] = useState<number>(record.no);
  const [editRefDraft, setEditRefDraft] = useState(record.refRecos);
  const [editIntituleRecosDraft, setEditIntituleRecosDraft] = useState(record.intituleRecos);
  const [editIntituleDraft, setEditIntituleDraft] = useState(record.intitule);
  const [editMissionDraft, setEditMissionDraft] = useState(record.mission);
  const [editDirectionDraft, setEditDirectionDraft] = useState(record.direction);
  const [editProcessusDraft, setEditProcessusDraft] = useState(record.processus);
  const [editEvalRisqueDraft, setEditEvalRisqueDraft] = useState(record.evaluationRisque);
  const [editRisqueDraft, setEditRisqueDraft] = useState(record.risque);
  const [editRecoDraft, setEditRecoDraft] = useState(record.recommandation);
  const [editPlanDraft, setEditPlanDraft] = useState(record.planAction);
  const [editResponsableDraft, setEditResponsableDraft] = useState(record.responsable);
  const [editEmailAuditeDraft, setEditEmailAuditeDraft] = useState(record.emailAudite);
  const [editDelaiDraft, setEditDelaiDraft] = useState(record.delai);
  const [editReportDraft, setEditReportDraft] = useState(record.reportDelai);
  const [editStatutDraft, setEditStatutDraft] = useState(record.statut);
  const [editDocDraft, setEditDocDraft] = useState(record.document);

  useEffect(() => {
    setViewMode(initialView);
  }, [initialView, node.id]);

  useEffect(() => {
    setEditingAccordionId(null);
  }, [node.id]);

  const liveEntries: LiveSuiviRecoEntry[] = useMemo(() => {
    if (!trees || trees.length === 0) return [];
    const scoped = extractSuiviRecosFromTrees(trees, scopeNodeId);
    if (scoped.some((e) => e.node.id === node.id)) return scoped;
    return extractSuiviRecosFromTrees(trees);
  }, [trees, scopeNodeId, node.id]);

  const sourceRows: Array<{
    record: RecoSourceMetadata;
    year: '2025' | '2024';
    nodeId?: string;
  }> = useMemo(() => {
    const q = sourceSearch.trim().toLowerCase();
    const rows =
      liveEntries.length > 0
        ? liveEntries.map((entry) => ({
            record: entry.record,
            year: (entry.record.refRecos.includes('2024') || entry.exerciceLabel.includes('2024')
              ? '2024'
              : '2025') as '2025' | '2024',
            nodeId: entry.node.id,
          }))
        : [
            ...SUIVI_RECOS_2025_DATA.map((r) => ({ record: r, year: '2025' as const })),
            ...SUIVI_RECOS_2024_DATA.map((r) => ({ record: r, year: '2024' as const })),
          ];

    return rows.filter((item) => {
      if (sourceYearFilter !== 'all' && item.year !== sourceYearFilter) return false;
      if (!q) return true;
      const r = item.record;
      return (
        r.refRecos.toLowerCase().includes(q) ||
        r.intituleRecos.toLowerCase().includes(q) ||
        r.intitule.toLowerCase().includes(q) ||
        r.mission.toLowerCase().includes(q) ||
        r.direction.toLowerCase().includes(q) ||
        r.responsable.toLowerCase().includes(q) ||
        r.statut.toLowerCase().includes(q)
      );
    });
  }, [liveEntries, sourceYearFilter, sourceSearch]);

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
    setEditNoDraft(record.no);
    setEditRefDraft(record.refRecos);
    setEditIntituleRecosDraft(record.intituleRecos);
    setEditIntituleDraft(record.intitule);
    setEditMissionDraft(record.mission);
    setEditDirectionDraft(record.direction);
    setEditProcessusDraft(record.processus);
    setEditEvalRisqueDraft(record.evaluationRisque);
    setEditRisqueDraft(record.risque);
    setEditRecoDraft(record.recommandation);
    setEditPlanDraft(record.planAction);
    setEditResponsableDraft(record.responsable);
    setEditEmailAuditeDraft(record.emailAudite);
    setEditDelaiDraft(record.delai);
    setEditReportDraft(record.reportDelai);
    setEditStatutDraft(record.statut);
    setEditDocDraft(record.document);

    setActiveAccordionId(tabId);
    setExpandedAccordionIds((prev) => {
      const next = new Set(prev);
      next.add(tabId);
      return next;
    });
    setEditingAccordionId((prev) => (prev === tabId ? null : tabId));
  };

  const markdownLine = useMemo(() => {
    const headerRow = `| ${SOURCE_COLUMNS.map((c) => c.header).join(' | ')} |`;
    const sepRow = `| ${SOURCE_COLUMNS.map(() => '---').join(' | ')} |`;
    const valRow = `| ${SOURCE_COLUMNS.map((c) =>
      String(record[c.key] ?? '').replace(/\|/g, '/')
    ).join(' | ')} |`;
    return `${headerRow}\n${sepRow}\n${valRow}`;
  }, [record]);

  const handleCopySourceLine = async () => {
    try {
      await navigator.clipboard.writeText(markdownLine);
      setCopiedRow(true);
      window.setTimeout(() => setCopiedRow(false), 1800);
    } catch {
      setCopiedRow(false);
    }
  };

  const allTabIds = [
    'col-ref',
    'col-intitule',
    'col-mission',
    'col-direction',
    'col-risque',
    'col-recommandation',
    'col-plan',
    'col-responsable',
    'col-delai',
    'col-statut',
  ];

  const accordionTabs: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'col-ref', label: '1. N° & Référence', icon: Hash },
    { id: 'col-intitule', label: '2. Intitulé de la recommandation', icon: FileText },
    { id: 'col-mission', label: '3. Mission', icon: Briefcase },
    { id: 'col-direction', label: '4. Direction & Processus', icon: Building2 },
    { id: 'col-risque', label: '5. Évaluation du risque', icon: ShieldAlert },
    { id: 'col-recommandation', label: '6. Recommandation', icon: Target },
    { id: 'col-plan', label: '7. Plan d’action', icon: ClipboardList },
    { id: 'col-responsable', label: '8. Responsable', icon: UserCheck },
    { id: 'col-delai', label: '9. Délai & Report', icon: CalendarRange },
    { id: 'col-statut', label: '10. Statut & Document attendu', icon: TrendingUp },
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

    if (tabId === 'col-ref') {
      if (isEditing) {
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateRecoMeta?.(node.id, {
                no: editNoDraft,
                refRecos: editRefDraft,
              });
              setEditingAccordionId(null);
            }}
            className="space-y-2.5 text-xs"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-w-md">
              <label className="block">
                <span className="text-[11px] text-slate-500">N°</span>
                <input
                  type="number"
                  min={1}
                  value={editNoDraft}
                  onChange={(e) =>
                    setEditNoDraft(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
                  }
                  className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-500">Réf recos</span>
                <input
                  type="text"
                  value={editRefDraft}
                  onChange={(e) => setEditRefDraft(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
                />
              </label>
            </div>
            {renderFormButtons()}
          </form>
        );
      }
      return (
        <div className="space-y-1 text-[13px] text-slate-700">
          <div className="font-mono font-medium text-slate-900">{record.refRecos}</div>
          <div className="font-mono text-xs text-slate-500 tabular-nums">
            Ligne n° {record.no}
          </div>
        </div>
      );
    }

    if (tabId === 'col-intitule') {
      if (isEditing) {
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateRecoMeta?.(node.id, {
                intituleRecos: editIntituleRecosDraft,
                intitule: editIntituleDraft,
              });
              setEditingAccordionId(null);
            }}
            className="space-y-2.5 text-xs"
          >
            <label className="block">
              <span className="text-[11px] text-slate-500">Intitulé recos</span>
              <input
                type="text"
                value={editIntituleRecosDraft}
                onChange={(e) => setEditIntituleRecosDraft(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500">Intitulé détaillé</span>
              <input
                type="text"
                value={editIntituleDraft}
                onChange={(e) => setEditIntituleDraft(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              />
            </label>
            {renderFormButtons()}
          </form>
        );
      }
      return (
        <div className="space-y-1 text-[13px] text-slate-800">
          <div className="font-medium text-slate-900">{record.intituleRecos}</div>
          {record.intitule && record.intitule !== record.intituleRecos && (
            <div className="text-xs text-slate-500">{record.intitule}</div>
          )}
        </div>
      );
    }

    if (tabId === 'col-mission') {
      if (isEditing) {
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateRecoMeta?.(node.id, { mission: editMissionDraft });
              setEditingAccordionId(null);
            }}
            className="space-y-2.5 text-xs"
          >
            <label className="block">
              <span className="text-[11px] text-slate-500">Mission</span>
              <input
                type="text"
                value={editMissionDraft}
                onChange={(e) => setEditMissionDraft(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              />
            </label>
            {renderFormButtons()}
          </form>
        );
      }
      return <div className="text-[13px] text-slate-800">{record.mission}</div>;
    }

    if (tabId === 'col-direction') {
      if (isEditing) {
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateRecoMeta?.(node.id, {
                direction: editDirectionDraft,
                processus: editProcessusDraft,
              });
              setEditingAccordionId(null);
            }}
            className="space-y-2.5 text-xs"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] text-slate-500">Direction</span>
                <input
                  type="text"
                  value={editDirectionDraft}
                  onChange={(e) => setEditDirectionDraft(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-500">Processus</span>
                <input
                  type="text"
                  value={editProcessusDraft}
                  onChange={(e) => setEditProcessusDraft(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                />
              </label>
            </div>
            {renderFormButtons()}
          </form>
        );
      }
      return (
        <div className="space-y-1 text-[13px] text-slate-700">
          <div className="text-slate-900">{record.direction}</div>
          {record.processus && (
            <div className="text-xs text-slate-500">Processus : {record.processus}</div>
          )}
        </div>
      );
    }

    if (tabId === 'col-risque') {
      if (isEditing) {
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateRecoMeta?.(node.id, {
                evaluationRisque: editEvalRisqueDraft,
                risque: editRisqueDraft,
              });
              setEditingAccordionId(null);
            }}
            className="space-y-2.5 text-xs"
          >
            <label className="block max-w-xs">
              <span className="text-[11px] text-slate-500">Évaluation du risque</span>
              <select
                value={editEvalRisqueDraft}
                onChange={(e) => setEditEvalRisqueDraft(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              >
                <option value="Critique">Critique</option>
                <option value="Majeur">Majeur</option>
                <option value="Modéré">Modéré</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500">Description du risque</span>
              <textarea
                rows={2}
                value={editRisqueDraft}
                onChange={(e) => setEditRisqueDraft(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              />
            </label>
            {renderFormButtons()}
          </form>
        );
      }
      return (
        <div className="space-y-1 text-[13px] text-slate-700">
          <div className="font-medium text-slate-900">{record.evaluationRisque}</div>
          {record.risque && (
            <div className="text-xs text-slate-500">{record.risque}</div>
          )}
        </div>
      );
    }

    if (tabId === 'col-recommandation') {
      if (isEditing) {
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateRecoMeta?.(node.id, { recommandation: editRecoDraft });
              setEditingAccordionId(null);
            }}
            className="space-y-2.5 text-xs"
          >
            <label className="block">
              <span className="text-[11px] text-slate-500">Recommandation</span>
              <textarea
                rows={3}
                value={editRecoDraft}
                onChange={(e) => setEditRecoDraft(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              />
            </label>
            {renderFormButtons()}
          </form>
        );
      }
      return <div className="text-[13px] text-slate-700">{record.recommandation}</div>;
    }

    if (tabId === 'col-plan') {
      if (isEditing) {
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateRecoMeta?.(node.id, { planAction: editPlanDraft });
              setEditingAccordionId(null);
            }}
            className="space-y-2.5 text-xs"
          >
            <label className="block">
              <span className="text-[11px] text-slate-500">Plan d&apos;action</span>
              <textarea
                rows={2}
                value={editPlanDraft}
                onChange={(e) => setEditPlanDraft(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              />
            </label>
            {renderFormButtons()}
          </form>
        );
      }
      return <div className="text-[13px] text-slate-700">{record.planAction}</div>;
    }

    if (tabId === 'col-responsable') {
      if (isEditing) {
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateRecoMeta?.(node.id, {
                responsable: editResponsableDraft,
                emailAudite: editEmailAuditeDraft,
              });
              setEditingAccordionId(null);
            }}
            className="space-y-2.5 text-xs"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] text-slate-500">Responsable</span>
                <input
                  type="text"
                  value={editResponsableDraft}
                  onChange={(e) => setEditResponsableDraft(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-500">Email audité</span>
                <input
                  type="email"
                  value={editEmailAuditeDraft}
                  onChange={(e) => setEditEmailAuditeDraft(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
                />
              </label>
            </div>
            {renderFormButtons()}
          </form>
        );
      }
      return (
        <div className="space-y-1 text-[13px] text-slate-700">
          <div className="text-slate-900">{record.responsable}</div>
          <div className="font-mono text-xs text-slate-500">
            {record.emailAudite} · Auditeur : {record.emailAuditeur}
          </div>
        </div>
      );
    }

    if (tabId === 'col-delai') {
      if (isEditing) {
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateRecoMeta?.(node.id, {
                delai: editDelaiDraft,
                reportDelai: editReportDraft,
              });
              setEditingAccordionId(null);
            }}
            className="space-y-2.5 text-xs"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-w-md">
              <label className="block">
                <span className="text-[11px] text-slate-500">Délai initial (jj/mm/aaaa)</span>
                <input
                  type="text"
                  value={editDelaiDraft}
                  onChange={(e) => setEditDelaiDraft(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-500">Report délai</span>
                <input
                  type="text"
                  value={editReportDraft}
                  onChange={(e) => setEditReportDraft(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
                />
              </label>
            </div>
            {renderFormButtons()}
          </form>
        );
      }
      return (
        <div className="space-y-1 font-mono tabular-nums text-[13px] text-slate-800">
          <div>Délai initial : {record.delai}</div>
          <div className="text-xs text-slate-500">
            Report délai : {record.reportDelai || 'Néant'}
          </div>
        </div>
      );
    }

    // col-statut (10. Statut & Document attendu)
    if (isEditing) {
      return (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onUpdateRecoMeta?.(node.id, {
              statut: editStatutDraft,
              document: editDocDraft,
            });
            setEditingAccordionId(null);
          }}
          className="space-y-2.5 text-xs"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] text-slate-500">Statut</span>
              <select
                value={editStatutDraft}
                onChange={(e) => setEditStatutDraft(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              >
                <option value="Réalisé">Réalisé</option>
                <option value="En attente">En attente</option>
                <option value="Reporté">Reporté</option>
                <option value="Non réalisé">Non réalisé</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500">Document attendu</span>
              <input
                type="text"
                value={editDocDraft}
                onChange={(e) => setEditDocDraft(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              />
            </label>
          </div>
          {renderFormButtons()}
        </form>
      );
    }
    return (
      <div className="space-y-1 text-[13px] text-slate-700">
        <div className="font-medium text-slate-900">{record.statut}</div>
        {record.document && (
          <div className="text-xs text-slate-500">Document : {record.document}</div>
        )}
      </div>
    );
  };

  return (
    <section
      aria-label={`Détail du suivi des recos : ${record.refRecos}`}
      className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-slate-700 bg-slate-50 text-slate-900 lg:border-b-0 lg:border-r lg:border-slate-800"
    >
      {/* En-tête blanc sobre */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3.5 text-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500">
              Suivi des recommandations · Ligne n° {record.no} · {record.refRecos}
            </div>
            <h2 className="mt-0.5 truncate text-base font-semibold text-slate-900">
              {viewMode === 'source-file'
                ? 'Détail des informations sources du fichier de suivi des recos (22 colonnes)'
                : `Détail du suivi des recos — ${record.refRecos} - ${record.intituleRecos}`}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                setViewMode((prev) => (prev === 'accordeon' ? 'source-file' : 'accordeon'))
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'source-file'
                  ? 'border-blue-700 bg-blue-700 text-white hover:bg-blue-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {viewMode === 'source-file' ? (
                <>
                  <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Vue accordéon</span>
                </>
              ) : (
                <>
                  <Table2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <span>Détail informations sources</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer le détail du suivi des recos"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Corps scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
        {viewMode === 'accordeon' ? (
          <>
            {/* Barre simple de sélection + Tout déplier */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-2.5 min-w-0 flex-1">
                <label className="text-xs font-medium text-slate-600 shrink-0">
                  Recommandation :
                </label>
                {liveEntries.length > 0 && onSelectRecoNode ? (
                  <select
                    value={node.id}
                    onChange={(e) => onSelectRecoNode(e.target.value)}
                    className="min-w-0 max-w-md flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-900"
                  >
                    {liveEntries.map((entry) => (
                      <option key={entry.node.id} value={entry.node.id}>
                        {entry.record.refRecos} - {entry.record.intituleRecos}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="truncate text-xs font-medium text-slate-900">
                    {record.refRecos} - {record.intituleRecos}
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

            {/* Menu accordéon blanc épuré sans metrics */}
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

                      {!isLocked && onUpdateRecoMeta && (
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
                      )}
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
          </>
        ) : (
          /* VUE DÉTAIL INFORMATIONS SOURCES DU FICHIER DE SUIVI DES RECOS (22 COLONNES) */
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setSourceSubTab('ligne')}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    sourceSubTab === 'ligne'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Fiche source · {record.refRecos} (22 colonnes)
                </button>
                <button
                  type="button"
                  onClick={() => setSourceSubTab('fichier')}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    sourceSubTab === 'fichier'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Table complète du fichier ({sourceRows.length} lignes)
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopySourceLine}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {copiedRow ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    <span>Ligne copiée</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    <span>Copier la ligne source</span>
                  </>
                )}
              </button>
            </div>

            {sourceSubTab === 'ligne' ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                      <th className="w-12 px-3 py-2 font-mono">N°</th>
                      <th className="w-48 px-3 py-2">Colonne source</th>
                      <th className="px-3 py-2">Valeur enregistrée dans le fichier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {SOURCE_COLUMNS.map((col, idx) => {
                      const val = String(record[col.key] ?? '');
                      return (
                        <tr key={col.key} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-400 tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                            {col.header}
                          </td>
                          <td className="px-3 py-2 text-slate-900 leading-relaxed">
                            {val || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                  <div className="relative min-w-[220px] flex-1">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={sourceSearch}
                      onChange={(e) => setSourceSearch(e.target.value)}
                      placeholder="Rechercher référence, intitulé, mission, direction, responsable..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs">
                    {(['all', '2025', '2024'] as const).map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setSourceYearFilter(yr)}
                        className={`rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                          sourceYearFilter === yr
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {yr === 'all' ? 'Toutes' : yr}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-700">
                        {SOURCE_COLUMNS.map((col, idx) => (
                          <th
                            key={col.key}
                            className="border-r border-slate-200 px-2.5 py-2 whitespace-nowrap last:border-r-0"
                          >
                            <span className="mr-1 font-mono text-[9px] text-slate-400">
                              {idx + 1}.
                            </span>
                            {col.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sourceRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={SOURCE_COLUMNS.length}
                            className="px-4 py-6 text-center text-xs text-slate-500"
                          >
                            Aucune ligne source ne correspond au filtre.
                          </td>
                        </tr>
                      ) : (
                        sourceRows.map((item) => {
                          const r = item.record;
                          const isCurrent =
                            r.refRecos === record.refRecos && r.no === record.no;
                          return (
                            <tr
                              key={`${item.year}-${r.no}-${r.refRecos}`}
                              onClick={() => {
                                if (item.nodeId && onSelectRecoNode) {
                                  onSelectRecoNode(item.nodeId);
                                }
                                setSourceSubTab('ligne');
                              }}
                              className={`transition-colors ${
                                item.nodeId && onSelectRecoNode
                                  ? 'cursor-pointer hover:bg-blue-50/50'
                                  : ''
                              } ${isCurrent ? 'bg-blue-50/70' : 'bg-white'}`}
                            >
                              {SOURCE_COLUMNS.map((col) => {
                                const val = String(r[col.key] ?? '');
                                const isLong = val.length > 42;
                                return (
                                  <td
                                    key={col.key}
                                    className={`border-r border-slate-100 px-2.5 py-2 align-top text-slate-800 last:border-r-0 ${
                                      isLong ? 'min-w-[220px]' : 'whitespace-nowrap'
                                    }`}
                                  >
                                    {val || '—'}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
