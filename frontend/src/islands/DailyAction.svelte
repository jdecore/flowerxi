<script>
  import { onMount } from 'svelte';
  import { fetchJsonCached } from '../lib/api/client.js';

  export let apiUrl = '';
  export let region = 'madrid';

  let loading = true;
  let error = '';
  let action = null;

  const fetchJson = async (path, init) => {
    return fetchJsonCached(path, { init, apiUrl, cacheTtlMs: 0, timeoutMs: 10_000 });
  };

  const fetchDailyAction = async () => {
    loading = true;
    error = '';
    try {
      const data = await fetchJson(`/api/risk/operativo?region=${encodeURIComponent(region)}`);
      action = data?.action_today || null;
    } catch (e) {
      error = e.message;
      action = null;
    } finally {
      loading = false;
    }
  };

  const handleRegionChange = (e) => {
    if (e.detail !== region) {
      region = e.detail;
      fetchDailyAction();
    }
  };

  onMount(() => {
    fetchDailyAction();
    window.addEventListener('regionchange', handleRegionChange);
    return () => window.removeEventListener('regionchange', handleRegionChange);
  });
</script>

{#if loading}
  <div class="action-loading">
    <div class="spinner"></div>
    <span>Cargando acción...</span>
  </div>
{:else if error}
  <div class="action-error">⚠️ {error}</div>
{:else if action}
  <article class="daily-action">
    <div class="action-header">
      <div class="action-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
      </div>
      <div class="action-title">
        <h2>Acción de hoy</h2>
        <p>Lo prioritario para tu cultivo</p>
      </div>
    </div>
    <p class="action-text">{action}</p>
  </article>
{/if}

<style>
  .daily-action {
    background: linear-gradient(135deg, #fef9c3 0%, #fef3c7 100%);
    border: 2px solid #fbbf24;
    border-radius: 20px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 8px 24px rgba(251, 191, 36, 0.2);
  }

  .action-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .action-icon {
    width: 48px;
    height: 48px;
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 12px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .action-icon svg {
    width: 24px;
    height: 24px;
    color: #d97706;
  }

   .action-title h2 {
     margin: 0;
     font-family: var(--font-sans);
     font-size: var(--text-xl);
     font-weight: 700;
     color: #92400e;
   }

   .action-title p {
     margin: 0.2rem 0 0;
     font-family: var(--font-sans);
     font-size: var(--text-sm);
     color: #d97706;
   }

   .action-text {
     margin: 0;
     font-family: var(--font-sans);
     font-size: var(--text-lg);
     color: #78350f;
     line-height: 1.5;
     font-weight: 500;
     padding: 1rem;
     background: #fffbeb;
     border-radius: 12px;
     border-left: 4px solid #f59e0b;
   }

  .action-loading,
  .action-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    color: #64748b;
    text-align: center;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
