import React from 'react';
import { ActiveWorkspaceTab } from '../types/dossier';

interface TopBarProps {
  activeTab: ActiveWorkspaceTab;
  onSelectTab: (tab: ActiveWorkspaceTab) => void;
  isPanelOpen: boolean;
  onTogglePanel: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  isPanelOpen,
  onTogglePanel,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-6 py-3.5">
        <a
          href="#mission-workspace"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('workspace');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          AuditFlow
        </a>

        <nav
          aria-label="Navigation principale"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <a
            href="#mission-workspace"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('workspace');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
              activeTab === 'workspace'
                ? 'text-slate-900 underline decoration-blue-700 decoration-2 underline-offset-8'
                : ''
            }`}
          >
            Espace Mission
          </a>
          <a
            href="#suivi-recos-analytics"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('suivi-recos-analytics');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
              activeTab === 'suivi-recos-analytics'
                ? 'text-slate-900 underline decoration-blue-700 decoration-2 underline-offset-8'
                : ''
            }`}
          >
            Power BI Recos
          </a>
          <a
            href="#recos"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('recos');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
              activeTab === 'recos'
                ? 'text-slate-900 underline decoration-blue-700 decoration-2 underline-offset-8'
                : ''
            }`}
          >
            Tableau Recos
          </a>
          <a
            href="#plan-audit-temps"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('audit-plan');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
              activeTab === 'audit-plan'
                ? 'text-slate-900 underline decoration-teal-700 decoration-2 underline-offset-8'
                : ''
            }`}
          >
            Plan d&apos;Audit &amp; Temps
          </a>
          <a
            href="#menu-coulissant"
            onClick={(e) => {
              e.preventDefault();
              onTogglePanel();
            }}
            className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900"
          >
            Menu Coulissant
          </a>
          <a
            href="#schema-postgresql"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('schema');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
              activeTab === 'schema'
                ? 'text-slate-900 underline decoration-blue-700 decoration-2 underline-offset-8'
                : ''
            }`}
          >
            PostgreSQL &amp; Drive
          </a>
          <a
            href="#script-deployable"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('script');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
              activeTab === 'script'
                ? 'text-slate-900 underline decoration-blue-700 decoration-2 underline-offset-8'
                : ''
            }`}
          >
            Script Déployable
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            data-page="dossier"
            onClick={onTogglePanel}
            className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {isPanelOpen ? 'Fermer le menu' : 'Menu coulissant'}
          </button>
        </div>
      </div>

      {/* Navigation compacte mobile/tablette */}
      <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 text-xs font-medium text-slate-600 md:hidden">
        {(
          [
            { id: 'workspace', label: 'Espace Mission' },
            { id: 'suivi-recos-analytics', label: 'Power BI Recos' },
            { id: 'recos', label: 'Tableau Recos' },
            { id: 'audit-plan', label: 'Plan d’Audit' },
            { id: 'schema', label: 'PostgreSQL & Drive' },
            { id: 'script', label: 'Script' },
          ] as Array<{ id: ActiveWorkspaceTab; label: string }>
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className={`shrink-0 rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
              activeTab === item.id
                ? 'bg-blue-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
};
