let modelInstance = null;
let loadingPromise = null;

const MODEL_TASK = 'text2text-generation';
const MODEL_ID = 'Xenova/LaMini-Flan-T5-77M';

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
    modelInstance = await pipeline(MODEL_TASK, MODEL_ID, {
      quantized: true,
      progress_callback: (event) => {
        if (event?.status === 'progress') {
          console.debug(`[flowerxi-ai] loading ${Math.round(event.progress)}%`);
        }
      },
    });
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

