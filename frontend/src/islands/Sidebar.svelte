<script>
  import { onMount } from 'svelte';
  import { lotsByRegion, regions, setLot, setRegion } from '../stores/region';

  export let currentPath = '/';

  const STORAGE_REGION = 'flowerxi_region';
  const STORAGE_LOT = 'flowerxi_lot';
  const STORAGE_COLLAPSED = 'flowerxi_sidebar_collapsed';
  const STORAGE_FIELD_MODE = 'flowerxi_field_mode';

  const navItems = [
    { href: '/', label: 'Inicio', icon: 'Home' },
    { href: '/municipios', label: 'Municipios', icon: 'Map' },
    { href: '/estaciones', label: 'Estaciones', icon: 'Thermometer' },
    { href: '/exportaciones', label: 'Comercial', icon: 'TrendingUp' },
  ];

  const icons = {
    Home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.7L12 3l9 7.7"/><path d="M5.5 9.7V21h13V9.7"/></svg>`,
    Map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.8"/></svg>`,
    Thermometer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0l9 5.76z"/><path d="M12 2v9"/></svg>`,
    TrendingUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
    MessageCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
    Sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
    Collapse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>`,
    Expand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`,
  };

  let path = currentPath;
  let collapsed = false;
  let fieldMode = false;
  let selectedRegion = 'madrid';
  let selectedLot = 'lote-3-lavanda';

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

  const toggleCollapse = () => {
    collapsed = !collapsed;
    saveLocal(STORAGE_COLLAPSED, collapsed);
  };

  const toggleFieldMode = () => {
    fieldMode = !fieldMode;
    saveLocal(STORAGE_FIELD_MODE, fieldMode);
    applyFieldMode();
  };

  const openChat = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('openchat'));
    }
  };

  $: regionLabel = getRegionName(selectedRegion);
  $: lotLabel = getLotName(selectedRegion, selectedLot);
  $: lotHeader = `${regionLabel} - ${lotLabel}`;
  $: collapseIcon = collapsed ? icons.Expand : icons.Collapse;

  onMount(() => {
    if (typeof window === 'undefined') return;

    const storedRegion = window.localStorage.getItem(STORAGE_REGION);
    const storedLot = window.localStorage.getItem(STORAGE_LOT);
    const storedCollapsed = window.localStorage.getItem(STORAGE_COLLAPSED);
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

    collapsed = storedCollapsed === 'true';
    fieldMode = storedFieldMode === 'true';

    applyFieldMode();
    syncRegionAndLot();
  });
</script>

<aside class="sidebar {collapsed ? 'collapsed' : ''}">
  <div class="sidebar-top">
    <button
      class="collapse-btn"
      type="button"
      on:click={toggleCollapse}
      aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
    >
      <span class="icon">{@html collapseIcon}</span>
    </button>

    <div class="brand-wrap">
      <div class="logo-mark" aria-label="flowerxi">✿</div>
      <div class="brand-text">
        <strong>flowerxi</strong>
        <span>operación diaria</span>
      </div>
    </div>

    <div class="lot-picker">
      <label for="sidebar-region">Municipio</label>
      <select id="sidebar-region" bind:value={selectedRegion} on:change={handleRegionChange}>
        {#each regions as region}
          <option value={region.id}>{region.name}</option>
        {/each}
      </select>

      <label for="sidebar-lot">Lote</label>
      <select id="sidebar-lot" bind:value={selectedLot} on:change={handleLotChange}>
        {#each getLotsForRegion(selectedRegion) as lot}
          <option value={lot.id}>{lot.name}</option>
        {/each}
      </select>

      <p class="lot-summary">{lotHeader}</p>
    </div>
  </div>

  <nav class="sidebar-nav" aria-label="Navegación principal">
    {#each navItems as item}
      <a href={item.href} class="nav-item {path === item.href ? 'active' : ''}">
        <span class="icon">{@html icons[item.icon]}</span>
        <span class="label">{item.label}</span>
      </a>
    {/each}
  </nav>

  <div class="sidebar-bottom">
    <button class="action-btn" type="button" on:click={openChat}>
      <span class="icon">{@html icons.MessageCircle}</span>
      <span class="label">Chat IA</span>
    </button>
    <button class="action-btn" type="button" on:click={toggleFieldMode}>
      <span class="icon">{@html icons.Sun}</span>
      <span class="label">Modo campo</span>
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: 240px;
    min-height: calc(100vh - 120px);
    border-radius: 18px;
    background: #1f1b2e;
    color: #ece6fb;
    padding: 0.8rem;
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 0.9rem;
    border: 1px solid rgba(167, 139, 204, 0.28);
    box-shadow: 0 10px 24px rgba(17, 12, 28, 0.28);
    position: sticky;
    top: 84px;
    transition: width 180ms ease;
  }

  .sidebar.collapsed {
    width: 64px;
    padding: 0.6rem 0.45rem;
  }

  .sidebar-top {
    display: grid;
    gap: 0.65rem;
  }

  .collapse-btn {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    color: #e7ddfb;
    display: grid;
    place-items: center;
    cursor: pointer;
    justify-self: end;
  }

  .brand-wrap {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .logo-mark {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #7b5ba6 0%, #9f7aca 100%);
    color: #fff;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }

  .brand-text strong {
    font-size: 0.9rem;
    letter-spacing: 0.02em;
  }

  .brand-text span {
    font-size: 0.72rem;
    color: #c7b8e9;
  }

  .lot-picker {
    display: grid;
    gap: 0.3rem;
  }

  .lot-picker label {
    font-size: 0.67rem;
    color: #cabbe9;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .lot-picker select {
    width: 100%;
    border: 1px solid rgba(167, 139, 204, 0.35);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    color: #f3edff;
    font: inherit;
    font-size: 0.77rem;
    padding: 0.38rem 0.45rem;
  }

  .lot-summary {
    margin: 0.25rem 0 0;
    font-size: 0.72rem;
    color: #ddd0f4;
    line-height: 1.2;
  }

  .sidebar-nav {
    display: grid;
    gap: 0.28rem;
    align-content: start;
  }

  .nav-item,
  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    border: none;
    background: transparent;
    text-decoration: none;
    color: #d7caef;
    padding: 0.48rem 0.52rem;
    border-radius: 10px;
    font-size: 0.83rem;
    cursor: pointer;
    width: 100%;
    text-align: left;
  }

  .nav-item:hover,
  .action-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .nav-item.active {
    background: #7b5ba6;
    color: #fff;
    box-shadow: 0 6px 16px rgba(123, 91, 166, 0.35);
  }

  .icon {
    width: 18px;
    height: 18px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  .sidebar-bottom {
    border-top: 1px solid rgba(167, 139, 204, 0.24);
    padding-top: 0.55rem;
    display: grid;
    gap: 0.35rem;
  }

  .sidebar.collapsed .label,
  .sidebar.collapsed .brand-text,
  .sidebar.collapsed .lot-picker {
    display: none;
  }

  .sidebar.collapsed .brand-wrap {
    justify-content: center;
  }

  .sidebar.collapsed .collapse-btn {
    justify-self: center;
  }

  .sidebar.collapsed .nav-item,
  .sidebar.collapsed .action-btn {
    justify-content: center;
    padding: 0.52rem;
  }
</style>
