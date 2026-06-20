import {
  computeRiskFromWeather, computeOperativoStatus, scoreFromSignals,
  statusLabelFromScore, aggregateMonthly, simulateTomorrow, toNum,
  fetchOpenMeteoForecast,
} from '../engine.js';

const responseCache = new Map();
const inflightCache = new Map();

const cloneData = (value) => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

// ─── Local data store ───

let _localCache = {};
const getLocal = async (name) => {
  if (_localCache[name]) return _localCache[name];
  const resp = await fetch(`/data/${name}.json`);
  if (!resp.ok) throw new Error(`Failed to load ${name}.json`);
  _localCache[name] = await resp.json();
  return _localCache[name];
};

const getRegionBySlug = async (slug) => {
  const regions = await getLocal('regions');
  return regions.find((r) => r.slug === slug) || null;
};

const getHistoryForRegion = async (slug, limit = 120) => {
  const all = await getLocal('weather');
  const filtered = all.filter((w) => w.region_slug === slug);
  const sorted = filtered.sort((a, b) => String(b.observed_on).localeCompare(String(a.observed_on)));
  return sorted.slice(0, limit);
};

const tryFetchTodayForecast = async (lat, lon) => {
  try {
    const forecast = await fetchOpenMeteoForecast(lat, lon);
    const risk = computeRiskFromWeather(forecast.temp_mean_c, forecast.precipitation_mm);
    const today = new Date().toISOString().slice(0, 10);
    return {
      region_slug: '',
      observed_on: today,
      temp_mean_c: forecast.temp_mean_c,
      temp_max_c: forecast.temp_max_c,
      temp_min_c: forecast.temp_min_c,
      precipitation_mm: forecast.precipitation_mm,
      fungal_risk: risk.fungal,
      waterlogging_risk: risk.water,
      heat_risk: risk.heat,
      global_risk_level: risk.level,
      recommendation_title: risk.title,
      recommendation_message: risk.message,
      _live: true,
    };
  } catch {
    return null;
  }
};

const buildHistoryWithLive = async (slug, limit) => {
  const history = await getHistoryForRegion(slug, limit);
  if (history.length === 0) return [];

  const region = await getRegionBySlug(slug);
  if (!region) return history;

  const today = history[0];
  if (today && today.observed_on === new Date().toISOString().slice(0, 10)) {
    return history; // Already have today
  }

  // Try to fetch live today data
  const live = await tryFetchTodayForecast(region.latitude, region.longitude);
  if (live) {
    live.region_slug = slug;
    return [live, ...history];
  }
  return history;
};

// ─── API Router ───

const parseQuery = (search) => {
  const params = new URLSearchParams(search);
  const obj = {};
  for (const [key, value] of params) obj[key] = value;
  return obj;
};

