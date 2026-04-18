<script>
  import { onMount } from 'svelte';
  import { getAIModel } from '../lib/ai/model.js';

  let chatHistory = [];
  let userQuestion = '';
  let chatOpen = false;
  let isModelLoading = false;
  let isAnswering = false;
  let modelReady = false;
  let modelError = '';
  let model = null;

  const CHAT_STORAGE_KEY = 'flowerxi_chat';
  const TODAY_STORAGE_KEY = 'flowerxi_today';
  const MAX_MESSAGES = 20;

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

  const loadModel = async () => {
    if (modelReady || isModelLoading) return;
    isModelLoading = true;
    modelError = '';
    try {
      model = await getAIModel();
      if (!model) throw new Error('No fue posible inicializar el modelo');
      modelReady = true;
    } catch (error) {
      modelError = 'No fue posible cargar la IA en este momento.';
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
    let cleaned = text
      .replace(/respuesta:|usuario:|bot:/gi, '')
      .split('Usuario:')[0]
      .trim();
    if (cleaned.length < 3 || cleaned.toLowerCase().includes('sorry') || cleaned.toLowerCase().includes('cannot respond')) {
      return 'Lo siento, no puedo responder eso. Intenta otra pregunta.';
    }
    return cleaned;
  };

  const buildPrompt = (question) => {
    const today = getTodayContext();
    const recentHistory = chatHistory.slice(-3).map((item) => `Usuario: ${item.q}\nBot: ${item.a}`).join('\n');
    return `
Eres FlowerxiBot, asesor agronomico para rosa de corte.

Reglas:
- Responde en espanol, maximo tres lineas.
- No inventes datos.

Datos: municipio=${today.region}, temp=${today.temp}, precip=${today.precip}, riesgo=${today.risk_fungico}

Usuario: ${question}
Respuesta:`.trim();
  };

  const askQuestion = async () => {
    const question = userQuestion.trim();
    if (!question || !modelReady || isAnswering) return;
    userQuestion = '';
    isAnswering = true;
    try {
      const result = await model(buildPrompt(question), { max_new_tokens: 120, temperature: 0.6 });
      const answer = cleanModelAnswer(result?.[0]?.generated_text) || 'No tengo respuesta.';
      appendHistory(question, answer);
    } catch {
      appendHistory(question, 'Error. Intenta de nuevo.');
    } finally {
      isAnswering = false;
    }
  };

  const toggleChat = async () => {
    chatOpen = !chatOpen;
    if (chatOpen && !modelReady) await loadModel();
  };

  const clearHistory = () => {
    if (typeof window === 'undefined') return;
    if (window.confirm('Borrar historial?')) {
      chatHistory = [];
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
    }
  };

  const handleKeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askQuestion(); }
  };

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  onMount(() => { loadHistory(); });
</script>

