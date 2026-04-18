<script>
  import { onDestroy, onMount } from 'svelte';

  export let apiUrl = '';
  export let region = 'madrid';

  let kpis = { surveillanceDays: 0, avgScore: 0, topRecommendation: '' };
  let loading = true;

  const fetchKPIs = async () => {
    loading = true;
    try {
      const res = await fetch(`${apiUrl}/api/recommendations/week?region=${region}&days=7`);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        const surveillanceDays = items.filter(r => {
          const level = (r.global_risk_level || '').toLowerCase();
          return level === 'alto' || level === 'medio';
        }).length;
        const avgScore = items.length
          ? Math.round(items.reduce((sum, r) => sum + (Number(r.fungal_risk) || 0), 0) / items.length)
          : 0;
        const topRecommendation = items.length > 0 ? items[0].title || 'Sin recomendaciones' : 'Sin datos';
        kpis = { surveillanceDays, avgScore, topRecommendation };
      }
    } catch (e) { console.error(e); }
    finally { loading = false; }
  };

  const handleRegionChange = (e) => {
    if (e.detail !== region) {
      region = e.detail;
      fetchKPIs();
    }
  };

  onMount(() => {
    fetchKPIs();
    if (typeof window !== 'undefined') {
      window.addEventListener('regionchange', handleRegionChange);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('regionchange', handleRegionChange);
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
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon surveillance"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
        <div class="kpi-content">
          <span class="kpi-label">Días en vigilancia</span>
          <strong class="kpi-value">{kpis.surveillanceDays} días</strong>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon score"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg></div>
        <div class="kpi-content">
          <span class="kpi-label">Puntaje promedio</span>
          <strong class="kpi-value">{kpis.avgScore.toFixed(0)} pts</strong>
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
  .weekly-kpis { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
  .weekly-kpis h3 { margin: 0; font-size: 1.1rem; font-weight: 600; color: #1f2937; }

  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }

  .kpi-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .skeleton-line { height: 12px; width: 60%; background: #e2e8f0; border-radius: 4px; }
  .skeleton-bar { height: 16px; width: 40%; background: linear-gradient(90deg, #7B5BA620, #A78BCC30, #7B5BA620); border-radius: 4px; animation: shimmer 1.5s infinite linear; background-size: 200% 100%; }
  @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

  .kpi-icon { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; }
  .kpi-icon.surveillance { background: var(--status-vigilancia-bg); color: var(--status-vigilancia); }
  .kpi-icon.score { background: var(--status-rutina-bg); color: var(--status-rutina); }
  .kpi-icon.action { background: #DBEAFE; color: #2563EB; }
  .kpi-icon svg { width: 18px; height: 18px; }

  .kpi-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  .kpi-value { font-size: 1.1rem; font-weight: 700; color: #1f2937; line-height: 1.2; }
  .kpi-value.small { font-size: 0.8rem; }
</style>
