import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GOOGLE_PLACES_FIELD_MASK, createGooglePlacesConnector } from '../src/services/google-places-connector.mjs';

const env = overrides => ({
  GOOGLE_PLACES_API_KEY: 'test-key-never-sent-to-logs', GOOGLE_PLACES_CONNECTOR_ENABLED: 'true',
  GOOGLE_PLACES_API_BASE_URL: 'https://places.googleapis.com', GOOGLE_PLACES_REQUEST_TIMEOUT_MS: '30000',
  GOOGLE_PLACES_ESTIMATED_PRICE_PER_REQUEST_USD: '0.035', ...overrides
});

const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, headers: { get: name => name === 'x-request-id' ? 'request-1' : null }, json: async () => payload });
const sharedNormalize = record => ({ ...record, source_type: 'Google Places API (New)', normalization_version: 'v1', canonical_website: record.website || null, dedup_key: `external:google-places-new:${record.external_id}` });

test('Google Places Connector exposes the frozen contract and Enterprise estimate', () => {
  const connector = createGooglePlacesConnector({ env: env(), fetchImpl: async () => response({}), normalize: sharedNormalize });
  for (const property of ['key','version','displayName','enabled','approved','costType','credentialPresent','capabilities','validateConfig','estimate','executePage','normalize','buildEvidence','classifyError','redactForLog']) assert.ok(property in connector, property);
  assert.equal(connector.key, 'google-places-new');
  assert.equal(connector.pricing.fieldMask, GOOGLE_PLACES_FIELD_MASK);
  assert.ok(!connector.pricing.fieldMask.includes('*'));
  const estimate = connector.estimate({ limits: { maxPages: 3, maxResults: 45 } });
  assert.equal(estimate.estimatedRequestCount, 3);
  assert.equal(estimate.high, 0.105);
  assert.equal(estimate.pricingTier, 'Text Search Enterprise');
  assert.deepEqual(estimate.includesEnterpriseFields, ['places.websiteUri','places.nationalPhoneNumber']);
});

test('missing credential and disabled Connector fail without an HTTP request', async () => {
  let calls = 0;
  const missing = createGooglePlacesConnector({ env: env({ GOOGLE_PLACES_API_KEY: '' }), fetchImpl: async () => { calls++; }, normalize: sharedNormalize });
  assert.equal(missing.credentialPresent, false);
  await assert.rejects(() => missing.executePage({ query: {}, limits: {} }), error => error.code === 'MISSING_CREDENTIAL');
  const disabled = createGooglePlacesConnector({ env: env({ GOOGLE_PLACES_CONNECTOR_ENABLED: 'false' }), fetchImpl: async () => { calls++; }, normalize: sharedNormalize });
  await assert.rejects(() => disabled.executePage({ query: {}, limits: {} }), error => error.code === 'CONNECTOR_DISABLED');
  assert.equal(calls, 0);
});

