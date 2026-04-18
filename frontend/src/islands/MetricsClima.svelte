<script>
  import { onMount } from 'svelte';

  export let apiUrl = '';
  export let region = 'madrid';

  let loading = true;
  let error = '';
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

  const humidityEstimate = snapshot ? estimateHumidity(snapshot?.temp_mean_c, snapshot?.precipitation_mm) : null;

  const fetchData = async () => {
    loading = true;
    error = '';
    try {
      const [snapRes, histRes] = await Promise.all([
        fetch(`${apiUrl}/api/dashboard?region=${region}`),
        fetch(`${apiUrl}/api/history?region=${region}&limit=14`),
      ]);
      if (!snapRes.ok) throw new Error(`Error dashboard (${snapRes.status})`);
      if (!histRes.ok) throw new Error(`Error history (${histRes.status})`);
      const snapData = await snapRes.json();
      const histData = await histRes.json();
      snapshot = snapData?.snapshot ?? null;
      history = Array.isArray(histData?.items) ? histData.items : [];
      lastUpdated = snapshot?.observed_on 
        ? new Date(snapshot.observed_on).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
        : null;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  };

  onMount(fetchData);
</script>

<article class="card evidence-card">
  <div class="head">
    <div>
      <p class="kicker">Evidencia en vivo</p>
      <h3>Lluvia, temperatura, humedad (14 días)</h3>
    </div>
    {#if lastUpdated}
      <span class="updated">Actualizado: {lastUpdated}</span>
    {/if}
  </div>

  {#if loading}
    <div class="metrics">
      {#each [1,2,3,4] as _}
        <article><p>Cargando...</p><strong>--</strong></article>
      {/each}
    </div>
  {:else if error}
    <p class="error">{error}</p>
  {:else}
    <div class="metrics">
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
        <p>Días con datos</p>
        <strong>{history.length}</strong>
      </article>
    </div>

    {#if history.length > 0}
      <div class="history-chart">
        <table>
          <thead>
            <tr><th>Fecha</th><th>Temp (°C)</th><th>Precip (mm)</th></tr>
          </thead>
          <tbody>
            {#each history.slice(-7).reverse() as day}
              <tr>
                <td>{new Date(day.observed_on).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}</td>
                <td>{toNumberOrNull(day.temp_mean_c)?.toFixed(1) ?? '--'}</td>
                <td>{toNumberOrNull(day.precipitation_mm)?.toFixed(1) ?? '--'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</article>

<style>
  .card {
    font-family: var(--font-sans);
    background: linear-gradient(180deg, #302742 0%, #261d36 100%);
    border: 1px solid rgba(164, 127, 202, 0.3);
    border-radius: 18px;
    padding: 1.2rem;
    color: #f7f4ff;
    grid-column: 1 / -1;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    margin-bottom: 0.9rem;
    font-family: var(--font-sans);
  }
  .head h3 {
    margin: 0.35rem 0 0;
    font-size: var(--text-xl);
    font-weight: 600;
    font-family: var(--font-sans);
  }
   .updated {
     font-family: var(--font-sans);
     font-size: var(--text-xs);
     color: #d4c4e8;
   }
  .kicker {
    font-family: var(--font-sans);
    margin: 0;
    text-transform: uppercase;
    font-size: var(--text-xs);
    letter-spacing: 0.07em;
    color: #bda6dc;
  }
  .metrics {
    font-family: var(--font-sans);
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .metrics article {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 0.72rem;
    font-family: var(--font-sans);
  }
  .metrics p {
    font-family: var(--font-sans);
    margin: 0;
    font-size: var(--text-base);
    color: #c9b8e4;
  }
  .metrics strong {
    font-family: var(--font-sans);
    margin-top: 0.35rem;
    display: block;
    font-size: var(--text-xl);
    font-weight: 700;
    color: #f5efff;
  }
  .history-chart {
    font-family: var(--font-sans);
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    padding: 0.75rem;
    overflow-x: auto;
  }
   table {
     font-family: var(--font-sans);
     width: 100%;
     border-collapse: collapse;
     font-size: var(--text-base);
   }
  th, td {
    font-family: var(--font-sans);
    padding: 0.4rem 0.5rem;
    text-align: left;
  }
  th {
    font-family: var(--font-sans);
    color: #bda6dc;
    font-weight: 600;
    border-bottom: 1px solid rgba(189, 166, 220, 0.2);
  }
  td {
    font-family: var(--font-sans);
    color: #e8ddf8;
  }
  tr:not(:last-child) td {
    border-bottom: 1px solid rgba(189, 166, 220, 0.1);
  }
  .error {
    font-family: var(--font-sans);
    color: #fecaca;
    margin: 0;
  }
  @media (max-width: 600px) {
    .metrics { grid-template-columns: 1fr 1fr; }
    .head { flex-direction: column; align-items: flex-start; }
  }
</style>