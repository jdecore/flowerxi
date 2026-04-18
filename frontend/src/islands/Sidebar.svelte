<script>
  export let apiUrl = '';
  export let currentPath = '/';

  const navItems = [
    { href: '/', label: 'Inicio', icon: 'Home' },
    { href: '/municipios', label: 'Municipios', icon: 'Map' },
    { href: '/estaciones', label: 'Estaciones', icon: 'Thermometer' },
    { href: '/exportaciones', label: 'Comercial', icon: 'TrendingUp' },
  ];

  let path = currentPath;

  // Iconos SVG (lucide-style)
  const icons = {
    Home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.7L12 3l9 7.7"/><path d="M5.5 9.7V21h13V9.7"/></svg>`,
    Map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.8"/></svg>`,
    Thermometer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0l9 5.76z"/><path d="M12 2v9"/></svg>`,
    TrendingUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
    MessageCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  };
</script>

<aside class="sidebar">
  <div class="sidebar-content">
    <div class="sidebar-header">
      <div class="logo-mark" aria-label="flowerxi">✿</div>
      <span class="logo-text">flowerxi</span>
    </div>

    <nav class="sidebar-nav">
      {#each navItems as item}
        <a href={item.href} class="nav-item {path === item.href ? 'active' : ''}">
          {@html icons[item.icon]}
          <span class="nav-label">{item.label}</span>
        </a>
      {/each}
    </nav>
  </div>

  <div class="sidebar-footer">
    <button class="chat-toggle" on:click={() => window.dispatchEvent(new Event('openchat'))}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
      <span>Chat IA</span>
    </button>
   </div>

  </aside>

  <style>
    /* ... estilos existentes ... */
    .sidebar-footer {
      padding-top: 0.75rem;
      border-top: 1px solid #e2e8f0;
    }
    .chat-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.6rem 0.75rem;
      border: none;
      background: transparent;
      color: #64748b;
      font-size: 0.85rem;
      font-weight: 500;
      border-radius: 10px;
      cursor: pointer;
      transition: all 150ms ease;
    }
    .chat-toggle:hover {
      background: #f1f5f9;
      color: #6366f1;
    }
    .chat-toggle svg {
      width: 20px;
      height: 20px;
    }
</style>
