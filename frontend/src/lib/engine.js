export const clamp = (value, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(value)));

export const riskLevelFromFactors = (fungal, water, heat) => {
  const maxRisk = Math.max(fungal, water, heat);
  if (maxRisk >= 70) return 'alto';
  if (maxRisk >= 40) return 'medio';
  return 'bajo';
};

export const recommendationFromFactors = (fungal, water, heat) => {
  if (fungal >= Math.max(water, heat)) {
    return {
      title: 'Control fungico en rosa',
      message: 'Aumenta ventilacion, evita mojado nocturno y refuerza monitoreo preventivo para botrytis en boton floral.',
    };
  }
  if (water >= Math.max(fungal, heat)) {
    return {
      title: 'Drenaje prioritario',
      message: 'Ajusta drenajes y camas para evitar encharcamientos que afecten tallo, vida en florero y calidad de corte.',
    };
  }
  return {
    title: 'Manejo termico de invernadero',
    message: 'Refuerza sombra en horas pico y calibra riego temprano para proteger calibre, color y firmeza de petalo.',
  };
};

export const computeRiskFromWeather = (tempMean, precip) => {
  const fungal = clamp((precip * 7.0) + Math.max(0.0, 19.0 - tempMean) * 2.2);
  const water = clamp(precip * 9.0);
  const heat = clamp(Math.max(0.0, tempMean - 20.0) * 12.0);
  const level = riskLevelFromFactors(fungal, water, heat);
  const rec = recommendationFromFactors(fungal, water, heat);
  return { fungal, water, heat, level, ...rec };
};

export const scoreFromSignals = (fungal, water, heat) => {
  if (![fungal, water, heat].every(Number.isFinite)) return null;
  return Math.round(fungal * 0.5 + water * 0.3 + heat * 0.2);
};

export const statusFromScore = (score) => {
  if (score === null || score === undefined) return 'sin_datos';
  if (score >= 70) return 'accion';
  if (score >= 40) return 'vigilancia';
  return 'rutina';
};

export const statusLabelFromScore = (score) => {
  if (score === null || score === undefined) return 'Sin datos';
  if (score >= 70) return 'Accion requerida';
  if (score >= 40) return 'Vigilancia reforzada';
  return 'Rutina normal';
};

export const levelFromScore = (score) => {
  if (score === null || score === undefined) return { text: 'SIN DATOS', cls: 'sin-datos' };
  if (score >= 70) return { text: 'ALTO', cls: 'alto' };
  if (score >= 40) return { text: 'MEDIO', cls: 'medio' };
  return { text: 'BAJO', cls: 'bajo' };
};

export const buildOperativoReason = (rainyDays, avgTemp, avgPrecip) => {
  if (rainyDays >= 5) return 'Acumulacion critica de lluvia (5+ dias)';
  if (rainyDays >= 3 && avgTemp >= 15 && avgTemp <= 22) return 'Humedad + temperatura templada = riesgo fungal elevado';
  if (rainyDays >= 3 && avgTemp < 12) return 'Frio + humedad = estres para las plantas';
  if (rainyDays >= 3 && avgTemp >= 22) return 'Lluvia + calor = condiciones favorables para hongos';
  if (avgTemp > 28) return 'Temperatura muy alta (>28°C) - estres termico';
  if (avgTemp < 8) return 'Temperatura muy baja (<8°C) - riesgo de frio';
  if (avgTemp <= 12 && rainyDays >= 2) return 'Temperatura baja + humedad = vigilancia por hongos';
  return 'Condiciones dentro de rangos normales';
};

