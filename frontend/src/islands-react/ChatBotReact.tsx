import React, { useEffect, useState } from 'react';

const STORAGE_REGION = 'flowerxi_region';
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

const toNumOrNull = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const riskScore = (item: any) => {
  const f = toNumOrNull(item?.fungal_risk), w = toNumOrNull(item?.waterlogging_risk), h = toNumOrNull(item?.heat_risk);
  if (f === null || w === null || h === null) return null;
  return Math.round(f * 0.5 + w * 0.3 + h * 0.2);
};

function fallbackConsejos(ctx: any) {
  const latest = ctx?._latest;
  const score = ctx?.operativo?.score;
  const temp = latest?.temp_mean_c;
  const precip = latest?.precipitation_mm;
  const tips: string[] = [];
  if (score !== null && score >= 70) {
    tips.push('Riego: suspende hoy y revisa drenaje; solo 3 L/m² a las 5:00 si el sustrato está seco.');
    tips.push('Ventilación: abre laterales 10:00–14:00 y poda sanitaria de botones con micelio.');
    tips.push('Control: aplica preventivo (clorotalonil 1.5 g/L) y repite inspección en 24 h.');
  } else if (score !== null && score >= 40) {
    tips.push(`Riego: ${precip > 2 ? 'reduce 30% hoy' : '4 L/m² a las 5:00'} — evita mojado nocturno.`);
    tips.push(`Ventilación: ${temp !== null && temp < 14 ? 'cierra 30% en madrugada para evitar condensación' : 'abre 10:00–15:00 para bajar HR'}.`);
    tips.push('Monitoreo: revisa envés de hojas y botones cada mañana; registra humedad relativa.');
  } else {
    tips.push('Riego: mantén 4–5 L/m² a las 05:00, fertirriego balanceado NPK.');
    tips.push('Ventilación: rutina normal 10:00–14:00, sin cambios.');
    tips.push('Poda: pinzado ligero y desinfección de tijeras con alcohol 70%.');
  }
  return tips;
}

