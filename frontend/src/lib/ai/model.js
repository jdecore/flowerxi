let modelInstance = null;
let loadingPromise = null;

const MODEL_TASK = 'text-generation';
const MODEL_ID = 'onnx-community/LFM2.5-350M-ONNX';

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
    const { pipeline } = await import('@xenova/transformers');
    
    let device = 'webgpu';
    let dtype = 'q4';
    
    try {
      const test = await pipeline(MODEL_TASK, MODEL_ID, {
        dtype,
        device,
        progress_callback: (event) => {
          if (event?.status === 'progress') {
            console.debug(`[flowerxi-ai] loading ${Math.round(event.progress)}%`);
          }
        },
      });
      modelInstance = test;
    } catch (webgpuError) {
      console.warn('[flowerxi-ai] WebGPU failed, trying CPU fallback:', webgpuError?.message || webgpuError);
      try {
        const cpuFallback = await pipeline(MODEL_TASK, MODEL_ID, {
          dtype: 'q4',
          device: 'cpu',
          progress_callback: (event) => {
            if (event?.status === 'progress') {
              console.debug(`[flowerxi-ai] loading (CPU) ${Math.round(event.progress)}%`);
            }
          },
        });
        modelInstance = cpuFallback;
      } catch (cpuError) {
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

