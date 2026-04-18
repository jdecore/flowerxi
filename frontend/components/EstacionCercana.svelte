<script>
  export let apiUrl = '';

  let station = { name: 'IDEAM El Dorado', distance: '8.2km' };
  let loading = false;

  const fetchStation = async () => {
    loading = true;
    try {
      const res = await fetch(`${apiUrl}/api/stations`);
      if (res.ok) {
        const data = await res.json();
        // Tomar la primera estación como "más cercana" (demo)
        station = data[0] || { name: 'IDEAM El Dorado', distance: '8.2km' };
      }
    } catch (e) { console.error(e); }
    finally { loading = false; }
  };

  onMount(fetchStation);
</script>

<footer class="station-footer">
  <div class="station-info">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
    <span>Estación más cercana: <strong>{station.name}</strong> – {station.distance}</span>
  </div>
</footer>

<style>
  .station-footer {
    margin-top: 2rem; padding: 1rem;
    border-top: 1px solid #e2e8f0;
    font-size: 0.8rem; color: #64748b;
    text-align: center;
  }
  .station-info { display: inline-flex; align-items: center; gap: 0.5rem; }
  .station-info svg { color: #F59E0B; }
  .station-info strong { color: #1f2937; }
</style>
