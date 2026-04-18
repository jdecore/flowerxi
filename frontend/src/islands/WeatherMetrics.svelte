<script>
  import { onMount } from 'svelte';

  export let apiUrl = '';
  export let region = 'madrid';

  let loading = true;
  let error = '';
  let snapshot = null;
  let history = [];

  const formatMetric = (value, unit, decimals = 1) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '--';
    return `${num.toFixed(decimals)} ${unit}`;
  };

  const estimateHumidity = (temp, precip) => {
    const t = Number(temp);
    const p = Number(precip);
    if (!Number.isFinite(t) || !Number.isFinite(p)) return null;
    const estimate = 64 + p * 2.2 - Math.max(0, t - 20) * 1.4;
    return Math.max(35, Math.min(95, Math.round(estimate)));
  };

  const fetchData = async () => {
    loading = true;
    error = '';
    try {
      const [snapRes, histRes] = await Promise.all([
        fetch(`${apiUrl}/api/dashboard?region=${region}`),
        fetch(`${apiUrl}/api/history?region=${region}&limit=30`),
      ]);
      if (!snapRes.ok) throw new Error('Error dashboard');
      const snapData = await snapRes.json();
      const histData = await histRes.ok ? await histRes.json() : { items: [] };
      snapshot = snapData?.snapshot ?? null;
      history = Array.isArray(histData?.items) ? histData.items : [];
    } catch (e) {
      error = e.message;
      snapshot = null;
      history = [];
    } finally {
      loading = false;
    }
  };

  const handleRegionChange = (e) => {
    if (e.detail !== region) {
      region = e.detail;
      fetchData();
    }
  };

  onMount(() => {
    fetchData();
    window.addEventListener('regionchange', handleRegionChange);
    return () => window.removeEventListener('regionchange', handleRegionChange);
  });

  $: humidityEstimate = snapshot ? estimateHumidity(snapshot?.temp_mean_c, snapshot?.precipitation_mm) : null;
</script>

<article class="weather-metrics">
  <div class="metrics-header">
    <h3>Evidencia climática</h3>
    <p class="metrics-subtitle">Últimos 30 días</p>
  </div>

  {#if loading}
    <div class="metrics-grid">
      {#each [1,2,3,4] as i}
        <div class="metric-card skeleton">
          <p>Cargando...</p>
          <strong>--</strong>
        </div>
      {/each}
    </div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <div class="metrics-grid">
      <div class="metric-card precipitation">
        <div class="metric-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 16.2A4.5 4.5 0 0012 14a4.5 4.5 0 00-8 0A4.5 4.5 0 004 16.2"/>
            <line x1="10" y1="13" x2="10" y2="18"/>
            <line x1="14" y1="13" x2="14" y2="18"/>
          </svg>
        </div>
        <p class="metric-label">Lluvia hoy</p>
        <strong class="metric-value">{formatMetric(snapshot?.precipitation_mm, 'mm')}</strong>
      </div>

      <div class="metric-card temperature">
        <div class="metric-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 14.76V3.5a2.5 2.5 0 00-5 0l9 5.76z"/>
            <path d="M12 2v9"/>
          </svg>
        </div>
        <p class="metric-label">Temp. media</p>
        <strong class="metric-value">{formatMetric(snapshot?.temp_mean_c, '°C')}</strong>
      </div>

      <div class="metric-card humidity">
        <div class="metric-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/>
          </svg>
        </div>
        <p class="metric-label">Humedad estimada</p>
        <strong class="metric-value">{humidityEstimate !== null ? `${humidityEstimate}%` : '--'}</strong>
      </div>

      <div class="metric-card days">
        <div class="metric-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <p class="metric-label">Registros</p>
        <strong class="metric-value">{history.length}</strong>
      </div>
    </div>

    {#if history.length > 7}
      <div class="history-chart">
        <h4>Temperatura y precipitación (últimos 7 días)</h4>
        <div class="bars">
          {#each history.slice(-7) as day}
            {@const temp = Number(day.temp_mean_c)}
            {@const precip = Number(day.precipitation_mm)}
            <div class="bar-item">
              <div class="bar-group">
                <div class="bar temp-bar" style="height: {Math.min(Math.max(temp, 5), 35) * 2.5}px;" title="{formatMetric(temp, '°C')}"></div>
                <div class="bar precip-bar" style="height: {Math.min(precip * 3, 60)}px;" title="{formatMetric(precip, 'mm')}"></div>
              </div>
              <span class="bar-label">{new Date(day.observed_on).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}</span>
            </div>
          {/each}
        </div>
        <div class="legend">
          <span class="legend-item"><span class="dot temp"></span> Temp (°C)</span>
          <span class="legend-item"><span class="dot precip"></span> Precip (mm/3)</span>
        </div>
      </div>
    {/if}
  {/if}
</article>

<style>
  .weather-metrics {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .metrics-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .metrics-subtitle {
    margin: 0.2rem 0 0;
    font-size: 0.85rem;
    color: #64748b;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .metric-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .metric-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: #e0e7ff;
    color: #6366f1;
  }

  .metric-icon svg {
    width: 18px;
    height: 18px;
  }

  .metric-label {
    margin: 0;
    font-size: 0.8rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
  }

  .metric-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    letter-spacing: -0.02em;
  }

  .metric-card.precipitation .metric-icon { background: #dbeafe; color: #2563eb; }
  .metric-card.temperature .metric-icon { background: #fee2e2; color: #dc2626; }
  .metric-card.humidity .metric-icon { background: #d1fae5; color: #059669; }
  .metric-card.days .metric-icon { background: #fef3c7; color: #d97706; }

  .error {
    color: #dc2626;
    padding: 1rem;
    text-align: center;
    font-size: 0.9rem;
  }

  .skeleton p, .skeleton strong {
    color: #94a3b8;
  }

  .history-chart {
    background: #f8fafc;
    border-radius: 12px;
    padding: 1rem;
  }

  .history-chart h4 {
    margin: 0 0 1rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: #475569;
  }

  .bars {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 0.5rem;
    height: 100px;
    padding: 0 0.5rem;
  }

  .bar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .bar-group {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 80px;
  }

  .bar {
    width: 6px;
    border-radius: 3px;
    min-height: 2px;
  }

  .temp-bar {
    background: #dc2626;
    opacity: 0.8;
  }

  .precip-bar {
    background: #2563eb;
    opacity: 0.6;
  }

  .bar-label {
    font-size: 0.7rem;
    color: #64748b;
  }

  .legend {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: #64748b;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .dot.temp { background: #dc2626; }
  .dot.precip { background: #2563eb; }
</style>
