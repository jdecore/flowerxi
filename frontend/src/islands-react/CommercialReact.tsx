import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0f766e', '#334155', '#b45309', '#991b1b', '#64748b'];

export default function CommercialReact() {
  const [byMonth, setByMonth] = useState<any[]>([]);
  const [byCountry, setByCountry] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/data/exports.json');
      const rows: any[] = await res.json();
      const m: Record<string, number> = {};
      const c: Record<string, number> = {};
      rows.forEach((r) => {
        m[r.year_month] = (m[r.year_month] || 0) + r.fob_usd;
        c[r.country_dest] = (c[r.country_dest] || 0) + r.fob_usd;
      });
      setByMonth(
        Object.entries(m)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, fob]) => ({ month, fob: Math.round(fob / 1000) }))
      );
      setByCountry(
        Object.entries(c)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([name, value]) => ({ name, value: Math.round(value / 1000) }))
      );
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>Cargando comercial…</div>;

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, display: 'grid', gap: 16, boxShadow: '0 1px 3px rgba(15,23,42,.07)' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>Inteligencia comercial</h3>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>FOB por mes (k USD) y top destinos</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMonth}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip formatter={(v: any) => [`$${v}k`, 'FOB']} contentStyle={{ borderRadius: 10 }} />
              <Bar dataKey="fob" fill="#0f766e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byCountry} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} label={({ name }) => name}>
                {byCountry.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => [`$${v}k`, 'FOB']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <style>{`@media(max-width: 800px){ div[style*="1.6fr 1fr"]{ grid-template-columns:1fr !important } }`}</style>
    </div>
  );
}
