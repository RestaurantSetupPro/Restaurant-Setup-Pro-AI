import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocationProviderRegistry, normalizeLocation } from '../src/services/location-provider.mjs';
import { createGeoapifyLocationProvider } from '../src/services/geoapify-location-provider.mjs';

const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });

test('Location Provider registry returns one provider-independent location shape', async () => {
  const provider = createGeoapifyLocationProvider({
    env: { GEOAPIFY_API_KEY: 'test-key' },
    fetchImpl: async url => {
      assert.equal(url.pathname, '/v1/geocode/autocomplete');
      assert.equal(url.searchParams.get('type'), 'locality');
      return response({ results: [{ place_id: 'la-id', formatted: 'Los Angeles, California, United States', country: 'United States', country_code: 'us', state: 'California', city: 'Los Angeles', lat: 34.0536909, lon: -118.242766, bbox: { lon1: -118.7, lat1: 33.7, lon2: -118.1, lat2: 34.3 } }] });
    }
  });
  const registry = createLocationProviderRegistry({ providers: [provider], defaultProviderKey: 'geoapify' });
  assert.deepEqual(registry.list(), [{ key: 'geoapify', displayName: 'Geoapify', enabled: true, credentialPresent: true }]);
  assert.deepEqual(await registry.search({ text: 'Los Angeles' }), [{ formatted_location: 'Los Angeles, California, United States', country: 'United States', country_code: 'us', state: 'California', city: 'Los Angeles', latitude: 34.0536909, longitude: -118.242766, bounds: { lon1: -118.7, lat1: 33.7, lon2: -118.1, lat2: 34.3 }, location_provider: 'geoapify', provider_location_id: 'la-id' }]);
});

test('Location selection validation is provider-independent', () => {
  assert.throws(() => normalizeLocation({ formatted_location: 'Los Angeles' }), error => error.code === 'INVALID_LOCATION_SELECTION');
  const googleFuture = normalizeLocation({ formatted_location: 'Los Angeles, CA, USA', country: 'United States', country_code: 'US', state: 'California', city: 'Los Angeles', latitude: 34.05, longitude: -118.24, bounds: null, location_provider: 'google', provider_location_id: 'google-future-id' });
  assert.equal(googleFuture.location_provider, 'google');
  assert.equal(googleFuture.provider_location_id, 'google-future-id');
});

test('Geoapify adapter returns safe generic errors', async () => {
  const provider = createGeoapifyLocationProvider({ env: { GEOAPIFY_API_KEY: 'secret-key' }, fetchImpl: async () => response({ message: 'bad key' }, 401) });
  await assert.rejects(() => provider.search({ text: 'Los Angeles' }), error => error.code === 'LOCATION_PROVIDER_UNAUTHORIZED' && !error.message.includes('secret-key'));
});
