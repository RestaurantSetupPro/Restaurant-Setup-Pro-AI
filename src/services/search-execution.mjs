import { createHash, randomUUID } from 'node:crypto';

const ACTIVE = ['Awaiting Approval', 'Approved', 'Running', 'Paused', 'Interrupted'];
const ADMIN = new Set(['Admin', 'Owner']);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const json = (value, fallback = {}) => { if (value && typeof value === 'object') return value; try { return JSON.parse(value || ''); } catch { return fallback; } };
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const clean = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const secretPattern = /authorization|api[-_ ]?key|token|cookie|secret/i;

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !secretPattern.test(key)).map(([key, item]) => [key, redact(item)]));
}

function canonicalWebsite(value) {
  const text = clean(value);
  if (!text) return { website: null, canonical: null, domain: null };
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
    const domain = url.hostname.replace(/^www\./, '');
    return { website: url.toString().replace(/\/$/, ''), canonical: `${domain}${url.pathname}`.toLowerCase(), domain };
  } catch { return { website: null, canonical: null, domain: null }; }
}

function normalizeRecord(record, context) {
  const companyName = clean(record.company_name);
  if (!companyName) throw Object.assign(new Error('Company name is required.'), { code: 'SCHEMA_ERROR', retryable: false });
  const web = canonicalWebsite(record.website);
  const email = clean(record.email).toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  const phone = clean(record.phone) || null;
  const country = clean(record.country) || null;
  const city = clean(record.city) || null;
  const externalId = clean(record.external_id) || null;
  const nameKey = companyName.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const dedupKey = externalId
    ? `external:${context.connectorKey}:${externalId}`
    : web.domain ? `domain:${web.domain}` : validEmail ? `email:${validEmail}` : phone ? `phone:${phone.replace(/\D/g, '')}` : `company:${nameKey}|${(country || '').toLowerCase()}|${(city || '').toLowerCase()}`;
  return {
    company_name: companyName, customer_type: clean(record.customer_type) || context.task.customer_type || null,
    industry: clean(record.industry) || context.task.industry || 'Hospitality Furniture', country, city,
    website: web.website, canonical_website: web.canonical, address: clean(record.address) || null,
    email: validEmail, phone, contact_person: clean(record.contact_person) || null,
    business_type: clean(record.business_type) || null, source_category: clean(record.category) || null,
    external_id: externalId, source_url: clean(record.source_url) || web.website,
    captured_at: clean(record.captured_at) || new Date().toISOString(), dedup_key: dedupKey,
    source_type: context.connector.displayName, normalization_version: 'v1'
  };
}

const fixtures = [
  { external_id: 'mock-001', company_name: 'Pacific Restaurant Furniture', website: 'pacific-restaurant.example', country: 'United States', city: 'Los Angeles', address: '100 Market Street', category: 'Restaurant Furniture Dealer', email: 'sales@pacific-restaurant.example', phone: '+1 213 555 0101' },
  { external_id: 'mock-002', company_name: 'Hospitality Seating Supply', website: 'https://hospitality-seating.example/', country: 'United States', city: 'Dallas', address: '22 Commerce Way', category: 'Hospitality Furniture Distributor', email: 'hello@hospitality-seating.example' },
  { external_id: 'mock-002', company_name: 'Hospitality Seating Supply Duplicate', website: 'hospitality-seating.example', country: 'United States', city: 'Dallas', category: 'Distributor' },
  { external_id: 'mock-003', company_name: 'Metro Dining Interiors', website: 'https://metro-dining.example/catalog#chairs', country: 'United States', city: 'Chicago', address: '8 West Loop', category: 'Commercial Furniture Importer', phone: '+1 312 555 0103' },
  { external_id: 'mock-004', company_name: 'Coastal Booth Works', website: 'coastal-booth.example', country: 'United States', city: 'Miami', category: 'Booth Seating Supplier', email: 'info@coastal-booth.example' },
  { external_id: 'mock-005', company_name: 'Northwest Table Base Co', website: 'northwest-base.example', country: 'United States', city: 'Seattle', category: 'Restaurant Furniture Supplier' }
];

