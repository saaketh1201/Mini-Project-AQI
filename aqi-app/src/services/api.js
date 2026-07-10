import axios from 'axios';

const CACHE = new Map();
const IN_FLIGHT = new Map();
const SEARCH_CACHE = new Map();
const SEARCH_IN_FLIGHT = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function _cacheKey(city) {
  return `city:${(city || '').toString().trim().toLowerCase()}`;
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
  const url = `/aqi/${encodeURIComponent(city)}${compact ? '?compact=true' : ''}`;
  const promise = axios.get(url).then((res) => {
    const payload = res.data;
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

  const promise = axios
    .get(`/search-cities?q=${encodeURIComponent(prefix.trim())}&limit=${limit}`)
    .then((res) => {
      const payload = res.data || [];
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
  const key = `nearby:${lat}:${lon}:${radius}`;
  const now = Date.now();
  const cached = CACHE.get(key);
  if (cached && (now - cached._ts) < TTL_MS) {
    return cached.payload;
  }
  if (IN_FLIGHT.has(key)) return IN_FLIGHT.get(key);

  const promise = axios.get(`/nearby?lat=${lat}&lon=${lon}&radius=${radius}`).then((res) => {
    const payload = res.data;
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
  const key = `ranking`;
  const now = Date.now();
  const cached = CACHE.get(key);
  if (cached && (now - cached._ts) < TTL_MS) return cached.payload;
  if (IN_FLIGHT.has(key)) return IN_FLIGHT.get(key);

  const promise = axios.get('/aqi-ranking').then((res) => {
    const payload = res.data;
    CACHE.set(key, { _ts: Date.now(), payload });
    IN_FLIGHT.delete(key);
    return payload;
  }).catch((err) => { IN_FLIGHT.delete(key); throw err; });

  IN_FLIGHT.set(key, promise);
  return promise;
}
