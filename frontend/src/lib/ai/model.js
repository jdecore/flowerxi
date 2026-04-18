import { env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = 'onnx-community/SmolLM-135M-ONNX';

let modelInstance = null;
let loadingPromise = null;

export async function getAIModel() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (modelInstance) {
    return modelInstance;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const { pipeline, Env } = await import('@huggingface/transformers');

    let device = 'webgpu';
    let dtype = 'q4';

    try {
      console.log('[flowerxi-ai] Loading model:', MODEL_ID);
      modelInstance = await pipeline('text-generation', MODEL_ID, {
        dtype,
        device,
        progress_callback: (event) => {
          if (event?.status === 'progress') {
            console.log(`[flowerxi-ai] Loading ${Math.round(event.progress * 100)}%`);
          }
        },
      });
      console.log('[flowerxi-ai] Model loaded successfully');
    } catch (webgpuError) {
      console.warn('[flowerxi-ai] WebGPU failed, trying CPU fallback:', webgpuError?.message || webgpuError);
      try {
        modelInstance = await pipeline('text-generation', MODEL_ID, {
          dtype: 'q4',
          device: 'cpu',
          progress_callback: (event) => {
            if (event?.status === 'progress') {
              console.log(`[flowerxi-ai] Loading (CPU) ${Math.round(event.progress * 100)}%`);
            }
          },
        });
        console.log('[flowerxi-ai] Model loaded on CPU');
      } catch (cpuError) {
        console.error('[flowerxi-ai] All backends failed:', cpuError);
        throw new Error(`No se pudo cargar el modelo (WebGPU: ${webgpuError?.message}, CPU: ${cpuError?.message})`);
      }
    }

    return modelInstance;
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

export function resetAIModel() {
  modelInstance = null;
  loadingPromise = null;
}