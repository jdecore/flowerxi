import React from 'react';

export default function AboutFlowerxiReact({ region = 'madrid' }: { region?: string }) {
  const [slug, setSlug] = React.useState(region);
  React.useEffect(() => {
    setSlug(localStorage.getItem('flowerxi_region') || region);
    const h = (e: any) => setSlug(e.detail || localStorage.getItem('flowerxi_region') || region);
    window.addEventListener('regionchange', h);
    return () => window.removeEventListener('regionchange', h);
  }, []);
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, display: 'grid', gap: 12, boxShadow: '0 1px 3px rgba(15,23,42,.07)', minHeight: 420 }}>
      <div style={{ width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e6f7f5', color: '#0f766e', border: '1px solid #b2dfdb', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0f766e', display: 'inline-block' }} /> 100% Local • LFM2.5-230M • Funciona sin internet
      </div>
      <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>¿Qué hace Flowerxi?</h3>
      <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.5 }}>
        Dashboard agroclimático para flores de corte en la Sabana de Bogotá. Cruza clima real (Open-Meteo) con 10 municipios, calcula riesgo fúngico / encharcamiento / térmico y te dice <strong>qué hacer hoy</strong>.
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4, fontSize: 13, color: '#334155' }}>
        <li><strong>Hero operativo</strong> — score, factor dominante y próxima ventana crítica.</li>
        <li><strong>Evidencia 14d</strong> — sparklines React + Recharts verificables.</li>
        <li><strong>Timeline 12m</strong> — estacionalidad y picos.</li>
        <li><strong>Acción 7d</strong> — checklist vigilancia/observado.</li>
      </ul>
      <p style={{ margin: 0, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, fontSize: 13, color: '#334155' }}>
        El chat al lado es <strong>local</strong>: corre LFM2.5-230M vía Transformers.js en tu navegador, no envía tus datos a la nube. Para fotos usa Gemini Flash / Nemotron por BYOK.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: 12, color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
        <span>Municipio activo: <strong style={{ color: '#0f172a' }}>{slug}</strong></span>
        <span>Actualizado diario vía GitHub Action 06:00 Bogotá</span>
      </div>
    </div>
  );
}
