import React, { useEffect, useState } from 'react';

export default function ImpactoOperacionReact({ initialRegion = 'madrid' }: { initialRegion?: string }) {
  const [region, setRegion] = useState(initialRegion);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = localStorage.getItem('flowerxi_region') || initialRegion;
    setRegion(s);
    const h = (e: any) => setRegion(e.detail || localStorage.getItem('flowerxi_region') || initialRegion);
    window.addEventListener('regionchange', h);
    return () => window.removeEventListener('regionchange', h);
  }, []);

  const onFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setAnalysis(null);
    setError(null);
    setPreview(URL.createObjectURL(f));
  };

  const analyze = async () => {
    if (!file) { setError('Selecciona una foto.'); return; }
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const mod = await import('../lib/ai/multimodal.js');
      // carga contexto breve para prompt (clima)
      let ctx: any = { region };
      try {
        const res = await fetch('/data/weather.json');
        const all: any[] = await res.json();
        const latest = all.filter((d: any) => d.region_slug === region).sort((a: any, b: any) => String(b.observed_on).localeCompare(String(a.observed_on)))[0];
        if (latest) ctx = { ...ctx, temp: latest.temp_mean_c, precip: latest.precipitation_mm, score: Math.round(latest.fungal_risk * 0.5 + latest.waterlogging_risk * 0.3 + latest.heat_risk * 0.2) };
      } catch {}
      const res = await mod.analyzeFlowerWithFallback(file, ctx);
      setAnalysis(res.text);
    } catch (e: any) {
      setError(e.message || 'Error en análisis. Verifica keys en Vercel.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,.06)' }}>
      <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid #f1f5f9' }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>🌹 Análisis floral <span style={{ fontWeight: 400, color: '#64748b', fontSize: 13 }}>— foto, diagnóstico y tratamiento</span></h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>En {region} • sube una foto y obtén diagnóstico en segundos</p>
      </div>

      <div style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
          style={{
            border: `1.5px dashed ${preview ? '#0f766e' : '#cbd5e1'}`,
            borderRadius: 14,
            background: preview ? '#f0fdfa' : '#fbfdff',
            padding: preview ? 14 : 28,
            display: 'grid', placeItems: 'center', textAlign: 'center', gap: 10,
          }}
        >
          {!preview ? (
            <>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e6f7f5', display: 'grid', placeItems: 'center', fontSize: 20 }}>📷</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Arrastra tu foto aquí</p>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>o selecciona desde tu dispositivo</p>
              <label style={{ marginTop: 4, background: '#0f766e', color: '#fff', borderRadius: 999, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0] || null)} /> Seleccionar foto
              </label>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', width: '100%', textAlign: 'left' }}>
              <img src={preview} alt="preview" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12, border: '1px solid #e2e8f0', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file?.name}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={analyze} disabled={loading} style={{ flex: 1, background: '#0f766e', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{loading ? 'Analizando…' : 'Analizar'}</button>
                  <button onClick={() => { setFile(null); setPreview(null); setAnalysis(null); setError(null); }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}>Cambiar</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, color: '#334155' }}>
            <span style={{ width: 18, height: 18, border: '2px solid #0f766e', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .8s linear infinite' }} />
            Analizando con IA especializada…
          </div>
        )}
        {error && <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#991b1b', fontSize: 13 }}>{error}</div>}
        {analysis && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 1.65, color: '#1e293b', whiteSpace: 'pre-wrap', maxHeight: 380, overflow: 'auto' }}>{analysis}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => navigator.clipboard?.writeText(analysis)} style={{ fontSize: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Copiar</button>
              <button onClick={() => { setFile(null); setPreview(null); setAnalysis(null); }} style={{ fontSize: 12, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Analizar otra</button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
