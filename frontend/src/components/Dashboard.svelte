<script>
  import { onDestroy, onMount } from 'svelte';

  export let apiUrl;

  let loading = true;
  let loadingRegions = true;
  let error = '';
  let historyError = '';
  let monthlyRiskError = '';
  let alertsTodayError = '';
  let weeklyRecommendationsError = '';
  let data = null;
  let historyData = [];
  let monthlyRisk = null;
  let alertsToday = null;
  let weeklyRecommendations = null;
  let riskExplain = null;
  let regions = [];
  let selectedRegion = 'madrid';

  const DAY_NAMES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const LOW_RISK_LABEL = 'bajo';
  const MEDIUM_RISK_LABEL = 'medio';
  const HIGH_RISK_LABEL = 'alto';

  const normalizeRiskLevel = (level) => {
    const value = String(level ?? '').toLowerCase().trim();
    if (value.includes('alto') || value === 'high' || value === '3') return HIGH_RISK_LABEL;
    if (value.includes('medio') || value === 'medium' || value === '2') return MEDIUM_RISK_LABEL;
    if (value.includes('bajo') || value === 'low' || value === '1') return LOW_RISK_LABEL;
    return LOW_RISK_LABEL;
  };

  const riskScoreFromLevel = (level) => {
    const normalized = normalizeRiskLevel(level);
    if (normalized === HIGH_RISK_LABEL) return 82;
    if (normalized === MEDIUM_RISK_LABEL) return 48;
    return 20;
  };

  const inferDailyRisk = (precipitation) => {
    if (precipitation == null) return null;
    const mm = Number(precipitation);
    if (Number.isNaN(mm)) return null;
    if (mm >= 10) return HIGH_RISK_LABEL;
    if (mm >= 4) return MEDIUM_RISK_LABEL;
    return LOW_RISK_LABEL;
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const inferGlobalRiskPercent = (snapshot) => {
    const global = riskScoreFromLevel(snapshot?.global_risk_level);
    const fungal = riskScoreFromLevel(snapshot?.fungal_risk);
    const waterlogging = riskScoreFromLevel(snapshot?.waterlogging_risk);
    const heat = riskScoreFromLevel(snapshot?.heat_risk);
    const score = global * 0.45 + fungal * 0.2 + waterlogging * 0.2 + (100 - heat) * 0.15;
    return Math.round(clamp(score, 0, 100));
  };

  const estimateHumidity = (snapshot) => {
    const fungal = riskScoreFromLevel(snapshot?.fungal_risk);
    const waterlogging = riskScoreFromLevel(snapshot?.waterlogging_risk);
    const heat = riskScoreFromLevel(snapshot?.heat_risk);
    const estimate = fungal * 0.45 + waterlogging * 0.45 + (100 - heat) * 0.1;
    return Math.round(clamp(estimate, 30, 95));
  };

  const ratioText = (value, target, label) => `${value}/${target} ${label}`;

  const cacheTodayData = (snapshot) => {
    if (typeof window === 'undefined' || !snapshot) return;
    const payload = {
      region: snapshot.region_name ?? selectedRegion,
      temp: snapshot.temp_mean_c ?? null,
      precip: snapshot.precipitation_mm ?? null,
      risk_fungico: snapshot.fungal_risk ?? null,
      risk_encharcamiento: snapshot.waterlogging_risk ?? null,
      risk_calor: snapshot.heat_risk ?? null,
      recommendation: snapshot.recommendation_title ?? '',
      observed_on: snapshot.observed_on ?? null,
    };
    window.localStorage.setItem('flowerxi_today', JSON.stringify(payload));
  };

  const fetchRegions = async () => {
    loadingRegions = true;
    const response = await fetch(`${apiUrl}/api/regions`);
    if (!response.ok) throw new Error(`Backend respondio ${response.status}`);
    const payload = await response.json();
    regions = payload.items ?? [];
    if (regions.length === 0) throw new Error('No hay municipios disponibles');
    const available = new Set(regions.map((region) => region.slug));
    const defaultRegion = payload.default_region;
    selectedRegion = defaultRegion && available.has(defaultRegion) ? defaultRegion : regions[0].slug;
  };

  const fetchDashboard = async () => {
    loading = true;
    error = '';
    const response = await fetch(`${apiUrl}/api/dashboard?region=${encodeURIComponent(selectedRegion)}`);
    if (!response.ok) throw new Error(`Backend respondio ${response.status}`);
    data = await response.json();
    cacheTodayData(data?.snapshot);
    loading = false;
  };

  const fetchHistory = async () => {
    historyError = '';
    try {
      const response = await fetch(`${apiUrl}/api/history?region=${encodeURIComponent(selectedRegion)}&limit=90`);
      if (!response.ok) throw new Error(`Backend respondio ${response.status}`);
      const payload = await response.json();
      historyData = (payload.items ?? []).reverse();
    } catch (err) {
      historyData = [];
      historyError = err instanceof Error ? err.message : 'No fue posible cargar el historial';
    }
  };

  const fetchMonthlyRisk = async () => {
    monthlyRiskError = '';
    try {
      const response = await fetch(`${apiUrl}/api/risk/monthly?region=${encodeURIComponent(selectedRegion)}&months=6`);
      if (!response.ok) throw new Error(`Backend respondio ${response.status}`);
      monthlyRisk = await response.json();
    } catch (err) {
      monthlyRisk = null;
      monthlyRiskError = err instanceof Error ? err.message : 'No fue posible cargar el riesgo mensual';
    }
  };

  const fetchAlertsToday = async () => {
    alertsTodayError = '';
    try {
      const response = await fetch(`${apiUrl}/api/alerts/today?region=${encodeURIComponent(selectedRegion)}`);
      if (!response.ok) throw new Error(`Backend respondio ${response.status}`);
      alertsToday = await response.json();
    } catch (err) {
      alertsToday = null;
      alertsTodayError = err instanceof Error ? err.message : 'No fue posible cargar alertas de hoy';
    }
  };

  const fetchWeeklyRecommendations = async () => {
    weeklyRecommendationsError = '';
    try {
      const response = await fetch(`${apiUrl}/api/recommendations/week?region=${encodeURIComponent(selectedRegion)}&days=7`);
      if (!response.ok) throw new Error(`Backend respondio ${response.status}`);
      weeklyRecommendations = await response.json();
    } catch (err) {
      weeklyRecommendations = null;
      weeklyRecommendationsError = err instanceof Error ? err.message : 'No fue posible cargar recomendaciones semanales';
    }
  };

  const fetchRiskExplain = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/risk/explain?region=${encodeURIComponent(selectedRegion)}`);
      if (!response.ok) return;
      riskExplain = await response.json();
    } catch (err) {
      riskExplain = null;
    }
  };

  const refreshAll = async () => {
    try {
      await fetchDashboard();
      await Promise.all([fetchHistory(), fetchMonthlyRisk(), fetchAlertsToday(), fetchWeeklyRecommendations(), fetchRiskExplain()]);
    } catch (err) {
      loading = false;
      error = err instanceof Error ? err.message : 'Error cargando dashboard';
    }
  };

  const initialize = async () => {
    loading = true;
    error = '';
    try {
      await fetchRegions();
      await refreshAll();
    } catch (err) {
      loading = false;
      error = err instanceof Error ? err.message : 'Error cargando dashboard';
    } finally {
      loadingRegions = false;
    }
  };

  const onRegionChange = async (event) => {
    selectedRegion = event.currentTarget.value;
    await refreshAll();
  };

  const selectRegionByQuery = async (query) => {
    if (!query || regions.length === 0) return;
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return;
    const match = regions.find((region) => {
      const target = `${region.slug} ${region.name} ${region.city}`.toLowerCase();
      return target.includes(normalizedQuery);
    });
    if (match && match.slug !== selectedRegion) {
      selectedRegion = match.slug;
      await refreshAll();
    }
  };

  const onExternalRefresh = async () => {
    await refreshAll();
  };

  const onExternalSearch = async (event) => {
    const query = String(event?.detail?.query ?? '');
    await selectRegionByQuery(query);
  };

  const formatTemp = (value) => (value != null ? `${Number(value).toFixed(1)}°C` : '--');
  const formatPrecip = (value) => (value != null ? `${Number(value).toFixed(1)} mm` : '--');
  const formatScore = (value) => (value == null ? '--' : `${Number(value).toFixed(1)}`);
  const formatDate = (value) => {
    if (!value) return '--';
    return new Date(value).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const formatCurrency = (value) => {
    if (value == null) return '--';
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number(value));
  };

  onMount(() => {
    initialize();
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

  $: snapshot = data?.snapshot ?? null;
  $: riskPercent = snapshot ? inferGlobalRiskPercent(snapshot) : 0;
  $: humidityEstimate = snapshot ? estimateHumidity(snapshot) : null;
  $: observedDate = snapshot?.observed_on ? new Date(snapshot.observed_on) : new Date();
  $: referenceMonth = observedDate.getMonth();
  $: referenceYear = observedDate.getFullYear();
  $: monthTitle = observedDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  $: monthHistory = historyData.filter((item) => {
    const date = new Date(item.observed_on);
    return date.getFullYear() === referenceYear && date.getMonth() === referenceMonth;
  });
  $: highRiskDays = monthHistory.filter((item) => inferDailyRisk(item.precipitation_mm) === HIGH_RISK_LABEL).length;
  $: mediumRiskDays = monthHistory.filter((item) => inferDailyRisk(item.precipitation_mm) === MEDIUM_RISK_LABEL).length;
  $: monthlyDataPoints = monthHistory.length;
  $: dayRiskMap = new Map(
    monthHistory.map((item) => {
      const date = new Date(item.observed_on);
      return [date.getDate(), inferDailyRisk(item.precipitation_mm)];
    }),
  );
  $: daysInMonth = new Date(referenceYear, referenceMonth + 1, 0).getDate();
  $: firstWeekOffset = (() => {
    const firstDay = new Date(referenceYear, referenceMonth, 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1;
  })();
  $: calendarCells = Array.from({ length: firstWeekOffset + daysInMonth }, (_, index) => {
    if (index < firstWeekOffset) return null;
    const day = index - firstWeekOffset + 1;
    return {
      day,
      risk: dayRiskMap.get(day) ?? null,
      isToday: snapshot ? day === observedDate.getDate() : false,
    };
  });
  $: recentWindow = historyData.slice(-30);
  $: incidents = recentWindow.map((item) => {
    const level = inferDailyRisk(item.precipitation_mm);
    return { level, alert: level === HIGH_RISK_LABEL || level === MEDIUM_RISK_LABEL };
  });
  $: optimalDays = incidents.filter((item) => !item.alert).length;
  $: incidentSegments = Array.from({ length: 30 }, (_, index) => incidents[index] ?? null);
  $: ventilationDone = clamp(monthlyDataPoints - highRiskDays, 0, 12);
  $: humidityChecksDone = clamp(highRiskDays + mediumRiskDays, 0, 10);
  $: preventiveDone = clamp(highRiskDays, 0, 8);
  $: registryDone = clamp(monthlyDataPoints, 0, 10);
  $: protocols = [
    {
      icon: '⌁',
      name: 'Ventilar invernadero',
      trainer: 'Sistema de alertas',
      progress: ratioText(ventilationDone, 12, 'aplicaciones'),
      applied: ventilationDone,
    },
    {
      icon: '◌',
      name: 'Revisar humedad',
      trainer: 'Sistema de alertas',
      progress: ratioText(humidityChecksDone, 10, 'verificaciones'),
      applied: humidityChecksDone,
    },
    {
      icon: '✚',
      name: 'Aplicar preventivo',
      trainer: 'Sistema de alertas',
      progress: ratioText(preventiveDone, 8, 'tratamientos'),
      applied: preventiveDone,
    },
    {
      icon: '☑',
      name: 'Registrar fitosanitario',
      trainer: 'Sistema de alertas',
      progress: ratioText(registryDone, 10, 'registros'),
      applied: registryDone,
    },
  ];
  $: monthlyLatest = monthlyRisk?.latest ?? null;
  $: monthlyItems = monthlyRisk?.items ?? [];
  $: monthlyNarrative = monthlyRisk?.narrative ?? '';
  $: monthlyCommercial = monthlyRisk?.commercial ?? null;
  $: alertToday = alertsToday?.alert ?? null;
  $: weeklyItems = weeklyRecommendations?.items ?? [];
  $: weeklyDistribution = weeklyRecommendations?.risk_distribution ?? null;
</script>

<section class="dashboard">
  {#if loading}
    <div class="state loading"><p>Cargando estado del cultivo...</p></div>
  {:else if error}
    <div class="state error"><p>{error}</p></div>
  {:else if snapshot}
    <section class="dashboard-grid">
      <article class="card status-card">
        <header class="card-head">
          <div>
            <h2>Tu Estado de Cultivo Hoy</h2>
            <p class="card-subtitle">Snapshot operativo para rosa de corte</p>
          </div>
          <label class="region-picker" for="region-select">
            <span>Municipio</span>
            <select id="region-select" value={selectedRegion} on:change={onRegionChange} disabled={loadingRegions || loading}>
              {#each regions as region}
                <option value={region.slug}>{region.name}</option>
              {/each}
            </select>
          </label>
        </header>

        <div class="bubble-scene">
          <div class="bubble bubble-purple">
            <span>Temp media</span>
            <strong>{formatTemp(snapshot.temp_mean_c)}</strong>
          </div>
          <div class="bubble bubble-yellow">
            <span>Precipitacion</span>
            <strong>{formatPrecip(snapshot.precipitation_mm)}</strong>
          </div>
          <div class="bubble bubble-coral">
            <span>Humedad est.</span>
            <strong>{humidityEstimate != null ? `${humidityEstimate}%` : '--'}</strong>
          </div>
        </div>

        <div class="bubble-legend" aria-hidden="true">
          <span class="legend-line purple"></span>
          <span class="legend-line yellow"></span>
          <span class="legend-line coral"></span>
        </div>
      </article>

      <article class="card calendar-card">
        <header class="card-head">
          <div>
            <h2>Calendario de Alertas</h2>
            <p class="card-subtitle month-title">{monthTitle}</p>
          </div>
        </header>
        <div class="week-grid names">
          {#each DAY_NAMES as dayName}
            <span>{dayName}</span>
          {/each}
        </div>
        <div class="week-grid days">
          {#each calendarCells as cell}
            {#if cell}
              <div class={`day-cell ${cell.risk === HIGH_RISK_LABEL ? 'high' : ''} ${cell.risk === MEDIUM_RISK_LABEL ? 'medium' : ''} ${cell.isToday ? 'today' : ''}`}>
                <span>{cell.day}</span>
                {#if !cell.risk}
                  <i class="dot no-data"></i>
                {/if}
              </div>
            {:else}
              <div class="day-cell empty"></div>
            {/if}
          {/each}
        </div>
        <div class="calendar-legend">
          <span><i class="dot today"></i>hoy</span>
          <span><i class="dot high"></i>alto</span>
          <span><i class="dot medium"></i>medio</span>
          <span><i class="dot no-data"></i>sin datos</span>
        </div>
      </article>

      <section class="stacked-cards">
        <article class="card risk-progress-card">
          <h2>Riesgo Actual</h2>
          <div class="risk-progress" style={`--progress:${riskPercent};`}>
            <div class="risk-progress-inner">
              <strong>{riskPercent}%</strong>
            </div>
          </div>
          <p class="risk-lines">
            <span><strong>Global:</strong> {riskPercent}%</span>
            <span><strong>Meta:</strong> &lt;30%</span>
          </p>
        </article>

        <article class="card incidents-card">
          <h2>Dias Sin Incidentes</h2>
          <div class="incident-bar">
            {#each incidentSegments as segment}
              <span class={`segment ${segment ? (segment.alert ? 'alert' : 'ok') : 'empty'}`}></span>
            {/each}
          </div>
          <p class="incident-summary">{optimalDays}/30 dias optimos</p>
          {#if historyError}
            <p class="history-note">{historyError}</p>
          {/if}
        </article>
      </section>

      <article class="card protocols-card">
        <header class="card-head">
          <div>
            <h2>Mis Protocolos</h2>
            <p class="card-subtitle">Habitos recomendados este mes</p>
          </div>
        </header>
        <ul class="protocol-list">
          {#each protocols as protocol}
            <li>
              <div class="protocol-icon" aria-hidden="true">{protocol.icon}</div>
              <div class="protocol-copy">
                <p class="protocol-name">{protocol.name}</p>
                <p class="protocol-meta">Trainer: {protocol.trainer}</p>
                <p class="protocol-progress">Aplicado {protocol.applied} veces este mes · {protocol.progress}</p>
              </div>
            </li>
          {/each}
        </ul>
      </article>

      <article class="card explain-card">
        <header class="card-head">
          <div>
            <h2>Por qué Subió el Riesgo</h2>
            <p class="card-subtitle">Variables explicativas de los ultimos 7 dias</p>
          </div>
        </header>
        {#if riskExplain?.analysis}
          <div class="explain-block">
            <div class="explain-drivers">
              <div class="driver-item">
                <span class="driver-label">Driver principal</span>
                <span class="driver-value">{riskExplain.analysis.primary_driver}</span>
              </div>
              <div class="driver-item">
                <span class="driver-label">Precipitacion cambio</span>
                <span class="driver-value">{riskExplain.analysis.precip_change_mm > 0 ? '+' : ''}{riskExplain.analysis.precip_change_mm} mm vs semana anterior</span>
              </div>
              <div class="driver-item">
                <span class="driver-label">Dias con lluvia</span>
                <span class="driver-value">{riskExplain.analysis.rainy_days}</span>
              </div>
            </div>
            <div class="explain-recommendation">
              <span class="rec-label">Recomendacion</span>
              <p class="rec-text">{riskExplain.analysis.recommendation}</p>
            </div>
          </div>
        {:else}
          <p class="history-note">Cargando explicabilidad...</p>
        {/if}
      </article>

      <article class="card risk-mvp-card">
        <header class="card-head">
          <div>
            <h2>Vigilancia y Priorizacion de Riesgo</h2>
            <p class="card-subtitle">Modelo agroclimatico proxy (no diagnostico de plagas)</p>
          </div>
        </header>
        {#if monthlyLatest}
          <div class="mvp-kpis">
            <div>
              <span>Indice operativo-comercial</span>
              <strong>{formatScore(monthlyLatest.combined_score)}</strong>
            </div>
            <div>
              <span>Riesgo agroclimatico</span>
              <strong>{formatScore(monthlyLatest.agroclimatic_score)}</strong>
            </div>
            <div>
              <span>Dias con lluvia (mes)</span>
              <strong>{monthlyLatest.rainy_days}</strong>
            </div>
            <div>
              <span>Precio promedio (proxy)</span>
              <strong>
                {#if monthlyCommercial?.average_price_cop != null}
                  ${formatCurrency(monthlyCommercial.average_price_cop)} COP
                {:else}
                  Sin datos
                {/if}
              </strong>
            </div>
          </div>

          <p class="mvp-narrative">{monthlyNarrative}</p>

          <div class="mvp-months">
            {#each monthlyItems.slice(0, 4) as monthItem}
              <div class="mvp-month-chip">
                <span>{monthItem.month_label}</span>
                <strong>{String(monthItem.risk_level ?? 'bajo').toUpperCase()} · {formatScore(monthItem.combined_score)}</strong>
              </div>
            {/each}
          </div>
        {:else if monthlyRiskError}
          <p class="history-note">{monthlyRiskError}</p>
        {/if}
      </article>

      <article class="card data-inventory-card">
        <header class="card-head">
          <div>
            <h2>Datos Cargados en Frontend</h2>
            <p class="card-subtitle">Vista explicita de campos recibidos por API</p>
          </div>
        </header>

        <div class="data-grid">
          <div class="data-block">
            <h3>Snapshot diario</h3>
            <p><strong>region:</strong> {snapshot.region_name ?? '--'}</p>
            <p><strong>ciudad:</strong> {snapshot.region_city ?? '--'}</p>
            <p><strong>fecha:</strong> {formatDate(snapshot.observed_on)}</p>
            <p><strong>temp_mean_c:</strong> {snapshot.temp_mean_c ?? '--'}</p>
            <p><strong>precipitation_mm:</strong> {snapshot.precipitation_mm ?? '--'}</p>
            <p><strong>fungal_risk:</strong> {snapshot.fungal_risk ?? '--'}</p>
            <p><strong>waterlogging_risk:</strong> {snapshot.waterlogging_risk ?? '--'}</p>
            <p><strong>heat_risk:</strong> {snapshot.heat_risk ?? '--'}</p>
            <p><strong>global_risk_level:</strong> {snapshot.global_risk_level ?? '--'}</p>
            <p><strong>recommendation_title:</strong> {snapshot.recommendation_title ?? '--'}</p>
          </div>

          <div class="data-block">
            <h3>Riesgo mensual</h3>
            <p><strong>combined_score:</strong> {monthlyLatest?.combined_score ?? '--'}</p>
            <p><strong>agroclimatic_score:</strong> {monthlyLatest?.agroclimatic_score ?? '--'}</p>
            <p><strong>rainy_days:</strong> {monthlyLatest?.rainy_days ?? '--'}</p>
            <p><strong>temp_anomaly_c:</strong> {monthlyLatest?.temp_anomaly_c ?? '--'}</p>
            <p><strong>precip_anomaly_pct:</strong> {monthlyLatest?.precip_anomaly_pct ?? '--'}</p>
            <p><strong>risk_level:</strong> {monthlyLatest?.risk_level ?? '--'}</p>
            <p><strong>narrative:</strong> {monthlyNarrative || '--'}</p>
          </div>

          <div class="data-block">
            <h3>Comercial proxy</h3>
            <p><strong>average_price_cop:</strong> {monthlyCommercial?.average_price_cop ?? '--'}</p>
            <p><strong>volatility_pct:</strong> {monthlyCommercial?.volatility_pct ?? '--'}</p>
            <p><strong>concentration_pct:</strong> {monthlyCommercial?.concentration_pct ?? '--'}</p>
            <p><strong>commercial_risk_score:</strong> {monthlyCommercial?.commercial_risk_score ?? '--'}</p>
            <p><strong>last_update:</strong> {formatDate(monthlyCommercial?.last_update)}</p>
            <p><strong>stale:</strong> {monthlyCommercial?.stale == null ? '--' : String(monthlyCommercial.stale)}</p>
          </div>

          <div class="data-block">
            <h3>Alertas y recomendaciones</h3>
            <p><strong>alert.risk_level:</strong> {alertToday?.risk_level ?? '--'}</p>
            <p><strong>alert.agroclimatic_score:</strong> {alertToday?.agroclimatic_score ?? '--'}</p>
            <p><strong>alert.message:</strong> {alertToday?.message ?? '--'}</p>
            <p><strong>week.alto:</strong> {weeklyDistribution?.alto ?? '--'}</p>
            <p><strong>week.medio:</strong> {weeklyDistribution?.medio ?? '--'}</p>
            <p><strong>week.bajo:</strong> {weeklyDistribution?.bajo ?? '--'}</p>
            <p><strong>week.items:</strong> {weeklyItems.length}</p>
            {#if weeklyItems[0]}
              <p><strong>reciente:</strong> {formatDate(weeklyItems[0].observed_on)} · {weeklyItems[0].title}</p>
            {/if}
          </div>
        </div>

        {#if alertsTodayError || weeklyRecommendationsError}
          <p class="history-note">{alertsTodayError || weeklyRecommendationsError}</p>
        {/if}
      </article>
    </section>
  {/if}
</section>

<style>
  .dashboard {
    min-height: 420px;
  }

  .state {
    border-radius: 24px;
    padding: 2rem;
    text-align: center;
    background: var(--card-bg, #FFFFFF);
    border: 1px solid #EEE6DD;
  }

  .state p {
    margin: 0;
    color: var(--text-muted, #6B6B6B);
  }

  .state.error p {
    color: #B42318;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: 3fr 2fr;
    grid-template-areas:
      'status calendar'
      'stack protocols'
      'explain explain'
      'mvp mvp'
      'data data';
    gap: 1rem;
  }

  .card {
    background: var(--card-bg, #FFFFFF);
    border: 1px solid #ECE3DA;
    border-radius: 24px;
    padding: 1rem;
  }

  .status-card {
    grid-area: status;
    min-height: 320px;
  }

  .calendar-card {
    grid-area: calendar;
    background: #2A2240;
    border-color: #2A2240;
    color: #F8F4FF;
  }

  .stacked-cards {
    grid-area: stack;
    display: grid;
    gap: 1rem;
    grid-template-rows: repeat(2, minmax(0, 1fr));
  }

  .protocols-card {
    grid-area: protocols;
  }

  .risk-mvp-card {
    grid-area: mvp;
  }

  .explain-card {
    grid-area: explain;
  }

  .explain-block {
    margin-top: 0.85rem;
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1rem;
  }

  .explain-drivers {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .driver-item {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.5rem 0.65rem;
    background: #FAF7F3;
    border-radius: 10px;
  }

  .driver-label {
    font-size: 0.7rem;
    color: var(--text-muted, #6B6B6B);
  }

  .driver-value {
    font-size: 0.85rem;
    color: var(--text, #1A1A1A);
    font-weight: 500;
  }

  .explain-recommendation {
    background: linear-gradient(135deg, rgba(107, 63, 160, 0.12), rgba(127, 57, 251, 0.08));
    border: 1px solid rgba(107, 63, 160, 0.25);
    border-radius: 12px;
    padding: 0.75rem;
  }

  .rec-label {
    font-size: 0.7rem;
    color: var(--primary, #6B3FA0);
    font-weight: 600;
  }

  .rec-text {
    margin: 0.35rem 0 0;
    font-size: 0.85rem;
    color: var(--text, #1A1A1A);
    line-height: 1.4;
  }

  .data-inventory-card {
    grid-area: data;
  }

  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
  }

  h2 {
    margin: 0;
    font-size: 1rem;
    line-height: 1.2;
  }

  .card-subtitle {
    margin: 0.25rem 0 0;
    color: var(--text-muted, #6B6B6B);
    font-size: 0.82rem;
  }

  .month-title {
    color: #CDC0E0;
    text-transform: capitalize;
  }

  .region-picker {
    display: flex;
    flex-direction: column;
    gap: 0.22rem;
    color: var(--text-muted, #6B6B6B);
    font-size: 0.76rem;
  }

  .region-picker select {
    border: 1px solid #E4D8F2;
    border-radius: 10px;
    height: 34px;
    min-width: 150px;
    background: #F8F2FF;
    color: var(--text, #1A1A1A);
    font: inherit;
    padding: 0 0.6rem;
  }

  .bubble-scene {
    margin-top: 1rem;
    position: relative;
    min-height: 230px;
    border-radius: 22px;
    background: #FAF7F3;
    overflow: hidden;
  }

  .bubble-scene::after {
    content: '';
    position: absolute;
    inset: auto 16% 14% auto;
    width: 150px;
    height: 120px;
    border-radius: 50%;
    background: rgba(139, 95, 191, 0.2);
    filter: blur(30px);
  }

  .bubble {
    position: absolute;
    border-radius: 999px;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    box-shadow: 0 18px 28px rgba(0, 0, 0, 0.08);
    backdrop-filter: blur(2px);
  }

  .bubble span {
    font-size: 0.73rem;
    color: rgba(26, 26, 26, 0.85);
  }

  .bubble strong {
    font-size: 1.1rem;
    margin-top: 0.12rem;
  }

  .bubble-purple {
    width: 145px;
    height: 145px;
    top: 10px;
    left: 10px;
    background: rgba(107, 63, 160, 0.22);
    color: #4C2A76;
  }

  .bubble-yellow {
    width: 188px;
    height: 188px;
    right: 26px;
    top: 30px;
    background: rgba(255, 193, 7, 0.48);
    color: #6B4A00;
  }

  .bubble-coral {
    width: 130px;
    height: 130px;
    left: 170px;
    bottom: 18px;
    background: rgba(255, 107, 107, 0.45);
    color: #5E1F1F;
  }

  .bubble-legend {
    display: flex;
    gap: 0.55rem;
    margin-top: 0.9rem;
  }

  .legend-line {
    width: 34px;
    height: 6px;
    border-radius: 999px;
    display: block;
  }

  .legend-line.purple {
    background: var(--primary, #6B3FA0);
  }

  .legend-line.yellow {
    background: var(--accent-yellow, #FFC107);
  }

  .legend-line.coral {
    background: var(--accent-coral, #FF6B6B);
  }

  .week-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.35rem;
  }

  .week-grid.names {
    margin-top: 0.85rem;
    margin-bottom: 0.4rem;
    color: #B8AACC;
    font-size: 0.73rem;
    text-align: center;
  }

  .day-cell {
    height: 34px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    position: relative;
    font-size: 0.78rem;
    color: #DBD1EA;
    border: 1px solid transparent;
  }

  .day-cell.empty {
    border-radius: 0;
    height: 34px;
    background: transparent;
  }

  .day-cell.high {
    background: var(--accent-coral, #FF6B6B);
    color: #1A1A1A;
  }

  .day-cell.medium {
    background: var(--primary, #6B3FA0);
    color: #F8F3FF;
  }

  .day-cell.today {
    border-color: #FFFFFF;
  }

  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #BFBFBF;
  }

  .day-cell .dot {
    position: absolute;
    bottom: 4px;
  }

  .dot.today {
    background: transparent;
    border: 1.5px solid #FFFFFF;
  }

  .dot.high {
    background: var(--accent-coral, #FF6B6B);
  }

  .dot.medium {
    background: var(--primary, #6B3FA0);
  }

  .dot.no-data {
    background: #8C849A;
  }

  .calendar-legend {
    margin-top: 0.85rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
    font-size: 0.73rem;
    color: #D8CDE7;
  }

  .calendar-legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .risk-progress-card,
  .incidents-card {
    display: flex;
    flex-direction: column;
  }

  .risk-progress {
    width: 126px;
    height: 126px;
    margin: 0.9rem auto 0.7rem;
    border-radius: 50%;
    background: conic-gradient(
      var(--primary, #6B3FA0) calc(var(--progress, 0) * 1%),
      #E8E0F0 calc(var(--progress, 0) * 1%)
    );
    display: grid;
    place-items: center;
  }

  .risk-progress-inner {
    width: 92px;
    height: 92px;
    border-radius: 50%;
    background: #FFFFFF;
    display: grid;
    place-items: center;
    color: var(--text, #1A1A1A);
    font-size: 1.2rem;
  }

  .risk-lines {
    margin: 0;
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: 0.9rem;
    color: var(--text-muted, #6B6B6B);
  }

  .risk-lines strong {
    color: var(--text, #1A1A1A);
  }

  .incident-bar {
    margin-top: 0.9rem;
    display: grid;
    grid-template-columns: repeat(30, minmax(0, 1fr));
    gap: 0.2rem;
  }

  .segment {
    height: 10px;
    border-radius: 999px;
    background: #EEE7DF;
  }

  .segment.ok {
    background: #4CAF50;
  }

  .segment.alert {
    background: var(--accent-coral, #FF6B6B);
  }

  .segment.empty {
    background: #EEE7DF;
  }

  .incident-summary {
    margin: 0.75rem 0 0;
    font-weight: 600;
    color: var(--text, #1A1A1A);
  }

  .history-note {
    margin: 0.4rem 0 0;
    font-size: 0.78rem;
    color: var(--text-muted, #6B6B6B);
  }

  .protocol-list {
    margin: 0.95rem 0 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .protocol-list li {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    border: 1px solid #EFE7DE;
    border-radius: 16px;
    padding: 0.65rem;
  }

  .protocol-icon {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    background: #F5EEF9;
    color: var(--primary, #6B3FA0);
    display: grid;
    place-items: center;
    font-size: 0.92rem;
    flex-shrink: 0;
  }

  .protocol-copy p {
    margin: 0;
  }

  .protocol-name {
    font-weight: 600;
    color: var(--text, #1A1A1A);
    font-size: 0.92rem;
  }

  .protocol-meta {
    margin-top: 0.12rem;
    color: var(--text-muted, #6B6B6B);
    font-size: 0.76rem;
  }

  .protocol-progress {
    margin-top: 0.25rem;
    color: var(--primary, #6B3FA0);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .mvp-kpis {
    margin-top: 0.85rem;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .mvp-kpis > div {
    border: 1px solid #EFE7DE;
    border-radius: 14px;
    padding: 0.65rem;
    background: #FAF7F3;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .mvp-kpis span {
    font-size: 0.75rem;
    color: var(--text-muted, #6B6B6B);
  }

  .mvp-kpis strong {
    font-size: 0.95rem;
    color: var(--text, #1A1A1A);
  }

  .mvp-narrative {
    margin: 0.85rem 0 0;
    padding: 0.75rem 0.85rem;
    border-radius: 14px;
    background: #F6F1FA;
    color: #4E3B6B;
    font-size: 0.88rem;
    line-height: 1.45;
  }

  .mvp-months {
    margin-top: 0.8rem;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .mvp-month-chip {
    border: 1px solid #EFE7DE;
    border-radius: 12px;
    padding: 0.55rem 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.22rem;
  }

  .mvp-month-chip span {
    font-size: 0.74rem;
    color: var(--text-muted, #6B6B6B);
  }

  .mvp-month-chip strong {
    font-size: 0.82rem;
    color: var(--primary, #6B3FA0);
  }

  .data-grid {
    margin-top: 0.9rem;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.7rem;
  }

  .data-block {
    border: 1px solid #EFE7DE;
    border-radius: 14px;
    padding: 0.7rem;
    background: #FCFAF8;
  }

  .data-block h3 {
    margin: 0 0 0.5rem;
    font-size: 0.86rem;
    color: var(--primary, #6B3FA0);
  }

  .data-block p {
    margin: 0.18rem 0;
    font-size: 0.78rem;
    color: var(--text-muted, #6B6B6B);
    line-height: 1.4;
  }

  .data-block p strong {
    color: var(--text, #1A1A1A);
  }

  @media (max-width: 980px) {
    .dashboard-grid {
      grid-template-columns: 1fr;
      grid-template-areas:
        'status'
        'calendar'
        'stack'
        'protocols'
        'explain'
        'mvp'
        'data';
    }

    .explain-block {
      grid-template-columns: 1fr;
    }

    .bubble-coral {
      left: 140px;
    }

    .mvp-kpis,
    .mvp-months {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .card {
      border-radius: 20px;
      padding: 0.9rem;
    }

    .card-head {
      flex-direction: column;
      align-items: stretch;
    }

    .region-picker select {
      min-width: 100%;
    }

    .bubble-purple {
      width: 128px;
      height: 128px;
      left: 12px;
      top: 18px;
    }

    .bubble-yellow {
      width: 152px;
      height: 152px;
      top: 30px;
      right: 14px;
    }

    .bubble-coral {
      width: 116px;
      height: 116px;
      left: 100px;
      bottom: 14px;
    }

    .mvp-kpis,
    .mvp-months {
      grid-template-columns: 1fr;
    }

    .data-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
