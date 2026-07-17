const clean = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');

export function normalizeLocation(value) {
  const location = value && typeof value === 'object' ? value : {};
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const normalized = {
    formatted_location: clean(location.formatted_location),
    country: clean(location.country),
    country_code: clean(location.country_code).toLowerCase(),
    state: clean(location.state) || null,
    city: clean(location.city) || null,
    latitude,
    longitude,
    bounds: location.bounds ?? null,
    location_provider: clean(location.location_provider),
    provider_location_id: clean(location.provider_location_id)
  };
  if (!normalized.formatted_location || !normalized.country || !normalized.country_code ||
      !normalized.location_provider || !normalized.provider_location_id ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw Object.assign(new Error('Select a valid location suggestion.'), { status: 400, code: 'INVALID_LOCATION_SELECTION' });
  }
  return normalized;
}

export function createLocationProviderRegistry({ providers = [], defaultProviderKey } = {}) {
  const entries = new Map();
  for (const provider of providers) {
    if (!provider?.key || typeof provider.search !== 'function') throw new Error('Location Provider must expose key and search().');
    if (entries.has(provider.key)) throw new Error(`Duplicate Location Provider: ${provider.key}`);
    entries.set(provider.key, provider);
  }
  const defaultKey = defaultProviderKey || providers[0]?.key || null;
  return {
    list() {
      return [...entries.values()].map(provider => ({
        key: provider.key,
        displayName: provider.displayName,
        enabled: Boolean(provider.enabled),
        credentialPresent: Boolean(provider.credentialPresent)
      }));
    },
    async search({ providerKey = defaultKey, text, limit = 8, language = 'en' } = {}) {
      const provider = entries.get(providerKey);
      if (!provider) throw Object.assign(new Error('Unknown Location Provider.'), { status: 400, code: 'UNKNOWN_LOCATION_PROVIDER' });
      if (!provider.enabled) throw Object.assign(new Error('Location service is disabled.'), { status: 503, code: 'LOCATION_PROVIDER_DISABLED' });
      if (!provider.credentialPresent) throw Object.assign(new Error('Location service credential is not configured.'), { status: 503, code: 'LOCATION_PROVIDER_CREDENTIAL_MISSING' });
      const query = clean(text);
      if (query.length < 2) return [];
      const results = await provider.search({ text: query, limit: Math.max(1, Math.min(10, Number(limit) || 8)), language });
      return results.map(normalizeLocation);
    }
  };
}
