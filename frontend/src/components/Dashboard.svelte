<script>
  import { onDestroy, onMount } from 'svelte';
  import TrendChart from './TrendChart.svelte';

  export let apiUrl = '';

  const FALLBACK_REGIONS = [
    { slug: 'madrid', name: 'Madrid' },
    { slug: 'facatativa', name: 'Facatativá' },
    { slug: 'funza', name: 'Funza' },
  ];

  const REGIONS_CACHE_KEY = 'flowerxi_regions_cache';
  const REGIONS_CACHE_TTL = 1000 * 60 * 30;

  const STATUS_UI = {
    rutina: { label: 'Rutina', tone: 'rutina' },
    vigilancia: { label: 'Vigilancia', tone: 'vigilancia' },
    accion: { label: 'Acción', tone: 'accion' },
    sin_datos: { label: 'Sin datos', tone: 'sin-datos' },
  };

  const TREND_UI = {
    up: 'Subiendo',
    down: 'Bajando',
    stable: 'Estable',
  };

  let regions = [];
  let selectedRegion = 'madrid';
  let loading = true;
  let error = '';

  let operativo = null;
  let snapshot = null;
  let history = [];
  let lastUpdated = null;
  let apiBase = '';

  const normalizeBaseUrl = (raw) => String(raw ?? '').trim().replace(/\/+$/, '');

  $: apiBase = normalizeBaseUrl(apiUrl);

  const endpoint = (path) => {
    if (!apiBase) return path;
    if (apiBase.endsWith('/api') && path.startsWith('/api/')) {
      return `${apiBase}${path.slice(4)}`;
    }
    return `${apiBase}${path}`;
  };

  const getCachedRegions = () => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = window.localStorage.getItem(REGIONS_CACHE_KEY);
      if (!cached) return null;
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > REGIONS_CACHE_TTL) return null;
      return data;
    } catch {
      return null;
    }
  };

  const setCachedRegions = (data) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(REGIONS_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {}
  };

  const fetchJson = async (path, label) => {
    const url = endpoint(path);
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const err = new Error(`${label} (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  };

  const toNumberOrNull = (value) => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatMetric = (value, unit, decimals = 1) => {
    const parsed = toNumberOrNull(value);
    if (parsed === null) return 'Sin dato';
    return `${parsed.toFixed(decimals)} ${unit}`;
  };

  const estimateHumidity = (temp, precip) => {
    const t = toNumberOrNull(temp);
    const p = toNumberOrNull(precip);
    if (t === null || p === null) return null;
    const estimate = 64 + p * 2.2 - Math.max(0, t - 20) * 1.4;
    return Math.max(35, Math.min(95, Math.round(estimate)));
  };

  const refreshAll = async () => {
    loading = true;
    error = '';

    try {
      const cached = getCachedRegions();
      if (cached && cached.length > 0) {
        regions = cached;
      }

      const data = await fetchJson(
        `/api/dashboard/full?region=${encodeURIComponent(selectedRegion)}`,
        'Error al cargar dashboard'
      );

      regions = data?.regions?.length > 0 ? data.regions : (regions.length > 0 ? regions : FALLBACK_REGIONS);
      if (regions !== cached && typeof window !== 'undefined') {
        setCachedRegions(regions);
      }

      snapshot = data?.snapshot ?? null;
      operativo = data?.operativo ?? null;
      history = Array.isArray(data?.history) ? data.history : [];

      if (!regions.some((r) => r.slug === selectedRegion)) {
        selectedRegion = regions[0]?.slug || 'madrid';
      }

      lastUpdated = new Date().toLocaleString('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch (err) {
      if (regions.length === 0) {
        regions = FALLBACK_REGIONS;
      }
      error = err instanceof Error ? err.message : 'Error al cargar dashboard';
    } finally {
      loading = false;
    }
  };

  const findRegionMatch = (query) => {
    const normalized = String(query ?? '').trim().toLowerCase();
    if (!normalized) return null;

    const lookup = regions.length ? regions : FALLBACK_REGIONS;
    return lookup.find((region) => {
      const slug = String(region?.slug ?? '').toLowerCase();
      const name = String(region?.name ?? '').toLowerCase();
      const city = String(region?.city ?? '').toLowerCase();
      return (
        slug === normalized ||
        slug.includes(normalized) ||
        name.includes(normalized) ||
        city.includes(normalized)
      );
    });
  };

  const onExternalSearch = async (event) => {
    const match = findRegionMatch(event?.detail?.query);
    if (!match || match.slug === selectedRegion) return;
    selectedRegion = match.slug;
    await refreshAll();
  };

  const onExternalRefresh = async () => {
    await refreshAll();
  };

  onMount(() => {
    refreshAll();
    if (typeof window !== 'undefined') {
      window.addEventListener('flowerxi:search-region', onExternalSearch);
      window.addEventListener('flowerxi:refresh', onExternalRefresh);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('flowerxi:search-region', onExternalSearch);
      window.removeEventListener('flowerxi:refresh', onExternalRefresh);
    }
  });

  $: statusUi = STATUS_UI[operativo?.status ?? 'sin_datos'] ?? STATUS_UI.sin_datos;
  $: trendLabel = TREND_UI[operativo?.trend_7d ?? 'stable'] ?? TREND_UI.stable;
  $: confidenceLabel = String(operativo?.confidence ?? 'media').toUpperCase();
  $: regionName = (regions.length ? regions : FALLBACK_REGIONS).find(
    (region) => region.slug === selectedRegion
  )?.name ?? selectedRegion;
  $: humidityEstimate = estimateHumidity(snapshot?.temp_mean_c, snapshot?.precipitation_mm);
</script>

<section class="live-grid">
  {#if loading}
    <article class="live-card full-width">
      <p class="state-message">Cargando estado en vivo...</p>
    </article>
  {:else if error}
    <article class="live-card full-width">
      <p class="state-message error">{error}</p>
    </article>
  {:else}
    <article class="live-card status-card {statusUi.tone}">
      <p class="live-kicker">Estado en vivo</p>
      <h2>{statusUi.label}</h2>
      <p class="live-copy">{operativo?.reason ?? 'Sin razón principal disponible.'}</p>
      <div class="live-badges">
        <span>Municipio: {regionName}</span>
        <span>Puntaje: {toNumberOrNull(operativo?.score) ?? 'Sin dato'}</span>
      </div>
    </article>

    <article class="live-card">
      <p class="live-kicker">Qué hacer hoy</p>
      <p class="action-copy">
        {operativo?.action_today ?? 'Mantén protocolo base y espera el siguiente corte de datos.'}
      </p>
      {#if operativo?.attention}
        <p class="attention-copy">{operativo.attention}</p>
      {/if}
    </article>

    <article class="live-card evidence-card full-width">
      <div class="evidence-head">
        <div>
          <p class="live-kicker">Evidencia en vivo</p>
          <h3>Lluvia, temperatura, humedad y tendencia (14 días)</h3>
        </div>
        {#if lastUpdated}
          <span>Actualizado: {lastUpdated}</span>
        {/if}
      </div>

      <div class="evidence-metrics">
        <article>
          <p>Lluvia hoy</p>
          <strong>{formatMetric(snapshot?.precipitation_mm, 'mm')}</strong>
        </article>
        <article>
          <p>Temperatura media</p>
          <strong>{formatMetric(snapshot?.temp_mean_c, '°C')}</strong>
        </article>
        <article>
          <p>Humedad estimada</p>
          <strong>{humidityEstimate !== null ? `${humidityEstimate}%` : 'Sin dato'}</strong>
        </article>
        <article>
          <p>Tendencia 7 días</p>
          <strong>{trendLabel}</strong>
          <small>Confianza {confidenceLabel}</small>
        </article>
      </div>

      {#if history.length > 0}
        <TrendChart data={history} />
      {:else}
        <p class="state-message">Sin historial disponible para el municipio seleccionado.</p>
      {/if}
    </article>
  {/if}
</section>

<style>
  .live-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .live-card {
    background: linear-gradient(180deg, #302742 0%, #261d36 100%);
    border: 1px solid rgba(164, 127, 202, 0.3);
    border-radius: 18px;
    padding: 1.2rem;
    color: #f7f4ff;
  }

  .full-width {
    grid-column: 1 / -1;
  }

  .live-kicker {
    margin: 0;
    text-transform: uppercase;
    font-size: 0.74rem;
    letter-spacing: 0.07em;
    color: #bda6dc;
  }

  .status-card h2 {
    margin-top: 0.35rem;
    margin-bottom: 0;
    font-size: 1.5rem;
  }

  .status-card.rutina {
    border-color: rgba(122, 139, 111, 0.55);
  }

  .status-card.vigilancia {
    border-color: rgba(245, 158, 11, 0.65);
  }

  .status-card.accion {
    border-color: rgba(199, 93, 93, 0.65);
  }

  .status-card.sin-datos {
    border-color: rgba(189, 166, 220, 0.45);
  }

  .live-copy,
  .action-copy {
    margin: 0.55rem 0 0;
    line-height: 1.45;
    color: #efe7ff;
  }

  .live-badges {
    margin-top: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .live-badges span {
    background: rgba(189, 166, 220, 0.2);
    color: #d8c7ef;
    border-radius: 999px;
    padding: 0.2rem 0.65rem;
    font-size: 0.76rem;
  }

  .attention-copy {
    margin-top: 0.75rem;
    padding: 0.65rem 0.75rem;
    border-radius: 10px;
    border: 1px solid rgba(245, 158, 11, 0.3);
    background: rgba(245, 158, 11, 0.12);
    color: #d4c4e8;
    font-size: 0.86rem;
    line-height: 1.4;
  }

  .evidence-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    margin-bottom: 0.9rem;
  }

  .evidence-head h3 {
    margin: 0.35rem 0 0;
    font-size: 1rem;
  }

  .evidence-head span {
    font-size: 0.75rem;
    color: #d4c4e8;
  }

  .evidence-metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .evidence-metrics article {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 0.72rem;
  }

  .evidence-metrics p {
    margin: 0;
    font-size: 0.78rem;
    color: #c9b8e4;
  }

  .evidence-metrics strong {
    margin-top: 0.35rem;
    display: block;
    font-size: 1rem;
    color: #f5efff;
  }

  .evidence-metrics small {
    margin-top: 0.2rem;
    display: block;
    font-size: 0.72rem;
    color: #bda6dc;
  }

  .state-message {
    margin: 0;
    color: #d9c9f1;
  }

  .state-message.error {
    color: #fecaca;
  }

  @media (max-width: 1020px) {
    .live-grid {
      grid-template-columns: 1fr;
    }

    .evidence-head {
      flex-direction: column;
      align-items: flex-start;
    }

    .evidence-metrics {
      grid-template-columns: 1fr;
    }
  }
</style>
