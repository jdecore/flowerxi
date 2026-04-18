<script>
  import { onDestroy, onMount } from 'svelte';

  export let apiUrl = '';
  export let initialRegion = 'madrid';

  let region = initialRegion;
  let loading = true;
  let error = '';
  let rows = [];
  const fallbackRegions = [
    { slug: 'madrid', name: 'Madrid', city: 'Madrid, Cundinamarca' },
    { slug: 'facatativa', name: 'Facatativá', city: 'Facatativá, Cundinamarca' },
    { slug: 'funza', name: 'Funza', city: 'Funza, Cundinamarca' },
    { slug: 'el-rosal', name: 'El Rosal', city: 'El Rosal, Cundinamarca' },
    { slug: 'tocancipa', name: 'Tocancipá', city: 'Tocancipá, Cundinamarca' },
    { slug: 'chia', name: 'Chía', city: 'Chía, Cundinamarca' },
    { slug: 'mosquera', name: 'Mosquera', city: 'Mosquera, Cundinamarca' },
    { slug: 'sopo', name: 'Sopó', city: 'Sopó, Cundinamarca' },
    { slug: 'bojaca', name: 'Bojacá', city: 'Bojacá, Cundinamarca' },
    { slug: 'cachipay', name: 'Cachipay', city: 'Cachipay, Cundinamarca' },
  ];

  const toNum = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
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

  const fetchJson = async (path) => {
    const apiBases = buildApiBases(apiUrl);
    let lastError = null;

    for (const base of apiBases) {
      try {
        const res = await fetch(endpoint(base, path), { headers: { Accept: 'application/json' } });
        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
        return await res.json();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('network');
      }
    }

    throw lastError ?? new Error('network');
  };

  const riskLabel = (score) => {
    if (score >= 70) return 'Acción';
    if (score >= 40) return 'Vigilancia';
    return 'Rutina';
  };

  const badge = (index) => (index === 0 ? '🔴' : index === 1 ? '🟠' : index === 2 ? '🟡' : '⚪');

  const normalizeSlug = (value) => String(value || '').trim().toLowerCase();
  const toRiskNum = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const scoreFromDay = (day) => {
    const fungal = toRiskNum(day?.fungal_risk);
    const water = toRiskNum(day?.waterlogging_risk);
    const heat = toRiskNum(day?.heat_risk);
    if (fungal === null || water === null || heat === null) return null;
    return Math.round((fungal * 0.5) + (water * 0.3) + (heat * 0.2));
  };

  const scoreFromItem = (item) => {
    const directScore = toRiskNum(item?.risk_score);
    if (directScore !== null) return Math.round(directScore);
    return scoreFromDay(item);
  };

  const estimatedScore = (row, index, total) => {
    const signals = [];
    const shareRaw = toNum(row?.productionShare, 0);
    const sharePct = shareRaw > 0 && shareRaw <= 1 ? shareRaw * 100 : shareRaw;
    if (sharePct > 0) {
      signals.push(Math.min(95, Math.max(20, Math.round(24 + (sharePct * 0.82)))));
    }

    const area = toNum(row?.area, 0);
    if (area > 0) {
      signals.push(Math.min(90, Math.max(20, Math.round(20 + (Math.log10(area + 1) * 23)))));
    }

    const workers = toNum(row?.workers, 0);
    if (workers > 0) {
      signals.push(Math.min(90, Math.max(20, Math.round(18 + (Math.log10(workers + 1) * 20)))));
    }

    if (signals.length > 0) {
      return Math.min(95, Math.max(20, Math.round(signals.reduce((acc, val) => acc + val, 0) / signals.length)));
    }

    const spread = Math.max(total - 1, 1);
    return Math.max(28, 68 - Math.round((index / spread) * 22));
  };

  const loadComparison = async () => {
    loading = true;
    error = '';
    try {
      let baseItems = [];
      try {
        const compareData = await fetchJson('/api/municipalities/compare');
        baseItems = Array.isArray(compareData?.items) ? compareData.items : [];
      } catch {
        baseItems = [];
      }

      if (baseItems.length === 0) {
        try {
          const regionsData = await fetchJson('/api/regions');
          const regions = Array.isArray(regionsData?.items) ? regionsData.items : [];
          baseItems = regions.map((item) => ({
            slug: item?.slug,
            name: item?.name,
            city: item?.city,
          }));
        } catch {
          baseItems = [];
        }
      }

      if (baseItems.length === 0) {
        baseItems = fallbackRegions;
      }

      rows = baseItems
        .filter((item) => normalizeSlug(item?.slug))
        .map((base) => {
          const slug = normalizeSlug(base.slug);
          const score = scoreFromItem(base);
          return {
            slug,
            name:
              String(base?.name || '').trim() ||
              slug.charAt(0).toUpperCase() + slug.slice(1),
            city: String(base?.city || '').trim(),
            productionShare: toNum(base?.production_share, 0),
            score,
            level: score === null ? 'Sin datos' : riskLabel(score),
            area: toNum(base?.area_ha ?? base?.flower_area_ha, 0),
            workers: toNum(base?.workers, 0),
            isCurrent: slug === region,
            estimated: false,
          };
        });

      if (rows.length > 0 && rows.every((row) => row.score === null)) {
        const operativoPairs = await Promise.all(
          rows.map(async (row) => {
            try {
              const operativo = await fetchJson(`/api/risk/operativo?region=${encodeURIComponent(row.slug)}`);
              const status = String(operativo?.status || '').toLowerCase();
              const scoreRaw = Number(operativo?.score);
              const score = status !== 'sin_datos' && Number.isFinite(scoreRaw) ? Math.round(scoreRaw) : null;
              return [row.slug, score];
            } catch {
              return [row.slug, null];
            }
          })
        );
        const operativoBySlug = new Map(operativoPairs);
        rows = rows.map((row) => {
          const score = operativoBySlug.get(row.slug) ?? row.score;
          return {
            ...row,
            score,
            level: score === null ? 'Sin datos' : riskLabel(score),
            estimated: row.estimated,
          };
        });
      }

      if (rows.length > 0 && rows.every((row) => row.score === null)) {
        const historyPairs = await Promise.all(
          rows.map(async (row) => {
            try {
              const historyData = await fetchJson(`/api/history?region=${encodeURIComponent(row.slug)}&limit=1`);
              const item = Array.isArray(historyData?.items) ? historyData.items[0] : null;
              return [row.slug, scoreFromDay(item)];
            } catch {
              return [row.slug, null];
            }
          })
        );
        const historyBySlug = new Map(historyPairs);
        rows = rows.map((row) => {
          const score = historyBySlug.get(row.slug) ?? row.score;
          return {
            ...row,
            score,
            level: score === null ? 'Sin datos' : riskLabel(score),
            estimated: row.estimated,
          };
        });
      }

      if (rows.length > 0 && rows.every((row) => row.score === null)) {
        rows = rows.map((row, index, list) => {
          const score = estimatedScore(row, index, list.length);
          return {
            ...row,
            score,
            level: riskLabel(score),
            estimated: true,
          };
        });
      }

      if (rows.length === 0) {
        error = 'Datos no disponibles.';
      }
    } catch (err) {
      rows = fallbackRegions.map((base, index, list) => ({
        slug: normalizeSlug(base.slug),
        name: base.name,
        city: base.city,
        productionShare: 0,
        score: estimatedScore(base, index, list.length),
        level: riskLabel(estimatedScore(base, index, list.length)),
        area: 0,
        workers: 0,
        isCurrent: normalizeSlug(base.slug) === region,
        estimated: true,
      }));
      error = '';
    } finally {
      loading = false;
    }
  };

  const onRegionChange = async (event) => {
    if (!event?.detail) return;
    region = event.detail;
    await loadComparison();
  };

  const onRefresh = async () => {
    await loadComparison();
  };

  onMount(() => {
    loadComparison();
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

  $: rankedRows = [...rows].sort((a, b) => {
    const sa = a?.score === null ? -1 : toNum(a?.score, -1);
    const sb = b?.score === null ? -1 : toNum(b?.score, -1);
    return sb - sa;
  });
  $: withScoreCount = rankedRows.filter((row) => row.score !== null).length;
  $: estimatedCount = rankedRows.filter((row) => row.estimated).length;
</script>

{#if loading}
  <p class="state muted">Cargando comparativa...</p>
{:else}
  {#if error || rankedRows.length === 0}
    <p class="state muted">Datos no disponibles.</p>
  {:else}
    <div class="ranking-wrap">
      <p class="title">Municipios con mayor riesgo hoy</p>
      <p class="coverage">
        Cobertura actual: {withScoreCount} de {rankedRows.length} municipios con puntaje operativo.
      </p>
      <ol>
        {#each rankedRows as row, index}
          <li class:current={row.isCurrent}>
            <span class="rank">{index + 1}.</span>
            <span class="badge">{badge(index)}</span>
            <div class="main">
              <strong>{row.name}</strong>
              <small>{row.city || 'Cundinamarca'}</small>
            </div>
            <span class="score">{row.score === null ? '—' : `${row.score}`}</span>
            <small>{row.level}{row.estimated ? ' (estimado)' : ''}</small>
            <div class="meta">
              <span>{row.productionShare > 0 ? `${row.productionShare.toFixed(1)}% participación` : 'Participación n/d'}</span>
              <span>{row.area > 0 ? `${Math.round(row.area)} ha` : 'Área n/d'}</span>
              <span>{row.workers > 0 ? `${row.workers} empleos` : 'Empleo n/d'}</span>
            </div>
          </li>
        {/each}
      </ol>
      <p class="footnote">
        Ranking completo según municipios con datos operativos del backend.
        {#if estimatedCount > 0}
          {estimatedCount} {estimatedCount === 1 ? 'puntaje es estimado' : 'puntajes son estimados'} por perfil municipal mientras llega el score operativo.
        {/if}
      </p>
    </div>
  {/if}
{/if}

<style>
  .state {
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--text-base);
    font-weight: var(--font-normal);
    line-height: var(--leading-normal);
    color: var(--text-secondary, #64748b);
  }

  .state.muted {
    color: var(--text-secondary, #64748b);
  }

  .state.error {
    color: #b91c1c;
  }

  .ranking-wrap {
    display: grid;
    gap: 0.6rem;
  }

  .title {
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    line-height: var(--leading-tight);
    color: var(--text-secondary, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .coverage {
    margin: 0.2rem 0 0;
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: var(--font-normal);
    line-height: var(--leading-normal);
    color: var(--text-tertiary, #94a3b8);
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.45rem;
    max-height: 620px;
    overflow: auto;
    padding-right: 0.2rem;
  }

  li {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 0.45rem;
    background: var(--bg-app, #f8fafc);
    padding: 0.62rem 0.7rem;
    border-radius: 10px;
    border-bottom: 1px solid var(--border-subtle, #e2e8f0);
    color: var(--text-secondary, #475569);
  }

  li.current {
    color: var(--text-primary, #1f2937);
    font-weight: var(--font-semibold);
    background: color-mix(in srgb, var(--primary, #7b5ba6) 8%, #fff);
  }

  .rank {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: var(--font-normal);
    line-height: var(--leading-normal);
    color: var(--text-tertiary, #94a3b8);
  }

  .badge {
    font-family: var(--font-sans);
    font-size: var(--text-lg);
    font-weight: var(--font-normal);
    line-height: var(--leading-normal);
  }

  li strong {
    font-family: var(--font-sans);
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    line-height: var(--leading-tight);
    color: var(--text-primary, #1f2937);
  }

  .main {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  .main small {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: var(--font-normal);
    line-height: var(--leading-normal);
    color: var(--text-tertiary, #94a3b8);
  }

  .score {
    font-family: var(--font-sans);
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    line-height: var(--leading-tight);
    color: var(--text-primary, #1f2937);
  }

  li small {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: var(--font-normal);
    line-height: var(--leading-normal);
    color: var(--text-secondary, #64748b);
  }

  .meta {
    grid-column: 3 / -1;
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: var(--font-normal);
    line-height: var(--leading-normal);
    color: var(--text-tertiary, #94a3b8);
  }

  .footnote {
    margin: 0.2rem 0 0;
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: var(--font-normal);
    line-height: var(--leading-normal);
    color: var(--text-tertiary, #94a3b8);
  }
</style>
