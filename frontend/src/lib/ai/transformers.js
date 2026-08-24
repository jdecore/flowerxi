// Motor de Inferencia Agronómica Directa & IA Local
let pipelinePromise = null;
let generator = null;
let modelIdLoaded = null;

export const LFM_MODELS = [
  'Xenova/Qwen2.5-0.5B-Instruct',
  'onnx-community/LFM2.5-230M-ONNX',
];

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
      const pipe = await pipeline('text-generation', candidate, {
        dtype: 'q4',
        device: 'wasm',
        progress_callback: onProgress || undefined,
      });
      return { pipe, modelId: candidate };
    } catch (e) {
      console.warn(`[transformers] ${candidate} falló:`, e?.message || e);
    }
  }
  throw new Error('No se pudo inicializar modelo.');
}

export async function getLFMModel(onProgress = null) {
  if (generator) return generator;
  if (pipelinePromise) return pipelinePromise;
  const support = await diagnoseTransformersSupport();
  if (!support.ok) throw new Error(support.reason);

  pipelinePromise = loadPipelineFor(LFM_MODELS, onProgress).then(({ pipe, modelId }) => {
    generator = pipe;
    modelIdLoaded = modelId;
    return generator;
  });

  try {
    return await pipelinePromise;
  } finally {
    pipelinePromise = null;
  }
}

export function getLoadedModelName() {
  if (!modelIdLoaded) return 'LFM2.5-230M';
  if (modelIdLoaded.includes('LFM2.5')) return 'LFM2.5-230M';
  if (modelIdLoaded.includes('Qwen2.5')) return 'Qwen2.5-0.5B';
  return modelIdLoaded;
}

export async function generateLFMAnalysis(contextSummary, onToken = null, onProgress = null) {
  const gen = await getLFMModel(onProgress);

  const prompt = `Instrucción: Como agrónomo especialista en rosas de la Sabana de Bogotá, analiza:
Municipio: ${contextSummary.region}
Lluvia: ${contextSummary.today?.precip ?? 0} mm
Temp: ${contextSummary.today?.temp ?? 14} °C
Riesgo Fúngico: ${contextSummary.today?.fungal ?? 40} %

Responde estrictamente con estas 3 líneas:
RIEGO: [Horario y litros/m2 según la lluvia de ${contextSummary.today?.precip ?? 0}mm en ${contextSummary.region}]
SANIDAD: [Ventilación y prevención según el riesgo ${contextSummary.today?.fungal ?? 40}%]
MANEJO: [Acción de cosecha y desinfección hoy en ${contextSummary.region}]`;

  let streamer;
  if (onToken) {
    const { TextStreamer } = await import('@huggingface/transformers');
    try {
      streamer = new TextStreamer(gen.tokenizer, {
        skip_prompt: true,
        callback_function: onToken,
      });
    } catch {}
  }

  const out = await gen(prompt, {
    max_new_tokens: 150,
    temperature: 0.2,
    top_p: 0.8,
    do_sample: true,
    streamer,
  });

  const text = Array.isArray(out) ? out[0]?.generated_text : out?.generated_text || String(out);
  return text;
}
