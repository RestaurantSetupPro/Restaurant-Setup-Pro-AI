import { createHash } from 'node:crypto';

const paidProviders = new Set(['openai', 'gemini', 'claude', 'qwen', 'flux', 'ideogram']);

const number = value => Number(value || 0);
const dayStart = () => new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
const monthStart = () => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();

export function createAiCostControl(db) {
  function settings() {
    const row = db.prepare('SELECT * FROM ai_cost_settings ORDER BY id LIMIT 1').get();
    return {
      ...row,
      daily_budget_usd: number(row.daily_budget_usd),
      monthly_budget_usd: number(row.monthly_budget_usd),
      text_budget_usd: number(row.text_budget_usd),
      image_budget_usd: number(row.image_budget_usd),
      require_confirmation_over_usd: number(row.require_confirmation_over_usd),
      cache_ttl_days: Number(row.cache_ttl_days || 7),
      allow_paid_provider: Boolean(row.allow_paid_provider)
    };
  }

  function spend(since, kind = null) {
    const kindSql = kind === 'image' ? ' AND image_count > 0' : kind === 'text' ? ' AND image_count = 0' : '';
    const row = db.prepare(`SELECT COALESCE(SUM(actual_cost_usd), 0) AS total FROM ai_cost_logs
      WHERE status = 'executed' AND created_at >= ?${kindSql}`).get(since);
    return number(row.total);
  }

  function dashboard() {
    const config = settings();
    const today = spend(dayStart());
    const monthly = spend(monthStart());
    const text = spend(monthStart(), 'text');
    const image = spend(monthStart(), 'image');
    const moduleCost = module => number(db.prepare(`SELECT COALESCE(SUM(actual_cost_usd), 0) AS total FROM ai_cost_logs
      WHERE status = 'executed' AND module_name = ? AND created_at >= ?`).get(module, monthStart()).total);
    const lastExpensive = db.prepare("SELECT * FROM ai_cost_logs WHERE status = 'executed' ORDER BY actual_cost_usd DESC, created_at DESC LIMIT 1").get() || null;
    const lastBlocked = db.prepare("SELECT * FROM ai_cost_logs WHERE status = 'blocked' ORDER BY created_at DESC, id DESC LIMIT 1").get() || null;
    return {
      todayAiCost: today, monthlyAiCost: monthly, textAiCost: text, imageAiCost: image,
      productAiCost: moduleCost('product-intelligence') + moduleCost('ai-product-factory'),
      opportunityAiCost: moduleCost('opportunity-intelligence'), proposalAiCost: moduleCost('proposal'),
      budgetRemaining: Math.max(0, Math.min(config.daily_budget_usd - today, config.monthly_budget_usd - monthly)),
      currentProvider: config.default_provider, paidProviderEnabled: config.allow_paid_provider,
      lastExpensiveRun: lastExpensive, blockedRuns: Number(db.prepare("SELECT COUNT(*) AS count FROM ai_cost_logs WHERE status = 'blocked'").get().count),
      lastBlockedRun: lastBlocked
    };
  }

  function log(input, status = 'estimated', reason = null) {
    return Number(db.prepare(`INSERT INTO ai_cost_logs
      (module_name, action_name, entity_type, entity_id, provider, model, input_tokens, output_tokens, image_count,
       estimated_cost_usd, actual_cost_usd, status, blocked_reason, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).get(
      input.module_name, input.action_name, input.entity_type || null, input.entity_id == null ? null : String(input.entity_id),
      input.provider || 'rules', input.model || null, Number(input.input_tokens || 0), Number(input.output_tokens || 0),
      Number(input.image_count || 0), number(input.estimated_cost_usd), number(input.actual_cost_usd),
      status, reason, input.user_id || null
    ).id);
  }

  function estimate(input) {
    const imageCount = Number(input.image_count || 0);
    const estimated = input.estimated_cost_usd === undefined
      ? (imageCount * number(input.image_unit_cost_usd || 0.05)) +
        ((Number(input.input_tokens || 0) + Number(input.output_tokens || 0)) / 1_000_000 * number(input.token_cost_per_million || 1))
      : number(input.estimated_cost_usd);
    const provider = String(input.provider || settings().default_provider || 'mock').toLowerCase();
    const id = log({ ...input, provider, image_count: imageCount, estimated_cost_usd: estimated }, 'estimated');
    return { id, estimated_cost_usd: estimated, provider, requires_confirmation: estimated >= settings().require_confirmation_over_usd };
  }

  function confirm(id, user) {
    const existing = db.prepare('SELECT * FROM ai_cost_logs WHERE id = ?').get(id);
    if (!existing) return null;
    if (!['Admin', 'Owner'].includes(user.role) && number(existing.estimated_cost_usd) >= settings().require_confirmation_over_usd) {
      const error = new Error('Admin or Owner confirmation is required for this AI run.');
      error.status = 403;
      throw error;
    }
    db.prepare("UPDATE ai_cost_logs SET status = 'confirmed', user_id = ? WHERE id = ? AND status = 'estimated'").run(user.id, id);
    return db.prepare('SELECT * FROM ai_cost_logs WHERE id = ?').get(id);
  }

  function authorize(input) {
    const config = settings();
    const provider = String(input.provider || config.default_provider || 'mock').toLowerCase();
    const estimated = number(input.estimated_cost_usd);
    const costs = dashboard();
    let reason = null;
    if (paidProviders.has(provider) && !config.allow_paid_provider) reason = 'Paid provider is disabled.';
    else if (paidProviders.has(provider) && (costs.todayAiCost + estimated > config.daily_budget_usd || costs.monthlyAiCost + estimated > config.monthly_budget_usd)) reason = 'Budget Exceeded';
    else if (paidProviders.has(provider) && input.image_count > 0 && costs.imageAiCost + estimated > config.image_budget_usd) reason = 'Image budget exceeded.';
    else if (paidProviders.has(provider) && !input.image_count && costs.textAiCost + estimated > config.text_budget_usd) reason = 'Text budget exceeded.';
    if (reason) {
      const id = log({ ...input, provider }, 'blocked', reason);
      return { allowed: false, provider: input.image_count ? 'mock' : 'rules', blocked: true, blocked_reason: reason, log_id: id };
    }
    return { allowed: true, provider, blocked: false };
  }

  function executed(input) {
    return log({ ...input, actual_cost_usd: input.actual_cost_usd ?? input.estimated_cost_usd ?? 0 }, 'executed');
  }

  function failed(input, reason) {
    return log(input, 'failed', String(reason || 'AI operation failed.'));
  }

  function cacheKey(input) {
    return createHash('sha256').update(JSON.stringify([
      input.module_name, input.action_name, input.entity_type, String(input.entity_id), input.fingerprint || ''
    ])).digest('hex');
  }

  function cacheGet(input) {
    const key = cacheKey(input);
    const row = db.prepare('SELECT * FROM ai_cache_records WHERE cache_key = ? AND expires_at > CURRENT_TIMESTAMP').get(key);
    if (!row) return null;
    log({ ...input, provider: input.provider || 'cache', estimated_cost_usd: 0, actual_cost_usd: 0 }, 'cached');
    try { return { ...row, cache_value: JSON.parse(row.cache_value) }; } catch { return { ...row, cache_value: row.cache_value }; }
  }

  function cacheSet(input, value) {
    const config = settings();
    const key = cacheKey(input);
    const expires = new Date(Date.now() + config.cache_ttl_days * 86_400_000).toISOString();
    db.prepare(`INSERT INTO ai_cache_records (module_name, action_name, entity_type, entity_id, cache_key, cache_value, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET cache_value = excluded.cache_value, expires_at = excluded.expires_at, updated_at = CURRENT_TIMESTAMP`)
      .run(input.module_name, input.action_name, input.entity_type, String(input.entity_id), key, JSON.stringify(value), expires);
  }

  return { settings, dashboard, estimate, confirm, authorize, executed, failed, cacheGet, cacheSet, log };
}
