import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createGeoapifyPlacesConnector, GEOAPIFY_CATEGORY_MAP } from '../src/services/geoapify-places-connector.mjs';

const env = overrides => ({ GEOAPIFY_API_KEY:'geo-test-secret', GEOAPIFY_CONNECTOR_ENABLED:'true', GEOAPIFY_API_BASE_URL:'https://api.geoapify.com', GEOAPIFY_REQUEST_TIMEOUT_MS:'30000', GEOAPIFY_CREDIT_VALUE_USD:'0', ...overrides });
const response = (payload,status=200) => ({ ok:status>=200&&status<300,status,headers:{get:name=>name==='x-request-id'?'geo-request':null},json:async()=>payload });
const normalize = record => ({...record,source_type:'Geoapify Places',normalization_version:'v1',canonical_website:record.website||null,dedup_key:`external:geoapify-places:${record.external_id}`});
const request = { query:{ categories:['Furniture and Interior'], locations:['Los Angeles, California, United States'], languageCode:'en' }, limits:{maxPages:1,maxResults:20} };

test('Geoapify Connector implements the shared contract and credit estimate', () => {
  const connector=createGeoapifyPlacesConnector({env:env(),fetchImpl:async()=>response({}),normalize});
  for(const key of ['key','version','displayName','enabled','approved','costType','credentialPresent','capabilities','validateConfig','estimate','executePage','normalize','buildEvidence','classifyError','redactForLog'])assert.ok(key in connector,key);
  assert.equal(connector.key,'geoapify-places');
  assert.equal(GEOAPIFY_CATEGORY_MAP['furniture and interior'],'commercial.furniture_and_interior');
  const estimate=connector.estimate(request);
  assert.equal(estimate.category,'commercial.furniture_and_interior');
  assert.equal(estimate.estimatedCreditCount,2);
  assert.equal(estimate.estimatedRequestCount,2);
  assert.equal(estimate.high,0);
});

test('missing key and disabled Geoapify Connector stop before network access', async()=>{
  let calls=0;
  const missing=createGeoapifyPlacesConnector({env:env({GEOAPIFY_API_KEY:''}),fetchImpl:async()=>{calls++;},normalize});
  await assert.rejects(()=>missing.executePage(request),error=>error.code==='MISSING_CREDENTIAL');
  const disabled=createGeoapifyPlacesConnector({env:env({GEOAPIFY_CONNECTOR_ENABLED:'false'}),fetchImpl:async()=>{calls++;},normalize});
  await assert.rejects(()=>disabled.executePage(request),error=>error.code==='CONNECTOR_DISABLED');
  assert.equal(calls,0);
});

test('Forward Geocoding builds a place filter and Places maps GeoJSON without inventing fields',async()=>{
  const urls=[];
  const payloads=[
    {features:[{properties:{place_id:'la-place',lat:34.05,lon:-118.24,city:'Los Angeles',state:'California',country:'United States',formatted:'Los Angeles, CA, USA'},geometry:{coordinates:[-118.24,34.05]}}]},
    {features:[{properties:{place_id:'business-1',name:'Real Furniture Company',categories:['commercial.furniture_and_interior','commercial'],formatted:'100 Main St, Los Angeles, CA 90001, USA',address_line1:'100 Main St',address_line2:'Los Angeles, CA 90001, USA',city:'Los Angeles',county:'Los Angeles County',state:'California',postcode:'90001',country:'United States',country_code:'us',lat:34.06,lon:-118.25,website:'https://real-furniture.example',contact:{phone:'+1 213 555 0100'},datasource:{sourcename:'openstreetmap',attribution:'© OpenStreetMap contributors'}},geometry:{type:'Point',coordinates:[-118.25,34.06]}}],attribution:'Geoapify'}
  ];
  const connector=createGeoapifyPlacesConnector({env:env(),normalize,fetchImpl:async url=>{urls.push(String(url));return response(payloads.shift());}});
  const page=await connector.executePage(request,{});
  assert.match(urls[0],/\/v1\/geocode\/search/);
  assert.match(urls[1],/categories=commercial\.furniture_and_interior/);
  assert.match(urls[1],/filter=place%3Ala-place/);
  assert.match(urls[1],/limit=20/);
  assert.match(urls[1],/offset=0/);
  assert.equal(page.providerRequestCount,2);
  assert.equal(page.actualCredits,2);
  assert.equal(page.calculatedUsageCost,0);
  assert.equal(page.records[0].external_id,'business-1');
  assert.equal(page.records[0].company_name,'Real Furniture Company');
  assert.equal(page.records[0].email,null);
  assert.equal(page.nextCheckpoint.locationResolution.placeId,'la-place');
  const evidence=connector.buildEvidence(page.records[0],{executionId:1,rawPayloadId:2,payloadHash:'hash',capturedAt:page.records[0].captured_at});
  assert.equal(evidence.locationFilter,'place:la-place');
  assert.equal(evidence.geoapifyCategory,'commercial.furniture_and_interior');
  assert.equal(evidence.datasource.sourcename,'openstreetmap');
  assert.ok(evidence.providerReturnedFields.includes('latitude'));
});

