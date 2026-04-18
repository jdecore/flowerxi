<script>
  import { onDestroy, onMount } from 'svelte';

  export let apiUrl = '';
  export let initialRegion = 'madrid';

  const monthFormatter = new Intl.DateTimeFormat('es-CO', { month: 'short', day: 'numeric' });

  const campaigns = [
    { name: 'San Valentín', month: 2, day: 14 },
    { name: 'Día de la Madre', month: 5, day: 10 },
    { name: 'Amor y Amistad', month: 9, day: 20 },
  ];

  let region = initialRegion;
  let loading = true;
  let error = '';
  let avgPrice = null;
  let topVariety = null;
  let exportsSummary = null;
  let campaignList = [];

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

  const nextCampaigns = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const upcoming = campaigns.map((campaign) => {
      const thisYear = new Date(currentYear, campaign.month - 1, campaign.day);
      const nextDate = thisYear < now ? new Date(currentYear + 1, campaign.month - 1, campaign.day) : thisYear;
      return { ...campaign, date: nextDate };
    });
    return upcoming.sort((a, b) => a.date - b.date).slice(0, 3);
  };

  const loadCommercial = async () => {
    loading = true;
    error = '';
    avgPrice = null;
    topVariety = null;
    exportsSummary = null;
    campaignList = nextCampaigns();

    try {
      const pricesPromise = fetch('/market_prices.json').then((res) => (res.ok ? res.json() : null));
      const exportsPromise = fetchJson('/api/exports?months=12').catch(() => null);
      const [pricesData, exportsData] = await Promise.all([pricesPromise, exportsPromise]);

      const prices = Array.isArray(pricesData?.data)
        ? pricesData.data.filter((item) => toNum(item.price_cop, 0) > 0)
        : [];

      if (prices.length > 0) {
        avgPrice = Math.round(prices.reduce((sum, item) => sum + toNum(item.price_cop), 0) / prices.length);
        topVariety = [...prices].sort((a, b) => toNum(b.price_cop) - toNum(a.price_cop))[0];
      }

      if (exportsData?.summary) {
        exportsSummary = exportsData.summary;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'No se pudo cargar inteligencia comercial';
    } finally {
      loading = false;
    }
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

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
        <span>Precio promedio</span>
        <strong>{avgPrice ? formatCurrency(avgPrice) : 'Sin datos'}</strong>
      </div>
      <div class="metric">
        <span>Variedad top</span>
        <strong>{topVariety?.variety ?? 'Sin datos'}</strong>
      </div>
      <div class="metric">
        <span>FOB 12 meses</span>
        <strong>{exportsSummary ? `$${formatM(exportsSummary.total_fob_usd)}` : 'Sin datos'}</strong>
      </div>
    </div>

    <div class="campaigns">
      <h4>Próximos picos</h4>
      {#each campaignList as campaign}
        <p><strong>{campaign.name}</strong> · {monthFormatter.format(campaign.date)}</p>
      {/each}
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
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary, #1f2937);
  }

  header p {
    margin: 0.3rem 0 0;
    font-size: 0.84rem;
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
    font-size: 0.72rem;
    color: var(--text-secondary, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .metric strong {
    font-size: 0.95rem;
    color: var(--text-primary, #1f2937);
  }

  .campaigns h4 {
    margin: 0;
    font-size: 0.83rem;
    color: var(--primary, #7b5ba6);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .campaigns p {
    margin: 0.35rem 0 0;
    font-size: 0.86rem;
    color: var(--text-secondary, #475569);
  }

  .state.error {
    margin: 0;
    color: #b91c1c;
    font-size: 0.85rem;
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
