<script>
  import { onDestroy, onMount } from 'svelte';
  import TrendChart from './TrendChart.svelte';

  export let apiUrl = '';

  const FALLBACK_REGIONS = [
    { slug: 'madrid', name: 'Madrid' },
    { slug: 'facatativa', name: 'Facatativá' },
    { slug: 'funza', name: 'Funza' },
  ];

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
  let apiBases = [];

  const normalizeBaseUrl = (raw) => String(raw ?? '').trim().replace(/\/+$/, '');

  const buildApiBases = (raw) => {
    const configured = normalizeBaseUrl(raw);
    const candidates = [];

    if (configured) candidates.push(configured);

    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const isLocalHost = host === 'localhost' || host === '127.0.0.1';
      if (isLocalHost) {
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

  $: apiBases = buildApiBases(apiUrl);

  const makeHttpError = (label, status) => {
    const error = new Error(`${label} (${status})`);
    error.status = status;
    return error;
  };

  const isHttp404 = (err) =>
    (err && typeof err === 'object' && Number(err.status) === 404) ||
    (err instanceof Error && err.message.includes('(404)'));

  const fetchJson = async (path, label) => {
    try {
      let lastHttpError = null;
      let hadConnectionError = false;

      for (const base of apiBases) {
        try {
          const response = await fetch(endpoint(base, path), {
            headers: { Accept: 'application/json' },
          });
          if (!response.ok) {
            lastHttpError = makeHttpError(label, response.status);
            continue;
          }
          return await response.json();
        } catch (attemptError) {
          if (attemptError instanceof TypeError) {
            hadConnectionError = true;
            continue;
          }
          throw attemptError;
        }
      }

      if (lastHttpError) throw lastHttpError;
      if (hadConnectionError) {
        throw new Error('No se pudo conectar con el backend. Revisa PUBLIC_API_URL.');
      }
      throw new Error(`${label}. No se encontró endpoint disponible.`);
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error('No se pudo conectar con el backend. Revisa PUBLIC_API_URL.');
      }
      throw err;
    }
  };

  const scoreFromRisk = (riskLevel) => {
    const normalized = String(riskLevel ?? '').toLowerCase().trim();
    if (normalized.includes('alto') || normalized === 'high') return 75;
    if (normalized.includes('medio') || normalized === 'medium') return 50;
    return 22;
  };

  const deriveOperativoFallback = (alertPayload, dashboardSnapshot) => {
    const alert = alertPayload?.alert ?? null;
    const score = toNumberOrNull(alert?.agroclimatic_score) ?? scoreFromRisk(dashboardSnapshot?.global_risk_level);
    const status = score <= 30 ? 'rutina' : score <= 60 ? 'vigilancia' : 'accion';

    const statusLabelByKey = {
      rutina: 'Rutina normal',
      vigilancia: 'Vigilancia reforzada',
      accion: 'Acción requerida',
    };

    return {
      ok: true,
      status,
      status_label: statusLabelByKey[status],
      score,
      reason:
        alert?.message ||
        alert?.recommendation_title ||
        'No hay explicación detallada del riesgo operativo en este backend.',
      action_today:
        alert?.recommendation_message ||
        (status === 'accion'
          ? 'Ejecuta inspección en campo, registra hallazgos y aplica protocolo preventivo.'
          : status === 'vigilancia'
          ? 'Refuerza revisión de humedad, drenaje y ventilación durante el turno.'
          : 'Mantén la rutina de monitoreo sin acciones extraordinarias.'),
      attention:
        status === 'accion'
          ? 'Este estado se calculó con fallback porque /api/risk/operativo no está disponible.'
          : null,
      trend_7d: 'stable',
      confidence: 'media',
      details: { days_available: 0, fallback: true },
    };
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

  const hydrateRegions = async () => {
    if (regions.length > 0) return;

    try {
      const payload = await fetchJson('/api/regions', 'No se pudieron cargar municipios');
      const items = Array.isArray(payload?.items) ? payload.items : [];
      if (items.length > 0) {
        regions = items;
        if (!regions.some((region) => region.slug === selectedRegion)) {
          selectedRegion = regions[0].slug;
        }
      }
    } catch {
      // Si falla, seguimos con fallback local para no bloquear el dashboard.
      regions = [...FALLBACK_REGIONS];
    }
  };

  const loadLiveData = async () => {
    const [dashboardPayload, historyPayload] = await Promise.all([
      fetchJson(
        `/api/dashboard?region=${encodeURIComponent(selectedRegion)}`,
        'No se pudo cargar resumen del día'
      ),
      fetchJson(
        `/api/history?region=${encodeURIComponent(selectedRegion)}&limit=14`,
        'No se pudo cargar evidencia climática'
      ),
    ]);

    snapshot = dashboardPayload?.snapshot ?? null;
    history = Array.isArray(historyPayload?.items) ? [...historyPayload.items].reverse() : [];

    let operativoPayload = null;
    try {
      operativoPayload = await fetchJson(
        `/api/risk/operativo?region=${encodeURIComponent(selectedRegion)}`,
        'No se pudo cargar estado operativo'
      );
    } catch (err) {
      if (!isHttp404(err)) throw err;

      let alertPayload = null;
      try {
        alertPayload = await fetchJson(
          `/api/alerts/today?region=${encodeURIComponent(selectedRegion)}`,
          'No se pudo cargar alerta diaria'
        );
      } catch {
        alertPayload = null;
      }
      operativoPayload = deriveOperativoFallback(alertPayload, snapshot);
    }

    operativo = operativoPayload?.ok ? operativoPayload : deriveOperativoFallback(null, snapshot);
  };

  const refreshAll = async () => {
    loading = true;
    error = '';

    try {
      await hydrateRegions();
      await loadLiveData();
      lastUpdated = new Date().toLocaleString('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al cargar dashboard en vivo';
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
