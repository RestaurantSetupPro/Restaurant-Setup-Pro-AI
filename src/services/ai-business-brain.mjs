import { createHash, randomUUID } from 'node:crypto';

const supportedProviders = new Set(['mock', 'rules', 'openai', 'gemini', 'claude', 'qwen']);
const safeProviders = new Set(['mock', 'rules']);

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function hash(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function textSize(value) {
  return Math.ceil(String(value || '').length / 4);
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function allowedProvider(value) {
  const provider = String(value || 'mock').trim().toLowerCase();
  return supportedProviders.has(provider) ? provider : 'mock';
}

class MockTextProvider {
  constructor(provider = 'mock') {
    this.name = safeProviders.has(provider) ? provider : 'mock';
    this.model = this.name === 'rules' ? 'rules-v53-foundation' : 'mock-v53-business-brain';
  }

  async generateStructured({ request, context, prompt }) {
    const references = Array.isArray(context.sourceReferences) ? context.sourceReferences : [];
    return {
      outputType: 'analysis',
      recommendation: 'Foundation AI action completed using safe mock/rules provider.',
      summary: `${request.moduleName}.${request.actionName} received ${context.contextType} context for ${context.entityType}:${context.entityId}.`,
      reviewRequired: true,
      sourceReferences: references.slice(0, 10),
      prompt: { key: prompt.prompt_key, version: prompt.version },
      guardrails: [
        'No source-of-truth business records were modified.',
        'Output is advisory and requires human review before Apply.',
        'Paid provider execution is not enabled in Phase 1.'
      ],
      requestId: `v53-${randomUUID()}`
    };
  }
}

export function createAiProviderAdapter(providerName = 'mock') {
  const provider = allowedProvider(providerName);
  const activeProvider = safeProviders.has(provider) ? provider : 'mock';
  return {
    provider: activeProvider,
    requestedProvider: provider,
    available: true,
    model: activeProvider === 'rules' ? 'rules-v53-foundation' : 'mock-v53-business-brain',
    paidProviderReady: false,
    fallbackReason: safeProviders.has(provider) ? null : `${provider} is reserved for future paid-provider support; mock provider is active.`,
    client: new MockTextProvider(activeProvider)
  };
}

export function createAiBusinessBrain({ db, aiCostControl, buildContext }) {
  function promptTemplate(promptTemplateKey, moduleName, actionName) {
    const key = String(promptTemplateKey || 'v53.foundation.mock.v1').trim();
    const row = db.prepare(`SELECT * FROM ai_prompt_templates
      WHERE prompt_key = ? AND active = TRUE ORDER BY version DESC LIMIT 1`).get(key)
      || db.prepare(`SELECT * FROM ai_prompt_templates
      WHERE module_name = ? AND action_name = ? AND active = TRUE ORDER BY version DESC LIMIT 1`).get(moduleName, actionName)
      || { prompt_key: 'v53.foundation.mock.v1', version: 1, module_name: 'ai-business-brain', action_name: 'foundation-check', variables: '[]', output_format: 'json', template_text: 'Return a safe structured AI foundation response.' };
    return { ...row, variables: parseJson(row.variables, []) };
  }

  function saveContextSnapshot(context, userId) {
    const contextHash = hash(context.context || {});
    const row = db.prepare(`INSERT INTO ai_context_snapshots
      (context_type, entity_type, entity_id, redaction_level, context_hash, context_json, source_references, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).get(
      context.contextType,
      context.entityType,
      String(context.entityId),
      context.redactionLevel || 'internal',
      contextHash,
      JSON.stringify(context.context || {}),
      JSON.stringify(context.sourceReferences || []),
      userId || null
    );
    return { id: Number(row.id), contextHash };
  }

  function insertExecutionLog(input) {
    return Number(db.prepare(`INSERT INTO ai_execution_logs
      (module_name, action_name, entity_type, entity_id, user_id, provider, model, prompt_template_key, prompt_version,
       context_snapshot_id, input_hash, output_snapshot, status, estimated_cost_usd, actual_cost_usd, cost_log_id,
       error_message, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).get(
      input.moduleName,
      input.actionName,
      input.entityType,
      String(input.entityId),
      input.userId || null,
      input.provider,
      input.model || null,
      input.promptTemplateKey || null,
      input.promptVersion || null,
      input.contextSnapshotId || null,
      input.inputHash || null,
      JSON.stringify(input.outputSnapshot || {}),
      input.status,
      Number(input.estimatedCost || 0),
      Number(input.actualCost || 0),
      input.costLogId || null,
      input.errorMessage || null,
      input.startedAt || null,
      input.completedAt || null
    ).id);
  }

  function validateRequest(request) {
    for (const field of ['moduleName', 'actionName', 'entityType', 'entityId', 'contextType', 'userId']) {
      if (request[field] === undefined || request[field] === null || String(request[field]).trim() === '') {
        const error = new Error(`AI action requires ${field}.`);
        error.status = 400;
        throw error;
      }
    }
  }

  async function runAiAction(request) {
    validateRequest(request);
    const moduleName = String(request.moduleName).trim();
    const actionName = String(request.actionName).trim();
    const entityType = String(request.entityType).trim();
    const entityId = String(request.entityId).trim();
    const contextType = String(request.contextType).trim();
    const userId = Number(request.userId);
    const providerRequested = allowedProvider(request.options?.provider || request.provider || 'mock');
    const adapter = createAiProviderAdapter(providerRequested);
    const startedAt = new Date().toISOString();
    const prompt = promptTemplate(request.promptTemplateKey, moduleName, actionName);
    const context = await buildContext({ contextType, entityType, entityId, user: request.user, options: request.options || {} });
    const snapshot = saveContextSnapshot(context, userId);
    const fingerprint = hash({ request: { moduleName, actionName, entityType, entityId, contextType }, contextHash: snapshot.contextHash, prompt: { key: prompt.prompt_key, version: prompt.version } });
    const tokenInput = `${stableJson(context)}\n${String(prompt.template_text || '')}`;
    const costInput = {
      module_name: moduleName,
      action_name: actionName,
      entity_type: entityType,
      entity_id: entityId,
      provider: adapter.provider,
      model: adapter.model,
      input_tokens: textSize(tokenInput),
      output_tokens: 600,
      estimated_cost_usd: 0,
      user_id: userId,
      fingerprint
    };
    const estimate = aiCostControl.estimate(costInput);
    const authorization = aiCostControl.authorize({ ...costInput, estimated_cost_usd: estimate.estimated_cost_usd });
    if (!authorization.allowed) {
      const completedAt = new Date().toISOString();
      const output = { blocked: true, reason: authorization.blocked_reason, recommendation: 'AI execution was blocked by Cost Control.' };
      const executionLogId = insertExecutionLog({ moduleName, actionName, entityType, entityId, userId, provider: authorization.provider, model: adapter.model, promptTemplateKey: prompt.prompt_key, promptVersion: prompt.version, contextSnapshotId: snapshot.id, inputHash: fingerprint, outputSnapshot: output, status: 'blocked', estimatedCost: estimate.estimated_cost_usd, actualCost: 0, costLogId: authorization.log_id || estimate.id, errorMessage: authorization.blocked_reason, startedAt, completedAt });
      return { status: 'blocked', provider: authorization.provider, model: adapter.model, executionLogId, contextSnapshotId: snapshot.id, cost: { estimate, authorization }, result: output };
    }
    try {
      const result = await adapter.client.generateStructured({ request: { moduleName, actionName, entityType, entityId, contextType }, context, prompt });
      const executedCostLogId = aiCostControl.executed({ ...costInput, provider: adapter.provider, actual_cost_usd: 0 });
      const completedAt = new Date().toISOString();
      const executionLogId = insertExecutionLog({ moduleName, actionName, entityType, entityId, userId, provider: adapter.provider, model: adapter.model, promptTemplateKey: prompt.prompt_key, promptVersion: prompt.version, contextSnapshotId: snapshot.id, inputHash: fingerprint, outputSnapshot: result, status: 'completed', estimatedCost: estimate.estimated_cost_usd, actualCost: 0, costLogId: executedCostLogId, startedAt, completedAt });
      return { status: 'completed', provider: adapter.provider, requestedProvider: adapter.requestedProvider, model: adapter.model, prompt: { key: prompt.prompt_key, version: prompt.version }, executionLogId, contextSnapshotId: snapshot.id, cost: { estimate, authorization, executedCostLogId }, result };
    } catch (error) {
      const failedCostLogId = aiCostControl.failed(costInput, error.message);
      const completedAt = new Date().toISOString();
      const executionLogId = insertExecutionLog({ moduleName, actionName, entityType, entityId, userId, provider: adapter.provider, model: adapter.model, promptTemplateKey: prompt.prompt_key, promptVersion: prompt.version, contextSnapshotId: snapshot.id, inputHash: fingerprint, outputSnapshot: {}, status: 'failed', estimatedCost: estimate.estimated_cost_usd, actualCost: 0, costLogId: failedCostLogId, errorMessage: error.message, startedAt, completedAt });
      error.executionLogId = executionLogId;
      throw error;
    }
  }

  function debugData() {
    const provider = createAiProviderAdapter('mock');
    const lastRun = db.prepare('SELECT * FROM ai_execution_logs ORDER BY created_at DESC, id DESC LIMIT 1').get() || null;
    const lastError = db.prepare("SELECT * FROM ai_execution_logs WHERE status = 'failed' ORDER BY created_at DESC, id DESC LIMIT 1").get() || null;
    return {
      status: 'ready',
      providers: { active: provider.provider, supported: [...supportedProviders], paidProviderReady: false },
      promptTemplates: Number(db.prepare('SELECT COUNT(*) AS count FROM ai_prompt_templates').get().count),
      contextSnapshots: Number(db.prepare('SELECT COUNT(*) AS count FROM ai_context_snapshots').get().count),
      executionLogs: Number(db.prepare('SELECT COUNT(*) AS count FROM ai_execution_logs').get().count),
      completedRuns: Number(db.prepare("SELECT COUNT(*) AS count FROM ai_execution_logs WHERE status = 'completed'").get().count),
      failedRuns: Number(db.prepare("SELECT COUNT(*) AS count FROM ai_execution_logs WHERE status = 'failed'").get().count),
      blockedRuns: Number(db.prepare("SELECT COUNT(*) AS count FROM ai_execution_logs WHERE status = 'blocked'").get().count),
      lastRun,
      lastError: lastError?.error_message || null
    };
  }

  return { runAiAction, promptTemplate, debugData, providerStatus: () => createAiProviderAdapter('mock') };
}
