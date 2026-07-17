const DEFAULT_BASE_URL = 'https://api.geoapify.com';
export const GEOAPIFY_CATEGORY_MAP = Object.freeze({
  'furniture and interior': 'commercial.furniture_and_interior',
  'commercial.furniture_and_interior': 'commercial.furniture_and_interior'
});

const clean = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const secretPattern = /authorization|api[-_ ]?key|cookie|secret/i;
const round = value => Math.round(Number(value || 0) * 1e6) / 1e6;

function redactUrl(value) {
  return String(value ?? '').replace(/([?&]apiKey=)[^&\s]+/gi, '$1[REDACTED]');
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'string') return redactUrl(value);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !secretPattern.test(key)).map(([key, item]) => [key, redact(item)]));
}

function connectorError(code, message, status = 400, retryable = false, extra = {}) {
  return Object.assign(new Error(redactUrl(message)), { code, status, retryable, retryAfterMs: 0, ...extra });
}

function classifyResponse(status, payload, headers, extra = {}) {
  const providerMessage = redactUrl(clean(payload?.message || payload?.error?.message || payload?.error || 'Geoapify request failed.'));
  const retryAfterMs = Math.max(0, Number(headers?.get?.('retry-after') || 0) * 1000);
  if (status === 401 || status === 403 || /api.?key|unauthori[sz]ed|forbidden/i.test(providerMessage)) return connectorError('INVALID_API_KEY', 'Geoapify API key is invalid or unauthorized.', status, false, extra);
  if (status === 429) return connectorError('RATE_LIMIT', 'Geoapify rate limit or credit limit reached.', status, true, { ...extra, retryAfterMs });
  if (status >= 500) return connectorError('TEMPORARY_SERVER_ERROR', 'Geoapify is temporarily unavailable.', status, true, { ...extra, retryAfterMs });
  return connectorError('UNKNOWN_PROVIDER_ERROR', providerMessage, status, false, extra);
}

function categoryFor(request) {
  const values = [...(request.query?.categories || []), ...(request.query?.keywords || [])].map(clean).filter(Boolean);
  for (const value of values) {
    const direct = GEOAPIFY_CATEGORY_MAP[value.toLowerCase()];
    if (direct) return direct;
    if (/furniture|interior/i.test(value)) return 'commercial.furniture_and_interior';
  }
  return null;
}

function locationFor(request) {
  return clean(request.query?.locations?.[0] || request.query?.location || '');
}

async function fetchJson(fetchImpl, url, timeoutMs, errorContext) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try { response = await fetchImpl(url, { method: 'GET', signal: controller.signal }); }
  catch (error) {
    if (error?.name === 'AbortError') throw connectorError('TIMEOUT', 'Geoapify request timed out.', 504, true, errorContext);
    throw connectorError('TEMPORARY_SERVER_ERROR', 'Geoapify network request failed.', 503, true, errorContext);
  } finally { clearTimeout(timer); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw classifyResponse(response.status, payload, response.headers, errorContext);
  return { payload, requestId: response.headers?.get?.('x-request-id') || null };
}

function geocodingFeature(payload) {
  if (Array.isArray(payload?.features)) return payload.features[0] || null;
  if (Array.isArray(payload?.results)) {
    const result = payload.results[0];
    return result ? { properties: result, geometry: { coordinates: [result.lon, result.lat] } } : null;
  }
  return null;
}

