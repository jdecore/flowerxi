<script>
  export let apiUrl = '';

  let prices = [];
  let pricesLoading = true;
  let pricesError = '';
  let pricesLastUpdate = '';

  let exportsItems = [];
  let exportsSummary = {};
  let exportsLoading = true;
  let exportsError = '';

  const formatCOP = (v) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number(v));
  const formatDate = (d) => d ? new Date(d).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }) : 'Sin datos';

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

  const loadPrices = async () => {
    pricesLoading = true;
    pricesError = '';
    try {
      const res = await fetch('/market_prices.json');
      if (!res.ok) throw new Error('No disponible');
      const data = await res.json();
      prices = (data.data ?? []).filter(p => Number(p.price_cop) > 0);
      pricesLastUpdate = data.scraped_at ?? data.generated_at;
    } catch (e) {
      pricesError = e.message;
    } finally {
      pricesLoading = false;
    }
  };

  const loadExports = async () => {
    exportsLoading = true;
    exportsError = '';
    try {
      const data = await fetchJson('/api/exports?months=12');
      exportsItems = data?.items ?? [];
      exportsSummary = data?.summary ?? {};
    } catch (e) {
      exportsError = e.message;
    } finally {
      exportsLoading = false;
    }
  };

  const avgPrice = prices.length ? Math.round(prices.reduce((a, p) => a + Number(p.price_cop), 0) / prices.length) : 0;

  const sortedMonths = Object.keys(exportsItems.reduce((acc, i) => {
    acc[i.year_month] = true;
    return acc;
  }, {})).sort().reverse().slice(0, 4);

  loadPrices();
  loadExports();
</script>

<section class="comercial-section">
  <div class="section-block">
    <h2>Precios de Mercado</h2>
    <div class="section-static">
      <p>Precios de referencia de las principales variedades de rosa de corte en el mercado colombiano. Datos recopilados de Corabastos y Agronet.</p>
    </div>

    {#if pricesLoading}
      <div class="prices-summary"><p class="loading">Cargando...</p></div>
    {:else if pricesError}
      <div class="prices-summary"><p class="error">{pricesError}</p></div>
    {:else}
      <div class="prices-summary">
        <div class="summary-card"><span class="label">Última actualización</span><span class="value">{formatDate(pricesLastUpdate)}</span></div>
        <div class="summary-card"><span class="label">Variedades</span><span class="value">{prices.length}</span></div>
        <div class="summary-card"><span class="label">Precio promedio</span><span class="value">{prices.length ? '$' + formatCOP(avgPrice) : 'N/A'}</span></div>
      </div>
      <div class="prices-grid">
        {#each prices as p}
          <div class="price-card">
            <div class="price-header">{p.variety}</div>
            <div class="price-unit">{p.unit}</div>
            <div class="price-value">${formatCOP(p.price_cop)} <span class="currency">COP</span></div>
            <div class="price-source">{p.source}</div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="section-block">
    <h2>Exportaciones (DANE proxy)</h2>
    <div class="section-static">
      <p>Datos de exportaciones de flores (codigo NANDI 0603) desde la base de datos DANE. Muestra el valor FOB en USD y volumen en toneladas por mes y pais de destino.</p>
    </div>

    {#if exportsLoading}
      <div class="exports-summary"><p class="loading">Cargando...</p></div>
    {:else if exportsError}
      <div class="exports-summary"><p class="error">{exportsError}</p></div>
    {:else if exportsItems.length === 0}
      <p class="empty">Sin datos.</p>
    {:else}
      <div class="exports-summary">
        <div class="sum-card"><span class="l">Valor FOB</span><span class="v">${((exportsSummary.total_fob_usd ?? 0)/1e6).toFixed(1)}M</span></div>
        <div class="sum-card"><span class="l">Volumen</span><span class="v">{((exportsSummary.total_net_tons ?? 0)/1e3).toFixed(1)}K</span></div>
        <div class="sum-card"><span class="l">$/kg</span><span class="v">${(exportsSummary.avg_price_per_kg ?? 0).toFixed(2)}</span></div>
      </div>
      <div class="exports-table">
        <div class="table-h"><span>Mes</span><span>Destino</span><span>FOB</span><span>Kg</span></div>
        {#each sortedMonths as month}
          {#each exportsItems.filter(i => i.year_month === month).slice(0, 3) as item}
            <div class="table-r">
              <span class="month">{month}</span>
              <span class="dest">{item.country_dest}</span>
              <span>${(item.fob_usd/1e6).toFixed(1)}M</span>
              <span>{(item.net_tons/1e3).toFixed(1)}K</span>
            </div>
          {/each}
        {/each}
      </div>
    {/if}
  </div>
</section>

<style>
  .comercial-section { padding: 0.5rem 0; }
  .section-block { margin-bottom: 2rem; }
  .section-block h2 { font-size: 1.1rem; color: var(--primary); margin: 0 0 0.75rem; }
  .section-static { margin-bottom: 1rem; padding: 0.85rem; background: var(--bg-app); border-radius: 10px; border-left: 3px solid var(--primary); }
  .section-static p { margin: 0; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; }
  .prices-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem; }
  .summary-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1rem; text-align: center; }
  .summary-card .label { display: block; font-size: 0.75rem; color: var(--text-secondary); }
  .summary-card .value { display: block; font-size: 1rem; font-weight: 600; color: var(--primary); margin-top: 0.25rem; }
  .prices-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
  .price-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1rem; }
  .price-header { font-weight: 600; color: var(--primary); }
  .price-unit { font-size: 0.8rem; color: var(--text-secondary); }
  .price-value { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); margin: 0.5rem 0; }
  .price-value .currency { font-size: 0.9rem; font-weight: 400; }
  .price-source { font-size: 0.75rem; color: var(--text-tertiary); }
  .exports-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem; }
  .sum-card { background: linear-gradient(135deg, rgba(117,106,133,0.12), rgba(117,106,133,0.05)); border: 1px solid rgba(117,106,133,0.2); border-radius: 12px; padding: 1rem; text-align: center; }
  .sum-card .l { display: block; font-size: 0.75rem; color: var(--text-secondary); }
  .sum-card .v { display: block; font-size: 1.2rem; font-weight: 600; color: var(--primary); margin-top: 0.25rem; }
  .exports-table { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px; overflow: hidden; }
  .table-h, .table-r { display: grid; grid-template-columns: 1.5fr 1.5fr 1fr 1fr; gap: 0.5rem; padding: 0.6rem 1rem; }
  .table-h { background: var(--bg-app); font-weight: 600; font-size: 0.75rem; color: var(--primary); }
  .table-r { border-top: 1px solid var(--border-subtle); font-size: 0.8rem; }
  .month { font-weight: 600; }
  .dest { font-weight: 500; }
  .loading, .empty, .error { color: var(--text-secondary); text-align: center; padding: 2rem; }
  .error { color: #C75D5D; }
  @media (max-width: 768px) {
    .prices-summary, .exports-summary { grid-template-columns: 1fr; }
  }
</style>