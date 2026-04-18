<script>
  import ApexCharts from 'apexcharts';
  import { onMount, onDestroy } from 'svelte';

  export let apiUrl = '';
  export let region = 'madrid';
  export let months = 6;

  let loading = true;
  let chartEl;
  let chart;

  const fetchHeatmap = async () => {
    loading = true;
    try {
      const res = await fetch(`${apiUrl}/api/risk/monthly?region=${region}&months=${months}`);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        initChart(items);
      }
    } catch (e) { console.error(e); }
    finally { loading = false; }
  };

  const initChart = (series) => {
    const options = {
      chart: { type: 'heatmap', height: 220, toolbar: { show: false }, fontFamily: 'Inter, sans-serif' },
      dataLabels: { enabled: true, style: { colors: ['#fff'], fontSize: '10px' } },
      colors: ['#10B981', '#F59E0B', '#DC2626'],
      xaxis: { type: 'category', labels: { style: { colors: '#1f2937', fontSize: '11px' } } },
      yaxis: { show: false },
      grid: { padding: { left: -8, right: -8, bottom: -8 } },
      plotOptions: { heatmap: { shadeIntensity: 0.5, radius: 6, enableGradients: false, } },
      legend: { show: false }
    };

    if (chart) { chart.updateOptions(options); chart.updateSeries([{ name: 'Riesgo', data: series.map((s,i)=>[i, s.combined_score, s.month_label]) }]); }
    else if (chartEl && series.length > 0) {
      chart = new ApexCharts(chartEl, options);
      chart.render();
      chart.updateSeries([{ name: 'Riesgo', data: series.map((s,i)=>[i, s.combined_score, s.month_label]) }]);
    }
  };

  const handleRegionChange = (e) => {
    if (e.detail !== region) {
      region = e.detail;
      fetchHeatmap();
    }
  };

  onMount(() => {
    fetchHeatmap();
    if (typeof window !== 'undefined') {
      window.addEventListener('regionchange', handleRegionChange);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('regionchange', handleRegionChange);
    }
    if (chart) chart.destroy();
  });
</script>

<article class="risk-heatmap">
  <h3>Calendario de riesgo</h3>
  <p class="subtitle">Próximos {months} meses — {region}</p>

  {#if loading}
    <div class="heatmap-skeleton">
      {#each Array(6) as _}
        <div class="skeleton-month"></div>
      {/each}
    </div>
  {:else}
    <div class="heatmap-wrapper" bind:this={chartEl}></div>
  {/if}
</article>

<style>
  .risk-heatmap { background: var(--bg-surface, #fff); border: 1px solid var(--border-subtle, #e2e8f0); border-radius: 16px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; box-shadow: var(--shadow-sm, 0 1px 3px rgba(31,41,55,0.06)); }
  .risk-heatmap h3 { margin: 0; font-size: 1.1rem; font-weight: 600; color: var(--text-primary, #1f2937); }
  .subtitle { margin: 0; font-size: 0.8rem; color: var(--text-secondary, #64748b); }
  .heatmap-wrapper { min-height: 200px; }

  .heatmap-skeleton {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    padding: 1rem 0;
  }
  .skeleton-month {
    height: 32px;
    background: linear-gradient(90deg, var(--border-subtle, #e2e8f0) 25%, var(--bg-app, #f1f5f9) 50%, var(--border-subtle, #e2e8f0) 75%);
    background-size: 200% 100%;
    border-radius: 6px;
    animation: shimmer 1.5s infinite linear;
  }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
</style>
