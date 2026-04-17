<script>
  import { onMount } from 'svelte';
  import TrendChart from './TrendChart.svelte';

  export let apiUrl;

  let loading = true;
  let loadingRegions = true;
  let error = '';
  let data = null;
  let historyData = [];
  let regions = [];
  let selectedRegion = 'madrid';

  const RISK_COLORS = {
    alto: { bg: '#F5E6E6', border: '#D64545', text: '#7A1F1F', label: 'ALTO' },
    medio: { bg: '#FEF6E6', border: '#E6A23C', text: '#7A5010', label: 'MEDIO' },
    bajo: { bg: '#E6F5EC', border: '#2E9E6F', text: '#1A5A3A', label: 'BAJO' },
  };

  const normalizeRiskLevel = (level) => {
    const l = String(level ?? '').toLowerCase().trim();
    if (l.includes('alto') || l === 'high' || l === '3') return 'alto';
    if (l.includes('medio') || l === 'medium' || l === '2') return 'medio';
    return 'bajo';
  };

  const cacheTodayData = (snapshot) => {
    if (typeof window === 'undefined' || !snapshot) return;
    const payload = {
      region: snapshot.region_name ?? selectedRegion,
      temp: snapshot.temp_mean_c ?? null,
      precip: snapshot.precipitation_mm ?? null,
      risk_fungico: snapshot.fungal_risk ?? null,
      risk_encharcamiento: snapshot.waterlogging_risk ?? null,
      risk_calor: snapshot.heat_risk ?? null,
      recommendation: snapshot.recommendation_title ?? '',
      observed_on: snapshot.observed_on ?? null,
    };
    window.localStorage.setItem('flowerxi_today', JSON.stringify(payload));
  };

  const fetchRegions = async () => {
    loadingRegions = true;
    const res = await fetch(`${apiUrl}/api/regions`);
    if (!res.ok) throw new Error(`Backend respondió ${res.status}`);
    const payload = await res.json();
    regions = payload.items ?? [];
    if (regions.length === 0) throw new Error('No hay regiones disponibles');
    const defaultRegion = payload.default_region;
    const available = new Set(regions.map((r) => r.slug));
    selectedRegion = defaultRegion && available.has(defaultRegion) ? defaultRegion : regions[0].slug;
  };

  const fetchDashboard = async () => {
    loading = true;
    error = '';
    try {
      const res = await fetch(`${apiUrl}/api/dashboard?region=${encodeURIComponent(selectedRegion)}`);
      if (!res.ok) throw new Error(`Backend respondió ${res.status}`);
      data = await res.json();
      cacheTodayData(data?.snapshot);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error cargando dashboard';
    } finally {
      loading = false;
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/history?region=${encodeURIComponent(selectedRegion)}&limit=30`);
      if (!res.ok) return;
      const payload = await res.json();
      historyData = (payload.items ?? []).reverse();
    } catch {
      historyData = [];
    }
  };

  const initialize = async () => {
    error = '';
    try {
      await fetchRegions();
      await fetchDashboard();
      await fetchHistory();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error cargando dashboard';
      loading = false;
    } finally {
      loadingRegions = false;
    }
  };

  const onRegionChange = async (event) => {
    selectedRegion = event.currentTarget.value;
    await fetchDashboard();
    await fetchHistory();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  const formatTemp = (val) => val != null ? `${Number(val).toFixed(1)} °C` : '—';
  const formatPrecip = (val) => val != null ? `${Number(val).toFixed(1)} mm` : '—';

  onMount(() => {
    initialize();
  });
</script>

<section class="dashboard">
  <header class="region-select">
    <div class="selector">
      <label for="region-select">Cultivo: <strong>rosa</strong> en</label>
      <select id="region-select" value={selectedRegion} on:change={onRegionChange} disabled={loadingRegions || loading}>
        {#each regions as region}
          <option value={region.slug}>{region.name}</option>
        {/each}
      </select>
    </div>
  </header>

  {#if loading}
    <div class="loading"><p>Cargando datos 2026...</p></div>
  {:else if error}
    <div class="error"><p>{error}</p></div>
  {:else if data}
    {@const riskLevel = normalizeRiskLevel(data.snapshot?.global_risk_level)}
    {@const colors = RISK_COLORS[riskLevel] || RISK_COLORS.bajo}

    <section class="risk-card" style="--risk-bg: {colors.bg}; --risk-border: {colors.border}; --risk-text: {colors.text};">
      <div class="risk-badge" style="background: {colors.bg}; border-color: {colors.border}; color: {colors.text};">
        <span class="risk-dot" style="background: {colors.text};"></span>
        <span>Riesgo {colors.label}</span>
      </div>
      <div class="risk-details">
        <p class="risk-cause">
          {#if riskLevel === 'alto'}
            ⚠️ Probabilidad de botrytis elevada
          {:else if riskLevel === 'medio'}
            ⚡ Monitorear humedad en invernadero
          {:else}
            ✓ Condiciones optimizadas para cultivo
          {/if}
        </p>
        <p class="risk-action">
          <strong>Acción:</strong>
          {#if riskLevel === 'alto'}
            reducir humedad + aplicar preventivo
          {:else if riskLevel === 'medio'}
            ventilar y revisar lotes susceptibles
          {:else}
            continuar protocolo habitual
          {/if}
        </p>
      </div>
    </section>

    <section class="kpi-grid">
      <article class="kpi-card">
        <h3>Riesgo global</h3>
        <p class="kpi-value" style="color: {colors.text};">{colors.label}</p>
        <p class="kpi-sub">Nivel actual</p>
      </article>
      <article class="kpi-card">
        <h3>Temperatura</h3>
        <p class="kpi-value">{formatTemp(data.snapshot?.temp_mean_c)}</p>
        <p class="kpi-sub">Media diaria</p>
      </article>
      <article class="kpi-card">
        <h3>Precipitación</h3>
        <p class="kpi-value">{formatPrecip(data.snapshot?.precipitation_mm)}</p>
        <p class="kpi-sub">Últimas 24h</p>
      </article>
      <article class="kpi-card">
        <h3>Actualizado</h3>
        <p class="kpi-value">{formatDate(data.snapshot?.observed_on)}</p>
        <p class="kpi-sub">{data.snapshot?.region_name}</p>
      </article>
    </section>

    <section class="chart-section">
      <h3>Tendencia últimos 30 días</h3>
      {#if historyData.length > 0}
        <TrendChart data={historyData} />
      {:else}
        <p class="muted">Sin datos históricos disponibles</p>
      {/if}
    </section>

    <section class="recommendations">
      <h3>📌 Recomendaciones para hoy</h3>
      <ul>
        {#if riskLevel === 'alto'}
          <li>🔴 Ventilar invernadero en la mañana (reducir humedad relativa)</li>
          <li>🔴 Evitar riego nocturnal</li>
          <li>🔴 Aplicar fungicida preventivo (riesgo alto)</li>
        {:else if riskLevel === 'medio'}
          <li>🟡 Revisar estado de plantas en sectores afectados</li>
          <li>🟡 Monitorear humedad cada 4 horas</li>
        {:else}
          <li>🟢 Continuar protocolo habitual de riego</li>
          <li>🟢 Registro fitosanitario al día</li>
        {/if}
        {#if data.snapshot?.recommendation_title}
          <li class="from-api">💡 {data.snapshot.recommendation_title}</li>
        {/if}
      </ul>
    </section>
  {/if}
</section>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }

  .region-select {
    margin-bottom: 0.3rem;
  }

  .selector {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    flex-wrap: wrap;
  }

  .selector label {
    color: var(--muted, #5A4A3A);
    font-size: 0.95rem;
  }

  .selector strong {
    color: var(--text, #2E1A47);
  }

  select {
    border-radius: 10px;
    border: 1px solid var(--primary, #4B2E83);
    background: var(--primary, #4B2E83);
    color: #F5F5F5;
    padding: 0.5rem 0.7rem;
    font: inherit;
    font-size: 0.95rem;
  }

  .loading, .error {
    padding: 2rem;
    text-align: center;
  }

  .loading p, .error p {
    margin: 0;
    color: var(--muted, #5A4A3A);
  }

  .error p {
    color: #ffd4d4;
  }

  .risk-card {
    background: linear-gradient(180deg, var(--risk-bg), rgba(255,255,255,0.03));
    border: 2px solid var(--risk-border);
    border-radius: 16px;
    padding: 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .risk-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    border: 1.5px solid;
    border-radius: 999px;
    padding: 0.35rem 0.75rem;
    font-size: 0.85rem;
    font-weight: 700;
    width: fit-content;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .risk-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .risk-cause {
    font-size: 1.05rem;
    font-weight: 600;
    margin: 0;
    color: var(--risk-text);
  }

  .risk-action {
    margin: 0.25rem 0 0;
    color: #5A4A3A;
    font-size: 0.9rem;
  }

  .risk-action strong {
    color: #2E2E2E;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  @media (min-width: 640px) {
    .kpi-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .kpi-card {
    background: #F3E7D7;
    border: 1px solid rgba(91, 58, 142, 0.2);
    border-radius: 14px;
    padding: 1rem;
    text-align: center;
    color: #2E2E2E;
  }

  .kpi-card h3 {
    margin: 0 0 0.4rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: #5A4A3A;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .kpi-value {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: #2E2E2E;
  }

  .kpi-sub {
    margin: 0.25rem 0 0;
    font-size: 0.75rem;
    color: #6A5A4A;
  }

  .chart-section {
    background: #F3E7D7;
    border: 1px solid rgba(91, 58, 142, 0.2);
    border-radius: 16px;
    padding: 1.1rem;
    color: #2E2E2E;
  }

  .chart-section h3 {
    margin: 0 0 1rem;
    font-size: 0.9rem;
    color: #5A4A3A;
  }

  .chart-section .muted {
    color: #6A5A4A;
    text-align: center;
    padding: 2rem;
  }

  .recommendations {
    background: #F3E7D7;
    border: 1px solid rgba(91, 58, 142, 0.2);
    border-radius: 16px;
    padding: 1.1rem;
    color: #2E2E2E;
  }

  .recommendations h3 {
    margin: 0 0 0.85rem;
    font-size: 1rem;
    color: #2E2E2E;
  }

  .recommendations ul {
    margin: 0;
    padding-left: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .recommendations li {
    color: #3D3D3D;
    line-height: 1.4;
    font-size: 0.95rem;
  }

  .recommendations li.from-api {
    margin-top: 0.35rem;
    padding-top: 0.55rem;
    border-top: 1px solid rgba(91, 58, 142, 0.2);
    color: #5B3A8E;
    font-weight: 600;
  }
</style>