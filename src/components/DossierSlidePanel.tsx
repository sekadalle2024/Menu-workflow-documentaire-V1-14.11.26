import React, { useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { AccordionMode, ClassifiedTableItem, DossierTreeNode } from '../types/dossier';
import { DossierTreeAccordion } from './DossierTreeAccordion';

interface DossierSlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  nodes: DossierTreeNode[];
  expandedIds: Set<string>;
  onToggleNode: (nodeId: string, level: number) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  accordionMode: AccordionMode;
  onChangeAccordionMode: (mode: AccordionMode) => void;
  classifiedByRubrique: Map<string, ClassifiedTableItem[]>;
  totalTables: number;
  rubriquesCount: number;
  onNavigateToTable: (item: ClassifiedTableItem) => void;
  activeTableId: string | null;
  checkedIds: Set<string>;
  onToggleCheckNode: (node: DossierTreeNode) => void;
  onToggleCheckItem: (itemId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export const DossierSlidePanel: React.FC<DossierSlidePanelProps> = ({
  isOpen,
  onClose,
  onRefresh,
  nodes,
  expandedIds,
  onToggleNode,
  onExpandAll,
  onCollapseAll,
  accordionMode,
  onChangeAccordionMode,
  classifiedByRubrique,
  totalTables,
  rubriquesCount,
  onNavigateToTable,
  activeTableId,
  checkedIds,
  onToggleCheckNode,
  onToggleCheckItem,
  onSelectAll,
  onClearSelection,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      <div
        id="dossier-mission-overlay"
        aria-hidden={!isOpen}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] transition-opacity duration-200 ${
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        id="dossier-mission-panel"
        aria-label="Dossier de Mission — Panneau latéral"
        aria-hidden={!isOpen}
        className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-[540px] flex-col border-l border-slate-800 bg-slate-900 text-slate-100 shadow-2xl transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display truncate text-base font-semibold tracking-tight text-white">
              Dossier de Mission
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Structure d&apos;audit interne ·{' '}
              <span className="font-mono tabular-nums text-slate-300">
                {totalTables} table{totalTables > 1 ? 's' : ''}
              </span>{' '}
              dans{' '}
              <span className="font-mono tabular-nums text-slate-300">
                {rubriquesCount} rubrique{rubriquesCount > 1 ? 's' : ''}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRefresh}
              title="Réanalyser le DOM"
              aria-label="Actualiser la classification DOM"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition-colors hover:bg-slate-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Fermer (Échap)"
              aria-label="Fermer le panneau Dossier de Mission"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition-colors hover:bg-slate-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-5">
          <DossierTreeAccordion
            nodes={nodes}
            expandedIds={expandedIds}
            onToggleNode={onToggleNode}
            onExpandAll={onExpandAll}
            onCollapseAll={onCollapseAll}
            accordionMode={accordionMode}
            onChangeAccordionMode={onChangeAccordionMode}
            classifiedByRubrique={classifiedByRubrique}
            onNavigateToTable={onNavigateToTable}
            activeTableId={activeTableId}
            checkedIds={checkedIds}
            onToggleCheckNode={onToggleCheckNode}
            onToggleCheckItem={onToggleCheckItem}
            onSelectAll={onSelectAll}
            onClearSelection={onClearSelection}
            darkSurface
          />
        </div>
      </aside>
    </>
  );
};
