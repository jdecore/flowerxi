import React, { useEffect, useState } from 'react';

export default function ImpactoOperacionReact({ initialRegion = 'madrid' }: { initialRegion?: string }) {
  const [region, setRegion] = useState(initialRegion);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [weatherCtx, setWeatherCtx] = useState<any>(null);

  useEffect(() => {
    const s = localStorage.getItem('flowerxi_region') || initialRegion;
    setRegion(s);
    setGeminiKey(localStorage.getItem('flowerxi_gemini_key') || '');
    setOpenrouterKey(localStorage.getItem('flowerxi_openrouter_key') || '');
    loadWeatherCtx(s);
    const h = (e: any) => {
      const slug = e.detail || localStorage.getItem('flowerxi_region') || initialRegion;
      setRegion(slug);
      loadWeatherCtx(slug);
    };
    window.addEventListener('regionchange', h);
    return () => window.removeEventListener('regionchange', h);
  }, []);

  const loadWeatherCtx = async (slug: string) => {
    try {
      const res = await fetch('/data/weather.json');
      const all: any[] = await res.json();
      const hist = all.filter((d) => d.region_slug === slug).sort((a, b) => String(b.observed_on).localeCompare(String(a.observed_on))).slice(0, 7);
      if (!hist.length) { setWeatherCtx(null); return; }
      const latest = hist[0];
      const score = Math.round((latest.fungal_risk * 0.5 + latest.waterlogging_risk * 0.3 + latest.heat_risk * 0.2));
      setWeatherCtx({
        municipio: slug,
        ultima_fecha: latest.observed_on,
        temp_media: latest.temp_mean_c,
        precip: latest.precipitation_mm,
        riesgo_fungico: latest.fungal_risk,
        riesgo_agua: latest.waterlogging_risk,
        score_combinado: score,
        hist_7d: hist.map((d) => ({ fecha: d.observed_on, fungal: d.fungal_risk, agua: d.waterlogging_risk })),
      });
    } catch { setWeatherCtx(null); }
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setAnalysis(null);
    setError(null);
    setProviderUsed(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const saveKeys = async () => {
    const mod = await import('../lib/ai/multimodal.js');
    mod.setGeminiKey(geminiKey);
    mod.setOpenRouterKey(openrouterKey);
  };

  const analyze = async () => {
    if (!file) { setError('Selecciona una foto de la flor/hoja primero.'); return; }
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      await saveKeys();
      const mod = await import('../lib/ai/multimodal.js');
      const ctx = { region, ...weatherCtx, extra: extraPrompt };
      const res = await mod.analyzeFlowerWithFallback(file, ctx, extraPrompt);
      setAnalysis(res.text);
      setProviderUsed(res.provider);
    } catch (e: any) {
      setError(e.message || 'Error en análisis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, display: 'grid', gap: 14, boxShadow: '0 1px 3px rgba(15,23,42,.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>🌹 Análisis floral con IA <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', borderRadius: 999, padding: '2px 7px', border: '1px solid #fde68a' }}>Gemini 3.5 Flash Lite → Nemotron 3.5 Lightning:free</span></h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Foto de flor/hoja/tallo en <strong style={{ color: '#0f172a' }}>{region}</strong> {weatherCtx ? `• ${weatherCtx.temp_media}°C, precip ${weatherCtx.precip}mm, score ${weatherCtx.score_combinado}` : ''} — te da diagnóstico, severidad y tratamiento.</p>
        </div>
        <span style={{ fontSize: 11, background: '#ecfdf5', color: '#065f46', borderRadius: 999, padding: '4px 8px', border: '1px solid #a7f3d0' }}>Prompt especializado Botrytis / Mildiu / Roya</span>
      </div>

      {/* Upload */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
        style={{ border: `2px dashed ${preview ? '#0f766e' : '#cbd5e1'}`, borderRadius: 12, padding: preview ? 12 : 22, background: preview ? '#f0fdfa' : '#f8fafc', display: 'grid', gap: 10, textAlign: 'center' }}
      >
        {!preview ? (
          <>
            <p style={{ margin: 0, fontSize: 14, color: '#334155' }}>Arrastra la foto o haz clic para seleccionar</p>
            <label style={{ display: 'inline-block', background: '#0f766e', color: '#fff', borderRadius: 10, padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0] || null)} /> 📷 Seleccionar foto
            </label>
            <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Tip: luz natural, enfoque en botón/hoja, sin zoom excesivo. JPG/PNG hasta 8MB.</p>
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, textAlign: 'left', alignItems: 'start' }}>
            <img src={preview} alt="preview" style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 10, border: '1px solid #e2e8f0' }} />
            <div style={{ display: 'grid', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#334155' }}><strong>{file?.name}</strong> • {(file ? (file.size / 1024).toFixed(0) : '?')} KB</p>
              <textarea placeholder="Detalle opcional: ej. 'manchas marrones en pétalos hace 2 días, invernadero con poca ventilación'" value={extraPrompt} onChange={(e) => setExtraPrompt(e.target.value)} rows={2} style={{ width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', padding: 8, fontSize: 13 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={analyze} disabled={loading} style={{ background: '#0f766e', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontWeight: 600, cursor: 'pointer', flex: 1 }}>{loading ? 'Analizando (Gemini → Nemotron)...' : 'Analizar flor'}</button>
                <button onClick={() => { setFile(null); setPreview(null); setAnalysis(null); setError(null); }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', cursor: 'pointer' }}>Quitar</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Keys BYOK */}
      <details style={{ fontSize: 12, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 10px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>🔑 Keys BYOK (Gemini / OpenRouter) — clic para configurar</summary>
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#475569' }}>Gemini API key (para gemini-3.5-flash-lite)</span>
            <input value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} onBlur={saveKeys} placeholder="AIza..." style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 7, fontSize: 13 }} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#475569' }}>OpenRouter API key (fallback nvidia/nemotron-3.5-lightning:free)</span>
            <input value={openrouterKey} onChange={(e) => setOpenrouterKey(e.target.value)} onBlur={saveKeys} placeholder="sk-or-v1-..." style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 7, fontSize: 13 }} />
          </label>
          <small style={{ color: '#94a3b8' }}>Se guardan solo en tu navegador (localStorage). También puedes definir <code>PUBLIC_GEMINI_API_KEY</code> / <code>PUBLIC_OPENROUTER_API_KEY</code> en Vercel. Si Gemini falla por cuota, usa automáticamente Nemotron gratis.</small>
        </div>
      </details>

      {/* Resultado */}
      {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, fontSize: 13, color: '#92400e' }}><span style={{ width: 16, height: 16, border: '2px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> Analizando con prompt fitopatológico…</div>}
      {error && <div style={{ padding: 12, background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 10, color: '#991b1b', fontSize: 13 }}>{error}</div>}
      {analysis && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, background: '#ecfdf5', color: '#065f46', borderRadius: 999, padding: '3px 8px', border: '1px solid #a7f3d0' }}>✓ Análisis listo</span>
            {providerUsed && <span style={{ fontSize: 11, background: '#f1f5f9', color: '#334155', borderRadius: 999, padding: '3px 8px', border: '1px solid #e2e8f0' }}>{providerUsed}</span>}
            <button onClick={() => navigator.clipboard?.writeText(analysis)} style={{ marginLeft: 'auto', fontSize: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' }}>Copiar</button>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 1.6, color: '#1e293b', whiteSpace: 'pre-wrap', maxHeight: 420, overflow: 'auto' }}>{analysis}</div>
          <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>⚠️ Recomendación orientativa. Verifica dosis en etiqueta y consulta técnico local antes de aplicar.</p>
        </div>
      )}
      {!analysis && !loading && !error && (
        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', textAlign: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: 8 }}>Sube una foto para obtener diagnóstico + tratamiento especializado. El prompt correlaciona clima Flowerxi de {region}.</p>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
