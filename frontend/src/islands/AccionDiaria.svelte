<script>
  import { onMount } from 'svelte';
  import { fetchJsonCached } from '../lib/api/client.js';

  export let apiUrl = '';
  export let region = 'madrid';

  let loading = true;
  let error = '';
  let operativo = null;

  const fetchJson = async (path) => {
    return fetchJsonCached(path, { apiUrl, init: { method: 'GET' } });
  };

  const fetchAccion = async () => {
    loading = true;
    error = '';
    try {
      const data = await fetchJson(`/api/risk/operativo?region=${encodeURIComponent(region)}`);
      operativo = data?.action_today ? { action_today: data.action_today } : null;
      if (!operativo) throw new Error('Sin datos operativos');
    } catch (e) {
      try {
        const snap = await fetchJson(`/api/dashboard?region=${encodeURIComponent(region)}`);
        const precip = snap?.snapshot?.precipitation_mm || 0;
        operativo = {
          action_today:
            precip > 5
              ? 'Revisa drenaje, evita acumulaciones de agua'
              : precip > 2
                ? 'Monitorea humedad y ventilación'
                : 'Mantén protocolo habitual',
        };
      } catch {
        if (!operativo) error = e.message || 'Error al cargar acción';
      }
    } finally {
      loading = false;
    }
  };

  const handleRegionChange = (e) => {
    if (e.detail !== region) {
      region = e.detail;
      fetchAccion();
    }
  };

  onMount(() => {
    fetchAccion();
    window.addEventListener('regionchange', handleRegionChange);
    return () => window.removeEventListener('regionchange', handleRegionChange);
  });
</script>

<article class="card">
  <p class="kicker">Qué hacer hoy</p>
  {#if loading}
    <p class="loading">Cargando...</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else}
    <p class="action">{operativo?.action_today ?? 'Mantén protocolo base.'}</p>
  {/if}
</article>

<style>
  .card {
    background: linear-gradient(180deg, #302742 0%, #261d36 100%);
    border: 1px solid rgba(164, 127, 202, 0.3);
    border-radius: 18px;
    padding: 1.2rem;
    color: #f7f4ff;
  }
  .kicker {
    margin: 0;
    text-transform: uppercase;
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-wider);
    color: #bda6dc;
    font-family: var(--font-sans);
  }
  .action {
    margin: 0.55rem 0 0;
    font-size: var(--text-base);
    line-height: 1.45;
    color: #efe7ff;
    font-family: var(--font-sans);
  }
  .loading,
  .error {
    margin: 0.55rem 0 0;
    color: #d9c9f1;
  }
  .error {
    color: #fecaca;
  }
</style>
