const DEFAULT_BASE_URL = 'https://places.googleapis.com';
export const GOOGLE_PLACES_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.primaryType,places.types,places.googleMapsUri,places.websiteUri,places.nationalPhoneNumber,places.businessStatus,nextPageToken';

const clean = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const money = value => Math.round(Number(value || 0) * 1e6) / 1e6;
const secretPattern = /authorization|api[-_ ]?key|token(?!$)|cookie|secret/i;

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !secretPattern.test(key)).map(([key, item]) => [key, redact(item)]));
}

function addressValue(components, type, short = false) {
  const component = (components || []).find(item => (item.types || []).includes(type));
  return clean(short ? component?.shortText : component?.longText) || null;
}

function errorFor(code, message, status, retryable = false, retryAfterMs = 0) {
  return Object.assign(new Error(message), { code, status, retryable, retryAfterMs });
}

function providerError(status, payload, headers) {
  const providerStatus = clean(payload?.error?.status);
  const rawMessage = clean(payload?.error?.message);
  const message = rawMessage.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED]') || `Google Places request failed (${status}).`;
  const retryAfter = Math.max(0, Number(headers?.get?.('retry-after') || 0) * 1000);
  if (status === 401 || /API_KEY_INVALID|invalid api key/i.test(`${providerStatus} ${message}`)) return errorFor('INVALID_API_KEY', 'Google Places API key is invalid.', status);
  if (status === 429 || providerStatus === 'RESOURCE_EXHAUSTED') return errorFor('RATE_LIMIT', 'Google Places rate limit reached.', status, true, retryAfter);
  if (/billing/i.test(message)) return errorFor('BILLING_NOT_ENABLED', 'Google Maps Platform billing is not enabled.', status);
  if (status === 403 || providerStatus === 'PERMISSION_DENIED') return errorFor('PERMISSION_OR_API_DISABLED', 'Places API (New) is not enabled or this key lacks permission.', status);
  if (/field mask|fieldmask/i.test(message)) return errorFor('INVALID_FIELD_MASK', 'Google Places field mask is invalid.', status);
  if (/page token|pagetoken/i.test(message)) return errorFor('INVALID_PAGE_TOKEN', 'Google Places page token is invalid.', status);
  if (status >= 500) return errorFor('TEMPORARY_SERVER_ERROR', 'Google Places is temporarily unavailable.', status, true, retryAfter);
  return errorFor('UNKNOWN_PROVIDER_ERROR', message, status, false);
}

