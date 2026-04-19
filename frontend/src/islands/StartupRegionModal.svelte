<script>
  import { onDestroy, onMount } from 'svelte';
  import { fetchJsonCached } from '../lib/api/client.js';

  export let apiUrl = '';

  const STORAGE_REGION = 'flowerxi_region';
  const REGIONS_CACHE_KEY = 'flowerxi_regions_cache_v2';
  const REGIONS_CACHE_TTL_MS = 15 * 60 * 1000;
  const FALLBACK_REGIONS = [
    { slug: 'madrid', name: 'Madrid' },
    { slug: 'facatativa', name: 'Facatativá' },
    { slug: 'funza', name: 'Funza' },
    { slug: 'el-rosal', name: 'El Rosal' },
    { slug: 'tocancipa', name: 'Tocancipá' },
    { slug: 'chia', name: 'Chía' },
    { slug: 'mosquera', name: 'Mosquera' },
    { slug: 'sopo', name: 'Sopó' },
    { slug: 'bojaca', name: 'Bojacá' },
    { slug: 'cachipay', name: 'Cachipay' },
  ];

  let isOpen = false;
  let isLoading = false;
  let selected = 'madrid';
  let regions = FALLBACK_REGIONS;

  const normalizeRegions = (items) => {
    const bySlug = new Map();
    const source = Array.isArray(items) ? items : [];
    source.forEach((item) => {
      const slug = String(item?.slug || '').trim().toLowerCase();
      if (!slug) return;
      const name = String(item?.name || '').trim();
      bySlug.set(slug, { slug, name: name || slug });
    });
    return bySlug.size > 0 ? [...bySlug.values()] : FALLBACK_REGIONS;
  };

  const saveRegionsCache = (items) => {
    if (typeof window === 'undefined') return;
    const payload = {
      savedAt: Date.now(),
      items,
    };
    window.localStorage.setItem(REGIONS_CACHE_KEY, JSON.stringify(payload));
  };

  const readRegionsCache = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(REGIONS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.items)) return null;
      if (Date.now() - Number(parsed?.savedAt || 0) > REGIONS_CACHE_TTL_MS) return null;
      return normalizeRegions(parsed.items);
    } catch {
      return null;
    }
  };

  const loadRegions = async (force = false) => {
    isLoading = true;
    try {
      if (!force) {
        const cached = readRegionsCache();
        if (cached && cached.length > 0) {
          regions = cached;
          if (!regions.find((item) => item.slug === selected)) selected = regions[0].slug;
          return;
        }
      }

      const response = await fetchJsonCached('/api/regions', {
        apiUrl,
        cacheTtlMs: REGIONS_CACHE_TTL_MS,
        throwOnError: false,
        bypassCache: force,
      });
      const nextRegions = normalizeRegions(response?.items);
      regions = nextRegions;
      saveRegionsCache(nextRegions);
      if (!regions.find((item) => item.slug === selected)) {
        selected = regions[0]?.slug || selected;
      }
    } finally {
      isLoading = false;
    }
  };

  const applyRegion = () => {
    if (!selected) return;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_REGION, selected);
      window.dispatchEvent(new CustomEvent('regionchange', { detail: selected }));
    }
    isOpen = false;
  };

  const openSelector = async () => {
    isOpen = true;
    await loadRegions(false);
  };

  const closeSelector = () => {
    isOpen = false;
  };

  const handleBackdropClick = (event) => {
    if (event.currentTarget !== event.target) return;
    closeSelector();
  };

  const handleOpenRegionSelector = async () => {
    await openSelector();
  };

  const handleRegionChange = (event) => {
    const next = String(event?.detail || '').trim().toLowerCase();
    if (!next) return;
    selected = next;
  };

  const handleKeydown = (event) => {
    if (event.key !== 'Escape' || !isOpen) return;
    closeSelector();
  };

  onMount(() => {
    if (typeof window === 'undefined') return;
    const storedRegion = window.localStorage.getItem(STORAGE_REGION);
    selected = storedRegion || selected;
    if (!storedRegion) isOpen = true;
    window.addEventListener('open-region-selector', handleOpenRegionSelector);
    window.addEventListener('regionchange', handleRegionChange);
    window.addEventListener('keydown', handleKeydown);
    loadRegions(false);
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('open-region-selector', handleOpenRegionSelector);
    window.removeEventListener('regionchange', handleRegionChange);
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if isOpen}
  <div class="modal-backdrop" role="presentation" on:click={handleBackdropClick}>
    <section class="modal-card" role="dialog" aria-modal="true" aria-label="Seleccionar municipio">
      <h3>Selecciona municipio</h3>
      <p>Elige el municipio operativo para actualizar todo el tablero.</p>

      <label>
        <span>Municipio</span>
        <select bind:value={selected} disabled={isLoading}>
          {#each regions as item}
            <option value={item.slug}>{item.name}</option>
          {/each}
        </select>
      </label>

      <button type="button" on:click={applyRegion} disabled={!selected}>
        {isLoading ? 'Cargando municipios...' : 'Aplicar municipio'}
      </button>
    </section>
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
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--text-primary, #1f2937);
  }

  .modal-card p {
    margin: 0;
    font-size: var(--text-base);
    color: var(--text-secondary, #64748b);
  }

  label {
    display: grid;
    gap: 0.35rem;
  }

  label span {
    font-size: var(--text-sm);
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
    font-size: var(--text-base);
    padding: 0.55rem 0.65rem;
  }

  button {
    border: none;
    border-radius: 10px;
    background: var(--primary, #7b5ba6);
    color: #fff;
    font: inherit;
    font-size: var(--text-base);
    font-weight: 600;
    padding: 0.6rem 0.8rem;
    cursor: pointer;
  }

  button:hover {
    background: var(--primary-hover, #6b4f92);
  }
</style>
