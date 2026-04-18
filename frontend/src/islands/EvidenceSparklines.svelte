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

  const clamp = (value, min = 0, max = 100) =>
    Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

  const toNum = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const estimateHumidity = (temp, precip) => {
    const estimate = 64 + toNum(precip) * 2.2 - Math.max(0, toNum(temp) - 20) * 1.4;
    return clamp(Math.round(estimate), 35, 95);
  };

  const riskProxy = (temp, precip) => {
    const rainFactor = Math.min(55, toNum(precip) * 9);
    const tempFactor = toNum(temp) < 12 ? 16 : toNum(temp) > 24 ? 10 : 4;
    return clamp(Math.round(18 + rainFactor + tempFactor), 12, 95);
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
        'No se pudo cargar evidencia climática'
      );

      const items = Array.isArray(payload?.items) ? payload.items : [];
      history = [...items].sort((a, b) => String(a.observed_on).localeCompare(String(b.observed_on)));
      updatedAt = new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (err) {
      history = [];
      error = err instanceof Error ? err.message : 'Error al cargar evidencia';
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
  $: humiditySeries = history.map((day) => estimateHumidity(day.temp_mean_c, day.precipitation_mm));
  $: riskSeries = history.map((day) => riskProxy(day.temp_mean_c, day.precipitation_mm));
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
    <Sparkline title="Humedad (%)" data={humiditySeries} unit="%" color="#10B981" />
    <Sparkline title="Puntaje riesgo" data={riskSeries} unit="pts" color="#7B5BA6" />
  </div>
  <p class="updated">Actualizado: {updatedAt}</p>
{/if}

<style>
  .state {
    margin: 0;
    font-size: 0.88rem;
  }

  .state.muted {
    color: var(--text-secondary, #64748b);
  }

  .state.error {
    color: #dc2626;
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
    font-size: 0.9rem;
  }

  .empty-state small {
    display: block;
    margin-top: 0.35rem;
    color: var(--text-secondary, #64748b);
    font-size: 0.76rem;
  }

  .spark-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .updated {
    margin: 0.45rem 0 0;
    color: var(--text-tertiary, #9ca3af);
    font-size: 0.76rem;
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
