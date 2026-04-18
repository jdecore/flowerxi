<script>
  export let apiUrl = '';

  let loading = true;
  let rankings = [];

  const fetchData = async () => {
    loading = true;
    try {
      const res = await fetch(`${apiUrl}/api/municipalities`);
      if (res.ok) {
        const data = await res.json();
        rankings = Array.isArray(data) ? data.slice(0, 5) : [
          { name: 'Madrid', score: 24 },
          { name: 'Funza', score: 31 },
          { name: 'Facatativá', score: 19 },
        ];
      }
    } catch (e) { console.error(e); rankings = []; }
    finally { loading = false; }
  };

  onMount(fetchData);
</script>

<details class="comparative-section">
  <summary>📊 Comparativa Sabana (3 municipios)</summary>
  
  {#if loading}
    <div class="skeleton-table">
      {#each [1,2,3] as i}
        <div class="skeleton-row"></div>
      {/each}
    </div>
  {:else}
    <table class="ranking-table">
      <thead>
        <tr><th>Municipio</th><th>Riesgo</th><th>Estado</th></tr>
      </thead>
      <tbody>
        {#each rankings as m}
          <tr>
            <td>{m.name}</td>
            <td><strong>{m.score || '--'}</strong></td>
            <td>
              <span class="badge" class:rutina={m.score <= 30} class:vigilancia={m.score > 30 && m.score <= 60} class:accion={m.score > 60}>
                {m.score <= 30 ? 'Rutina' : m.score > 30 && m.score <= 60 ? 'Vigilancia' : 'Acción'}
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</details>

<style>
  .comparative-section {
    background: white; border: 1px solid #e2e8f0;
    border-radius: 16px; padding: 1rem; margin-top: 1.5rem;
  }
  .comparative-section summary {
    cursor: pointer; font-weight: 600; color: #1f2937;
    padding: 0.5rem; user-select: none;
  }
  .comparative-section[open] { padding-bottom: 1.5rem; }

  .ranking-table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.9rem; }
  .ranking-table th { text-align: left; color: #64748b; font-weight: 500; padding: 0.5rem; border-bottom: 1px solid #e2e8f0; }
  .ranking-table td { padding: 0.75rem 0.5rem; border-bottom: 1px solid #f1f5f9; }
  .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
  .badge.rutina { background: #D1FAE5; color: #059669; }
  .badge.vigilancia { background: #FEF3C7; color: #D97706; }
  .badge.accion { background: #FEE2E2; color: #DC2626; }

  .skeleton-row { height: 40px; background: #e2e8f0; border-radius: 6px; margin-bottom: 0.5rem; }
</style>
