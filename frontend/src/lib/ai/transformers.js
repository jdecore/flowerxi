// 3 Agentes locales — 3 modelos pequeños distintos (consenso experto)
// LFM2.5-230M / distilgpt2 / modelo ligeramente mayor (gpt2 / Qwen2-0.5B)
let pipelinePromise = null;
let generator = null;
let modelIdLoaded = null;

// Cache por agente
const agentGenerators = new Map();
const agentModelIds = new Map();
const agentLoading = new Map();

// Modelos por agente — cada agente es un modelo pequeño distinto (consenso de expertos diversos)
export const AGENT_MODELS = {
  riego: [
    'onnx-community/LFM2-230M-ONNX',
    'onnx-community/LFM2.5-230M-ONNX',
    'Xenova/LaMini-Flan-T5-248M',
    'Xenova/Qwen2-0.5B-Instruct',
  ],
  sanidad: [
    'Xenova/distilgpt2', // 82M ultra ligero
  ],
  manejo: [
    'Xenova/gpt2', // 124M ligeramente mayor que distilgpt2
    'Xenova/Qwen2-0.5B-Instruct', // 500M alternativa mayor
    'Xenova/TinyLlama-1.1B-Chat-v1.0',
  ],
};

// Fallback legacy para generateAnswer single
export const PREFERRED_LFM = AGENT_MODELS.riego;

export async function diagnoseTransformersSupport() {
  if (typeof window === 'undefined') return { ok: false, reason: 'solo navegador' };
  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return { ok: false, reason: 'se requiere HTTPS o localhost' };
  }
  return { ok: true, reason: '' };
}

async function loadPipelineFor(candidates, onProgress) {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  for (const candidate of candidates) {
    try {
      // Flan-T5 es text2text, resto text-generation
      const task = candidate.includes('Flan-T5') ? 'text2text-generation' : 'text-generation';
      const pipe = await pipeline(task, candidate, {
        dtype: 'q4',
        device: 'wasm',
        progress_callback: onProgress || undefined,
      });
      return { pipe, modelId: candidate };
    } catch (e) {
      console.warn(`[transformers] ${candidate} falló, probando siguiente:`, e?.message || e);
      continue;
    }
  }
  throw new Error('No se pudo cargar modelo');
}

async function loadPipeline(onProgress) {
  const { pipe, modelId } = await loadPipelineFor(PREFERRED_LFM, onProgress);
  modelIdLoaded = modelId;
  return pipe;
}

export async function getTransformersModel(onProgress = null) {
  if (generator) return generator;
  if (pipelinePromise) return pipelinePromise;
  const support = await diagnoseTransformersSupport();
  if (!support.ok) throw new Error(support.reason);
  pipelinePromise = loadPipeline(onProgress).then((pipe) => {
    generator = pipe;
    return generator;
  });
  try { return await pipelinePromise; } finally { pipelinePromise = null; }
}

export async function getAgentModel(agentKey, onProgress = null) {
  if (agentGenerators.has(agentKey)) return agentGenerators.get(agentKey);
  if (agentLoading.has(agentKey)) return agentLoading.get(agentKey);
  const candidates = AGENT_MODELS[agentKey] || PREFERRED_LFM;
  const support = await diagnoseTransformersSupport();
  if (!support.ok) throw new Error(support.reason);
  const p = (async () => {
    const { pipe, modelId } = await loadPipelineFor(candidates, onProgress);
    agentGenerators.set(agentKey, pipe);
    agentModelIds.set(agentKey, modelId);
    if (!modelIdLoaded) modelIdLoaded = modelId;
    return pipe;
  })();
  agentLoading.set(agentKey, p);
  try { return await p; } finally { agentLoading.delete(agentKey); }
}

export function getLoadedModelId() { return modelIdLoaded; }
export function getAgentModelId(agentKey) { return agentModelIds.get(agentKey) || modelIdLoaded; }

export async function resetModel() {
  generator = null; modelIdLoaded = null; pipelinePromise = null;
  agentGenerators.clear(); agentModelIds.clear(); agentLoading.clear();
}

const AGENT_SYSTEMS = {
  riego: `Eres Agente RIEGO — experto en fertirriego y sustrato para flores de corte Sabana Bogotá.
Con contexto JSON real, da 2 líneas: diagnóstico hídrico del día + 1 consejo concreto de riego/hora y dosis (ej: "4L/m2 a las 5:00", "suspende hoy por encharcamiento"). Español breve, sin inventar.`,
  sanidad: `Eres Agente SANIDAD — fitopatólogo para rosa/clavel Sabana.
Con contexto JSON real (fungal/agua/calor, temp, precip), da 2 líneas: riesgo fitosanitario hoy + 1 consejo de sanidad/ventilación/drenaje (ej: "ventila 10-14h", "aplica preventivo si score>60"). Español breve.`,
  manejo: `Eres Agente MANEJO — experto en manejo y cosecha flores Sabana.
Con contexto JSON real, da 2 líneas: estado operativo + 1 consejo de manejo/poda/cosecha/poscosecha adaptado al clima de hoy. Español breve.`,
};

