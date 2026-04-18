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

async function pickModelId() {
  const { prebuiltAppConfig } = await loadWebLLMModule();
  const modelList = Array.isArray(prebuiltAppConfig?.model_list) ? prebuiltAppConfig.model_list : [];
  const availableIds = modelList.map((item) => item?.model_id).filter(Boolean);

  for (const preferred of PREFERRED_MODELS) {
    if (availableIds.includes(preferred)) return preferred;
  }

  const fallback = availableIds.find((id) => isChatLikeModel(id));
  if (fallback) return fallback;

  return 'Llama-3.1-8B-Instruct';
}

export async function getAIModel(onProgress = null) {
  if (typeof window === 'undefined') return null;
  if (engineInstance) return engineInstance;
  if (loadingPromise) return loadingPromise;

  const selectedModel = await pickModelId();
  modelIdLoaded = selectedModel;

  loadingPromise = (async () => {
    const { CreateMLCEngine } = await loadWebLLMModule();
    engineInstance = await CreateMLCEngine(selectedModel, {
      initProgressCallback: (progress) => {
        if (typeof onProgress === 'function') onProgress(progress);
      },
    });
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
