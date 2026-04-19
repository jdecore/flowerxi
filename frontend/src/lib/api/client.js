const responseCache = new Map();
const inflightCache = new Map();

const cloneData = (value) => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const normalizeBaseUrl = (raw) => String(raw ?? '').trim().replace(/\/+$/, '');

const buildApiBases = (raw) => {
  const configured = normalizeBaseUrl(raw);
  const candidates = [];
  if (configured) candidates.push(configured);

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      candidates.push(`${window.location.protocol}//${host}:8000`);
      candidates.push('http://localhost:8000');
      candidates.push('http://127.0.0.1:8000');
    }
  }

  candidates.push('');
  return [...new Set(candidates)];
};

const endpoint = (base, path) => {
  if (!base) return path;
  if (base.endsWith('/api') && path.startsWith('/api/')) {
    return `${base}${path.slice(4)}`;
  }
  return `${base}${path}`;
};

const sleepAbort = (ms, controller) =>
  setTimeout(() => {
    controller.abort();
  }, ms);

export const fetchJsonCached = async (path, options = {}) => {
  const {
    apiUrl = '',
    init = undefined,
    cacheTtlMs = 12_000,
    timeoutMs = 12_000,
    throwOnError = true,
    bypassCache = false,
    cacheKey = '',
  } = options;

  const method = String(init?.method || 'GET').toUpperCase();
  const effectiveTtl = method === 'GET' ? cacheTtlMs : 0;
  const globalForceFresh =
    typeof window !== 'undefined' &&
    Number(window.__flowerxiForceFreshUntil || 0) > Date.now();
  const skipCache = bypassCache || globalForceFresh;
  const key = cacheKey || `${normalizeBaseUrl(apiUrl)}|${method}|${path}`;

  if (!skipCache && effectiveTtl > 0) {
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cloneData(cached.data);
    }
  }

  if (!skipCache && inflightCache.has(key)) {
    return cloneData(await inflightCache.get(key));
  }

  const requestPromise = (async () => {
    const apiBases = buildApiBases(apiUrl);
    let lastError = null;

    for (const base of apiBases) {
      const controller = new AbortController();
      const timer = sleepAbort(timeoutMs, controller);
      try {
        const res = await fetch(endpoint(base, path), {
          headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
          ...init,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
        const data = await res.json();
        if (effectiveTtl > 0) {
          responseCache.set(key, {
            data,
            expiresAt: Date.now() + effectiveTtl,
          });
        }
        return data;
      } catch (err) {
        clearTimeout(timer);
        lastError = err instanceof Error ? err : new Error('network');
      }
    }

    throw lastError ?? new Error('network');
  })();

  if (!skipCache) inflightCache.set(key, requestPromise);

  try {
    return cloneData(await requestPromise);
  } catch (err) {
    if (throwOnError) throw err;
    return null;
  } finally {
    if (!skipCache) inflightCache.delete(key);
  }
};

export const clearApiCache = () => {
  responseCache.clear();
  inflightCache.clear();
};
