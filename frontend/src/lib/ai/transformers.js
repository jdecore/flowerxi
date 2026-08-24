// LFM2.5-230M via @huggingface/transformers 3.8.1 (estable, npm i @huggingface/transformers)
// Nota: docs main (v4) requiere build desde fuente. Usamos v3.8.1 estable per https://huggingface.co/docs/transformers.js/v3.8.1/installation
let pipelinePromise = null;
let generator = null;
let modelIdLoaded = null;

// Modelos probados en HF ONNX: LFM2.5-230M aún no publicado como ONNX community, usamos fallbacks verificados
export const PREFERRED_LFM = [
  'onnx-community/LFM2-230M-ONNX',       // si existe futuro ONNX
  'onnx-community/LFM2.5-230M-ONNX',     // solicitado por usuario
  'Xenova/LaMini-Flan-T5-248M',          // fallback estable 248M ligero, español OK
  'Xenova/distilgpt2',                   // último fallback
];

export async function diagnoseTransformersSupport() {
  if (typeof window === 'undefined') return { ok: false, reason: 'solo navegador' };
  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return { ok: false, reason: 'se requiere HTTPS o localhost' };
  }
  return { ok: true, reason: '' };
}

async function loadPipeline(onProgress) {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  // v3.8.1: progress via progress_callback en pipeline(), no env.callbacks
  for (const candidate of PREFERRED_LFM) {
    try {
      const pipe = await pipeline('text-generation', candidate, {
        dtype: 'q4',
        device: 'wasm',
        progress_callback: onProgress || undefined,
      });
      modelIdLoaded = candidate;
      return pipe;
    } catch (e) {
      console.warn(`[transformers] ${candidate} falló, probando siguiente:`, e?.message || e);
      continue;
    }
  }
  throw new Error('No se pudo cargar ningún modelo LFM');
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
  try {
    return await pipelinePromise;
  } finally {
    pipelinePromise = null;
  }
}

export function getLoadedModelId() {
  return modelIdLoaded;
}

export async function resetModel() {
  generator = null;
  modelIdLoaded = null;
  pipelinePromise = null;
}

// Helper para generar respuesta con contexto flowerxi
export async function generateAnswer(question, contextSummary, onToken = null) {
  const gen = await getTransformersModel();
  const system = `Eres FlowerxiBot, asistente agronómico para flores de corte en Cundinamarca. Responde en español, breve, sin inventar datos. Contexto JSON: ${JSON.stringify(contextSummary)}`;
  const prompt = `${system}\n\nPregunta: ${question}\nRespuesta:`;
  // v3.8.1: TextStreamer si se quiere streaming opcional
  let streamer;
  if (onToken) {
    const { TextStreamer } = await import('@huggingface/transformers');
    streamer = new TextStreamer(gen.tokenizer, { skip_prompt: true, callback_function: onToken });
  }
  const out = await gen(prompt, {
    max_new_tokens: 180,
    temperature: 0.3,
    top_p: 0.9,
    do_sample: true,
    streamer,
  });
  const text = Array.isArray(out) ? out[0]?.generated_text : out?.generated_text || String(out);
  if (text && text.includes('Respuesta:')) return text.split('Respuesta:').pop().trim();
  return String(text || '').trim();
}
