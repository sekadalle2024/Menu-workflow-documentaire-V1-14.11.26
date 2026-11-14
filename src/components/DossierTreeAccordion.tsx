import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FileText,
  Folder,
  FolderOpen,
  Search,
  ArrowUpRight,
  X,
} from 'lucide-react';
import { AccordionMode, ClassifiedTableItem, DossierTreeNode } from '../types/dossier';
import { getNodeCheckState } from '../utils/dossierClassifier';

interface IndeterminateCheckboxProps {
  state: 'checked' | 'unchecked' | 'indeterminate';
  onChange: () => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
}

const IndeterminateCheckbox: React.FC<IndeterminateCheckboxProps> = ({
  state,
  onChange,
  ariaLabel,
  size = 'md',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = state === 'indeterminate';
    }
  }, [state]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={state === 'checked'}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
      className={`${
        size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
      } shrink-0 cursor-pointer rounded border-slate-300 accent-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600`}
    />
  );
};

interface DossierContextMenu {
  x: number;
  y: number;
  node: DossierTreeNode | null;
}

interface DossierTreeAccordionProps {
  nodes: DossierTreeNode[];
  expandedIds: Set<string>;
  onToggleNode: (nodeId: string, level: number) => void;
  onExpandBranch?: (node: DossierTreeNode) => void;
  onCollapseBranch?: (node: DossierTreeNode) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  accordionMode: AccordionMode;
  onChangeAccordionMode: (mode: AccordionMode) => void;
  classifiedByRubrique: Map<string, ClassifiedTableItem[]>;
  onNavigateToTable: (item: ClassifiedTableItem) => void;
  activeTableId?: string | null;
  checkedIds: Set<string>;
  onToggleCheckNode: (node: DossierTreeNode) => void;
  onToggleCheckItem: (itemId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  darkSurface?: boolean;
}

function nodeMatchesQuery(
  node: DossierTreeNode,
  query: string,
  classified: Map<string, ClassifiedTableItem[]>
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (node.label.toLowerCase().includes(q)) return true;

  const items = classified.get(node.id) || [];
  if (
    items.some(
      (item) =>
        item.displayTitle.toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q) ||
        item.etapeMission.toLowerCase().includes(q)
    )
  ) {
    return true;
  }

  return Boolean(node.children?.some((child) => nodeMatchesQuery(child, q, classified)));
}

