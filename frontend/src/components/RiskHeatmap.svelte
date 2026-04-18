<script>
  import { onDestroy, onMount } from 'svelte';

  export let apiUrl = '';
  export let region = 'madrid';
  export let months = 6;

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
    if (base.endsWith('/api') && path.startsWith('/api/')) {
      return `${base}${path.slice(4)}`;
    }
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

  const levelFromScore = (score) => {
    if (score >= 70) return { label: 'Acción', levelClass: 'action' };
    if (score >= 40) return { label: 'Vigilancia', levelClass: 'watch' };
    return { label: 'Rutina', levelClass: 'routine' };
  };

  const parseMonthItem = (item) => {
    const rawScore = Number(item?.combined_score);
    const score = Number.isFinite(rawScore) ? Math.round(rawScore) : null;
    const month = item?.month_label ?? item?.month ?? 'Mes';
    const level = score === null ? { label: 'Sin datos', levelClass: 'watch' } : levelFromScore(score);
    return { month, score, ...level };
  };

  const fetchHeatmap = async () => {
    loading = true;
    error = '';
    try {
      const data = await fetchJson(`/api/risk/monthly?region=${encodeURIComponent(region)}&months=${months}`);
      const items = Array.isArray(data?.items) ? data.items : [];
      monthly = items.map(parseMonthItem);
    } catch (e) {
      monthly = [];
      error = 'Datos no disponibles.';
      console.error(e);
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
</script>

<article class="risk-heatmap">
  <h3>Calendario de riesgo</h3>
  <p class="subtitle">Últimos {months} meses — {region}</p>

  {#if loading}
    <div class="heatmap-skeleton">
      {#each Array(months) as _}
        <div class="skeleton-month"></div>
      {/each}
    </div>
  {:else if error}
    <p class="state error">{error}</p>
  {:else if monthly.length === 0}
    <p class="state muted">Aún no hay datos suficientes para construir el calendario.</p>
  {:else}
    <div class="heatmap-grid">
      {#each monthly as month}
        <article class="month-cell {month.levelClass}">
          <span class="month">{month.month}</span>
          <strong>{month.score === null ? '—' : month.score}</strong>
          <small>{month.label}</small>
        </article>
      {/each}
    </div>
    <div class="legend">
      <span class="dot routine"></span> Rutina
      <span class="dot watch"></span> Vigilancia
      <span class="dot action"></span> Acción
    </div>
  {/if}
</article>

<style>
  .risk-heatmap { background: var(--bg-surface, #fff); border: 1px solid var(--border-subtle, #e2e8f0); border-radius: 16px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; box-shadow: var(--shadow-sm, 0 1px 3px rgba(31,41,55,0.06)); }
  .risk-heatmap h3 { margin: 0; font-size: 1.1rem; font-weight: 600; color: var(--text-primary, #1f2937); }
  .subtitle { margin: 0; font-size: 0.8rem; color: var(--text-secondary, #64748b); }

  .state {
    margin: 0;
    font-size: 0.85rem;
  }
  .state.muted { color: var(--text-secondary, #64748b); }
  .state.error { color: #b91c1c; }

  .heatmap-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.6rem;
  }

  .month-cell {
    border-radius: 12px;
    padding: 0.72rem;
    display: grid;
    gap: 0.22rem;
    border: 1px solid transparent;
  }

  .month-cell .month {
    font-size: 0.74rem;
    color: var(--text-secondary, #64748b);
  }

  .month-cell strong {
    font-size: 1.15rem;
    line-height: 1;
    color: var(--text-primary, #111827);
  }

  .month-cell small {
    font-size: 0.76rem;
    font-weight: 600;
  }

  .month-cell.routine {
    background: #ecfdf5;
    border-color: #a7f3d0;
  }

  .month-cell.watch {
    background: #fffbeb;
    border-color: #fde68a;
  }

  .month-cell.action {
    background: #fef2f2;
    border-color: #fecaca;
  }

  .month-cell.routine small { color: #047857; }
  .month-cell.watch small { color: #b45309; }
  .month-cell.action small { color: #b91c1c; }

  .legend {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.76rem;
    color: var(--text-secondary, #64748b);
    flex-wrap: wrap;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    display: inline-block;
    margin-left: 0.4rem;
  }

  .dot.routine { background: #10b981; }
  .dot.watch { background: #f59e0b; }
  .dot.action { background: #ef4444; }

  .heatmap-skeleton {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    padding: 0.35rem 0;
  }

  .skeleton-month {
    height: 62px;
    background: linear-gradient(90deg, var(--border-subtle, #e2e8f0) 25%, var(--bg-app, #f1f5f9) 50%, var(--border-subtle, #e2e8f0) 75%);
    background-size: 200% 100%;
    border-radius: 8px;
    animation: shimmer 1.5s infinite linear;
  }

  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

  @media (max-width: 900px) {
    .heatmap-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .heatmap-skeleton { grid-template-columns: repeat(2, 1fr); }
  }
</style>
