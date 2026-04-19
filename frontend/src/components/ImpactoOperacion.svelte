<script>
  import { onDestroy, onMount } from 'svelte';
  import { fetchJsonCached } from '../lib/api/client.js';

  export let apiUrl = '';
  export let region = 'madrid';

  let currentScore = null;
  let currentStatus = 'Sin datos';
  let surveillanceDays = null;
  let observedDays = null;
  let recommendation = 'Datos no disponibles.';
  let error = '';

  const fetchJson = async (path) => {
    return fetchJsonCached(path, {
      apiUrl,
      cacheTtlMs: 16_000,
      throwOnError: true,
    });
  };

  const fetchImpact = async () => {
    error = '';
    currentScore = null;
    currentStatus = 'Sin datos';
    surveillanceDays = null;
    observedDays = null;
    recommendation = 'Datos no disponibles.';
    try {
      const [operativo, weekly, history] = await Promise.all([
        fetchJson(`/api/risk/operativo?region=${encodeURIComponent(region)}`).catch(() => null),
        fetchJson(`/api/recommendations/week?region=${encodeURIComponent(region)}&days=7`).catch(() => null),
        fetchJson(`/api/history?region=${encodeURIComponent(region)}&limit=7`).catch(() => null),
      ]);

      currentScore = Number.isFinite(Number(operativo?.score)) ? Number(operativo.score) : null;
      currentStatus = operativo?.status_label || 'Sin datos';
      recommendation = operativo?.action_today || recommendation;

      const items = Array.isArray(weekly?.items) ? weekly.items : [];
      const historyItems = Array.isArray(history?.items) ? history.items : [];
      const sourceItems = items.length > 0 ? items : historyItems;
      observedDays = sourceItems.length;
      surveillanceDays = sourceItems.filter((item) => {
        const level = String(item?.global_risk_level || '').toLowerCase();
        return level === 'alto' || level === 'medio';
      }).length;

      if (currentScore === null && historyItems.length > 0) {
        const latest = historyItems[0];
        const fungal = Number(latest?.fungal_risk);
        const water = Number(latest?.waterlogging_risk);
        const heat = Number(latest?.heat_risk);
        if ([fungal, water, heat].every(Number.isFinite)) {
          currentScore = Math.round(fungal * 0.5 + water * 0.3 + heat * 0.2);
          currentStatus = currentScore >= 70 ? 'Acción requerida' : currentScore >= 40 ? 'Vigilancia reforzada' : 'Rutina normal';
        }
      }

      if (recommendation === 'Datos no disponibles.') {
        recommendation = items[0]?.message || historyItems[0]?.recommendation_message || recommendation;
      }

      if (currentScore === null && observedDays === 0) {
        error = 'Datos no disponibles.';
      }
    } catch (e) {
      error = 'Datos no disponibles.';
      console.error(e);
    }
  };

  const handleRegionChange = (e) => {
    if (e.detail !== region) {
      region = e.detail;
      fetchImpact();
    }
  };

  const handleRefresh = () => {
    fetchImpact();
  };

  onMount(() => {
    fetchImpact();
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

<article class="impacto-operacion">
  <div class="impact-header">
    <h3>Impacto en operación</h3>
    <span class="impact-badge">📊</span>
  </div>

  <p class="impact-intro">
    Con el estado actual, esta semana en <strong>{region}</strong>:
  </p>

  {#if error}
    <p class="impact-error">{error}</p>
  {/if}

  <ul class="impact-list">
    <li>
      <span class="impact-icon">⏱️</span>
      <div>
        <strong>Riesgo hoy:</strong>
        <span class="value">{currentScore === null ? 'Datos no disponibles' : `${currentStatus} (${currentScore})`}</span>
      </div>
    </li>
    <li>
      <span class="impact-icon">🛡️</span>
      <div>
        <strong>Días en vigilancia (7d):</strong>
        <span class="value">
          {observedDays === null ? 'Datos no disponibles' : `${surveillanceDays}/${observedDays} días`}
        </span>
      </div>
    </li>
    <li>
      <span class="impact-icon">📋</span>
      <div>
        <strong>Recomendación:</strong>
        <span class="value action">{recommendation}</span>
      </div>
    </li>
  </ul>

  <p class="impact-note">
    ℹ️ Basado en datos reales de recomendaciones y señales de riesgo del backend.
  </p>
</article>

<style>
  .impacto-operacion { background: var(--bg-surface, #fff); border: 1px solid var(--border-subtle, #e2e8f0); border-radius: 16px; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: var(--shadow-sm, 0 1px 3px rgba(31,41,55,0.06)); font-family: var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif); }
  .impact-header { display: flex; justify-content: space-between; align-items: center; font-family: var(--font-sans); }
  .impact-header h3 { margin: 0; font-size: var(--text-xl); font-weight: 500; color: var(--text-primary, #1f2937); }
  .impact-badge { font-size: var(--text-2xl); }
  .impact-intro { margin: 0; font-size: var(--text-lg); line-height: 1.5; color: var(--text-secondary, #4b5563); font-family: var(--font-sans); }
  .impact-intro strong { color: var(--text-primary, #1f2937); }
  .impact-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; font-family: var(--font-sans); }
  .impact-list li { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem; background: var(--bg-app, #f8fafc); border-radius: 10px; border: 1px solid var(--border-subtle, #e2e8f0); font-family: var(--font-sans); }
  .impact-icon { font-size: 1.2rem; flex-shrink: 0; font-family: var(--font-sans); }
  .impact-list strong { display: block; font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary, #374151); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem; font-family: var(--font-sans); }
  .value { font-size: var(--text-lg); color: var(--text-primary, #1f2937); font-family: var(--font-sans); }
  .value.action { color: var(--status-rutina, #059669); font-weight: 500; }
  .impact-note { margin: 0; font-size: var(--text-sm); line-height: 1.5; color: var(--text-secondary, #6b7280); padding: 0.5rem 0.75rem; background: var(--status-vigilancia-bg, #fef3c7); border-radius: 8px; border-left: 3px solid var(--status-vigilancia, #F59E0B); font-family: var(--font-sans); }
  .impact-error { margin: 0; font-size: var(--text-base); font-weight: 500; color: #b91c1c; font-family: var(--font-sans); }
</style>
