<script>
  import { onMount } from 'svelte';

  export let apiUrl = '';
  export let region = 'madrid';

  let savingHours = 0.5;
  let riskReduction = '5%';
  let recommendation = 'Mantener recorrido normal';
  let loading = true;

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
    try {
      const res = await fetch(`${apiUrl}/api/risk/operativo?region=${region}`);
      if (res.ok) {
        const data = await res.json();
        const score = data?.operativo?.score ?? 22;
        updateImpact(score);
      }
    } catch (e) { console.error(e); }
    finally { loading = false; }
  };

  window.addEventListener('regionchange', (e) => {
    if (e.detail !== region) { region = e.detail; fetchImpact(); }
  });

  onMount(fetchImpact);
</script>

<article class="impacto-operacion">
  <div class="impact-header">
    <h3>Impacto en operación</h3>
    <span class="impact-badge">📊</span>
  </div>

  <p class="impact-intro">
    Con el estado actual, esta semana en <strong>{region}</strong>:
  </p>

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
  .impacto-operacion { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
  .impact-header { display: flex; justify-content: space-between; align-items: center; }
  .impact-header h3 { margin: 0; font-size: 1.1rem; font-weight: 600; color: #1f2937; }
  .impact-badge { font-size: 1.2rem; }
  .impact-intro { margin: 0; font-size: 0.9rem; color: #4b5563; line-height: 1.4; }
  .impact-intro strong { color: #1f2937; }
  .impact-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
  .impact-list li { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; }
  .impact-icon { font-size: 1.2rem; flex-shrink: 0; }
  .impact-list strong { display: block; font-size: 0.8rem; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem; }
  .value { font-size: 0.9rem; color: #1f2937; }
  .value.action { color: #059669; font-weight: 500; }
  .impact-note { margin: 0; font-size: 0.75rem; color: #6b7280; line-height: 1.4; padding: 0.5rem 0.75rem; background: #fef3c7; border-radius: 8px; border-left: 3px solid #F59E0B; }
</style>
