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
    </header>
  );
};
