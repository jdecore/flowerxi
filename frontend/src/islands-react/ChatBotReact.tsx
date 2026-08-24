import React, { useEffect, useState, useRef } from 'react';

const STORAGE_REGION = 'flowerxi_region';

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
  
  // Estados IA
  const [aiStatus, setAiStatus] = useState<'idle' | 'downloading' | 'inferring' | 'ready'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isGlowing, setIsGlowing] = useState(false);

  const [specialists, setSpecialists] = useState<SpecialistCard[]>([]);
  const activeWorkerRef = useRef<number>(0);

  // Generador de recomendaciones dinámicas hiper-locales y precisas por municipio
  const computeLocalRecommendations = (slug: string, latest: any) => {
    const regName = slug.charAt(0).toUpperCase() + slug.slice(1);
    const precip = Number(latest?.precipitation_mm) || 0;
    const temp = Number(latest?.temp_mean_c) || 14;
    const fungal = Number(latest?.fungal_risk) || 40;
    const water = Number(latest?.waterlogging_risk) || 20;

    let riegoText = '';
    let sanidadText = '';
    let manejoText = '';

    // Riego hiper-local
    if (precip > 8) {
      riegoText = `💧 En ${regName} se registran ${precip}mm de lluvia activa: Suspender fertirriego matutino hoy. Mantener drenajes de bancales abiertos para evitar asfixia radicular.`;
    } else if (precip > 2) {
      riegoText = `💧 En ${regName} hay humedad acumulada (${precip}mm): Reducir volumen a 2.8 L/m² a las 05:45. Aplicar solución nutritiva con CE baja.`;
    } else if (temp > 16) {
      riegoText = `💧 Día despejado y cálido en ${regName} (${temp}°C): Incrementar lámina de riego a 5.2 L/m² dividido en dos pulsos (05:00 y 11:30).`;
    } else {
      riegoText = `💧 Condiciones normales en ${regName}: Riego estándar de 4.2 L/m² a las 05:00 con fertirriego balanceado N-P-K.`;
    }

    // Sanidad hiper-local
    if (fungal >= 70) {
      sanidadText = `🛡️ Presión crítica de Botrytis en ${regName} (${fungal}% riesgo): Elevar cortinas cenitales 60% de 10:00 a 15:00. Aplicar fungicida foliar preventivo antes del mediodía.`;
    } else if (fungal >= 45) {
      sanidadText = `🛡️ Presión fúngica moderada en ${regName} (${fungal}%): Ventilar entre 10:30 y 14:00 para forzar secado foliar rápido y mantener HR < 75%.`;
    } else if (temp < 12) {
      sanidadText = `🛡️ Temperatura baja en ${regName} (${temp}°C): Riesgo de inversión térmica y rocío en techo. Activar ventiladores recirculadores en madrugada.`;
    } else {
      sanidadText = `🛡️ Sanidad estable en ${regName}: Ventilación regular y monitoreo preventivo en camas centrales del invernadero.`;
    }

    // Manejo hiper-local
    if (water >= 60 || precip > 5) {
      manejoText = `✂️ Por alta humedad en ${regName}: Adelantar cosecha a primera hora (antes de las 08:30) para evitar ingreso de botones húmedos al cuarto frío.`;
    } else if (fungal >= 60) {
      manejoText = `✂️ Labores en ${regName}: Desinfectar tijeras con amonio cuaternario cama por cama. Retirar hojas basales con primeros síntomas de moteado.`;
    } else {
      manejoText = `✂️ Jornada de corte en ${regName}: Desbrote y clasificación estándar en poscosecha. Mantener hidratación de tallos en solución bactericida.`;
    }

    return {
      riego: riegoText,
      sanidad: sanidadText,
      manejo: manejoText,
    };
  };

  const loadAndRun = async (slug: string) => {
    const workerId = ++activeWorkerRef.current;
    
    // 1. Obtener datos meteorológicos reales del municipio
    let latest: any = null;
    try {
      const res = await fetch('/data/weather.json');
      const weather = await res.json();
      const hist = (weather as any[])
        .filter((d) => d.region_slug === slug)
        .sort((a, b) => String(b.observed_on).localeCompare(String(a.observed_on)));
      latest = hist[0] || null;
    } catch {}

    const regName = slug.charAt(0).toUpperCase() + slug.slice(1);
    const recs = computeLocalRecommendations(slug, latest);

    setMeta({
      temp: latest?.temp_mean_c ?? '—',
      precip: latest?.precipitation_mm ?? '0',
      fungal: latest?.fungal_risk ?? '—',
      date: latest?.observed_on ?? '',
    });

    // 2. Aplicar inmediatamente las recomendaciones hiper-locales que cambian de verdad por municipio
    setSpecialists([
      {
        id: 'riego',
        title: 'Riego & Sustrato',
        icon: '💧',
        color: '#0f766e',
        badge: 'Nutrición Hídrica',
        text: recs.riego,
        source: 'heuristico',
      },
      {
        id: 'sanidad',
        title: 'Sanidad & Ventilación',
        icon: '🛡️',
        color: '#b45309',
        badge: 'Control Fitosanitario',
        text: recs.sanidad,
        source: 'heuristico',
      },
      {
        id: 'manejo',
        title: 'Manejo & Cosecha',
        icon: '✂️',
        color: '#475569',
        badge: 'Labor Cultural',
        text: recs.manejo,
        source: 'heuristico',
      },
    ]);

    // 3. Ejecutar LFM2.5 en segundo plano para enriquecer si el usuario permanece
    setAiStatus('downloading');
    setDownloadProgress(20);

    try {
      const mod = await import('../lib/ai/transformers.js');
      
      const onProgress = (info: any) => {
        if (info && info.progress) {
          setDownloadProgress(Math.round(info.progress));
        }
      };

      setAiStatus('inferring');

      const ctxSummary = {
        region: regName,
        operativo: { score: latest?.fungal_risk ?? 50 },
        today: {
          temp: latest?.temp_mean_c ?? 14,
          precip: latest?.precipitation_mm ?? 0,
          fungal: latest?.fungal_risk ?? 40,
        },
      };

      const aiText = await mod.generateLFMAnalysis(ctxSummary, null, onProgress);

      if (workerId === activeWorkerRef.current && aiText && aiText.length > 30) {
        // Enriquecer tarjetas con el análisis del modelo
        const lines = aiText.split('\n').filter((l: string) => l.trim().length > 0);
        
        setSpecialists((prev) =>
          prev.map((card) => {
            const found = lines.find((l: string) => l.toUpperCase().includes(card.id.toUpperCase()));
            if (found) {
              const cleaned = found.replace(/^[^:]*:\s*/, '').trim();
              return {
                ...card,
                text: `${card.text} • [IA]: ${cleaned}`,
                source: 'lfm2.5',
              };
            }
            return card;
          })
        );

        setAiStatus('ready');
        setIsGlowing(true);
        setTimeout(() => setIsGlowing(false), 2500);
      } else if (workerId === activeWorkerRef.current) {
        setAiStatus('ready');
      }
    } catch {
      if (workerId === activeWorkerRef.current) {
        setAiStatus('ready');
      }
    }
  };

  useEffect(() => {
    const s = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_REGION) || 'madrid' : 'madrid';
    setRegion(s);
    loadAndRun(s);

    const handleRegionChange = (e: any) => {
      const slug = e.detail || localStorage.getItem(STORAGE_REGION) || 'madrid';
      setRegion(slug);
      loadAndRun(slug);
    };

    window.addEventListener('regionchange', handleRegionChange);
    window.addEventListener('flowerxi:refresh', () => loadAndRun(localStorage.getItem(STORAGE_REGION) || s));
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
                <span>LFM2.5 razonando en {regionDisplayName}...</span>
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
            Directivas operativas para <strong>{regionDisplayName}</strong> • Temp {meta?.temp ?? '—'}°C | Lluvia {meta?.precip ?? '0'}mm | Riesgo Fúngico {meta?.fungal ?? '—'}%
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
                {card.source === 'lfm2.5' ? `✨ Dictamen LFM2.5 (${regionDisplayName})` : `⚡ Directiva calculada para ${regionDisplayName}`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