<div class="chatbot">
  <button class="chat-fab" on:click={toggleChat}>
    {chatOpen ? 'Cerrar' : 'Preguntar a FlowerxiBot'}
  </button>

  {#if chatOpen}
    <aside class="chat-panel">
      <header class="chat-header">
        <div><h3>FlowerxiBot</h3><p>Asistente agronomico</p></div>
        <button class="clear-btn" on:click={clearHistory}>Limpiar</button>
      </header>

      {#if isModelLoading}
        <p class="status">Cargando modelo IA...</p>
      {:else if modelError}
        <p class="status error">{modelError}</p>
      {:else}
        <div class="chat-history">
          {#if chatHistory.length === 0}<p class="status">Haz tu primera pregunta.</p>{/if}
          {#each chatHistory as item}
            <div class="message">
              <p class="q"><strong>Tu:</strong> {item.q}</p>
              <p class="a"><strong>Bot:</strong> {item.a}</p>
              <p class="time">{formatTime(item.timestamp)}</p>
            </div>
          {/each}
        </div>
      {/if}

      <div class="composer">
        <textarea rows="2" bind:value={userQuestion} on:keydown={handleKeydown}
          placeholder="Ej: Que riesgo hay hoy?" disabled={!modelReady || isAnswering} />
        <button on:click={askQuestion} disabled={!modelReady || isAnswering}>
          {isAnswering ? '...' : 'Enviar'}
        </button>
      </div>
    </aside>
  {/if}
</div>

<style>
  :root {
    --chat-primary: #756A85;
    --chat-primary-hover: #5F546E;
    --chat-bg: #F6F4F8;
    --chat-surface: #FFFFFF;
    --chat-text: #2B2730;
    --chat-muted: #6B6573;
    --chat-tertiary: #9590A3;
    --chat-border: #E5E0EB;
  }
  .chatbot { position: fixed; right: 1rem; bottom: 1rem; z-index: 20; }
  .chat-fab {
    border: none; border-radius: 999px; background: var(--chat-primary); color: #fff;
    font: inherit; font-weight: 500; padding: 0.6rem 1rem; cursor: pointer;
    box-shadow: 0 4px 12px rgba(117,106,133,0.3); transition: all 160ms;
  }
  .chat-fab:hover { background: var(--chat-primary-hover); }
  .chat-panel {
    margin-top: 0.5rem; width: min(400px, calc(100vw - 2rem)); max-height: 70vh;
    display: flex; flex-direction: column; border: 1px solid var(--chat-border);
    border-radius: 16px; background: var(--chat-surface);
    box-shadow: 0 8px 32px rgba(43,39,48,0.12); overflow: hidden;
  }
  .chat-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 0.75rem; padding: 1rem; border-bottom: 1px solid var(--chat-border);
  }
  .chat-header h3 { margin: 0; font-size: 0.95rem; color: var(--chat-text); }
  .chat-header p { margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--chat-muted); }
  .clear-btn {
    border: 1px solid var(--chat-border); border-radius: 8px; background: transparent;
    color: var(--chat-muted); padding: 0.3rem 0.5rem; font-size: 0.75rem; cursor: pointer;
  }
  .clear-btn:hover { background: var(--chat-bg); color: var(--chat-text); }
  .chat-history { flex: 1; overflow: auto; padding: 0.75rem; display: grid; gap: 0.5rem; }
  .message { border: 1px solid var(--chat-border); border-radius: 10px; padding: 0.5rem; background: var(--chat-bg); }
  .q, .a { margin: 0; font-size: 0.85rem; line-height: 1.35; color: var(--chat-text); }
  .a { margin-top: 0.3rem; color: var(--chat-primary); }
  .time { margin: 0.3rem 0 0; font-size: 0.7rem; color: var(--chat-tertiary); }
  .status { margin: 0; padding: 1rem; color: var(--chat-muted); }
  .status.error { color: #C75D5D; }
  .composer { display: grid; gap: 0.5rem; padding: 0.75rem; border-top: 1px solid var(--chat-border); }
  textarea {
    width: 100%; resize: vertical; min-height: 56px; max-height: 130px; border-radius: 10px;
    border: 1px solid var(--chat-border); background: var(--chat-bg); color: var(--chat-text);
    font: inherit; font-size: 0.85rem; padding: 0.5rem 0.65rem; box-sizing: border-box; outline: none;
  }
  textarea:focus { border-color: var(--chat-primary); }
  textarea::placeholder { color: var(--chat-tertiary); }
  .composer button {
    border: none; border-radius: 10px; background: var(--chat-primary); color: #fff;
    font: inherit; font-weight: 500; padding: 0.5rem 0.6rem; cursor: pointer;
  }
  .composer button:hover:not(:disabled) { background: var(--chat-primary-hover); }
  .composer button:disabled, textarea:disabled { opacity: 0.6; cursor: not-allowed; }
  @media (max-width: 700px) {
    .chatbot { right: 0.5rem; left: 0.5rem; bottom: 0.5rem; }
    .chat-fab, .chat-panel { width: 100%; }
  }
</style>