export function createRulesMockConnector() {
  return {
    key: 'rules-mock', version: '1.0.0', displayName: 'Rules/Mock', enabled: true, approved: true, costType: 'zero-cost', credentialPresent: false,
    capabilities: () => ({ pagination: true, checkpoint: true, retry: true, partialSuccess: true, stableExternalId: true }),
    validateConfig: context => Boolean(context?.task && context?.strategy),
    estimate: request => ({ currency: 'USD', low: 0, expected: 0, high: 0, pricingVersion: 'rules-mock-zero-v1', queryCount: request.query.keywords.length, maxPages: request.limits.maxPages, maxResults: request.limits.maxResults, estimatedAt: new Date().toISOString() }),
    async executePage(request, checkpoint = {}, runtime = {}) {
      await sleep(5);
      checkpoint ||= {};
      const page = Number(checkpoint.page || 0) + 1;
      const scenario = String(runtime.scenario || 'success');
      if (scenario === 'invalid') throw Object.assign(new Error('Mock invalid request.'), { code: 'INVALID_REQUEST', retryable: false });
      if (scenario === 'auth') throw Object.assign(new Error('Mock authentication error.'), { code: 'AUTHENTICATION', retryable: false });
      if (['timeout', '429', '500'].includes(scenario) && Number(runtime.attempt || 0) < 1) throw Object.assign(new Error(`Mock ${scenario} failure.`), { code: scenario.toUpperCase(), retryable: true, retryAfterMs: scenario === '429' ? 5 : 0 });
      if (scenario === 'partial' && page === 2) throw Object.assign(new Error('Mock partial page failure.'), { code: '500', retryable: true });
      const size = 2, start = (page - 1) * size;
      const records = scenario === 'empty' ? [] : fixtures.slice(start, start + size).map((item, index) => ({ ...item, source_url: `https://mock.local/companies/${item.external_id}`, captured_at: '2026-07-12T12:00:00.000Z', record_index: start + index }));
      return { records, nextCheckpoint: { page }, providerRequestId: `rules-mock-page-${page}`, estimatedUnits: 0, actualUnits: 0, hasMore: start + size < fixtures.length, warnings: [] };
    },
    normalize: normalizeRecord,
    buildEvidence: (record, context) => ({ connectorKey: 'rules-mock', connectorVersion: '1.0.0', externalId: String(record.external_id || ''), sourceUrl: record.source_url || null, capturedTime: record.captured_at || context.capturedAt, capturedTimeSource: record.captured_at ? 'provider' : 'server', executionId: context.executionId, providerRequestId: context.providerRequestId, rawPayloadId: context.rawPayloadId, payloadHash: context.payloadHash, normalizationVersion: 'v1', fieldPaths: { company_name: 'company_name', website: 'website', country: 'country', city: 'city', address: 'address', category: 'category' }, originalFields: ['company_name','website','country','city','address','category','email','phone'], normalizedFields: ['company_name','website','email','phone','country','city'], ruleMappedFields: ['customer_type','industry'], manuallyModifiedFields: [] }),
    classifyError: error => ({ code: error.code || 'CONNECTOR_ERROR', retryable: Boolean(error.retryable), retryAfterMs: Number(error.retryAfterMs || 0) }),
    redactForLog: redact
  };
}

export function createSearchConnectorRegistry() {
  const connectors = new Map([['rules-mock', createRulesMockConnector()]]);
  return {
    get(key) { const connector = connectors.get(String(key)); return connector?.enabled && connector?.approved ? connector : null; },
    list() { return [...connectors.values()].map(({ key, version, displayName, enabled, approved, costType, credentialPresent, capabilities }) => ({ key, version, displayName, enabled, approved, costType, credentialPresent: Boolean(credentialPresent), capabilities: capabilities() })); }
  };
}