export const DossierTreeAccordion: React.FC<DossierTreeAccordionProps> = ({
  nodes,
  expandedIds,
  onToggleNode,
  onExpandBranch,
  onCollapseBranch,
  onExpandAll,
  onCollapseAll,
  accordionMode,
  onChangeAccordionMode,
  classifiedByRubrique,
  onNavigateToTable,
  activeTableId,
  checkedIds,
  onToggleCheckNode,
  onToggleCheckItem,
  onSelectAll,
  onClearSelection,
  darkSurface = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<DossierContextMenu | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [contextMenu]);

  const openContextMenuAt = (x: number, y: number, node: DossierTreeNode | null) => {
    const menuWidth = 224;
    const menuHeight = node ? 180 : 110;
    const clampedX = Math.min(x, window.innerWidth - menuWidth - 12);
    const clampedY = Math.min(y, window.innerHeight - menuHeight - 12);
    setContextMenu({
      x: Math.max(12, clampedX),
      y: Math.max(12, clampedY),
      node,
    });
  };

  const filteredNodes = useMemo(
    () => nodes.filter((n) => nodeMatchesQuery(n, searchQuery, classifiedByRubrique)),
    [nodes, searchQuery, classifiedByRubrique]
  );

  const allNodes = useMemo(() => {
    const list: DossierTreeNode[] = [];
    const walk = (items: DossierTreeNode[]) => {
      for (const n of items) {
        list.push(n);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(nodes);
    return list;
  }, [nodes]);

  const checkedNodesCount = useMemo(
    () => allNodes.filter((n) => getNodeCheckState(n, checkedIds) === 'checked').length,
    [allNodes, checkedIds]
  );
  const allSelected = allNodes.length > 0 && checkedNodesCount === allNodes.length;

  const isSearching = searchQuery.trim().length > 0;

  const renderNode = (node: DossierTreeNode, level: number): React.ReactNode => {
    if (!nodeMatchesQuery(node, searchQuery, classifiedByRubrique)) {
      return null;
    }

    const hasChildren = Boolean(node.children && node.children.length > 0);
    const items = classifiedByRubrique.get(node.id) || [];
    const hasClassifiedItems = items.length > 0;
    const isExpandable = hasChildren || hasClassifiedItems;
    const isExpanded = isSearching ? true : expandedIds.has(node.id);
    const checkState = getNodeCheckState(node, checkedIds);

    const rowBase = darkSurface
      ? 'text-slate-100 hover:bg-slate-800/80'
      : 'text-slate-800 hover:bg-slate-100';
    const mutedText = darkSurface ? 'text-slate-400' : 'text-slate-500';
    const guideLine = darkSurface ? 'border-slate-700/80' : 'border-slate-200';
    const countColor = darkSurface ? 'text-blue-400' : 'text-blue-700';

    return (
      <div key={node.id} className="select-none">
        <div
          role="treeitem"
          aria-expanded={isExpandable ? isExpanded : undefined}
          aria-selected={checkState === 'checked'}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openContextMenuAt(e.clientX, e.clientY, node);
          }}
          style={{ paddingLeft: `${level * 18 + 6}px` }}
          className={`group flex w-full items-center gap-2 rounded-md py-1.5 pr-2.5 text-left text-sm transition-colors duration-150 ${rowBase}`}
        >
          <button
            type="button"
            disabled={!isExpandable}
            onClick={() => isExpandable && onToggleNode(node.id, level)}
            aria-label={isExpandable ? `${isExpanded ? 'Replier' : 'Déplier'} ${node.label}` : undefined}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${mutedText} ${
              isExpandable ? 'cursor-pointer hover:bg-black/5' : 'cursor-default'
            }`}
          >
            {isExpandable ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              )
            ) : (
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" aria-hidden="true" />
            )}
          </button>

          <IndeterminateCheckbox
            state={checkState}
            onChange={() => onToggleCheckNode(node)}
            ariaLabel={`Cocher ${node.label}`}
          />

          <button
            type="button"
            onClick={() => {
              if (isExpandable) {
                onToggleNode(node.id, level);
              } else {
                onToggleCheckNode(node);
              }
            }}
            className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
          >
            <span className="shrink-0">
              {node.kind === 'document' ? (
                <FileText
                  className={`h-4 w-4 ${darkSurface ? 'text-slate-400' : 'text-slate-500'}`}
                  aria-hidden="true"
                />
              ) : isExpanded ? (
                <FolderOpen
                  className={`h-4 w-4 ${darkSurface ? 'text-blue-400' : 'text-blue-700'}`}
                  aria-hidden="true"
                />
              ) : (
                <Folder
                  className={`h-4 w-4 ${darkSurface ? 'text-slate-400' : 'text-slate-500'}`}
                  aria-hidden="true"
                />
              )}
            </span>

            <span
              className={`min-w-0 flex-1 truncate ${
                level === 0 ? 'font-medium' : 'font-normal'
              }`}
              title={node.label}
            >
              {node.label}
            </span>
          </button>

          {hasClassifiedItems && (
            <span
              className={`shrink-0 font-mono text-xs font-semibold tabular-nums ${countColor}`}
              title={`${items.length} table(s) classée(s)`}
            >
              {items.length}
            </span>
          )}
        </div>

        {isExpandable && isExpanded && (
          <div className={`ml-4 border-l ${guideLine}`}>
            {hasClassifiedItems && (
              <div className="space-y-1 py-1 pl-3">
                {items.map((item) => {
                  const isActive = activeTableId === item.id;
                  const isItemChecked = checkedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left text-xs transition-colors duration-150 ${
                        darkSurface
                          ? isActive
                            ? 'border-blue-500 bg-blue-950/60 text-white'
                            : 'border-slate-800 bg-slate-800/50 text-slate-200 hover:border-slate-700 hover:bg-slate-800'
                          : isActive
                          ? 'border-blue-600 bg-blue-50 text-slate-900'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <IndeterminateCheckbox
                        size="sm"
                        state={isItemChecked ? 'checked' : 'unchecked'}
                        onChange={() => onToggleCheckItem(item.id)}
                        ariaLabel={`Cocher ${item.displayTitle}`}
                      />
                      <button
                        type="button"
                        onClick={() => onNavigateToTable(item)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{item.displayTitle}</div>
                          <div
                            className={`mt-0.5 flex items-center gap-1.5 truncate font-mono text-[11px] tabular-nums ${
                              darkSurface ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            {item.reference && <span>{item.reference}</span>}
                            {item.reference && item.norme && <span aria-hidden="true">·</span>}
                            {item.norme && <span className="truncate">{item.norme}</span>}
                          </div>
                        </div>
                        <ArrowUpRight
                          className={`h-3.5 w-3.5 shrink-0 ${
                            darkSurface ? 'text-blue-400' : 'text-blue-700'
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {hasChildren && node.children!.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 pb-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer les rubriques ou références..."
            aria-label="Filtrer les rubriques du dossier"
            className={`w-full rounded-lg border py-2 pr-9 pl-9 text-sm transition-colors focus:outline-2 focus:outline-offset-[-1px] focus:outline-blue-600 ${
              darkSurface
                ? 'border-slate-700 bg-slate-800/90 text-slate-100 placeholder:text-slate-400'
                : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Effacer le filtre"
              className={`absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 cursor-pointer ${
                darkSurface ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label="Mode d'ouverture de l'accordéon"
            className={`inline-flex items-center rounded-lg p-0.5 ${
              darkSurface ? 'bg-slate-800' : 'bg-slate-100'
            }`}
          >
            <button
              type="button"
              onClick={() => onChangeAccordionMode('multi')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                accordionMode === 'multi'
                  ? darkSurface
                    ? 'bg-slate-700 text-white'
                    : 'bg-white text-slate-900 shadow-xs'
                  : darkSurface
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Multi-sections
            </button>
            <button
              type="button"
              onClick={() => onChangeAccordionMode('single')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                accordionMode === 'single'
                  ? darkSurface
                    ? 'bg-slate-700 text-white'
                    : 'bg-white text-slate-900 shadow-xs'
                  : darkSurface
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Accordéon exclusif
            </button>
          </div>

          <span className={`text-[11px] ${darkSurface ? 'text-slate-400' : 'text-slate-500'}`}>
            Clic droit pour déplier / replier
          </span>
        </div>

        <div
          className={`flex items-center justify-between gap-3 border-t pt-2.5 text-xs ${
            darkSurface ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
          }`}
        >
          <span className="font-mono tabular-nums">
            {checkedNodesCount} / {allNodes.length} rubriques cochées
          </span>
          <button
            type="button"
            onClick={allSelected ? onClearSelection : onSelectAll}
            className={`font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              darkSurface
                ? 'text-blue-400 hover:text-blue-300'
                : 'text-blue-700 hover:text-blue-800'
            }`}
          >
            {allSelected ? 'Tout décocher' : 'Tout cocher'}
          </button>
        </div>
      </div>

      <div
        role="tree"
        aria-label="Structure du dossier de mission d'audit"
        onScroll={() => contextMenu && setContextMenu(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          openContextMenuAt(e.clientX, e.clientY, null);
        }}
        className="flex-1 overflow-y-auto pr-1"
      >
        {filteredNodes.length > 0 ? (
          <div className="space-y-0.5">{filteredNodes.map((node) => renderNode(node, 0))}</div>
        ) : (
          <div
            className={`rounded-lg border border-dashed p-6 text-center text-sm ${
              darkSurface
                ? 'border-slate-700 text-slate-400'
                : 'border-slate-200 text-slate-500'
            }`}
          >
            Aucune rubrique ne correspond à « {searchQuery} ».
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          role="menu"
          aria-label="Menu contextuel déplier et replier"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          className={`fixed z-[70] w-56 rounded-xl border py-1.5 text-xs shadow-xl ${
            darkSurface
              ? 'border-slate-700 bg-slate-900 text-slate-200'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          {contextMenu.node && (
            <div
              className={`border-b px-3 py-1.5 text-[11px] font-medium truncate ${
                darkSurface
                  ? 'border-slate-800 text-slate-400'
                  : 'border-slate-100 text-slate-500'
              }`}
            >
              {contextMenu.node.label}
            </div>
          )}
          <div className="py-1">
            {contextMenu.node &&
              (Boolean(contextMenu.node.children?.length) ||
                Boolean(classifiedByRubrique.get(contextMenu.node.id)?.length)) &&
              onExpandBranch &&
              onCollapseBranch && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onExpandBranch(contextMenu.node!);
                      setContextMenu(null);
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left cursor-pointer ${
                      darkSurface ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-100'
                    }`}
                  >
                    <ChevronsUpDown className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                    <span>Déplier la branche</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onCollapseBranch(contextMenu.node!);
                      setContextMenu(null);
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left cursor-pointer ${
                      darkSurface ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-100'
                    }`}
                  >
                    <ChevronsDownUp className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>Replier la branche</span>
                  </button>
                </>
              )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onExpandAll();
                setContextMenu(null);
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left cursor-pointer ${
                darkSurface ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-100'
              }`}
            >
              <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span>Tout déplier</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onCollapseAll();
                setContextMenu(null);
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left cursor-pointer ${
                darkSurface ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-100'
              }`}
            >
              <ChevronsDownUp className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span>Tout replier</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
