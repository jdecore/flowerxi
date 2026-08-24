import React, { useEffect, useState } from 'react';

export default function ImpactoOperacionReact({ initialRegion = 'madrid' }: { initialRegion?: string }) {
  const [region, setRegion] = useState(initialRegion);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const load = async (slug: string) => {
    setLoading(true);
    try {
      const res = await fetch('/data/weather.json');
      const all: any[] = await res.json();
      const hist = all.filter((d) => d.region_slug === slug).sort((a, b) => String(b.observed_on).localeCompare(String(a.observed_on))).slice(0, 7);
      if (!hist.length) { setData(null); return; }
      const todayScore = Math.round((hist[0].fungal_risk * 0.5 + hist[0].waterlogging_risk * 0.3 + hist[0].heat_risk * 0.2));
      const vigilancia = hist.filter((d) => { const s = Math.round(d.fungal_risk * 0.5 + d.waterlogging_risk * 0.3 + d.heat_risk * 0.2); return s >= 40 && s < 70; }).length;
      setData({
        score: todayScore,
        status: todayScore >= 70 ? 'Acción' : todayScore >= 40 ? 'Vigilancia' : 'Rutina',
        vigilancia,
        recommendation: hist[0].recommendation_message || 'Mantén monitoreo preventivo.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const s = localStorage.getItem('flowerxi_region') || initialRegion;
    setRegion(s);
    load(s);
    const h = (e: any) => { const slug = e.detail || localStorage.getItem('flowerxi_region') || initialRegion; setRegion(slug); load(slug); };
    window.addEventListener('regionchange', h);
    window.addEventListener('flowerxi:refresh', () => load(localStorage.getItem('flowerxi_region') || region));
    return () => window.removeEventListener('regionchange', h);
  }, []);

  if (loading) return <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16 }}>Cargando impacto…</div>;
  if (!data) return <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16 }}>Sin datos para {region}</div>;

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, display: 'grid', gap: 12, boxShadow: '0 1px 3px rgba(15,23,42,.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>Impacto en operación</h3><span>📊</span>
      </div>
      <p style={{ margin: 0, fontSize: 14, color: '#475569' }}>Esta semana en <strong>{region}</strong>:</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        <li style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'flex', gap: 10 }}>
          <span>⏱️</span><div><strong>Riesgo hoy:</strong> <span style={{ color: data.score >= 70 ? '#991b1b' : data.score >= 40 ? '#b45309' : '#0f766e' }}>{data.status} ({data.score})</span></div>
        </li>
        <li style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'flex', gap: 10 }}>
          <span>🛡️</span><div><strong>Días en vigilancia (7d):</strong> {data.vigilancia}</div>
        </li>
        <li style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'flex', gap: 10 }}>
          <span>📋</span><div><strong>Recomendación:</strong> <span style={{ color: '#0f766e' }}>{data.recommendation}</span></div>
        </li>
      </ul>
      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', borderLeft: '3px solid #b45309', paddingLeft: 8, background: '#fef3c7', borderRadius: 6, padding: 8 }}>ℹ️ Basado en datos reales de señales de riesgo.</p>
    </div>
  );
}
