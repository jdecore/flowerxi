import React, { useEffect, useState } from 'react';

const STORAGE_REGION = 'flowerxi_region';

const toNumOrNull = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const riskScore = (item: any) => {
  const f = toNumOrNull(item?.fungal_risk), w = toNumOrNull(item?.waterlogging_risk), h = toNumOrNull(item?.heat_risk);
  if (f === null || w === null || h === null) return null;
  return Math.round(f * 0.5 + w * 0.3 + h * 0.2);
};

type AgentKey = 'riego' | 'sanidad' | 'manejo';
type AgentState = { key: AgentKey; label: string; icon: string; color: string; model: string; answer: string | null; loading: boolean; error: string | null };

export default function ChatBotReact() {
  const [region, setRegion] = useState('madrid');
  const [meta, setMeta] = useState<any>(null);
  const [agents, setAgents] = useState<AgentState[]>([
    { key: 'riego', label: 'Riego & Sustrato', icon: '💧', color: '#0f766e', model: 'LFM2.5-230M', answer: null, loading: false, error: null },
    { key: 'sanidad', label: 'Sanidad & Clima', icon: '🛡️', color: '#b45309', model: 'DistilGPT2 82M', answer: null, loading: false, error: null },
    { key: 'manejo', label: 'Manejo & Cosecha', icon: '✂️', color: '#334155', model: 'GPT2 124M', answer: null, loading: false, error: null },
  ]);
  const [consenso, setConsenso] = useState<string | null>(null);
  const [consensoLoading, setConsensoLoading] = useState(false);
  const [overallState, setOverallState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [overallError, setOverallError] = useState('');

  const loadContext = async (slug: string) => {
    const [weather] = await Promise.all([fetch('/data/weather.json').then((r) => r.json())]);
    const hist = (weather as any[]).filter((d) => d.region_slug === slug).sort((a, b) => String(b.observed_on).localeCompare(String(a.observed_on))).slice(0, 14);
    const latest = hist[0] || null;
    const score = latest ? riskScore(latest) : null;
    const status = score === null ? 'Sin datos' : score >= 70 ? 'Acción' : score >= 40 ? 'Vigilancia' : 'Rutina';
    const reason = latest ? (latest.fungal_risk >= latest.waterlogging_risk && latest.fungal_risk >= latest.heat_risk ? 'riesgo fúngico' : latest.waterlogging_risk >= latest.fungal_risk && latest.waterlogging_risk >= latest.heat_risk ? 'encharcamiento' : 'riesgo térmico') : 'Sin datos';
    const ctxSummary = {
      region: slug,
      operativo: { status, score, reason },
      today: latest ? { date: latest.observed_on, temp: latest.temp_mean_c, precip: latest.precipitation_mm, fungal: latest.fungal_risk, water: latest.waterlogging_risk, heat: latest.heat_risk } : null,
    };
    setMeta({ date: latest?.observed_on, temp: latest?.temp_mean_c, precip: latest?.precipitation_mm, score, status, region: slug, _ctxSummary: ctxSummary, _latest: latest });
    return { ctxSummary, latest, score, status, reason };
  };

  const runAgents = async (slug: string, withModel = true) => {
    setAgents((prev) => prev.map((a) => ({ ...a, loading: true, answer: null, error: null })));
    setConsenso(null);
    setConsensoLoading(false);

    const { ctxSummary } = await loadContext(slug);

    const fallbackFor = (key: AgentKey) => {
      const latest: any = (ctxSummary as any).today;
      const s: number | null = (ctxSummary as any).operativo.score;
      const temp = latest?.temp;
      const precip = latest?.precip;
      if (key === 'riego') {
        if (s !== null && s >= 70) return 'Suspende riego hoy; revisa drenaje. Si sustrato seco, 3 L/m² a las 5:00.';
        if (precip !== null && precip > 2) return 'Reduce riego 30% hoy por lluvia reciente; riega 4 L/m² a las 05:00.';
        return 'Riego 4–5 L/m² a las 05:00, fertirriego NPK balanceado.';
      }
      if (key === 'sanidad') {
        if (s !== null && s >= 60) return 'Riesgo sanitario alto: ventila 10:00–14:00 y aplica preventivo si score >60.';
        if (temp !== null && temp < 14) return 'Riesgo condensación: cierra 30% en madrugada, ventila mañana.';
        return 'Vigilancia fitosanitaria diaria, HR <80%.';
      }
      return s !== null && s >= 40 ? 'Poda sanitaria ligera y desinfección tijeras; cosecha en mañana fresca.' : 'Manejo rutina, pinzado y cosecha a primera hora.';
    };

    if (!withModel) {
      const answers: Record<AgentKey, string> = { riego: fallbackFor('riego'), sanidad: fallbackFor('sanidad'), manejo: fallbackFor('manejo') };
      setAgents((prev) => prev.map((a) => ({ ...a, loading: false, answer: answers[a.key] })));
      setConsenso(`• ${answers.riego}\n• ${answers.sanidad}\n• ${answers.manejo}`);
      return;
    }

    setOverallState('loading');
    let mod: any = null;
    try {
      mod = await import('../lib/ai/transformers.js');
      // precarga cada modelo distinto (paralelo, cada uno ~80-350MB, ligero por separado)
      await Promise.all([
        mod.getAgentModel('riego').catch(() => null),
        mod.getAgentModel('sanidad').catch(() => null),
        mod.getAgentModel('manejo').catch(() => null),
      ]);
      setOverallState('ready');
      // actualiza nombres reales de modelos cargados
      setAgents((prev) => prev.map((a) => ({ ...a, model: mod.getAgentDisplayName ? mod.getAgentDisplayName(a.key) : a.model })));
    } catch (e: any) {
      setOverallError(e.message || 'no disponible');
      setOverallState('error');
      const answers: Record<AgentKey, string> = { riego: fallbackFor('riego'), sanidad: fallbackFor('sanidad'), manejo: fallbackFor('manejo') };
      setAgents((prev) => prev.map((a) => ({ ...a, loading: false, answer: answers[a.key] })));
      setConsenso(`• ${answers.riego}\n• ${answers.sanidad}\n• ${answers.manejo}`);
      return;
    }

    const results: Record<AgentKey, string> = { riego: '', sanidad: '', manejo: '' };
    await Promise.all(
      (['riego', 'sanidad', 'manejo'] as AgentKey[]).map(async (key) => {
        try {
          const ans = await mod.generateAgentAnswer(key, ctxSummary);
          results[key] = ans || fallbackFor(key);
          setAgents((prev) => prev.map((a) => (a.key === key ? { ...a, loading: false, answer: results[key] } : a)));
        } catch (e: any) {
          results[key] = fallbackFor(key);
          setAgents((prev) => prev.map((a) => (a.key === key ? { ...a, loading: false, error: e.message || 'fallback', answer: results[key] } : a)));
        }
      })
    );

    setConsensoLoading(true);
    try {
      const c = await mod.generateConsensus(results, ctxSummary);
      setConsenso(c);
    } catch {
      setConsenso(`• ${results.riego}\n• ${results.sanidad}\n• ${results.manejo}`);
    } finally {
      setConsensoLoading(false);
    }
  };

  useEffect(() => {
    const s = localStorage.getItem(STORAGE_REGION) || 'madrid';
    setRegion(s);
    runAgents(s, true);
    const h = (e: any) => {
      const slug = e.detail || localStorage.getItem(STORAGE_REGION) || 'madrid';
      setRegion(slug);
      runAgents(slug, false);
    };
    window.addEventListener('regionchange', h);
    window.addEventListener('flowerxi:refresh', () => runAgents(localStorage.getItem(STORAGE_REGION) || s, false));
    return () => window.removeEventListener('regionchange', h);
  }, []);

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,.06)', display: 'grid', gap: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: overallState === 'ready' ? '#0f766e' : overallState === 'loading' ? '#f59e0b' : '#94a3b8', display: 'inline-block', animation: overallState === 'loading' ? 'pulse 1s infinite' : undefined }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Panel 3 Agentes — Modelos Distintos</span>
          <span style={{ fontSize: 10, background: '#e6f7f5', color: '#0f766e', borderRadius: 999, padding: '2px 7px', border: '1px solid #b2dfdb' }}>LFM2.5-230M · DistilGPT2 82M · GPT2 124M</span>
        </div>
        <span style={{ fontSize: 11, color: '#64748b' }}>{region} • {meta?.date || ''} • score {meta?.score ?? '—'}</span>
      </div>

      {overallState === 'loading' && <div style={{ padding: '6px 14px', fontSize: 12, color: '#92400e', background: '#fef3c7', borderBottom: '1px solid #fde68a' }}>Cargando 3 modelos locales… LFM2.5 + DistilGPT2 + GPT2 (~350MB total, luego cache).</div>}
      {overallState === 'error' && <div style={{ padding: '6px 14px', fontSize: 12, color: '#991b1b', background: '#fee2e2', borderBottom: '1px solid #fecaca' }}>Algún modelo no disponible: {overallError} — usando fallback (igual verás consenso).</div>}
      {overallState === 'ready' && <div style={{ padding: '4px 14px', fontSize: 11, color: '#065f46', background: '#ecfdf5', borderBottom: '1px solid #a7f3d0' }}>✓ 3 modelos activos — consenso experto de modelos diferentes</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, padding: 14 }}>
        {agents.map((a) => (
          <div key={a.key} style={{ border: `1px solid ${a.color}22`, borderLeft: `3px solid ${a.color}`, borderRadius: 12, padding: 12, background: '#fff', display: 'grid', gap: 8, minHeight: 150 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14 }}>{a.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{a.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, background: `${a.color}15`, color: a.color, borderRadius: 999, padding: '2px 6px', border: `1px solid ${a.color}30` }}>{a.loading ? 'pensando…' : a.model}</span>
            </div>
            {a.loading ? (
              <div style={{ display: 'grid', gap: 6 }}><div style={{ height: 12, borderRadius: 6, background: '#e2e8f0' }} /><div style={{ height: 12, borderRadius: 6, background: '#f1f5f9', width: '85%' }} /><div style={{ height: 12, borderRadius: 6, background: '#f1f5f9', width: '70%' }} /></div>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: '#334155' }}>{a.answer}</p>
            )}
            {a.error && <p style={{ margin: 0, fontSize: 10, color: '#b45309' }}>{a.error}</p>}
          </div>
        ))}
      </div>

      <div style={{ margin: '0 14px 14px', background: '#f0fdfa', border: '1px solid #a7f3d0', borderRadius: 12, padding: 14, display: 'grid', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#065f46', display: 'flex', alignItems: 'center', gap: 6 }}>🤝 Consenso Experto — 3 modelos distintos {consensoLoading && <span style={{ width: 12, height: 12, border: '2px solid #0f766e', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />}</h3>
        {consensoLoading ? (
          <div style={{ display: 'grid', gap: 6 }}><div style={{ height: 12, borderRadius: 6, background: '#ccfbf1' }} /><div style={{ height: 12, borderRadius: 6, background: '#d1fae5', width: '80%' }} /></div>
        ) : consenso ? (
          <pre style={{ margin: 0, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, lineHeight: 1.6, color: '#0f172a', whiteSpace: 'pre-wrap' }}>{consenso}</pre>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Generando consenso de los 3 modelos...</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', flexWrap: 'wrap' }}>
        <button onClick={() => runAgents(region, true)} style={{ border: 'none', borderRadius: 8, background: '#0f766e', color: '#fff', fontWeight: 600, padding: '7px 12px', fontSize: 13, cursor: 'pointer' }}>Regenerar 3 modelos</button>
        <button onClick={() => runAgents(region, false)} style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', padding: '7px 10px', fontSize: 13, cursor: 'pointer' }}>Solo fallback rápido</button>
        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>LFM2.5-230M + DistilGPT2 82M + GPT2 124M • consenso local</span>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}} @keyframes spin{to{transform:rotate(360deg)}} @media(max-width:900px){div[style*="repeat(3,1fr)"]{grid-template-columns:1fr !important}}`}</style>
    </div>
  );
}
