import React, { useEffect, useState, useRef } from 'react';

const STORAGE_REGION = 'flowerxi_region';

const toNumOrNull = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const riskScore = (item: any) => {
  const f = toNumOrNull(item?.fungal_risk),
    w = toNumOrNull(item?.waterlogging_risk),
    h = toNumOrNull(item?.heat_risk);
  if (f === null || w === null || h === null) return null;
  return Math.round(f * 0.5 + w * 0.3 + h * 0.2);
};

interface SpecialistCard {
  id: 'riego' | 'sanidad' | 'manejo';
  title: string;
  icon: string;
  color: string;
  badge: string;
  text: string;
  source: 'heuristico' | 'lfm2.5';
}

export default function ChatBotReact() {
  const [region, setRegion] = useState('madrid');
  const [meta, setMeta] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'riego' | 'sanidad' | 'manejo'>('all');
  
  // Estados del modelo LFM2.5
  const [aiStatus, setAiStatus] = useState<'idle' | 'downloading' | 'inferring' | 'ready' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isGlowing, setIsGlowing] = useState(false);

  const [specialists, setSpecialists] = useState<SpecialistCard[]>([
    {
      id: 'riego',
      title: 'Riego & Sustrato',
      icon: '💧',
      color: '#0f766e',
      badge: 'Nutrición Hídrica',
      text: 'Calculando volumen y horario óptimo...',
      source: 'heuristico',
    },
    {
      id: 'sanidad',
      title: 'Sanidad & Ventilación',
      icon: '🛡️',
      color: '#b45309',
      badge: 'Control Fitosanitario',
      text: 'Evaluando presión de hongos y condensación...',
      source: 'heuristico',
    },
    {
      id: 'manejo',
      title: 'Manejo & Cosecha',
      icon: '✂️',
      color: '#475569',
      badge: 'Labor Cultural',
      text: 'Analizando condiciones para corte y poscosecha...',
      source: 'heuristico',
    },
  ]);

  const activeWorkerRef = useRef<number>(0);

  const loadContext = async (slug: string) => {
    try {
      const res = await fetch('/data/weather.json');
      const weather = await res.json();
      const hist = (weather as any[])
        .filter((d) => d.region_slug === slug)
        .sort((a, b) => String(b.observed_on).localeCompare(String(a.observed_on)))
        .slice(0, 14);
      const latest = hist[0] || null;
      const score = latest ? riskScore(latest) : null;
      const status = score === null ? 'Sin datos' : score >= 70 ? 'Acción' : score >= 40 ? 'Vigilancia' : 'Rutina';
      const reason = latest
        ? latest.fungal_risk >= latest.waterlogging_risk && latest.fungal_risk >= latest.heat_risk
          ? 'riesgo fúngico'
          : latest.waterlogging_risk >= latest.fungal_risk && latest.waterlogging_risk >= latest.heat_risk
          ? 'encharcamiento'
          : 'riesgo térmico'
        : 'Sin datos';

      const ctxSummary = {
        region: slug,
        operativo: { status, score, reason },
        today: latest
          ? {
              date: latest.observed_on,
              temp: latest.temp_mean_c,
              precip: latest.precipitation_mm,
              fungal: latest.fungal_risk,
              water: latest.waterlogging_risk,
              heat: latest.heat_risk,
            }
          : null,
      };
      setMeta({
        date: latest?.observed_on,
        temp: latest?.temp_mean_c,
        precip: latest?.precipitation_mm,
        score,
        status,
        region: slug,
        ctxSummary,
      });
      return { ctxSummary, score };
    } catch {
      return { ctxSummary: { region: slug, operativo: { status: 'Normal', score: 50, reason: 'Rutina' }, today: null }, score: 50 };
    }
  };

  const getFallbackRecommendations = (ctx: any) => {
    const s = ctx?.operativo?.score ?? 50;
    const precip = ctx?.today?.precip ?? 0;
    const temp = ctx?.today?.temp ?? 14;

    return {
      riego:
        s >= 70 || precip > 5
          ? '💧 Reducir riego 35% hoy debido a alta saturación. Aplicar 3.2 L/m² a las 05:30 con drenajes abiertos.'
          : '💧 Riego regular de 4.5 L/m² a las 05:00 con fertirriego balanceado.',
      sanidad:
        s >= 60
          ? '🛡️ Ventilación prioritaria: Abrir cortinas entre 10:00 y 14:30 para mantener HR < 75%. Aplicar preventivo botritis.'
          : temp < 13
          ? '🛡️ Riesgo de rocío matutino: Evitar condensación en el techo del invernadero.'
          : '🛡️ Monitoreo rutinario de HR en bancales centrales.',
      manejo:
        s >= 50
          ? '✂️ Cosechar antes de las 09:00 para evitar tallos húmedos en poscosecha. Desinfectar tijeras tras cada cama.'
          : '✂️ Labores normales de desbrote y corte en horarios frescos.',
    };
  };

  const triggerHybridFlow = async (slug: string) => {
    const workerId = ++activeWorkerRef.current;
    
    // Paso 1: Instantáneo (0ms) con reglas agronómicas
    const { ctxSummary } = await loadContext(slug);
    const fallbacks = getFallbackRecommendations(ctxSummary);

    setSpecialists([
      {
        id: 'riego',
        title: 'Riego & Sustrato',
        icon: '💧',
        color: '#0f766e',
        badge: 'Nutrición Hídrica',
        text: fallbacks.riego,
        source: 'heuristico',
      },
      {
        id: 'sanidad',
        title: 'Sanidad & Ventilación',
        icon: '🛡️',
        color: '#b45309',
        badge: 'Control Fitosanitario',
        text: fallbacks.sanidad,
        source: 'heuristico',
      },
      {
        id: 'manejo',
        title: 'Manejo & Cosecha',
        icon: '✂️',
        color: '#475569',
        badge: 'Labor Cultural',
        text: fallbacks.manejo,
        source: 'heuristico',
      },
    ]);

    // Paso 2: Descarga y Enriquecimiento LFM2.5 en segundo plano
    setAiStatus('downloading');
    setDownloadProgress(10);

    try {
      const mod = await import('../lib/ai/transformers.js');
      
      const onProgress = (info: any) => {
        if (info && info.progress) {
          setDownloadProgress(Math.round(info.progress));
        }
      };

      setAiStatus('inferring');
      
      let generatedText = '';
      const onToken = (token: string) => {
        if (workerId !== activeWorkerRef.current) return;
        generatedText += token;
        
        // Streaming a la tarjeta de sanidad y riego si se detecta texto
        if (generatedText.length > 25) {
          setSpecialists((prev) =>
            prev.map((card) => {
              if (card.id === 'sanidad' && generatedText.toLowerCase().includes('sanidad')) {
                return { ...card, text: generatedText.slice(0, 160), source: 'lfm2.5' };
              }
              return card;
            })
          );
        }
      };

      const aiResponse = await mod.generateLFMAnalysis(ctxSummary, onToken, onProgress);

      if (workerId === activeWorkerRef.current && aiResponse) {
        // Parsear líneas si vienen formateadas o enriquecer las 3 tarjetas
        const lines = aiResponse.split('\n').filter((l: string) => l.trim().length > 0);
        
        setSpecialists((prev) =>
          prev.map((card) => {
            const foundLine = lines.find((l: string) => l.toUpperCase().includes(card.id.toUpperCase()));
            return {
              ...card,
              text: foundLine ? foundLine.replace(/^[0-9.\-*\s]+/, '').trim() : card.text,
              source: 'lfm2.5',
            };
          })
        );

        setAiStatus('ready');
        setIsGlowing(true);
        setTimeout(() => setIsGlowing(false), 2500);
      }
    } catch (e: any) {
      console.warn('[LFM2.5] Modo heurístico activo:', e?.message || e);
      if (workerId === activeWorkerRef.current) {
        setAiStatus('ready'); // mantiene la experiencia fluida
      }
    }
  };

  useEffect(() => {
    const s = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_REGION) || 'madrid' : 'madrid';
    setRegion(s);
    triggerHybridFlow(s);

    const handleRegionChange = (e: any) => {
      const slug = e.detail || localStorage.getItem(STORAGE_REGION) || 'madrid';
      setRegion(slug);
      triggerHybridFlow(slug);
    };

    window.addEventListener('regionchange', handleRegionChange);
    window.addEventListener('flowerxi:refresh', () => triggerHybridFlow(localStorage.getItem(STORAGE_REGION) || s));
    return () => window.removeEventListener('regionchange', handleRegionChange);
  }, []);

  const regionDisplayName = region.charAt(0).toUpperCase() + region.slice(1);
  const visibleCards = activeTab === 'all' ? specialists : specialists.filter((s) => s.id === activeTab);

  return (
    <div className={`specialist-panel-container ${isGlowing ? 'lfm-glow-active' : ''}`}>
      {/* Header del Panel */}
      <div className="sp-header">
        <div className="sp-header-left">
          <div className="sp-ai-badge">
            {aiStatus === 'downloading' ? (
              <>
                <span className="sp-spinner-mini" />
                <span>Cargando tensores LFM2.5 ({downloadProgress}%)</span>
              </>
            ) : aiStatus === 'inferring' ? (
              <>
                <span className="sp-ai-pulse" />
                <span>LFM2.5 razonando en vivo...</span>
              </>
            ) : (
              <>
                <span className="sp-ai-pulse" />
                <span>Motor LFM2.5-230M (Local WASM)</span>
              </>
            )}
          </div>
          <h3 className="sp-title">Triángulo Agronómico de Decisiones</h3>
          <p className="sp-subtitle">
            Directivas operativas para <strong>{regionDisplayName}</strong> • Temp {meta?.temp ?? '—'}°C | Lluvia {meta?.precip ?? '0'}mm
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

      {/* Barra de progreso sutil si está descargando el modelo */}
      {aiStatus === 'downloading' && (
        <div className="lfm-progress-bar-wrap">
          <div className="lfm-progress-bar" style={{ width: `${downloadProgress}%` }} />
        </div>
      )}

      {/* Grid de Especialistas */}
      <div className="sp-cards-grid">
        {visibleCards.map((card, index) => (
          <div
            key={card.id}
            className={`sp-card ${card.source === 'lfm2.5' ? 'is-lfm-generated' : ''}`}
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
              <p className="sp-card-text">{card.text}</p>
            </div>

            <div className="sp-card-footer">
              <span className="sp-card-status">
                {card.source === 'lfm2.5' ? '✨ Generado por LFM2.5 en navegador' : '⚡ Directiva agronómica inmediata'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
