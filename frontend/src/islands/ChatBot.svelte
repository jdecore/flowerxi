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

  const loadModel = async () => {
    if (modelReady || isModelLoading) return;
    isModelLoading = true;
    modelError = '';
    try {
      model = await getAIModel();
      if (!model) throw new Error('No fue posible inicializar el modelo');
      modelReady = true;
    } catch {
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
    const cleaned = text.replace(/^assistant:\s*/i, '').trim();
    if (cleaned.length < 3 || cleaned.toLowerCase().includes('cannot respond')) {
      return 'Lo siento, no puedo responder eso. Intenta otra pregunta.';
    }
    return cleaned;
  };

  const buildMessages = (question) => {
    const today = getTodayContext();
    const systemPrompt =
      `Eres FlowerxiBot, asesor agronomico para rosa de corte en Colombia. ` +
      `Responde en español, maximo tres lineas, sin inventar datos. ` +
      `Contexto actual: municipio=${today.region || 'desconocido'}, temp=${today.temp || 'N/A'}, ` +
      `precip=${today.precip || 'N/A'}, riesgo=${today.risk_fungico || 'N/A'}.`;

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
    if (!question || !modelReady || isAnswering) return;
    userQuestion = '';
    isAnswering = true;
    try {
      const messages = buildMessages(question);
      const result = await model(messages, {
        max_new_tokens: 120,
        temperature: 0.7,
        do_sample: true,
      });
      const generated = result?.[0]?.generated_text;
      const answerText = Array.isArray(generated)
        ? generated.at(-1)?.content || generated.at(-1)
        : generated;
      const answer = cleanModelAnswer(answerText) || 'No tengo respuesta.';
      appendHistory(question, answer);
    } catch (err) {
      console.error('[flowerxi-chat] error:', err);
      appendHistory(question, 'Error. Intenta de nuevo.');
    } finally {
      isAnswering = false;
    }
  };

  const closeChat = () => {
    chatOpen = false;
  };

  const openFromSidebar = async () => {
    chatOpen = true;
    if (!modelReady) await loadModel();
  };

  onMount(() => {
    loadHistory();
    if (typeof window !== 'undefined') {
      window.addEventListener('openchat', openFromSidebar);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('openchat', openFromSidebar);
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
        <p class="status">Cargando modelo IA...</p>
      {:else if modelError}
        <p class="status error">{modelError}</p>
      {:else}
        <div class="chat-history">
          {#if chatHistory.length === 0}
            <p class="status">Haz tu primera pregunta.</p>
          {/if}
          {#each chatHistory as item}
            <div class="message">
              <p class="q"><strong>Tú:</strong> {item.q}</p>
              <p class="a"><strong>Bot:</strong> {item.a}</p>
              <p class="time">{formatTime(item.timestamp)}</p>
            </div>
          {/each}
        </div>
      {/if}

      <div class="composer">
        <textarea
          rows="2"
          bind:value={userQuestion}
          on:keydown={handleKeydown}
          placeholder="Ej: ¿Qué riesgo hay hoy en mi lote?"
          disabled={!modelReady || isAnswering}
        ></textarea>
        <button type="button" on:click={askQuestion} disabled={!modelReady || isAnswering}>
          {isAnswering ? '...' : 'Enviar'}
        </button>
      </div>
    </aside>
  </div>
{/if}

<style>
  :root {
    --chat-primary: #756a85;
    --chat-primary-hover: #5f546e;
    --chat-bg: #f6f4f8;
    --chat-surface: #ffffff;
    --chat-text: #2b2730;
    --chat-muted: #6b6573;
    --chat-tertiary: #9590a3;
    --chat-border: #e5e0eb;
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
    color: #c75d5d;
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