test('offset pagination reuses resolved location and does not geocode twice',async()=>{
  const calls=[];
  const connector=createGeoapifyPlacesConnector({env:env(),normalize,fetchImpl:async url=>{calls.push(String(url));return response({features:[]});}});
  const checkpoint={offset:20,locationResolution:{placeId:'la-place',latitude:34.05,longitude:-118.24,formatted:'Los Angeles'},category:'commercial.furniture_and_interior',searchLocation:'Los Angeles'};
  const page=await connector.executePage({...request,limits:{maxPages:2,maxResults:40}},checkpoint);
  assert.equal(calls.length,1);
  assert.match(calls[0],/offset=20/);
  assert.equal(page.providerRequestCount,1);
  assert.equal(page.actualCredits,1);
});

test('geocoding failure is explicit and Places partial failure preserves resolution checkpoint',async()=>{
  const none=createGeoapifyPlacesConnector({env:env(),normalize,fetchImpl:async()=>response({features:[]})});
  await assert.rejects(()=>none.executePage(request),error=>error.code==='LOCATION_NOT_FOUND'&&error.actualCredits===1);
  let call=0;
  const partial=createGeoapifyPlacesConnector({env:env(),normalize,fetchImpl:async()=>++call===1?response({features:[{properties:{place_id:'la-place',lat:34,lon:-118,formatted:'Los Angeles'},geometry:{coordinates:[-118,34]}}]}):response({message:'temporary'},500)});
  await assert.rejects(()=>partial.executePage(request),error=>error.code==='TEMPORARY_SERVER_ERROR'&&error.checkpoint?.locationResolution?.placeId==='la-place'&&error.providerRequestCount===2&&error.actualCredits===2);
});

test('API key redaction, raw payload safety, timeout, invalid key and rate-limit classification',async()=>{
  const connector=createGeoapifyPlacesConnector({env:env(),normalize,fetchImpl:async()=>response({}),});
  const redacted=connector.redactForLog({url:'https://api.geoapify.com/v2/places?apiKey=secret&limit=20',apiKey:'secret',payload:{name:'safe'}});
  assert.equal(redacted.url,'https://api.geoapify.com/v2/places?apiKey=[REDACTED]&limit=20');
  assert.equal(redacted.apiKey,undefined);
  assert.deepEqual(redacted.payload,{name:'safe'});
  for(const [error,code,retryable] of [[{code:'TIMEOUT',retryable:true},'TIMEOUT',true],[{code:'INVALID_API_KEY'},'INVALID_API_KEY',false],[{code:'RATE_LIMIT',retryable:true},'RATE_LIMIT',true]]){const result=connector.classifyError(error);assert.equal(result.code,code);assert.equal(result.retryable,retryable);}
  const invalid=createGeoapifyPlacesConnector({env:env(),normalize,fetchImpl:async()=>response({message:'invalid api key'},401)});
  await assert.rejects(()=>invalid.executePage(request),error=>error.code==='INVALID_API_KEY'&&!error.message.includes('geo-test-secret'));
  const rate=createGeoapifyPlacesConnector({env:env(),normalize,fetchImpl:async()=>response({message:'limit'},429)});
  await assert.rejects(()=>rate.executePage(request),error=>error.code==='RATE_LIMIT');
});

test('shared persistence retains place-id, website and phone duplicate checks and credit counters',()=>{
  const source=readFileSync(resolve(import.meta.dirname,'../src/services/search-execution.mjs'),'utf8');
  for(const text of ['Hard Duplicate','canonical_website','REPLACE(REPLACE(REPLACE(phone','actualCreditCount','freePlanCreditUsage','providerRequestCount'])assert.ok(source.includes(text),text);
});
