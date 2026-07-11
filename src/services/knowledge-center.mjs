const TYPES = Object.freeze(['company', 'target_customer_profile']);
const STATUSES = Object.freeze(['Draft', 'Active', 'Needs Review', 'Outdated', 'Archived']);

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function error(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function createKnowledgeCenter({ db, audit }) {
  const admin = user => ['Admin', 'Owner'].includes(user?.role);
  const contributor = user => ['Admin', 'Owner', 'Sales', 'VA'].includes(user?.role);
  const row = id => db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(Number(id));
  const hydrate = item => item ? { ...item, content_json: parseJson(item.content_json, {}), tags_json: parseJson(item.tags_json, []) } : null;
  const canSee = (user, item) => Boolean(user && (admin(user) || item.status === 'Active' || (['Sales', 'VA'].includes(user.role) && Number(item.created_by) === Number(user.id) && ['Draft', 'Needs Review'].includes(item.status))));
  const canEdit = (user, item) => Boolean(contributor(user) && (admin(user) || Number(item.created_by) === Number(user.id)) && ['Draft', 'Needs Review'].includes(item.status));
  const validateType = value => { if (!TYPES.includes(value)) throw error('Knowledge type is not supported.'); return value; };
  const clean = body => ({
    knowledge_key: String(body.knowledge_key || '').trim(),
    knowledge_type: validateType(String(body.knowledge_type || '').trim()),
    title: String(body.title || '').trim(),
    summary: String(body.summary || '').trim() || null,
    content_json: body.content_json && typeof body.content_json === 'object' ? body.content_json : {},
    tags_json: Array.isArray(body.tags_json) ? body.tags_json.map(value => String(value).trim()).filter(Boolean) : []
  });
  const log = (user, item, from, to, note = null) => audit(user.id, 'knowledge_status_change', 'knowledge_items', String(item.id), { knowledgeKey: item.knowledge_key, revision: item.revision_no, fromStatus: from, toStatus: to, actor: user.id, reviewNoteSummary: String(note || '').slice(0, 200) || null });

  function list(user, filters = {}) {
    if (!user) throw error('Authentication required.', 401);
    const where = [], params = [];
    if (filters.type) { validateType(filters.type); where.push('knowledge_type = ?'); params.push(filters.type); }
    if (filters.status) { if (!STATUSES.includes(filters.status)) throw error('Knowledge status is not supported.'); where.push('status = ?'); params.push(filters.status); }
    if (filters.knowledgeKey) { where.push('knowledge_key = ?'); params.push(filters.knowledgeKey); }
    const limit = Math.min(200, Math.max(1, Number(filters.limit || 100)));
    return db.prepare(`SELECT * FROM knowledge_items ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY updated_at DESC, id DESC LIMIT ?`).all(...params, limit).filter(item => canSee(user, item)).map(hydrate);
  }

  function create(user, body) {
    if (!contributor(user)) throw error('Knowledge creation is not allowed for this role.', user ? 403 : 401);
    const value = clean(body);
    if (!value.knowledge_key || !value.title) throw error('Knowledge key and title are required.');
    if (db.prepare('SELECT id FROM knowledge_items WHERE knowledge_key = ?').get(value.knowledge_key)) throw error('Knowledge key already exists; create a revision from the active item.', 409);
    const item = db.prepare(`INSERT INTO knowledge_items(knowledge_key, knowledge_type, title, summary, content_json, tags_json, revision_no, status, created_by)
      VALUES(?, ?, ?, ?, ?, ?, 1, 'Draft', ?) RETURNING *`).get(value.knowledge_key, value.knowledge_type, value.title, value.summary, JSON.stringify(value.content_json), JSON.stringify(value.tags_json), user.id);
    audit(user.id, 'create', 'knowledge_items', String(item.id), { knowledgeKey: item.knowledge_key, revision: 1, status: 'Draft' });
    return hydrate(item);
  }

  function get(user, id) { const item = row(id); if (!item || !canSee(user, item)) throw error('Knowledge item not found.', 404); return hydrate(item); }

  function update(user, id, body) {
    const item = row(id); if (!item || !canSee(user, item)) throw error('Knowledge item not found.', 404);
    const value = clean({ ...item, ...body, content_json: body.content_json ?? parseJson(item.content_json, {}), tags_json: body.tags_json ?? parseJson(item.tags_json, []) });
    if (!value.title) throw error('Title is required.');
    if (item.status === 'Active') {
      if (!contributor(user)) throw error('Knowledge editing is not allowed for this role.', 403);
      const revision = Number(db.prepare('SELECT COALESCE(MAX(revision_no), 0) + 1 AS revision FROM knowledge_items WHERE knowledge_key = ?').get(item.knowledge_key).revision);
      return hydrate(db.prepare(`INSERT INTO knowledge_items(knowledge_key, knowledge_type, title, summary, content_json, tags_json, revision_no, supersedes_id, status, created_by)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?) RETURNING *`).get(item.knowledge_key, item.knowledge_type, value.title, value.summary, JSON.stringify(value.content_json), JSON.stringify(value.tags_json), revision, item.id, user.id));
    }
    if (!canEdit(user, item)) throw error('Knowledge editing is not allowed for this record.', 403);
    return hydrate(db.prepare(`UPDATE knowledge_items SET title = ?, summary = ?, content_json = ?, tags_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`).get(value.title, value.summary, JSON.stringify(value.content_json), JSON.stringify(value.tags_json), item.id));
  }

  function transition(user, id, action, note = null) {
    const item = row(id); if (!item || !canSee(user, item)) throw error('Knowledge item not found.', 404);
    const rules = { submit: ['Draft', 'Needs Review'], request_changes: ['Needs Review', 'Draft'], mark_outdated: ['Active', 'Outdated'], archive: ['Outdated', 'Archived'] };
    if (action === 'approve') {
      if (!admin(user) || item.status !== 'Needs Review') throw error('Knowledge approval is not allowed.', 403);
      db.exec('BEGIN');
      try {
        const old = db.prepare("SELECT * FROM knowledge_items WHERE knowledge_key = ? AND status = 'Active'").get(item.knowledge_key);
        if (old) { db.prepare("UPDATE knowledge_items SET status = 'Outdated', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(old.id); log(user, old, 'Active', 'Outdated'); }
        db.prepare("UPDATE knowledge_items SET status = 'Active', approved_by = ?, approved_at = CURRENT_TIMESTAMP, review_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(user.id, String(note || '').trim() || null, item.id);
        log(user, item, 'Needs Review', 'Active', note); db.exec('COMMIT');
      } catch (cause) { if (db.isTransaction) db.exec('ROLLBACK'); throw cause; }
      return hydrate(row(item.id));
    }
    const [from, to] = rules[action] || [];
    if (!from || item.status !== from) throw error('Knowledge status transition is not allowed.', 409);
    if (['mark_outdated', 'archive'].includes(action) && !admin(user)) throw error('Knowledge lifecycle change is not allowed.', 403);
    if (action === 'request_changes' && !admin(user)) throw error('Only Admin or Owner can request changes.', 403);
    if (action === 'submit' && !canEdit(user, item)) throw error('Knowledge submission is not allowed.', 403);
    const submitted = action === 'submit';
    db.prepare(`UPDATE knowledge_items SET status = ?, review_note = ?, submitted_by = CASE WHEN ? THEN ? ELSE submitted_by END,
      submitted_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE submitted_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(to, String(note || '').trim() || null, submitted ? 1 : 0, user.id, submitted ? 1 : 0, item.id);
    log(user, item, from, to, note); return hydrate(row(item.id));
  }

  function history(user, id) { const item = get(user, id); return list(user, { knowledgeKey: item.knowledge_key, limit: 200 }).sort((a, b) => b.revision_no - a.revision_no); }
  function active(types = TYPES, keys = []) {
    const where = ["status = 'Active'"], params = [];
    if (types.length) { where.push(`knowledge_type IN (${types.map(() => '?').join(',')})`); params.push(...types); }
    if (keys.length) { where.push(`knowledge_key IN (${keys.map(() => '?').join(',')})`); params.push(...keys); }
    return db.prepare(`SELECT * FROM knowledge_items WHERE ${where.join(' AND ')} ORDER BY knowledge_type, knowledge_key, revision_no DESC`).all(...params).map(hydrate);
  }
  function debug() {
    const byType = db.prepare('SELECT knowledge_type, COUNT(*) AS count FROM knowledge_items GROUP BY knowledge_type').all();
    const byStatus = db.prepare('SELECT status, COUNT(*) AS count FROM knowledge_items GROUP BY status').all();
    const missingActive = db.prepare("SELECT knowledge_key FROM knowledge_items GROUP BY knowledge_key HAVING SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) = 0").all().map(row => row.knowledge_key);
    return { byType, byStatus, active: Number(db.prepare("SELECT COUNT(*) AS count FROM knowledge_items WHERE status = 'Active'").get().count), needsReview: Number(db.prepare("SELECT COUNT(*) AS count FROM knowledge_items WHERE status = 'Needs Review'").get().count), outdated: Number(db.prepare("SELECT COUNT(*) AS count FROM knowledge_items WHERE status = 'Outdated'").get().count), missingActive, lastApprovedAt: db.prepare('SELECT MAX(approved_at) AS value FROM knowledge_items').get().value, singleActiveValid: Number(db.prepare("SELECT COUNT(*) AS count FROM (SELECT knowledge_key FROM knowledge_items WHERE status = 'Active' GROUP BY knowledge_key HAVING COUNT(*) > 1)").get().count) === 0 };
  }
  return { types: TYPES, statuses: STATUSES, list, create, get, update, transition, history, active, debug, permissions: user => ({ canCreate: contributor(user), canApprove: admin(user), canViewSensitivePricing: admin(user) }) };
}
