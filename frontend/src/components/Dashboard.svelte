<script>
  import { onMount, onDestroy } from 'svelte';
  import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ComposedChart, Line, Bar, CartesianGrid } from 'recharts';

  export let apiUrl;

  const COLORS = {
    primary: '#756A85',
    primaryLight: '#A8A1B5',
    secondary: '#A8A1B5',
    alertHigh: '#C75D5D',
    alertMedium: '#8B7AA3',
    alertSuccess: '#7A8B6F',
    border: '#E5E0EB',
    textPrimary: '#2B2730',
    textSecondary: '#6B6573',
    textTertiary: '#9590A3',
  };

  let loading = true;
  let error = '';
  let data = null;
  let historyData = [];
  let riskExplain = null;
  let regions = [];
  let selectedRegion = 'madrid';

  const DAY_NAMES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const LOW_RISK = 'bajo';
  const MEDIUM_RISK = 'medio';
  const HIGH_RISK = 'alto';

  const normalizeRisk = (level) => {
    const v = String(level ?? '').toLowerCase().trim();
    if (v.includes('alto') || v === 'high' || v === '3') return HIGH_RISK;
    if (v.includes('medio') || v === 'medium' || v === '2') return MEDIUM_RISK;
    return LOW_RISK;
  };

  const riskScoreFromLevel = (level) => {
    const normalized = normalizeRisk(level);
    if (normalized === HIGH_RISK) return 82;
    if (normalized === MEDIUM_RISK) return 48;
    return 20;
  };

  const inferDailyRisk = (precip) => {
    if (precip == null) return null;
    const mm = Number(precip);
    if (mm >= 10) return HIGH_RISK;
    if (mm >= 4) return MEDIUM_RISK;
    return LOW_RISK;
  };

  const inferGlobalRisk = (snapshot) => {
    const global = riskScoreFromLevel(snapshot?.global_risk_level);
    const fungal = riskScoreFromLevel(snapshot?.fungal_risk);
    const water = riskScoreFromLevel(snapshot?.waterlogging_risk);
    const heat = riskScoreFromLevel(snapshot?.heat_risk);
    return Math.round(global * 0.45 + fungal * 0.2 + water * 0.2 + (100 - heat) * 0.15);
  };

  const fetchRegions = async () => {
    const res = await fetch(`${apiUrl}/api/regions`);
    const payload = await res.json();
    regions = payload.items ?? [];
    if (regions.length > 0 && !regions.find(r => r.slug === selectedRegion)) {
      selectedRegion = regions[0].slug;
    }
  };

  const fetchDashboard = async () => {
    const res = await fetch(`${apiUrl}/api/dashboard?region=${encodeURIComponent(selectedRegion)}`);
    if (!res.ok) throw new Error('Dashboard error');
    data = await res.json();
  };

  const fetchHistory = async () => {
    const res = await fetch(`${apiUrl}/api/history?region=${encodeURIComponent(selectedRegion)}&limit=14`);
    if (!res.ok) return;
    const payload = await res.json();
    historyData = (payload.items ?? []).reverse();
  };

  const fetchRiskExplain = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/risk/explain?region=${encodeURIComponent(selectedRegion)}`);
      if (res.ok) riskExplain = await res.json();
    } catch (e) {
      riskExplain = null;
    }
  };

  const refreshAll = async () => {
    loading = true;
    error = '';
    try {
      await fetchRegions();
      await Promise.all([fetchDashboard(), fetchHistory(), fetchRiskExplain()]);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error';
    } finally {
      loading = false;
    }
  };

  const onRegionChange = async (e) => {
    selectedRegion = e.target.value;
    await refreshAll();
  };

  const onExternalRefresh = async () => await refreshAll();
  const onExternalSearch = async (e) => {
    const q = String(e?.detail?.query ?? '').toLowerCase();
    if (!q || !regions.length) return;
    const match = regions.find(r => `${r.slug} ${r.name} ${r.city}`.toLowerCase().includes(q));
    if (match && match.slug !== selectedRegion) {
      selectedRegion = match.slug;
      await refreshAll();
    }
  };

  onMount(() => {
    refreshAll();
    if (typeof window !== 'undefined') {
      window.addEventListener('flowerxi:refresh', onExternalRefresh);
      window.addEventListener('flowerxi:search-region', onExternalSearch);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('flowerxi:refresh', onExternalRefresh);
      window.removeEventListener('flowerxi:search-region', onExternalSearch);
    }
  });

  const formatTemp = (v) => v != null ? `${Number(v).toFixed(1)}°C` : '--';
  const formatPrecip = (v) => v != null ? `${Number(v).toFixed(1)}` : '--';
  const calcChange = (arr, key) => {
    if (!arr || arr.length < 2) return null;
    const curr = Number(arr[arr.length - 1][key]) || 0;
    const prev = Number(arr[arr.length - 2][key]) || 0;
    if (prev === 0) return null;
    return ((curr - prev) / prev * 100).toFixed(1);
  };

  $: snapshot = data?.snapshot ?? null;
  $: riskPercent = snapshot ? inferGlobalRisk(snapshot) : 0;
  $: yesterday = historyData.length >= 2 ? historyData[historyData.length - 2] : null;
  $: tempChange = calcChange(historyData, 'temp_mean_c');
  $: precipChange = calcChange(historyData, 'precipitation_mm');

  $: sparklineData = historyData.map((d, i) => ({
    day: i + 1,
    temp: d.temp_mean_c,
    precip: d.precipitation_mm * 10,
  }));

  $: todayStats = snapshot ? [
    { icon: 'termometro', label: 'Temp media', value: formatTemp(snapshot.temp_mean_c), change: tempChange, data: sparklineData?.map(d => d.temp) ?? [] },
    { icon: 'gota', label: 'Precipitación', value: formatPrecip(snapshot.precipitation_mm) + ' mm', change: precipChange, data: sparklineData?.map(d => d.precip) ?? [] },
    { icon: 'humedad', label: 'Humedad est.', value: snapshot?.precipitation_mm ? Math.min(95, Math.round(30 + snapshot.precipitation_mm * 4)) + '%' : '--', change: null, data: [] },
  ] : [];

  $: observedDate = snapshot?.observed_on ? new Date(snapshot.observed_on) : new Date();
  $: refMonth = observedDate.getMonth();
  $: refYear = observedDate.getFullYear();
  $: daysInMonth = new Date(refYear, refMonth + 1, 0).getDate();
  $: firstOffset = new Date(refYear, refMonth, 1).getDay();
  $: adjustedOffset = firstOffset === 0 ? 6 : firstOffset - 1;
  $: calendarCells = Array.from({ length: adjustedOffset + daysInMonth }, (_, i) => {
    if (i < adjustedOffset) return null;
    const day = i - adjustedOffset + 1;
    const histItem = historyData.find(h => new Date(h.observed_on).getDate() === day && new Date(h.observed_on).getMonth() === refMonth);
    return { day, risk: histItem ? inferDailyRisk(histItem.precipitation_mm) : null, isToday: day === observedDate.getDate() };
  });

  $: riskLabel = riskPercent < 40 ? 'Bajo' : riskPercent < 70 ? 'Medio' : 'Alto';
  $: riskColor = riskPercent < 40 ? COLORS.alertSuccess : riskPercent < 70 ? COLORS.alertMedium : COLORS.alertHigh;
  $: gaugePercent = riskPercent;
  $: circumference = 2 * Math.PI * 54;
  $: strokeDash = circumference * (1 - gaugePercent / 100);
</script>

<section class="dashboard">
  {#if loading}
    <div class="state loading"><p>Cargando estado del cultivo...</p></div>
  {:else if error}
    <div class="state error"><p>{error}</p></div>
  {:else if snapshot}
    <section class="dashboard-grid">
      <!-- KPI Cards -->
      <article class="card kpi-section">
        <div class="card-header">
          <h2>Tu Estado de Cultivo Hoy</h2>
          <p>Snapshot operativo para rosa de corte</p>
        </div>
        <div class="kpi-grid">
          {#each todayStats as kpi}
            <div class="kpi-card">
              <div class="kpi-header">
                {#if kpi.icon === 'termometro'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>
                {:else if kpi.icon === 'gota'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                {:else}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v6l3 3M8 16a4 4 0 0 0 8 0"/></svg>
                {/if}
                <span>{kpi.label}</span>
              </div>
              <div class="kpi-value">{kpi.value}</div>
              {#if kpi.change}
                <div class="kpi-change {Number(kpi.change) >= 0 ? 'positive' : 'negative'}">
                  {Number(kpi.change) >= 0 ? '+' : ''}{kpi.change}% vs semana anterior
                </div>
              {/if}
              {#if kpi.data.length > 0}
                <div class="kpi-sparkline">
                  <ResponsiveContainer width="100%" height={36}>
                    <AreaChart data={kpi.data.map((v, i) => ({ value: v, idx: i }))}>
                      <defs>
                        <linearGradient id="sparkGrad-{kpi.icon}" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stop-color={COLORS.primaryLight} stop-opacity={0.3}/>
                          <stop offset="100%" stop-color={COLORS.primary} stop-opacity={0.8}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="value" stroke="none" fill="url(#sparkGrad-{kpi.icon})" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Mini trend chart -->
        {#if historyData.length > 0}
        <div class="trend-section">
          <h3>Tendencia 14 días</h3>
          <div class="trend-chart">
            <ResponsiveContainer width="100%" height={140}>
              <ComposedChart data={sparklineData}>
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color={COLORS.primary} stop-opacity={0.2}/>
                    <stop offset="100%" stop-color={COLORS.primary} stop-opacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false}/>
                <XAxis dataKey="day" tick={{fontSize: 10, fill: COLORS.textTertiary}} axisLine={false} tickLine={false}/>
                <YAxis yAxisId="temp" tick={{fontSize: 10, fill: COLORS.textTertiary}} axisLine={false} tickLine={false} domain={['auto', 'auto']}/>
                <YAxis yAxisId="precip" orientation="right" tick={{fontSize: 10, fill: COLORS.textTertiary}} axisLine={false} tickLine={false}/>
                <Tooltip 
                  contentStyle={{background: COLORS.textPrimary, border: 'none', borderRadius: 8, color: '#fff'}}
                  labelStyle={{color: COLORS.textTertiary, fontSize: 11}}
                />
                <Area yAxisId="temp" type="monotone" dataKey="temp" stroke={COLORS.primary} fill="url(#tempGrad)" strokeWidth={2} name="Temp °C" />
                <Bar yAxisId="precip" dataKey="precip" fill={COLORS.primaryLight} opacity={0.5} name="Precip x10" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/if}
      </article>

      <!-- Calendar -->
      <article class="card calendar-card">
        <header class="card-head">
          <div>
            <h2>Calendario de Alertas</h2>
            <p class="month-title">{observedDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}</p>
          </div>
        </header>
        <div class="calendar-grid names">
          {#each DAY_NAMES as d}<span>{d}</span>{/each}
        </div>
        <div class="calendar-grid days">
          {#each calendarCells as cell}
            {#if cell}
              <div class="calendar-day {cell.risk ?? ''} {cell.isToday ? 'today' : ''}" data-tooltip={cell.risk ? `Riesgo ${cell.risk}` : ''}>
                <span>{cell.day}</span>
              </div>
            {:else}
              <div class="calendar-day empty"></div>
            {/if}
          {/each}
        </div>
        <div class="calendar-legend">
          <span><i class="dot today"></i>hoy</span>
          <span><i class="dot high"></i>alto</span>
          <span><i class="dot medium"></i>medio</span>
        </div>
      </article>

      <!-- Risk Gauge -->
      <article class="card risk-card">
        <header class="card-head">
          <div>
            <h2>Riesgo Actual</h2>
            <p>Índice operativo-comercial</p>
          </div>
          <select class="region-select" value={selectedRegion} on:change={onRegionChange}>
            {#each regions as r}<option value={r.slug}>{r.name}</option>{/each}
          </select>
        </header>
        <div class="gauge-container">
          <svg class="gauge-svg" viewBox="0 0 120 70">
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color={COLORS.border}/>
                <stop offset="100%" stop-color={COLORS.primary}/>
              </linearGradient>
            </defs>
            <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke={COLORS.border} stroke-width="10" stroke-linecap="round"/>
            <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="url(#gaugeGrad)" stroke-width="10" stroke-linecap="round" 
              stroke-dasharray="{circumference}" stroke-dashoffset="{strokeDash}" class="gauge-fill"/>
            <circle cx="60" cy="60" r="4" fill={gaugePercent < 40 ? COLORS.alertSuccess : gaugePercent < 70 ? COLORS.alertMedium : COLORS.alertHigh}/>
          </svg>
          <div class="gauge-value">{riskPercent}%</div>
          <div class="gauge-label" style="color: {riskColor}">{riskLabel}</div>
        </div>
        <div class="risk-meta">
          <span><strong>Meta:</strong> &lt;30%</span>
        </div>
      </article>

      <!-- Protocols -->
      <article class="card protocols-card">
        <header class="card-head">
          <div>
            <h2>Mis Protocolos</h2>
            <p>Hábitos recomendados este mes</p>
          </div>
        </header>
        <ul class="protocol-list">
          <li class="protocol-item">
            <div class="protocol-icon">⌁</div>
            <div class="protocol-content">
              <h4>Ventilar invernadero</h4>
              <p>Sistema de alertas</p>
              <div class="protocol-progress">Aplicado 8/12 aplicaciones</div>
            </div>
          </li>
          <li class="protocol-item">
            <div class="protocol-icon">◌</div>
            <div class="protocol-content">
              <h4>Revisar humedad</h4>
              <p>Sistema de alertas</p>
              <div class="protocol-progress">Aplicado 6/10 verificaciones</div>
            </div>
          </li>
          <li class="protocol-item">
            <div class="protocol-icon">✚</div>
            <div class="protocol-content">
              <h4>Aplicar preventivo</h4>
              <p>Sistema de alertas</p>
              <div class="protocol-progress">Aplicado 4/8 tratamientos</div>
            </div>
          </li>
        </ul>
      </article>

      <!-- Explain Card -->
      {#if riskExplain?.analysis}
      <article class="card explain-card">
        <header class="card-head">
          <div>
            <h2>¿Por qué cambió el riesgo?</h2>
            <p>Variables de los últimos 7 días</p>
          </div>
        </header>
        <div class="explain-content">
          <div class="explain-drivers">
            <div class="driver-item">
              <span class="driver-label">Driver principal</span>
              <span class="driver-value">{riskExplain.analysis.primary_driver}</span>
            </div>
            <div class="driver-item">
              <span class="driver-label">Precipitación cambio</span>
              <span class="driver-value">{riskExplain.analysis.precip_change_mm > 0 ? '+' : ''}{riskExplain.analysis.precip_change_mm} mm vs semana anterior</span>
            </div>
            <div class="driver-item">
              <span class="driver-label">Días con lluvia</span>
              <span class="driver-value">{riskExplain.analysis.rainy_days}</span>
            </div>
          </div>
          <div class="explain-recommendation">
            <span class="rec-label">Recomendación</span>
            <p>{riskExplain.analysis.recommendation}</p>
          </div>
        </div>
      </article>
      {/if}
    </section>
  {/if}
</section>

<style>
  .dashboard { min-height: 400px; }

  .state {
    border-radius: 24px;
    padding: 3rem 2rem;
    text-align: center;
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-subtle, #eee);
  }

  .state p { margin: 0; color: var(--text-secondary, #666); }
  .state.error p { color: #C75D5D; }

  .dashboard-grid {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 1rem;
  }

  .card {
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-subtle, #eee);
    border-radius: 16px;
    padding: 1.25rem;
  }

  /* KPI Section */
  .kpi-section { grid-area: kpi; }

  .card-header { margin-bottom: 1.25rem; }
  .card-header h2 { font-size: 1rem; margin: 0; }
  .card-header p { margin: 0.25rem 0 0; font-size: 0.82rem; color: var(--text-secondary, #666); }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.85rem;
  }

  .kpi-card {
    background: var(--bg-app, #f8f8f8);
    border: 1px solid var(--border-subtle, #eee);
    border-radius: 14px;
    padding: 1rem;
  }

  .kpi-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--text-secondary, #666);
    font-size: 0.75rem;
    margin-bottom: 0.35rem;
  }

  .kpi-header svg { width: 14px; height: 14px; }

  .kpi-value {
    font-size: 1.6rem;
    font-weight: 600;
    color: var(--text-primary, #222);
    letter-spacing: -0.02em;
  }

  .kpi-change {
    font-size: 0.7rem;
    margin-top: 0.25rem;
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
  }

  .kpi-change.positive { color: #7A8B6F; }
  .kpi-change.negative { color: #C75D5D; }

  .kpi-sparkline { margin-top: 0.5rem; }

  /* Trend Chart */
  .trend-section {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border-subtle, #eee);
  }

  .trend-section h3 {
    font-size: 0.85rem;
    color: var(--text-secondary, #666);
    margin-bottom: 0.75rem;
  }

  .trend-chart { height: 140px; }

  /* Calendar */
  .calendar-card {
    background: var(--text-primary, #2B2730);
    border-color: var(--text-primary, #2B2730);
    color: #fff;
  }

  .calendar-card .card-header h2, .calendar-card .card-header p { color: rgba(255,255,255,0.9); }
  .month-title { color: rgba(255,255,255,0.6) !important; text-transform: capitalize; }

  .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.3rem; }
  .calendar-grid.names { margin-top: 0.85rem; margin-bottom: 0.35rem; color: rgba(255,255,255,0.5); font-size: 0.7rem; text-align: center; }

  .calendar-day {
    aspect-ratio: 1;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-size: 0.75rem;
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.7);
    cursor: default;
    position: relative;
  }

  .calendar-day.empty { background: transparent; }
  .calendar-day.high { background: #C75D5D; color: #fff; }
  .calendar-day.medium { background: #8B7AA3; color: #fff; }
  .calendar-day.today { border: 2px solid #A8A1B5; }

  .calendar-legend {
    margin-top: 0.85rem;
    display: flex;
    gap: 0.75rem;
    font-size: 0.7rem;
    color: rgba(255,255,255,0.6);
  }

  .calendar-legend span { display: inline-flex; align-items: center; gap: 0.3rem; }

  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .dot.today { border: 1.5px solid #fff; }
  .dot.high { background: #C75D5D; }
  .dot.medium { background: #8B7AA3; }

  /* Risk Gauge */
  .risk-card { text-align: center; }

  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .region-select {
    border: 1px solid var(--border-subtle, #ddd);
    border-radius: 8px;
    padding: 0.35rem 0.6rem;
    font-size: 0.8rem;
    background: var(--bg-app, #f8f8f8);
    color: var(--text-primary, #222);
  }

  .gauge-container { padding: 0.5rem 0; }

  .gauge-svg { width: 100%; max-width: 160px; }

  .gauge-fill { transition: stroke-dashoffset 600ms ease; }

  .gauge-value {
    font-size: 2rem;
    font-weight: 600;
    color: var(--text-primary, #222);
    margin-top: -0.5rem;
  }

  .gauge-label {
    font-size: 0.85rem;
    font-weight: 500;
    margin-top: 0.25rem;
  }

  .risk-meta {
    margin-top: 1rem;
    font-size: 0.85rem;
    color: var(--text-secondary, #666);
  }

  /* Protocols */
  .protocols-card { grid-area: protocols; }

  .protocol-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .protocol-item {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
    padding: 0.8rem;
    background: var(--bg-app, #f8f8f8);
    border-radius: 12px;
    border: 1px solid var(--border-subtle, #eee);
  }

  .protocol-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: var(--border-subtle, #eee);
    color: var(--primary, #756A85);
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .protocol-content h4 {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-primary, #222);
  }

  .protocol-content p {
    margin: 0.15rem 0 0;
    font-size: 0.75rem;
    color: var(--text-secondary, #666);
  }

  .protocol-progress {
    margin-top: 0.35rem;
    font-size: 0.8rem;
    color: var(--primary, #756A85);
    font-weight: 500;
  }

  /* Explain */
  .explain-card { grid-area: explain; }

  .explain-content {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 1rem;
  }

  .explain-drivers { display: flex; flex-direction: column; gap: 0.5rem; }

  .driver-item {
    padding: 0.5rem 0.65rem;
    background: var(--bg-app, #f8f8f8);
    border-radius: 10px;
  }

  .driver-label {
    display: block;
    font-size: 0.7rem;
    color: var(--text-secondary, #666);
    margin-bottom: 0.15rem;
  }

  .driver-value {
    font-size: 0.85rem;
    color: var(--text-primary, #222);
  }

  .explain-recommendation {
    background: rgba(117, 106, 133, 0.1);
    border: 1px solid rgba(117, 106, 133, 0.2);
    border-radius: 12px;
    padding: 0.75rem;
  }

  .rec-label {
    font-size: 0.7rem;
    color: var(--primary, #756A85);
    font-weight: 600;
  }

  .explain-recommendation p {
    margin: 0.35rem 0 0;
    font-size: 0.85rem;
    color: var(--text-primary, #222);
    line-height: 1.4;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .dashboard-grid { grid-template-columns: 1fr; }
    .kpi-grid { grid-template-columns: repeat(3, 1fr); }
  }

  @media (max-width: 640px) {
    .kpi-grid { grid-template-columns: 1fr; }
    .explain-content { grid-template-columns: 1fr; }
  }
</style>