import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

const STORAGE_REGION = 'flowerxi_region';

type MonthRow = {
  month_key: string;
  month_label: string;
  avg_fungal: number;
  avg_water: number;
  avg_heat: number;
  avg_precip: number;
  combined_score: number;
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
      const filtered = all
        .filter((d) => d.region_slug === s)
        .sort((a, b) => String(a.observed_on).localeCompare(String(b.observed_on)));

      // Agrupación mensual completa
      const byMonth: Record<string, any[]> = {};
      filtered.forEach((d) => {
        const m = String(d.observed_on).slice(0, 7);
        (byMonth[m] ||= []).push(d);
      });

      const out: MonthRow[] = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, days]) => {
          const avg = (k: string) => days.reduce((acc, d) => acc + (Number(d[k]) || 0), 0) / days.length;
          const fungal = Math.round(avg('fungal_risk'));
          const water = Math.round(avg('waterlogging_risk'));
          const heat = Math.round(avg('heat_risk'));
          const precip = Number(avg('precipitation_mm').toFixed(1));
          const combined = Math.round(fungal * 0.5 + water * 0.3 + heat * 0.2);

          const dateObj = new Date(month + '-01T12:00:00');
          const monthLabel = dateObj.toLocaleDateString('es-CO', { month: 'short' }).toUpperCase();

          return {
            month_key: month,
            month_label: monthLabel,
            avg_fungal: fungal,
            avg_water: water,
            avg_heat: heat,
            avg_precip: precip,
            combined_score: combined,
          };
        });

      setRows(out);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_REGION) || region : region;
    setSlug(stored);
    load(stored);

    const handleRegionChange = (e: any) => {
      const s = e.detail || localStorage.getItem(STORAGE_REGION) || region;
      setSlug(s);
      load(s);
    };

    window.addEventListener('regionchange', handleRegionChange);
    window.addEventListener('flowerxi:refresh', () => load(localStorage.getItem(STORAGE_REGION) || slug));
    return () => window.removeEventListener('regionchange', handleRegionChange);
  }, []);

  const regionDisplayName = slug.charAt(0).toUpperCase() + slug.slice(1);

  if (loading) {
    return (
      <div className="cal-risk-card">
        <div style={{ height: 320, background: '#f8fafc', borderRadius: 12, animation: 'shimmer 1.5s infinite linear' }} />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="cal-risk-card">
        <p style={{ margin: 0, color: '#64748b', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>
          Sin datos de histórico anual para {regionDisplayName}
        </p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as MonthRow;
      return (
        <div style={{ background: '#0f172a', color: '#fff', padding: '10px 14px', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 20px rgba(0,0,0,0.15)', minWidth: 170 }}>
          <strong style={{ display: 'block', fontSize: 13, marginBottom: 4, color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: 3 }}>
            {data.month_label} ({data.month_key})
          </strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
            <span style={{ color: '#f87171' }}>🍄 Riesgo Fúngico: <b>{data.avg_fungal}%</b></span>
            <span style={{ color: '#fbbf24' }}>💧 Encharcamiento: <b>{data.avg_water}%</b></span>
            <span style={{ color: '#2dd4bf' }}>🌡️ Estrés Térmico: <b>{data.avg_heat}%</b></span>
            <span style={{ color: '#94a3b8', borderTop: '1px dashed #334155', paddingTop: 3, marginTop: 2 }}>
              🌧️ Lluvia media: <b>{data.avg_precip} mm/día</b>
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="cal-risk-card">
      <div className="cal-header">
        <div>
          <div className="cal-badge">Histórico & Proyección Anual</div>
          <h3 className="cal-title">Calendario Multivariable de Riesgo (12 Meses) — {regionDisplayName}</h3>
          <p className="cal-subtitle">
            Comparativa directa de presiones agroclimáticas (0 a 100%) sin sumas artificiales.
          </p>
        </div>

        <div className="cal-legend-guide">
          <span className="cal-guide-item"><span style={{ background: '#ef4444' }} /> Presión Fúngica (Botrytis)</span>
          <span className="cal-guide-item"><span style={{ background: '#f59e0b' }} /> Encharcamiento Radicular</span>
          <span className="cal-guide-item"><span style={{ background: '#0f766e' }} /> Estrés Térmico</span>
        </div>
      </div>

      <div style={{ width: '100%', height: 320, marginTop: '1rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="month_label"
              tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="avg_fungal" name="Riesgo Fúngico" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Bar dataKey="avg_water" name="Encharcamiento" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Bar dataKey="avg_heat" name="Estrés Térmico" fill="#0f766e" radius={[4, 4, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="cal-footer-note">
        💡 <strong>Lectura técnica:</strong> Los picos de <strong>Riesgo Fúngico</strong> en abril/mayo y octubre/noviembre coinciden con las temporadas de lluvias bimodales en la Sabana de Bogotá, exigiendo refuerzo en ventilación cenital.
      </div>
    </div>
  );
}