export default function ChatBotReact() {
  const [region, setRegion] = useState('madrid');
  const [summary, setSummary] = useState<string | null>(null);
  const [consejos, setConsejos] = useState<string[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelName, setModelName] = useState('');
  const [modelError, setModelError] = useState('');
  const [autoStatus, setAutoStatus] = useState('Generando resumen local...');

  const loadContext = async (slug: string) => {
    const [weather, regionsRaw] = await Promise.all([
      fetch('/data/weather.json').then((r) => r.json()),
      fetch('/data/regions.json').then((r) => r.json()).catch(() => DEFAULT_REGIONS),
    ]);
    const hist = (weather as any[]).filter((d) => d.region_slug === slug).sort((a, b) => String(b.observed_on).localeCompare(String(a.observed_on))).slice(0, 14);
    const latest = hist[0] || null;
    const score = latest ? riskScore(latest) : null;
    const status = score === null ? 'Sin datos' : score >= 70 ? 'Acción' : score >= 40 ? 'Vigilancia' : 'Rutina';
    const reason = latest ? (latest.fungal_risk >= latest.waterlogging_risk && latest.fungal_risk >= latest.heat_risk ? 'riesgo fúngico' : latest.waterlogging_risk >= latest.fungal_risk && latest.waterlogging_risk >= latest.heat_risk ? 'encharcamiento' : 'riesgo térmico') : 'Sin datos';
    return { region: slug, operativo: { status, score, reason }, today: latest, hist, _latest: latest, regions: regionsRaw };
  };

  const ensureModel = async () => {
    if (modelReady || modelLoading) return null;
    setModelLoading(true);
    setModelError('');
    try {
      const mod = await import('../lib/ai/transformers.js');
      const eng = await mod.getTransformersModel((p: any) => {});
      setModelName(mod.getLoadedModelId() || 'LFM2.5-230M');
      setModelReady(true);
      return mod;
    } catch (e: any) {
      setModelError(e.message || 'no disponible');
      return null;
    } finally {
      setModelLoading(false);
    }
  };

  const generate = async (slug: string, withModel = true) => {
    setLoading(true);
    setAutoStatus('Leyendo clima y riesgo...');
    try {
      const ctx = await loadContext(slug);
      const latest = ctx.today;
      const score = ctx.operativo.score;
      const status = ctx.operativo.status;
      setMeta({ date: latest?.observed_on, temp: latest?.temp_mean_c, precip: latest?.precipitation_mm, score, status, region: slug });

      // Intenta modelo local si se pide
      let text: string | null = null;
      if (withModel) {
        setAutoStatus('Activando LFM2.5 local...');
        const mod = await ensureModel();
        if (mod) {
          try {
            setAutoStatus('Generando resumen con LFM2.5...');
            const ctxSummary = { region: ctx.region, operativo: ctx.operativo, today: ctx.today ? { date: ctx.today.observed_on, temp: ctx.today.temp_mean_c, precip: ctx.today.precipitation_mm, fungal: ctx.today.fungal_risk, water: ctx.today.waterlogging_risk, heat: ctx.today.heat_risk } : null };
            const out = await mod.generateAnswer(`Resumen de hoy en ${slug} + 3 consejos de cultivo hiper-locales (riego, ventilación, control)`, ctxSummary);
            if (out && out.trim().length > 20) text = out.trim();
          } catch {}
        }
      }

      if (text) {
        // Intenta separar resumen y 3 bullets si el modelo devuelve bloque
        const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
        const first = lines[0] || `Hoy en ${slug}: ${status} (${score ?? '—'}) por ${ctx.operativo.reason}.`;
        const bullets = lines.length > 2 ? lines.slice(1, 4) : fallbackConsejos(ctx);
        setSummary(first);
        setConsejos(bullets);
      } else {
        const fallback = latest ? `Hoy en ${slug}: ${status} (${score ?? '—'}) — ${ctx.operativo.reason}. Temp ${latest.temp_mean_c}°C, lluvia ${latest.precipitation_mm}mm.` : `Sin datos para ${slug}.`;
        setSummary(fallback);
        setConsejos(fallbackConsejos(ctx));
      }
      setAutoStatus('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const s = localStorage.getItem(STORAGE_REGION) || 'madrid';
    setRegion(s);
    generate(s, true);
    const h = (e: any) => {
      const slug = e.detail || localStorage.getItem(STORAGE_REGION) || 'madrid';
      setRegion(slug);
      generate(slug, false);
    };
    window.addEventListener('regionchange', h);
    window.addEventListener('flowerxi:refresh', () => generate(localStorage.getItem(STORAGE_REGION) || s, false));
    return () => { window.removeEventListener('regionchange', h); };
  }, []);

  const retryModel = () => generate(region, true);

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,.06)', display: 'grid', gap: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: modelReady ? '#0f766e' : modelLoading ? '#f59e0b' : '#94a3b8', display: 'inline-block', animation: modelLoading ? 'pulse 1s infinite' : undefined }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Resumen automático</span>
          <span style={{ fontSize: 11, background: '#e6f7f5', color: '#0f766e', borderRadius: 999, padding: '2px 6px', border: '1px solid #b2dfdb' }}>LFM2.5 local</span>
        </div>
        <span style={{ fontSize: 11, color: '#64748b' }}>{region} • {meta?.date || ''}</span>
      </div>

      {modelLoading && <div style={{ padding: '6px 14px', fontSize: 12, color: '#92400e', background: '#fef3c7', borderBottom: '1px solid #fde68a' }}>Cargando LFM2.5-230M local… primer uso ~150MB, luego cache.</div>}
      {modelError && <div style={{ padding: '6px 14px', fontSize: 12, color: '#991b1b', background: '#fee2e2', borderBottom: '1px solid #fecaca' }}>Modelo local no disponible: {modelError} — mostrando fallback determinístico.</div>}
      {modelReady && <div style={{ padding: '4px 14px', fontSize: 11, color: '#065f46', background: '#ecfdf5', borderBottom: '1px solid #a7f3d0' }}>✓ {modelName} activo — resumen generado localmente</div>}

      <div style={{ padding: 14, display: 'grid', gap: 10 }}>
        {loading ? (
          <>
            <div style={{ height: 18, borderRadius: 6, background: '#e2e8f0', width: '80%' }} />
            <div style={{ height: 12, borderRadius: 6, background: '#f1f5f9' }} />
            <div style={{ height: 12, borderRadius: 6, background: '#f1f5f9', width: '90%' }} />
          </>
        ) : (
          <>
            {summary && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: '#0f172a', fontWeight: 500 }}>{summary}</p>}
            {meta && <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Clima: {meta.temp}°C • lluvia {meta.precip}mm • score {meta.score ?? '—'} • {meta.status}</p>}
            <div style={{ display: 'grid', gap: 6, marginTop: 2 }}>
              {consejos.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 10px' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#0f766e', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.45 }}>{c}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => generate(region, !modelReady)} disabled={loading || modelLoading} style={{ border: 'none', borderRadius: 8, background: '#0f766e', color: '#fff', fontWeight: 600, padding: '7px 12px', fontSize: 13, cursor: 'pointer' }}>{loading ? 'Generando...' : modelReady ? 'Regenerar con LFM2.5' : 'Probar LFM2.5 local'}</button>
        <button onClick={() => generate(region, false)} disabled={loading} style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', padding: '7px 10px', fontSize: 13, cursor: 'pointer' }}>Actualizar datos</button>
        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{autoStatus || 'Auto-generado al cambiar municipio'}</span>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}
