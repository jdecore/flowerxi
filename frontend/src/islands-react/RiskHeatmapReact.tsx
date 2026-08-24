import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

type MonthRow = {
  month_label: string;
  combined_score: number;
  avg_fungal: number;
  avg_water: number;
  avg_heat: number;
  risk_level: string;
};

export default function RiskHeatmapReact({ region = 'madrid' }: { region?: string }) {
  const [slug, setSlug] = useState(region);
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (s: string) => {
    setLoading(true);
    try {
      const res = await fetch('/data/weather.json');
      const all: any[] = await res.json();
      const filtered = all.filter((d) => d.region_slug === s).sort((a, b) => String(a.observed_on).localeCompare(String(b.observed_on)));
      // aggregate by YYYY-MM last 12
      const byMonth: Record<string, any[]> = {};
      filtered.slice(-120).forEach((d) => {
        const m = String(d.observed_on).slice(0, 7);
        (byMonth[m] ||= []).push(d);
      });
      const out: MonthRow[] = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, days]) => {
          const avg = (k: string) => days.reduce((s, d) => s + (d[k] || 0), 0) / days.length;
          const combined = Math.round(avg('fungal_risk') * 0.5 + avg('waterlogging_risk') * 0.3 + avg('heat_risk') * 0.2);
          return {
            month_label: new Date(month + '-01T00:00:00').toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }),
            combined_score: combined,
            avg_fungal: Math.round(avg('fungal_risk')),
            avg_water: Math.round(avg('waterlogging_risk')),
            avg_heat: Math.round(avg('heat_risk')),
            risk_level: combined >= 70 ? 'alto' : combined >= 40 ? 'medio' : 'bajo',
          };
        });
      setRows(out);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('flowerxi_region') || region;
    setSlug(stored);
    load(stored);
    const h = (e: any) => {
      const s = e.detail || localStorage.getItem('flowerxi_region') || region;
      setSlug(s);
      load(s);
    };
    window.addEventListener('regionchange', h);
    window.addEventListener('flowerxi:refresh', () => load(localStorage.getItem('flowerxi_region') || slug));
    return () => window.removeEventListener('regionchange', h);
  }, []);

  if (loading) return <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, textAlign: 'center' }}>Cargando calendario 12m…</div>;
  if (!rows.length) return <div style={{ padding: 12 }}>Sin datos para {slug}</div>;

  const avgScore = Math.round(rows.reduce((s, r) => s + r.combined_score, 0) / rows.length);
  const peak = rows.reduce((a, b) => (a.combined_score > b.combined_score ? a : b), rows[0]);

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, display: 'grid', gap: 12, boxShadow: '0 1px 3px rgba(15,23,42,.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>Calendario de riesgo 12m — {slug}</h3>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Score combinado y desglose fúngico / agua / calor</p>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#334155' }}>
          <span><b>{avgScore}</b> promedio</span>
          <span><b>{peak.month_label}</b> pico ({peak.combined_score})</span>
        </div>
      </div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month_label" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} />
            <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="avg_fungal" name="Fúngico" stackId="a" fill="#991b1b" radius={[0, 0, 0, 0]} />
            <Bar dataKey="avg_water" name="Agua" stackId="a" fill="#b45309" />
            <Bar dataKey="avg_heat" name="Calor" stackId="a" fill="#0f766e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month_label" hide />
            <YAxis hide domain={[0, 100]} />
            <Tooltip formatter={(v: any) => [`${v}`, 'Score']} />
            <Bar dataKey="combined_score" name="Score combinado" fill="#0f172a" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
