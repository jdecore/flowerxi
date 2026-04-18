<script>
  import { onDestroy, onMount } from 'svelte';

  export let apiUrl = '';
  export let region = 'madrid';

  let kpis = { surveillanceDays: 0, avgScore: 0, topRecommendation: '', observedDays: 0 };
  let guidanceMessage = '';
  let loading = true;

  const normalizeBaseUrl = (raw) => String(raw ?? '').trim().replace(/\/+$/, '');

  const buildApiBases = (raw) => {
    const configured = normalizeBaseUrl(raw);
    const candidates = [];
    if (configured) candidates.push(configured);

    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
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

  const fetchJson = async (path) => {
    const apiBases = buildApiBases(apiUrl);
    let lastError = null;

    for (const base of apiBases) {
      try {
        const res = await fetch(endpoint(base, path), { headers: { Accept: 'application/json' } });
        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
        return await res.json();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('network');
      }
    }

    throw lastError ?? new Error('network');
  };

  const fetchKPIs = async () => {
    loading = true;
    try {
      try {
        const data = await fetchJson(`/api/recommendations/week?region=${encodeURIComponent(region)}&days=7`);
        const items = Array.isArray(data?.items) ? data.items : [];
        const fungalSamples = items
          .map((r) => Number(r?.fungal_risk))
          .filter((value) => Number.isFinite(value));
        const surveillanceDays = items.filter(r => {
          const level = (r.global_risk_level || '').toLowerCase();
          return level === 'alto' || level === 'medio';
        }).length;
        const avgScore = fungalSamples.length
          ? Math.round(fungalSamples.reduce((sum, value) => sum + value, 0) / fungalSamples.length)
          : 0;
        const topRecommendation = items.length > 0 ? items[0].title || 'Sin recomendaciones' : 'Sin datos';
        kpis = { surveillanceDays, avgScore, topRecommendation, observedDays: items.length };
        guidanceMessage = items.length < 7
          ? `Necesitamos una semana completa para tu promedio. Hoy es día ${Math.max(items.length, 1)}.`
          : '';
      } catch {
        const history = await fetchJson(`/api/history?region=${encodeURIComponent(region)}&limit=7`);
        const items = Array.isArray(history?.items) ? history.items : [];
        const fungalSamples = items
          .map((r) => Number(r?.fungal_risk))
          .filter((value) => Number.isFinite(value));
        const surveillanceDays = items.filter((item) => {
          const level = String(item?.global_risk_level || '').toLowerCase();
          return level === 'alto' || level === 'medio';
        }).length;
        const avgScore = fungalSamples.length
          ? Math.round(fungalSamples.reduce((sum, value) => sum + value, 0) / fungalSamples.length)
          : 0;
        const topRecommendation = items[0]?.recommendation_title || 'Sin recomendaciones';
        kpis = { surveillanceDays, avgScore, topRecommendation, observedDays: items.length };
        guidanceMessage = items.length < 7
          ? `Necesitamos una semana completa para tu promedio. Hoy es día ${Math.max(items.length, 1)}.`
          : '';
      }
    } catch (e) {
      kpis = { surveillanceDays: 0, avgScore: 0, topRecommendation: 'Sin datos', observedDays: 0 };
      guidanceMessage = 'No hay datos suficientes para mostrar KPIs semanales.';
      console.error(e);
    }
    finally { loading = false; }
  };

  const handleRegionChange = (e) => {
    if (e.detail !== region) {
      region = e.detail;
      fetchKPIs();
    }
  };

  const handleRefresh = () => {
    fetchKPIs();
  };

  onMount(() => {
    fetchKPIs();
    if (typeof window !== 'undefined') {
      window.addEventListener('regionchange', handleRegionChange);
      window.addEventListener('flowerxi:refresh', handleRefresh);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('regionchange', handleRegionChange);
      window.removeEventListener('flowerxi:refresh', handleRefresh);
    }
  });
</script>

<article class="weekly-kpis">
  <h3>Vistazo semanal</h3>

  {#if loading}
    <div class="kpi-grid">
      {#each [1,2,3] as i}
        <div class="kpi-card skeleton">
          <div class="skeleton-line"></div>
          <div class="skeleton-bar"></div>
        </div>
      {/each}
    </div>
  {:else}
    {#if guidanceMessage}
      <p class="weekly-note">{guidanceMessage}</p>
    {/if}
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon surveillance"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
        <div class="kpi-content">
          <span class="kpi-label">Días en vigilancia</span>
          <strong class="kpi-value">{kpis.observedDays < 7 ? '—' : `${kpis.surveillanceDays} días`}</strong>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon score"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg></div>
        <div class="kpi-content">
          <span class="kpi-label">Puntaje promedio</span>
          <strong class="kpi-value">{kpis.observedDays < 7 ? '—' : `${kpis.avgScore.toFixed(0)} pts`}</strong>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon action"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div>
        <div class="kpi-content">
          <span class="kpi-label">Acción principal</span>
          <strong class="kpi-value small">{kpis.topRecommendation}</strong>
        </div>
      </div>
    </div>
  {/if}
</article>

<style>
  .weekly-kpis {
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 16px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: var(--shadow-sm, 0 1px 3px rgba(31,41,55,0.06));
    font-family: var(--font-sans);
  }
  .weekly-kpis h3 {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary, #1f2937);
  }
  .weekly-note {
    margin: 0;
    font-size: var(--text-base);
    color: var(--text-secondary, #64748b);
    padding: 0.6rem 0.75rem;
    border: 1px dashed var(--border-subtle, #e2e8f0);
    border-radius: 10px;
    background: var(--bg-app, #f8fafc);
  }

  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }

  .kpi-card {
    background: var(--bg-app, #f8fafc);
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 12px;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-family: var(--font-sans);
  }

  .skeleton-line { height: 12px; width: 60%; background: var(--border-subtle, #e2e8f0); border-radius: 4px; }
  .skeleton-bar {
    height: 16px; width: 40%;
    background: linear-gradient(90deg, #7B5BA620, #A78BCC30, #7B5BA620);
    border-radius: 4px; animation: shimmer 1.5s infinite linear;
    background-size: 200% 100%;
  }
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  .kpi-icon { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; }
  .kpi-icon.surveillance { background: var(--status-vigilancia-bg); color: var(--status-vigilancia); }
  .kpi-icon.score { background: var(--status-rutina-bg); color: var(--status-rutina); }
  .kpi-icon.action { background: color-mix(in srgb, var(--primary, #7B5BA6) 12%, #fff); color: var(--primary, #7B5BA6); }
  .kpi-icon svg { width: 18px; height: 18px; }

  .kpi-label {
    font-size: var(--text-sm);
    color: var(--text-secondary, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-family: var(--font-sans);
  }
  .kpi-value {
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--text-primary, #1f2937);
    line-height: 1.2;
    font-family: var(--font-sans);
  }
  .kpi-value.small { font-size: var(--text-base); font-family: var(--font-sans); }
  .kpi-desc {
    font-size: var(--text-xs);
    font-family: var(--font-sans);
  }
</style>