export function createGeoapifyPlacesConnector({ env = process.env, fetchImpl = globalThis.fetch, normalize } = {}) {
  const apiKey = clean(env.GEOAPIFY_API_KEY);
  const enabled = String(env.GEOAPIFY_CONNECTOR_ENABLED ?? 'true').toLowerCase() === 'true';
  const baseUrl = (clean(env.GEOAPIFY_API_BASE_URL) || DEFAULT_BASE_URL).replace(/\/$/, '');
  const timeoutMs = Math.max(1000, Number(env.GEOAPIFY_REQUEST_TIMEOUT_MS || 30000));
  const creditValueUsd = Math.max(0, Number(env.GEOAPIFY_CREDIT_VALUE_USD || 0));

  return {
    key: 'geoapify-places', version: '1.0.0', displayName: 'Geoapify Places', enabled, approved: true,
    costType: 'credit-free-plan', credentialPresent: Boolean(apiKey),
    capabilities: () => ({ pagination: true, checkpoint: true, retry: true, partialSuccess: true, stableExternalId: true, pageSize: 20, locationResolution: true }),
    validateConfig: context => Boolean(enabled && apiKey && context?.task && context?.strategy),
    estimate(request) {
      const pages = Math.max(1, Math.min(Number(request.limits?.maxPages || 1), Math.ceil(Number(request.limits?.maxResults || 1) / 20)));
      const placesCredits = pages;
      const geocodingCredits = 1;
      const credits = geocodingCredits + placesCredits;
      const monetary = round(credits * creditValueUsd);
      return {
        currency: 'USD', low: monetary, expected: monetary, high: monetary,
        estimatedCreditCount: credits, estimated_credit_count: credits, estimatedGeocodingCredits: geocodingCredits,
        estimatedPlacesCredits: placesCredits, estimatedRequestCount: pages + 1, estimated_request_count: pages + 1,
        actualCreditCount: 0, freePlanCreditUsage: 0, configuredCreditValueUsd: creditValueUsd,
        category: categoryFor(request), searchLocation: locationFor(request), pageSize: 20, maxPages: pages,
        pricingVersion: `geoapify-free-plan-credit-${creditValueUsd.toFixed(6)}`,
        pricingConfigSnapshot: { configuredCreditValueUsd: creditValueUsd, geocodingCreditsPerRequest: 1, placesCreditsPer20Results: 1 },
        disclaimer: 'Credits are provider usage units. Calculated monetary cost is zero only when GEOAPIFY_CREDIT_VALUE_USD=0.'
      };
    },
    async executePage(request, checkpoint = {}) {
      if (!enabled) throw connectorError('CONNECTOR_DISABLED', 'Geoapify Places Connector is disabled.', 409);
      if (!apiKey) throw connectorError('MISSING_CREDENTIAL', 'Geoapify API credential is missing.', 409);
      const category = categoryFor(request);
      if (!category) throw connectorError('UNSUPPORTED_CATEGORY', 'Geoapify category is required. Supported mapping: Furniture and Interior.', 409);
      const searchLocation = locationFor(request);
      if (!searchLocation) throw connectorError('LOCATION_REQUIRED', 'A geographic Search Task location is required.', 409);

      let resolution = checkpoint.locationResolution || null;
      let geocodingRequests = 0;
      let geocodingCredits = 0;
      let geocodingRequestId = checkpoint.geocodingRequestId || null;
      if (!resolution) {
        const geocodeUrl = new URL(`${baseUrl}/v1/geocode/search`);
        geocodeUrl.searchParams.set('text', searchLocation);
        geocodeUrl.searchParams.set('lang', clean(request.query?.languageCode) || 'en');
        geocodeUrl.searchParams.set('limit', '1');
        geocodeUrl.searchParams.set('format', 'geojson');
        geocodeUrl.searchParams.set('apiKey', apiKey);
        const geocoded = await fetchJson(fetchImpl, geocodeUrl, timeoutMs, { providerRequestCount: 1, actualCredits: 1 });
        geocodingRequests = 1; geocodingCredits = 1; geocodingRequestId = geocoded.requestId;
        const feature = geocodingFeature(geocoded.payload);
        if (!feature) throw connectorError('LOCATION_NOT_FOUND', `Geoapify could not resolve location: ${searchLocation}`, 422, false, { providerRequestCount: 1, actualCredits: 1 });
        const props = feature.properties || {}, coordinates = feature.geometry?.coordinates || [];
        resolution = {
          placeId: clean(props.place_id) || null, latitude: Number(props.lat ?? coordinates[1]), longitude: Number(props.lon ?? coordinates[0]),
          city: clean(props.city) || null, state: clean(props.state) || null, country: clean(props.country) || null,
          bbox: props.bbox || feature.bbox || null, formatted: clean(props.formatted) || null
        };
        if (!resolution.placeId && !(Number.isFinite(resolution.latitude) && Number.isFinite(resolution.longitude))) throw connectorError('LOCATION_FILTER_UNAVAILABLE', 'Geoapify resolved the location without a usable place_id or coordinates.', 422, false, { providerRequestCount: 1, actualCredits: 1 });
      }

      const offset = Math.max(0, Number(checkpoint.offset || 0));
      const remaining = Math.max(1, Number(request.limits?.maxResults || 20) - offset);
      const limit = Math.min(20, remaining);
      const filter = resolution.placeId ? `place:${resolution.placeId}` : `circle:${resolution.longitude},${resolution.latitude},25000`;
      const placesUrl = new URL(`${baseUrl}/v2/places`);
      placesUrl.searchParams.set('categories', category);
      placesUrl.searchParams.set('filter', filter);
      placesUrl.searchParams.set('limit', String(limit));
      placesUrl.searchParams.set('offset', String(offset));
      placesUrl.searchParams.set('lang', clean(request.query?.languageCode) || 'en');
      placesUrl.searchParams.set('apiKey', apiKey);
      const failureCheckpoint = { offset, locationResolution: resolution, geocodingRequestId, category, searchLocation, filter };
      const places = await fetchJson(fetchImpl, placesUrl, timeoutMs, { checkpoint: failureCheckpoint, providerRequestCount: geocodingRequests + 1, actualCredits: geocodingCredits + 1 });
      const capturedAt = new Date().toISOString();
      const features = Array.isArray(places.payload?.features) ? places.payload.features : [];
      const records = features.map(feature => {
        const props = feature.properties || {}, coordinates = feature.geometry?.coordinates || [];
        const categories = Array.isArray(props.categories) ? props.categories : [];
        return {
          external_id: clean(props.place_id) || null, company_name: clean(props.name) || null,
          category: categories[0] || category, primary_business_type: categories[0] || null, additional_business_types: categories.slice(1), categories,
          address: clean(props.formatted) || null, formatted_address: clean(props.formatted) || null,
          address_line1: clean(props.address_line1) || null, address_line2: clean(props.address_line2) || null,
          city: clean(props.city) || null, county: clean(props.county) || null, state: clean(props.state) || null,
          postcode: clean(props.postcode) || null, country: clean(props.country) || null, country_code: clean(props.country_code) || null,
          latitude: Number(props.lat ?? coordinates[1]), longitude: Number(props.lon ?? coordinates[0]),
          website: clean(props.website) || null, phone: clean(props.contact?.phone || props.phone) || null,
          email: clean(props.contact?.email || props.email).toLowerCase() || null,
          datasource: props.datasource || null, attribution: props.attribution || places.payload?.attribution || null,
          source_url: clean(props.website) || null, search_category: category, search_location: searchLocation,
          location_filter: filter, location_resolution: resolution, captured_at: capturedAt, provider: 'Geoapify Places', provider_payload: feature
        };
      });
      const nextOffset = offset + records.length;
      return {
        records, nextCheckpoint: { offset: nextOffset, locationResolution: resolution, geocodingRequestId, category, searchLocation, filter },
        providerRequestId: places.requestId, providerRequestCount: geocodingRequests + 1, actualCredits: geocodingCredits + 1,
        estimatedUnits: geocodingCredits + 1, actualUnits: geocodingCredits + 1, calculatedUsageCost: round((geocodingCredits + 1) * creditValueUsd),
        hasMore: records.length === limit && nextOffset < Number(request.limits?.maxResults || 20), warnings: []
      };
    },
    normalize(record, context) {
      if (typeof normalize !== 'function') throw connectorError('SCHEMA_ERROR', 'Shared normalization function is unavailable.', 500);
      return { ...normalize(record, context), state: record.state, county: record.county, postcode: record.postcode, country_code: record.country_code, latitude: record.latitude, longitude: record.longitude, search_query: record.search_category, search_category: record.search_category, search_location: record.search_location };
    },
    buildEvidence(record, context) {
      const fields = { external_id:record.external_id, company_name:record.company_name, categories:record.categories, formatted_address:record.formatted_address, address_line1:record.address_line1, address_line2:record.address_line2, city:record.city, county:record.county, state:record.state, postcode:record.postcode, country:record.country, country_code:record.country_code, latitude:record.latitude, longitude:record.longitude, website:record.website, phone:record.phone, email:record.email, datasource:record.datasource };
      const returned = Object.entries(fields).filter(([, value]) => value !== null && value !== undefined && value !== '').map(([field]) => field);
      return {
        provider:'Geoapify Places', connectorKey:'geoapify-places', connectorVersion:'1.0.0', endpointType:'Geoapify Places API v2',
        externalId:record.external_id, sourceUrl:record.source_url, geoapifyCategory:record.search_category, searchQuery:record.search_category,
        originalStrategyLocation:record.search_location, locationFilter:record.location_filter, locationResolution:record.location_resolution,
        capturedTime:record.captured_at||context.capturedAt, capturedTimeSource:'server', executionId:context.executionId,
        providerRequestId:context.providerRequestId, rawPayloadId:context.rawPayloadId, rawPayloadReference:context.rawPayloadId,
        payloadHash:context.payloadHash, normalizationVersion:'v1', datasource:record.datasource, attribution:record.attribution,
        providerReturnedFields:returned, normalizedFromProviderFields:returned,
        missingUnknownFields:Object.keys(fields).filter(field=>!returned.includes(field)), ruleMappedFields:['customer_type','industry'], manuallyModifiedFields:[]
      };
    },
    classifyError: error => ({ code:error.code||'UNKNOWN_PROVIDER_ERROR', retryable:Boolean(error.retryable), retryAfterMs:Number(error.retryAfterMs||0), userMessage:redactUrl(clean(error.message)||'Geoapify request failed.'), checkpoint:error.checkpoint||null, providerRequestCount:Number(error.providerRequestCount||0), actualCredits:Number(error.actualCredits||0) }),
    redactForLog: redact,
    pricing: { unitPrice:creditValueUsd, creditValueUsd, pricingVersion:`geoapify-free-plan-credit-${creditValueUsd.toFixed(6)}`, unit:'credits' }
  };
}
