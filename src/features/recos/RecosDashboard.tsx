import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  CYCLES,
  DIRECTIONS,
  MOIS_LABELS,
  RISQUE_COLORS,
  RISQUE_LABELS,
  RISQUE_ORDER,
  STATUT_COLORS,
  STATUT_LABELS,
  STATUT_ORDER,
  THEMES,
  THEME_STORAGE_KEY,
} from './constants';
import { RECOS_DEMO } from './data';
import './recos.css';
import type { Reco, Risque, Statut, ThemeId } from './types';

export interface RecosDashboardProps {
  recos?: Reco[];
  today?: Date;
  className?: string;
}

interface FilterState {
  statut: '' | Statut;
  risque: '' | Risque;
  direction: '' | number;
  cycle: '' | number;
  query: string;
}

interface EnrichedReco extends Reco {
  effDate: Date;
  late: boolean;
}

const VALID_THEME_IDS = new Set<string>(THEMES.map((t) => t.value));

function parseIsoLocal(iso: string): Date {
  const parts = iso.split('-');
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day)
    ) {
      return new Date(year, month - 1, day);
    }
  }
  const fallback = new Date(iso);
  if (Number.isNaN(fallback.getTime())) {
    return new Date(2025, 0, 1);
  }
  return new Date(
    fallback.getFullYear(),
    fallback.getMonth(),
    fallback.getDate()
  );
}

function formatIsoFr(iso?: string): string {
  if (!iso) return '–';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
}

function normalizeMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildSlicePolygon(startPct: number, endPct: number): string {
  const span = endPct - startPct;
  if (span >= 99.9) {
    return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
  }
  const steps = Math.max(4, Math.ceil(span / 4));
  const points: string[] = ['50% 50%'];
  for (let i = 0; i <= steps; i += 1) {
    const pct = startPct + (span * i) / steps;
    const rad = (pct / 100) * 2 * Math.PI - Math.PI / 2;
    const x = 50 + 55 * Math.cos(rad);
    const y = 50 + 55 * Math.sin(rad);
    points.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return `polygon(${points.join(', ')})`;
}

function readStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY) ?? '';
    return VALID_THEME_IDS.has(raw) ? (raw as ThemeId) : '';
  } catch {
    return '';
  }
}

