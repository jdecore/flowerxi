<script>
  import { onMount } from 'svelte';

  export let apiUrl;
  export let region = 'madrid';

  const COLORS = {
    rutina: '#7A8B6F',
    vigilancia: '#F59E0B',
    accion: '#C75D5D',
    up: '#C75D5D',
    down: '#7A8B6F',
    stable: '#8B7AA3',
  };

  const STATUS_ICONS = {
    rutina: '✓',
    vigilancia: '⚠',
    accion: '🚨',
  };

  const TREND_LABELS = {
    up: 'Subiendo',
    down: 'Bajando',
    stable: 'Estable',
  };

  const CONFIDENCE_LABELS = {
    alta: 'Alta',
    media: 'Media',
    baja: 'Baja',
  };

  let loading = true;
  let error = '';
  let data = null;

  const fetchOperative = async () => {
    loading = true;
    error = '';
    try {
      const res = await fetch(`${apiUrl}/api/risk/operativo?region=${encodeURIComponent(region)}`);
      if (!res.ok) throw new Error('Error al cargar estado operativo');
      data = await res.json();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    fetchOperative();
  });

  $: statusColor = data?.status ? COLORS[data.status] : COLORS.rutina;
  $: trendColor = data?.trend_7d ? COLORS[data.trend_7d] : COLORS.stable;
</script>

<div class="operative-dashboard">
  {#if loading}
    <div class="operative-loading">
      <p>Cargando estado operativo...</p>
    </div>
  {:else if error}
    <div class="operative-error">
      <p>{error}</p>
      <button on:click={fetchOperative}>Reintentar</button>
    </div>
  {:else if data}
    <!-- Estado Principal -->
    <div class="operative-status" style="--status-color: {statusColor}">
      <div class="status-header">
        <span class="status-icon">{STATUS_ICONS[data.status] || '?'}</span>
        <div class="status-text">
          <h2>Estado hoy: {data.status_label}</h2>
          <span class="status-score">Nivel {data.score}</span>
        </div>
      </div>
      
      <p class="status-reason">{data.reason}</p>
      
      <div class="action-box">
        <h3>Haz hoy:</h3>
        <p>{data.action_today}</p>
      </div>
      
      {#if data.attention}
        <div class="attention-box">
          <span class="attention-icon">ℹ</span>
          <p>{data.attention}</p>
        </div>
      {/if}
    </div>

    <!-- Métricas secundarias -->
    <div class="operative-metrics">
      <div class="metric">
        <span class="metric-label">Motivo</span>
        <span class="metric-value reason-value">
          {#if data.details?.rainy_days > 0}
            Lluvia {data.details.rainy_days}d
          {/if}
          {#if data.details?.avg_temp}
            , {data.details.avg_temp}°C
          {/if}
        </span>
      </div>
      
      <div class="metric">
        <span class="metric-label">Evolución 7d</span>
        <span class="metric-value trend-value" style="color: {trendColor}">
          {TREND_LABELS[data.trend_7d] || 'Estable'}
        </span>
      </div>
      
      <div class="metric">
        <span class="metric-label">Confianza</span>
        <span class="metric-value confidence-{data.confidence}">
          {CONFIDENCE_LABELS[data.confidence]} ({data.details?.days_available || 0}/7)
        </span>
      </div>
    </div>
  {/if}
</div>

<style>
  .operative-dashboard {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .operative-loading, .operative-error {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary, #666);
  }

  .operative-error button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: var(--primary, #756A85);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }

  /* Estado Principal */
  .operative-status {
    background: var(--bg-surface, #fff);
    border: 2px solid var(--status-color);
    border-radius: 16px;
    padding: 1.25rem;
  }

  .status-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .status-icon {
    font-size: 1.5rem;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--status-color);
    border-radius: 50%;
    color: white;
  }

  .status-text h2 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-primary, #222);
  }

  .status-score {
    font-size: 0.85rem;
    color: var(--text-secondary, #666);
  }

  .status-reason {
    margin: 0 0 1rem;
    font-size: 0.95rem;
    color: var(--text-primary, #222);
    line-height: 1.5;
  }

  .action-box {
    background: rgba(117, 106, 133, 0.08);
    border-left: 4px solid var(--status-color);
    padding: 0.85rem 1rem;
    border-radius: 0 10px 10px 0;
  }

  .action-box h3 {
    margin: 0 0 0.35rem;
    font-size: 0.8rem;
    color: var(--primary, #756A85);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .action-box p {
    margin: 0;
    font-size: 0.95rem;
    color: var(--text-primary, #222);
    font-weight: 500;
  }

  .attention-box {
    margin-top: 0.85rem;
    padding: 0.65rem 0.85rem;
    background: rgba(245, 158, 11, 0.1);
    border-radius: 8px;
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .attention-icon {
    color: #F59E0B;
    font-size: 1rem;
  }

  .attention-box p {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-secondary, #666);
    line-height: 1.4;
  }

  /* Métricas */
  .operative-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }

  .metric {
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-subtle, #eee);
    border-radius: 12px;
    padding: 0.85rem;
    text-align: center;
  }

  .metric-label {
    display: block;
    font-size: 0.7rem;
    color: var(--text-tertiary, #9590A3);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 0.35rem;
  }

  .metric-value {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary, #222);
  }

  .reason-value {
    font-size: 0.8rem;
  }

  .confidence-alta { color: #7A8B6F; }
  .confidence-media { color: #8B7AA3; }
  .confidence-baja { color: #C75D5D; }

  @media (max-width: 600px) {
    .operative-metrics {
      grid-template-columns: 1fr;
    }
  }
</style>