test('Text Search maps real provider fields, missing fields, pagination, and evidence', async () => {
  const bodies = [], headers = [];
  const payloads = [
    { places: [{ id:'place-1', displayName:{text:'Real Restaurant Supply'}, formattedAddress:'1 Main St, Los Angeles, CA, USA', addressComponents:[{longText:'Los Angeles',types:['locality']},{longText:'California',shortText:'CA',types:['administrative_area_level_1']},{longText:'United States',shortText:'US',types:['country']}], primaryType:'furniture_store', types:['furniture_store','store'], googleMapsUri:'https://maps.google.com/?cid=1', websiteUri:'https://real.example', nationalPhoneNumber:'(213) 555-0100', businessStatus:'OPERATIONAL' }], nextPageToken:'page-2' },
    { places: [{ id:'place-2', displayName:{text:'Real Hospitality Interiors'}, formattedAddress:'2 Main St, Los Angeles, CA, USA', addressComponents:[], primaryType:'store', types:['store'], googleMapsUri:'https://maps.google.com/?cid=2', businessStatus:'OPERATIONAL' }] }
  ];
  const connector = createGooglePlacesConnector({ env: env(), normalize: sharedNormalize, fetchImpl: async (_url, options) => { bodies.push(JSON.parse(options.body)); headers.push(options.headers); return response(payloads.shift()); } });
  const request = { query: { keywords:['restaurant furniture supplier'], locations:['Los Angeles'], languageCode:'en', regionCode:'US' }, limits:{ maxResults:40 } };
  const first = await connector.executePage(request, {});
  assert.equal(first.records[0].external_id, 'place-1');
  assert.equal(first.records[0].city, 'Los Angeles');
  assert.equal(first.records[0].state, 'California');
  assert.equal(first.records[0].country, 'United States');
  assert.equal(first.nextCheckpoint.pageToken, 'page-2');
  assert.equal(first.calculatedUsageCost, 0.035);
  const second = await connector.executePage(request, first.nextCheckpoint);
  assert.equal(bodies[1].pageToken, 'page-2');
  assert.equal(second.records[0].website, null);
  assert.equal(second.records[0].phone, null);
  assert.equal(second.hasMore, false);
  assert.equal(headers[0]['X-Goog-Api-Key'], 'test-key-never-sent-to-logs');
  assert.equal(headers[0]['X-Goog-FieldMask'], GOOGLE_PLACES_FIELD_MASK);
  const normalized = connector.normalize(first.records[0], { connectorKey:connector.key });
  const evidence = connector.buildEvidence(first.records[0], { executionId:7, rawPayloadId:8, payloadHash:'hash', capturedAt:first.records[0].captured_at });
  assert.equal(normalized.external_id, 'place-1');
  assert.equal(evidence.provider, 'Google Places API (New)');
  assert.equal(evidence.rawPayloadReference, 8);
  assert.ok(evidence.providerReturnedFields.includes('website'));
});

test('redaction removes credentials and error classification covers provider failures', async () => {
  const connector = createGooglePlacesConnector({ env: env(), fetchImpl: async () => response({}), normalize: sharedNormalize });
  const redacted = connector.redactForLog({ company:'safe', apiKey:'secret', Authorization:'Bearer secret', nested:{ secret:'no', pageToken:'keep' } });
  assert.deepEqual(redacted, { company:'safe', nested:{ pageToken:'keep' } });
  for (const [input, code, retryable] of [
    [{code:'TIMEOUT',retryable:true},'TIMEOUT',true], [{code:'RATE_LIMIT',retryable:true},'RATE_LIMIT',true],
    [{code:'INVALID_API_KEY'},'INVALID_API_KEY',false], [{code:'BUDGET_LIMIT_REACHED'},'BUDGET_LIMIT_REACHED',false]
  ]) {
    const classified = connector.classifyError(input);
    assert.equal(classified.code, code);
    assert.equal(classified.retryable, retryable);
  }
});

test('provider error categories are safe and never expose the API key', async () => {
  const key = 'AIza123456789012345678901234567890';
  const connector = createGooglePlacesConnector({ env: env({ GOOGLE_PLACES_API_KEY:key }), normalize: sharedNormalize, fetchImpl: async () => response({ error:{ status:'PERMISSION_DENIED', message:`API ${key} billing is disabled` } }, 403) });
  await assert.rejects(() => connector.executePage({ query:{keywords:['restaurant']}, limits:{maxResults:20} }), error => error.code === 'BILLING_NOT_ENABLED' && !error.message.includes(key));
});

test('Search Execution enforces budget before every attempt and persists calculated usage cost', () => {
  const source = readFileSync(resolve(import.meta.dirname, '../src/services/search-execution.mjs'), 'utf8');
  assert.match(source, /beforeRequest\.actual_cost_usd/);
  assert.match(source, /BUDGET_LIMIT_REACHED/);
  assert.match(source, /actual_cost_usd=actual_cost_usd\+\?/);
  assert.match(source, /calculatedUsageCost/);
  assert.match(source, /provider_request_count=provider_request_count\+\?/);
  for (const dedupe of ['Hard Duplicate','canonical_website','LOWER(email)','REPLACE(REPLACE(REPLACE(phone']) assert.ok(source.includes(dedupe), dedupe);
});
