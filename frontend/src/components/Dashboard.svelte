<script>
  export let apiUrl;

  let loading = true;
  let error = '';
  let data = null;

  const fetchDashboard = async () => {
    loading = true;
    error = '';
    try {
      const res = await fetch(`${apiUrl}/api/dashboard?region=sabana-bogota`);
      if (!res.ok) {
        throw new Error(`Backend respondio ${res.status}`);
      }
      data = await res.json();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error cargando dashboard';
    } finally {
      loading = false;
    }
  };

  fetchDashboard();
</script>

<section class="grid">
  <article class="card wide">
    <h2>Estado operativo</h2>
    {#if loading}
      <p class="muted">Cargando datos 2026...</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else if data}
      <p class="kpi">Riesgo global: <strong>{data.snapshot.global_risk_level}</strong></p>
      <p class="muted">Fecha: {data.snapshot.observed_on}</p>
      <p class="muted">Temperatura media: {data.snapshot.temp_mean_c} C</p>
      <p class="muted">Precipitacion: {data.snapshot.precipitation_mm} mm</p>
    {/if}
  </article>

  <article class="card">
    <h3>Riesgo fungico</h3>
    {#if data}
      <p class="score">{data.snapshot.fungal_risk}/100</p>
    {:else}
      <p class="muted">-</p>
    {/if}
  </article>

  <article class="card">
    <h3>Riesgo por encharcamiento</h3>
    {#if data}
      <p class="score">{data.snapshot.waterlogging_risk}/100</p>
    {:else}
      <p class="muted">-</p>
    {/if}
  </article>

  <article class="card">
    <h3>Riesgo por calor</h3>
    {#if data}
      <p class="score">{data.snapshot.heat_risk}/100</p>
    {:else}
      <p class="muted">-</p>
    {/if}
  </article>

  <article class="card wide">
    <h2>Recomendacion del dia</h2>
    {#if data}
      <p class="kpi">{data.snapshot.recommendation_title}</p>
      <p class="muted">{data.snapshot.recommendation_message}</p>
    {:else}
      <p class="muted">Sin datos</p>
    {/if}
  </article>
</section>

<style>
  .grid {
    display: grid;
    gap: 0.9rem;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .card {
    background: linear-gradient(180deg, rgba(46, 20, 96, 0.95), rgba(35, 14, 72, 0.95));
    border: 1px solid rgba(177, 108, 255, 0.35);
    border-radius: 16px;
    padding: 1rem;
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  }

  .wide {
    grid-column: 1 / -1;
  }

  h2,
  h3 {
    margin: 0 0 0.65rem;
  }

  .kpi {
    font-size: 1.1rem;
    margin: 0 0 0.4rem;
  }

  .score {
    font-size: 2rem;
    font-weight: 700;
    color: #d8b4fe;
    margin: 0;
  }

  .muted {
    color: #cdb8f5;
    margin: 0.2rem 0;
  }

  .error {
    color: #ffd4d4;
  }
</style>
