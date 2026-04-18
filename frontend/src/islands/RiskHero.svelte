<script>
  import { onMount } from 'svelte';

  export let apiUrl = '';
  export let region = 'madrid';

  let loading = true;
  let error = '';
  let data = null;

  const statusConfig = {
    rutina: {
      label: 'Rutina',
      icon: '✓',
      color: '#16a34a',
      bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
      border: '#22c55e',
      shadow: 'rgba(34, 197, 94, 0.2)'
    },
    vigilancia: {
      label: 'Vigilancia',
      icon: '⚠',
      color: '#ea580c',
      bg: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
      border: '#f97316',
      shadow: 'rgba(249, 115, 22, 0.2)'
    },
    accion: {
      label: 'Acción',
      icon: '🚨',
      color: '#dc2626',
      bg: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
      border: '#ef4444',
      shadow: 'rgba(239, 68, 68, 0.2)'
    },
    sin_datos: {
      label: 'Sin datos',
      icon: '?',
      color: '#64748b',
      bg: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      border: '#94a3b8',
      shadow: 'rgba(148, 163, 184, 0.2)'
    }
  };

  const fetchData = async () => {
    loading = true;
    error = '';
    try {
      const res = await fetch(`${apiUrl}/api/risk/operativo?region=${region}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      data = await res.json();
      if (!data?.status) throw new Error('Sin datos');
    } catch (e) {
      error = e.message;
      data = null;
    } finally {
      loading = false;
    }
  };

  // Manejo de cambios de región
  const handleRegionChange = (e) => {
    if (e.detail !== region) {
      region = e.detail;
      fetchData();
    }
  };

  onMount(() => {
    fetchData();
    window.addEventListener('regionchange', handleRegionChange);
    return () => window.removeEventListener('regionchange', handleRegionChange);
  });
</script>

{#if loading}
  <div class="hero-loading">
    <div class="spinner"></div>
    <span>Cargando estado de riesgo...</span>
  </div>
{:else if error}
  <div class="hero-error">
    <span>⚠️ {error}</span>
    <button on:click={fetchData}>Reintentar</button>
  </div>
{:else if data && config}
  <article class="risk-hero" style="--status-color: {config.color}; --status-bg: {config.bg}; --status-border: {config.border}; --status-shadow: {config.shadow};">
    <!-- Header con estado grande -->
    <div class="hero-header">
      <div class="status-badge" style="background: {config.bg}; border-color: {config.border};">
        <span class="status-icon" style="color: {config.color};">{config.icon}</span>
        <span class="status-label" style="color: {config.color};">{config.label}</span>
      </div>
      <div class="region-tag">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z"/>
          <circle cx="12" cy="10" r="2.5"/>
        </svg>
        {data.region || region}
      </div>
    </div>

    <!-- Nivel de riesgo principal -->
    <div class="hero-main">
      <h1 class="risk-title">Nivel de riesgo hoy</h1>
      <div class="risk-gauge">
        <div class="gauge-ring" style="--progress: {Math.min(data.score || 0, 100)}%; --ring-color: {config.color};">
          <svg viewBox="0 0 120 120" class="gauge-svg">
            <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" stroke-width="8"/>
            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--ring-color)" stroke-width="8"
                   stroke-dasharray="339.3" stroke-dashoffset="339.3" stroke-linecap="round"
                   style="stroke-dashoffset: calc(339.3 - (339.3 * var(--progress) / 100));" />
          </svg>
          <div class="gauge-center">
            <span class="gauge-value" style="color: {config.color};">{data.score || 0}</span>
            <span class="gauge-label">puntos</span>
          </div>
        </div>
      </div>
      <p class="risk-reason">{data.reason || 'Sin explicación disponible'}</p>
    </div>

    <!-- Métricas de confianza y tendencia -->
    {#if data.trend_7d || data.confidence}
      <div class="hero-meta">
        {#if data.trend_7d}
          <div class="meta-item">
            <span class="meta-label">Tendencia 7 días</span>
            <span class="meta-value" style="color: {data.trend_7d === 'up' ? '#dc2626' : data.trend_7d === 'down' ? '#16a34a' : '#6366f1'};">
              {data.trend_7d === 'up' ? '↑ Subiendo' : data.trend_7d === 'down' ? '↓ Bajando' : '→ Estable'}
            </span>
          </div>
        {/if}
        {#if data.confidence}
          <div class="meta-item">
            <span class="meta-label">Confianza</span>
            <span class="meta-value" style="color: {data.confidence === 'alta' ? '#16a34a' : data.confidence === 'media' ? '#ea580c' : '#dc2626'};">
              ● {data.confidence === 'alta' ? 'Alta' : data.confidence === 'media' ? 'Media' : 'Baja'}
            </span>
          </div>
        {/if}
      </div>
    {/if}
  </article>
{/if}

<style>
  .risk-hero {
    background: var(--status-bg);
    border: 2px solid var(--status-border);
    border-radius: 20px;
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-shadow: 0 8px 24px var(--status-shadow);
    position: relative;
    overflow: hidden;
  }

  .hero-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    border: 1.5px solid var(--status-border);
    font-weight: 600;
  }

  .status-icon {
    font-size: 1.1rem;
    line-height: 1;
  }

  .status-label {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .region-tag {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
    color: #64748b;
    font-weight: 500;
  }

  .region-tag svg {
    color: #94a3b8;
  }

  .hero-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
  }

  .risk-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .risk-gauge {
    position: relative;
    width: 140px;
    height: 140px;
  }

  .gauge-svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .gauge-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .gauge-value {
    font-size: 2.75rem;
    font-weight: 700;
    line-height: 1;
  }

  .gauge-label {
    font-size: 0.8rem;
    color: #64748b;
    margin-top: 0.25rem;
  }

  .risk-reason {
    margin: 0;
    font-size: 1.05rem;
    color: #334155;
    line-height: 1.4;
    max-width: 480px;
    font-weight: 500;
  }

  .hero-meta {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    justify-content: center;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(0,0,0,0.06);
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.8rem;
  }

  .meta-label {
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
  }

  .meta-value {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .hero-loading,
  .hero-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem;
    color: #64748b;
    text-align: center;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .hero-error button {
    background: #6366f1;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
  }

  @media (max-width: 600px) {
    .risk-hero {
      padding: 1.25rem;
    }

    .risk-gauge {
      width: 120px;
      height: 120px;
    }

    .gauge-value {
      font-size: 2.25rem;
    }

    .risk-reason {
      font-size: 0.95rem;
    }
  }
</style>
