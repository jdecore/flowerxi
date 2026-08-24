import React, { useEffect, useState } from 'react';

const scoreFrom = (d: any) => {
  const f = Number(d?.fungal_risk), w = Number(d?.waterlogging_risk), h = Number(d?.heat_risk);
  if (![f, w, h].every(Number.isFinite)) return null;
  return Math.round(f * 0.5 + w * 0.3 + h * 0.2);
};
const levelText = (s: number | null) => (s === null ? 'SIN DATOS' : s >= 70 ? 'ALTO' : s >= 40 ? 'MEDIO' : 'BAJO');
const reasonFrom = (d: any) => {
  const f = Number(d?.fungal_risk), w = Number(d?.waterlogging_risk), h = Number(d?.heat_risk);
  if (![f, w, h].every(Number.isFinite)) return 'Datos no disponibles.';
  if (f >= w && f >= h) return 'El factor dominante hoy es riesgo fúngico.';
  if (w >= f && w >= h) return 'El factor dominante hoy es riesgo por encharcamiento.';
  return 'El factor dominante hoy es riesgo térmico.';
};
const hoursSinceRain = (hist: any[]) => {
  for (let i = 0; i < hist.length; i++) if (Number(hist[i]?.precipitation_mm) > 0) return i * 24;
  return null;
};

export default function OperationalHeroReact({ initialRegion = 'madrid' }: { initialRegion?: string }) {
  const [region, setRegion] = useState(initialRegion);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const load = async (slug: string) => {
    setLoading(true);
    try {
      const [hr, cr] = await Promise.all([
        fetch('/data/weather.json').then((r) => r.json()),
        fetch('/data/regions.json').then((r) => r.json().catch(() => [])),
      ]);
      const hist = (hr as any[])
        .filter((d) => d.region_slug === slug)
        .sort((a, b) => String(b.observed_on).localeCompare(String(a.observed_on)))
        .slice(0, 14);
      const latest = hist[0] || null;
      const prev = hist[1] || null;
      const score = latest ? scoreFrom(latest) : null;
      const prevScore = prev ? scoreFrom(prev) : null;
      const delta = score !== null && prevScore !== null ? score - prevScore : 0;
      const dominant =
        latest && Number(latest.fungal_risk) >= Number(latest.waterlogging_risk) && Number(latest.fungal_risk) >= Number(latest.heat_risk)
          ? 'riesgo fúngico'
          : latest && Number(latest.waterlogging_risk) >= Number(latest.fungal_risk) && Number(latest.waterlogging_risk) >= Number(latest.heat_risk)
            ? 'encharcamiento'
            : latest ? 'riesgo térmico' : 'Sin datos';
      // top 3
      const latestByRegion: Record<string, any> = {};
      (hr as any[]).forEach((d) => {
        if (!latestByRegion[d.region_slug] || d.observed_on > latestByRegion[d.region_slug].observed_on) latestByRegion[d.region_slug] = d;
      });
      const top = Object.entries(latestByRegion)
        .map(([slug, d]: any) => ({ slug, name: slug, score: scoreFrom(d) }))
        .filter((x) => Number.isFinite(x.score))
        .sort((a, b) => (b.score as number) - (a.score as number))
        .slice(0, 3);
      // name lookup
      const nameMap: Record<string, string> = {};
      (cr as any[]).forEach((r: any) => (nameMap[r.slug] = r.name));
      top.forEach((t) => (t.name = nameMap[t.slug] || t.slug));

      setData(
        latest
          ? {
              score,
              level: levelText(score),
              delta,
              trend: delta > 3 ? '↑ en aumento' : delta < -3 ? '↓ a la baja' : '→ estable',
              confidence: hist.length >= 14 ? 78 : hist.length >= 7 ? 64 : 52,
              days: hist.length,
              window: score !== null && score >= 70 ? 24 : score !== null && score >= 40 ? 48 : 72,
              hoursSince: hoursSinceRain(hist),
              reason: reasonFrom(latest),
              dominant,
              latest,
              top,
            }
          : null
      );
      if (latest) {
        localStorage.setItem('flowerxi_today', JSON.stringify({ region: slug, score, reason: reasonFrom(latest) }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('flowerxi_region') || initialRegion;
    setRegion(stored);
    load(stored);
    const h = (e: any) => {
      const s = e.detail || localStorage.getItem('flowerxi_region') || initialRegion;
      setRegion(s);
      load(s);
    };
    window.addEventListener('regionchange', h);
    window.addEventListener('flowerxi:refresh', () => load(localStorage.getItem('flowerxi_region') || region));
    return () => {
      window.removeEventListener('regionchange', h);
      window.removeEventListener('flowerxi:refresh', () => {});
    };
  }, []);

  if (loading) return <div style={{ height: 140, borderRadius: 12, background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite linear' }} />;
  if (!data) return <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>Sin datos para {region}</div>;

  const prefix = data.delta > 0 ? '↑' : data.delta < 0 ? '↓' : '→';

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 20, display: 'grid', gridTemplateColumns: '1fr', gap: 20, boxShadow: '0 1px 3px rgba(15,23,42,.07)' }}>
      <div>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>RIESGO HOY</p>
        <h2 style={{ margin: '4px 0 6px', fontSize: 24, color: '#0f172a' }}>
          {data.level} {data.score !== null ? `(${data.score})` : ''}
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: '#475569' }}>{prefix} {Math.abs(data.delta)} vs ayer</p>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#475569' }}>📊 Tendencia semanal: {data.trend}</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>Confianza: {data.confidence}% • {Math.min(data.days, 14)} días</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>⏱ Próxima ventana: {data.window}h</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>Última lluvia: {data.hoursSince === null ? 'Sin datos' : `hace ${data.hoursSince}h`}</p>
      </div>
      <div style={{ gridColumn: '1 / -1', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#0f172a' }}>📍 Sabana de Bogotá hoy</h3>
        {data.top.length ? data.top.map((t: any, i: number) => <p key={t.slug} style={{ margin: '6px 0 0', fontSize: 13, color: '#475569' }}>{i + 1}. {t.name} {i === 0 ? '🔴' : i === 1 ? '🟠' : '🟡'} {t.score}</p>) : <p style={{ color: '#64748b' }}>Sin ranking</p>}
      </div>
      <style>{`@media(max-width:1100px){div[style*="1.2fr 1fr"]{grid-template-columns:1fr !important}} @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  );
}
