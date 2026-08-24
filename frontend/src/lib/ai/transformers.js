// Modelo Local Dedicado: Liquid Foundation Model (LFM2.5-230M-ONNX)
let pipelinePromise = null;
let generator = null;
let modelIdLoaded = null;

// Modelo principal LFM2.5-230M con fallbacks ultraligeros
export const LFM_MODELS = [
  'onnx-community/LFM2.5-230M-ONNX',
  'onnx-community/LFM2-230M-ONNX',
  'Xenova/Qwen2.5-0.5B-Instruct',
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
      console.warn(`[transformers] ${candidate} falló, probando fallback:`, e?.message || e);
      continue;
    }
  }
  throw new Error('No se pudo inicializar LFM2.5.');
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
  if (modelIdLoaded.includes('LFM2')) return 'LFM2-230M';
  if (modelIdLoaded.includes('Qwen2.5')) return 'Qwen2.5-0.5B';
  return modelIdLoaded;
}

export async function generateLFMAnalysis(contextSummary, onToken = null, onProgress = null) {
  const gen = await getLFMModel(onProgress);

  const system = `Eres un experto agrónomo en floricultura de la Sabana de Bogotá.
Analiza las condiciones del día y entrega 3 recomendaciones breves en español:
1. RIEGO: Volumen y hora.
2. SANIDAD: Ventilación y prevención botritis.
3. MANEJO: Poda o cosecha.`;

  const prompt = `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\nCultivo en ${contextSummary.region}:
Riesgo ${contextSummary.operativo.score ?? 50}/100, Temp ${contextSummary.today?.temp ?? 14}°C, Lluvia ${contextSummary.today?.precip ?? 0}mm, Humedad fúngica ${contextSummary.today?.fungal ?? 40}%.<|im_end|>\n<|im_start|>assistant\n`;

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
    max_new_tokens: 160,
    temperature: 0.35,
    top_p: 0.85,
    do_sample: true,
    streamer,
  });

  const text = Array.isArray(out) ? out[0]?.generated_text : out?.generated_text || String(out);
  const responsePart = text.includes('<|im_start|>assistant')
    ? text.split('<|im_start|>assistant').pop().replace('<|im_end|>', '').trim()
    : text.trim();

  return responsePart;
}
