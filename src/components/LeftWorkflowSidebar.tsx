import React, { useState } from 'react';
import {
  BookMarked,
  BookOpen,
  Briefcase,
  Building2,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FolderLock,
  GitBranch,
  GraduationCap,
  ListChecks,
  PanelRightOpen,
  ShieldCheck,
} from 'lucide-react';
import { WORKFLOW_SIDEBAR_ITEMS } from '../data/workflowCatalog';
import { WorkflowNatureId } from '../types/workflow';

interface LeftWorkflowSidebarProps {
  activeNatureId: WorkflowNatureId | null;
  activeSubMenuId: string | null;
  onActivateWorkflowSubItem: (
    natureId: WorkflowNatureId,
    subMenuId: string,
    targetNodeSuffix: string
  ) => void;
  onActivateWorkflowNature: (natureId: WorkflowNatureId) => void;
}

function renderWorkflowIcon(iconKey: string, isActive: boolean) {
  const cls = `h-4 w-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-500'}`;
  switch (iconKey) {
    case 'folder-lock':
      return <FolderLock className={cls} aria-hidden="true" />;
    case 'briefcase':
      return <Briefcase className={cls} aria-hidden="true" />;
    case 'list-checks':
      return <ListChecks className={cls} aria-hidden="true" />;
    case 'calendar-range':
      return <CalendarRange className={cls} aria-hidden="true" />;
    case 'shield-check':
      return <ShieldCheck className={cls} aria-hidden="true" />;
    case 'file-spreadsheet':
      return <FileSpreadsheet className={cls} aria-hidden="true" />;
    case 'book-open':
      return <BookOpen className={cls} aria-hidden="true" />;
    case 'book-marked':
      return <BookMarked className={cls} aria-hidden="true" />;
    case 'building-2':
      return <Building2 className={cls} aria-hidden="true" />;
    case 'graduation-cap':
      return <GraduationCap className={cls} aria-hidden="true" />;
    case 'git-branch':
    default:
      return <GitBranch className={cls} aria-hidden="true" />;
  }
}

export const LeftWorkflowSidebar: React.FC<LeftWorkflowSidebarProps> = ({
  activeNatureId,
  activeSubMenuId,
  onActivateWorkflowSubItem,
  onActivateWorkflowNature,
}) => {
  const [openMenus, setOpenMenus] = useState<Set<WorkflowNatureId>>(
    () => new Set<WorkflowNatureId>(['perm-audit', 'ex-audit', 'plan-audit', 'doc-mission'])
  );

  const toggleMenu = (id: WorkflowNatureId) => {
    setOpenMenus((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <aside
      aria-label="Barre latérale des workflows documentaires"
      className="flex h-full w-full flex-col rounded-xl border border-slate-200 bg-white lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)] lg:w-[296px] lg:shrink-0"
    >
      <div className="border-b border-slate-200 px-4 py-3.5">
        <div className="font-display text-sm font-semibold text-slate-900">
          Workflows par nature
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Déroulez une catégorie puis activez un sous-menu pour ouvrir son workflow.
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2.5">
        {WORKFLOW_SIDEBAR_ITEMS.map((item) => {
          const isOpen = openMenus.has(item.id);
          const isActiveNature = activeNatureId === item.id;

          return (
            <div key={item.id} className="rounded-lg">
              <div
                className={`flex items-center gap-1 rounded-lg transition-colors ${
                  isActiveNature ? 'bg-blue-50/90' : 'hover:bg-slate-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleMenu(item.id)}
                  aria-expanded={isOpen}
                  title={item.label}
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-xs font-medium text-slate-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 rounded-lg"
                >
                  <span className="shrink-0 text-slate-400">
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </span>
                  {renderWorkflowIcon(item.iconKey, isActiveNature)}
                  <span className="min-w-0 flex-1 truncate">{item.shortLabel}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!isOpen) toggleMenu(item.id);
                    onActivateWorkflowNature(item.id);
                  }}
                  title={`Activer ${item.label}`}
                  aria-label={`Activer ${item.label}`}
                  className="mr-1 inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <PanelRightOpen className="h-3 w-3" aria-hidden="true" />
                  <span>Ouvrir</span>
                </button>
              </div>

              {isOpen && (
                <div className="mt-1 ml-4 space-y-1 border-l border-slate-200 pl-2.5 pb-1">
                  {item.subItems.map((sub) => {
                    const isSubActive = activeSubMenuId === sub.id;
                    return (
                      <div
                        key={sub.id}
                        className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                          isSubActive
                            ? 'bg-blue-50 text-blue-900'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate" title={sub.label}>
                          {sub.label}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onActivateWorkflowSubItem(
                              item.id,
                              sub.id,
                              sub.targetNodeSuffix
                            )
                          }
                          className={`rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 ${
                            isSubActive
                              ? 'bg-blue-700 text-white'
                              : 'border border-slate-200 bg-white text-slate-700 hover:border-blue-600 hover:text-blue-700'
                          }`}
                        >
                          Activer
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};
