<script>
  export let title = '';
  export let data = [];
  export let unit = '';
  export let color = '#7B5BA6';
  export let height = 60;

  const hexToRgb = (hex) => {
    const normalized = String(hex ?? '').replace('#', '').trim();
    if (normalized.length !== 6) return '123,91,166';
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return '123,91,166';
    return `${r},${g},${b}`;
  };

  // Calcular puntos del gráfico (normalizado a 0-100)
  $: maxVal = Math.max(...data, 1);
  $: areaFill = `rgba(${hexToRgb(color)}, 0.16)`;
  $: points = data.map((val, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * 100 : 50;
    const y = 100 - ((val / maxVal) * 100);
    return `${x},${y}`;
  }).join(' ');

  $: lastValue = data.length > 0 ? data[data.length - 1] : null;
</script>

<div class="sparkline-card">
  {#if title}
    <span class="spark-title">{title}</span>
  {/if}

  {#if data.length > 1}
    <svg viewBox="0 0 100 40" class="spark-svg" preserveAspectRatio="none">
      <!-- Área -->
      <polygon points="0,40 {points} 100,40" fill={areaFill} />
      <!-- Línea -->
      <polyline points={points} fill="none" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  {:else}
    <div class="spark-skeleton"></div>
  {/if}

  {#if lastValue !== null}
    <div class="spark-last">
      <span class="last-value" style="color: {color};">
        {typeof lastValue === 'number' ? lastValue.toFixed(1) : lastValue} <small>{unit}</small>
      </span>
    </div>
  {/if}
</div>

<style>
  .sparkline-card {
    font-family: var(--font-sans);
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 12px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 100px;
  }

  .spark-title {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-secondary, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .spark-svg {
    font-family: var(--font-sans);
    width: 100%;
    height: 60px;
    border-radius: 6px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--bg-app, #f8fafc) 60%, #fff), var(--bg-app, #f1f5f9));
  }

  .spark-svg polygon, .spark-svg polyline {
    vector-effect: non-scaling-stroke;
  }

  .spark-last {
    font-family: var(--font-sans);
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--text-primary, #1f2937);
  }
  .spark-last small {
    font-family: var(--font-sans);
    font-weight: 400;
    color: var(--text-tertiary, #6b7280);
    font-size: var(--text-xs);
  }

  .spark-skeleton {
    font-family: var(--font-sans);
    height: 60px;
    background: linear-gradient(90deg, #e2e8f020, #cbd5e130, #e2e8f020);
    background-size: 200% 100%;
    border-radius: 6px;
    animation: shimmer 1.5s infinite linear;
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
</style>