function displayModelName(raw) {
  if (!raw) return 'LFM2.5-230M';
  if (raw.includes('LFM2.5') || raw.includes('LFM2-230M')) return 'LFM2.5-230M';
  if (raw.includes('LaMini-Flan-T5')) return 'LFM2.5-230M (LaMini-Flan-T5 248M)';
  if (raw.includes('distilgpt2')) return 'DistilGPT2 82M';
  if (raw.includes('gpt2-medium')) return 'GPT2-Medium 355M';
  if (raw.includes('gpt2')) return 'GPT2 124M';
  if (raw.includes('Qwen2-0.5B')) return 'Qwen2-0.5B 500M';
  if (raw.includes('TinyLlama')) return 'TinyLlama 1.1B';
  return raw;
}
export function getDisplayModelName() { return displayModelName(modelIdLoaded); }
export function getAgentDisplayName(agentKey) { return displayModelName(agentModelIds.get(agentKey) || modelIdLoaded); }

export async function generateAgentAnswer(agentKey, contextSummary, onToken = null) {
  const gen = await getAgentModel(agentKey);
  const system = `${AGENT_SYSTEMS[agentKey]}\nContexto JSON: ${JSON.stringify(contextSummary)}`;
  const prompt = `${system}\n\nRespuesta ${agentKey}:`;
  let streamer;
  if (onToken) {
    const { TextStreamer } = await import('@huggingface/transformers');
    try { streamer = new TextStreamer(gen.tokenizer, { skip_prompt: true, callback_function: onToken }); } catch {}
  }
  const out = await gen(prompt, { max_new_tokens: 90, temperature: 0.35, top_p: 0.9, do_sample: true, streamer });
  const text = Array.isArray(out) ? out[0]?.generated_text : out?.generated_text || String(out);
  const cleaned = text && text.includes(`Respuesta ${agentKey}:`) ? text.split(`Respuesta ${agentKey}:`).pop().trim() : String(text || '').trim();
  return cleaned.split('\n').slice(0, 3).join(' ').slice(0, 320);
}

export async function generateConsensus(agentAnswers, contextSummary) {
  // usa el modelo mayor (manejo) como coordinador
  const gen = await getAgentModel('manejo').catch(() => getTransformersModel());
  const system = `Eres Coordinador Flowerxi. Con las 3 opiniones de agentes expertos (modelos distintos) y contexto JSON, genera CONSENSO en 3 bullets accionables, sin contradicción, priorizando seguridad. Español breve.
Agente RIEGO [${displayModelName(agentModelIds.get('riego'))}]: ${agentAnswers.riego}
Agente SANIDAD [${displayModelName(agentModelIds.get('sanidad'))}]: ${agentAnswers.sanidad}
Agente MANEJO [${displayModelName(agentModelIds.get('manejo'))}]: ${agentAnswers.manejo}
Contexto: ${JSON.stringify(contextSummary)}`;
  const prompt = `${system}\n\nConsenso (3 bullets):`;
  const out = await gen(prompt, { max_new_tokens: 160, temperature: 0.3, top_p: 0.9, do_sample: true });
  const text = Array.isArray(out) ? out[0]?.generated_text : out?.generated_text || String(out);
  const cleaned = text && text.includes('Consenso') ? text.split('Consenso').pop().replace(/^[^a-zA-Z0-9]+/, '').trim() : String(text || '').trim();
  if (!cleaned || cleaned.length < 15) {
    return `• ${agentAnswers.riego}\n• ${agentAnswers.sanidad}\n• ${agentAnswers.manejo}`;
  }
  return cleaned;
}

// Legacy helper
export async function generateAnswer(question, contextSummary, onToken = null) {
  const gen = await getTransformersModel();
  const system = `Eres FlowerxiBot, agrónomo senior flores Sabana Bogotá. Con contexto JSON real, da RESUMEN (1-2 líneas) + 3 CONSEJOS hiper-locales. Contexto: ${JSON.stringify(contextSummary)}`;
  const prompt = `${system}\n\nConsulta: ${question}\nRespuesta:`;
  let streamer;
  if (onToken) {
    const { TextStreamer } = await import('@huggingface/transformers');
    try { streamer = new TextStreamer(gen.tokenizer, { skip_prompt: true, callback_function: onToken }); } catch {}
  }
  const out = await gen(prompt, { max_new_tokens: 180, temperature: 0.3, top_p: 0.9, do_sample: true, streamer });
  const text = Array.isArray(out) ? out[0]?.generated_text : out?.generated_text || String(out);
  if (text && text.includes('Respuesta:')) return text.split('Respuesta:').pop().trim();
  return String(text || '').trim();
}
