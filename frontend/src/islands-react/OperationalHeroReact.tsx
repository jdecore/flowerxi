import React, { useEffect, useState } from 'react';

const STORAGE_REGION = 'flowerxi_region';

const scoreFrom = (d: any) => {
  const f = Number(d?.fungal_risk), w = Number(d?.waterlogging_risk), h = Number(d?.heat_risk);
  if (![f, w, h].every(Number.isFinite)) return null;
  return Math.round(f * 0.5 + w * 0.3 + h * 0.2);
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

      // Determinación de directiva operativa agronómica
      let directive = 'Monitoreo de rutina: Mantener programa regular de fertirriego y ventilación estándar.';
      let directiveLevel: 'success' | 'warning' | 'danger' = 'success';
      let tagText = 'RUTINA FITOSANITARIA';

      if (score !== null) {
        if (score >= 70) {
          directiveLevel = 'danger';
          tagText = 'ACCIÓN INMEDIATA EN CAMPO';
          directive = 'Alta presión de botritis: Abrir cortinas cenitales al 50% entre 10:00–14:00. Suspender riego foliar vespertino y aislar tallos con daño.';
        } else if (score >= 40) {
          directiveLevel = 'warning';
          tagText = 'VIGILANCIA PREVENTIVA';
          directive = 'Riesgo moderado de humedad foliar: Ventilar antes de las 11:00 para reducir condensación matutina y verificar drenajes basales.';
        }
      }

      // Ranking top 3 Sabana
      const latestByRegion: Record<string, any> = {};
      (hr as any[]).forEach((d) => {
        if (!latestByRegion[d.region_slug] || d.observed_on > latestByRegion[d.region_slug].observed_on) latestByRegion[d.region_slug] = d;
      });
      const top = Object.entries(latestByRegion)
        .map(([rSlug, d]: any) => ({ slug: rSlug, name: rSlug, score: scoreFrom(d) }))
        .filter((x) => Number.isFinite(x.score))
        .sort((a, b) => (b.score as number) - (a.score as number))
        .slice(0, 3);

      const nameMap: Record<string, string> = {};
      (cr as any[]).forEach((r: any) => (nameMap[r.slug] = r.name));
      top.forEach((t) => (t.name = nameMap[t.slug] || t.slug.charAt(0).toUpperCase() + t.slug.slice(1)));

      setData({
        score,
        delta,
        directive,
        directiveLevel,
        tagText,
        latest,
        top,
      });
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_REGION) || initialRegion : initialRegion;
    setRegion(stored);
    load(stored);
    const h = (e: any) => {
      const s = e.detail || localStorage.getItem(STORAGE_REGION) || initialRegion;
      setRegion(s);
      load(s);
    };
    window.addEventListener('regionchange', h);
    window.addEventListener('flowerxi:refresh', () => load(localStorage.getItem(STORAGE_REGION) || region));
    return () => {
      window.removeEventListener('regionchange', h);
      window.removeEventListener('flowerxi:refresh', () => {});
    };
  }, []);

  const regionDisplayName = region.charAt(0).toUpperCase() + region.slice(1);

  if (loading) {
    return <div className="op-hero-skeleton" />;
  }

  if (!data || data.score === null) {
    return (
      <div className="op-hero-card">
        <p className="op-hero-empty">Sin datos operativos para {regionDisplayName}</p>
      </div>
    );
  }

  const badgeColors = {
    danger: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', dot: '#ef4444' },
    warning: { bg: '#fffbeb', text: '#92400e', border: '#fde68a', dot: '#f59e0b' },
    success: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', dot: '#22c55e' },
  }[data.directiveLevel];

  return (
    <div className="op-hero-card">
      {/* Top Tag & Municipio */}
      <div className="op-hero-header">
        <div className="op-status-badge" style={{ background: badgeColors.bg, color: badgeColors.text, borderColor: badgeColors.border }}>
          <span className="op-status-dot" style={{ background: badgeColors.dot }} />
          <span>{data.tagText}</span>
        </div>
        <span className="op-hero-region-label">{regionDisplayName} • Hoy</span>
      </div>

      {/* Main Metric Row */}
      <div className="op-metric-row">
        <div className="op-score-box">
          <span className="op-score-num">{data.score}</span>
          <span className="op-score-sub">/100</span>
        </div>
        <div className="op-score-desc">
          <h3 className="op-score-title">
            Índice de Riesgo {data.score >= 70 ? 'Alto' : data.score >= 40 ? 'Moderado' : 'Bajo'}
          </h3>
          <p className="op-score-trend">
            {data.delta > 0 ? `↑ +${data.delta} pts vs ayer` : data.delta < 0 ? `↓ ${data.delta} pts vs ayer` : '→ Estable vs ayer'}
            {' • '}
            Humedad {data.latest?.precipitation_mm > 0 ? 'con lluvia activa' : 'sin lluvia'}
          </p>
        </div>
      </div>

      {/* Directiva Agronómica Inmediata */}
      <div className="op-directive-box" style={{ borderLeftColor: badgeColors.dot }}>
        <div className="op-directive-head">
          <span className="op-directive-icon">⚡</span>
          <strong>Directiva Operativa de Campo:</strong>
        </div>
        <p className="op-directive-text">{data.directive}</p>
      </div>

      {/* Micro Factores + Radar Vecinos */}
      <div className="op-footer-row">
        <div className="op-factors-chips">
          <span className="op-factor-chip">
            🍄 Fúngico: <strong>{data.latest?.fungal_risk ?? '—'}%</strong>
          </span>
          <span className="op-factor-chip">
            💧 Encharcamiento: <strong>{data.latest?.waterlogging_risk ?? '—'}%</strong>
          </span>
          <span className="op-factor-chip">
            🌡️ Temp: <strong>{data.latest?.temp_mean_c ?? '—'}°C</strong>
          </span>
        </div>

        <div className="op-sabana-ranking">
          <span className="op-ranking-title">Radar Sabana:</span>
          <div className="op-ranking-items">
            {data.top.map((t: any, idx: number) => (
              <span key={t.slug} className="op-rank-item">
                {idx + 1}. {t.name} <strong style={{ color: t.score >= 70 ? '#ef4444' : t.score >= 40 ? '#f59e0b' : '#10b981' }}>{t.score}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
