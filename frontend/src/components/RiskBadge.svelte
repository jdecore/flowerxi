<script>
  export let score = 0;
  export let level = 'Rutina'; // Rutina, Vigilancia, Acción

  const config = {
    Rutina: { color: '#10B981', bg: '#D1FAE5', icon: '✓', label: 'Rutina' },
    Vigilancia: { color: '#F59E0B', bg: '#FEF3C7', icon: '⚠', label: 'Vigilancia' },
    Acción: { color: '#DC2626', bg: '#FEE2E2', icon: '🚨', label: 'Acción' },
  }[level] || { color: '#6B7280', bg: '#F3F4F6', icon: '?', label: 'Sin datos' };
</script>

<div class="risk-badge" style="--badge-color: {config.color}; --badge-bg: {config.bg};">
  <span class="badge-icon">{config.icon}</span>
  <span class="badge-label">{config.label}</span>
  <span class="badge-score">Nivel {score}</span>
</div>

<style>
  .risk-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--badge-bg);
    border: 2px solid var(--badge-color);
    border-radius: 999px;
    font-weight: 600;
  }

  .badge-icon {
    font-size: 1.1rem;
    line-height: 1;
  }

  .badge-label {
    color: var(--badge-color);
    text-transform: uppercase;
    font-size: 0.85rem;
    letter-spacing: 0.08em;
  }

  .badge-score {
    color: var(--badge-color);
    font-size: 0.9rem;
  }
</style>
