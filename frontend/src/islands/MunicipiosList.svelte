<script>
  export let apiUrl = '';

  let items = [];
  let selected = null;
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

  const loadMunicipios = async () => {
    loading = true;
    error = '';
    try {
      const data = await fetchJson('/api/municipalities');
      items = data?.items ?? [];
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  };

  const loadDetail = async (slug) => {
    selected = { loading: true };
    try {
      const data = await fetchJson(`/api/municipalities/${slug}`);
      selected = { loading: false, ...data?.item };
    } catch {
      selected = { loading: false, error: 'Error al cargar detalle' };
    }
  };

  loadMunicipios();
</script>

<div class="municipios-list">
  {#if !selected}
    <div class="static-content">
      <h2>Perfiles Municipales</h2>
      <p>Explora los municipios de la Sabana de Bogotá con producción de rosa de corte. Cada perfil incluye información sobre área de cultivo, fuerza laboral y contexto fitosanitario.</p>
    </div>

    {#if loading}
      <p class="loading-text">Cargando perfiles...</p>
    {:else if error}
      <p class="error-text">{error}</p>
    {:else if items.length === 0}
      <p class="empty-text">No hay perfiles disponibles.</p>
    {:else}
      <div class="cards-grid">
        {#each items as m}
          <article class="muni-card" on:click={() => loadDetail(m.slug)} on:keypress={(e) => e.key === 'Enter' && loadDetail(m.slug)} role="button" tabindex="0">
            <h3>{m.name}</h3>
            <p class="muted">{m.city}, {m.department}</p>
            <div class="muni-stats">
              <span>{m.flower_area_ha ?? '--'} ha</span>
              <span>{m.greenhouse_area_ha ?? '--'} ha</span>
              <span>{m.workers ?? '--'} workers</span>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  {:else if selected.loading}
    <div class="detail-view">
      <button class="back-btn" on:click={() => selected = null}>&larr; Volver</button>
      <p>Cargando...</p>
    </div>
  {:else if selected.error}
    <div class="detail-view">
      <button class="back-btn" on:click={() => selected = null}>&larr; Volver</button>
      <p class="error-text">{selected.error}</p>
    </div>
  {:else}
    <div class="detail-view">
      <button class="back-btn" on:click={() => selected = null}>&larr; Volver</button>
      <h2>{selected.name}</h2>
      <p class="muted">{selected.city}, {selected.department}</p>
      <div class="stats-grid">
        <div class="stat-box"><span class="stat-label">Área flor</span><span class="stat-value">{selected.flower_area_ha ?? '--'} ha</span></div>
        <div class="stat-box"><span class="stat-label">Invernadero</span><span class="stat-value">{selected.greenhouse_area_ha ?? '--'} ha</span></div>
        <div class="stat-box"><span class="stat-label">Trabajadores</span><span class="stat-value">{selected.workers ?? '--'}</span></div>
        <div class="stat-box"><span class="stat-label">Mujeres</span><span class="stat-value">{selected.workers_female ?? '--'}</span></div>
        <div class="stat-box"><span class="stat-label">Hombres</span><span class="stat-value">{selected.workers_male ?? '--'}</span></div>
      </div>
      <div class="context-box">
        <h4>Contexto Fitosanitario</h4><p>{selected.fisanicitary_context || 'Sin info'}</p>
        <h4>Gestión de Residuos</h4><p>{selected.waste_management || 'Sin info'}</p>
        <h4>Variedades Principales</h4><p>{Array.isArray(selected.main_varieties) ? selected.main_varieties.join(', ') : 'Sin info'}</p>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(body) { font-family: var(--font-sans); }
  .static-content h2 { font-size: var(--text-2xl); color: var(--primary); margin: 0 0 0.5rem; }
  .static-content p { font-size: var(--text-base); line-height: 1.5; margin: 0; color: var(--text-secondary); }
  .muni-card h3 { font-size: var(--text-lg); color: var(--primary); margin: 0; }
  .muni-card .muted { font-size: var(--text-base); margin: 0.25rem 0 0.75rem; color: var(--text-secondary); }
  .muni-stats { font-size: var(--text-sm); display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .muni-stats span { background: var(--bg-app); padding: 0.25rem 0.5rem; border-radius: 6px; color: var(--text-secondary); }
  .stat-label { font-size: var(--text-xs); text-transform: uppercase; display: block; color: var(--text-secondary); }
  .stat-value { font-size: var(--text-2xl); font-weight: 600; color: var(--primary); display: block; margin-top: 0.25rem; }
  .context-box h4 { font-size: var(--text-base); color: var(--primary); margin: 1rem 0 0.5rem; }
  .context-box h4:first-child { margin-top: 0; }
  .context-box p { font-size: var(--text-base); margin: 0; color: var(--text-primary); }
  .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
  .muni-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 16px; padding: 1.25rem; cursor: pointer; transition: all 160ms; }
  .muni-card:hover { border-color: var(--primary); box-shadow: var(--shadow-md); }
  .detail-view { max-width: 700px; }
  .back-btn {
    background: none;
    border: none;
    color: var(--primary, #7b5ba6);
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: var(--text-lg);
    margin-bottom: 1rem;
  }
  .back-btn:hover { color: var(--primary-hover); }
  .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.75rem; margin: 1rem 0; }
  @media (max-width: 600px) { .stats-grid { grid-template-columns: repeat(3, 1fr); } }
  .stat-box { background: var(--bg-app); padding: 0.75rem; border-radius: 10px; text-align: center; }
  .loading-text, .empty-text, .error-text { color: var(--text-secondary); text-align: center; padding: 2rem; }
  .static-content { margin-bottom: 1rem; }
  .error-text { color: #C75D5D; }
</style>
