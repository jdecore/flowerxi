<script>
  import { onMount } from 'svelte';
  import { fetchJsonCached } from '../lib/api/client.js';

  export let apiUrl = '';
  export let region = 'madrid';

  let loading = true;
  let error = '';
  let operativo = null;
  let regionName = region;

  const STATUS_UI = {
    rutina: { label: 'Rutina', tone: 'rutina' },
    vigilancia: { label: 'Vigilancia', tone: 'vigilancia' },
    accion: { label: 'Acción', tone: 'accion' },
    sin_datos: { label: 'Sin datos', tone: 'sin-datos' },
  };

  const fetchJson = async (path) => {
    return fetchJsonCached(path, { apiUrl });
  };

  const buildFallback = (snap) => {
    const precip = snap?.snapshot?.precipitation_mm || 0;
    const score = precip > 5 ? 65 : precip > 2 ? 45 : 22;
    return {
      status: score > 60 ? 'accion' : score > 30 ? 'vigilancia' : 'rutina',
      reason: precip > 5 ? 'Lluvia elevada hoy' : precip > 2 ? 'Lluvia moderada' : 'Condiciones normales',
      score,
      action_today: precip > 5 ? 'Revisa drenaje y ventilación' : 'Mantén protocolo habitual',
    };
  };

  const fetchEstado = async () => {
    loading = true;
    error = '';
    operativo = null;
    try {
      const data = await fetchJson(`/api/risk/operativo?region=${encodeURIComponent(region)}`);
      if (data?.status) {
        operativo = data;
        regionName = data?.region || region;
      } else {
        throw new Error('Sin datos operativos');
      }
    } catch (e) {
      try {
        const snap = await fetchJson(`/api/dashboard?region=${encodeURIComponent(region)}`);
        if (snap?.snapshot) {
          operativo = buildFallback(snap);
          regionName = snap.snapshot.region_name || region;
        } else {
          throw e;
        }
      } catch (e2) {
        error = e.message;
      }
    } finally {
      loading = false;
    }
  };

  onMount(fetchEstado);
</script>

<article class="card estado-card {loading ? '' : operativo?.status ? STATUS_UI[operativo.status]?.tone : 'sin-datos'}">
  <p class="kicker">Estado en vivo</p>
  {#if loading}
    <p class="loading">Cargando...</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else}
    <h2>{STATUS_UI[operativo?.status]?.label ?? 'Sin datos'}</h2>
    <p class="copy">{operativo?.reason ?? 'Sin razón disponible'}</p>
    <div class="badges">
      <span>Municipio: {regionName}</span>
      <span>Puntaje: {operativo?.score ?? '--'}</span>
    </div>
  {/if}
</article>

<style>
  .card {
    background: linear-gradient(180deg, #302742 0%, #261d36 100%);
    border: 1px solid rgba(164, 127, 202, 0.3);
    border-radius: 18px;
    padding: 1.2rem;
    color: #f7f4ff;
    font-family: var(--font-sans);
  }
  .kicker {
    margin: 0;
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #bda6dc;
    font-family: var(--font-sans);
  }
  h2 {
    margin: 0.35rem 0 0;
    font-size: var(--text-3xl);
    font-weight: 700;
    font-family: var(--font-sans);
  }
  .copy {
    margin: 0.55rem 0 0;
    line-height: 1.45;
    color: #efe7ff;
    font-family: var(--font-sans);
  }
  .badges {
    margin-top: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    font-family: var(--font-sans);
  }
  .badges span {
    background: rgba(189, 166, 220, 0.2);
    color: #d8c7ef;
    border-radius: 999px;
    padding: 0.2rem 0.65rem;
    font-size: var(--text-xs);
    font-family: var(--font-sans);
  }
  .estado-card.rutina { border-color: rgba(122, 139, 111, 0.55); }
  .estado-card.vigilancia { border-color: rgba(245, 158, 11, 0.65); }
  .estado-card.accion { border-color: rgba(199, 93, 93, 0.65); }
  .estado-card.sin-datos { border-color: rgba(189, 166, 220, 0.45); }
  .loading, .error {
    margin: 0.55rem 0 0;
    color: #d9c9f1;
    font-family: var(--font-sans);
  }
  .error { color: #fecaca; }
</style>
