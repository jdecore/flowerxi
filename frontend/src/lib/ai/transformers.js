// Modelo Unificado Multilingüe de Alta Velocidad (Qwen2.5-0.5B / LFM2.5-230M)
let pipelinePromise = null;
let generator = null;
let modelIdLoaded = null;

// Candidatos optimizados para español y peso ultraligero
export const PRIMARY_MODELS = [
  'Xenova/Qwen2.5-0.5B-Instruct',
  'Xenova/Qwen2-0.5B-Instruct',
  'onnx-community/LFM2.5-230M-ONNX',
  'Xenova/LaMini-Flan-T5-248M',
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
  throw new Error('No se pudo inicializar el modelo local.');
}

export async function getTransformersModel(onProgress = null) {
  if (generator) return generator;
  if (pipelinePromise) return pipelinePromise;
  const support = await diagnoseTransformersSupport();
  if (!support.ok) throw new Error(support.reason);
  
  pipelinePromise = loadPipelineFor(PRIMARY_MODELS, onProgress).then(({ pipe, modelId }) => {
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

export function getLoadedModelId() {
  return modelIdLoaded || 'Qwen2.5-0.5B-Instruct';
}

export function displayModelName(raw = modelIdLoaded) {
  if (!raw) return 'Qwen2.5 500M (Español)';
  if (raw.includes('Qwen2.5')) return 'Qwen2.5 0.5B Instruct';
  if (raw.includes('Qwen2')) return 'Qwen2 0.5B';
  if (raw.includes('LFM2.5')) return 'LFM2.5 230M';
  if (raw.includes('LaMini')) return 'LaMini Flan-T5';
  return raw;
}

const SYSTEM_PROMPT_SPECIALIST = `Eres el Asistente Agronómico Senior de Flowerxi para rosas y flores de corte en la Sabana de Bogotá.
Debes responder en español claro, profesional y ultra conciso basándote estrictamente en los datos del municipio.`;

export async function generateSpecialistReport(contextSummary, onToken = null) {
  const gen = await getTransformersModel();
  
  const prompt = `<|im_start|>system
${SYSTEM_PROMPT_SPECIALIST}<|im_end|>
<|im_start|>user
Contexto del cultivo hoy:
Municipio: ${contextSummary.region}
Score de Riesgo: ${contextSummary.operativo.score ?? 'N/A'}/100 (${contextSummary.operativo.status})
Factor dominante: ${contextSummary.operativo.reason}
Temperatura: ${contextSummary.today?.temp ?? '—'}°C
Lluvia: ${contextSummary.today?.precip ?? '0'} mm
Riesgo Fúngico: ${contextSummary.today?.fungal ?? '—'}%
Riesgo Encharcamiento: ${contextSummary.today?.water ?? '—'}%

Genera 3 directivas breves:
1. RIEGO: Consejo específico de volumen y hora.
2. SANIDAD: Recomendación de ventilación y prevención de botritis.
3. MANEJO: Acción de poda o corte según el clima.<|im_end|>
<|im_start|>assistant
`;

  let streamer;
  if (onToken) {
    const { TextStreamer } = await import('@huggingface/transformers');
    try {
      streamer = new TextStreamer(gen.tokenizer, { skip_prompt: true, callback_function: onToken });
    } catch {}
  }

  const out = await gen(prompt, {
    max_new_tokens: 180,
    temperature: 0.3,
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

// Helper para agentes individuales si se consultan por separado
export async function getAgentModel() {
  return getTransformersModel();
}

export function getAgentDisplayName() {
  return displayModelName(modelIdLoaded);
}
