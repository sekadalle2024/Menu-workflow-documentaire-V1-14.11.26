export type WorkflowThemeId =
  | 'blanc'
  | 'rouge'
  | 'bordeaux'
  | 'marron'
  | 'rose'
  | 'orange';

export interface WorkflowThemeDefinition {
  id: WorkflowThemeId;
  label: string;
  description: string;
  swatchHex: string;
  swatchBorderHex: string;
  isLight: boolean;
  // Panel & TreeView shell (RightSlidingMenu)
  panelBg: string;
  panelElevatedBg: string;
  panelBorder: string;
  panelText: string;
  panelMutedText: string;
  treeHoverBg: string;
  treeActiveBg: string;
  // Mission step top bar & accents
  stepTopBarBg: string;
  stepTopBarText: string;
  stepTopBarSubText: string;
  stepTopBarBorder: string;
  stepTopBarBtnBg: string;
  stepTopBarBtnHoverBg: string;
  stepTopBarBtnText: string;
  // Table headers & dividers (UI + .doc export)
  tableHeadBg: string;
  tableHeadText: string;
  tableHeadDivider: string;
  tableHeadBtnBg: string;
  tableHeadBtnText: string;
  tableHeadBtnHoverBg: string;
  // Primary buttons & sidebar active accents
  primaryBtnBg: string;
  primaryBtnHoverBg: string;
  primaryBtnText: string;
  primaryBtnBorder: string;
  sidebarActiveBg: string;
  sidebarActiveBorder: string;
  sidebarActiveText: string;
}

export const WORKFLOW_THEME_STORAGE_KEY = 'eaudit_workflow_theme_v1';

