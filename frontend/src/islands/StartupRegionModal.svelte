<script>
  import { onDestroy, onMount } from 'svelte';
  import { regions as fallbackRegions, setRegion } from '../stores/region';

  const STORAGE_REGION = 'flowerxi_region';
  const REGIONS_CACHE_KEY = 'flowerxi_regions_cache';
  const REGIONS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const API_URL = import.meta.env.PUBLIC_API_URL ?? '';

  let selectedRegion = 'madrid';
  let open = true;
  let availableRegions = fallbackRegions.map((region) => ({ id: region.id, name: region.name }));

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
    if (base.endsWith('/api') && path.startsWith('/api/')) return `${base}${path.slice(4)}`;
    return `${base}${path}`;
  };

  const fetchJson = async (path) => {
    const apiBases = buildApiBases(API_URL);
    for (const base of apiBases) {
      try {
        const res = await fetch(endpoint(base, path), { headers: { Accept: 'application/json' } });
        if (!res.ok) continue;
        return await res.json();
      } catch {
        continue;
      }
    }
    return null;
  };

  const normalizeRegions = (items) =>
    items
      .map((item) => ({
        id: String(item?.slug || '').trim(),
        name: String(item?.name || '').trim(),
      }))
      .filter((item) => item.id && item.name);

  const readRegionsCache = () => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(REGIONS_CACHE_KEY);
      if (!raw) return [];
      const payload = JSON.parse(raw);
      if (!Array.isArray(payload?.items) || !Number.isFinite(Number(payload?.updatedAt))) return [];
      if (Date.now() - Number(payload.updatedAt) > REGIONS_CACHE_TTL_MS) return [];
      return normalizeRegions(payload.items);
    } catch {
      return [];
    }
  };

  const writeRegionsCache = (items) => {
    if (typeof window === 'undefined' || items.length === 0) return;
    window.localStorage.setItem(
      REGIONS_CACHE_KEY,
      JSON.stringify({
        updatedAt: Date.now(),
        items,
      })
    );
  };

  const loadRegions = async () => {
    const cached = readRegionsCache();
    if (cached.length > 0) {
      availableRegions = cached;
    }

    const data = await fetchJson('/api/regions');
    const items = normalizeRegions(Array.isArray(data?.items) ? data.items : []);
    if (items.length === 0) return;
    availableRegions = items;
    writeRegionsCache(items);
  };

  const isValidRegion = (value) => availableRegions.some((region) => region.id === value);

  const applyRegion = (region) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_REGION, region);
    setRegion(region);
  };

  const confirmSelection = () => {
    applyRegion(selectedRegion);
    open = false;
  };

  const openSelector = () => {
    if (typeof window !== 'undefined') {
      const savedRegion = window.localStorage.getItem(STORAGE_REGION);
      if (savedRegion && isValidRegion(savedRegion)) {
        selectedRegion = savedRegion;
      }
    }
    open = true;
  };

  onMount(() => {
    if (typeof window === 'undefined') return;
    (async () => {
      const savedRegion = window.localStorage.getItem(STORAGE_REGION);
      if (savedRegion) {
        selectedRegion = savedRegion;
      }
      if (!isValidRegion(selectedRegion)) selectedRegion = availableRegions[0]?.id || 'madrid';
      applyRegion(selectedRegion);
      window.addEventListener('open-region-selector', openSelector);
      await loadRegions();

      const latestSavedRegion = window.localStorage.getItem(STORAGE_REGION);
      if (latestSavedRegion && isValidRegion(latestSavedRegion) && latestSavedRegion !== selectedRegion) {
        selectedRegion = latestSavedRegion;
        applyRegion(selectedRegion);
      } else if (!isValidRegion(selectedRegion)) {
        selectedRegion = availableRegions[0]?.id || 'madrid';
        applyRegion(selectedRegion);
      }
    })();
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('open-region-selector', openSelector);
  });
</script>

{#if open}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Seleccionar municipio">
    <div class="modal-card">
      <h3>Selecciona tu municipio</h3>
      <p>El dashboard se actualizará de inmediato con los datos del municipio elegido.</p>

      <label>
        <span>Municipio</span>
        <select bind:value={selectedRegion}>
          {#each availableRegions as region}
            <option value={region.id}>{region.name}</option>
          {/each}
        </select>
      </label>

      <button type="button" on:click={confirmSelection}>Cargar dashboard</button>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(12, 10, 18, 0.42);
    display: grid;
    place-items: center;
    padding: 1rem;
  }

  .modal-card {
    width: min(430px, 100%);
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 14px;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
    padding: 1rem;
    display: grid;
    gap: 0.75rem;
  }

  .modal-card h3 {
    margin: 0;
    font-size: 1.08rem;
    color: var(--text-primary, #1f2937);
  }

  .modal-card p {
    margin: 0;
    font-size: 0.86rem;
    color: var(--text-secondary, #64748b);
  }

  label {
    display: grid;
    gap: 0.35rem;
  }

  label span {
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary, #64748b);
  }

  select {
    width: 100%;
    border: 1px solid var(--border-subtle, #dbe3ec);
    border-radius: 10px;
    background: var(--bg-app, #f8fafc);
    color: var(--text-primary, #1f2937);
    font: inherit;
    font-size: 0.9rem;
    padding: 0.55rem 0.65rem;
  }

  button {
    border: none;
    border-radius: 10px;
    background: var(--primary, #7b5ba6);
    color: #fff;
    font: inherit;
    font-size: 0.88rem;
    font-weight: 600;
    padding: 0.6rem 0.8rem;
    cursor: pointer;
  }

  button:hover {
    background: var(--primary-hover, #6b4f92);
  }
</style>