const apiHandlers = {

  '/api/regions': async () => {
    const items = await getLocal('regions');
    return { ok: true, default_region: 'madrid', items };
  },

  '/api/municipalities': async () => {
    const items = await getLocal('regions');
    return { ok: true, items, total: items.length };
  },

  '/api/municipalities/compare': async () => {
    const regions = await getLocal('regions');
    const profiles = await getLocal('municipality_profiles');
    const weather = await getLocal('weather');

    const latestByRegion = {};
    for (const w of weather) {
      if (!latestByRegion[w.region_slug] || w.observed_on > latestByRegion[w.region_slug].observed_on) {
        latestByRegion[w.region_slug] = w;
      }
    }

    const totalArea = regions.reduce((s, r) => s + (r.flower_area_ha || 0), 0);
    const totalWorkers = regions.reduce((s, r) => s + (r.workers || 0), 0);

    const items = regions.map((r) => {
      const latest = latestByRegion[r.slug] || {};
      const profile = profiles.find((p) => p.region_slug === r.slug);
      const score = scoreFromSignals(latest.fungal_risk, latest.waterlogging_risk, latest.heat_risk);
      return {
        slug: r.slug,
        name: r.name,
        city: r.city,
        production_share: r.production_share || 0,
        area_ha: profile?.flower_area_ha || r.flower_area_ha || 0,
        workers: profile?.workers || r.workers || 0,
        fungal_risk: latest.fungal_risk ?? null,
        waterlogging_risk: latest.waterlogging_risk ?? null,
        heat_risk: latest.heat_risk ?? null,
        risk_score: score,
      };
    });

    return {
      ok: true,
      items,
      totals: { area_ha: totalArea, workers: totalWorkers },
    };
  },

  '/api/municipalities/:slug': async (_, slug) => {
    const r = await getRegionBySlug(slug);
    if (!r) throw new Error(`Municipio '${slug}' no encontrado`);
    const profiles = await getLocal('municipality_profiles');
    const profile = profiles.find((p) => p.region_slug === slug);
    return {
      ok: true,
      item: { slug: r.slug, name: r.name, flower_area_ha: profile?.flower_area_ha || r.flower_area_ha, workers: profile?.workers || r.workers },
    };
  },

  '/api/dashboard': async (params) => {
    const slug = params.region || 'madrid';
    const history = await buildHistoryWithLive(slug, 1);
    if (history.length === 0) throw new Error(`No data for region '${slug}'`);
    const latest = history[0];
    const region = await getRegionBySlug(slug);
    return {
      ok: true,
      region: slug,
      snapshot: {
        region_name: region?.name || slug,
        observed_on: latest.observed_on,
        temp_mean_c: latest.temp_mean_c,
        precipitation_mm: latest.precipitation_mm,
        fungal_risk: latest.fungal_risk,
        waterlogging_risk: latest.waterlogging_risk,
        heat_risk: latest.heat_risk,
        recommendation_title: latest.recommendation_title,
        recommendation_message: latest.recommendation_message,
      },
    };
  },

  '/api/history': async (params) => {
    const slug = params.region || 'madrid';
    const limit = parseInt(params.limit, 10) || 30;
    const history = await buildHistoryWithLive(slug, limit);
    return { ok: true, region: slug, items: history };
  },

  '/api/risk/operativo': async (params) => {
    const slug = params.region || 'madrid';
    const history = await buildHistoryWithLive(slug, 7);
    if (history.length === 0) {
      return { ok: true, region: slug, status: 'sin_datos', status_label: 'Sin datos disponibles', score: null, reason: 'No hay datos climaticos suficientes.', action_today: 'Consulta mas tarde.', trend_7d: null, confidence: 'baja', attention: null, details: {} };
    }
    const op = computeOperativoStatus(history);
    return {
      ok: true,
      region: slug,
      status: op.status,
      status_label: op.status_label,
      score: op.score,
      reason: op.reason,
      action_today: op.action_today,
      trend_7d: op.trend_7d,
      confidence: op.confidence,
      attention: op.score >= 70 ? 'Si no actuas, la presion fungal puede elevarse en 48h.' : op.score >= 40 ? 'Si se acumulan 2-3 dias mas de lluvia, el nivel podria pasar a Accion requerida.' : 'Condiciones estables. Sin senal critica.',
      details: {
        rainy_days: op.rainy_days,
        days_with_precip: op.days_with_precip,
        avg_temp: op.avg_temp,
        avg_precip: op.avg_precip,
        days_available: op.days_available,
      },
    };
  },

  '/api/risk/monthly': async (params) => {
    const slug = params.region || 'madrid';
    const months = parseInt(params.months, 10) || 6;
    const history = await getHistoryForRegion(slug, 120);
    const region = await getRegionBySlug(slug);
    const items = aggregateMonthly(history, months);
    const latest = items[0] || null;

    return {
      ok: true,
      region: slug,
      region_name: region?.name || slug,
      months,
      latest,
      items,
      commercial: { commercial_risk_score: null },
      narrative: latest ? { summary: `En ${region?.name || slug} el riesgo agroclimatico esta en nivel ${latest.risk_level}.`, details: `Mes ${latest.month_label} con puntaje combinado ${latest.combined_score}.` } : { summary: 'Datos no disponibles.', details: '' },
      model_context: { name: 'flowerxi-agroclimatic-proxy-v1', scope: 'vigilancia y priorizacion de riesgo', note: 'No corresponde a diagnostico real de plagas por finca.' },
    };
  },

  '/api/risk/explain': async (params) => {
    const slug = params.region || 'madrid';
    const history = await getHistoryForRegion(slug, 7);
    if (history.length === 0) throw new Error(`No hay datos para explicar riesgo en '${slug}'`);

    const avgPrecip = history.reduce((s, d) => s + (d.precipitation_mm || 0), 0) / history.length;
    const avgTemp = history.reduce((s, d) => s + (d.temp_mean_c || 0), 0) / history.length;
    const rainyDays = history.filter((d) => (d.precipitation_mm || 0) >= 4).length;

    let primaryDriver = 'Condiciones dentro de rangos normales';
    if (rainyDays >= 4) primaryDriver = 'Alta precipitacion acumulada (>=4 dias con lluvia)';
    else if (avgTemp <= 12) primaryDriver = 'Temperaturas bajas favorecen humedad relativa alta';
    else if (avgTemp >= 22) primaryDriver = 'Temperaturas elevadas aumentan estres hidrico';

    let recommendation = 'Mantener protocolo habitual de vigilancia';
    if (rainyDays >= 4) recommendation = 'Revisar drenajes, aplicar fungicida preventivo, intensificar monitoreo fitosanitario';
    else if (avgTemp <= 12) recommendation = 'Controlar humedad, evitar condensacion en invernadero';
    else if (avgTemp >= 22) recommendation = 'Aumentar riego por goteo, sombra temporal si aplica';

    return {
      ok: true,
      region: slug,
      analysis: {
        period: 'ultimos 7 dias',
        avg_precip_mm: Math.round(avgPrecip * 10) / 10,
        avg_temp_c: Math.round(avgTemp * 10) / 10,
        rainy_days: rainyDays,
        precip_change_mm: null,
        primary_driver: primaryDriver,
        recommendation,
      },
    };
  },

  '/api/recommendations/week': async (params) => {
    const slug = params.region || 'madrid';
    const days = parseInt(params.days, 10) || 7;
    const history = await getHistoryForRegion(slug, days);

    const levelCounts = { alto: 0, medio: 0, bajo: 0 };
    for (const item of history) {
      const level = String(item.global_risk_level || 'bajo').toLowerCase();
      if (level in levelCounts) levelCounts[level]++;
    }

    return {
      ok: true,
      region: slug,
      days,
      risk_distribution: levelCounts,
      items: history.map((h) => ({
        title: h.recommendation_title,
        message: h.recommendation_message,
        global_risk_level: h.global_risk_level,
        fungal_risk: h.fungal_risk,
        waterlogging_risk: h.waterlogging_risk,
        heat_risk: h.heat_risk,
      })),
    };
  },

  '/api/stations': async (params) => {
    const slug = params.region || 'madrid';
    const stations = await getLocal('stations');
    const byRegion = stations.filter((s) => s.region_slug === slug);
    return { ok: true, region: slug, items: byRegion.length > 0 ? byRegion : stations, total: stations.length, fallback: byRegion.length === 0 };
  },

  '/api/exports': async (params) => {
    const months = parseInt(params.months, 10) || 12;
    const exports = await getLocal('exports');
    const limited = exports.slice(0, months * 10);

    const byMonth = {};
    for (const row of limited) {
      const m = row.year_month;
      if (!byMonth[m]) byMonth[m] = { fob_usd: 0, net_tons: 0 };
      byMonth[m].fob_usd += row.fob_usd;
      byMonth[m].net_tons += row.net_tons;
    }
    const totalFob = Object.values(byMonth).reduce((s, m) => s + m.fob_usd, 0);
    const totalNet = Object.values(byMonth).reduce((s, m) => s + m.net_tons, 0);

    return {
      ok: true,
      items: limited,
      summary: {
        total_fob_usd: totalFob,
        total_net_tons: totalNet,
        avg_price_per_kg: totalNet > 0 ? totalFob / (totalNet * 1000) : 0,
        months_count: Object.keys(byMonth).length,
      },
      by_month: byMonth,
    };
  },

};

