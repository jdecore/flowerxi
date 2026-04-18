<script>
  import { onDestroy, onMount } from 'svelte';

  export let apiUrl = '';
  export let region = 'madrid';

  let savingHours = 0.5;
  let riskReduction = '5%';
  let recommendation = 'Mantener recorrido normal';
  let loading = true;
  let error = '';

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

  const updateImpact = (score) => {
    if (score >= 70) {
      savingHours = '4-6';
      riskReduction = '25%';
      recommendation = 'Activar protocolo de emergencia';
    } else if (score >= 40) {
      savingHours = '2-3';
      riskReduction = '18%';
      recommendation = 'Reforzar vigilancia diaria';
    } else {
      savingHours = 0.5;
      riskReduction = '5%';
      recommendation = 'Mantener recorrido normal';
    }
  };

  const fetchImpact = async () => {
    loading = true;
    error = '';
    try {
      try {
        const data = await fetchJson(`/api/risk/operativo?region=${encodeURIComponent(region)}`);
        const score = Number(data?.score ?? data?.operativo?.score ?? 22);
        updateImpact(score);
        return;
      } catch {
        const dashboard = await fetchJson(`/api/dashboard?region=${encodeURIComponent(region)}`);
        const score = Number(dashboard?.combined_score ?? dashboard?.risk_score ?? 22);
        updateImpact(score);
      }
    } catch (e) {
      error = 'No se pudo cargar impacto operativo.';
      console.error(e);
    }
    finally { loading = false; }
  };

  const handleRegionChange = (e) => {
    if (e.detail !== region) {
      region = e.detail;
      fetchImpact();
    }
  };

  const handleRefresh = () => {
    fetchImpact();
  };

  onMount(() => {
    fetchImpact();
    if (typeof window !== 'undefined') {
      window.addEventListener('regionchange', handleRegionChange);
      window.addEventListener('flowerxi:refresh', handleRefresh);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('regionchange', handleRegionChange);
      window.removeEventListener('flowerxi:refresh', handleRefresh);
    }
  });
</script>

<article class="impacto-operacion">
  <div class="impact-header">
    <h3>Impacto en operación</h3>
    <span class="impact-badge">📊</span>
  </div>

  <p class="impact-intro">
    Con el estado actual, esta semana en <strong>{region}</strong>:
  </p>

  {#if error}
    <p class="impact-error">{error}</p>
  {/if}

  <ul class="impact-list">
    <li>
      <span class="impact-icon">⏱️</span>
      <div>
        <strong>Ahorro de tiempo:</strong>
        <span class="value">∼{savingHours} horas/día de inspección</span>
      </div>
    </li>
    <li>
      <span class="impact-icon">🛡️</span>
      <div>
        <strong>Reducción de riesgo:</strong>
        <span class="value">−{riskReduction} de Botrytis (proxy climático)</span>
      </div>
    </li>
    <li>
      <span class="impact-icon">📋</span>
      <div>
        <strong>Recomendación:</strong>
        <span class="value action">{recommendation}</span>
      </div>
    </li>
  </ul>

  <p class="impact-note">
    ℹ️ No es diagnóstico de finca. Es un modelo de priorización basado en clima.
  </p>
</article>

<style>
  .impacto-operacion { background: var(--bg-surface, #fff); border: 1px solid var(--border-subtle, #e2e8f0); border-radius: 16px; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: var(--shadow-sm, 0 1px 3px rgba(31,41,55,0.06)); }
  .impact-header { display: flex; justify-content: space-between; align-items: center; }
  .impact-header h3 { margin: 0; font-size: 1.1rem; font-weight: 600; color: var(--text-primary, #1f2937); }
  .impact-badge { font-size: 1.2rem; }
  .impact-intro { margin: 0; font-size: 0.9rem; color: var(--text-secondary, #4b5563); line-height: 1.4; }
  .impact-intro strong { color: var(--text-primary, #1f2937); }
  .impact-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
  .impact-list li { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem; background: var(--bg-app, #f8fafc); border-radius: 10px; border: 1px solid var(--border-subtle, #e2e8f0); }
  .impact-icon { font-size: 1.2rem; flex-shrink: 0; }
  .impact-list strong { display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary, #374151); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem; }
  .value { font-size: 0.9rem; color: var(--text-primary, #1f2937); }
  .value.action { color: var(--status-rutina, #059669); font-weight: 500; }
  .impact-note { margin: 0; font-size: 0.75rem; color: var(--text-secondary, #6b7280); line-height: 1.4; padding: 0.5rem 0.75rem; background: var(--status-vigilancia-bg, #fef3c7); border-radius: 8px; border-left: 3px solid var(--status-vigilancia, #F59E0B); }
  .impact-error { margin: 0; font-size: 0.82rem; color: #b91c1c; }
</style>