export const buildActionToday = (rainyDays, avgTemp, avgPrecip) => {
  if (rainyDays >= 5) return 'Aplicar fungicida inmediatamente + revisar sistema de drenaje. Registra inspeccion.';
  if (rainyDays >= 3 && avgTemp >= 15 && avgTemp <= 22) return 'Inspeccion fitosanitaria prioritaria hoy. Aumenta ventilacion 20 min extra.';
  if (rainyDays >= 3 && avgTemp < 12) return 'Revisa calefaccion o proteccion anticongelante. Controla condensacion.';
  if (rainyDays >= 3 && avgTemp >= 22) return 'Aumenta ventilacion y revisa sombreado. Monitorea estres hidrico.';
  if (avgTemp > 28) return 'Activa sombreado de emergencia. Aumenta riego por goteo.';
  if (avgTemp < 8) return 'Activa proteccion anticongelante. Revisa estado de plantas sensibles.';
  if (avgTemp <= 12 && rainyDays >= 2) return 'Aumenta ventilacion para reducir condensacion. Controla humedad.';
  return 'Manten rutina habitual. Revisa humedad del suelo.';
};

export const getConfidence = (daysAvailable) => {
  if (daysAvailable >= 7) return 'alta';
  if (daysAvailable >= 4) return 'media';
  return 'baja';
};

export const getConfidencePct = (rawConfidence, historyDays) => {
  const value = String(rawConfidence || '').toLowerCase();
  if (value === 'alta') return 78;
  if (value === 'media') return 64;
  if (value === 'baja') return 52;
  if (historyDays >= 14) return 78;
  if (historyDays >= 7) return 64;
  if (historyDays > 0) return 52;
  return null;
};

export const computeOperativoStatus = (historyDays) => {
  const rainyDays = historyDays.filter((d) => (d.precipitation_mm || 0) >= 4).length;
  const daysWithPrecip = historyDays.filter((d) => (d.precipitation_mm || 0) > 0).length;
  const avgTemp = historyDays.reduce((s, d) => s + (d.temp_mean_c || 0), 0) / Math.max(historyDays.length, 1);
  const avgPrecip = historyDays.reduce((s, d) => s + (d.precipitation_mm || 0), 0) / Math.max(historyDays.length, 1);
  const daysAvailable = historyDays.length;

  let score = 22;
  if (rainyDays >= 5) score = 85;
  else if (rainyDays >= 4) score = 72;
  else if (rainyDays >= 3 && avgTemp >= 15 && avgTemp <= 22) score = 68;
  else if (rainyDays >= 3 && avgTemp < 12) score = 55;
  else if (avgTemp > 28) score = 78;
  else if (avgTemp < 8) score = 45;
  else if (avgTemp <= 12 && rainyDays >= 2) score = 52;
  else if (avgTemp >= 22 && daysWithPrecip > 0) score = 48;
  else score = 22;

  const status = statusFromScore(score);
  const statusLabel = statusLabelFromScore(score);
  const reason = buildOperativoReason(rainyDays, avgTemp, avgPrecip);
  const actionToday = buildActionToday(rainyDays, avgTemp, avgPrecip);
  const confidence = getConfidence(daysAvailable);

  let trend = 'stable';
  if (historyDays.length >= 7) {
    const recent = historyDays.slice(0, 3).reduce((s, d) => s + (d.precipitation_mm || 0), 0);
    const older = historyDays.slice(3, 7).reduce((s, d) => s + (d.precipitation_mm || 0), 0);
    if (recent > older * 1.15) trend = 'up';
    else if (recent < older * 0.85) trend = 'down';
  }

  return {
    score,
    status,
    status_label: statusLabel,
    reason,
    action_today: actionToday,
    confidence,
    trend_7d: trend,
    rainy_days: rainyDays,
    days_with_precip: daysWithPrecip,
    avg_temp: avgTemp,
    avg_precip: avgPrecip,
    days_available: daysAvailable,
  };
};

