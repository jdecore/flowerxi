// Multimodal análisis floral — Gemini 3.5 Flash Lite + fallback Nemotron 3.5 Lightning (OpenRouter)
// Prompt especializado para diagnóstico y tratamiento de flores de corte
const GEMINI_KEY_LS = 'flowerxi_gemini_key';
const OPENROUTER_KEY_LS = 'flowerxi_openrouter_key';
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const NEMOTRON_MODEL = 'nvidia/nemotron-3.5-lightning:free';

export const FLOWER_ANALYSIS_PROMPT = `Eres fitopatólogo experto en flores de corte de la Sabana de Bogotá (rosa, clavel, alstroemeria, crisantemo, gypsophila).
Especialidades: Botrytis cinerea (moho gris), Mildiu velloso, Oídio, Fusarium, Roya, ácaros, trips y deficiencias nutricionales.

Contexto Flowerxi: municipio, clima últimos 7 días, score fúngico/agua/calor. Úsalo para correlacionar (ej: humedad >80% + 12-19°C + precipitación = Botrytis alto).

Tarea: Analiza la imagen de flor/hoja/tallo/botón con rigor.

Devuelve en español, Markdown conciso:

**1. Diagnóstico:** [Sano | Enfermedad: nombre científico + común] — confianza X%
**2. Síntomas visibles:** puntos/necrosis/micelio/deformación donde se ven
**3. Severidad:** Leve / Moderada / Grave + por qué
**4. Tratamiento inmediato:**
  - Químico: principio activo + dosis (ej: Tebuconazol 0.8 ml/L o Azoxystrobin 0.6 g/L), carencia y reentrada
  - Cultural: poda sanitaria, ventilación 10-14h, ajustar riego a 5am, drenaje
  - Orgánico/biológico: Bacillus subtilis, Trichoderma, bicarbonato potásico
**5. Prevención:** manejo de humedad, densidad, desinfección tijeras, rotación
**6. Seguimiento:** re-inspección en X días, qué fotografiar, umbral para repetir aplicación
Si no es flor o imagen borrosa, dilo y pide mejor toma (luz natural, enfoque botón/hoja). No inventes; si dudas da diferencial.
Responde breve, accionable, sin repetir el prompt.`;

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
  if (!key) throw new Error('Falta API key de Gemini. Configúrala en la card de análisis o define PUBLIC_GEMINI_API_KEY.');
  const b64 = await fileToBase64(file);
  const mime = file.type || 'image/jpeg';
  const fullPrompt = `${prompt}\n\n${FLOWER_ANALYSIS_PROMPT}\n\nContexto Flowerxi: ${JSON.stringify(regionContext || {})}`;
  const body = {
    contents: [{ parts: [{ text: fullPrompt }, { inline_data: { mime_type: mime, data: b64 } }] }],
    generationConfig: { temperature: 0.25, maxOutputTokens: 900 }
  };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Gemini ${GEMINI_MODEL} error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Sin respuesta';
}

export async function callOpenRouterVision(file, prompt, regionContext, model = NEMOTRON_MODEL) {
  const key = getOpenRouterKey();
  if (!key) throw new Error('Falta API key de OpenRouter. Configúrala en la card o define PUBLIC_OPENROUTER_API_KEY.');
  const b64 = await fileToBase64(file);
  const mime = file.type || 'image/jpeg';
  const dataUrl = `data:${mime};base64,${b64}`;
  const fullPrompt = `${prompt}\n\n${FLOWER_ANALYSIS_PROMPT}\n\nContexto: ${JSON.stringify(regionContext||{})}`;
  const body = {
    model,
    messages: [{ role: 'user', content: [{ type: 'text', text: fullPrompt }, { type: 'image_url', image_url: { url: dataUrl } }] }],
    max_tokens: 1000, temperature: 0.25
  };
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'HTTP-Referer': location.origin, 'X-Title': 'flowerxi' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`OpenRouter ${model} error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || 'Sin respuesta';
}

// Wrapper con fallback automático: intenta Gemini, si falla por quota/key usa Nemotron
export async function analyzeFlowerWithFallback(file, regionContext, extraPrompt = '') {
  const basePrompt = extraPrompt || 'Analiza esta flor de corte de la Sabana de Bogotá.';
  try {
    return { provider: GEMINI_MODEL, text: await callGeminiVision(file, basePrompt, regionContext) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // fallback a Nemotron si es error de cuota/key/modelo
    if (msg.includes('429') || msg.includes('quota') || msg.includes('API key') || msg.includes('404') || msg.includes('Gemini')) {
      const text = await callOpenRouterVision(file, basePrompt, regionContext, NEMOTRON_MODEL);
      return { provider: NEMOTRON_MODEL, text };
    }
    throw e;
  }
}
