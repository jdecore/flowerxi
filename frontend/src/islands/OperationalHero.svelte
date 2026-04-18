<script>
  import { onDestroy, onMount } from 'svelte';

  export let apiUrl = '';
  export let initialRegion = 'madrid';

  const TODAY_STORAGE_KEY = 'flowerxi_today';

  let region = initialRegion;
  let loading = true;
  let score = null;
  let level = 'SIN DATOS';
  let levelClass = 'sin-datos';
  let delta = 0;
  let criticalWindowHours = null;
  let hoursSinceRain = null;
  let reason = 'Datos no disponibles';
  let actionToday = 'Datos no disponibles.';
  let explanation = [];

  let simulating = false;
  let simulation = null;

  const toNum = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const scoreFromSignals = (day) => {
    const fungal = Number(day?.fungal_risk);
    const water = Number(day?.waterlogging_risk);
    const heat = Number(day?.heat_risk);
    if (!Number.isFinite(fungal) || !Number.isFinite(water) || !Number.isFinite(heat)) return null;
    return Math.round((fungal * 0.5) + (water * 0.3) + (heat * 0.2));
  };

  const levelFromScore = (riskScore) => {
    if (riskScore >= 70) return { text: 'ALTO', cls: 'alto' };
    if (riskScore >= 40) return { text: 'MEDIO', cls: 'medio' };
    return { text: 'BAJO', cls: 'bajo' };
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

  const fetchJson = async (path, init = undefined) => {
    const apiBases = buildApiBases(apiUrl);
    for (const base of apiBases) {
      try {
        const res = await fetch(endpoint(base, path), {
          headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
          ...init,
        });
        if (!res.ok) continue;
        return await res.json();
      } catch {
        continue;
      }
    }
    return null;
  };

  const hoursFromLastRain = (historyDesc) => {
    for (let i = 0; i < historyDesc.length; i += 1) {
      if (toNum(historyDesc[i]?.precipitation_mm, 0) > 0) return i * 24;
    }
    return null;
  };

  const buildExplanation = (day) => {
    const fungal = Number(day?.fungal_risk);
    const water = Number(day?.waterlogging_risk);
    const heat = Number(day?.heat_risk);
    if (!Number.isFinite(fungal) || !Number.isFinite(water) || !Number.isFinite(heat)) return [];
    const total = fungal + water + heat || 1;
    return [
      { label: `Riesgo fúngico ${Math.round(fungal)} pts`, weight: Math.round((fungal / total) * 100) },
      { label: `Riesgo encharcamiento ${Math.round(water)} pts`, weight: Math.round((water / total) * 100) },
      { label: `Riesgo térmico ${Math.round(heat)} pts`, weight: Math.round((heat / total) * 100) },
    ];
  };

  const persistTodayContext = (day) => {
    if (typeof window === 'undefined') return;
    const payload = {
      region,
      temp: toNum(day?.temp_mean_c, null),
      precip: toNum(day?.precipitation_mm, null),
      risk_fungico: toNum(day?.fungal_risk, null),
      score,
      action: actionToday,
      reason,
    };
    window.localStorage.setItem(TODAY_STORAGE_KEY, JSON.stringify(payload));
  };

  const loadHero = async () => {
    loading = true;
    simulation = null;
    try {
      const [operativoData, historyData] = await Promise.all([
        fetchJson(`/api/risk/operativo?region=${encodeURIComponent(region)}`),
        fetchJson(`/api/history?region=${encodeURIComponent(region)}&limit=14`),
      ]);

      const historyDesc = Array.isArray(historyData?.items) ? historyData.items : [];
      const today = historyDesc[0] ?? null;
      const yesterday = historyDesc[1] ?? null;

      const todaySignalScore = scoreFromSignals(today);
      const yesterdaySignalScore = scoreFromSignals(yesterday);

      score = operativoData?.score == null ? todaySignalScore : toNum(operativoData?.score, todaySignalScore);
      const fromOperativoLevel = String(operativoData?.status || '').toLowerCase();
      const inferredLevel = score === null ? { text: 'SIN DATOS', cls: 'sin-datos' } : levelFromScore(score);
      level =
        fromOperativoLevel === 'accion'
          ? 'ALTO'
          : fromOperativoLevel === 'vigilancia'
          ? 'MEDIO'
          : fromOperativoLevel === 'rutina'
          ? 'BAJO'
          : inferredLevel.text;
      levelClass =
        fromOperativoLevel === 'accion'
          ? 'alto'
          : fromOperativoLevel === 'vigilancia'
          ? 'medio'
          : fromOperativoLevel === 'rutina'
          ? 'bajo'
          : inferredLevel.cls;

      reason = operativoData?.reason || 'Datos no disponibles';
      actionToday = operativoData?.action_today || 'Datos no disponibles.';

      if (todaySignalScore !== null && yesterdaySignalScore !== null) {
        delta = todaySignalScore - yesterdaySignalScore;
      } else {
        delta = 0;
      }

      criticalWindowHours = score === null ? null : score >= 70 || delta >= 10 ? 24 : score >= 40 ? 48 : 72;
      hoursSinceRain = hoursFromLastRain(historyDesc);
      explanation = today ? buildExplanation(today) : [];
      persistTodayContext(today);
    } finally {
      loading = false;
    }
  };

  const simulateAlert = async () => {
    simulating = true;
    try {
      const response = await fetchJson('/api/alerts/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region }),
      });
      simulation = response || {
        alert: 'Datos no disponibles',
        action: 'No se pudo simular la alerta.',
        confidence: 0,
      };
    } finally {
      simulating = false;
    }
  };

  const onRegionChange = async (event) => {
    if (!event?.detail || event.detail === region) return;
    region = event.detail;
    await loadHero();
  };

  const onRefresh = async () => {
    await loadHero();
  };

  onMount(() => {
    loadHero();
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

  $: deltaPrefix = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
</script>

<section class="hero-op">
  {#if loading}
    <div class="hero-skeleton"></div>
  {:else}
    <div class="hero-main">
      <p class="label">RIESGO HOY</p>
      <h2>{level}{score === null ? '' : ` (${score})`}</h2>
      <p class="delta">{score === null ? 'Datos no disponibles.' : `${deltaPrefix} ${Math.abs(delta)} vs ayer`}</p>
      <p class="window">⏱ Próxima ventana crítica: {criticalWindowHours === null ? 'Datos no disponibles' : `${criticalWindowHours}h`}</p>
      <p class="rain">Última lluvia: {hoursSinceRain === null ? 'Datos no disponibles' : `hace ${hoursSinceRain}h`}</p>
    </div>

    <div class="hero-why">
      <h3>¿Por qué?</h3>
      {#if explanation.length === 0}
        <p>Datos no disponibles para explicar factores de riesgo.</p>
      {:else}
        {#each explanation as item}
          <p>+ {item.label} ({item.weight}%)</p>
        {/each}
      {/if}
      <small>{reason}</small>
    </div>

    <div class="hero-action">
      <h3>🧭 Decisión de hoy</h3>
      <p>✔ {score === null ? 'Datos no disponibles.' : score <= 30 ? 'Mantener operación normal' : 'Mantener vigilancia activa'}</p>
      <p>⚠ {actionToday}</p>
      <p>⏱ Revisar nuevamente en {criticalWindowHours === null ? 'Datos no disponibles' : `${criticalWindowHours}h`}</p>
      <button type="button" on:click={simulateAlert} disabled={simulating}>
        {simulating ? 'Simulando...' : '⚡ Simular alerta automática'}
      </button>
      {#if simulation}
        <div class="sim-card">
          <strong>{simulation.alert || 'Datos no disponibles'}</strong>
          <p>{simulation.action || 'Datos no disponibles'}</p>
          <small>Confianza: {Math.round(toNum(simulation.confidence, 0) * 100)}%</small>
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .hero-op {
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 20px;
    padding: 1rem;
    box-shadow: var(--shadow-sm, 0 1px 3px rgba(31, 41, 55, 0.06));
    display: grid;
    grid-template-columns: 1.2fr 1fr 1fr;
    gap: 1rem;
  }

  .hero-main h2 {
    margin: 0.2rem 0 0.3rem;
    font-size: 1.5rem;
    color: var(--text-primary, #1f2937);
  }

  .label {
    margin: 0;
    font-size: 0.72rem;
    color: var(--text-secondary, #64748b);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .delta,
  .window,
  .rain {
    margin: 0.2rem 0 0;
    font-size: 0.9rem;
    color: var(--text-secondary, #475569);
  }

  .hero-why,
  .hero-action {
    background: var(--bg-app, #f8fafc);
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 12px;
    padding: 0.85rem;
  }

  .hero-why h3,
  .hero-action h3 {
    margin: 0;
    font-size: 0.94rem;
    color: var(--text-primary, #1f2937);
  }

  .hero-why p,
  .hero-action p {
    margin: 0.38rem 0 0;
    font-size: 0.84rem;
    color: var(--text-secondary, #475569);
  }

  .hero-why small {
    display: block;
    margin-top: 0.55rem;
    font-size: 0.75rem;
    color: var(--text-tertiary, #94a3b8);
  }

  .hero-action button {
    margin-top: 0.65rem;
    border: none;
    border-radius: 10px;
    background: var(--primary, #7b5ba6);
    color: #fff;
    font: inherit;
    font-size: 0.84rem;
    font-weight: 600;
    padding: 0.55rem 0.75rem;
    cursor: pointer;
  }

  .hero-action button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .sim-card {
    margin-top: 0.65rem;
    border: 1px dashed var(--border-subtle, #d4dce6);
    border-radius: 10px;
    padding: 0.6rem;
    background: #fff;
  }

  .sim-card strong {
    font-size: 0.82rem;
    color: var(--text-primary, #1f2937);
  }

  .sim-card p {
    margin: 0.3rem 0 0;
  }

  .sim-card small {
    display: block;
    margin-top: 0.3rem;
    color: var(--text-tertiary, #94a3b8);
    font-size: 0.74rem;
  }

  .hero-skeleton {
    height: 140px;
    border-radius: 12px;
    background: linear-gradient(90deg, var(--border-subtle, #e2e8f0) 25%, var(--bg-app, #f1f5f9) 50%, var(--border-subtle, #e2e8f0) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite linear;
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  @media (max-width: 1100px) {
    .hero-op {
      grid-template-columns: 1fr;
    }
  }
</style>
