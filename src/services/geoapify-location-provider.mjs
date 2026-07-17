const clean = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');

function providerError(status) {
  if (status === 401 || status === 403) return Object.assign(new Error('Location service credential is invalid or unauthorized.'), { status: 502, code: 'LOCATION_PROVIDER_UNAUTHORIZED' });
  if (status === 429) return Object.assign(new Error('Location service rate limit was reached.'), { status: 429, code: 'LOCATION_PROVIDER_RATE_LIMIT' });
  return Object.assign(new Error(`Location service request failed (${status}).`), { status: status >= 500 ? 502 : status, code: 'LOCATION_PROVIDER_ERROR' });
}

export function createGeoapifyLocationProvider({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const apiKey = clean(env.GEOAPIFY_API_KEY);
  const enabled = String(env.GEOAPIFY_LOCATION_PROVIDER_ENABLED ?? 'true').toLowerCase() === 'true';
  const baseUrl = (clean(env.GEOAPIFY_API_BASE_URL) || 'https://api.geoapify.com').replace(/\/$/, '');
  const timeoutMs = Math.max(1000, Number(env.GEOAPIFY_REQUEST_TIMEOUT_MS || 30000));
  return {
    key: 'geoapify',
    displayName: 'Geoapify',
    enabled,
    credentialPresent: Boolean(apiKey),
    async search({ text, limit = 8, language = 'en' }) {
      const target = new URL(`${baseUrl}/v1/geocode/autocomplete`);
      target.searchParams.set('text', text);
      target.searchParams.set('type', 'locality');
      target.searchParams.set('format', 'json');
      target.searchParams.set('lang', language);
      target.searchParams.set('limit', String(limit));
      target.searchParams.set('apiKey', apiKey);
      let response;
      try {
        response = await fetchImpl(target, { signal: AbortSignal.timeout(timeoutMs) });
      } catch (error) {
        const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
        throw Object.assign(new Error(timedOut ? 'Location service request timed out.' : 'Location service is unavailable.'), { status: 502, code: timedOut ? 'LOCATION_PROVIDER_TIMEOUT' : 'LOCATION_PROVIDER_UNAVAILABLE' });
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw providerError(response.status);
      return (Array.isArray(payload.results) ? payload.results : []).map(item => ({
        formatted_location: clean(item.formatted),
        country: clean(item.country),
        country_code: clean(item.country_code).toLowerCase(),
        state: clean(item.state) || null,
        city: clean(item.city || item.name) || null,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
        bounds: item.bbox ?? null,
        location_provider: 'geoapify',
        provider_location_id: clean(item.place_id)
      }));
    }
  };
}
