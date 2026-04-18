<script>
  import { onDestroy, onMount } from 'svelte';

  export let apiUrl = '';
  export let embedded = false;

  const STORAGE_REGION = 'flowerxi_region';
  const CHAT_STORAGE_KEY = 'flowerxi_chat';
  const MAX_MESSAGES = 30;
  const CONTEXT_TTL_MS = 60_000;

  let chatHistory = [];
  let userQuestion = '';
  let chatOpen = embedded;
  let isModelLoading = false;
  let isAnswering = false;
  let modelReady = false;
  let modelProgress = 0;
  let modelName = '';
  let engine = null;
  let region = 'madrid';
  let inputRef;
  let contextCache = null;
  let contextCacheRegion = '';
  let contextCacheAt = 0;
  let modelModulePromise = null;

  const getModelModule = async () => {
    if (!modelModulePromise) {
      modelModulePromise = import('../lib/ai/model.js');
    }
    return modelModulePromise;
  };

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

  const loadBackendContext = async (force = false) => {
    const cacheValid =
      !force &&
      contextCache &&
      contextCacheRegion === region &&
      Date.now() - contextCacheAt < CONTEXT_TTL_MS;
    if (cacheValid) return contextCache;

    const [operativoData, historyData, weeklyData, monthlyData, compareData] = await Promise.all([
      fetchJson(`/api/risk/operativo?region=${encodeURIComponent(region)}`),
      fetchJson(`/api/history?region=${encodeURIComponent(region)}&limit=14`),
      fetchJson(`/api/recommendations/week?region=${encodeURIComponent(region)}&days=7`),
      fetchJson(`/api/risk/monthly?region=${encodeURIComponent(region)}&months=12`),
      fetchJson('/api/municipalities/compare'),
    ]);

    const history = Array.isArray(historyData?.items) ? historyData.items : [];
    const latest = history[0] ?? null;
    const weekly = Array.isArray(weeklyData?.items) ? weeklyData.items : [];
    const monthly = Array.isArray(monthlyData?.items) ? monthlyData.items : [];

    const humidityByRegion = Array.isArray(compareData?.items)
      ? compareData.items
          .map((item) => {
            const waterRisk = Number(item?.waterlogging_risk);
            return {
              slug: String(item?.slug || '').trim(),
              name: String(item?.name || '').trim(),
              waterRisk: Number.isFinite(waterRisk) ? Math.round(waterRisk) : null,
            };
          })
          .filter((item) => item.slug)
      : [];

    const humidTop = humidityByRegion
      .filter((item) => item.waterRisk !== null)
      .sort((a, b) => b.waterRisk - a.waterRisk)[0];

    const contextSummary = {
      region,
      operativo: {
        status: operativoData?.status_label || 'Sin datos',
        score: operativoData?.score ?? null,
        reason: operativoData?.reason || 'Sin datos',
        action: operativoData?.action_today || 'Sin datos',
      },
      today: latest
        ? {
            date: latest.observed_on,
            temp: latest.temp_mean_c,
            precip: latest.precipitation_mm,
            fungal: latest.fungal_risk,
            waterlogging: latest.waterlogging_risk,
            heat: latest.heat_risk,
            recommendation: latest.recommendation_message || latest.recommendation_title || 'Sin datos',
          }
        : null,
      weeklyActions: weekly.slice(0, 3).map((item) => item.title || item.message).filter(Boolean),
      monthlyTrend: monthly.slice(0, 6).map((item) => ({
        month: item.month_label,
        score: item.combined_score,
        level: item.risk_level,
      })),
      humidTop: humidTop ? `${humidTop.name} (${humidTop.waterRisk} pts)` : null,
    };

    const payload = { operativo: operativoData, latest, humidTop, contextSummary };
    contextCache = payload;
    contextCacheRegion = region;
    contextCacheAt = Date.now();
    return payload;
  };

  const normalizeText = (value) =>
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const quickAnswer = (question, context) => {
    const q = normalizeText(question);
    const score = context?.operativo?.score;
    const statusLabel = context?.operativo?.status_label;
    const action = context?.operativo?.action_today;
    const reason = context?.operativo?.reason;
    const humidTop = context?.humidTop;
    const latest = context?.latest;

    if (q.includes('riesgo hoy') || q.includes('riesgo de hoy') || q.includes('como esta el riesgo')) {
      return score !== null && score !== undefined
        ? `Hoy en ${region} el riesgo está en ${statusLabel || 'estado operativo'} (${score}).`
        : 'No tengo datos suficientes del riesgo de hoy.';
    }

    const asksTodayAction =
      (q.includes('hoy') && (q.includes('hago') || q.includes('hacer') || q.includes('debo'))) ||
      q.includes('accion recomendada') ||
      q.includes('accion de hoy');

    if (
      q.includes('que debo hacer') ||
      q.includes('que hago hoy') ||
      q.includes('que debo hacer hoy') ||
      q.includes('accion recomendada') ||
      q.includes('recomendacion') ||
      asksTodayAction
    ) {
      if (action && normalizeText(action) !== 'sin datos') {
        return `Acción recomendada hoy: ${action}`;
      }
      return `Estado actual: ${statusLabel || 'Sin datos'} (${score ?? '—'}). ${reason || 'Sin datos.'}`;
    }

    if (q.includes('donde hay mas humedad')) {
      return humidTop
        ? `Hoy el mayor riesgo de humedad/encharcamiento está en ${humidTop.name || humidTop.slug} (${humidTop.waterRisk} pts).`
        : 'No hay datos para comparar humedad entre municipios.';
    }

    if (q.includes('por que')) {
      return reason ? `El riesgo sube por: ${reason}` : 'No hay explicación de riesgo disponible.';
    }

    if (q.includes('lluvia') || q.includes('temperatura')) {
      if (!latest) return 'No hay observación climática reciente.';
      return `Último dato en ${region}: lluvia ${latest.precipitation_mm ?? 'N/A'} mm, temperatura ${latest.temp_mean_c ?? 'N/A'} °C.`;
    }

    return '';
  };

  const fallbackContextAnswer = (context) => {
    const score = context?.operativo?.score;
    const label = context?.operativo?.status_label;
    const action = context?.operativo?.action_today;
    const reason = context?.operativo?.reason;
    if ((score === null || score === undefined) && !action) return 'No tengo datos suficientes para responder.';
    return `Estado actual: ${label || 'Sin datos'} (${score ?? '—'}). ${reason || ''} Acción sugerida: ${action || 'Sin datos'}`.trim();
  };

  const isRefusalAnswer = (answer) => {
    const text = normalizeText(answer);
    if (!text) return true;
    const hasRefusalStart =
      text.includes('im sorry') ||
      text.includes('i m sorry') ||
      text.includes('lo siento');
    const hasCannotIntent =
      text.includes('cannot') || text.includes('cant') || text.includes('unable') || text.includes('no puedo');
    const hasPromptPolicyContext =
      text.includes('prompt') ||
      text.includes('instruction') ||
      text.includes('instructions') ||
      text.includes('comply') ||
      text.includes('respond to this');
    return (
      hasRefusalStart ||
      (hasCannotIntent && hasPromptPolicyContext) ||
      text.includes('cannot help with that') ||
      text.includes('requires a detailed explanation of the instructions') ||
      text.includes('no puedo responder a este prompt')
    );
  };

  const ensureModel = async () => {
    if (modelReady || isModelLoading) return;
    isModelLoading = true;
    modelProgress = 0;
    try {
      const modelModule = await getModelModule();
      engine = await modelModule.getAIModel((progress) => {
        const val = Number(progress?.progress ?? 0);
        if (Number.isFinite(val)) modelProgress = Math.max(0, Math.min(100, Math.round(val * 100)));
      });
      modelName = modelModule.getLoadedModelId() || '';
      modelReady = Boolean(engine);
    } catch (err) {
      console.error('[flowerxi-chat] webllm init error:', err);
      modelReady = false;
    } finally {
      isModelLoading = false;
    }
  };

  const buildMessages = (question, context) => {
    const systemPrompt =
      `Eres FlowerxiBot, asistente agronómico para floricultura en Cundinamarca. ` +
      `Responde en español, máximo 4 líneas, sin inventar datos y priorizando decisiones operativas. ` +
      `Si falta dato, dilo explícitamente. Usa este contexto JSON real: ${JSON.stringify(context.contextSummary)}.`;

    const messages = [{ role: 'system', content: systemPrompt }];
    chatHistory.slice(-4).forEach((item) => {
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
      const q = normalizeText(question);
      if (q.includes('hoy') && (q.includes('hago') || q.includes('hacer') || q.includes('debo'))) {
        appendHistory(question, fallbackContextAnswer(context));
        return;
      }
      const quick = quickAnswer(question, context);
      if (quick) {
        appendHistory(question, quick);
        return;
      }

      await ensureModel();
      if (!modelReady || !engine) {
        appendHistory(question, fallbackContextAnswer(context));
        return;
      }

      const messages = buildMessages(question, context);
      const completion = await engine.chat.completions.create({
        messages,
        temperature: 0.4,
        top_p: 0.9,
        max_tokens: 180,
        stream: false,
      });
      const rawAnswer = completion?.choices?.[0]?.message?.content?.trim() || '';
      const answer = isRefusalAnswer(rawAnswer) ? fallbackContextAnswer(context) : rawAnswer;
      appendHistory(question, answer);
    } catch (err) {
      console.error('[flowerxi-chat] error:', err);
      try {
        const context = await loadBackendContext(true);
        appendHistory(question, fallbackContextAnswer(context));
      } catch {
        appendHistory(question, 'No tengo datos suficientes para responder en este momento.');
      }
    } finally {
      isAnswering = false;
    }
  };

  const onRegionChange = (event) => {
    if (!event?.detail) return;
    region = event.detail;
    contextCache = null;
    contextCacheRegion = '';
    contextCacheAt = 0;
  };

  const openChat = async () => {
    chatOpen = true;
    await Promise.resolve();
    if (inputRef?.focus) inputRef.focus();
    if (embedded && typeof document !== 'undefined') {
      const section = document.getElementById('chat-section');
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  onMount(() => {
    loadHistory();
    if (typeof window !== 'undefined') {
      region = window.localStorage.getItem(STORAGE_REGION) || region;
      window.addEventListener('openchat', openChat);
      window.addEventListener('regionchange', onRegionChange);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('openchat', openChat);
        window.removeEventListener('regionchange', onRegionChange);
      }
    };
  });
</script>

{#if chatOpen}
  <article class="chat-card" id={embedded ? 'chat-section' : undefined}>
    <header class="chat-header">
      <div>
        <h3>FlowerxiBot</h3>
        <p>Asistente agronómico con contexto operativo real</p>
      </div>
      <div class="header-actions">
        <button class="clear-btn" type="button" on:click={clearHistory}>Limpiar</button>
      </div>
    </header>

    {#if isModelLoading}
      <p class="status">Cargando WebLLM{modelProgress ? ` (${modelProgress}%)` : '...'}</p>
    {:else if modelReady}
      <p class="status model-ok">Modelo local: {modelName || 'WebLLM'}</p>
    {/if}

    <div class="chat-history">
      {#if chatHistory.length === 0}
        <p class="status">Pregunta: “¿Cómo está el riesgo hoy?”, “¿Qué debo hacer?” o “¿Por qué subió?”</p>
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
        bind:this={inputRef}
        bind:value={userQuestion}
        on:keydown={handleKeydown}
        placeholder="Ej: ¿Qué acción recomiendas para hoy en mi municipio?"
        disabled={isAnswering}
      ></textarea>
      <button type="button" on:click={askQuestion} disabled={isAnswering}>
        {isAnswering ? 'Pensando...' : 'Enviar'}
      </button>
    </div>
  </article>
{/if}

<style>
  .chat-card {
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 14px;
    background: var(--bg-surface, #fff);
    box-shadow: var(--shadow-sm, 0 1px 3px rgba(31, 41, 55, 0.06));
    display: flex;
    flex-direction: column;
    min-height: 460px;
  }

  .chat-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.9rem;
    border-bottom: 1px solid var(--border-subtle, #e2e8f0);
  }

  .chat-header h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-primary, #1f2937);
  }

  .chat-header p {
    margin: 0.2rem 0 0;
    font-size: 0.78rem;
    color: var(--text-secondary, #64748b);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .clear-btn {
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 8px;
    background: transparent;
    color: var(--text-secondary, #64748b);
    padding: 0.3rem 0.5rem;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .clear-btn:hover {
    background: var(--bg-app, #f8fafc);
    color: var(--text-primary, #1f2937);
  }

  .chat-history {
    flex: 1;
    overflow: auto;
    padding: 0.75rem;
    display: grid;
    gap: 0.5rem;
  }

  .message {
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 10px;
    padding: 0.55rem;
    background: var(--bg-app, #f8fafc);
  }

  .q,
  .a {
    margin: 0;
    font-size: 0.84rem;
    line-height: 1.35;
    color: var(--text-primary, #1f2937);
  }

  .a {
    margin-top: 0.3rem;
    color: var(--primary, #7b5ba6);
  }

  .time {
    margin: 0.3rem 0 0;
    font-size: 0.7rem;
    color: var(--text-tertiary, #94a3b8);
  }

  .status {
    margin: 0;
    padding: 0.5rem 0.9rem;
    color: var(--text-secondary, #64748b);
    font-size: 0.8rem;
  }

  .status.model-ok {
    color: #065f46;
  }

  .composer {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem;
    border-top: 1px solid var(--border-subtle, #e2e8f0);
  }

  textarea {
    width: 100%;
    resize: vertical;
    min-height: 56px;
    max-height: 130px;
    border-radius: 10px;
    border: 1px solid var(--border-subtle, #e2e8f0);
    background: var(--bg-app, #f8fafc);
    color: var(--text-primary, #1f2937);
    font: inherit;
    font-size: 0.85rem;
    padding: 0.5rem 0.65rem;
    box-sizing: border-box;
    outline: none;
  }

  textarea:focus {
    border-color: var(--primary, #7b5ba6);
  }

  .composer button {
    border: none;
    border-radius: 10px;
    background: var(--primary, #7b5ba6);
    color: #fff;
    font: inherit;
    font-weight: 600;
    font-size: 0.85rem;
    padding: 0.55rem 0.7rem;
    cursor: pointer;
  }

  .composer button:hover:not(:disabled) {
    background: var(--primary-hover, #6b4f92);
  }

  .composer button:disabled,
  textarea:disabled {
    opacity: 0.65;
  }
</style>
