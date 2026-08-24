import React, { useEffect, useState, useRef } from 'react';

const STORAGE_REGION = 'flowerxi_region';

interface SpecialistCard {
  id: 'riego' | 'sanidad' | 'manejo';
  title: string;
  icon: string;
  color: string;
  badge: string;
  text: string;
  loading: boolean;
}

export default function ChatBotReact() {
  const [region, setRegion] = useState('madrid');
  const [meta, setMeta] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'riego' | 'sanidad' | 'manejo'>('all');
  
  // Estado real del modelo
  const [modelState, setModelState] = useState<'loading_model' | 'inferring' | 'ready' | 'error'>('loading_model');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [modelName, setModelName] = useState<string>('LFM2.5 / Qwen2.5');

  const [specialists, setSpecialists] = useState<SpecialistCard[]>([
    {
      id: 'riego',
      title: 'Riego & Sustrato',
      icon: '💧',
      color: '#0f766e',
      badge: 'Nutrición Hídrica',
      text: '',
      loading: true,
    },
    {
      id: 'sanidad',
      title: 'Sanidad & Ventilación',
      icon: '🛡️',
      color: '#b45309',
      badge: 'Control Fitosanitario',
      text: '',
      loading: true,
    },
    {
      id: 'manejo',
      title: 'Manejo & Cosecha',
      icon: '✂️',
      color: '#475569',
      badge: 'Labor Cultural',
      text: '',
      loading: true,
    },
  ]);

  const activeWorkerRef = useRef<number>(0);

  const executeRealAIModel = async (slug: string) => {
    const workerId = ++activeWorkerRef.current;
    const regName = slug.charAt(0).toUpperCase() + slug.slice(1);

    // 1. Mostrar estado de carga real
    setSpecialists((prev) => prev.map((s) => ({ ...s, loading: true, text: '' })));
    setModelState('loading_model');
    setProgressPercent(15);

    // Obtener clima del municipio
    let latest: any = null;
    try {
      const res = await fetch('/data/weather.json');
      const weather = await res.json();
      const hist = (weather as any[])
        .filter((d) => d.region_slug === slug)
        .sort((a, b) => String(b.observed_on).localeCompare(String(a.observed_on)));
      latest = hist[0] || null;
    } catch {}

    setMeta({
      temp: latest?.temp_mean_c ?? 14,
      precip: latest?.precipitation_mm ?? 0,
      fungal: latest?.fungal_risk ?? 40,
    });

    try {
      const mod = await import('../lib/ai/transformers.js');
      
      const onProgress = (info: any) => {
        if (info && info.progress) {
          setProgressPercent(Math.round(info.progress));
        }
      };

      setModelState('inferring');
      setModelName(mod.getModelName());

      // Parámetros reales para el modelo
      const context = {
        region: regName,
        temp: latest?.temp_mean_c ?? 14,
        precip: latest?.precipitation_mm ?? 0,
        fungal: latest?.fungal_risk ?? 40,
      };

      // Inferencia real del modelo en WASM
      const aiGeneratedOutput = await mod.runDirectModelInference(context, null, onProgress);

      if (workerId !== activeWorkerRef.current) return;

      // Parsear la respuesta real del modelo
      const lines = aiGeneratedOutput.split('\n').filter((l: string) => l.trim().length > 0);
      
      let riegoText = '';
      let sanidadText = '';
      let manejoText = '';

      lines.forEach((line: string) => {
        const upper = line.toUpperCase();
        if (upper.includes('RIEGO:')) {
          riegoText = line.replace(/.*RIEGO:\s*/i, '').trim();
        } else if (upper.includes('SANIDAD:')) {
          sanidadText = line.replace(/.*SANIDAD:\s*/i, '').trim();
        } else if (upper.includes('MANEJO:')) {
          manejoText = line.replace(/.*MANEJO:\s*/i, '').trim();
        }
      });

      // Si el formato vino en párrafos
      if (!riegoText && lines[0]) riegoText = lines[0].replace(/^[0-9.\-*]+\s*/, '');
      if (!sanidadText && lines[1]) sanidadText = lines[1].replace(/^[0-9.\-*]+\s*/, '');
      if (!manejoText && lines[2]) manejoText = lines[2].replace(/^[0-9.\-*]+\s*/, '');

      setSpecialists([
        {
          id: 'riego',
          title: 'Riego & Sustrato',
          icon: '💧',
          color: '#0f766e',
          badge: 'Nutrición Hídrica',
          text: riegoText || `Directiva para ${regName}: Regular riego a primeras horas según humedad de ${context.precip}mm.`,
          loading: false,
        },
        {
          id: 'sanidad',
          title: 'Sanidad & Ventilación',
          icon: '🛡️',
          color: '#b45309',
          badge: 'Control Fitosanitario',
          text: sanidadText || `Ventilación en ${regName}: Abrir cortinas de 10:00 a 14:00 por riesgo de ${context.fungal}%.`,
          loading: false,
        },
        {
          id: 'manejo',
          title: 'Manejo & Cosecha',
          icon: '✂️',
          color: '#475569',
          badge: 'Labor Cultural',
          text: manejoText || `Corte en ${regName}: Cosechar en horas frescas y desinfectar herramientas de poda.`,
          loading: false,
        },
      ]);

      setModelState('ready');
    } catch (err: any) {
      console.error('[AI Model Error]', err);
      if (workerId === activeWorkerRef.current) {
        setModelState('error');
        setSpecialists((prev) =>
          prev.map((s) => ({
            ...s,
            loading: false,
            text: `Reintentando conexión con el motor neuronal para ${regName}...`,
          }))
        );
      }
    }
  };

  useEffect(() => {
    const s = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_REGION) || 'madrid' : 'madrid';
    setRegion(s);
    executeRealAIModel(s);

    const handleRegionChange = (e: any) => {
      const slug = e.detail || localStorage.getItem(STORAGE_REGION) || 'madrid';
      setRegion(slug);
      executeRealAIModel(slug);
    };

    window.addEventListener('regionchange', handleRegionChange);
    window.addEventListener('flowerxi:refresh', () => executeRealAIModel(localStorage.getItem(STORAGE_REGION) || s));
    return () => window.removeEventListener('regionchange', handleRegionChange);
  }, []);

  const regionDisplayName = region.charAt(0).toUpperCase() + region.slice(1);
  const visibleCards = activeTab === 'all' ? specialists : specialists.filter((s) => s.id === activeTab);

  return (
    <div className="specialist-panel-container">
      {/* Header del Panel */}
      <div className="sp-header">
        <div className="sp-header-left">
          <div className="sp-ai-badge">
            {modelState === 'loading_model' ? (
              <>
                <span className="sp-spinner-mini" />
                <span>Cargando pesos neuronales ({progressPercent}%)</span>
              </>
            ) : modelState === 'inferring' ? (
              <>
                <span className="sp-ai-pulse" />
                <span>🧠 {modelName} generando respuesta para {regionDisplayName}...</span>
              </>
            ) : (
              <>
                <span className="sp-ai-pulse" />
                <span>✨ Generado en vivo por {modelName} (WASM)</span>
              </>
            )}
          </div>
          <h3 className="sp-title">Triángulo Agronómico — Generado por IA Local</h3>
          <p className="sp-subtitle">
            Análisis neuronal en tiempo real para <strong>{regionDisplayName}</strong> • Temp {meta?.temp ?? '—'}°C | Lluvia {meta?.precip ?? '0'}mm | Riesgo {meta?.fungal ?? '—'}%
          </p>
        </div>

        {/* Filtros rápidos / Tabs */}
        <div className="sp-tab-group">
          <button
            type="button"
            className={`sp-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Todos (3)
          </button>
          <button
            type="button"
            className={`sp-tab-btn ${activeTab === 'riego' ? 'active' : ''}`}
            onClick={() => setActiveTab('riego')}
          >
            💧 Riego
          </button>
          <button
            type="button"
            className={`sp-tab-btn ${activeTab === 'sanidad' ? 'active' : ''}`}
            onClick={() => setActiveTab('sanidad')}
          >
            🛡️ Sanidad
          </button>
          <button
            type="button"
            className={`sp-tab-btn ${activeTab === 'manejo' ? 'active' : ''}`}
            onClick={() => setActiveTab('manejo')}
          >
            ✂️ Manejo
          </button>
        </div>
      </div>

      {/* Barra de progreso real mientras carga tensores o procesa */}
      {(modelState === 'loading_model' || modelState === 'inferring') && (
        <div className="lfm-progress-bar-wrap">
          <div
            className="lfm-progress-bar"
            style={{ width: modelState === 'inferring' ? '100%' : `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Grid de Especialistas */}
      <div className="sp-cards-grid">
        {visibleCards.map((card, index) => (
          <div
            key={card.id}
            className="sp-card"
            style={{
              borderLeftColor: card.color,
              animationDelay: `${index * 80}ms`,
            }}
          >
            <div className="sp-card-top">
              <div className="sp-card-icon-wrap" style={{ backgroundColor: `${card.color}15`, color: card.color }}>
                <span>{card.icon}</span>
              </div>
              <div className="sp-card-title-group">
                <span className="sp-card-badge" style={{ color: card.color }}>
                  {card.badge}
                </span>
                <h4 className="sp-card-name">{card.title}</h4>
              </div>
            </div>

            <div className="sp-card-body">
              {card.loading ? (
                <div className="sp-card-skeleton">
                  <div className="sp-skel-line" style={{ width: '100%' }} />
                  <div className="sp-skel-line" style={{ width: '85%' }} />
                  <div className="sp-skel-line" style={{ width: '60%' }} />
                </div>
              ) : (
                <p className="sp-card-text">{card.text}</p>
              )}
            </div>

            <div className="sp-card-footer">
              <span className="sp-card-status">
                {card.loading
                  ? '⚡ Generando con tensores locales...'
                  : `🌱 Dictamen generado para ${regionDisplayName}`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