export const WORKFLOW_THEMES: WorkflowThemeDefinition[] = [
  {
    id: 'blanc',
    label: 'Blanc',
    description: 'Thème clair épuré blanc & contraste ardoise',
    swatchHex: '#FFFFFF',
    swatchBorderHex: '#94A3B8',
    isLight: true,
    panelBg: '#FFFFFF',
    panelElevatedBg: '#F8FAFC',
    panelBorder: '#CBD5E1',
    panelText: '#0F172A',
    panelMutedText: '#475569',
    treeHoverBg: '#F1F5F9',
    treeActiveBg: '#E2E8F0',
    stepTopBarBg: '#FFFFFF',
    stepTopBarText: '#0F172A',
    stepTopBarSubText: '#475569',
    stepTopBarBorder: '#CBD5E1',
    stepTopBarBtnBg: '#F1F5F9',
    stepTopBarBtnHoverBg: '#E2E8F0',
    stepTopBarBtnText: '#0F172A',
    tableHeadBg: '#FFFFFF',
    tableHeadText: '#0F172A',
    tableHeadDivider: '#CBD5E1',
    tableHeadBtnBg: '#F1F5F9',
    tableHeadBtnText: '#0F172A',
    tableHeadBtnHoverBg: '#E2E8F0',
    primaryBtnBg: '#0F172A',
    primaryBtnHoverBg: '#1E293B',
    primaryBtnText: '#FFFFFF',
    primaryBtnBorder: '#0F172A',
    sidebarActiveBg: '#F1F5F9',
    sidebarActiveBorder: '#475569',
    sidebarActiveText: '#0F172A',
  },
  {
    id: 'rouge',
    label: 'Rouge',
    description: 'Rouge vif identité marque',
    swatchHex: '#DC2626',
    swatchBorderHex: '#991B1B',
    isLight: false,
    panelBg: '#1E090B',
    panelElevatedBg: '#140507',
    panelBorder: '#7F1D1D',
    panelText: '#FEF2F2',
    panelMutedText: '#FCA5A5',
    treeHoverBg: '#3D0B10',
    treeActiveBg: '#6B1118',
    stepTopBarBg: '#991B1B',
    stepTopBarText: '#FFFFFF',
    stepTopBarSubText: '#FECACA',
    stepTopBarBorder: '#7F1D1D',
    stepTopBarBtnBg: 'rgba(255,255,255,0.16)',
    stepTopBarBtnHoverBg: 'rgba(255,255,255,0.26)',
    stepTopBarBtnText: '#FFFFFF',
    tableHeadBg: '#DC2626',
    tableHeadText: '#FFFFFF',
    tableHeadDivider: '#991B1B',
    tableHeadBtnBg: 'rgba(255,255,255,0.18)',
    tableHeadBtnText: '#FFFFFF',
    tableHeadBtnHoverBg: 'rgba(255,255,255,0.28)',
    primaryBtnBg: '#DC2626',
    primaryBtnHoverBg: '#B91C1C',
    primaryBtnText: '#FFFFFF',
    primaryBtnBorder: '#F87171',
    sidebarActiveBg: '#FEF2F2',
    sidebarActiveBorder: '#DC2626',
    sidebarActiveText: '#991B1B',
  },
  {
    id: 'bordeaux',
    label: 'Rouge Bordeaux',
    description: 'Rouge Bordeaux signature E-audit',
    swatchHex: '#8B0000',
    swatchBorderHex: '#5C0A0A',
    isLight: false,
    panelBg: '#19070B',
    panelElevatedBg: '#110407',
    panelBorder: '#5C111E',
    panelText: '#FFF1F2',
    panelMutedText: '#FDA4AF',
    treeHoverBg: '#320A12',
    treeActiveBg: '#590E1A',
    stepTopBarBg: '#5F0B14',
    stepTopBarText: '#FFFFFF',
    stepTopBarSubText: '#FECDD3',
    stepTopBarBorder: '#4C0519',
    stepTopBarBtnBg: 'rgba(255,255,255,0.16)',
    stepTopBarBtnHoverBg: 'rgba(255,255,255,0.26)',
    stepTopBarBtnText: '#FFFFFF',
    tableHeadBg: '#8B0000',
    tableHeadText: '#FFFFFF',
    tableHeadDivider: '#5C0A0A',
    tableHeadBtnBg: 'rgba(255,255,255,0.16)',
    tableHeadBtnText: '#FFFFFF',
    tableHeadBtnHoverBg: 'rgba(255,255,255,0.26)',
    primaryBtnBg: '#8B0000',
    primaryBtnHoverBg: '#A10D0D',
    primaryBtnText: '#FFFFFF',
    primaryBtnBorder: '#F87171',
    sidebarActiveBg: '#FFF1F2',
    sidebarActiveBorder: '#8B0000',
    sidebarActiveText: '#8B0000',
  },
  {
    id: 'marron',
    label: 'Marron',
    description: 'Marron profond sobre & institutionnel',
    swatchHex: '#6F3B1B',
    swatchBorderHex: '#4A2610',
    isLight: false,
    panelBg: '#1C1008',
    panelElevatedBg: '#120A04',
    panelBorder: '#5C3419',
    panelText: '#FEF3C7',
    panelMutedText: '#D6A984',
    treeHoverBg: '#331D0F',
    treeActiveBg: '#543016',
    stepTopBarBg: '#572D14',
    stepTopBarText: '#FFFFFF',
    stepTopBarSubText: '#FDE68A',
    stepTopBarBorder: '#42200C',
    stepTopBarBtnBg: 'rgba(255,255,255,0.16)',
    stepTopBarBtnHoverBg: 'rgba(255,255,255,0.26)',
    stepTopBarBtnText: '#FFFFFF',
    tableHeadBg: '#6F3B1B',
    tableHeadText: '#FFFFFF',
    tableHeadDivider: '#4A2610',
    tableHeadBtnBg: 'rgba(255,255,255,0.16)',
    tableHeadBtnText: '#FFFFFF',
    tableHeadBtnHoverBg: 'rgba(255,255,255,0.26)',
    primaryBtnBg: '#7C421E',
    primaryBtnHoverBg: '#623315',
    primaryBtnText: '#FFFFFF',
    primaryBtnBorder: '#D97706',
    sidebarActiveBg: '#FEF3C7',
    sidebarActiveBorder: '#6F3B1B',
    sidebarActiveText: '#572D14',
  },
  {
    id: 'rose',
    label: 'Rose',
    description: 'Rose vif moderne identité marque',
    swatchHex: '#DB2777',
    swatchBorderHex: '#9D174D',
    isLight: false,
    panelBg: '#230917',
    panelElevatedBg: '#15050E',
    panelBorder: '#831843',
    panelText: '#FDF2F8',
    panelMutedText: '#F9A8D4',
    treeHoverBg: '#3E0D28',
    treeActiveBg: '#6B1242',
    stepTopBarBg: '#9D174D',
    stepTopBarText: '#FFFFFF',
    stepTopBarSubText: '#FBCFE8',
    stepTopBarBorder: '#831843',
    stepTopBarBtnBg: 'rgba(255,255,255,0.16)',
    stepTopBarBtnHoverBg: 'rgba(255,255,255,0.26)',
    stepTopBarBtnText: '#FFFFFF',
    tableHeadBg: '#DB2777',
    tableHeadText: '#FFFFFF',
    tableHeadDivider: '#9D174D',
    tableHeadBtnBg: 'rgba(255,255,255,0.18)',
    tableHeadBtnText: '#FFFFFF',
    tableHeadBtnHoverBg: 'rgba(255,255,255,0.28)',
    primaryBtnBg: '#DB2777',
    primaryBtnHoverBg: '#BE185D',
    primaryBtnText: '#FFFFFF',
    primaryBtnBorder: '#F472B6',
    sidebarActiveBg: '#FDF2F8',
    sidebarActiveBorder: '#DB2777',
    sidebarActiveText: '#9D174D',
  },
  {
    id: 'orange',
    label: 'Orange',
    description: 'Orange ambré dynamique & contrasté',
    swatchHex: '#EA580C',
    swatchBorderHex: '#9A3412',
    isLight: false,
    panelBg: '#210F05',
    panelElevatedBg: '#140802',
    panelBorder: '#7C2D12',
    panelText: '#FFF7ED',
    panelMutedText: '#FDBA74',
    treeHoverBg: '#3B1908',
    treeActiveBg: '#6B280A',
    stepTopBarBg: '#C2410C',
    stepTopBarText: '#FFFFFF',
    stepTopBarSubText: '#FED7AA',
    stepTopBarBorder: '#9A3412',
    stepTopBarBtnBg: 'rgba(255,255,255,0.16)',
    stepTopBarBtnHoverBg: 'rgba(255,255,255,0.26)',
    stepTopBarBtnText: '#FFFFFF',
    tableHeadBg: '#EA580C',
    tableHeadText: '#FFFFFF',
    tableHeadDivider: '#9A3412',
    tableHeadBtnBg: 'rgba(255,255,255,0.18)',
    tableHeadBtnText: '#FFFFFF',
    tableHeadBtnHoverBg: 'rgba(255,255,255,0.28)',
    primaryBtnBg: '#EA580C',
    primaryBtnHoverBg: '#C2410C',
    primaryBtnText: '#FFFFFF',
    primaryBtnBorder: '#FB923C',
    sidebarActiveBg: '#FFF7ED',
    sidebarActiveBorder: '#EA580C',
    sidebarActiveText: '#9A3412',
  },
];

