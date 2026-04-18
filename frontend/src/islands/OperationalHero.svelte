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
  let explanation = { dominant: 'Sin datos', lines: [] };
  let latestDay = null;
  let trendSource = 'stable';
  let trendLabel = '→ estable';
  let confidencePct = null;
  let historyDaysUsed = 0;
  let nextReviewLabel = 'cuando haya datos';
  let regionalTop = [];

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

  const statusFromScore = (riskScore) => {
    if (riskScore === null) return 'sin_datos';
    if (riskScore >= 70) return 'accion';
    if (riskScore >= 40) return 'vigilancia';
    return 'rutina';
  };

  const reasonFromSignals = (day) => {
    const fungal = Number(day?.fungal_risk);
    const water = Number(day?.waterlogging_risk);
    const heat = Number(day?.heat_risk);
    if (!Number.isFinite(fungal) || !Number.isFinite(water) || !Number.isFinite(heat)) {
      return 'Datos no disponibles.';
    }
    if (fungal >= water && fungal >= heat) return 'El factor dominante hoy es riesgo fúngico.';
    if (water >= fungal && water >= heat) return 'El factor dominante hoy es riesgo por encharcamiento.';
    return 'El factor dominante hoy es riesgo térmico.';
  };

  const actionFromSignals = (day, riskScore) => {
    const fromRecommendation = String(day?.recommendation_message || '').trim();
    if (fromRecommendation) return fromRecommendation;
    if (riskScore === null) return 'Datos no disponibles.';
    if (riskScore >= 70) return 'Realiza inspección en campo y registra protocolo fitosanitario hoy.';
    if (riskScore >= 40) return 'Refuerza ventilación, drenaje y monitoreo de humedad en el turno.';
    return 'Mantén rutina normal y continúa monitoreo preventivo.';
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
    const temp = Number(day?.temp_mean_c);
    if (!Number.isFinite(fungal) || !Number.isFinite(water) || !Number.isFinite(heat)) {
      return { dominant: 'Sin datos', lines: [] };
    }
    const dominant =
      fungal >= water && fungal >= heat
        ? 'riesgo fúngico'
        : water >= fungal && water >= heat
        ? 'encharcamiento'
        : 'riesgo térmico';
    const impact = (value) => (value >= 70 ? 'impacto alto' : value >= 40 ? 'impacto medio' : 'impacto bajo');
    const humidityLabel = fungal >= 70 ? 'Humedad alta' : fungal >= 40 ? 'Humedad moderada' : 'Humedad controlada';
    const soilLabel = water >= 70 ? 'Suelo saturado' : water >= 40 ? 'Suelo con humedad acumulada' : 'Suelo estable';
    const tempLabel = Number.isFinite(temp)
      ? temp <= 12
        ? 'Temperatura baja'
        : temp >= 26
        ? 'Temperatura alta'
        : 'Temperatura templada'
      : 'Temperatura sin dato';
    return {
      dominant,
      lines: [
        { label: humidityLabel, impact: impact(fungal) },
        { label: soilLabel, impact: impact(water) },
        { label: tempLabel, impact: impact(heat) },
      ],
    };
  };

  const confidenceFromData = (rawConfidence, historyDays) => {
    const value = String(rawConfidence || '').toLowerCase();
    if (value === 'alta') return 78;
    if (value === 'media') return 64;
    if (value === 'baja') return 52;
    if (historyDays >= 14) return 78;
    if (historyDays >= 7) return 64;
    if (historyDays > 0) return 52;
    return null;
  };

  const trendLabelFromSource = (trend) => {
    if (trend === 'up') return '↑ en aumento';
    if (trend === 'down') return '↓ a la baja';
    return '→ estable';
  };

  const nextReviewFromWindow = (windowHours) => {
    if (windowHours === null) return 'cuando haya datos';
    if (windowHours <= 24) return 'mañana 6:00 AM';
    if (windowHours <= 48) return 'mañana 2:00 PM';
    return 'pasado mañana 6:00 AM';
  };

  const scoreFromCompareItem = (item) => {
    const direct = Number(item?.risk_score);
    if (Number.isFinite(direct)) return Math.round(direct);
    return scoreFromSignals(item);
  };

  const defaultRegionItems = [
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
      const [operativoData, historyData, compareData] = await Promise.all([
        fetchJson(`/api/risk/operativo?region=${encodeURIComponent(region)}`),
        fetchJson(`/api/history?region=${encodeURIComponent(region)}&limit=14`),
        fetchJson('/api/municipalities/compare'),
      ]);

      const historyDesc = Array.isArray(historyData?.items) ? historyData.items : [];
      const today = historyDesc[0] ?? null;
      const yesterday = historyDesc[1] ?? null;
      latestDay = today;
      historyDaysUsed = historyDesc.length;

      const todaySignalScore = scoreFromSignals(today);
      const yesterdaySignalScore = scoreFromSignals(yesterday);
      const fallbackStatus = statusFromScore(todaySignalScore);
      const fallbackReason = reasonFromSignals(today);
      const fallbackAction = actionFromSignals(today, todaySignalScore);

      score = operativoData?.score == null ? todaySignalScore : toNum(operativoData?.score, todaySignalScore);
      const fromOperativoLevel = String(operativoData?.status || '').toLowerCase();
      trendSource = String(operativoData?.trend_7d || 'stable');
      trendLabel = trendLabelFromSource(trendSource);
      const inferredLevel = score === null ? { text: 'SIN DATOS', cls: 'sin-datos' } : levelFromScore(score);
      level =
        fromOperativoLevel === 'accion'
          ? 'ALTO'
          : fromOperativoLevel === 'vigilancia'
          ? 'MEDIO'
          : fromOperativoLevel === 'rutina'
          ? 'BAJO'
          : fallbackStatus === 'accion'
          ? 'ALTO'
          : fallbackStatus === 'vigilancia'
          ? 'MEDIO'
          : fallbackStatus === 'rutina'
          ? 'BAJO'
          : inferredLevel.text;
      levelClass =
        fromOperativoLevel === 'accion'
          ? 'alto'
          : fromOperativoLevel === 'vigilancia'
          ? 'medio'
          : fromOperativoLevel === 'rutina'
          ? 'bajo'
          : fallbackStatus === 'accion'
          ? 'alto'
          : fallbackStatus === 'vigilancia'
          ? 'medio'
          : fallbackStatus === 'rutina'
          ? 'bajo'
          : inferredLevel.cls;

      reason = operativoData?.reason || fallbackReason;
      actionToday = operativoData?.action_today || fallbackAction;

      if (todaySignalScore !== null && yesterdaySignalScore !== null) {
        delta = todaySignalScore - yesterdaySignalScore;
      } else {
        delta = 0;
      }

      criticalWindowHours = score === null ? null : score >= 70 || delta >= 10 ? 24 : score >= 40 ? 48 : 72;
      nextReviewLabel = nextReviewFromWindow(criticalWindowHours);
      confidencePct = confidenceFromData(operativoData?.confidence, historyDaysUsed);
      hoursSinceRain = hoursFromLastRain(historyDesc);
      explanation = today ? buildExplanation(today) : { dominant: 'Sin datos', lines: [] };
      const compareItems = Array.isArray(compareData?.items) ? compareData.items : [];
      regionalTop = compareItems
        .map((item) => {
          const itemScore = scoreFromCompareItem(item);
          return {
            slug: String(item?.slug || '').trim(),
            name: String(item?.name || '').trim(),
            score: Number.isFinite(itemScore) ? itemScore : null,
          };
        })
        .filter((item) => item.slug && item.score !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      if (regionalTop.length === 0) {
        const regionsData = await fetchJson('/api/regions');
        const regionItems = Array.isArray(regionsData?.items) && regionsData.items.length > 0
          ? regionsData.items
          : defaultRegionItems;
        const enriched = await Promise.all(
          regionItems.map(async (item) => {
            const slug = String(item?.slug || '').trim();
            if (!slug) return null;
            const name = String(item?.name || slug).trim();
            const operativo = await fetchJson(`/api/risk/operativo?region=${encodeURIComponent(slug)}`);
            const status = String(operativo?.status || '').toLowerCase();
            const operativoScoreRaw = Number(operativo?.score);
            let itemScore =
              status !== 'sin_datos' && Number.isFinite(operativoScoreRaw)
                ? Math.round(operativoScoreRaw)
                : null;
            if (itemScore === null) {
              const historyOne = await fetchJson(`/api/history?region=${encodeURIComponent(slug)}&limit=1`);
              const day = Array.isArray(historyOne?.items) ? historyOne.items[0] : null;
              itemScore = scoreFromSignals(day);
            }
            return {
              slug,
              name,
              score: Number.isFinite(itemScore) ? itemScore : null,
            };
          })
        );
        regionalTop = enriched
          .filter((item) => item && item.score !== null)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
      }
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
      if (response?.alert) {
        simulation = response;
        return;
      }

      const baseScore = Number.isFinite(score) ? score : scoreFromSignals(latestDay);
      const temp = toNum(latestDay?.temp_mean_c, null);
      const precip = toNum(latestDay?.precipitation_mm, null);
      if (baseScore === null || temp === null || precip === null) {
        simulation = {
          alert: 'Datos no disponibles',
          action: 'No se pudo simular la alerta.',
          confidence: 0,
        };
        return;
      }

      let tomorrowScore = Number(baseScore);
      if (precip >= 4) tomorrowScore += 14;
      else if (precip > 0) tomorrowScore += 8;
      if (temp < 12) tomorrowScore += 6;
      else if (temp > 26) tomorrowScore += 8;
      if (trendSource === 'up') tomorrowScore += 6;
      else if (trendSource === 'down') tomorrowScore -= 4;
      tomorrowScore = Math.max(12, Math.min(95, Math.round(tomorrowScore)));

      const nextLevel = tomorrowScore >= 70 ? 'alto' : tomorrowScore >= 40 ? 'medio' : 'bajo';
      simulation = {
        alert: `Riesgo ${nextLevel} mañana`,
        action:
          nextLevel === 'alto'
            ? 'Revisar drenaje hoy antes de las 10am y dejar registro fitosanitario.'
            : nextLevel === 'medio'
            ? 'Reforzar vigilancia de humedad y ventilación durante la mañana.'
            : 'Mantener rutina normal y revisar nuevamente en 24h.',
        confidence: 0.52,
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
      <p class="trend">📊 Tendencia semanal: {trendLabel}</p>
      <p class="confidence">Confianza del modelo: {confidencePct === null ? 'Sin datos' : `${confidencePct}%`}</p>
      <p class="model-base">Modelo basado en clima reciente ({historyDaysUsed > 0 ? Math.min(historyDaysUsed, 14) : 0} días)</p>
      <p class="window">⏱ Próxima ventana crítica: {criticalWindowHours === null ? 'Datos no disponibles' : `${criticalWindowHours}h`}</p>
      <p class="rain">Última lluvia: {hoursSinceRain === null ? 'Datos no disponibles' : `hace ${hoursSinceRain}h`}</p>
    </div>

    <div class="hero-why">
      <h3>¿Por qué?</h3>
      {#if explanation.lines.length === 0}
        <p>Datos no disponibles para explicar factores de riesgo.</p>
      {:else}
        <p class="dominant">Factor dominante: {explanation.dominant}</p>
        {#each explanation.lines as item}
          <p>+ {item.label} ({item.impact})</p>
        {/each}
      {/if}
      <small>{reason}</small>
    </div>

    <div class="hero-action">
      <h3>🧭 Decisión de hoy</h3>
      <p>✔ {score === null ? 'Datos no disponibles.' : score <= 30 ? 'Mantener operación normal' : 'Mantener vigilancia activa'}</p>
      <p>⚠ {actionToday}</p>
      <p>⏱ Próxima revisión sugerida: {nextReviewLabel}</p>
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

    <div class="hero-ranking">
      <h3>📍 Sabana de Bogotá hoy</h3>
      {#if regionalTop.length === 0}
        <p>Sin ranking regional disponible en este momento.</p>
      {:else}
        {#each regionalTop as item, idx}
          <p>{idx + 1}. {item.name} {idx === 0 ? '🔴' : idx === 1 ? '🟠' : '🟡'} {item.score}</p>
        {/each}
      {/if}
    </div>
  {/if}
</section>

<style>
  .hero-op {
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 20px;
    padding: 1.25rem;
    box-shadow: var(--shadow-sm, 0 1px 3px rgba(31, 41, 55, 0.06));
    display: grid;
    grid-template-columns: 1.2fr 1fr 1fr;
    gap: 1.25rem;
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
  .trend,
  .confidence,
  .model-base,
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

  .hero-why .dominant {
    margin-top: 0.45rem;
    font-weight: 600;
    color: var(--text-primary, #1f2937);
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

  .hero-ranking {
    grid-column: 1 / -1;
    background: var(--bg-app, #f8fafc);
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 12px;
    padding: 0.85rem;
  }

  .hero-ranking h3 {
    margin: 0;
    font-size: 0.94rem;
    color: var(--text-primary, #1f2937);
  }

  .hero-ranking p {
    margin: 0.38rem 0 0;
    font-size: 0.84rem;
    color: var(--text-secondary, #475569);
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
