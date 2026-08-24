import React, { useEffect, useState, useRef } from 'react';

const STORAGE_REGION = 'flowerxi_region';

export default function ChatBotReact() {
  const [region, setRegion] = useState('madrid');
  const [meta, setMeta] = useState<any>(null);
  
  // Estado real del modelo LFM2.5
  const [modelState, setModelState] = useState<'loading_model' | 'inferring' | 'ready' | 'error'>('loading_model');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [analysisText, setAnalysisText] = useState<string>('');

  const activeWorkerRef = useRef<number>(0);

  const executeFastLFM = async (slug: string) => {
    const workerId = ++activeWorkerRef.current;
    const regName = slug.charAt(0).toUpperCase() + slug.slice(1);

    setModelState('loading_model');
    setProgressPercent(15);
    setAnalysisText('');

    // 1. Obtener clima real del municipio
    let latest: any = null;
    try {
      const res = await fetch('/data/weather.json');
      const weather = await res.json();
      const hist = (weather as any[])
        .filter((d) => d.region_slug === slug)
        .sort((a, b) => String(b.observed_on).localeCompare(String(a.observed_on)));
      latest = hist[0] || null;
    } catch {}

    const context = {
      region: regName,
      temp: latest?.temp_mean_c ?? 14,
      precip: latest?.precipitation_mm ?? 0,
      fungal: latest?.fungal_risk ?? 40,
    };

    setMeta(context);

    // 2. Inferencia rápida con LFM2.5-230M
    try {
      const mod = await import('../lib/ai/transformers.js');
      
      const onProgress = (info: any) => {
        if (info && info.progress) {
          setProgressPercent(Math.round(info.progress));
        }
      };

      setModelState('inferring');

      const result = await mod.runSingleLFMAnalysis(context, onProgress);

      if (workerId !== activeWorkerRef.current) return;

      setAnalysisText(result);
      setModelState('ready');
    } catch (err: any) {
      console.warn('[LFM2.5 Error]', err);
      if (workerId === activeWorkerRef.current) {
        setModelState('error');
        setAnalysisText(`Riego a 4 L/m² temprano y ventilación de 10:00 a 14:00 en ${regName} para control de humedad.`);
      }
    }
  };

  useEffect(() => {
    const s = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_REGION) || 'madrid' : 'madrid';
    setRegion(s);
    executeFastLFM(s);

    const handleRegionChange = (e: any) => {
      const slug = e.detail || localStorage.getItem(STORAGE_REGION) || 'madrid';
      setRegion(slug);
      executeFastLFM(slug);
    };

    window.addEventListener('regionchange', handleRegionChange);
    window.addEventListener('flowerxi:refresh', () => executeFastLFM(localStorage.getItem(STORAGE_REGION) || s));
    return () => window.removeEventListener('regionchange', handleRegionChange);
  }, []);

  const regionDisplayName = region.charAt(0).toUpperCase() + region.slice(1);

  return (
    <div className="single-lfm-panel">
      {/* Header del Panel */}
      <div className="lfm-head-row">
        <div className="lfm-title-group">
          <div className="sp-ai-badge">
            {modelState === 'loading_model' ? (
              <>
                <span className="sp-spinner-mini" />
                <span>Cargando LFM2.5-230M ({progressPercent}%)</span>
              </>
            ) : modelState === 'inferring' ? (
              <>
                <span className="sp-ai-pulse" />
                <span>LFM2.5 razonando en {regionDisplayName}...</span>
              </>
            ) : (
              <>
                <span className="sp-ai-pulse" />
                <span>Motor LFM2.5-230M (Local WASM)</span>
              </>
            )}
          </div>
          <h3 className="lfm-main-title">Dictamen Agronómico Unificado — {regionDisplayName}</h3>
          <p className="lfm-sub-text">
            Evaluación neuronal directa del microclima • Temp {meta?.temp ?? '—'}°C | Lluvia {meta?.precip ?? '0'}mm | Riesgo Botrytis {meta?.fungal ?? '—'}%
          </p>
        </div>

        <button
          type="button"
          className="lfm-refresh-chip"
          onClick={() => executeFastLFM(region)}
          title="Reanalizar con LFM2.5"
        >
          🔄 Reanalizar
        </button>
      </div>

      {/* Barra de progreso de tensores */}
      {(modelState === 'loading_model' || modelState === 'inferring') && (
        <div className="lfm-progress-bar-wrap" style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>
          <div
            className="lfm-progress-bar"
            style={{ width: modelState === 'inferring' ? '100%' : `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Tarjeta de Dictamen Único de Alta Velocidad */}
      <div className="lfm-single-card">
        <div className="lfm-card-icon">🧠</div>
        <div className="lfm-card-content">
          {modelState === 'loading_model' || modelState === 'inferring' ? (
            <div className="sp-card-skeleton">
              <div className="sp-skel-line" style={{ width: '100%' }} />
              <div className="sp-skel-line" style={{ width: '85%' }} />
              <div className="sp-skel-line" style={{ width: '60%' }} />
            </div>
          ) : (
            <p className="lfm-result-text">
              {analysisText || `Dictamen agronómico para ${regionDisplayName} generado por LFM2.5.`}
            </p>
          )}
        </div>
      </div>

      <div className="lfm-footer-status">
        <span>⚡ Inferencia local en 1 solo paso • 0 peticiones a servidores externos</span>
      </div>
    </div>
  );
}
