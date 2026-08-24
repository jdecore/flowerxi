import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis } from 'recharts';

type Day = {
  observed_on: string;
  precipitation_mm: number;
  temp_mean_c: number;
  fungal_risk: number;
  waterlogging_risk: number;
  heat_risk: number;
};

const fmtDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
};

const Card = ({ title, unit, color, dataKey, data }: { title: string; unit: string; color: string; dataKey: keyof Day; data: any[] }) => (
  <div className="ev-card">
    <div className="ev-head">
      <span className="ev-title">{title}</span>
      <span className="ev-last">{data.length ? `${data[data.length - 1][dataKey]}${unit}` : '—'}</span>
    </div>
    <div style={{ height: 92 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 6, bottom: 0 }}>
          <defs>
            <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
            labelFormatter={(_, p: any) => p?.[0]?.payload?.fullLabel || ''}
            formatter={(v: any) => [`${v}${unit}`, title]}
          />
          <Area type="monotone" dataKey={dataKey as string} stroke={color} strokeWidth={2} fill={`url(#g-${dataKey})`} dot={false} activeDot={{ r: 3 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default function EvidenceChartsReact({ initialRegion = 'madrid' }: { initialRegion?: string }) {
  const [region, setRegion] = useState(initialRegion);
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = async (slug: string) => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/data/weather.json');
      const all: Day[] & { region_slug: string }[] = await res.json();
      const filtered = (all as any[])
        .filter((d) => d.region_slug === slug)
        .sort((a, b) => String(a.observed_on).localeCompare(String(b.observed_on)))
        .slice(-14);
      setDays(filtered as Day[]);
    } catch (e: any) {
      setErr(e.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('flowerxi_region') || initialRegion;
    setRegion(stored);
    load(stored);
    const onChange = (e: any) => {
      const slug = e.detail || localStorage.getItem('flowerxi_region') || initialRegion;
      setRegion(slug);
      load(slug);
    };
    const onRefresh = () => load(localStorage.getItem('flowerxi_region') || region);
    window.addEventListener('regionchange', onChange);
    window.addEventListener('flowerxi:refresh', onRefresh);
    return () => {
      window.removeEventListener('regionchange', onChange);
      window.removeEventListener('flowerxi:refresh', onRefresh);
    };
  }, []);

  if (loading) return <div className="ev-skeleton">Cargando evidencia…</div>;
  if (err) return <div className="ev-error">{err} <button onClick={() => load(region)}>Reintentar</button></div>;
  if (days.length < 2) return <div className="ev-empty">Datos insuficientes para {region}</div>;

  const chartData = days.map((d) => ({
    label: fmtDate(d.observed_on),
    fullLabel: d.observed_on,
    precipitation_mm: d.precipitation_mm,
    temp_mean_c: d.temp_mean_c,
    fungal_risk: d.fungal_risk,
    waterlogging_risk: d.waterlogging_risk,
    heat_risk: d.heat_risk,
  }));

  return (
    <div className="ev-grid">
      <Card title="Precipitación" unit=" mm" color="#0f766e" dataKey="precipitation_mm" data={chartData} />
      <Card title="Temp. media" unit="°C" color="#334155" dataKey="temp_mean_c" data={chartData} />
      <Card title="Riesgo encharcamiento" unit="" color="#b45309" dataKey="waterlogging_risk" data={chartData} />
      <Card title="Riesgo fúngico" unit="" color="#991b1b" dataKey="fungal_risk" data={chartData} />
      <style>{`
        .ev-grid{ display:grid; grid-template-columns: repeat(4,1fr); gap:0.9rem }
        @media(max-width: 1100px){ .ev-grid{ grid-template-columns: repeat(2,1fr) } }
        @media(max-width: 600px){ .ev-grid{ grid-template-columns:1fr } }
        .ev-card{ background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:0.65rem 0.7rem; box-shadow:0 1px 3px rgba(15,23,42,.07) }
        .ev-head{ display:flex; justify-content:space-between; align-items:center; margin-bottom:0.2rem }
        .ev-title{ font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:#64748b; font-weight:600 }
        .ev-last{ font-size:0.85rem; font-weight:700; color:#0f172a }
        .ev-skeleton,.ev-error,.ev-empty{ background:#fff; border:1px dashed #e2e8f0; border-radius:12px; padding:1rem; text-align:center; color:#64748b }
        .ev-error button{ margin-left:0.5rem; border:none; background:#0f766e; color:#fff; border-radius:8px; padding:0.3rem 0.6rem; cursor:pointer }
      `}</style>
    </div>
  );
}
