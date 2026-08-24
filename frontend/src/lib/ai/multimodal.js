// Multimodal BYOK — Gemini + OpenRouter (Gemini Flash / Nvidia Nemotron), 100% frontend
const GEMINI_KEY_LS = 'flowerxi_gemini_key';
const OPENROUTER_KEY_LS = 'flowerxi_openrouter_key';

export function getGeminiKey() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(GEMINI_KEY_LS) || import.meta.env.PUBLIC_GEMINI_API_KEY || '';
}
export function getOpenRouterKey() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(OPENROUTER_KEY_LS) || import.meta.env.PUBLIC_OPENROUTER_API_KEY || '';
}
export function setGeminiKey(k) { if (typeof window !== 'undefined') localStorage.setItem(GEMINI_KEY_LS, String(k||'').trim()); }
export function setOpenRouterKey(k) { if (typeof window !== 'undefined') localStorage.setItem(OPENROUTER_KEY_LS, String(k||'').trim()); }

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      const b64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function callGeminiVision(file, prompt, regionContext) {
  const key = getGeminiKey();
  if (!key) throw new Error('Falta API key de Gemini. Pega tu key en Ajustes o define PUBLIC_GEMINI_API_KEY.');
  const b64 = await fileToBase64(file);
  const mime = file.type || 'image/jpeg';
  const body = {
    contents: [{
      parts: [
        { text: `${prompt}\n\nContexto flowerxi: ${JSON.stringify(regionContext || {})}. Responde en español, breve y accionable.` },
        { inline_data: { mime_type: mime, data: b64 } }
      ]
    }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 320 }
  };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Sin respuesta';
}

export async function callOpenRouterVision(file, prompt, regionContext, model = 'google/gemini-flash-1.5') {
  const key = getOpenRouterKey();
  if (!key) throw new Error('Falta API key de OpenRouter. Pega tu key en Ajustes o define PUBLIC_OPENROUTER_API_KEY.');
  const b64 = await fileToBase64(file);
  const mime = file.type || 'image/jpeg';
  const dataUrl = `data:${mime};base64,${b64}`;
  const body = {
    model, // e.g. 'google/gemini-flash-1.5' o 'nvidia/llama-3.1-nemotron-70b-instruct' (si visión)
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `${prompt}\n\nContexto flowerxi: ${JSON.stringify(regionContext||{})}. Responde en español, breve.` },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }],
    max_tokens: 320,
    temperature: 0.3
  };
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': location.origin,
      'X-Title': 'flowerxi'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || 'Sin respuesta';
}
