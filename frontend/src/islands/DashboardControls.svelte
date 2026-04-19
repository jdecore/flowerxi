<script>
  import { onMount } from 'svelte';
  import { lotsByRegion, regions, setLot, setRegion } from '../stores/region';

  const STORAGE_REGION = 'flowerxi_region';
  const STORAGE_LOT = 'flowerxi_lot';
  const STORAGE_FIELD_MODE = 'flowerxi_field_mode';

  let selectedRegion = 'madrid';
  let selectedLot = 'lote-3-lavanda';
  let fieldMode = false;

  const getLotsForRegion = (regionId) => lotsByRegion[regionId] ?? [];
  const getRegionName = (regionId) =>
    regions.find((region) => region.id === regionId)?.name ?? 'Madrid';
  const getLotName = (regionId, lotId) =>
    getLotsForRegion(regionId).find((lot) => lot.id === lotId)?.name ?? 'Lote';

  const saveLocal = (key, value) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, String(value));
  };

  const applyFieldMode = () => {
    if (typeof document === 'undefined') return;
    if (fieldMode) document.documentElement.setAttribute('data-field-mode', 'on');
    else document.documentElement.removeAttribute('data-field-mode');
  };

  const syncRegionAndLot = () => {
    const lots = getLotsForRegion(selectedRegion);
    if (!lots.some((lot) => lot.id === selectedLot)) {
      selectedLot = lots[0]?.id ?? '';
    }
    setRegion(selectedRegion);
    setLot(selectedLot);
    saveLocal(STORAGE_REGION, selectedRegion);
    saveLocal(STORAGE_LOT, selectedLot);
  };

  const handleRegionChange = (event) => {
    selectedRegion = event.target.value;
    const lots = getLotsForRegion(selectedRegion);
    selectedLot = lots[0]?.id ?? '';
    syncRegionAndLot();
  };

  const handleLotChange = (event) => {
    selectedLot = event.target.value;
    syncRegionAndLot();
  };

  const openChat = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('openchat'));
    }
  };

  const toggleFieldMode = () => {
    fieldMode = !fieldMode;
    saveLocal(STORAGE_FIELD_MODE, fieldMode);
    applyFieldMode();
  };

  $: lotHeader = `${getRegionName(selectedRegion)} - ${getLotName(selectedRegion, selectedLot)}`;

  onMount(() => {
    if (typeof window === 'undefined') return;

    const storedRegion = window.localStorage.getItem(STORAGE_REGION);
    const storedLot = window.localStorage.getItem(STORAGE_LOT);
    const storedFieldMode = window.localStorage.getItem(STORAGE_FIELD_MODE);

    if (storedRegion && regions.some((region) => region.id === storedRegion)) {
      selectedRegion = storedRegion;
    }

    const lots = getLotsForRegion(selectedRegion);
    if (storedLot && lots.some((lot) => lot.id === storedLot)) {
      selectedLot = storedLot;
    } else {
      selectedLot = lots[0]?.id ?? '';
    }

    fieldMode = storedFieldMode === 'true';
    applyFieldMode();
    syncRegionAndLot();
  });
</script>

<section class="controls-card" aria-label="Controles del dashboard">
  <div class="selectors">
    <label>
      <span>Municipio</span>
      <select bind:value={selectedRegion} on:change={handleRegionChange}>
        {#each regions as region}
          <option value={region.id}>{region.name}</option>
        {/each}
      </select>
    </label>

    <label>
      <span>Lote</span>
      <select bind:value={selectedLot} on:change={handleLotChange}>
        {#each getLotsForRegion(selectedRegion) as lot}
          <option value={lot.id}>{lot.name}</option>
        {/each}
      </select>
    </label>
  </div>

  <p class="current-lot">{lotHeader}</p>

  <div class="actions">
    <button type="button" class="action-btn" on:click={openChat}>Chat IA</button>
    <button type="button" class="action-btn" on:click={toggleFieldMode}>
      {fieldMode ? 'Salir modo campo' : 'Modo campo'}
    </button>
  </div>
</section>

<style>
  .controls-card {
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 16px;
    padding: 0.9rem 1rem;
    box-shadow: var(--shadow-sm, 0 1px 3px rgba(31, 41, 55, 0.06));
    display: grid;
    grid-template-columns: 1.6fr auto auto;
    gap: 0.9rem;
    align-items: end;
  }

  .selectors {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.7rem;
  }

  label {
    display: grid;
    gap: 0.3rem;
  }

   label span {
     font-size: var(--text-sm);
     color: var(--text-secondary, #64748b);
     text-transform: uppercase;
     letter-spacing: 0.05em;
     font-family: var(--font-sans);
   }

    select {
      width: 100%;
      border: 1px solid var(--border-subtle, #dbe3ec);
      border-radius: 10px;
      background: var(--bg-app, #f8fafc);
      color: var(--text-primary, #1f2937);
      font: inherit;
      font-size: var(--text-base);
      padding: 0.52rem 0.6rem;
    }

    .current-lot {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--text-secondary, #64748b);
      white-space: nowrap;
      font-family: var(--font-sans);
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 0.55rem;
    }

    .action-btn {
      border: 1px solid var(--border-subtle, #dbe3ec);
      border-radius: 10px;
      background: var(--bg-app, #f8fafc);
      color: var(--text-primary, #1f2937);
      font: inherit;
      font-size: var(--text-base);
      font-weight: 600;
      font-family: var(--font-sans);
      padding: 0.55rem 0.75rem;
      cursor: pointer;
      white-space: nowrap;
    }

  .action-btn:hover {
    border-color: var(--primary, #7b5ba6);
    color: var(--primary, #7b5ba6);
  }

  @media (max-width: 1024px) {
    .controls-card {
      grid-template-columns: 1fr;
      align-items: stretch;
    }

    .current-lot {
      white-space: normal;
    }
  }

  @media (max-width: 700px) {
    .selectors {
      grid-template-columns: 1fr;
    }

    .actions {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
