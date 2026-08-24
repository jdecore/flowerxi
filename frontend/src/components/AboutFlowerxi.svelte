<script>
  export let region = 'madrid';
</script>

<article class="about-card">
  <div class="about-badge">
    <span class="dot"></span> 100% Local • LFM2.5-230M • Funciona sin internet
  </div>
  <h3>¿Qué hace Flowerxi?</h3>
  <p class="lead">
    Dashboard agroclimático para flores de corte en la Sabana de Bogotá. Cruza clima real (Open-Meteo) con 10 municipios, calcula riesgo fúngico / encharcamiento / térmico y te dice <strong>qué hacer hoy</strong>.
  </p>
  <ul class="about-list">
    <li><strong>Hero operativo</strong> — score, factor dominante y próxima ventana crítica.</li>
    <li><strong>Evidencia 14d</strong> — sparklines de lluvia, temp y riesgos con datos verificables.</li>
    <li><strong>Timeline 12m</strong> — estacionalidad y picos.</li>
    <li><strong>Acción 7d</strong> — checklist vigilancia/observado y recomendación.</li>
  </ul>
  <p class="about-note">
    El chat al lado es <strong>local</strong>: corre LFM2.5-230M vía Transformers.js en tu navegador, no envía tus datos a la nube. Para fotos usa Gemini Flash / Nemotron por BYOK si quieres segunda opinión.
  </p>
  <div class="about-meta">
    <span>Municipio activo: <strong>{region}</strong></span>
    <span>Actualizado diario vía GitHub Action 06:00 Bogotá</span>
  </div>
</article>

<style>
  .about-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    padding: 1.25rem;
    box-shadow: var(--shadow-sm);
    display: grid;
    gap: 0.75rem;
    min-height: 420px;
  }
  .about-badge {
    width: fit-content;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: var(--primary-soft);
    color: var(--primary);
    border: 1px solid #b2dfdb;
    border-radius: 999px;
    padding: 0.28rem 0.62rem;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); display: inline-block; }
  h3 { margin: 0; font-size: var(--text-2xl); color: var(--text-primary); }
  .lead { margin: 0; font-size: var(--text-lg); color: var(--text-secondary); line-height: 1.5; }
  .about-list { margin: 0; padding-left: 1.1rem; display: grid; gap: 0.35rem; font-size: var(--text-base); color: var(--text-secondary); }
  .about-note { margin: 0; background: var(--bg-muted); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 0.7rem; font-size: var(--text-base); color: var(--text-secondary); }
  .about-meta { display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; font-size: var(--text-sm); color: var(--text-tertiary); border-top: 1px solid var(--border-subtle); padding-top: 0.6rem; }
</style>
