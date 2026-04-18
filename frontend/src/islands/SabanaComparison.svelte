<script>
  import { onDestroy, onMount } from 'svelte';

  export let apiUrl = '';
  export let initialRegion = 'madrid';

  let region = initialRegion;
  let loading = true;
  let error = '';
  let rows = [];

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

  const scoreFromDay = (day) => {
    const fungal = Number(day?.fungal_risk);
    const water = Number(day?.waterlogging_risk);
    const heat = Number(day?.heat_risk);
    if (![fungal, water, heat].every(Number.isFinite)) return null;
    return Math.round((fungal * 0.5) + (water * 0.3) + (heat * 0.2));
  };

  const loadComparison = async () => {
    loading = true;
    error = '';
    try {
      let compareItems = [];
      try {
        const compareData = await fetchJson('/api/municipalities/compare');
        compareItems = Array.isArray(compareData?.items) ? compareData.items : [];
      } catch {
        const regionsData = await fetchJson('/api/regions');
        const regions = Array.isArray(regionsData?.items) ? regionsData.items : [];
        compareItems = regions.map((item) => ({
          slug: item?.slug,
          name: item?.name,
          city: item?.city,
        }));
      }
      const normalizedItems = compareItems.filter((item) => Boolean(item?.slug));

      rows = normalizedItems.map((base) => {
        const slug = String(base.slug);
        const directScore = Number(base?.risk_score);
        const score = Number.isFinite(directScore) ? Math.round(directScore) : scoreFromDay(base);
        return {
          slug,
          name: base?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1),
          city: base?.city ?? '',
          productionShare: toNum(base?.production_share, 0),
          score,
          level: score === null ? 'Sin datos' : riskLabel(score),
          area: toNum(base?.area_ha, 0),
          workers: toNum(base?.workers, 0),
          isCurrent: slug === region,
        };
      });
    } catch (err) {
      rows = [];
      error = 'Datos no disponibles.';
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
        Cobertura actual: {rankedRows.length} municipios con información operativa.
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
            <small>{row.level}</small>
            <div class="meta">
              <span>{row.productionShare > 0 ? `${row.productionShare.toFixed(1)}% participación` : 'Participación n/d'}</span>
              <span>{row.area > 0 ? `${Math.round(row.area)} ha` : 'Área n/d'}</span>
              <span>{row.workers > 0 ? `${row.workers} empleos` : 'Empleo n/d'}</span>
            </div>
          </li>
        {/each}
      </ol>
      <p class="footnote">Ranking completo según municipios con datos reales disponibles en backend.</p>
    </div>
  {/if}
{/if}

<style>
  .state {
    margin: 0;
    font-size: 0.84rem;
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
    font-size: 0.82rem;
    color: var(--text-secondary, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .coverage {
    margin: -0.15rem 0 0;
    font-size: 0.76rem;
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

  .rank {
    font-size: 0.8rem;
    color: var(--text-tertiary, #94a3b8);
  }

  .badge {
    font-size: 0.9rem;
  }

  li strong {
    font-size: 0.88rem;
  }

  .main {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  .main small {
    font-size: 0.72rem;
    color: var(--text-tertiary, #94a3b8);
  }

  .score {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary, #1f2937);
  }

  li small {
    font-size: 0.74rem;
    color: var(--text-secondary, #64748b);
  }

  .meta {
    grid-column: 3 / -1;
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
    font-size: 0.7rem;
    color: var(--text-tertiary, #94a3b8);
  }

  .footnote {
    margin: 0.2rem 0 0;
    font-size: 0.72rem;
    color: var(--text-tertiary, #94a3b8);
  }

  li.current {
    color: var(--text-primary, #1f2937);
    font-weight: 600;
    background: color-mix(in srgb, var(--primary, #7b5ba6) 8%, #fff);
  }
</style>