export function createGooglePlacesConnector({ env = process.env, fetchImpl = globalThis.fetch, normalize } = {}) {
  const apiKey = clean(env.GOOGLE_PLACES_API_KEY);
  const enabled = String(env.GOOGLE_PLACES_CONNECTOR_ENABLED ?? 'false').toLowerCase() === 'true';
  const baseUrl = clean(env.GOOGLE_PLACES_API_BASE_URL) || DEFAULT_BASE_URL;
  const fieldMask = clean(env.GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK) || GOOGLE_PLACES_FIELD_MASK;
  const timeoutMs = Math.max(1000, Number(env.GOOGLE_PLACES_REQUEST_TIMEOUT_MS || 30000));
  const unitPrice = Math.max(0, Number(env.GOOGLE_PLACES_ESTIMATED_PRICE_PER_REQUEST_USD || 0.035));
  const pricingVersion = `configured-text-search-enterprise-${unitPrice.toFixed(6)}`;

  return {
    key: 'google-places-new', version: '1.0.0', displayName: 'Google Places API (New)', enabled, approved: true,
    costType: 'paid-estimate', credentialPresent: Boolean(apiKey),
    capabilities: () => ({ pagination: true, checkpoint: true, retry: true, partialSuccess: true, stableExternalId: true, maxPageSize: 20 }),
    validateConfig: context => Boolean(enabled && apiKey && context?.task && context?.strategy && fieldMask && !fieldMask.includes('*')),
    estimate(request) {
      const estimatedRequestCount = Math.max(1, Math.min(Number(request.limits?.maxPages || 1), Math.ceil(Number(request.limits?.maxResults || 1) / 20)));
      const maximum = money(estimatedRequestCount * unitPrice);
      return {
        currency: 'USD', low: maximum, expected: maximum, high: maximum, estimatedRequestCount,
        estimated_request_count: estimatedRequestCount, configuredPricePerRequestUsd: unitPrice,
        pricingTier: 'Text Search Enterprise', includesEnterpriseFields: ['places.websiteUri', 'places.nationalPhoneNumber'],
        pricingVersion, pricingConfigSnapshot: { configuredPricePerRequestUsd: unitPrice, fieldMask, pricingTier: 'Text Search Enterprise' },
        pricing_config_snapshot: { configured_price_per_request_usd: unitPrice, field_mask: fieldMask, pricing_tier: 'Text Search Enterprise' },
        maxPages: request.limits?.maxPages, maxResults: request.limits?.maxResults, estimatedAt: new Date().toISOString(),
        disclaimer: 'Calculated budget estimate only; this is not the final Google billed amount.'
      };
    },
    async executePage(request, checkpoint = {}) {
      if (!enabled) throw errorFor('CONNECTOR_DISABLED', 'Google Places Connector is disabled.', 409);
      if (!apiKey) throw errorFor('MISSING_CREDENTIAL', 'Google Places API credential is missing.', 409);
      if (!fieldMask || fieldMask.includes('*')) throw errorFor('INVALID_FIELD_MASK', 'Google Places field mask must be explicit and cannot contain a wildcard.', 409);
      const keywords = (request.query?.keywords || []).map(clean).filter(Boolean);
      const locations = (request.query?.locations || []).map(clean).filter(Boolean);
      const categories = (request.query?.categories || []).map(clean).filter(Boolean);
      const textQuery = clean(request.query?.textQuery) || [...keywords.slice(0, 2), ...categories.slice(0, 1), ...locations.slice(0, 1)].filter(Boolean).join(' ') || 'restaurant furniture supplier';
      const remaining = Math.max(1, Number(request.limits?.maxResults || 20) - Number(checkpoint.resultOffset || 0));
      const body = { textQuery, pageSize: Math.min(20, remaining) };
      if (checkpoint.pageToken) body.pageToken = checkpoint.pageToken;
      if (request.query?.languageCode) body.languageCode = request.query.languageCode;
      if (request.query?.regionCode) body.regionCode = request.query.regionCode;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/v1/places:searchText`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': fieldMask }, body: JSON.stringify(body), signal: controller.signal });
      } catch (error) {
        if (error?.name === 'AbortError') throw errorFor('TIMEOUT', 'Google Places request timed out.', 504, true);
        throw errorFor('TEMPORARY_SERVER_ERROR', 'Google Places network request failed.', 503, true);
      } finally { clearTimeout(timer); }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw providerError(response.status, payload, response.headers);
      const capturedAt = new Date().toISOString();
      const records = (payload.places || []).map(place => {
        const state = addressValue(place.addressComponents, 'administrative_area_level_1');
        const country = addressValue(place.addressComponents, 'country');
        return {
          external_id: clean(place.id) || null, company_name: clean(place.displayName?.text) || null,
          address: clean(place.formattedAddress) || null, formatted_address: clean(place.formattedAddress) || null,
          city: addressValue(place.addressComponents, 'locality') || addressValue(place.addressComponents, 'postal_town'), state, country,
          website: clean(place.websiteUri) || null, phone: clean(place.nationalPhoneNumber) || null,
          category: clean(place.primaryType) || null, primary_business_type: clean(place.primaryType) || null,
          additional_business_types: Array.isArray(place.types) ? place.types.filter(type => type !== place.primaryType) : [],
          business_status: clean(place.businessStatus) || null, source_url: clean(place.googleMapsUri) || null,
          google_maps_url: clean(place.googleMapsUri) || null, search_query: textQuery, captured_at: capturedAt,
          provider: 'Google Places API (New)', provider_payload: place
        };
      });
      return {
        records, nextCheckpoint: { pageToken: payload.nextPageToken || null, resultOffset: Number(checkpoint.resultOffset || 0) + records.length, searchQuery: textQuery },
        providerRequestId: response.headers?.get?.('x-request-id') || response.headers?.get?.('x-goog-request-id') || null,
        estimatedUnits: 1, actualUnits: 1, calculatedUsageCost: money(unitPrice), hasMore: Boolean(payload.nextPageToken), warnings: []
      };
    },
    normalize(record, context) {
      if (typeof normalize !== 'function') throw errorFor('SCHEMA_ERROR', 'Shared normalization function is unavailable.', 500);
      return { ...normalize(record, context), state: record.state || null, business_status: record.business_status || null, google_maps_url: record.google_maps_url || null, search_query: record.search_query || null, additional_business_types: record.additional_business_types || [] };
    },
    buildEvidence(record, context) {
      const returned = Object.entries({ external_id: record.external_id, company_name: record.company_name, formatted_address: record.formatted_address, city: record.city, state: record.state, country: record.country, website: record.website, phone: record.phone, primary_business_type: record.primary_business_type, additional_business_types: record.additional_business_types, business_status: record.business_status, google_maps_url: record.google_maps_url }).filter(([, value]) => value !== null && value !== undefined && value !== '').map(([field]) => field);
      const expected = ['external_id','company_name','formatted_address','city','state','country','website','phone','primary_business_type','additional_business_types','business_status','google_maps_url'];
      return {
        provider: 'Google Places API (New)', connectorKey: 'google-places-new', connectorVersion: '1.0.0', externalId: record.external_id || null,
        sourceUrl: record.google_maps_url || null, searchQuery: record.search_query || null, capturedTime: record.captured_at || context.capturedAt,
        capturedTimeSource: 'server', executionId: context.executionId, providerRequestId: context.providerRequestId,
        rawPayloadId: context.rawPayloadId, rawPayloadReference: context.rawPayloadId, payloadHash: context.payloadHash, normalizationVersion: 'v1',
        fieldPaths: { external_id:'places[].id', company_name:'places[].displayName.text', formatted_address:'places[].formattedAddress', city:'places[].addressComponents[locality]', state:'places[].addressComponents[administrative_area_level_1]', country:'places[].addressComponents[country]', website:'places[].websiteUri', phone:'places[].nationalPhoneNumber', primary_business_type:'places[].primaryType', additional_business_types:'places[].types', business_status:'places[].businessStatus', google_maps_url:'places[].googleMapsUri' },
        providerReturnedFields: returned, normalizedFromProviderFields: returned, missingUnknownFields: expected.filter(field => !returned.includes(field)),
        ruleMappedFields: ['customer_type','industry'], manuallyModifiedFields: []
      };
    },
    classifyError: error => ({ code: error.code || 'UNKNOWN_PROVIDER_ERROR', retryable: Boolean(error.retryable), retryAfterMs: Number(error.retryAfterMs || 0), userMessage: clean(error.message) || 'Google Places request failed.' }),
    redactForLog: value => redact(value),
    pricing: { unitPrice, pricingVersion, fieldMask }
  };
}
