<script>
  import { onMount } from 'svelte';

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

  const toNumberOrNull = (value) => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const fetchData = async () => {
    loading = true;
    error = '';
    try {
      let res = await fetch(`${apiUrl}/api/risk/operativo?region=${region}`);
      if (!res.ok) throw new Error(`Error (${res.status})`);
      operativo = await res.json();
      if (!operativo?.status) throw new Error('Sin datos operativos');
      regionName = operativo?.region || region;
    } catch (e) {
      try {
        const snapRes = await fetch(`${apiUrl}/api/dashboard?region=${region}`);
        if (snapRes.ok) {
          const snap = await snapRes.json();
          const precip = snap?.snapshot?.precipitation_mm || 0;
          const temp = snap?.snapshot?.temp_mean_c || 15;
          const score = precip > 5 ? 65 : precip > 2 ? 45 : 22;
          operativo = {
            status: score > 60 ? 'accion' : score > 30 ? 'vigilancia' : 'rutina',
            reason: precip > 5 ? 'Lluvia elevada hoy' : precip > 2 ? 'Lluvia moderada' : 'Condiciones normales',
            score,
            action_today: precip > 5 ? 'Revisa drenaje y ventilación' : 'Mantén protocolo habitual',
          };
          regionName = snap?.snapshot?.region_name || region;
        }
      } catch {}
      if (!operativo) error = e.message;
    } finally {
      loading = false;
    }
  };

  onMount(fetchData);
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
      <span>Puntaje: {toNumberOrNull(operativo?.score) ?? '--'}</span>
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
  }
  .kicker {
    margin: 0;
    text-transform: uppercase;
    font-size: 0.74rem;
    letter-spacing: 0.07em;
    color: #bda6dc;
  }
  h2 {
    margin: 0.35rem 0 0;
    font-size: 1.5rem;
  }
  .copy {
    margin: 0.55rem 0 0;
    line-height: 1.45;
    color: #efe7ff;
  }
  .badges {
    margin-top: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }
  .badges span {
    background: rgba(189, 166, 220, 0.2);
    color: #d8c7ef;
    border-radius: 999px;
    padding: 0.2rem 0.65rem;
    font-size: 0.76rem;
  }
  .estado-card.rutina { border-color: rgba(122, 139, 111, 0.55); }
  .estado-card.vigilancia { border-color: rgba(245, 158, 11, 0.65); }
  .estado-card.accion { border-color: rgba(199, 93, 93, 0.65); }
  .estado-card.sin-datos { border-color: rgba(189, 166, 220, 0.45); }
  .loading, .error {
    margin: 0.55rem 0 0;
    color: #d9c9f1;
  }
  .error { color: #fecaca; }
</style>