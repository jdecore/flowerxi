<script>
  import { onDestroy, onMount } from 'svelte';
  import Sparkline from '../components/Sparkline.svelte';

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

  const fetchJson = async (path, label) => {
    const apiBases = buildApiBases(apiUrl);
    let lastError = null;

    for (const base of apiBases) {
      try {
        const res = await fetch(endpoint(base, path), { headers: { Accept: 'application/json' } });
        if (!res.ok) {
          lastError = new Error(`${label} (${res.status})`);
          continue;
        }
        return await res.json();
      } catch {
        continue;
      }
    }

    throw lastError ?? new Error(label);
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
  <div class="skeleton-grid" aria-label={`Cargando evidencia de ${regionLabel}`}>
    {#each Array(4) as _}
      <div class="skeleton-card"></div>
    {/each}
  </div>
{:else if error}
  <p class="state error">{error}</p>
{:else if !enoughData}
  <div class="empty-state">
    <p>Aún recopilando datos de {regionLabel} ({history.length}/14 días).</p>
    <small>Mostraremos la tendencia completa cuando tengamos al menos 7 días.</small>
  </div>
{:else}
  <div class="spark-grid">
    <Sparkline title="Lluvia (mm)" data={rainSeries} unit="mm" color="#3B82F6" />
    <Sparkline title="Temperatura (°C)" data={tempSeries} unit="°C" color="#EF4444" />
    <Sparkline title="Riesgo encharcamiento" data={waterSeries} unit="pts" color="#10B981" />
    <Sparkline title="Riesgo fúngico" data={fungalSeries} unit="pts" color="#7B5BA6" />
  </div>
  <p class="updated">Actualizado: {updatedAt}</p>
{/if}

<style>
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .skeleton-card {
    height: 122px;
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
    padding: 0.85rem;
  }

   .empty-state p {
     margin: 0;
     color: var(--text-primary, #1f2937);
     font-family: var(--font-sans);
     font-size: var(--text-lg);
   }

   .empty-state small {
     display: block;
     margin-top: 0.35rem;
     color: var(--text-secondary, #64748b);
     font-family: var(--font-sans);
     font-size: var(--text-sm);
   }

  .spark-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

   .updated {
     margin: 0.45rem 0 0;
     color: var(--text-tertiary, #9ca3af);
     font-family: var(--font-sans);
     font-size: var(--text-sm);
   }

  @media (max-width: 900px) {
    .skeleton-grid {
      grid-template-columns: 1fr;
    }

    .spark-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
