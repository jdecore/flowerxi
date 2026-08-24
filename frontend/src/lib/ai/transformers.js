// Inferencia Ultrarrápida Dedicada: LFM2.5-230M en Navegador
let pipelinePromise = null;
let generator = null;

export const LFM_MODEL_ID = 'onnx-community/LFM2.5-230M-ONNX';

export async function diagnoseTransformersSupport() {
  if (typeof window === 'undefined') return { ok: false, reason: 'solo navegador' };
  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return { ok: false, reason: 'se requiere HTTPS o localhost' };
  }
  return { ok: true, reason: '' };
}

export async function getLFMModel(onProgress = null) {
  if (generator) return generator;
  if (pipelinePromise) return pipelinePromise;
  
  const support = await diagnoseTransformersSupport();
  if (!support.ok) throw new Error(support.reason);

  const { pipeline, env } = await import('@huggingface/transformers');
  
  // Configuración explícita para navegador y CDN
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.backends.onnx.wasm.numThreads = Math.min(4, typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2);
  env.backends.onnx.wasm.simd = true;

  pipelinePromise = pipeline('text-generation', LFM_MODEL_ID, {
    dtype: 'q4',
    device: 'wasm',
    progress_callback: onProgress || undefined,
  }).then((pipe) => {
    generator = pipe;
    return generator;
  });

  try {
    return await pipelinePromise;
  } finally {
    pipelinePromise = null;
  }
}

// Inferencia ultra compacta: Genera un dictamen agronómico conciso en 1 solo paso rápido
export async function runSingleLFMAnalysis(context, onProgress = null) {
  const gen = await getLFMModel(onProgress);

  const prompt = `Contexto: Cultivo de rosas en ${context.region} (Lluvia: ${context.precip}mm, Temp: ${context.temp}°C, Riesgo Botrytis: ${context.fungal}%).
Dictamen agronómico inmediato:`;

  const out = await gen(prompt, {
    max_new_tokens: 65,
    temperature: 0.2,
    top_p: 0.8,
    do_sample: false,
  });

  const text = Array.isArray(out) ? out[0]?.generated_text : out?.generated_text || String(out);
  const clean = text.includes('Dictamen agronómico inmediato:')
    ? text.split('Dictamen agronómico inmediato:').pop().trim()
    : text.trim();

  return clean;
}
