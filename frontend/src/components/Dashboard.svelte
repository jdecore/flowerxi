<script>
  import { onDestroy, onMount } from 'svelte';
  import TrendChart from './TrendChart.svelte';

  export let apiUrl;

  const FALLBACK_REGIONS = [
    { slug: 'madrid', name: 'Madrid' },
    { slug: 'facatativa', name: 'Facatativá' },
    { slug: 'funza', name: 'Funza' },
  ];

  const STATUS_CONFIG = {
    rutina: {
      key: 'rutina',
      title: 'Rutina',
      decision: 'Hoy no hay alarma crítica, pero revisa humedad y ventilación en el recorrido normal.',
      impact: 'Mantener la rutina evita sobreintervenir y conserva recursos sin perder control del cultivo.',
    },
    vigilancia: {
      key: 'vigilancia',
      title: 'Vigilancia',
      decision: 'Subió la presión climática: revisa hoy humedad, drenaje y ventilación.',
      impact: 'Corregir hoy reduce la probabilidad de brotes y evita escalar a acción crítica.',
    },
    accion: {
      key: 'accion',
      title: 'Acción',
      decision: 'Riesgo alto hoy: inspección en campo, registro fitosanitario y acción preventiva.',
      impact: 'Actuar hoy minimiza daño operativo y protege calidad de corte y cumplimiento fitosanitario.',
    },
    sin_datos: {
      key: 'sin_datos',
      title: 'Sin datos',
      decision: 'No hay información suficiente para priorizar acción hoy.',
      impact: 'Sin datos recientes, aplica protocolo base y valida captura climática.',
    },
  };

  const TREND_CONFIG = {
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

  const loadRegions = async () => {
    const response = await fetch(`${apiUrl}/api/regions`);
    if (!response.ok) throw new Error('No se pudieron cargar municipios');

    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (!items.length) return;

    regions = items;
    if (!regions.some((region) => region.slug === selectedRegion)) {
      selectedRegion = regions[0].slug;
    }
  };

  const loadDashboard = async () => {
    const [operativoRes, dashboardRes, historyRes] = await Promise.all([
      fetch(`${apiUrl}/api/risk/operativo?region=${encodeURIComponent(selectedRegion)}`),
      fetch(`${apiUrl}/api/dashboard?region=${encodeURIComponent(selectedRegion)}`),
      fetch(`${apiUrl}/api/history?region=${encodeURIComponent(selectedRegion)}&limit=14`),
    ]);

    if (!operativoRes.ok) {
      throw new Error(`No se pudo cargar estado operativo (${operativoRes.status})`);
    }
    if (!dashboardRes.ok) {
      throw new Error(`No se pudo cargar resumen del día (${dashboardRes.status})`);
    }
    if (!historyRes.ok) {
      throw new Error(`No se pudo cargar evidencia climática (${historyRes.status})`);
    }

    const [operativoPayload, dashboardPayload, historyPayload] = await Promise.all([
      operativoRes.json(),
      dashboardRes.json(),
      historyRes.json(),
    ]);

    operativo = operativoPayload?.ok ? operativoPayload : null;
    snapshot = dashboardPayload?.snapshot ?? null;
    history = Array.isArray(historyPayload?.items)
      ? [...historyPayload.items].reverse()
      : [];
  };

  const refreshAll = async () => {
    loading = true;
    error = '';
    try {
      if (!regions.length) {
        await loadRegions();
      }
      await loadDashboard();
      lastUpdated = new Date().toLocaleString('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch (err) {
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
      return slug === normalized || slug.includes(normalized) || name.includes(normalized) || city.includes(normalized);
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

  $: activeStatus = STATUS_CONFIG[operativo?.status ?? 'sin_datos'] ?? STATUS_CONFIG.sin_datos;
  $: trendLabel = TREND_CONFIG[operativo?.trend_7d ?? 'stable'] ?? TREND_CONFIG.stable;
  $: confidenceLabel = String(operativo?.confidence ?? 'media').toUpperCase();
  $: selectedRegionName = (regions.length ? regions : FALLBACK_REGIONS).find((region) => region.slug === selectedRegion)?.name ?? selectedRegion;
  $: humidityEstimate = estimateHumidity(snapshot?.temp_mean_c, snapshot?.precipitation_mm);
</script>

<section class="dashboard-grid">
  {#if loading}
    <article class="decision-card full-width">
      <p class="state-message">Cargando estado operativo...</p>
    </article>
  {:else if error}
    <article class="decision-card full-width">
      <p class="state-message error">{error}</p>
    </article>
  {:else}
    <article class="decision-card status-card {activeStatus.key}">
      <p class="card-step">1. Estado hoy</p>
      <h2>{activeStatus.title}</h2>
      <p class="card-copy">{activeStatus.decision}</p>
      <div class="status-badges">
        <span>Municipio: {selectedRegionName}</span>
        <span>Puntaje: {toNumberOrNull(operativo?.score) ?? 'Sin dato'}</span>
      </div>
    </article>

    <article class="decision-card">
      <p class="card-step">2. Razón principal</p>
      <p class="reason-text">{operativo?.reason ?? 'Sin razón principal disponible hoy.'}</p>
      <p class="impact-text">{activeStatus.impact}</p>
    </article>

    <article class="decision-card">
      <p class="card-step">3. Qué hacer hoy</p>
      <p class="action-text">{operativo?.action_today ?? 'Mantén el protocolo base y monitorea el siguiente corte de datos.'}</p>
      {#if operativo?.attention}
        <p class="attention-text">{operativo.attention}</p>
      {/if}
    </article>

    <article class="decision-card evidence-card">
      <div class="evidence-head">
        <div>
          <p class="card-step">4. Evidencia</p>
          <h3>Lluvia, temperatura, humedad y tendencia de 7 días</h3>
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

    <details class="methodology-card">
      <summary>Metodología</summary>
      <div>
        <p><strong>Riesgo = prioridad de atención hoy para el cultivo.</strong></p>
        <p>No diagnostica plagas; indica cuándo reforzar vigilancia y protocolos.</p>
        <p>Se calcula con clima reciente y reglas de manejo de microclima en invernadero.</p>
      </div>
    </details>
  {/if}
</section>

<style>
  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .decision-card {
    background: linear-gradient(180deg, #302742 0%, #261d36 100%);
    border: 1px solid rgba(164, 127, 202, 0.3);
    border-radius: 18px;
    padding: 1.2rem;
    color: #f7f4ff;
  }

  .full-width,
  .evidence-card,
  .methodology-card {
    grid-column: 1 / -1;
  }

  .card-step {
    margin: 0;
    text-transform: uppercase;
    font-size: 0.74rem;
    letter-spacing: 0.07em;
    color: #bda6dc;
  }

  .status-card h2 {
    margin-top: 0.35rem;
    font-size: 1.5rem;
  }

  .card-copy {
    margin: 0.55rem 0 0;
    line-height: 1.4;
    color: #eee4ff;
  }

  .status-badges {
    margin-top: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .status-badges span {
    background: rgba(189, 166, 220, 0.2);
    color: #d8c7ef;
    border-radius: 999px;
    padding: 0.2rem 0.65rem;
    font-size: 0.76rem;
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

  .reason-text,
  .action-text {
    margin: 0.5rem 0 0;
    line-height: 1.45;
    color: #efe7ff;
  }

  .impact-text,
  .attention-text {
    margin: 0.75rem 0 0;
    font-size: 0.86rem;
    line-height: 1.4;
    color: #d4c4e8;
  }

  .attention-text {
    padding: 0.65rem 0.75rem;
    border-radius: 10px;
    border: 1px solid rgba(245, 158, 11, 0.3);
    background: rgba(245, 158, 11, 0.12);
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

  .methodology-card {
    margin: 0;
    border-radius: 16px;
    border: 1px solid rgba(164, 127, 202, 0.24);
    padding: 0.95rem 1rem;
    background: rgba(38, 29, 54, 0.78);
    color: #d4c4e8;
  }

  .methodology-card summary {
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 600;
    color: #f0e7ff;
  }

  .methodology-card p {
    margin: 0.45rem 0 0;
    font-size: 0.84rem;
    line-height: 1.35;
  }

  .state-message {
    margin: 0;
    color: #d9c9f1;
  }

  .state-message.error {
    color: #fecaca;
  }

  @media (max-width: 1020px) {
    .dashboard-grid {
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
