export type Statut = 'R' | 'A' | 'P' | 'N';

export type Risque = 'C' | 'J' | 'O';

export type ThemeId =
  | ''
  | 'light'
  | 'dark'
  | 'ocean'
  | 'foret'
  | 'prune'
  | 'graphite';

export interface Reco {
  n: number;
  titre: string;
  risque: Risque;
  statut: Statut;
  direction: number;
  cycle: number;
  echeance: string;
  report?: string;
}

export interface ThemeOption {
  value: ThemeId;
  label: string;
}