export const simulateTomorrow = (today, operativo) => {
  const score = Number.isFinite(today?.score) ? today.score : scoreFromSignals(today?.fungal_risk, today?.waterlogging_risk, today?.heat_risk);
  if (score === null) return null;
  const temp = today?.temp_mean_c || 0;
  const precip = today?.precipitation_mm || 0;
  const trend = operativo?.trend_7d || 'stable';

  let tomorrowScore = score;
  if (precip >= 4) tomorrowScore += 14;
  else if (precip > 0) tomorrowScore += 8;
  if (temp < 12) tomorrowScore += 6;
  else if (temp > 26) tomorrowScore += 8;
  if (trend === 'up') tomorrowScore += 6;
  else if (trend === 'down') tomorrowScore -= 4;
  tomorrowScore = Math.max(12, Math.min(95, Math.round(tomorrowScore)));

  const nextLevel = levelFromScore(tomorrowScore);
  const action = tomorrowScore >= 70
    ? 'Revisar drenaje hoy antes de las 10am y dejar registro fitosanitario.'
    : tomorrowScore >= 40
    ? 'Reforzar vigilancia de humedad y ventilacion durante la manana.'
    : 'Mantener rutina normal y revisar nuevamente en 24h.';

  return {
    alert: `Riesgo ${nextLevel.text.toLowerCase()} manana`,
    action,
    confidence: 0.52 + (operativo?.confidence === 'alta' ? 0.26 : operativo?.confidence === 'media' ? 0.12 : 0),
    score_today: score,
    score_tomorrow: tomorrowScore,
    delta: tomorrowScore - score,
  };
};

export const aggregateMonthly = (historyDays, months = 12) => {
  const byMonth = new Map();
  const sorted = [...historyDays].sort((a, b) => String(a.observed_on).localeCompare(String(b.observed_on)));
  for (const day of sorted) {
    const monthKey = String(day.observed_on || '').slice(0, 7);
    if (!monthKey || monthKey.length < 7) continue;
    const score = scoreFromSignals(day.fungal_risk, day.waterlogging_risk, day.heat_risk);
    if (score === null) continue;
    const bucket = byMonth.get(monthKey) || [];
    bucket.push({ ...day, computedScore: score });
    byMonth.set(monthKey, bucket);
  }

  return Array.from(byMonth.entries())
    .slice(-months)
    .map(([month, days]) => {
      const sampleDays = days.length;
      const rainyDays = days.filter((d) => (d.precipitation_mm || 0) > 0).length;
      const avgScore = Math.round(days.reduce((s, d) => s + d.computedScore, 0) / sampleDays);
      const fungal = days.reduce((s, d) => s + (d.fungal_risk || 0), 0) / sampleDays;
      const water = days.reduce((s, d) => s + (d.waterlogging_risk || 0), 0) / sampleDays;
      const heat = days.reduce((s, d) => s + (d.heat_risk || 0), 0) / sampleDays;
      const level = levelFromScore(avgScore);
      return {
        month_label: month,
        sample_days: sampleDays,
        rainy_days: rainyDays,
        rainy_ratio_pct: Number(((rainyDays / sampleDays) * 100).toFixed(1)),
        avg_fungal_risk: Number(fungal.toFixed(1)),
        avg_waterlogging_risk: Number(water.toFixed(1)),
        avg_heat_risk: Number(heat.toFixed(1)),
        combined_score: avgScore,
        risk_level: level.text.toLowerCase(),
        label: level.text,
        levelClass: level.cls,
      };
    })
    .reverse();
};

export const fetchOpenMeteoForecast = async (latitude, longitude) => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=America%2FBogota&forecast_days=1`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Open-Meteo HTTP ${resp.status}`);
  const data = await resp.json();
  const daily = data.daily || {};
  const tempMean = daily.temperature_2m_mean?.[0];
  const tempMax = daily.temperature_2m_max?.[0];
  const tempMin = daily.temperature_2m_min?.[0];
  const precip = daily.precipitation_sum?.[0];
  if (tempMean == null || tempMax == null || tempMin == null || precip == null) {
    throw new Error('Incomplete Open-Meteo forecast response');
  }
  return {
    temp_mean_c: tempMean,
    temp_max_c: tempMax,
    temp_min_c: tempMin,
    precipitation_mm: precip,
  };
};

export const toNum = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
