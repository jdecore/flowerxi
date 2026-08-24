import React, { useEffect, useState } from 'react';

const scoreFrom = (d: any) => {
  const f = Number(d.fungal_risk), w = Number(d.waterlogging_risk), h = Number(d.heat_risk);
  if (![f, w, h].every(Number.isFinite)) return null;
  return Math.round(f * 0.5 + w * 0.3 + h * 0.2);
};

export default function SabanaComparisonReact({ initialRegion = 'madrid' }: { initialRegion?: string }) {
  const [region, setRegion] = useState(initialRegion);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [regions, weather, profiles] = await Promise.all([
        fetch('/data/regions.json').then((r) => r.json()),
        fetch('/data/weather.json').then((r) => r.json()),
        fetch('/data/municipality_profiles.json').then((r) => r.json()).catch(() => []),
      ]);
      const latestBy: Record<string, any> = {};
      (weather as any[]).forEach((d) => {
        if (!latestBy[d.region_slug] || d.observed_on > latestBy[d.region_slug].observed_on) latestBy[d.region_slug] = d;
      });
      const out = (regions as any[]).map((r) => {
        const latest = latestBy[r.slug] || {};
        const score = scoreFrom(latest);
        const est = score === null;
        const fallback = est ? Math.round(28 + (r.production_share || 0) * 40 + (r.workers || 0) / 400) : score;
        return {
          slug: r.slug,
          name: r.name,
          area: r.flower_area_ha,
          workers: r.workers,
          share: r.production_share,
          score: est ? fallback : score,
          estimated: est,
          level: fallback !== null && fallback >= 70 ? 'alto' : fallback !== null && fallback >= 40 ? 'medio' : 'bajo',
        };
      }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      setRows(out);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setRegion(localStorage.getItem('flowerxi_region') || initialRegion);
    load();
    const h = (e: any) => { setRegion(e.detail || localStorage.getItem('flowerxi_region') || initialRegion); load(); };
    window.addEventListener('regionchange', h);
    window.addEventListener('flowerxi:refresh', load);
    return () => { window.removeEventListener('regionchange', h); window.removeEventListener('flowerxi:refresh', load); };
  }, []);

  if (loading) return <div style={{ padding: 12, color: '#64748b' }}>Cargando comparativa…</div>;

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>{rows.filter((r) => !r.estimated).length} de {rows.length} con puntaje • Teal = actual</span>
        <span style={{ fontSize: 12, background: '#ccfbf1', color: '#0f766e', borderRadius: 999, padding: '2px 8px' }}>{region}</span>
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 620, overflow: 'auto' }}>
        {rows.map((r, idx) => (
          <li key={r.slug} style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto', gap: '4px 10px', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', background: r.slug === region ? 'rgba(15,118,110,.08)' : '#fff', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{idx + 1}</span>
            <span style={{ fontSize: 16 }}>{r.level === 'alto' ? '🔴' : r.level === 'medio' ? '🟠' : r.level === 'bajo' ? '🟡' : '⚪'}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{r.name} {r.estimated && <span style={{ fontWeight: 400, color: '#64748b', fontSize: 11 }}>(estimado)</span>}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{r.area} ha • {r.workers} trabajadores • {(r.share * 100).toFixed(1)}% prod.</div>
            </div>
            <span style={{ fontWeight: 700, color: r.score !== null && r.score >= 70 ? '#991b1b' : r.score !== null && r.score >= 40 ? '#b45309' : '#0f766e', fontSize: 14 }}>{r.score ?? '—'}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
