<script>
  import { onMount } from 'svelte';

  export let apiUrl = '';
  export let region = 'madrid';

  let loading = true;
  let error = '';
  let history = [];

  const fetchTrend = async () => {
    loading = true;
    error = '';
    try {
      const res = await fetch(`${apiUrl}/api/history?region=${region}&limit=30`);
      if (!res.ok) throw new Error('Error al cargar histórico');
      const data = await res.json();
      history = Array.isArray(data?.items) ? data.items : [];
    } catch (e) {
      error = e.message;
      history = [];
    } finally {
      loading = false;
    }
  };

  const handleRegionChange = (e) => {
    if (e.detail !== region) {
      region = e.detail;
      fetchTrend();
    }
  };

  onMount(() => {
    fetchTrend();
    window.addEventListener('regionchange', handleRegionChange);
    return () => window.removeEventListener('regionchange', handleRegionChange);
  });

  $: riskSeries = history.map(day => {
    const precip = Number(day.precipitation_mm || 0);
    const temp = Number(day.temp_mean_c || 0);
    let score = 15;
    if (precip > 5) score = 85;
    else if (precip > 2) score = 55;
    else if (temp > 28 || temp < 12) score = 35;
    return {
      date: new Date(day.observed_on),
      score,
    };
  });

  $: chartData = riskSeries.slice(-14);

  function getRiskColor(score) {
    if (score >= 70) return '#dc2626';
    if (score >= 40) return '#ea580c';
    return '#16a34a';
  }

  function buildLine(data, width = 100, height = 40) {
    if (data.length === 0) return '';
    const stepX = width / (data.length - 1);
    let path = '';
    data.forEach((d, i) => {
      const x = i * stepX;
      const y = height - (d.score / 100 * height);
      path += `${i === 0 ? 'M' : 'L'}${x},${y}`;
    });
    return path;
  }

  function buildAreaPath(data, width = 100, height = 40) {
    const line = buildLine(data, width, height);
    return line ? `${line} L${width},${height} L0,${height} Z` : '';
  }
</script>

<article class="trend-chart">
  <div class="chart-header">
    <div>
      <h3>Riesgo agroclimático</h3>
      <p class="subtitle">Evolución (últimos 14 días)</p>
    </div>
    {#if chartData.length > 0}
      <div class="current-score" style="--badge-color: {getRiskColor(chartData[chartData.length - 1].score)};">
        Hoy: <strong>{chartData[chartData.length - 1].score}</strong>
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="chart-skeleton">
      <div class="spinner"></div>
      <span>Cargando tendencia...</span>
    </div>
  {:else if error}
    <div class="error-message">{error}</div>
  {:else if chartData.length === 0}
    <div class="no-data">Sin datos históricos</div>
  {:else}
    <div class="spark-wrapper">
      <svg viewBox="0 0 100 40" class="spark-svg" preserveAspectRatio="none">
        <path d={buildAreaPath(chartData)} fill="rgba(99, 102, 241, 0.1)" />
        <path d={buildLine(chartData)} fill="none" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        {#each chartData as d, i}
          {@const isHigh = d.score >= 70}
          {@const x = (i / (chartData.length - 1)) * 100}
          {@const y = 40 - (d.score / 100 * 40)}
          {#if isHigh}
            <circle cx={x} cy={y} r="1.5" fill="#dc2626" stroke="white" stroke-width="0.5"/>
          {/if}
        {/each}
      </svg>
    </div>

    <div class="x-marks">
      {#each chartData.filter((_,i) => i % Math.ceil(chartData.length/5) === 0 || i === chartData.length-1) as d}
        <span>{d.date.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}</span>
      {/each}
    </div>

    <div class="risk-legend">
      <span class="level"><span class="dot low"></span>Bajo (&lt;40)</span>
      <span class="level"><span class="dot medium"></span>Medio (40-70)</span>
      <span class="level"><span class="dot high"></span>Alto (&gt;70)</span>
    </div>
  {/if}
</article>

<style>
  .trend-chart {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .chart-header h3 {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: 600;
    color: #1e293b;
  }

  .subtitle {
    display: block;
    font-size: var(--text-base);
    color: #64748b;
    margin-top: 0.2rem;
  }

  .current-score {
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--badge-color, #6366f1);
    background: color-mix(in srgb, var(--badge-color, #6366f1) 12%, white);
    border: 1px solid var(--badge-color, #6366f1);
  }

  .spark-wrapper {
    height: 80px;
    background: #f8fafc;
    border-radius: 10px;
    padding: 0.5rem;
  }

  .spark-svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .x-marks {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-xs);
    color: #64748b;
    padding: 0 0.25rem;
  }

  .risk-legend {
    display: flex;
    justify-content: center;
    gap: 1rem;
    font-size: var(--text-xs);
    color: #64748b;
  }

  .level {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .dot.low { background: #16a34a; }
  .dot.medium { background: #ea580c; }
  .dot.high { background: #dc2626; }

  .chart-skeleton,
  .error-message,
  .no-data {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.5rem;
    color: #64748b;
    font-size: var(--text-base);
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
