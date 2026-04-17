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
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const saved = window.localStorage.getItem(CHAT_STORAGE_KEY);
      chatHistory = saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error reading chat history:', error);
      chatHistory = [];
    }
  };

  const persistHistory = () => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatHistory.slice(-MAX_MESSAGES)));
  };

  const appendHistory = (question, answer) => {
    chatHistory = [...chatHistory, { q: question, a: answer, timestamp: new Date().toISOString() }];
    persistHistory();
  };

  const loadModel = async () => {
    if (modelReady || isModelLoading) {
      return;
    }

    isModelLoading = true;
    modelError = '';
    try {
      model = await getAIModel();
      if (!model) {
        throw new Error('No fue posible inicializar el modelo');
      }
      modelReady = true;
    } catch (error) {
      console.error('Error loading AI model:', error);
      modelError = 'No fue posible cargar la IA en este momento.';
    } finally {
      isModelLoading = false;
    }
  };

  const getTodayContext = () => {
    if (typeof window === 'undefined') {
      return {};
    }

    try {
      const raw = window.localStorage.getItem(TODAY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const cleanModelAnswer = (text) => {
    return (text ?? '')
      .replace(/respuesta:|usuario:|bot:/gi, '')
      .split('Usuario:')[0]
      .trim();
  };

  const buildPrompt = (question) => {
    const today = getTodayContext();
    const recentHistory = chatHistory
      .slice(-3)
      .map((item) => `Usuario: ${item.q}\nBot: ${item.a}`)
      .join('\n');

    return `
Eres FlowerxiBot, asesor agronomico para rosa de corte en Madrid, Facatativa y Funza.

Reglas:
- Responde en espanol.
- Maximo tres lineas.
- No inventes datos climaticos no confirmados.
- Si preguntan por precios, indica visitar la seccion "Precios de Mercado".

Datos del dia:
- Municipio: ${today.region ?? 'N/A'}
- Temperatura media: ${today.temp ?? 'N/A'} C
- Precipitacion: ${today.precip ?? 'N/A'} mm
- Riesgos: fungico=${today.risk_fungico ?? 'N/A'}, encharcamiento=${today.risk_encharcamiento ?? 'N/A'}, calor=${today.risk_calor ?? 'N/A'}
- Recomendacion: ${today.recommendation ?? 'N/A'}

Historial reciente:
${recentHistory || 'Sin historial'}

Pregunta:
Usuario: ${question}
Respuesta:
`.trim();
  };

  const askQuestion = async () => {
    const question = userQuestion.trim();
    if (!question || !modelReady || isAnswering) {
      return;
    }

    userQuestion = '';
    isAnswering = true;

    try {
      const prompt = buildPrompt(question);
      const result = await model(prompt, {
        max_new_tokens: 120,
        temperature: 0.6,
        repetition_penalty: 1.2,
        do_sample: true,
      });

      const generatedText = result?.[0]?.generated_text ?? '';
      const answer = cleanModelAnswer(generatedText) || 'No pude generar una respuesta util.';
      appendHistory(question, answer);
    } catch (error) {
      console.error('Error generating answer:', error);
      appendHistory(question, 'Error generando respuesta. Intenta de nuevo.');
    } finally {
      isAnswering = false;
    }
  };

  const toggleChat = async () => {
    chatOpen = !chatOpen;
    if (chatOpen && !modelReady) {
      await loadModel();
    }
  };

  const clearHistory = () => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!window.confirm('Borrar historial del chat?')) {
      return;
    }

    chatHistory = [];
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
  };

  const handleKeydown = async (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await askQuestion();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  onMount(() => {
    loadHistory();
  });
</script>

<div class="chatbot">
  <button class="chat-fab" on:click={toggleChat} aria-label="Abrir chat Flowerxi">
    {chatOpen ? 'Cerrar chat' : 'Preguntar a FlowerxiBot'}
  </button>

  {#if chatOpen}
    <aside class="chat-panel">
      <header class="chat-header">
        <div>
          <h3>FlowerxiBot</h3>
          <p>Asistente para rosa de corte</p>
        </div>
        <button class="ghost" on:click={clearHistory}>Limpiar</button>
      </header>

      {#if isModelLoading}
        <p class="status">Cargando modelo IA en tu navegador...</p>
      {:else if modelError}
        <p class="status error">{modelError}</p>
      {:else}
        <div class="chat-history">
          {#if chatHistory.length === 0}
            <p class="status">Haz tu primera pregunta operativa sobre cultivo de rosa.</p>
          {/if}

          {#each chatHistory as item}
            <div class="message">
              <p class="question"><strong>Tu:</strong> {item.q}</p>
              <p class="answer"><strong>Bot:</strong> {item.a}</p>
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
          placeholder="Ejemplo: Que hago hoy si sube el riesgo fungico?"
          disabled={!modelReady || isAnswering || isModelLoading}
        />
        <button on:click={askQuestion} disabled={!modelReady || isAnswering || isModelLoading}>
          {isAnswering ? 'Pensando...' : 'Enviar'}
        </button>
      </div>
    </aside>
  {/if}
</div>

<style>
  .chatbot {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 20;
  }

  .chat-fab {
    border: 1px solid rgba(177, 108, 255, 0.6);
    border-radius: 999px;
    background: linear-gradient(135deg, #7f39fb, #b16cff);
    color: #fff;
    font: inherit;
    font-weight: 600;
    padding: 0.65rem 0.95rem;
    cursor: pointer;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
  }

  .chat-panel {
    margin-top: 0.6rem;
    width: min(420px, calc(100vw - 2rem));
    max-height: 74vh;
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(177, 108, 255, 0.4);
    border-radius: 16px;
    background: rgba(18, 9, 40, 0.98);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    overflow: hidden;
  }

  .chat-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.7rem;
    padding: 0.8rem;
    border-bottom: 1px solid rgba(177, 108, 255, 0.2);
  }

  .chat-header h3 {
    margin: 0;
    font-size: 1rem;
  }

  .chat-header p {
    margin: 0.2rem 0 0;
    color: #cdb8f5;
    font-size: 0.83rem;
  }

  .ghost {
    border: 1px solid rgba(177, 108, 255, 0.35);
    border-radius: 8px;
    background: transparent;
    color: #e9dcff;
    padding: 0.35rem 0.55rem;
    cursor: pointer;
  }

  .chat-history {
    overflow: auto;
    padding: 0.8rem;
    display: grid;
    gap: 0.55rem;
  }

  .message {
    border: 1px solid rgba(177, 108, 255, 0.24);
    border-radius: 10px;
    padding: 0.55rem;
    background: rgba(46, 20, 96, 0.42);
  }

  .question,
  .answer {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.35;
  }

  .answer {
    margin-top: 0.35rem;
  }

  .time {
    margin: 0.35rem 0 0;
    color: #cdb8f5;
    font-size: 0.74rem;
  }

  .status {
    margin: 0;
    padding: 0.9rem;
    color: #cdb8f5;
  }

  .status.error {
    color: #ffd4d4;
  }

  .composer {
    display: grid;
    gap: 0.45rem;
    padding: 0.75rem;
    border-top: 1px solid rgba(177, 108, 255, 0.2);
  }

  textarea {
    width: 100%;
    resize: vertical;
    min-height: 58px;
    max-height: 140px;
    border-radius: 10px;
    border: 1px solid rgba(177, 108, 255, 0.4);
    background: rgba(22, 10, 47, 0.9);
    color: #f5efff;
    font: inherit;
    padding: 0.55rem 0.65rem;
    box-sizing: border-box;
  }

  .composer button {
    border: 1px solid rgba(177, 108, 255, 0.55);
    border-radius: 10px;
    background: rgba(127, 57, 251, 0.45);
    color: #fff;
    font: inherit;
    font-weight: 600;
    padding: 0.52rem 0.6rem;
    cursor: pointer;
  }

  .composer button:disabled,
  textarea:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
  @media (max-width: 700px) {
    .chatbot {
      right: 0.6rem;
      left: 0.6rem;
      bottom: 0.7rem;
    }

    .chat-fab,
    .chat-panel {
      width: 100%;
    }
  }
</style>

