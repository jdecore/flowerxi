<script>
  import { onDestroy, onMount } from 'svelte';
  import { fetchJsonCached } from '../lib/api/client.js';

  export let apiUrl = '';
  export let initialRegion = 'madrid';

  let region = initialRegion;
  let text = 'Estación más cercana: consultando...';

  const fetchJson = async (path) => {
    return fetchJsonCached(path, {
      apiUrl,
      cacheTtlMs: 45_000,
      throwOnError: true,
    });
  };

  const loadStation = async () => {
    try {
      const data = await fetchJson(`/api/stations?region=${encodeURIComponent(region)}`);
      const items = Array.isArray(data?.items) ? data.items : [];

      if (items.length === 0) {
        text = 'Estación más cercana: sin datos disponibles';
        return;
      }

      const fallbackUsed = Boolean(data?.fallback);
      const byRegion = items.filter((item) => String(item?.region_slug ?? '').toLowerCase() === region);
      const pool = byRegion.length > 0 ? byRegion : items;
      const sorted = [...pool].sort((a, b) => Number(a?.distance_km ?? Infinity) - Number(b?.distance_km ?? Infinity));
      const nearest = sorted[0];
      const distance = Number.isFinite(Number(nearest?.distance_km))
        ? `${Number(nearest.distance_km).toFixed(1)} km`
        : 'distancia no disponible';

      text = fallbackUsed
        ? `Estación de referencia regional: ${nearest?.station_name ?? 'N/A'} - ${distance}`
        : `Estación más cercana: ${nearest?.station_name ?? 'N/A'} - ${distance}`;
    } catch {
      text = 'Estación más cercana: sin conexión con backend';
    }
  };

  const handleRegionChange = async (event) => {
    if (!event?.detail) return;
    region = event.detail;
    await loadStation();
  };

  onMount(() => {
    loadStation();
    window.addEventListener('regionchange', handleRegionChange);
    window.addEventListener('flowerxi:refresh', loadStation);
  });

  onDestroy(() => {
    window.removeEventListener('regionchange', handleRegionChange);
    window.removeEventListener('flowerxi:refresh', loadStation);
  });
</script>

<p class="station-line">{text}</p>

<style>
  .station-line {
    margin: 0;
    font-size: var(--text-base);
    color: var(--text-secondary, #64748b);
    font-family: var(--font-sans);
  }
</style>
