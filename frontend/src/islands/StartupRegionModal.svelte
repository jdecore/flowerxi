<script>
  import { onDestroy, onMount } from 'svelte';
  import { regions, setRegion } from '../stores/region';

  const STORAGE_REGION = 'flowerxi_region';

  let selectedRegion = 'madrid';
  let open = false;

  const isValidRegion = (value) => regions.some((region) => region.id === value);

  const applyRegion = (region) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_REGION, region);
    setRegion(region);
  };

  const confirmSelection = () => {
    applyRegion(selectedRegion);
    open = false;
  };

  const handleRegionChange = () => {
    applyRegion(selectedRegion);
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

    const savedRegion = window.localStorage.getItem(STORAGE_REGION);
    if (savedRegion && isValidRegion(savedRegion)) {
      selectedRegion = savedRegion;
    }

    applyRegion(selectedRegion);
    window.addEventListener('open-region-selector', openSelector);
    open = true;
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
        <select bind:value={selectedRegion} on:change={handleRegionChange}>
          {#each regions as region}
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
