<script>
  import { onMount } from 'svelte';
  import { getAIModel } from '../lib/ai/model.js';

  export let apiUrl = '';

  const STORAGE_REGION = 'flowerxi_region';
  const CHAT_STORAGE_KEY = 'flowerxi_chat';
  const TODAY_STORAGE_KEY = 'flowerxi_today';
  const MAX_MESSAGES = 20;
  const trackedRegions = ['madrid', 'facatativa', 'funza'];

  let chatHistory = [];
  let userQuestion = '';
  let chatOpen = false;
  let isModelLoading = false;
  let isAnswering = false;
  let modelReady = false;
  let model = null;
  let region = 'madrid';

  const loadHistory = () => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(CHAT_STORAGE_KEY);
      chatHistory = saved ? JSON.parse(saved) : [];
    } catch {
      chatHistory = [];
    }
  };

  const persistHistory = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatHistory.slice(-MAX_MESSAGES)));
  };

  const appendHistory = (question, answer) => {
    chatHistory = [...chatHistory, { q: question, a: answer, timestamp: new Date().toISOString() }];
    persistHistory();
  };

  const clearHistory = () => {
    chatHistory = [];
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
    }
  };

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const handleKeydown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      askQuestion();
    }
  };

  const normalizeBaseUrl = (raw) => String(raw ?? '').trim().replace(/\/+$/, '');

  const buildApiBases = (raw) => {
    const configured = normalizeBaseUrl(raw);
    const candidates = [];
    if (configured) candidates.push(configured);

    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        candidates.push(`${window.location.protocol}//${host}:8000`);
        candidates.push('http://localhost:8000');
        candidates.push('http://127.0.0.1:8000');
      }
    }

    candidates.push('');
    return [...new Set(candidates)];
  };

  const endpoint = (base, path) => {
    if (!base) return path;
    if (base.endsWith('/api') && path.startsWith('/api/')) return `${base}${path.slice(4)}`;
    return `${base}${path}`;
  };

  const fetchJson = async (path) => {
    const apiBases = buildApiBases(apiUrl);
    for (const base of apiBases) {
      try {
        const res = await fetch(endpoint(base, path), { headers: { Accept: 'application/json' } });
        if (!res.ok) continue;
        return await res.json();
      } catch {
        continue;
      }
    }
    return null;
  };

  const loadBackendContext = async () => {
    const [operativoData, historyData] = await Promise.all([
      fetchJson(`/api/risk/operativo?region=${encodeURIComponent(region)}`),
      fetchJson(`/api/history?region=${encodeURIComponent(region)}&limit=7`),
    ]);

    const history = Array.isArray(historyData?.items) ? historyData.items : [];
    const latest = history[0] ?? null;

    const humidityByRegion = await Promise.all(
      trackedRegions.map(async (slug) => {
        const data = await fetchJson(`/api/history?region=${encodeURIComponent(slug)}&limit=1`);
        const day = Array.isArray(data?.items) ? data.items[0] : null;
        const waterRisk = Number(day?.waterlogging_risk);
        return { slug, humidity: Number.isFinite(waterRisk) ? Math.round(waterRisk) : null };
      })
    );

    const humidTop = humidityByRegion
      .filter((item) => item.humidity !== null)
      .sort((a, b) => b.humidity - a.humidity)[0];

    return { operativo: operativoData, latest, humidTop };
  };

  const quickAnswer = (question, context) => {
    const q = question.toLowerCase();
    const score = context?.operativo?.score;
    const statusLabel = context?.operativo?.status_label;
    const action = context?.operativo?.action_today;
    const reason = context?.operativo?.reason;
    const humidTop = context?.humidTop;

    if (q.includes('riesgo hoy') || q.includes('como esta el riesgo') || q.includes('cómo está el riesgo')) {
      return score !== null && score !== undefined
        ? `Hoy en ${region} el riesgo está en ${statusLabel || 'estado operativo'} (${score}).`
        : 'Datos no disponibles para el riesgo de hoy.';
    }

    if (q.includes('que debo hacer') || q.includes('qué debo hacer') || q.includes('recomendacion')) {
      return action ? `Acción recomendada hoy: ${action}` : 'Datos no disponibles para recomendación operativa.';
    }

    if (q.includes('donde hay mas humedad') || q.includes('dónde hay más humedad')) {
      return humidTop
        ? `Hoy el mayor riesgo por humedad/encharcamiento está en ${humidTop.slug} (${humidTop.humidity} pts).`
        : 'Datos no disponibles para comparar humedad entre municipios.';
    }

    if (q.includes('por que') || q.includes('por qué')) {
      return reason ? `El riesgo sube por: ${reason}` : 'Datos no disponibles para explicar el riesgo.';
    }

    return '';
  };

  const fallbackContextAnswer = (context) => {
    const score = context?.operativo?.score;
    const label = context?.operativo?.status_label;
    const action = context?.operativo?.action_today;
    const reason = context?.operativo?.reason;
    if ((score === null || score === undefined) && !action) return 'Datos no disponibles.';
    return `Estado actual: ${label || 'Sin datos'} (${score ?? '—'}). ${reason || ''} Acción sugerida: ${action || 'Sin datos'}`.trim();
  };

  const loadModel = async () => {
    if (modelReady || isModelLoading) return;
    isModelLoading = true;
    try {
      model = await getAIModel();
      if (!model) throw new Error('No fue posible inicializar el modelo');
      modelReady = true;
    } catch (err) {
      console.error('[flowerxi-chat] init error:', err);
    } finally {
      isModelLoading = false;
    }
  };

  const getTodayContext = () => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(TODAY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const cleanModelAnswer = (text) => {
    if (!text) return '';
    const cleaned = text.replace(/^assistant:\s*/i, '').trim();
    if (cleaned.length < 3 || cleaned.toLowerCase().includes('cannot respond')) {
      return 'Datos no disponibles.';
    }
    return cleaned;
  };

  const buildMessages = (question, context) => {
    const today = getTodayContext();
    const systemPrompt =
      `Eres FlowerxiBot, asesor agronomico para rosa de corte en Colombia. ` +
      `Responde en español, maximo tres lineas, sin inventar datos. ` +
      `Contexto actual: municipio=${today.region || region}, temp=${today.temp || 'N/A'}, ` +
      `precip=${today.precip || 'N/A'}, riesgo=${today.risk_fungico || context?.operativo?.score || 'N/A'}, ` +
      `accion=${context?.operativo?.action_today || 'N/A'}.`;

    const messages = [{ role: 'system', content: systemPrompt }];
    chatHistory.slice(-3).forEach((item) => {
      messages.push({ role: 'user', content: item.q });
      messages.push({ role: 'assistant', content: item.a });
    });
    messages.push({ role: 'user', content: question });
    return messages;
  };

  const askQuestion = async () => {
    const question = userQuestion.trim();
    if (!question || isAnswering) return;
    userQuestion = '';
    isAnswering = true;
    try {
      const context = await loadBackendContext();
      const quick = quickAnswer(question, context);
      if (quick) {
        appendHistory(question, quick);
        return;
      }

      if (!modelReady) await loadModel();
      if (!modelReady) {
        appendHistory(question, fallbackContextAnswer(context));
        return;
      }

      const messages = buildMessages(question, context);
      const result = await model(messages, {
        max_new_tokens: 120,
        temperature: 0.7,
        do_sample: true,
      });
      const generated = result?.[0]?.generated_text;
      const answerText = Array.isArray(generated)
        ? generated.at(-1)?.content || generated.at(-1)
        : generated;
      const answer = cleanModelAnswer(answerText) || 'Datos no disponibles.';
      appendHistory(question, answer);
    } catch (err) {
      console.error('[flowerxi-chat] error:', err);
      try {
        const context = await loadBackendContext();
        appendHistory(question, fallbackContextAnswer(context));
      } catch {
        appendHistory(question, 'Datos no disponibles.');
      }
    } finally {
      isAnswering = false;
    }
  };

  const closeChat = () => {
    chatOpen = false;
  };

  const openFromSidebar = async () => {
    chatOpen = true;
  };

  const onRegionChange = (event) => {
    if (!event?.detail) return;
    region = event.detail;
  };

  onMount(() => {
    loadHistory();
    if (typeof window !== 'undefined') {
      region = window.localStorage.getItem(STORAGE_REGION) || region;
      window.addEventListener('openchat', openFromSidebar);
      window.addEventListener('regionchange', onRegionChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('openchat', openFromSidebar);
        window.removeEventListener('regionchange', onRegionChange);
      }
    };
  });
</script>

{#if chatOpen}
  <div class="chat-overlay" role="presentation" on:click={closeChat}>
    <aside
      class="chat-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Panel de Chat IA"
      on:click|stopPropagation
    >
      <header class="chat-header">
        <div>
          <h3>FlowerxiBot</h3>
          <p>Asistente agronómico</p>
        </div>
        <div class="header-actions">
          <button class="clear-btn" type="button" on:click={clearHistory}>Limpiar</button>
          <button class="close-btn" type="button" on:click={closeChat} aria-label="Cerrar chat">×</button>
        </div>
      </header>

      {#if isModelLoading}
        <p class="status">Cargando IA avanzada...</p>
      {/if}

      <div class="chat-history">
        {#if chatHistory.length === 0}
          <p class="status">Prueba: "¿Cómo está el riesgo hoy?" o "¿Qué debo hacer hoy?"</p>
        {/if}
        {#each chatHistory as item}
          <div class="message">
            <p class="q"><strong>Tú:</strong> {item.q}</p>
            <p class="a"><strong>Bot:</strong> {item.a}</p>
            <p class="time">{formatTime(item.timestamp)}</p>
          </div>
        {/each}
      </div>

      <div class="composer">
        <textarea
          rows="2"
          bind:value={userQuestion}
          on:keydown={handleKeydown}
          placeholder="Ej: ¿Qué riesgo hay hoy en mi lote?"
          disabled={isAnswering}
        ></textarea>
        <button type="button" on:click={askQuestion} disabled={isAnswering}>
          {isAnswering ? '...' : 'Enviar'}
        </button>
      </div>
    </aside>
  </div>
{/if}

<style>
  :root {
    --chat-primary: var(--primary);
    --chat-primary-hover: var(--primary-hover);
    --chat-bg: var(--bg-app);
    --chat-surface: var(--bg-surface);
    --chat-text: var(--text-primary);
    --chat-muted: var(--text-secondary);
    --chat-tertiary: var(--text-tertiary);
    --chat-border: var(--border-subtle);
  }

  .chat-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 12, 21, 0.35);
    z-index: 80;
    display: flex;
    justify-content: flex-end;
  }

  .chat-panel {
    width: min(430px, 100vw);
    height: 100vh;
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--chat-border);
    background: var(--chat-surface);
    box-shadow: -12px 0 28px rgba(43, 39, 48, 0.12);
  }

  .chat-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1rem;
    border-bottom: 1px solid var(--chat-border);
  }

  .chat-header h3 {
    margin: 0;
    font-size: 0.95rem;
    color: var(--chat-text);
  }

  .chat-header p {
    margin: 0.2rem 0 0;
    font-size: 0.8rem;
    color: var(--chat-muted);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .clear-btn {
    border: 1px solid var(--chat-border);
    border-radius: 8px;
    background: transparent;
    color: var(--chat-muted);
    padding: 0.3rem 0.5rem;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .clear-btn:hover {
    background: var(--chat-bg);
    color: var(--chat-text);
  }

  .close-btn {
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--chat-muted);
    font-size: 1.2rem;
    line-height: 1;
    width: 30px;
    height: 30px;
    cursor: pointer;
  }

  .close-btn:hover {
    background: var(--chat-bg);
    color: var(--chat-text);
  }

  .chat-history {
    flex: 1;
    overflow: auto;
    padding: 0.75rem;
    display: grid;
    gap: 0.5rem;
  }

  .message {
    border: 1px solid var(--chat-border);
    border-radius: 10px;
    padding: 0.5rem;
    background: var(--chat-bg);
  }

  .q,
  .a {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.35;
    color: var(--chat-text);
  }

  .a {
    margin-top: 0.3rem;
    color: var(--chat-primary);
  }

  .time {
    margin: 0.3rem 0 0;
    font-size: 0.7rem;
    color: var(--chat-tertiary);
  }

  .status {
    margin: 0;
    padding: 1rem;
    color: var(--chat-muted);
  }

  .status.error {
    color: var(--alert-high);
  }

  .composer {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem;
    border-top: 1px solid var(--chat-border);
  }

  textarea {
    width: 100%;
    resize: vertical;
    min-height: 56px;
    max-height: 130px;
    border-radius: 10px;
    border: 1px solid var(--chat-border);
    background: var(--chat-bg);
    color: var(--chat-text);
    font: inherit;
    font-size: 0.85rem;
    padding: 0.5rem 0.65rem;
    box-sizing: border-box;
    outline: none;
  }

  textarea:focus {
    border-color: var(--chat-primary);
  }

  .composer button {
    border: none;
    border-radius: 10px;
    background: var(--chat-primary);
    color: #fff;
    font: inherit;
    font-weight: 500;
    padding: 0.5rem 0.6rem;
    cursor: pointer;
  }

  .composer button:hover:not(:disabled) {
    background: var(--chat-primary-hover);
  }

  .composer button:disabled,
  textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 700px) {
    .chat-panel {
      width: 100vw;
    }
  }
</style>
