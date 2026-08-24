import React, { useEffect, useState } from 'react';

const FALLBACK = [
  { slug: 'madrid', name: 'Madrid' },
  { slug: 'facatativa', name: 'Facatativá' },
  { slug: 'funza', name: 'Funza' },
  { slug: 'el-rosal', name: 'El Rosal' },
  { slug: 'tocancipa', name: 'Tocancipá' },
  { slug: 'chia', name: 'Chía' },
  { slug: 'mosquera', name: 'Mosquera' },
  { slug: 'sopo', name: 'Sopó' },
  { slug: 'bojaca', name: 'Bojacá' },
  { slug: 'cachipay', name: 'Cachipay' },
];

export default function StartupRegionModalReact() {
  const [isOpen, setIsOpen] = useState(false);
  const [regions, setRegions] = useState(FALLBACK);
  const [selected, setSelected] = useState('madrid');
  const [loading, setLoading] = useState(false);

  const loadRegions = async () => {
    setLoading(true);
    try {
      const cached = localStorage.getItem('flowerxi_regions_cache_v2');
      if (cached) {
        const p = JSON.parse(cached);
        if (Array.isArray(p.items) && Date.now() - p.savedAt < 15 * 60 * 1000) {
          setRegions(p.items);
          return;
        }
      }
      const res = await fetch('/data/regions.json');
      const data = await res.json();
      const items = Array.isArray(data) ? data.map((r: any) => ({ slug: r.slug, name: r.name })) : FALLBACK;
      setRegions(items);
      localStorage.setItem('flowerxi_regions_cache_v2', JSON.stringify({ savedAt: Date.now(), items }));
    } catch {
      setRegions(FALLBACK);
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!selected) return;
    localStorage.setItem('flowerxi_region', selected);
    window.dispatchEvent(new CustomEvent('regionchange', { detail: selected }));
    setIsOpen(false);
  };

  useEffect(() => {
    const stored = localStorage.getItem('flowerxi_region') || 'madrid';
    setSelected(stored);
    if (!localStorage.getItem('flowerxi_region')) setIsOpen(true);
    loadRegions();
    const open = () => { setIsOpen(true); loadRegions(); };
    const onRegion = (e: any) => e.detail && setSelected(e.detail);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    window.addEventListener('open-region-selector', open);
    window.addEventListener('regionchange', onRegion as any);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('open-region-selector', open);
      window.removeEventListener('regionchange', onRegion as any);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <div style={{ width: 'min(520px,100%)', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 18px 40px rgba(15,23,42,.18)', padding: 18, display: 'grid', gap: 12, animation: 'scaleIn 260ms ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 17, color: '#0f172a' }}>Selecciona municipio</h3>
          <button onClick={() => setIsOpen(false)} aria-label="Cerrar" style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: '#334155' }}>×</button>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Elige el municipio operativo — todo el tablero se actualiza al instante.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, maxHeight: 260, overflow: 'auto', padding: 2 }}>
          {regions.map((r) => (
            <button
              key={r.slug}
              onClick={() => setSelected(r.slug)}
              style={{
                textAlign: 'center', padding: '14px 12px', borderRadius: 10, cursor: 'pointer', display: 'grid', placeItems: 'center',
                border: `1px solid ${selected === r.slug ? '#0f766e' : '#e2e8f0'}`,
                background: selected === r.slug ? '#0f766e' : '#fff',
                color: selected === r.slug ? '#fff' : '#0f172a',
                transition: 'all 150ms',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 16, color: 'inherit' }}>{r.name}</span>
            </button>
          ))}
        </div>
        <button onClick={apply} disabled={!selected} style={{ border: 'none', borderRadius: 10, background: '#0f766e', color: '#fff', fontWeight: 600, padding: '10px 12px', cursor: 'pointer' }}>
          {loading ? 'Cargando municipios...' : 'Aplicar municipio'}
        </button>
      </div>
      <style>{`@keyframes scaleIn{from{transform:scale(.96); opacity:0} to{transform:scale(1); opacity:1}}`}</style>
    </div>
  );
}
