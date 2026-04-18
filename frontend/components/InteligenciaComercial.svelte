<script>
  export let apiUrl = '';

  let loading = true;
  let events = [];

  const fetchData = async () => {
    loading = true;
    try {
      const res = await fetch(`${apiUrl}/api/exports?months=12`);
      if (res.ok) {
        const data = await res.json();
        events = [
          { date: '2026-02-14', name: 'San Valentín', impact: 'alta', note: 'Precios +30%' },
          { date: '2026-05-10', name: 'Día de la Madre', impact: 'media', note: 'Precios +20%' },
          { date: '2026-11-01', name: 'Halloween', impact: 'baja', note: 'Precios +10%' },
        ];
      }
    } catch (e) { console.error(e); }
    finally { loading = false; }
  };

  onMount(fetchData);
</script>

<article class="commercial-insight">
  <h3>Inteligencia comercial</h3>
  <p class="subtitle">Próximos picos de demanda</p>

  {#if loading}
    <div class="skeleton-list">
      {#each [1,2,3] as i}
        <div class="skeleton-item"></div>
      {/each}
    </div>
  {:else}
    <ul class="event-list">
      {#each events as ev}
        <li class="event-item" class:impact-alta={ev.impact === 'alta'} class:impact-media={ev.impact === 'media'}>
          <div class="event-date">{new Date(ev.date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}</div>
          <div class="event-name">{ev.name}</div>
          <div class="event-note">{ev.note}</div>
        </li>
      {/each}
    </ul>
  {/if}
</article>

<style>
  .commercial-insight {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 1.25rem;
    display: flex; flex-direction: column; gap: 0.75rem;
  }
  .commercial-insight h3 { margin: 0; font-size: 1.1rem; font-weight: 600; color: #1f2937; }
  .subtitle { margin: 0; font-size: 0.8rem; color: #64748b; }

  .event-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  .event-item {
    display: grid; grid-template-columns: 70px 1fr 60px; gap: 0.5rem;
    padding: 0.65rem; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;
    font-size: 0.85rem;
  }
  .event-date { color: #64748b; font-size: 0.8rem; }
  .event-name { font-weight: 500; color: #1f2937; }
  .event-note { color: #059669; font-weight: 500; text-align: right; }
  .impact-alta { border-left: 3px solid #DC2626; }
  .impact-media { border-left: 3px solid #F59E0B; }

  .skeleton-item { height: 50px; background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%); background-size: 200% 100%; border-radius: 10px; animation: shimmer 1.5s infinite; }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
</style>