export function isValidWorkflowThemeId(val: unknown): val is WorkflowThemeId {
  return (
    typeof val === 'string' &&
    WORKFLOW_THEMES.some((t) => t.id === val)
  );
}

export function getWorkflowTheme(
  themeId?: WorkflowThemeId | string | null
): WorkflowThemeDefinition {
  if (isValidWorkflowThemeId(themeId)) {
    return (
      WORKFLOW_THEMES.find((t) => t.id === themeId) ?? WORKFLOW_THEMES[2]
    );
  }
  return WORKFLOW_THEMES[2]; // Rouge Bordeaux par défaut
}

export function loadSavedWorkflowTheme(): WorkflowThemeId {
  if (typeof window === 'undefined') return 'bordeaux';
  try {
    const raw = window.localStorage.getItem(WORKFLOW_THEME_STORAGE_KEY);
    if (isValidWorkflowThemeId(raw)) return raw;
  } catch {
    // ignore storage errors
  }
  return 'bordeaux';
}

export function saveWorkflowTheme(themeId: WorkflowThemeId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WORKFLOW_THEME_STORAGE_KEY, themeId);
  } catch {
    // ignore storage errors
  }
}

export function applyWorkflowThemeToDocument(themeId: WorkflowThemeId): void {
  if (typeof document === 'undefined') return;
  const theme = getWorkflowTheme(themeId);
  const root = document.documentElement;
  root.setAttribute('data-workflow-theme', theme.id);
  root.style.setProperty('--wf-panel-bg', theme.panelBg);
  root.style.setProperty('--wf-panel-elevated', theme.panelElevatedBg);
  root.style.setProperty('--wf-panel-border', theme.panelBorder);
  root.style.setProperty('--wf-panel-text', theme.panelText);
  root.style.setProperty('--wf-panel-muted', theme.panelMutedText);
  root.style.setProperty('--wf-tree-hover', theme.treeHoverBg);
  root.style.setProperty('--wf-tree-active', theme.treeActiveBg);
  root.style.setProperty('--wf-step-bar-bg', theme.stepTopBarBg);
  root.style.setProperty('--wf-step-bar-text', theme.stepTopBarText);
  root.style.setProperty('--wf-step-bar-sub', theme.stepTopBarSubText);
  root.style.setProperty('--wf-step-bar-border', theme.stepTopBarBorder);
  root.style.setProperty('--wf-step-bar-btn-bg', theme.stepTopBarBtnBg);
  root.style.setProperty('--wf-step-bar-btn-hover', theme.stepTopBarBtnHoverBg);
  root.style.setProperty('--wf-step-bar-btn-text', theme.stepTopBarBtnText);
  root.style.setProperty('--wf-table-head-bg', theme.tableHeadBg);
  root.style.setProperty('--wf-table-head-text', theme.tableHeadText);
  root.style.setProperty('--wf-table-head-divider', theme.tableHeadDivider);
  root.style.setProperty('--wf-table-head-btn-bg', theme.tableHeadBtnBg);
  root.style.setProperty('--wf-table-head-btn-text', theme.tableHeadBtnText);
  root.style.setProperty('--wf-table-head-btn-hover', theme.tableHeadBtnHoverBg);
  root.style.setProperty('--wf-primary', theme.primaryBtnBg);
  root.style.setProperty('--wf-primary-hover', theme.primaryBtnHoverBg);
  root.style.setProperty('--wf-primary-text', theme.primaryBtnText);
  root.style.setProperty('--wf-primary-border', theme.primaryBtnBorder);
  root.style.setProperty('--wf-sidebar-active-bg', theme.sidebarActiveBg);
  root.style.setProperty('--wf-sidebar-active-border', theme.sidebarActiveBorder);
  root.style.setProperty('--wf-sidebar-active-text', theme.sidebarActiveText);
}