export const RecosDashboard: React.FC<RecosDashboardProps> = ({
  recos = RECOS_DEMO,
  today,
  className = '',
}) => {
  const uid = useId();
  const [theme, setTheme] = useState<ThemeId>(() => readStoredTheme());
  const [filters, setFilters] = useState<FilterState>({
    statut: '',
    risque: '',
    direction: '',
    cycle: '',
    query: '',
  });

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors (private mode / blocked storage)
    }
  }, [theme]);

  const refDate = useMemo(
    () => normalizeMidnight(today ?? new Date()),
    [today]
  );

  const enrichedRecos = useMemo<EnrichedReco[]>(
    () =>
      recos.map((r) => {
        const effIso = r.report && r.report.trim() ? r.report : r.echeance;
        const effDate = parseIsoLocal(effIso);
        const late = r.statut !== 'R' && effDate < refDate;
        return {
          ...r,
          effDate,
          late,
        };
      }),
    [recos, refDate]
  );

  const directionKeys = useMemo(() => {
    const maxIndex = enrichedRecos.reduce(
      (max, r) => Math.max(max, r.direction),
      DIRECTIONS.length - 1
    );
    return Array.from({ length: maxIndex + 1 }, (_, i) => i);
  }, [enrichedRecos]);

  const cycleKeys = useMemo(() => {
    const maxIndex = enrichedRecos.reduce(
      (max, r) => Math.max(max, r.cycle),
      CYCLES.length - 1
    );
    return Array.from({ length: maxIndex + 1 }, (_, i) => i);
  }, [enrichedRecos]);

  const getDirectionName = (index: number): string =>
    DIRECTIONS[index] ?? `Direction ${index + 1}`;

  const getCycleName = (index: number): string =>
    CYCLES[index] ?? `Cycle ${index + 1}`;

  const queryLower = filters.query.trim().toLowerCase();

  const matchesFilters = useMemo(() => {
    return (
      r: EnrichedReco,
      skip?: 'statut' | 'risque' | 'direction' | 'cycle'
    ): boolean => {
      if (skip !== 'statut' && filters.statut && r.statut !== filters.statut) {
        return false;
      }
      if (skip !== 'risque' && filters.risque && r.risque !== filters.risque) {
        return false;
      }
      if (
        skip !== 'direction' &&
        filters.direction !== '' &&
        r.direction !== filters.direction
      ) {
        return false;
      }
      if (
        skip !== 'cycle' &&
        filters.cycle !== '' &&
        r.cycle !== filters.cycle
      ) {
        return false;
      }
      if (queryLower && !r.titre.toLowerCase().includes(queryLower)) {
        return false;
      }
      return true;
    };
  }, [filters.statut, filters.risque, filters.direction, filters.cycle, queryLower]);

  const filteredRecos = useMemo(
    () => enrichedRecos.filter((r) => matchesFilters(r)),
    [enrichedRecos, matchesFilters]
  );

  const kpis = useMemo(() => {
    const totalFiltered = filteredRecos.length;
    const denom = totalFiltered || 1;
    let done = 0;
    let late = 0;
    let critOpen = 0;
    let reported = 0;

    for (const r of filteredRecos) {
      if (r.statut === 'R') done += 1;
      if (r.late) late += 1;
      if (r.risque === 'C' && r.statut !== 'R') critOpen += 1;
      if (r.report && r.report.trim().length > 0) reported += 1;
    }

    return {
      totalFiltered,
      pctDone: Math.round((done / denom) * 100),
      done,
      late,
      critOpen,
      reported,
    };
  }, [filteredRecos]);

  const donutData = useMemo(() => {
    const denom = filteredRecos.length || 1;
    let acc = 0;
    const stops: string[] = [];
    const slices: Array<{
      statut: Statut;
      count: number;
      startPct: number;
      endPct: number;
      clipPath: string;
    }> = [];

    for (const st of STATUT_ORDER) {
      const count = filteredRecos.filter((r) => r.statut === st).length;
      const startPct = acc;
      acc += (count / denom) * 100;
      const endPct = acc;
      stops.push(`${STATUT_COLORS[st]} ${startPct}% ${endPct}%`);
      if (count > 0) {
        slices.push({
          statut: st,
          count,
          startPct,
          endPct,
          clipPath: buildSlicePolygon(startPct, endPct),
        });
      }
    }

    const legendItems = STATUT_ORDER.map((st) => ({
      statut: st,
      label: STATUT_LABELS[st],
      color: STATUT_COLORS[st],
      count: enrichedRecos.filter(
        (r) => matchesFilters(r, 'statut') && r.statut === st
      ).length,
    }));

    return {
      gradient: filteredRecos.length
        ? `conic-gradient(${stops.join(', ')})`
        : 'conic-gradient(var(--rd-bd) 0 100%)',
      slices,
      legendItems,
    };
  }, [enrichedRecos, filteredRecos, matchesFilters]);

  const matrixGrid = useMemo(() => {
    const base = enrichedRecos.filter(
      (r) =>
        (filters.direction === '' || r.direction === filters.direction) &&
        (filters.cycle === '' || r.cycle === filters.cycle) &&
        (!queryLower || r.titre.toLowerCase().includes(queryLower))
    );

    const grid: Record<Risque, Record<Statut, number>> = {
      C: { R: 0, A: 0, P: 0, N: 0 },
      J: { R: 0, A: 0, P: 0, N: 0 },
      O: { R: 0, A: 0, P: 0, N: 0 },
    };

    for (const r of base) {
      grid[r.risque][r.statut] += 1;
    }
    return grid;
  }, [enrichedRecos, filters.direction, filters.cycle, queryLower]);

  const cycleBars = useMemo(() => {
    const perCycle = cycleKeys.map((k) => {
      const items = enrichedRecos.filter(
        (r) => matchesFilters(r, 'cycle') && r.cycle === k
      );
      const segments = STATUT_ORDER.map((s) => ({
        statut: s,
        count: items.filter((r) => r.statut === s).length,
      }));
      return { key: k, name: getCycleName(k), total: items.length, segments };
    });

    const maxScale = Math.max(
      10,
      ...cycleKeys.map(
        (k) => enrichedRecos.filter((r) => r.cycle === k).length
      )
    );

    return {
      maxScale,
      rows: perCycle.filter((row) => row.total > 0 || filters.cycle !== ''),
    };
  }, [cycleKeys, enrichedRecos, filters.cycle, matchesFilters]);

  const directionBars = useMemo(() => {
    const maxScale = Math.max(
      1,
      ...directionKeys.map(
        (k) => enrichedRecos.filter((r) => r.direction === k).length
      )
    );

    const rows = directionKeys
      .map((k) => {
        const items = enrichedRecos.filter(
          (r) => matchesFilters(r, 'direction') && r.direction === k
        );
        const segments = STATUT_ORDER.map((s) => ({
          statut: s,
          count: items.filter((r) => r.statut === s).length,
        }));
        return {
          key: k,
          name: getDirectionName(k),
          total: items.length,
          segments,
        };
      })
      .filter((row) => row.total > 0 || filters.direction !== '');

    return { maxScale, rows };
  }, [directionKeys, enrichedRecos, filters.direction, matchesFilters]);

  const monthlyBars = useMemo(() => {
    const groups = new Map<
      number,
      { sortKey: number; label: string; items: EnrichedReco[] }
    >();

    for (const r of filteredRecos) {
      const year = r.effDate.getFullYear();
      const month = r.effDate.getMonth();
      const sortKey = year * 12 + month;
      const existing = groups.get(sortKey);
      if (existing) {
        existing.items.push(r);
      } else {
        groups.set(sortKey, {
          sortKey,
          label: `${MOIS_LABELS[month]} ${year}`,
          items: [r],
        });
      }
    }

    const sorted = Array.from(groups.values()).sort(
      (a, b) => a.sortKey - b.sortKey
    );
    const maxScale = Math.max(1, ...sorted.map((g) => g.items.length));

    return {
      maxScale,
      rows: sorted.map((g) => ({
        sortKey: g.sortKey,
        label: g.label,
        total: g.items.length,
        segments: STATUT_ORDER.map((s) => ({
          statut: s,
          count: g.items.filter((r) => r.statut === s).length,
        })),
      })),
    };
  }, [filteredRecos]);

  const toggleStatut = (st: Statut) => {
    setFilters((prev) => ({
      ...prev,
      statut: prev.statut === st ? '' : st,
    }));
  };

  const toggleDirection = (dir: number) => {
    setFilters((prev) => ({
      ...prev,
      direction: prev.direction === dir ? '' : dir,
    }));
  };

  const toggleCycle = (cy: number) => {
    setFilters((prev) => ({
      ...prev,
      cycle: prev.cycle === cy ? '' : cy,
    }));
  };

  const toggleMatrixCell = (rk: Risque, st: Statut) => {
    setFilters((prev) => {
      if (prev.risque === rk && prev.statut === st) {
        return { ...prev, risque: '', statut: '' };
      }
      return { ...prev, risque: rk, statut: st };
    });
  };

  const resetFilters = () => {
    setFilters({
      statut: '',
      risque: '',
      direction: '',
      cycle: '',
      query: '',
    });
  };

  const themeAttr = theme === '' ? undefined : theme;

  return (
    <div
      className={`rd ${className}`.trim()}
      data-theme={themeAttr}
    >
      <header className="rd-header">
        <div>
          <h1 className="rd-title">Suivi des recommandations d’audit</h1>
          <small className="rd-sub">
            {recos.length} recommandations suivies · situation au{' '}
            {refDate.toLocaleDateString('fr-FR')}
          </small>
        </div>

        <label className="rd-field rd-theme-field" htmlFor={`${uid}-theme`}>
          Thème du tableau de bord
          <select
            id={`${uid}-theme`}
            className="rd-control"
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeId)}
          >
            {THEMES.map((opt) => (
              <option key={opt.value || 'auto'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div className="rd-filters">
          <label className="rd-field rd-field-search" htmlFor={`${uid}-search`}>
            Recherche
            <input
              id={`${uid}-search`}
              type="text"
              className="rd-control"
              placeholder="Mot de l’intitulé"
              value={filters.query}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, query: e.target.value }))
              }
            />
          </label>

          <label className="rd-field" htmlFor={`${uid}-statut`}>
            Statut
            <select
              id={`${uid}-statut`}
              className="rd-control"
              value={filters.statut}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  statut: e.target.value as '' | Statut,
                }))
              }
            >
              <option value="">Tous les statuts</option>
              {STATUT_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="rd-field" htmlFor={`${uid}-risque`}>
            Niveau de risque
            <select
              id={`${uid}-risque`}
              className="rd-control"
              value={filters.risque}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  risque: e.target.value as '' | Risque,
                }))
              }
            >
              <option value="">Tous les risques</option>
              {RISQUE_ORDER.map((rk) => (
                <option key={rk} value={rk}>
                  {RISQUE_LABELS[rk]}
                </option>
              ))}
            </select>
          </label>

          <label className="rd-field" htmlFor={`${uid}-direction`}>
            Direction
            <select
              id={`${uid}-direction`}
              className="rd-control"
              value={filters.direction === '' ? '' : String(filters.direction)}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  direction:
                    e.target.value === '' ? '' : Number(e.target.value),
                }))
              }
            >
              <option value="">Toutes les directions</option>
              {directionKeys.map((i) => (
                <option key={i} value={String(i)}>
                  {getDirectionName(i)}
                </option>
              ))}
            </select>
          </label>

          <label className="rd-field" htmlFor={`${uid}-cycle`}>
            Cycle
            <select
              id={`${uid}-cycle`}
              className="rd-control"
              value={filters.cycle === '' ? '' : String(filters.cycle)}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  cycle: e.target.value === '' ? '' : Number(e.target.value),
                }))
              }
            >
              <option value="">Tous les cycles</option>
              {cycleKeys.map((i) => (
                <option key={i} value={String(i)}>
                  {getCycleName(i)}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className="rd-btn" onClick={resetFilters}>
            Réinitialiser
          </button>
        </div>
      </header>

      <main className="rd-main">
        {/* 5 indicateurs */}
        <section className="rd-kpis" aria-label="Indicateurs clés">
          <div className="rd-card rd-kpi">
            <span className="rd-kpi-label">Recommandations</span>
            <b className="rd-kpi-val">{kpis.totalFiltered}</b>
            <span className="rd-kpi-sub">dans la sélection</span>
          </div>

          <div className="rd-card rd-kpi">
            <span className="rd-kpi-label">Taux de réalisation</span>
            <b className="rd-kpi-val">{kpis.pctDone}%</b>
            <span className="rd-kpi-sub">{kpis.done} réalisées</span>
          </div>

          <div className="rd-card rd-kpi">
            <span className="rd-kpi-label">En retard</span>
            <b className="rd-kpi-val">{kpis.late}</b>
            <span className="rd-kpi-sub">échéance dépassée, non réalisées</span>
          </div>

          <div className="rd-card rd-kpi">
            <span className="rd-kpi-label">Critiques ouvertes</span>
            <b className="rd-kpi-val">{kpis.critOpen}</b>
            <span className="rd-kpi-sub">risque critique non réalisé</span>
          </div>

          <div className="rd-card rd-kpi">
            <span className="rd-kpi-label">Reports</span>
            <b className="rd-kpi-val">{kpis.reported}</b>
            <span className="rd-kpi-sub">délai prolongé</span>
          </div>
        </section>

        {/* Ligne 1 : Anneau statuts, Matrice Risque x Statut, Avancement par cycle */}
        <section className="rd-grid" aria-label="Analyse par statut, risque et cycle">
          <div className="rd-card">
            <h2 className="rd-h2">Répartition par statut</h2>
            <div className="rd-dn">
              <div
                className="rd-ring"
                style={{ background: donutData.gradient }}
              >
                {donutData.slices.map((slice) => (
                  <button
                    key={slice.statut}
                    type="button"
                    className="rd-ring-slice"
                    style={{ clipPath: slice.clipPath }}
                    aria-label={`Filtrer par statut « ${STATUT_LABELS[slice.statut]} » (${slice.count})`}
                    aria-pressed={filters.statut === slice.statut}
                    title={`${STATUT_LABELS[slice.statut]} : ${slice.count}`}
                    onClick={() => toggleStatut(slice.statut)}
                  />
                ))}
                <i className="rd-ring-pct" aria-hidden="true">
                  {kpis.pctDone}%
                </i>
              </div>

              <div className="rd-lg">
                {donutData.legendItems.map((item) => {
                  const active = filters.statut === item.statut;
                  return (
                    <button
                      key={item.statut}
                      type="button"
                      className="rd-lg-btn"
                      aria-pressed={active}
                      onClick={() => toggleStatut(item.statut)}
                    >
                      <em
                        className="rd-lg-dot"
                        style={{ background: item.color }}
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                      <b>{item.count}</b>
                      {active && <span className="rd-chip">filtre ×</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rd-card">
            <h2 className="rd-h2">Risque × statut</h2>
            <div className="rd-hm">
              <div className="rd-hm-h" />
              {STATUT_ORDER.map((s) => (
                <div key={s} className="rd-hm-h">
                  {STATUT_LABELS[s]}
                </div>
              ))}
              {RISQUE_ORDER.map((rk) => (
                <React.Fragment key={rk}>
                  <div className="rd-hm-row-h">{RISQUE_LABELS[rk]}</div>
                  {STATUT_ORDER.map((st) => {
                    const count = matrixGrid[rk][st];
                    const opacity = count
                      ? 0.25 + Math.min(count, 12) / 16
                      : 0.1;
                    const active =
                      filters.risque === rk && filters.statut === st;
                    return (
                      <button
                        key={`${rk}-${st}`}
                        type="button"
                        className="rd-hm-cell"
                        aria-pressed={active}
                        aria-label={`${RISQUE_LABELS[rk]} · ${STATUT_LABELS[st]} : ${count}`}
                        style={{
                          background: RISQUE_COLORS[rk],
                          opacity,
                          outline: active ? '2px solid var(--rd-tx)' : undefined,
                        }}
                        onClick={() => toggleMatrixCell(rk, st)}
                      >
                        {count}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="rd-card">
            <h2 className="rd-h2">Avancement par cycle</h2>
            <div>
              {cycleBars.rows.map((row) => {
                const active = filters.cycle === row.key;
                return (
                  <button
                    key={row.key}
                    type="button"
                    className="rd-bar"
                    aria-pressed={active}
                    onClick={() => toggleCycle(row.key)}
                  >
                    <span title={row.name}>{row.name}</span>
                    <div
                      className="rd-tr"
                      style={{
                        width: `${(row.total / cycleBars.maxScale) * 100}%`,
                        minWidth: '4px',
                      }}
                    >
                      {row.segments.map((seg) =>
                        seg.count ? (
                          <u
                            key={seg.statut}
                            className="rd-tr-seg"
                            style={{
                              flex: seg.count,
                              background: STATUT_COLORS[seg.statut],
                            }}
                            title={`${STATUT_LABELS[seg.statut]} : ${seg.count}`}
                          />
                        ) : null
                      )}
                    </div>
                    <b>{row.total}</b>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Ligne 2 : Avancement par direction et Échéances par mois */}
        <section className="rd-grid-wide" aria-label="Analyse par direction et échéances">
          <div className="rd-card">
            <h2 className="rd-h2">Avancement par direction</h2>
            <div>
              {directionBars.rows.map((row) => {
                const active = filters.direction === row.key;
                return (
                  <button
                    key={row.key}
                    type="button"
                    className="rd-bar"
                    aria-pressed={active}
                    onClick={() => toggleDirection(row.key)}
                  >
                    <span title={row.name}>{row.name}</span>
                    <div
                      className="rd-tr"
                      style={{
                        width: `${(row.total / directionBars.maxScale) * 100}%`,
                        minWidth: '4px',
                      }}
                    >
                      {row.segments.map((seg) =>
                        seg.count ? (
                          <u
                            key={seg.statut}
                            className="rd-tr-seg"
                            style={{
                              flex: seg.count,
                              background: STATUT_COLORS[seg.statut],
                            }}
                            title={`${STATUT_LABELS[seg.statut]} : ${seg.count}`}
                          />
                        ) : null
                      )}
                    </div>
                    <b>{row.total}</b>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rd-card">
            <h2 className="rd-h2">
              Échéances par mois (délai initial ou reporté)
            </h2>
            <div>
              {monthlyBars.rows.length === 0 ? (
                <p className="rd-empty">Aucune donnée</p>
              ) : (
                monthlyBars.rows.map((row) => (
                  <div key={row.sortKey} className="rd-bar-static">
                    <span>{row.label}</span>
                    <div
                      className="rd-tr"
                      style={{
                        width: `${(row.total / monthlyBars.maxScale) * 100}%`,
                      }}
                    >
                      {row.segments.map((seg) =>
                        seg.count ? (
                          <u
                            key={seg.statut}
                            className="rd-tr-seg"
                            style={{
                              flex: seg.count,
                              background: STATUT_COLORS[seg.statut],
                            }}
                            title={`${STATUT_LABELS[seg.statut]} : ${seg.count}`}
                          />
                        ) : null
                      )}
                    </div>
                    <b>{row.total}</b>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Tableau détaillé */}
        <section className="rd-card" aria-label="Détail des recommandations">
          <h2 className="rd-h2">
            Détail des recommandations{' '}
            <span className="rd-cnt">({filteredRecos.length})</span>
          </h2>
          <div className="rd-tw">
            <table className="rd-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Recommandation</th>
                  <th>Cycle</th>
                  <th>Direction</th>
                  <th>Risque</th>
                  <th>Statut</th>
                  <th>Échéance</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecos.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      Aucune recommandation ne correspond aux filtres.
                    </td>
                  </tr>
                ) : (
                  filteredRecos.map((r) => (
                    <tr key={r.n}>
                      <td>{r.n}</td>
                      <td>{r.titre}</td>
                      <td>{getCycleName(r.cycle)}</td>
                      <td>{getDirectionName(r.direction)}</td>
                      <td>
                        <span
                          className="rd-pill rd-pill-risk"
                          style={{ background: RISQUE_COLORS[r.risque] }}
                        >
                          {RISQUE_LABELS[r.risque]}
                        </span>
                      </td>
                      <td>
                        <span
                          className="rd-pill"
                          style={{ background: STATUT_COLORS[r.statut] }}
                        >
                          {STATUT_LABELS[r.statut]}
                        </span>
                      </td>
                      <td className={r.late && !r.report ? 'rd-late' : undefined}>
                        {formatIsoFr(r.echeance)}
                      </td>
                      <td className={r.late && r.report ? 'rd-late' : undefined}>
                        {r.report ? formatIsoFr(r.report) : '–'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};
