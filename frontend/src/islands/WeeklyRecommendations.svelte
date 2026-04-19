<script>
  import { onMount } from 'svelte';
  import { fetchJsonCached } from '../lib/api/client.js';

  export let apiUrl = '';
  export let region = 'madrid';

  let loading = true;
  let error = '';
  let recommendations = [];

  const fetchJson = async (path) => {
    return fetchJsonCached(path, { apiUrl });
  };

  const fetchWeeklyRecs = async () => {
    loading = true;
    error = '';
    try {
      const data = await fetchJson(`/api/recommendations/week?region=${encodeURIComponent(region)}&days=7`);
      recommendations = Array.isArray(data?.recommendations) ? data.recommendations : [];
    } catch (e) {
      error = e.message;
      recommendations = [];
    } finally {
      loading = false;
    }
  };

  const handleRegionChange = (e) => {
    if (e.detail !== region) {
      region = e.detail;
      fetchWeeklyRecs();
    }
  };

  onMount(() => {
    fetchWeeklyRecs();
    window.addEventListener('regionchange', handleRegionChange);
    return () => window.removeEventListener('regionchange', handleRegionChange);
  });
</script>

<article class="weekly-rec">
  <div class="rec-header">
    <h3>Plan semanal</h3>
    <p class="rec-subtitle">Recomendaciones próximos 7 días</p>
  </div>

  {#if loading}
    <div class="rec-loading">
      <div class="spinner"></div>
      <span>Cargando plan...</span>
    </div>
  {:else if error}
    <div class="rec-error">⚠️ {error}</div>
  {:else if recommendations.length === 0}
    <div class="rec-empty">No hay recomendaciones disponibles</div>
  {:else}
    <ul class="rec-list">
      {#each recommendations as rec, i}
        {@const dayNum = i + 1}
        <li class="rec-item" class:urgent={rec.priority === 'high'}>
          <div class="rec-day">
            <span class="day-num">D{dayNum}</span>
            <span class="day-date">{new Date(rec.date || Date.now()).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })}</span>
          </div>
          <div class="rec-content">
            <p class="rec-action">{rec.action || 'Seguir protocolo habitual'}</p>
            {#if rec.reason}
              <p class="rec-reason">{rec.reason}</p>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</article>

<style>
   .weekly-rec {
     background: white;
     border: 1px solid #e2e8f0;
     border-radius: 16px;
     padding: 1.5rem;
     display: flex;
     flex-direction: column;
     gap: 1rem;
     font-family: var(--font-sans);
   }

   .rec-header h3 {
     margin: 0;
     font-size: var(--text-xl);
     font-weight: 600;
     color: #1e293b;
   }

   .rec-subtitle {
     margin: 0.2rem 0 0;
     font-size: var(--text-sm);
     color: #64748b;
   }

   .rec-loading,
   .rec-error,
   .rec-empty {
     display: flex;
     flex-direction: column;
     align-items: center;
     justify-content: center;
     gap: 0.5rem;
     padding: 1.5rem;
     color: #64748b;
     font-size: var(--text-base);
   }

   .spinner {
     width: 24px;
     height: 24px;
     border: 2px solid #e2e8f0;
     border-top-color: #6366f1;
     border-radius: 50%;
     animation: spin 0.8s linear infinite;
   }

   @keyframes spin {
     to { transform: rotate(360deg); }
   }

   .rec-list {
     list-style: none;
     margin: 0;
     padding: 0;
     display: flex;
     flex-direction: column;
     gap: 0.75rem;
   }

   .rec-item {
     display: grid;
     grid-template-columns: 60px 1fr;
     gap: 1rem;
     padding: 0.85rem;
     background: #f8fafc;
     border-radius: 12px;
     border: 1px solid #e2e8f0;
     transition: all 150ms ease;
   }

   .rec-item.urgent {
     background: #fef2f2;
     border-color: #fecaca;
   }

   .rec-item.urgent .rec-action {
     color: #991b1b;
   }

   .rec-day {
     display: flex;
     flex-direction: column;
     align-items: center;
     justify-content: center;
     background: #e0e7ff;
     color: #4338ca;
     padding: 0.5rem 0.4rem;
     border-radius: 10px;
     font-weight: 600;
   }

   .rec-item.urgent .rec-day {
     background: #fee2e2;
     color: #dc2626;
   }

   .day-num {
     font-size: var(--text-xs);
     text-transform: uppercase;
   }

   .day-date {
     font-size: var(--text-xs);
     opacity: 0.8;
   }

   .rec-content {
     display: flex;
     flex-direction: column;
     gap: 0.3rem;
   }

   .rec-action {
     margin: 0;
     font-size: var(--text-lg);
     font-weight: 500;
     color: #334155;
     line-height: 1.4;
   }

   .rec-reason {
     margin: 0;
     font-size: var(--text-xs);
     color: #64748b;
     line-height: 1.3;
   }
</style>
