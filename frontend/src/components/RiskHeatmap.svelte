<script>
  import { onDestroy, onMount } from 'svelte';

  export let apiUrl = '';
  export let region = 'madrid';
  export let months = 12;

  let loading = true;
  let error = '';
  let monthly = [];

  const toNum = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalizeBaseUrl = (raw) => String(raw ?? '').trim().replace(/\/+$/, '');

  const buildApiBases = (raw) => {
    const configured = normalizeBaseUrl(raw);
    const candidates = [];
    if (configured) candidates.push(configured);

    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        candidates.push(`${window.location.protocol}//${host}:8000`);
        candidates.push('http://localhost:8000');
        candidates.push('http://127.0.0.1:8000');
      }
    }

    candidates.push('');
    return [...new Set(candidates)];
  };

  const endpoint = (base, path) => {
    if (!base) return path;
    if (base.endsWith('/api') && path.startsWith('/api/')) return `${base}${path.slice(4)}`;
    return `${base}${path}`;
  };

  const fetchJson = async (path) => {
    const apiBases = buildApiBases(apiUrl);
    let lastError = null;
    for (const base of apiBases) {
      try {
        const res = await fetch(endpoint(base, path), { headers: { Accept: 'application/json' } });
        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
        return await res.json();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('network');
      }
    }
    throw lastError ?? new Error('network');
  };

  const FALLBACK_HISTORY_LIMIT = 120;

  const levelFromScore = (score) => {
    if (score >= 70) return { label: 'Acción', levelClass: 'action' };
    if (score >= 40) return { label: 'Vigilancia', levelClass: 'watch' };
    return { label: 'Rutina', levelClass: 'routine' };
  };

  const normalizeMonth = (item) => {
    const score = toNum(item?.combined_score, null);
    const level = score === null ? { label: 'Sin datos', levelClass: 'watch' } : levelFromScore(score);
    return {
      month: item?.month_label ?? 'N/A',
      score: score === null ? null : Math.round(score),
      ...level,
      sampleDays: toNum(item?.sample_days, 0),
      rainyDays: toNum(item?.rainy_days, 0),
      rainyRatioPct: toNum(item?.rainy_ratio_pct, 0),
      fungal: toNum(item?.avg_fungal_risk, 0),
      water: toNum(item?.avg_waterlogging_risk, 0),
      heat: toNum(item?.avg_heat_risk, 0),
    };
  };

  const combinedFromDay = (day) => {
    const fungal = Number(day?.fungal_risk);
    const water = Number(day?.waterlogging_risk);
    const heat = Number(day?.heat_risk);
    if (![fungal, water, heat].every(Number.isFinite)) return null;
    return {
      score: Math.round((fungal * 0.5) + (water * 0.3) + (heat * 0.2)),
      fungal,
      water,
      heat,
    };
  };

  const deriveMonthlyFromHistory = (historyItems) => {
    const byMonth = new Map();
    const ordered = [...historyItems].sort((a, b) => String(a.observed_on).localeCompare(String(b.observed_on)));

    for (const day of ordered) {
      const monthKey = String(day?.observed_on ?? '').slice(0, 7);
      if (!monthKey || monthKey.length < 7) continue;
      const values = combinedFromDay(day);
      if (!values) continue;
      const bucket = byMonth.get(monthKey) ?? [];
      bucket.push({ ...values, precip: toNum(day?.precipitation_mm, 0) });
      byMonth.set(monthKey, bucket);
    }

    return Array.from(byMonth.entries())
      .slice(-months)
      .map(([month, values]) => {
        const sampleDays = values.length;
        const rainyDays = values.filter((entry) => entry.precip > 0).length;
        const score = sampleDays
          ? Math.round(values.reduce((sum, entry) => sum + entry.score, 0) / sampleDays)
          : null;
        const fungal = sampleDays
          ? values.reduce((sum, entry) => sum + entry.fungal, 0) / sampleDays
          : 0;
        const water = sampleDays
          ? values.reduce((sum, entry) => sum + entry.water, 0) / sampleDays
          : 0;
        const heat = sampleDays
          ? values.reduce((sum, entry) => sum + entry.heat, 0) / sampleDays
          : 0;
        const rainyRatioPct = sampleDays ? (rainyDays / sampleDays) * 100 : 0;
        const level = score === null ? { label: 'Sin datos', levelClass: 'watch' } : levelFromScore(score);
        return {
          month,
          score,
          ...level,
          sampleDays,
          rainyDays,
          rainyRatioPct: Number(rainyRatioPct.toFixed(1)),
          fungal: Number(fungal.toFixed(1)),
          water: Number(water.toFixed(1)),
          heat: Number(heat.toFixed(1)),
        };
      })
      .reverse();
  };

  const fetchHeatmap = async () => {
    loading = true;
    error = '';
    try {
      try {
        const data = await fetchJson(`/api/risk/monthly?region=${encodeURIComponent(region)}&months=${months}`);
        const items = Array.isArray(data?.items) ? data.items : [];
        if (items.length > 0) {
          monthly = items.map(normalizeMonth).reverse();
          return;
        }
      } catch {
      }

      const fallbackLimit = Math.min(FALLBACK_HISTORY_LIMIT, Math.max(90, months * 30));
      const history = await fetchJson(`/api/history?region=${encodeURIComponent(region)}&limit=${fallbackLimit}`);
      const items = Array.isArray(history?.items) ? history.items : [];
      monthly = deriveMonthlyFromHistory(items);
    } catch (e) {
      monthly = [];
      error = 'Datos no disponibles.';
    } finally {
      loading = false;
    }
  };

  const handleRegionChange = (e) => {
    if (e.detail !== region) {
      region = e.detail;
      fetchHeatmap();
    }
  };

  const handleRefresh = () => {
    fetchHeatmap();
  };

  onMount(() => {
    fetchHeatmap();
    if (typeof window !== 'undefined') {
      window.addEventListener('regionchange', handleRegionChange);
      window.addEventListener('flowerxi:refresh', handleRefresh);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('regionchange', handleRegionChange);
      window.removeEventListener('flowerxi:refresh', handleRefresh);
    }
  });

  $: validScores = monthly.map((m) => m.score).filter((v) => Number.isFinite(v));
  $: avgScore = validScores.length ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : null;
  $: actionMonths = monthly.filter((m) => m.score !== null && m.score >= 70).length;
  $: watchMonths = monthly.filter((m) => m.score !== null && m.score >= 40 && m.score < 70).length;
  $: routineMonths = monthly.filter((m) => m.score !== null && m.score < 40).length;
  $: peakMonth = [...monthly]
    .filter((m) => m.score !== null)
    .sort((a, b) => b.score - a.score)[0];
