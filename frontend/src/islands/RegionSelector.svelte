<script>
  import { onDestroy, onMount } from 'svelte';

  export let apiUrl = '';
  export let currentRegion = 'madrid';

  const regions = [
    { id: 'madrid', name: 'Madrid' },
    { id: 'facatativa', name: 'Facatativá' },
    { id: 'funza', name: 'Funza' },
  ];

  let selected = currentRegion;

  const handleChange = (e) => {
    selected = e.target.value;
    if (typeof window === 'undefined') return;

    // Emit custom event para que otras islas se actualicen
    window.dispatchEvent(new CustomEvent('regionchange', { detail: selected }));
    // También actualizar URL sin recargar
    const url = new URL(window.location);
    url.searchParams.set('region', selected);
    window.history.pushState({}, '', url);
  };

  const handleRegionChange = (e) => {
    selected = e.detail;
  };

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('regionchange', handleRegionChange);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('regionchange', handleRegionChange);
    }
  });
</script>

<div class="region-selector">
  <label for="region-select" class="visually-hidden">Municipio</label>
  <select id="region-select" bind:value={selected} on:change={handleChange}>
    {#each regions as r}
      <option value={r.id}>{r.name}</option>
    {/each}
  </select>
  <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M6 9l6 6 6-6" />
  </svg>
</div>

<style>
  .region-selector {
    position: relative;
    display: inline-block;
  }

  .region-selector select {
    appearance: none;
    -webkit-appearance: none;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 0.6rem 2.5rem 0.6rem 1rem;
    font-size: 0.9rem;
    font-weight: 500;
    color: #1e293b;
    cursor: pointer;
    min-width: 180px;
    transition: all 150ms ease;
  }

  .region-selector select:hover {
    border-color: #cbd5e1;
    background: #f1f5f9;
  }

  .region-selector select:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  .chevron {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: #64748b;
    pointer-events: none;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