const resolveApiPath = (path) => {
  // Match exact paths first, then parameterized
  const cleanPath = path.split('?')[0].replace(/\/+$/, '');
  const handlers = Object.keys(apiHandlers);
  const exact = handlers.find((h) => !h.includes(':') && h === cleanPath);
  if (exact) return { handler: apiHandlers[exact], slug: null };

  // Check parameterized routes
  for (const h of handlers) {
    if (!h.includes(':')) continue;
    const pattern = h.replace(/:slug/, '([^/]+)');
    const match = cleanPath.match(new RegExp(`^${pattern}$`));
    if (match) return { handler: apiHandlers[h], slug: match[1] };
  }
  return null;
};

// ─── Modified fetchJsonCached ───

export const fetchJsonCached = async (path, options = {}) => {
  const { apiUrl = '', init = undefined, cacheTtlMs = 12_000, timeoutMs = 12_000, throwOnError = true, bypassCache = false, cacheKey = '' } = options;

  const method = String(init?.method || 'GET').toUpperCase();
  const effectiveTtl = method === 'GET' ? cacheTtlMs : 0;
  const globalForceFresh = typeof window !== 'undefined' && Number(window.__flowerxiForceFreshUntil || 0) > Date.now();
  const skipCache = bypassCache || globalForceFresh;
  const key = cacheKey || `local|${method}|${path}`;

  if (!skipCache && effectiveTtl > 0) {
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cloneData(cached.data);
  }

  if (!skipCache && inflightCache.has(key)) return cloneData(await inflightCache.get(key));

  const requestPromise = (async () => {
    // Try local handler first for /api/ paths
    if (path.startsWith('/api/') || path.startsWith('api/')) {
      const cleanPath = path.replace(/^\/?(api\/.*?)(\?.*)?$/, '$1');
      const search = path.includes('?') ? path.slice(path.indexOf('?')) : '';
      const params = parseQuery(search);
      const body = init?.body ? (() => { try { return JSON.parse(init.body); } catch { return {}; } })() : {};

      const matched = resolveApiPath(`/api/${cleanPath.replace(/^api\//, '')}`);
      if (!matched && path.includes('/api/alerts/simulate')) {
        // Handle simulate POST
        const slug = body.region || params.region || 'madrid';
        try {
          const history = await buildHistoryWithLive(slug, 7);
          const op = computeOperativoStatus(history);
          const latest = history[0] || {};
          const sim = simulateTomorrow(latest, op);
          if (sim) return { ok: true, region: slug, ...sim };
        } catch {}
        return { ok: true, region: slug, alert: 'Datos no disponibles', action: 'No se pudo simular la alerta.', confidence: 0.3, score_today: null, score_tomorrow: null, delta: null };
      }

      if (matched) {
        try {
          const data = await matched.handler(params, matched.slug || body.slug || params.slug);
          if (effectiveTtl > 0) responseCache.set(key, { data, expiresAt: Date.now() + effectiveTtl });
          return data;
        } catch (err) {
          if (throwOnError) throw err;
          return null;
        }
      }
    }

    // Fallback to actual HTTP request (unlikely to be used now)
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
        }
      }
      candidates.push('');
      return [...new Set(candidates)];
    };

    const endpoint = (base, p) => {
      if (!base) return p;
      if (base.endsWith('/api') && p.startsWith('/api/')) return `${base}${p.slice(4)}`;
      return `${base}${p}`;
    };

    const apiBases = buildApiBases(apiUrl);
    let lastError = null;
    for (const base of apiBases) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(endpoint(base, path), {
          headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
          ...init,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) { lastError = new Error(`HTTP ${res.status}`); continue; }
        const data = await res.json();
        if (effectiveTtl > 0) responseCache.set(key, { data, expiresAt: Date.now() + effectiveTtl });
        return data;
      } catch (err) { clearTimeout(timer); lastError = err instanceof Error ? err : new Error('network'); }
    }
    throw lastError || new Error('network');
  })();

  if (!skipCache) inflightCache.set(key, requestPromise);
  try { return cloneData(await requestPromise); }
  catch (err) { if (throwOnError) throw err; return null; }
  finally { if (!skipCache) inflightCache.delete(key); }
};

export const clearApiCache = () => {
  _localCache = {};
  responseCache.clear();
  inflightCache.clear();
};
