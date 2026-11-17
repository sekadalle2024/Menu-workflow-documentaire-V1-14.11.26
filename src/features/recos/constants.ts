import type { Risque, Statut, ThemeOption } from './types';

export const DIRECTIONS: readonly string[] = [
  'Audit Interne',
  'Réseau & Agences',
  'Financière & Comptable',
  'Achats & Logistique',
  'Commerciale',
  'Ressources Humaines',
  'Moyens Généraux',
  'Juridique',
  'Systèmes d’Information',
  'Risques',
  'Engagements',
  'Technique',
  'Opérations',
  'Conformité',
  'Contrôle Permanent',
];

export const CYCLES: readonly string[] = [
  'Trésorerie',
  'Achats',
  'Ventes',
  'Paie & RH',
  'Immobilisations',
  'Stocks',
  'Comptabilité',
  'Crédits',
  'Systèmes d’Information',
  'Gouvernance & Conformité',
];

export const STATUT_ORDER: readonly Statut[] = ['R', 'A', 'P', 'N'];

export const STATUT_LABELS: Record<Statut, string> = {
  R: 'Réalisé',
  A: 'En attente',
  P: 'Reporté',
  N: 'Non réalisé',
};

export const STATUT_COLORS: Record<Statut, string> = {
  R: 'var(--rd-R)',
  A: 'var(--rd-A)',
  P: 'var(--rd-P)',
  N: 'var(--rd-N)',
};

export const RISQUE_ORDER: readonly Risque[] = ['C', 'J', 'O'];

export const RISQUE_LABELS: Record<Risque, string> = {
  C: 'Critique',
  J: 'Majeur',
  O: 'Modéré',
};

export const RISQUE_COLORS: Record<Risque, string> = {
  C: 'var(--rd-C)',
  J: 'var(--rd-J)',
  O: 'var(--rd-O)',
};

export const MOIS_LABELS: readonly string[] = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

export const THEMES: readonly ThemeOption[] = [
  { value: '', label: 'Automatique' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'ocean', label: 'Océan' },
  { value: 'foret', label: 'Forêt' },
  { value: 'prune', label: 'Prune' },
  { value: 'graphite', label: 'Graphite' },
];

export const THEME_STORAGE_KEY = 'recos-theme';
