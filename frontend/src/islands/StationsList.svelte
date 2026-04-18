<script>
  export let apiUrl = '';

  let items = [];
  let loading = true;
  let error = '';

  const buildApiBases = (raw) => {
    const candidates = [];
    if (raw) candidates.push(raw.replace(/\/+$/, ''));
    if (typeof window !== 'undefined') {
      const { hostname } = window.location;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        candidates.push('http://localhost:8000', 'http://127.0.0.1:8000');
      }
    }
    candidates.push('');
    return [...new Set(candidates)];
  };

  const apiBases = buildApiBases(apiUrl);

  const fetchJson = async (path) => {
    for (const base of apiBases) {
      try {
        const url = base ? `${base}${path}` : path;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) continue;
        return await res.json();
      } catch {
        continue;
      }
    }
    throw new Error('No disponible');
  };

  const loadStations = async () => {
    loading = true;
    error = '';
    try {
      const data = await fetchJson('/api/stations');
      items = data?.items ?? [];
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  };

  loadStations();
</script>

<div class="stations-grid">
  {#if loading}
    <p class="loading">Cargando estaciones...</p>
  {:else if error}
    <p class="error">Error: {error}</p>
  {:else if items.length === 0}
    <p class="empty">No hay estaciones.</p>
  {:else}
    {#each items as s}
      <article class="station-card">
        <div class="station-header">
          <span class="station-code">{s.station_code}</span>
          <span class="station-quality {s.data_quality}">{s.data_quality}</span>
        </div>
        <h3>{s.station_name}</h3>
        <p class="station-region">{s.region_slug || 'N/A'}</p>
        <div class="station-details">
          <div class="detail">
            <span class="label">Elevacion</span>
            <span class="value">{s.elevation_m} m</span>
          </div>
          <div class="detail">
            <span class="label">Distancia</span>
            <span class="value">{s.distance_km} km</span>
          </div>
          <div class="detail">
            <span class="label">Lat/Lon</span>
            <span class="value">{s.latitude?.toFixed(4)}, {s.longitude?.toFixed(4)}</span>
          </div>
        </div>
        <p class="station-source">Fuente: {s.source}</p>
      </article>
    {/each}
  {/if}
</div>

<style>
  .stations-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
  .station-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 16px; padding: 1.25rem; }
  .station-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
  .station-code { font-family: monospace; font-size: 0.85rem; color: var(--text-secondary); background: var(--bg-app); padding: 0.2rem 0.5rem; border-radius: 4px; }
  .station-quality { font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 4px; }
  .station-quality.good { background: #EDF0E7; color: #7A8B6F; }
  .station-quality.moderate { background: #EDE7F0; color: #8B7AA3; }
  .station-card h3 { margin: 0; font-size: 1rem; color: var(--text-primary); }
  .station-region { margin: 0.25rem 0 0.75rem; color: var(--primary); font-size: 0.85rem; text-transform: capitalize; }
  .station-details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 0.75rem; }
  .detail { text-align: center; }
  .detail .label { display: block; font-size: 0.7rem; color: var(--text-tertiary); }
  .detail .value { display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-primary); }
  .station-source { margin: 0; font-size: 0.75rem; color: var(--text-tertiary); }
  .loading, .empty, .error { color: var(--text-secondary); text-align: center; padding: 2rem; }
  .error { color: #C75D5D; }
</style>