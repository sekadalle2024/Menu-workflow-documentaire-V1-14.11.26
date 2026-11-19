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
  Palette,
  PanelRightOpen,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { WORKFLOW_SIDEBAR_ITEMS } from '../data/workflowCatalog';
import { WorkflowNatureId } from '../types/workflow';
import {
  getWorkflowTheme,
  WORKFLOW_THEMES,
  WorkflowThemeId,
} from '../utils/workflowTheme';

interface LeftWorkflowSidebarProps {
  activeNatureId: WorkflowNatureId | null;
  activeSubMenuId: string | null;
  workflowThemeId: WorkflowThemeId;
  onSelectWorkflowTheme: (themeId: WorkflowThemeId) => void;
  onActivateWorkflowSubItem: (
    natureId: WorkflowNatureId,
    subMenuId: string,
    targetNodeSuffix: string
  ) => void;
  onActivateWorkflowNature: (natureId: WorkflowNatureId) => void;
}

function renderWorkflowIcon(iconKey: string, isActive: boolean) {
  const cls = `h-4 w-4 shrink-0 ${isActive ? '' : 'text-slate-500'}`;
  switch (iconKey) {
    case 'folder-lock':
      return <FolderLock className={cls} aria-hidden="true" />;
    case 'briefcase':
      return <Briefcase className={cls} aria-hidden="true" />;
    case 'list-checks':
      return <ListChecks className={cls} aria-hidden="true" />;
    case 'calendar-range':
      return <CalendarRange className={cls} aria-hidden="true" />;
    case 'shield-alert':
      return <ShieldAlert className={cls} aria-hidden="true" />;
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
  workflowThemeId,
  onSelectWorkflowTheme,
  onActivateWorkflowSubItem,
  onActivateWorkflowNature,
}) => {
  const [openMenus, setOpenMenus] = useState<Set<WorkflowNatureId>>(
    () => new Set<WorkflowNatureId>(['perm-audit', 'ex-audit', 'plan-audit', 'doc-mission'])
  );
  const [themesOpen, setThemesOpen] = useState<boolean>(false);

  const activeTheme = getWorkflowTheme(workflowThemeId);

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
      className="flex h-full w-full flex-col rounded-xl border border-slate-200 bg-white lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)] lg:w-[296px] lg:shrink-0 overflow-hidden"
    >
      <div
        className="border-b border-slate-200 px-4 py-3.5"
        style={{
          borderTop: `4px solid ${activeTheme.swatchHex === '#FFFFFF' ? '#0F172A' : activeTheme.swatchHex}`,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="font-display text-sm font-semibold text-slate-900">
            Workflows par nature
          </div>
          <span
            title={`Thème actif : ${activeTheme.label}`}
            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
          >
            <span
              className="h-2.5 w-2.5 rounded-full border"
              style={{
                backgroundColor: activeTheme.swatchHex,
                borderColor: activeTheme.swatchBorderHex,
              }}
              aria-hidden="true"
            />
            <span>{activeTheme.label}</span>
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Déroulez une catégorie puis activez un sous-menu pour ouvrir son workflow.
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2.5">
        {/* Section Thèmes avec sous-menu des couleurs de marque */}
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-0.5">
          <button
            type="button"
            onClick={() => setThemesOpen((prev) => !prev)}
            aria-expanded={themesOpen}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-white cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-slate-400">
                {themesOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </span>
              <Palette
                className="h-4 w-4 shrink-0"
                style={{
                  color: activeTheme.isLight ? '#0F172A' : activeTheme.swatchHex,
                }}
                aria-hidden="true"
              />
              <span>Thèmes</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-600">
              <span
                className="h-3 w-3 rounded-full border"
                style={{
                  backgroundColor: activeTheme.swatchHex,
                  borderColor: activeTheme.swatchBorderHex,
                }}
                aria-hidden="true"
              />
              <span>{activeTheme.label}</span>
            </span>
          </button>

          {themesOpen && (
            <div
              role="region"
              aria-label="Sous-menu des thèmes workflow"
              className="mt-1 ml-3.5 mr-1 space-y-1 border-l border-slate-300 pl-2.5 pb-1.5"
            >
              {WORKFLOW_THEMES.map((theme) => {
                const isSelected = theme.id === activeTheme.id;
                return (
                  <div
                    key={theme.id}
                    className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                      isSelected
                        ? 'bg-white font-semibold text-slate-900 shadow-xs ring-1 ring-slate-200'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full border shadow-xs"
                        style={{
                          backgroundColor: theme.swatchHex,
                          borderColor: theme.swatchBorderHex,
                        }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{theme.label}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectWorkflowTheme(theme.id)}
                      style={
                        isSelected
                          ? {
                              backgroundColor: theme.primaryBtnBg,
                              color: theme.primaryBtnText,
                              borderColor: theme.primaryBtnBg,
                            }
                          : undefined
                      }
                      className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isSelected
                          ? 'border'
                          : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {isSelected ? 'Actif' : 'Appliquer'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {WORKFLOW_SIDEBAR_ITEMS.map((item) => {
          const isOpen = openMenus.has(item.id);
          const isActiveNature = activeNatureId === item.id;

          return (
            <div key={item.id} className="rounded-lg">
              <div
                style={
                  isActiveNature
                    ? { backgroundColor: activeTheme.sidebarActiveBg }
                    : undefined
                }
                className={`flex items-center gap-1 rounded-lg transition-colors ${
                  isActiveNature ? '' : 'hover:bg-slate-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleMenu(item.id)}
                  aria-expanded={isOpen}
                  title={item.label}
                  style={
                    isActiveNature
                      ? { color: activeTheme.sidebarActiveText }
                      : undefined
                  }
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-xs font-medium text-slate-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 rounded-lg"
                >
                  <span className="shrink-0 text-slate-400">
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </span>
                  <span
                    style={
                      isActiveNature
                        ? {
                            color: activeTheme.isLight
                              ? '#0F172A'
                              : activeTheme.swatchHex,
                          }
                        : undefined
                    }
                  >
                    {renderWorkflowIcon(item.iconKey, isActiveNature)}
                  </span>
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
                  className="mr-1 inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
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
                        style={
                          isSubActive
                            ? {
                                backgroundColor: activeTheme.sidebarActiveBg,
                                color: activeTheme.sidebarActiveText,
                              }
                            : undefined
                        }
                        className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                          isSubActive
                            ? ''
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
                          style={
                            isSubActive
                              ? {
                                  backgroundColor: activeTheme.primaryBtnBg,
                                  color: activeTheme.primaryBtnText,
                                }
                              : undefined
                          }
                          className={`rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 ${
                            isSubActive
                              ? ''
                              : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900'
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
