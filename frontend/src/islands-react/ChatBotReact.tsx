import React, { useEffect, useRef, useState } from 'react';

const STORAGE_REGION = 'flowerxi_region';
const CHAT_KEY = 'flowerxi_chat';
const MAX_MSG = 30;
const NO_DATA = 'No pude cargar datos operativos en este momento. Verifica conexión e intenta nuevamente.';
const DEFAULT_REGIONS = [
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

const normalize = (v: string) =>
  String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const hasUseful = (v: string) => {
  const t = normalize(v);
  return !!t && t !== 'sin datos' && t !== 'datos no disponibles' && t !== 'no disponible';
};

const toNumOrNull = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const riskScore = (item: any) => {
  const f = toNumOrNull(item?.fungal_risk), w = toNumOrNull(item?.waterlogging_risk), h = toNumOrNull(item?.heat_risk);
  if (f === null || w === null || h === null) return null;
  return Math.round(f * 0.5 + w * 0.3 + h * 0.2);
};
const labelFromSlug = (slug: string) =>
  String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
    .join(' ');

export default function ChatBotReact({ embedded = true }: { embedded?: boolean }) {
  const [region, setRegion] = useState('madrid');
  const [history, setHistory] = useState<{ q: string; a: string; timestamp: string }[]>([]);
  const [input, setInput] = useState('');
  const [answering, setAnswering] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [modelName, setModelName] = useState('');
  const [modelError, setModelError] = useState('');
  const [provider, setProvider] = useState<'gemini' | 'openrouter'>('gemini');
  const [visionStatus, setVisionStatus] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const engineRef = useRef<any>(null);
  const contextCache = useRef<any>(null);

  // load history + region
  useEffect(() => {
    setRegion(localStorage.getItem(STORAGE_REGION) || 'madrid');
    setGeminiKey(localStorage.getItem('flowerxi_gemini_key') || '');
    setOpenrouterKey(localStorage.getItem('flowerxi_openrouter_key') || '');
    try {
      const saved = localStorage.getItem(CHAT_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) setHistory(parsed.slice(-MAX_MSG));
    } catch {}
    const h = (e: any) => setRegion(e.detail || localStorage.getItem(STORAGE_REGION) || 'madrid');
    const open = () => {
      document.getElementById('chat-section-react')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      ensureModel();
    };
    window.addEventListener('regionchange', h);
    window.addEventListener('openchat', open);
    return () => {
      window.removeEventListener('regionchange', h);
      window.removeEventListener('openchat', open);
    };
  }, []);

  const persist = (next: typeof history) => localStorage.setItem(CHAT_KEY, JSON.stringify(next.slice(-MAX_MSG)));
  const append = (q: string, a: string) => {
    setHistory((prev) => {
      const next = [...prev, { q, a, timestamp: new Date().toISOString() }];
      persist(next);
      return next;
    });
  };
  const clear = () => {
    setHistory([]);
    localStorage.removeItem(CHAT_KEY);
  };

  // context loader (frontend-only via /data)
  const loadContext = async () => {
    // fetch weather history 14, regions
    const [weather, regionsRaw] = await Promise.all([
      fetch('/data/weather.json').then((r) => r.json()),
      fetch('/data/regions.json').then((r) => r.json()).catch(() => DEFAULT_REGIONS),
    ]);
    const hist = (weather as any[]).filter((d) => d.region_slug === region).sort((a, b) => String(b.observed_on).localeCompare(String(a.observed_on))).slice(0, 14);
    const latest = hist[0] || null;
    const regions = Array.isArray(regionsRaw) ? regionsRaw : DEFAULT_REGIONS;
    // operativo score
    const score = latest ? riskScore(latest) : null;
    const status = score === null ? 'Sin datos' : score >= 70 ? 'Acción requerida' : score >= 40 ? 'Vigilancia reforzada' : 'Rutina normal';
    const reason = latest ? (latest.fungal_risk >= latest.waterlogging_risk && latest.fungal_risk >= latest.heat_risk ? 'riesgo fúngico' : latest.waterlogging_risk >= latest.fungal_risk && latest.waterlogging_risk >= latest.heat_risk ? 'encharcamiento' : 'riesgo térmico') : 'Sin datos';
    const action = latest?.recommendation_message || (score !== null && score >= 70 ? 'Inspección prioritaria hoy' : score !== null && score >= 40 ? 'Refuerza ventilación' : 'Mantén rutina');
    // humid top
    const latestBy: Record<string, any> = {};
    (weather as any[]).forEach((d) => {
      if (!latestBy[d.region_slug] || d.observed_on > latestBy[d.region_slug].observed_on) latestBy[d.region_slug] = d;
    });
    const humidTop = Object.entries(latestBy)
      .map(([slug, d]: any) => ({ slug, name: regions.find((r: any) => r.slug === slug)?.name || slug, water: d.waterlogging_risk }))
      .sort((a: any, b: any) => b.water - a.water)[0];

    const ctx = {
      region,
      operativo: { status, score, reason, action },
      today: latest ? { date: latest.observed_on, temp: latest.temp_mean_c, precip: latest.precipitation_mm, fungal: latest.fungal_risk, waterlogging: latest.waterlogging_risk, heat: latest.heat_risk } : null,
      humidTop: humidTop ? `${humidTop.name} (${Math.round(humidTop.water)} pts)` : null,
      municipalities: regions.map((r: any) => r.name),
      _regionsRaw: regions,
      _latest: latest,
    };
    contextCache.current = ctx;
    return ctx;
  };

  const quickAnswer = (q: string, ctx: any) => {
    const n = normalize(q);
    const compact = n.replace(/\s+/g, '');
    const score = ctx?.operativo?.score;
    const status = ctx?.operativo?.status;
    const action = ctx?.operativo?.action;
    const reason = ctx?.operativo?.reason;
    const humidTop = ctx?.humidTop;
    const latest = ctx?._latest;
    const asksMun = n.includes('municipio') && (n.includes('hay') || n.includes('lista') || n.includes('cuales') || n.includes('disponible'));
    if (asksMun) {
      const names = ctx.municipalities?.join(', ');
      return `Municipios: ${names}. Actual: ${ctx.region}`;
    }
    if (n.includes('que puedes hacer') || n.includes('que haces') || compact.includes('quehaces')) return 'Puedo ayudarte con: riesgo hoy, recomendación, por qué subió, lluvia/temperatura y lista de municipios.';
    if (n.includes('riesgo hoy') || n.includes('como esta el riesgo')) {
      if (score !== null && score !== undefined) return `Hoy en ${ctx.region} el riesgo está en ${status} (${score}).`;
      if (latest) return `Aún no tengo score para ${ctx.region}. Último dato: lluvia ${latest.precipitation_mm} mm, temp ${latest.temp_mean_c}°C.`;
    }
    if (n.includes('que debo hacer') || n.includes('que hago hoy') || n.includes('recomendacion') || (n.includes('hoy') && n.includes('hago'))) {
      if (hasUseful(action)) return `Acción recomendada hoy: ${action}`;
      return `Estado: ${status} (${score ?? '—'}). ${reason}`;
    }
    if (n.includes('donde hay mas humedad')) return humidTop ? `Mayor humedad: ${humidTop}` : 'No hay datos humedad';
    if (n.includes('por que')) return reason ? `El riesgo sube por: ${reason}` : 'No hay explicación';
    if (n.includes('lluvia') || n.includes('temperatura')) {
      if (!latest) return 'No hay observación reciente.';
      return `Último dato en ${ctx.region}: lluvia ${latest.precipitation_mm} mm, temp ${latest.temp_mean_c}°C.`;
    }
    return '';
  };

  const fallback = (ctx: any) => {
    const s = ctx?.operativo?.score, l = ctx?.operativo?.status, a = ctx?.operativo?.action, r = ctx?.operativo?.reason;
    if ((s === null || s === undefined) && !hasUseful(a) && !hasUseful(r)) {
      const latest = ctx?._latest;
      if (latest) return `Sin score. Último dato: lluvia ${latest.precipitation_mm} mm, temp ${latest.temp_mean_c}°C.`;
      return NO_DATA;
    }
    return `Estado: ${l} (${s ?? '—'}). ${r} Acción: ${a}`.trim();
  };

  const ensureModel = async () => {
    if (modelReady || modelLoading) return;
    setModelLoading(true);
    setModelError('');
    setProgress(0);
    try {
      const mod = await import('../lib/ai/transformers.js');
      const eng = await mod.getTransformersModel((p: any) => {
        const v = Number(p?.progress ?? 0);
        if (Number.isFinite(v) && v <= 1) setProgress(Math.round(v * 100));
      });
      engineRef.current = eng;
      setModelName(mod.getLoadedModelId() || 'LFM2.5-230M');
      setModelReady(true);
    } catch (e: any) {
      setModelError(e.message || 'falló carga modelo');
      setModelReady(false);
    } finally {
      setModelLoading(false);
    }
  };

  const ask = async () => {
    const q = input.trim();
    if (!q || answering) return;
    setInput('');
    setAnswering(true);
    try {
      const ctx = await loadContext();
      const quick = quickAnswer(q, ctx);
      if (quick) { append(q, quick); return; }
      await ensureModel();
      if (!modelReady || !engineRef.current) { append(q, fallback(ctx)); return; }
      // try transformers generate
      try {
        const mod = await import('../lib/ai/transformers.js');
        const ans = await mod.generateAnswer(q, { region: ctx.region, operativo: { status: ctx.operativo.status, score: ctx.operativo.score, reason: ctx.operativo.reason, action: ctx.operativo.action }, today: ctx.today, humidTop: ctx.humidTop, municipalities: ctx.municipalities });
        if (ans && ans.trim()) { append(q, ans.trim()); return; }
      } catch {}
      append(q, fallback(ctx));
    } catch (e) {
      append(q, 'No tengo datos suficientes ahora.');
    } finally {
      setAnswering(false);
    }
  };

  const handleVision = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVisionStatus('Analizando foto...');
    try {
      const ctx = await loadContext();
      const mod = await import('../lib/ai/multimodal.js');
      const prompt = input.trim() || 'Describe riesgo fitosanitario visible y recomienda acción para flor de corte';
      const ans = provider === 'gemini' ? await mod.callGeminiVision(file, prompt, { region, ctx }) : await mod.callOpenRouterVision(file, prompt, { region, ctx });
      append(`[Foto: ${file.name}] ${prompt}`, ans);
      setVisionStatus('Listo');
      setTimeout(() => setVisionStatus(''), 2000);
    } catch (err: any) {
      setVisionStatus(err.message || 'Error visión');
    } finally {
      e.target.value = '';
    }
  };

  const saveKeys = async () => {
    const mod = await import('../lib/ai/multimodal.js');
    mod.setGeminiKey(geminiKey);
    mod.setOpenRouterKey(openrouterKey);
  };

  return (
    <div id={embedded ? 'chat-section-react' : undefined} style={{ border: '1px solid #e2e8f0', borderRadius: 14, background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,.06)', display: 'flex', flexDirection: 'column', minHeight: 460 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottom: '1px solid #e2e8f0' }}>
        <div><h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>FlowerxiBot (React)</h3><p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>LFM2.5-230M local • 100% navegador</p></div>
        <button onClick={clear} style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: 'transparent', padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>Limpiar</button>
      </div>
      <div style={{ padding: '6px 12px', fontSize: 12, color: modelReady ? '#166534' : modelError ? '#b45309' : '#64748b', borderBottom: '1px solid #f1f5f9' }}>
        {modelLoading ? `Cargando LFM2.5 ${progress ? `(${progress}%)` : '...'}` : modelReady ? `Modelo activo: ${modelName}` : modelError ? `Modelo no disponible: ${modelError} — usando fallback` : 'Fallback con datos reales; modelo se activa al preguntar.'}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'grid', gap: 8, maxHeight: 320 }}>
        {history.length === 0 && <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Pregunta: “¿Cómo está el riesgo hoy?”, “¿Qué debo hacer?” o sube una foto.</p>}
        {history.map((m, i) => (
          <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 8, background: '#f8fafc' }}>
            <p style={{ margin: 0, fontSize: 13 }}><strong>Tú:</strong> {m.q}</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#0f766e' }}><strong>Bot:</strong> {m.a}</p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>{new Date(m.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 8, padding: 12, borderTop: '1px solid #e2e8f0' }}>
        <textarea ref={inputRef} rows={2} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }} placeholder="Ej: ¿Qué acción recomiendas hoy?" disabled={answering} style={{ width: '100%', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', padding: '8px 10px', fontSize: 13, resize: 'vertical', minHeight: 56 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '6px 10px', background: '#f8fafc', cursor: 'pointer', fontSize: 12 }}>
            <input type="file" accept="image/*" capture="environment" onChange={handleVision} hidden /> 📷 Foto
          </label>
          <select value={provider} onChange={(e) => setProvider(e.target.value as any)} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 6, fontSize: 12 }}>
            <option value="gemini">Gemini Flash</option>
            <option value="openrouter">OpenRouter Nemotron</option>
          </select>
          <button onClick={ask} disabled={answering} style={{ flex: 1, border: 'none', borderRadius: 10, background: '#0f766e', color: '#fff', fontWeight: 600, padding: '8px 12px', cursor: 'pointer' }}>{answering ? 'Pensando...' : 'Enviar'}</button>
        </div>
        {visionStatus && <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{visionStatus}</p>}
        <details style={{ fontSize: 12, color: '#64748b' }}><summary style={{ cursor: 'pointer' }}>🔑 Keys BYOK</summary><div style={{ display: 'grid', gap: 6, marginTop: 6 }}><input placeholder="Gemini API key" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} onBlur={saveKeys} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 6 }} /><input placeholder="OpenRouter API key" value={openrouterKey} onChange={(e) => setOpenrouterKey(e.target.value)} onBlur={saveKeys} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 6 }} /><small>Se guardan en localStorage. También PUBLIC_ env.</small></div></details>
      </div>
    </div>
  );
}
