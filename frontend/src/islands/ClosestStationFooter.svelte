<script>
  import { onDestroy, onMount } from 'svelte';

  export let apiUrl = '';
  export let initialRegion = 'madrid';

  let region = initialRegion;
  let text = 'Estación más cercana: consultando...';

  const toNum = (value, fallback = Infinity) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalizeBaseUrl = (raw) => String(raw ?? '').trim().replace(/\/+$/, '');

  const buildApiBases = (raw) => {
    const configured = normalizeBaseUrl(raw);
    const candidates = [];
    if (configured) candidates.push(configured);

    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        candidates.push(`${window.location.protocol}//${host}:8000`);
        candidates.push('http://localhost:8000');
        candidates.push('http://127.0.0.1:8000');
      }
    }

    candidates.push('');
    return [...new Set(candidates)];
  };

  const endpoint = (base, path) => {
    if (!base) return path;
    if (base.endsWith('/api') && path.startsWith('/api/')) {
      return `${base}${path.slice(4)}`;
    }
    return `${base}${path}`;
  };

  const fetchJson = async (path) => {
    const apiBases = buildApiBases(apiUrl);
    let lastError = null;

    for (const base of apiBases) {
      try {
        const res = await fetch(endpoint(base, path), { headers: { Accept: 'application/json' } });
        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
        return await res.json();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('network');
      }
    }

    throw lastError ?? new Error('network');
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
      const sorted = [...pool].sort((a, b) => toNum(a?.distance_km) - toNum(b?.distance_km));
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

  const onRegionChange = async (event) => {
    if (!event?.detail) return;
    region = event.detail;
    await loadStation();
  };

  const onRefresh = async () => {
    await loadStation();
  };

  onMount(() => {
    loadStation();
    if (typeof window !== 'undefined') {
      window.addEventListener('regionchange', onRegionChange);
      window.addEventListener('flowerxi:refresh', onRefresh);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('regionchange', onRegionChange);
      window.removeEventListener('flowerxi:refresh', onRefresh);
    }
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

  .error {
    font-size: var(--text-base);
    font-weight: 500;
    font-family: var(--font-sans);
  }
</style>
