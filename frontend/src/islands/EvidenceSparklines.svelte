<script>
  import { onDestroy, onMount } from 'svelte';
  import Sparkline from '../components/Sparkline.svelte';
  import { fetchJsonCached } from '../lib/api/client.js';

  export let apiUrl = '';
  export let initialRegion = 'madrid';

  const regionNames = {
    madrid: 'Madrid',
    facatativa: 'Facatativá',
    funza: 'Funza',
  };

  let region = initialRegion;
  let loading = true;
  let error = '';
  let history = [];
  let updatedAt = '';

  const toNum = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const fetchJson = async (path, label = 'network') => {
    return fetchJsonCached(path, {
      apiUrl,
      cacheTtlMs: 14_000,
      throwOnError: true,
    }).catch((err) => {
      const message = err instanceof Error ? err.message : String(err || label);
      throw new Error(message || label);
    });
  };

  const fetchHistory = async () => {
    loading = true;
    error = '';
    try {
      const payload = await fetchJson(
        `/api/history?region=${encodeURIComponent(region)}&limit=14`,
        'Datos no disponibles'
      );

      const items = Array.isArray(payload?.items) ? payload.items : [];
      history = [...items].sort((a, b) => String(a.observed_on).localeCompare(String(b.observed_on)));
      updatedAt = new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (err) {
      history = [];
      error = 'Datos no disponibles.';
    } finally {
      loading = false;
    }
  };

  const onRegionChange = async (event) => {
    if (!event?.detail || event.detail === region) return;
    region = event.detail;
    await fetchHistory();
  };

  const onRefresh = async () => {
    await fetchHistory();
  };

  onMount(() => {
    fetchHistory();
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

  $: rainSeries = history.map((day) => toNum(day.precipitation_mm));
  $: tempSeries = history.map((day) => toNum(day.temp_mean_c));
  $: waterSeries = history.map((day) => toNum(day.waterlogging_risk, 0));
  $: fungalSeries = history.map((day) => toNum(day.fungal_risk, 0));
  $: enoughData = history.length >= 7;
  $: regionLabel = regionNames[region] ?? region;
</script>

{#if loading}
  <div class="evidence-root">
    <div class="skeleton-grid" aria-label={`Cargando evidencia de ${regionLabel}`}>
      {#each Array(4) as _}
        <div class="skeleton-card"></div>
      {/each}
    </div>
  </div>
{:else if error}
  <div class="evidence-root">
    <p class="state error">{error}</p>
  </div>
{:else if !enoughData}
  <div class="evidence-root">
    <div class="empty-state">
      <p>Aún recopilando datos de {regionLabel} ({history.length}/14 días).</p>
      <small>Mostraremos la tendencia completa cuando tengamos al menos 7 días.</small>
    </div>
  </div>
{:else}
  <div class="evidence-root">
    <div class="spark-grid">
      <Sparkline title="Lluvia (mm)" data={rainSeries} unit="mm" color="#3B82F6" />
      <Sparkline title="Temperatura (°C)" data={tempSeries} unit="°C" color="#EF4444" />
      <Sparkline title="Riesgo encharcamiento" data={waterSeries} unit="pts" color="#10B981" />
      <Sparkline title="Riesgo fúngico" data={fungalSeries} unit="pts" color="#7B5BA6" />
    </div>
    <p class="updated">Actualizado: {updatedAt}</p>
  </div>
{/if}

<style>
  .evidence-root {
    display: flex;
    flex-direction: column;
    min-height: 420px;
    height: 100%;
  }

  .state {
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--text-base);
  }

  .state.muted {
    color: var(--text-secondary, #64748b);
    font-family: var(--font-sans);
  }

  .state.error {
    color: #dc2626;
    font-family: var(--font-sans);
  }

    .skeleton-grid {
      display: grid;
      grid-template-columns: 1fr;
      grid-template-rows: repeat(4, minmax(0, 1fr));
      gap: 0.75rem;
      flex: 1;
      min-height: 0;
    }

    .skeleton-card {
      height: auto;
      border-radius: 12px;
      background: linear-gradient(
        90deg,
        var(--border-subtle, #e2e8f0) 25%,
       var(--bg-app, #f1f5f9) 50%,
       var(--border-subtle, #e2e8f0) 75%
     );
     background-size: 200% 100%;
     animation: shimmer 1.4s infinite linear;
   }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

    .empty-state {
      border: 1px dashed var(--border-medium, #cbd5e1);
      border-radius: 12px;
      background: var(--bg-app, #f8fafc);
      padding: 0.75rem;
      min-height: 0;
    }

   .empty-state p {
     margin: 0;
     color: var(--text-primary, #1f2937);
     font-family: var(--font-sans);
     font-size: var(--text-base);
   }

   .empty-state small {
     display: block;
     margin-top: 0.25rem;
     color: var(--text-secondary, #64748b);
     font-family: var(--font-sans);
     font-size: var(--text-xs);
   }

    .spark-grid {
      display: grid;
      grid-template-columns: 1fr;
      grid-template-rows: repeat(4, minmax(0, 1fr));
      gap: 0.55rem;
      flex: 1;
      min-height: 0;
    }

    .updated {
      margin: 0.35rem 0 0;
      color: var(--text-tertiary, #9ca3af);
      font-family: var(--font-sans);
      font-size: var(--text-xs);
      text-align: right;
   }

  @media (max-width: 900px) {
    .evidence-root {
      min-height: 360px;
    }

    .skeleton-grid {
      grid-template-columns: 1fr;
      grid-template-rows: none;
    }

    .spark-grid {
      grid-template-columns: 1fr;
      grid-template-rows: none;
    }
  }
</style>
