import axios from 'axios';

const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_BASE_URL = isProduction
  ? 'https://mini-project-aqi-murex.vercel.app'
  : 'http://localhost:5000';

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || DEFAULT_BASE_URL;

axios.defaults.baseURL = API_BASE_URL;
axios.defaults.timeout = 90000;
axios.defaults.headers.common.Accept = 'application/json';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000,
  headers: { Accept: 'application/json' },
});

const CACHE = new Map();
const IN_FLIGHT = new Map();
const SEARCH_CACHE = new Map();
const SEARCH_IN_FLIGHT = new Map();
const TTL_MS = 5 * 60 * 1000;

function _cacheKey(city) {
  return `city:${(city || '').toString().trim().toLowerCase()}`;
}

function _requestWithFallback(request, fallbackValue = []) {
  return request().catch((err) => {
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }
    throw err;
  });
}

export async function getCityData(city, options = {}) {
  const key = _cacheKey(city);
  const now = Date.now();
  const cached = CACHE.get(key);
  if (cached && (now - cached._ts) < TTL_MS) {
    return cached.payload;
  }

  if (IN_FLIGHT.has(key)) {
    return IN_FLIGHT.get(key);
  }

  const compact = options.compact === true;
  const url = `/aqi/${encodeURIComponent(city || '')}${compact ? '?compact=true' : ''}`;
  const promise = api.get(url).then((res) => {
    const payload = res?.data || {};
    CACHE.set(key, { _ts: Date.now(), payload });
    IN_FLIGHT.delete(key);
    return payload;
  }).catch((err) => {
    IN_FLIGHT.delete(key);
    throw err;
  });

  IN_FLIGHT.set(key, promise);
  return promise;
}

export async function getCitySuggestions(prefix, limit = 6) {
  const normalized = (prefix || '').toString().trim().toLowerCase();
  if (!normalized || normalized.length < 2) {
    return [];
  }

  const key = `suggest:${normalized}:${limit}`;
  const now = Date.now();
  const cached = SEARCH_CACHE.get(key);
  if (cached && (now - cached._ts) < TTL_MS) {
    return cached.payload;
  }

  if (SEARCH_IN_FLIGHT.has(key)) {
    return SEARCH_IN_FLIGHT.get(key);
  }

  const promise = _requestWithFallback(() => api.get(`/search-cities?q=${encodeURIComponent(prefix.trim())}&limit=${limit}`), [])
    .then((res) => {
      const payload = Array.isArray(res?.data) ? res.data : [];
      SEARCH_CACHE.set(key, { _ts: Date.now(), payload });
      SEARCH_IN_FLIGHT.delete(key);
      return payload;
    })
    .catch((err) => {
      SEARCH_IN_FLIGHT.delete(key);
      throw err;
    });

  SEARCH_IN_FLIGHT.set(key, promise);
  return promise;
}

export async function getNearby(lat, lon, radius = 50) {
  if (lat == null || lon == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) {
    return { localities: [], center_city: null, source: 'no_data' };
  }

  const key = `nearby:${lat}:${lon}:${radius}`;
  const now = Date.now();
  const cached = CACHE.get(key);
  if (cached && (now - cached._ts) < TTL_MS) {
    return cached.payload;
  }
  if (IN_FLIGHT.has(key)) return IN_FLIGHT.get(key);

  const promise = _requestWithFallback(() => api.get(`/nearby?lat=${lat}&lon=${lon}&radius=${radius}`), { localities: [], center_city: null, source: 'no_data' }).then((res) => {
    const payload = res?.data || { localities: [], center_city: null, source: 'no_data' };
    CACHE.set(key, { _ts: Date.now(), payload });
    IN_FLIGHT.delete(key);
    return payload;
  }).catch((err) => {
    IN_FLIGHT.delete(key);
    throw err;
  });

  IN_FLIGHT.set(key, promise);
  return promise;
}

export async function getRanking() {
  const key = 'ranking';
  const now = Date.now();
  const cached = CACHE.get(key);
  if (cached && (now - cached._ts) < TTL_MS) return cached.payload;
  if (IN_FLIGHT.has(key)) return IN_FLIGHT.get(key);

  const promise = _requestWithFallback(() => api.get('/aqi-ranking'), []).then((res) => {
    const payload = Array.isArray(res?.data) ? res.data : [];
    CACHE.set(key, { _ts: Date.now(), payload });
    IN_FLIGHT.delete(key);
    return payload;
  }).catch((err) => {
    IN_FLIGHT.delete(key);
    throw err;
  });

  IN_FLIGHT.set(key, promise);
  return promise;
}

export async function getHeatmap() {
  const key = 'heatmap';
  const now = Date.now();
  const cached = CACHE.get(key);
  if (cached && (now - cached._ts) < TTL_MS) return cached.payload;
  if (IN_FLIGHT.has(key)) return IN_FLIGHT.get(key);

  const promise = _requestWithFallback(() => api.get('/aqi-heatmap'), []).then((res) => {
    const payload = Array.isArray(res?.data) ? res.data : [];
    CACHE.set(key, { _ts: Date.now(), payload });
    IN_FLIGHT.delete(key);
    return payload;
  }).catch((err) => {
    IN_FLIGHT.delete(key);
    throw err;
  });

  IN_FLIGHT.set(key, promise);
  return promise;
}

export default api;
