// Inferencia Directa con Modelo Local en Navegador (Qwen2.5-0.5B / LFM2.5)
let pipelinePromise = null;
let generator = null;
let modelIdLoaded = null;

// Qwen2.5-0.5B es el modelo con mejor comprensión y generación agronómica en español para navegador
export const MODEL_CANDIDATES = [
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
      console.warn(`[transformers] ${candidate} falló al cargar:`, e?.message || e);
    }
  }
  throw new Error('No se pudo inicializar el modelo en el navegador.');
}

export async function getModel(onProgress = null) {
  if (generator) return generator;
  if (pipelinePromise) return pipelinePromise;
  const support = await diagnoseTransformersSupport();
  if (!support.ok) throw new Error(support.reason);

  pipelinePromise = loadPipelineFor(MODEL_CANDIDATES, onProgress).then(({ pipe, modelId }) => {
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

export function getModelName() {
  if (!modelIdLoaded) return 'LFM2.5 / Qwen2.5';
  if (modelIdLoaded.includes('Qwen2.5')) return 'Qwen2.5 0.5B Instruct';
  if (modelIdLoaded.includes('LFM2.5')) return 'LFM2.5 230M';
  return modelIdLoaded;
}

export async function runDirectModelInference(context, onToken = null, onProgress = null) {
  const gen = await getModel(onProgress);

  const messages = [
    {
      role: 'system',
      content: 'Eres un agrónomo experto en cultivo de rosas y flores de corte en la Sabana de Bogotá. Genera 3 directivas directas y muy concretas en español para el cultivo hoy.'
    },
    {
      role: 'user',
      content: `Datos de hoy en ${context.region}:
Lluvia: ${context.precip} mm
Temperatura: ${context.temp} °C
Riesgo Fúngico: ${context.fungal}%

Entrega exactamente 3 líneas con este formato:
RIEGO: [Tu recomendación de riego específica para ${context.region}]
SANIDAD: [Tu recomendación fitosanitaria y ventilación para ${context.region}]
MANEJO: [Tu recomendación de labor cultural y corte para ${context.region}]`
    }
  ];

  let prompt = '';
  if (gen.tokenizer.apply_chat_template) {
    prompt = gen.tokenizer.apply_chat_template(messages, { tokenize: false, add_generation_prompt: true });
  } else {
    prompt = `<|im_start|>system\n${messages[0].content}<|im_end|>\n<|im_start|>user\n${messages[1].content}<|im_end|>\n<|im_start|>assistant\n`;
  }

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
    max_new_tokens: 180,
    temperature: 0.3,
    top_p: 0.9,
    do_sample: true,
    streamer,
  });

  const text = Array.isArray(out) ? out[0]?.generated_text : out?.generated_text || String(out);
  const cleanResponse = text.includes('<|im_start|>assistant')
    ? text.split('<|im_start|>assistant').pop().replace('<|im_end|>', '').trim()
    : text.trim();

  return cleanResponse;
}
