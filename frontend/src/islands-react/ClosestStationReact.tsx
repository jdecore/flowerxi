import React, { useEffect, useState } from 'react';

export default function ClosestStationReact({ initialRegion = 'madrid' }: { initialRegion?: string }) {
  const [region, setRegion] = useState(initialRegion);
  const [line, setLine] = useState('consultando...');
  const load = async (slug: string) => {
    try {
      const res = await fetch('/data/stations.json');
      const all: any[] = await res.json();
      const filtered = all.filter((s) => s.region_slug === slug);
      const pick = filtered.length ? filtered[0] : all[0];
      if (!pick) setLine('sin datos');
      else setLine(`${pick.station_name} — ${pick.distance_km ?? '?'} km ${filtered.length ? '' : '(fallback)'}`);
    } catch {
      setLine('sin conexión');
    }
  };
  useEffect(() => {
    const s = localStorage.getItem('flowerxi_region') || initialRegion;
    setRegion(s);
    load(s);
    const h = (e: any) => { const slug = e.detail || localStorage.getItem('flowerxi_region') || initialRegion; setRegion(slug); load(slug); };
    window.addEventListener('regionchange', h);
    return () => window.removeEventListener('regionchange', h);
  }, []);
  return <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>Estación más cercana ({region}): <strong style={{ color: '#0f172a' }}>{line}</strong></p>;
}
