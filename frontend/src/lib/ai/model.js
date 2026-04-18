const PREFERRED_MODELS = [
  'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  'Phi-3.5-mini-instruct-q4f16_1-MLC',
  'Gemma-2-2b-it-q4f16_1-MLC',
  'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',
  'DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC',
];

let engineInstance = null;
let loadingPromise = null;
let modelIdLoaded = null;
let webllmModulePromise = null;

const isChatLikeModel = (modelId) => /instruct|chat|llama|qwen|phi|gemma|mistral|deepseek/i.test(modelId);

async function loadWebLLMModule() {
  if (!webllmModulePromise) {
    webllmModulePromise = import('@mlc-ai/web-llm');
  }
  return webllmModulePromise;
}

async function listModelCandidates() {
  const { prebuiltAppConfig } = await loadWebLLMModule();
  const modelList = Array.isArray(prebuiltAppConfig?.model_list) ? prebuiltAppConfig.model_list : [];
  const availableIds = modelList.map((item) => item?.model_id).filter(Boolean);

  const preferredAvailable = PREFERRED_MODELS.filter((preferred) => availableIds.includes(preferred));
  if (preferredAvailable.length > 0) return preferredAvailable;

  const chatLike = availableIds.filter((id) => isChatLikeModel(id));
  if (chatLike.length > 0) return chatLike;

  return ['Llama-3.2-1B-Instruct-q4f16_1-MLC', 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'];
}

export async function diagnoseWebLLMSupport() {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'solo disponible en navegador' };
  }
  if (!window.isSecureContext) {
    return { ok: false, reason: 'se requiere contexto seguro (HTTPS o localhost)' };
  }
  if (!('gpu' in navigator)) {
    return { ok: false, reason: 'WebGPU no está disponible en este navegador' };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { ok: false, reason: 'no se encontró adaptador GPU compatible' };
    return { ok: true, reason: '' };
  } catch {
    return { ok: false, reason: 'falló la inicialización de WebGPU' };
  }
}

async function createEngineWithFallback(onProgress = null) {
  const { CreateMLCEngine } = await loadWebLLMModule();
  const candidates = await listModelCandidates();
  const errors = [];

  for (const candidate of candidates) {
    try {
      if (typeof onProgress === 'function') {
        onProgress({ progress: 0, text: `Intentando ${candidate}` });
      }
      const engine = await CreateMLCEngine(candidate, {
        initProgressCallback: (progress) => {
          if (typeof onProgress === 'function') onProgress(progress);
        },
      });
      modelIdLoaded = candidate;
      return engine;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err || 'error desconocido');
      errors.push(`${candidate}: ${detail}`);
    }
  }

  throw new Error(errors.length ? errors.join(' | ') : 'no fue posible inicializar WebLLM');
}

async function pickModelId() {
  const candidates = await listModelCandidates();
  for (const preferred of PREFERRED_MODELS) {
    if (candidates.includes(preferred)) return preferred;
  }

  return candidates[0] || 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
}

export async function getAIModel(onProgress = null) {
  if (typeof window === 'undefined') return null;
  if (engineInstance) return engineInstance;
  if (loadingPromise) return loadingPromise;

  const support = await diagnoseWebLLMSupport();
  if (!support.ok) {
    throw new Error(support.reason || 'WebLLM no soportado');
  }

  modelIdLoaded = await pickModelId();

  loadingPromise = (async () => {
    engineInstance = await createEngineWithFallback(onProgress);
    return engineInstance;
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

export function getLoadedModelId() {
  return modelIdLoaded;
}

export async function resetAIModel() {
  if (engineInstance?.unload) {
    await engineInstance.unload();
  }
  engineInstance = null;
  loadingPromise = null;
  modelIdLoaded = null;
}