</script>

<article class="risk-heatmap">
  <header class="head">
    <h3>Calendario de riesgo</h3>
    <p class="subtitle">Histórico ampliado de {months} meses — {region}</p>
  </header>

  {#if loading}
    <div class="heatmap-skeleton">
      {#each Array(6) as _}
        <div class="skeleton-row"></div>
      {/each}
    </div>
  {:else if error}
    <p class="state error">{error}</p>
  {:else if monthly.length === 0}
    <p class="state muted">No hay meses suficientes para construir el calendario ampliado.</p>
  {:else}
    <div class="summary-grid">
      <div class="summary-card">
        <span>Promedio período</span>
        <strong>{avgScore === null ? '—' : `${avgScore} pts`}</strong>
      </div>
      <div class="summary-card">
        <span>Mes más crítico</span>
        <strong>{peakMonth ? `${peakMonth.month} (${peakMonth.score})` : '—'}</strong>
      </div>
      <div class="summary-card">
        <span>Meses en acción</span>
        <strong>{actionMonths}</strong>
      </div>
      <div class="summary-card">
        <span>Vigilancia / rutina</span>
        <strong>{watchMonths} / {routineMonths}</strong>
      </div>
    </div>

    <div class="timeline">
      {#each monthly as month}
        <article class="timeline-row {month.levelClass}">
          <div class="row-top">
            <div>
              <p class="month">{month.month}</p>
              <p class="meta">{month.rainyDays}/{month.sampleDays} días lluviosos · {month.rainyRatioPct}%</p>
            </div>
            <div class="score-chip">
              <strong>{month.score === null ? '—' : month.score}</strong>
              <small>{month.label}</small>
            </div>
          </div>

          <div class="factors">
            <div class="factor">
              <span>Fúngico</span>
              <div class="bar"><i style={`width:${Math.max(0, Math.min(100, month.fungal))}%`}></i></div>
              <small>{month.fungal.toFixed(1)}</small>
            </div>
            <div class="factor">
              <span>Encharcamiento</span>
              <div class="bar"><i style={`width:${Math.max(0, Math.min(100, month.water))}%`}></i></div>
              <small>{month.water.toFixed(1)}</small>
            </div>
            <div class="factor">
              <span>Térmico</span>
              <div class="bar"><i style={`width:${Math.max(0, Math.min(100, month.heat))}%`}></i></div>
              <small>{month.heat.toFixed(1)}</small>
            </div>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</article>

<style>
   .risk-heatmap {
     background: var(--bg-surface, #fff);
     border: 1px solid var(--border-subtle, #e2e8f0);
     border-radius: 16px;
     padding: 1.25rem;
     display: grid;
     gap: 0.95rem;
     box-shadow: var(--shadow-sm, 0 1px 3px rgba(31, 41, 55, 0.06));
   }

  .head h3 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-primary, #1f2937);
  }

  .subtitle {
    margin: 0.2rem 0 0;
    font-size: 0.82rem;
    color: var(--text-secondary, #64748b);
  }

  .state {
    margin: 0;
    font-size: 0.85rem;
  }

  .state.muted {
    color: var(--text-secondary, #64748b);
  }

  .state.error {
    color: #b91c1c;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .summary-card {
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 10px;
    background: var(--bg-app, #f8fafc);
    padding: 0.62rem;
    display: grid;
    gap: 0.25rem;
  }

  .summary-card span {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-secondary, #64748b);
  }

  .summary-card strong {
    font-size: 0.95rem;
    color: var(--text-primary, #1f2937);
  }

  .timeline {
    display: grid;
    gap: 0.55rem;
  }

  .timeline-row {
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 12px;
    padding: 0.68rem;
    display: grid;
    gap: 0.55rem;
    background: #fff;
  }

  .timeline-row.routine {
    background: #ecfdf5;
    border-color: #a7f3d0;
  }

  .timeline-row.watch {
    background: #fffbeb;
    border-color: #fde68a;
  }

  .timeline-row.action {
    background: #fef2f2;
    border-color: #fecaca;
  }

  .row-top {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    align-items: center;
  }

  .month {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary, #1f2937);
  }

  .meta {
    margin: 0.15rem 0 0;
    font-size: 0.74rem;
    color: var(--text-secondary, #64748b);
  }

  .score-chip {
    min-width: 86px;
    border-radius: 10px;
    padding: 0.42rem 0.5rem;
    border: 1px solid var(--border-subtle, #e2e8f0);
    text-align: center;
    background: rgba(255, 255, 255, 0.82);
  }

  .score-chip strong {
    display: block;
    font-size: 0.98rem;
    color: var(--text-primary, #111827);
    line-height: 1;
  }

  .score-chip small {
    font-size: 0.72rem;
    color: var(--text-secondary, #64748b);
  }

  .factors {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .factor {
    display: grid;
    gap: 0.18rem;
  }

  .factor span {
    font-size: 0.72rem;
    color: var(--text-secondary, #64748b);
  }

  .bar {
    width: 100%;
    height: 7px;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.24);
    overflow: hidden;
  }

  .bar i {
    display: block;
    height: 100%;
    background: var(--primary, #7b5ba6);
  }

  .factor small {
    font-size: 0.72rem;
    color: var(--text-tertiary, #64748b);
  }

  .heatmap-skeleton {
    display: grid;
    gap: 0.5rem;
  }

  .skeleton-row {
    height: 58px;
    border-radius: 10px;
    background: linear-gradient(90deg, var(--border-subtle, #e2e8f0) 25%, var(--bg-app, #f1f5f9) 50%, var(--border-subtle, #e2e8f0) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite linear;
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  @media (max-width: 1050px) {
    .summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .factors {
      grid-template-columns: 1fr;
    }
  }
</style>
