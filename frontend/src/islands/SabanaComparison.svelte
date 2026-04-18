<script>
  import { onDestroy, onMount } from 'svelte';

  export let apiUrl = '';
  export let initialRegion = 'madrid';

  const trackedRegions = ['madrid', 'funza', 'facatativa'];

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

  const loadComparison = async () => {
    loading = true;
    error = '';
    try {
      const compareData = await fetchJson('/api/municipalities/compare');
      const compareItems = Array.isArray(compareData?.items) ? compareData.items : [];

      const riskResponses = await Promise.all(
        trackedRegions.map(async (slug) => {
          try {
            const data = await fetchJson(`/api/risk/operativo?region=${encodeURIComponent(slug)}`);
            return [slug, toNum(data?.score, null)];
          } catch {
            return [slug, null];
          }
        })
      );

      const riskBySlug = new Map(riskResponses);

      rows = trackedRegions.map((slug) => {
        const base = compareItems.find((item) => item.slug === slug);
        const score = riskBySlug.get(slug);
        return {
          slug,
          name: base?.name ?? slug,
          score,
          level: score === null ? 'Sin datos' : riskLabel(score),
          area: toNum(base?.area_ha, 0),
          workers: toNum(base?.workers, 0),
          isCurrent: slug === region,
        };
      });
    } catch (err) {
      rows = [];
      error = err instanceof Error ? err.message : 'No se pudo cargar comparativa';
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
</script>

{#if loading}
  <p class="state muted">Cargando comparativa...</p>
{:else if error}
  <p class="state error">{error}</p>
{:else}
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Municipio</th>
          <th>Riesgo hoy</th>
          <th>Nivel</th>
          <th>Área (ha)</th>
          <th>Trabajadores</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row}
          <tr class={row.isCurrent ? 'current' : ''}>
            <td>{row.name}</td>
            <td>{row.score === null ? '—' : `${row.score} pts`}</td>
            <td>{row.level}</td>
            <td>{row.area.toFixed(1)}</td>
            <td>{row.workers}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
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

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.84rem;
  }

  th,
  td {
    padding: 0.6rem 0.4rem;
    border-bottom: 1px solid var(--border-subtle, #e2e8f0);
    text-align: left;
    color: var(--text-secondary, #475569);
  }

  th {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-tertiary, #94a3b8);
  }

  tr.current td {
    color: var(--text-primary, #1f2937);
    font-weight: 600;
    background: color-mix(in srgb, var(--primary, #7b5ba6) 8%, #fff);
  }
</style>
