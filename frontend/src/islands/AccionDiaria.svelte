<script>
  import { onMount } from 'svelte';

  export let apiUrl = '';
  export let region = 'madrid';

  let loading = true;
  let error = '';
  let operativo = null;

  const fetchData = async () => {
    loading = true;
    error = '';
    try {
      let res = await fetch(`${apiUrl}/api/risk/operativo?region=${region}`);
      if (!res.ok) throw new Error(`Error (${res.status})`);
      operativo = await res.json();
      if (!operativo?.action_today) throw new Error('Sin datos');
    } catch (e) {
      try {
        const snapRes = await fetch(`${apiUrl}/api/dashboard?region=${region}`);
        if (snapRes.ok) {
          const snap = await snapRes.json();
          const precip = snap?.snapshot?.precipitation_mm || 0;
          operativo = {
            action_today: precip > 5 ? 'Revisa drenaje, evita acumulaciones de agua' : precip > 2 ? 'Monitorea humedad y ventilación' : 'Mantén protocolo habitual',
          };
        }
      } catch {}
      if (!operativo) error = e.message;
    } finally {
      loading = false;
    }
  };

  onMount(fetchData);
</script>

<article class="card">
  <p class="kicker">Qué hacer hoy</p>
  {#if loading}
    <p class="loading">Cargando...</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else}
    <p class="action">
      {operativo?.action_today ?? 'Mantén protocolo base.'}
    </p>
    {#if operativo?.attention}
      <p class="attention">{operativo.attention}</p>
    {/if}
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
    font-size: 0.74rem;
    letter-spacing: 0.07em;
    color: #bda6dc;
  }
  .action {
    margin: 0.55rem 0 0;
    line-height: 1.45;
    color: #efe7ff;
  }
  .attention {
    margin-top: 0.75rem;
    padding: 0.65rem 0.75rem;
    border-radius: 10px;
    border: 1px solid rgba(245, 158, 11, 0.3);
    background: rgba(245, 158, 11, 0.12);
    color: #d4c4e8;
    font-size: 0.86rem;
    line-height: 1.4;
  }
  .loading, .error {
    margin: 0.55rem 0 0;
    color: #d9c9f1;
  }
  .error { color: #fecaca; }
</style>