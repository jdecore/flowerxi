<script>
  import { onDestroy, onMount } from 'svelte';
  import { fetchJsonCached } from '../lib/api/client.js';

export let apiUrl = '';
export let initialRegion = 'madrid';

  const monthFormatter = new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' });

  let region = initialRegion;
  let loading = true;
  let error = '';
  let avgPricePerKg = null;
  let topDestination = null;
  let exportsSummary = null;
  let peakMonths = [];

  const toNum = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const fetchJson = async (path) => {
    return fetchJsonCached(path, {
      apiUrl,
      cacheTtlMs: 60_000,
      throwOnError: true,
    });
  };

  const parseMonth = (yearMonth) => {
    const [year, month] = String(yearMonth || '').split('-').map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
    return new Date(year, month - 1, 1);
  };

  const loadCommercial = async () => {
    loading = true;
    error = '';
    avgPricePerKg = null;
    topDestination = null;
    exportsSummary = null;
    peakMonths = [];

    try {
      const exportsData = await fetchJson('/api/exports?months=12');

      if (exportsData?.summary) {
        exportsSummary = exportsData.summary;
        avgPricePerKg = toNum(exportsData.summary.avg_price_per_kg, null);
      }

      const exportItems = Array.isArray(exportsData?.items) ? exportsData.items : [];
      const byDestination = new Map();
      exportItems.forEach((item) => {
        const key = String(item?.country_dest || '').trim();
        if (!key) return;
        byDestination.set(key, toNum(byDestination.get(key), 0) + toNum(item?.fob_usd, 0));
      });
      topDestination = [...byDestination.entries()]
        .sort((a, b) => b[1] - a[1])[0] ?? null;

      const byMonth = exportsData?.by_month && typeof exportsData.by_month === 'object'
        ? Object.entries(exportsData.by_month)
        : [];
      peakMonths = byMonth
        .map(([month, values]) => ({
          month,
          fobUsd: toNum(values?.fob_usd, 0),
          date: parseMonth(month),
        }))
        .filter((item) => item.date)
        .sort((a, b) => b.fobUsd - a.fobUsd)
        .slice(0, 3);
    } catch (err) {
      error = 'Datos no disponibles.';
    } finally {
      loading = false;
    }
  };

  const formatM = (value) => `${(toNum(value) / 1_000_000).toFixed(1)}M`;

  const onRegionChange = async (event) => {
    if (!event?.detail || event.detail === region) return;
    region = event.detail;
    await loadCommercial();
  };

  const onRefresh = async () => {
    await loadCommercial();
  };

  onMount(() => {
    loadCommercial();
    if (typeof window !== 'undefined') {
      window.addEventListener('regionchange', onRegionChange);
      window.addEventListener('flowerxi:refresh', onRefresh);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('regionchange', onRegionChange);
      window.removeEventListener('flowerxi:refresh', onRefresh);
    }
  });
</script>

<article class="intel-card">
  <header>
    <h3>Inteligencia comercial</h3>
    <p>Picos de precio y campañas para planear corte y despacho.</p>
  </header>

  {#if loading}
    <div class="skeleton-grid">
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
    </div>
  {:else if error}
    <p class="state error">{error}</p>
  {:else}
    <div class="metrics">
      <div class="metric">
        <span>Precio FOB promedio</span>
        <strong>{avgPricePerKg === null ? 'Sin datos' : `${avgPricePerKg.toFixed(2)} USD/kg`}</strong>
      </div>
      <div class="metric">
        <span>Destino principal</span>
        <strong>{topDestination ? topDestination[0] : 'Sin datos'}</strong>
      </div>
      <div class="metric">
        <span>FOB 12 meses</span>
        <strong>{exportsSummary ? `$${formatM(exportsSummary.total_fob_usd)}` : 'Sin datos'}</strong>
      </div>
    </div>

    <div class="campaigns">
      <h4>Picos recientes (FOB)</h4>
      {#if peakMonths.length === 0}
        <p>Datos no disponibles.</p>
      {:else}
        {#each peakMonths as peak}
          <p><strong>{monthFormatter.format(peak.date)}</strong> · ${formatM(peak.fobUsd)}</p>
        {/each}
      {/if}
    </div>
  {/if}
</article>

<style>
  .intel-card {
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 16px;
    padding: 1.25rem;
    display: grid;
    gap: 0.9rem;
    box-shadow: var(--shadow-sm, 0 1px 3px rgba(31, 41, 55, 0.06));
  }

  header h3 {
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary, #1f2937);
  }

  header p {
    margin: 0.3rem 0 0;
    font-family: var(--font-sans);
    font-size: var(--text-base);
    color: var(--text-secondary, #64748b);
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.7rem;
  }

  .metric {
    background: var(--bg-app, #f8fafc);
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 10px;
    padding: 0.72rem;
    display: grid;
    gap: 0.3rem;
  }

  .metric span {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--text-secondary, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .metric strong {
    font-family: var(--font-sans);
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary, #1f2937);
  }

  .campaigns h4 {
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--primary, #7b5ba6);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .campaigns p {
    margin: 0.35rem 0 0;
    font-family: var(--font-sans);
    font-size: var(--text-base);
    color: var(--text-secondary, #475569);
  }

  .state.error {
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: #b91c1c;
  }

  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.7rem;
  }

  .skeleton-item {
    height: 62px;
    border-radius: 10px;
    background: linear-gradient(
      90deg,
      var(--border-subtle, #e2e8f0) 25%,
      var(--bg-app, #f1f5f9) 50%,
      var(--border-subtle, #e2e8f0) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.3s infinite linear;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  @media (max-width: 900px) {
    .metrics,
    .skeleton-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
