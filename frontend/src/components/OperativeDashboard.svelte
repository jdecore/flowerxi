<script>
  import { onMount } from 'svelte';

  export let apiUrl;
  export let selectedRegion = 'madrid';

  let operativo = null;
  let loading = true;
  let error = '';

  const fetchOperativo = async () => {
    loading = true;
    error = '';
    try {
      const res = await fetch(`${apiUrl}/api/risk/operativo?region=${encodeURIComponent(selectedRegion)}`);
      if (!res.ok) throw new Error('Error fetching operativo');
      operativo = await res.json();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  };

  export const refresh = () => fetchOperativo();

  onMount(() => {
    fetchOperativo();
  });

  $: statusConfig = operativo ? {
    rutina: { label: 'Rutina normal', icon: '✓', color: '#7A8B6F', bg: '#f0f4ed' },
    vigilancia: { label: 'Vigilancia reforzada', icon: '⚠', color: '#F59E0B', bg: '#fef3e2' },
    accion: { label: 'Acción requerida', icon: '🚨', color: '#C75D5D', bg: '#fef2f2' },
  }[operativo.status] : null;

  $: trendConfig = operativo?.trend_7d ? {
    up: { label: 'Subiendo', icon: '↑', color: '#C75D5D' },
    down: { label: 'Bajando', icon: '↓', color: '#7A8B6F' },
    stable: { label: 'Estable', icon: '→', color: '#8B7AA3' },
  }[operativo.trend_7d] : null;

  $: confidenceConfig = operativo?.confidence ? {
    alta: { label: 'Alta', color: '#7A8B6F' },
    media: { label: 'Media', color: '#F59E0B' },
    baja: { label: 'Baja', color: '#C75D5D' },
  }[operativo.confidence] : null;
</script>

{#if loading}
  <div class="operative-loading">
    <div class="spinner"></div>
    <span>Cargando estado operativo...</span>
  </div>
{:else if error}
  <div class="operative-error">
    <span>⚠️ {error}</span>
    <button on:click={fetchOperativo}>Reintentar</button>
  </div>
{:else if operativo && statusConfig}
  <article class="operative-dashboard">
    <header class="operativo-header" style="background: {statusConfig.bg}; border-left: 4px solid {statusConfig.color};">
      <div class="operativo-status-row">
        <span class="status-icon" style="color: {statusConfig.color};">{statusConfig.icon}</span>
        <div class="status-text">
          <span class="status-label" style="color: {statusConfig.color};">Estado hoy: {statusConfig.label}</span>
          <span class="status-score">Nivel {operativo.score}</span>
        </div>
      </div>
      <p class="operativo-reason">{operativo.reason}</p>
    </header>

    <div class="operativo-action">
      <div class="action-badge">
        <span class="action-icon">💡</span>
        <span class="action-label">Haz hoy:</span>
      </div>
      <p class="action-text">{operativo.action_today}</p>
    </div>

    {#if operativo.attention}
      <div class="operativo-attention">
        <span class="attention-icon">📢</span>
        <p>{operativo.attention}</p>
      </div>
    {/if}

    <div class="operativo-metrics">
      <div class="metric-block">
        <span class="metric-label">Evolución 7 días</span>
        {#if trendConfig}
          <span class="metric-value" style="color: {trendConfig.color};">
            {trendConfig.icon} {trendConfig.label}
          </span>
        {/if}
      </div>
      <div class="metric-block">
        <span class="metric-label">Confianza</span>
        {#if confidenceConfig}
          <span class="metric-value" style="color: {confidenceConfig.color};">
            ● {confidenceConfig.label} ({operativo.details?.days_available}/7)
          </span>
        {/if}
      </div>
    </div>
  </article>
{:else}
  <div class="operative-empty">
    <span>Sin datos operativos disponibles</span>
  </div>
{/if}

<style>
  .operative-loading, .operative-error, .operative-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: var(--text-secondary, #666);
    font-size: 0.9rem;
    gap: 0.5rem;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-subtle, #eee);
    border-top-color: var(--primary, #756A85);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .operative-error button {
    background: var(--primary, #756A85);
    color: #fff;
    border: none;
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .operative-dashboard {
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-subtle, #eee);
    border-radius: 16px;
    overflow: hidden;
  }

  .operativo-header {
    padding: 1.25rem;
  }

  .operativo-status-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .status-icon {
    font-size: 1.5rem;
    line-height: 1;
  }

  .status-text {
    display: flex;
    flex-direction: column;
  }

  .status-label {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .status-score {
    font-size: 0.8rem;
    color: var(--text-secondary, #666);
  }

  .operativo-reason {
    font-size: 0.9rem;
    color: var(--text-primary, #222);
    margin: 0;
    line-height: 1.4;
  }

  .operativo-action {
    padding: 1rem 1.25rem;
    background: var(--bg-app, #f8f8f8);
    border-top: 1px solid var(--border-subtle, #eee);
  }

  .action-badge {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }

  .action-icon {
    font-size: 1rem;
  }

  .action-label {
    font-size: 0.75rem;
    color: var(--primary, #756A85);
    font-weight: 600;
    text-transform: uppercase;
  }

  .action-text {
    font-size: 0.95rem;
    color: var(--text-primary, #222);
    margin: 0;
    line-height: 1.4;
  }

  .operativo-attention {
    padding: 0.85rem 1.25rem;
    background: rgba(245, 158, 11, 0.1);
    border-top: 1px solid rgba(245, 158, 11, 0.2);
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .attention-icon {
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .operativo-attention p {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-secondary, #666);
    line-height: 1.4;
  }

  .operativo-metrics {
    display: flex;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border-subtle, #eee);
    background: var(--bg-app, #f8f8f8);
  }

  .metric-block {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .metric-label {
    font-size: 0.7rem;
    color: var(--text-secondary, #666);
    text-transform: uppercase;
  }

  .metric-value {
    font-size: 0.85rem;
    font-weight: 500;
  }
</style>