export function createSearchExecutionService({ db, audit }) {
  const registry = createSearchConnectorRegistry();
  const admin = user => ADMIN.has(user?.role);
  const readExecution = id => {
    const row = db.prepare('SELECT * FROM search_executions WHERE id=?').get(id);
    if (!row) return null;
    return { ...row, request_snapshot_json: json(row.request_snapshot_json), limits_json: json(row.limits_json), estimate_json: json(row.estimate_json), checkpoint_json: json(row.checkpoint_json) };
  };
  const gate = (condition, message, status = 409) => { if (!condition) throw Object.assign(new Error(message), { status }); };
  function contextForTask(taskId) {
    const task = db.prepare('SELECT * FROM search_tasks WHERE id=?').get(taskId);
    gate(task, 'Search Task not found.', 404);
    const strategy = db.prepare("SELECT * FROM search_strategies WHERE linked_search_task_id=? AND status='Approved'").get(taskId);
    gate(strategy, 'A currently Approved Search Strategy is required.');
    return { task, strategy };
  }
  function requestFor(task, strategy, connector, body = {}, executionId = 0, idempotencyKey = '') {
    const keywords = json(task.keywords, []), filters = json(task.filters, []), data = json(strategy.strategy_data_json, {});
    const hardMax = 100, target = Math.max(1, Number(task.target_quantity || 1));
    const limits = { maxPages: Math.min(3, Math.max(1, Number(body.limits?.maxPages || 3))), maxResults: Math.min(hardMax, target, Math.max(1, Number(body.limits?.maxResults || target))), maxCostUsd: 0, maxDurationSeconds: Math.min(120, Math.max(1, Number(body.limits?.maxDurationSeconds || 120))), maxRetriesPerPage: Math.min(2, Math.max(0, Number(body.limits?.maxRetriesPerPage ?? 2))), requestTimeoutSeconds: 30 };
    return { executionId, searchTaskId: task.id, approvedStrategyId: strategy.id, connectorKey: connector.key, query: { keywords, locations: data.targetMarket?.cities?.length ? data.targetMarket.cities : String(task.location || '').split(',').map(clean).filter(Boolean), categories: data.productCategories || [task.customer_type].filter(Boolean), filters }, limits, checkpoint: null, idempotencyKey };
  }
  function estimate(taskId, body, user) {
    gate(user && ['Admin','Owner','Sales'].includes(user.role), 'Execution estimate is not allowed for this role.', 403);
    const { task, strategy } = contextForTask(taskId); gate(task.status === 'Ready', 'Search Task must be Ready before estimation.');
    const connector = registry.get(body.connectorKey || 'rules-mock'); gate(connector, 'Connector is disabled, missing, or not approved.');
    const request = requestFor(task, strategy, connector, body); gate(connector.validateConfig({ task, strategy }), 'Connector configuration is invalid.');
    return { connector: { key: connector.key, version: connector.version }, request, estimate: connector.estimate(request, { task, strategy }), approvedCostLimitUsd: 0 };
  }
  function create(taskId, body, user) {
    gate(user && ['Admin','Owner','Sales'].includes(user.role), 'Execution estimate is not allowed for this role.', 403);
    const proposal = estimate(taskId, body, user), { task, strategy } = contextForTask(taskId), connector = registry.get(proposal.connector.key);
    const idempotencyKey = clean(body.idempotencyKey) || randomUUID();
    const request = requestFor(task, strategy, connector, body, 0, idempotencyKey);
    const existing = db.prepare('SELECT id FROM search_executions WHERE idempotency_key=?').get(idempotencyKey);
    if (existing) return readExecution(existing.id);
    gate(!db.prepare(`SELECT id FROM search_executions WHERE search_task_id=? AND status IN (${ACTIVE.map(()=>'?').join(',')})`).get(taskId, ...ACTIVE), 'This Search Task already has an active execution.');
    const row = db.prepare(`INSERT INTO search_executions(idempotency_key,search_task_id,search_strategy_id,connector_key,connector_version,status,phase,request_snapshot_json,limits_json,estimate_json,estimated_cost_usd,approved_cost_limit_usd,approval_status,created_by)
      VALUES(?,?,?,?,?,'Awaiting Approval','Estimating',?,?,?,?,0,'Pending',?) RETURNING id`).get(idempotencyKey,taskId,strategy.id,connector.key,connector.version,JSON.stringify(request),JSON.stringify(request.limits),JSON.stringify(proposal.estimate),0,user.id);
    db.prepare('UPDATE search_executions SET request_snapshot_json=? WHERE id=?').run(JSON.stringify({ ...request, executionId: row.id }),row.id);
    audit(user.id,'estimate_search_execution','search_executions',String(row.id),{taskId,connectorKey:connector.key,estimatedCost:0});
    return readExecution(row.id);
  }
  function approve(id, user) {
    gate(admin(user), 'Only Admin or Owner can approve execution.', 403); const execution=readExecution(id); gate(execution,'Search Execution not found.',404);
    gate(execution.status==='Awaiting Approval','Only an execution awaiting approval can be approved.'); contextForTask(execution.search_task_id);
    db.prepare("UPDATE search_executions SET status='Approved',phase=NULL,approval_status='Approved',approved_by=?,approved_at=CURRENT_TIMESTAMP,approved_cost_limit_usd=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(user.id,id);
    audit(user.id,'approve_search_execution','search_executions',String(id),{approvedCostLimitUsd:0}); return readExecution(id);
  }
  function rawPayload(execution, connector, result, record, index) {
    const payload = connector.redactForLog(record), payloadJson=JSON.stringify(payload), payloadHash=hash(payloadJson), captured=clean(record.captured_at)||new Date().toISOString();
    const existing=db.prepare('SELECT * FROM search_result_raw_payloads WHERE search_execution_id=? AND payload_hash=?').get(execution.id,payloadHash);
    if(existing)return existing;
    return db.prepare(`INSERT INTO search_result_raw_payloads(search_execution_id,connector_key,connector_version,provider_request_id,external_id,record_index,payload_json,payload_hash,captured_at) VALUES(?,?,?,?,?,?,?,?,?) RETURNING *`).get(execution.id,connector.key,connector.version,result.providerRequestId,clean(record.external_id)||null,index,payloadJson,payloadHash,captured);
  }
  function persistRecord(execution, connector, pageResult, record, index, user) {
    const raw=rawPayload(execution,connector,pageResult,record,index), normalized=connector.normalize(record,{task:db.prepare('SELECT * FROM search_tasks WHERE id=?').get(execution.search_task_id),connectorKey:connector.key,connector}), evidence=connector.buildEvidence(record,{executionId:execution.id,providerRequestId:pageResult.providerRequestId,rawPayloadId:raw.id,payloadHash:raw.payload_hash,capturedAt:raw.captured_at});
    const hard=normalized.external_id?db.prepare('SELECT id FROM search_results WHERE search_task_id=? AND connector_key=? AND external_id=?').get(execution.search_task_id,connector.key,normalized.external_id):null;
    if(hard){audit(user.id,'search_execution_duplicate_detected','search_results',String(hard.id),{executionId:execution.id,type:'Hard Duplicate'});return {duplicate:true,hard:true};}
    const domain=normalized.canonical_website?.split('/')[0];
    let duplicate=domain?db.prepare("SELECT id FROM search_results WHERE search_task_id=? AND canonical_website IS NOT NULL AND (canonical_website=? OR canonical_website LIKE ?) ORDER BY id LIMIT 1").get(execution.search_task_id,normalized.canonical_website,`${domain}/%`):null;
    if(!duplicate&&normalized.email)duplicate=db.prepare('SELECT id FROM search_results WHERE search_task_id=? AND LOWER(email)=LOWER(?) ORDER BY id LIMIT 1').get(execution.search_task_id,normalized.email);
    if(!duplicate&&normalized.phone)duplicate=db.prepare("SELECT id FROM search_results WHERE search_task_id=? AND REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'(','')=REPLACE(REPLACE(REPLACE(?,' ',''),'-',''),'(','') ORDER BY id LIMIT 1").get(execution.search_task_id,normalized.phone);
    const safeDedup=duplicate?`${normalized.dedup_key}|review:${execution.id}:${raw.id}`:normalized.dedup_key;
    const sourceReference=JSON.stringify({source_url:normalized.source_url,reference_note:'Captured by approved Rules/Mock Connector.'});
    const row=db.prepare(`INSERT INTO search_results(search_task_id,search_execution_id,company_name,customer_type,industry,country,city,website,email,phone,business_type,source_type,source_reference,status,created_by,connector_key,connector_version,external_id,canonical_website,address,source_category,captured_at,raw_payload_id,normalization_version,dedup_key,duplicate_of_search_result_id,evidence_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'new',?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`).get(execution.search_task_id,execution.id,normalized.company_name,normalized.customer_type,normalized.industry,normalized.country,normalized.city,normalized.website,normalized.email,normalized.phone,normalized.business_type,normalized.source_type,sourceReference,user.id,connector.key,connector.version,normalized.external_id,normalized.canonical_website,normalized.address,normalized.source_category,normalized.captured_at,raw.id,normalized.normalization_version,safeDedup,duplicate?.id||null,JSON.stringify(evidence));
    if(duplicate)audit(user.id,'search_execution_duplicate_detected','search_results',String(row.id),{executionId:execution.id,type:'Review Candidate',duplicateOf:duplicate.id});
    return {inserted:true,duplicate:Boolean(duplicate),id:row.id};
  }
  async function run(id,user,{resume=false,scenario='success'}={}) {
    gate(admin(user),'Only Admin or Owner can run execution.',403); let execution=readExecution(id); gate(execution,'Search Execution not found.',404);
    gate(resume?['Paused','Interrupted'].includes(execution.status):execution.status==='Approved',resume?'Only Paused or Interrupted executions can resume.':'Only Approved executions can start.');
    contextForTask(execution.search_task_id); const connector=registry.get(execution.connector_key); gate(connector,'Connector is disabled, missing, or not approved.');
    db.prepare("UPDATE search_executions SET status='Running',phase='Fetching',started_at=COALESCE(started_at,CURRENT_TIMESTAMP),heartbeat_at=CURRENT_TIMESTAMP,stop_requested_at=NULL,stop_reason=NULL,last_error_code=NULL,last_error_message=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
    db.prepare("UPDATE search_tasks SET status='Running',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(execution.search_task_id); audit(user.id,resume?'resume_search_execution':'start_search_execution','search_executions',String(id));
    const started=Date.now(), request=execution.request_snapshot_json, limits=execution.limits_json; let checkpoint=execution.checkpoint_json||{}, terminal=null;
    while(!terminal){
      execution=readExecution(id); if(execution.stop_requested_at){terminal={status:execution.status==='Paused'?'Paused':'Cancelled',reason:execution.status==='Paused'?'Manual Pause':'Manual Stop'};break;}
      if(execution.page_count>=limits.maxPages){terminal={status:'Completed',reason:'Page Limit'};break;}
      if(execution.inserted_count>=limits.maxResults){terminal={status:'Completed',reason:'Result Limit'};break;}
      if(Date.now()-started>limits.maxDurationSeconds*1000){terminal={status:execution.inserted_count?'Partially Completed':'Failed',reason:'Duration Limit'};break;}
      let pageResult,errorInfo=null;
      for(let attempt=0;attempt<=limits.maxRetriesPerPage;attempt++){
        try{pageResult=await connector.executePage(request,checkpoint,{scenario,attempt});break;}catch(error){errorInfo=connector.classifyError(error);db.prepare('UPDATE search_executions SET provider_request_count=provider_request_count+1,last_error_code=?,last_error_message=?,heartbeat_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(errorInfo.code,String(error.message).slice(0,1000),id);audit(user.id,'search_execution_page_failure','search_executions',String(id),{code:errorInfo.code,attempt});if(!errorInfo.retryable||attempt>=limits.maxRetriesPerPage)break;db.prepare('UPDATE search_executions SET retry_count=retry_count+1 WHERE id=?').run(id);audit(user.id,'retry_search_execution_page','search_executions',String(id),{code:errorInfo.code,attempt:attempt+1});await sleep(Math.min(25,errorInfo.retryAfterMs||2**attempt*5));}
      }
      if(!pageResult){execution=readExecution(id);terminal={status:execution.inserted_count?'Partially Completed':'Failed',reason:errorInfo?.retryable?'Retry Exhausted':errorInfo?.code||'Provider Failure'};break;}
      db.exec('BEGIN');try{let inserted=0,duplicates=0,failed=0,normalized=0;for(let index=0;index<pageResult.records.length&&readExecution(id).inserted_count+inserted<limits.maxResults;index++){try{const outcome=persistRecord(readExecution(id),connector,pageResult,pageResult.records[index],index,user);normalized++;if(outcome.inserted)inserted++;if(outcome.duplicate)duplicates++;}catch(error){failed++;audit(user.id,'search_execution_normalization_rejected','search_executions',String(id),{recordIndex:index,error:String(error.message).slice(0,300)});}}checkpoint=pageResult.nextCheckpoint||{};db.prepare(`UPDATE search_executions SET phase='Fetching',checkpoint_json=?,provider_request_count=provider_request_count+1,page_count=page_count+1,received_count=received_count+?,normalized_count=normalized_count+?,inserted_count=inserted_count+?,duplicate_count=duplicate_count+?,failed_count=failed_count+?,heartbeat_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(JSON.stringify(checkpoint),pageResult.records.length,normalized,inserted,duplicates,failed,id);db.exec('COMMIT');audit(user.id,'search_execution_page_success','search_executions',String(id),{providerRequestId:pageResult.providerRequestId,received:pageResult.records.length,inserted,duplicates,failed});}catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
      if(!pageResult.hasMore){terminal={status:'Completed',reason:'Provider Complete'};break;}
    }
    execution=readExecution(id);const finalStatus=terminal.status,taskStatus=finalStatus==='Completed'?'Completed':'Paused';db.prepare("UPDATE search_executions SET status=?,phase='Finalizing',stop_reason=?,actual_cost_usd=0,completed_at=CASE WHEN ? IN ('Completed','Partially Completed','Failed','Cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END,heartbeat_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(finalStatus,terminal.reason,finalStatus,id);db.prepare('UPDATE search_tasks SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(taskStatus,execution.search_task_id);const event=finalStatus==='Completed'?'complete_search_execution':finalStatus==='Partially Completed'?'partial_complete_search_execution':finalStatus==='Paused'?'pause_search_execution':'fail_search_execution';audit(user.id,event,'search_executions',String(id),{stopReason:terminal.reason});return readExecution(id);
  }
  function pause(id,user){gate(admin(user),'Only Admin or Owner can pause execution.',403);const execution=readExecution(id);gate(execution,'Search Execution not found.',404);gate(execution.status==='Running','Only Running execution can pause.');db.prepare("UPDATE search_executions SET status='Paused',stop_requested_at=CURRENT_TIMESTAMP,stop_reason='Manual Pause',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);db.prepare("UPDATE search_tasks SET status='Paused',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(execution.search_task_id);audit(user.id,'pause_search_execution','search_executions',String(id));return readExecution(id);}
  function stop(id,user){gate(admin(user),'Only Admin or Owner can stop execution.',403);const execution=readExecution(id);gate(execution,'Search Execution not found.',404);gate(['Running','Paused','Interrupted','Approved'].includes(execution.status),'Execution cannot be stopped in its current state.');db.prepare("UPDATE search_executions SET status='Cancelled',stop_requested_at=CURRENT_TIMESTAMP,stop_reason='Manual Stop',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);db.prepare("UPDATE search_tasks SET status='Paused',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(execution.search_task_id);audit(user.id,'stop_search_execution','search_executions',String(id));return readExecution(id);}
  function recoverInterrupted(){const rows=db.prepare("SELECT id,search_task_id FROM search_executions WHERE status='Running'").all();for(const row of rows){db.prepare("UPDATE search_executions SET status='Interrupted',stop_reason='Server Restart',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);db.prepare("UPDATE search_tasks SET status='Paused',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.search_task_id);audit(null,'interrupt_search_execution','search_executions',String(row.id),{reason:'Server Restart'});}return rows.length;}
  function listForTask(taskId){return db.prepare('SELECT * FROM search_executions WHERE search_task_id=? ORDER BY created_at DESC,id DESC').all(taskId).map(row=>readExecution(row.id));}
  function results(id){return db.prepare('SELECT * FROM search_results WHERE search_execution_id=? ORDER BY id').all(id).map(row=>({...row,evidence_json:json(row.evidence_json)}));}
  function debug(){const statuses=Object.fromEntries(db.prepare('SELECT status,COUNT(*) count FROM search_executions GROUP BY status').all().map(row=>[row.status,Number(row.count)]));const totals=db.prepare('SELECT COALESCE(SUM(page_count),0) pages,COALESCE(SUM(provider_request_count),0) requests,COALESCE(SUM(inserted_count),0) results,COALESCE(SUM(duplicate_count),0) duplicates,COALESCE(SUM(failed_count),0) errors,COALESCE(SUM(estimated_cost_usd),0) estimated_cost,COALESCE(SUM(actual_cost_usd),0) actual_cost FROM search_executions').get();const staleBefore=Date.now()-300000,staleRunning=db.prepare("SELECT heartbeat_at FROM search_executions WHERE status='Running'").all().filter(row=>!row.heartbeat_at||new Date(row.heartbeat_at).getTime()<staleBefore).length;return {connectors:registry.list(),statuses,totals,staleRunning,interrupted:Number(statuses.Interrupted||0),partial:Number(statuses['Partially Completed']||0),rawPayloadOrphans:Number(db.prepare('SELECT COUNT(*) count FROM search_result_raw_payloads r LEFT JOIN search_executions e ON e.id=r.search_execution_id WHERE e.id IS NULL').get().count),resultsMissingEvidence:Number(db.prepare("SELECT COUNT(*) count FROM search_results WHERE search_execution_id IS NOT NULL AND (evidence_json IS NULL OR evidence_json='{}')").get().count),resultsMissingExecution:Number(db.prepare('SELECT COUNT(*) count FROM search_results r LEFT JOIN search_executions e ON e.id=r.search_execution_id WHERE r.search_execution_id IS NOT NULL AND e.id IS NULL').get().count)};}
  return {registry,admin,estimate,create,approve,run,pause,stop,readExecution,listForTask,results,debug,recoverInterrupted};
}
