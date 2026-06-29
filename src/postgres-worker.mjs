import { parentPort, workerData } from 'node:worker_threads';
import pg from 'pg';

const { Pool, types } = pg;
types.setTypeParser(20, value => Number(value));
types.setTypeParser(1700, value => Number(value));

const pool = new Pool({
  connectionString: workerData.connectionString,
  ssl: workerData.ssl ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DATABASE_POOL_SIZE || 5),
  application_name: 'restaurant-setup-pro'
});
let transactionClient = null;

function placeholders(sql) {
  let index = 0;
  let quote = null;
  let output = '';
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    if ((char === "'" || char === '"') && sql[i - 1] !== '\\') quote = quote === char ? null : (quote || char);
    if (char === '?' && !quote) output += `$${++index}`;
    else output += char;
  }
  return output;
}

function normalizeSql(value) {
  let sql = String(value).trim().replace(/COLLATE\s+NOCASE/gi, '');
  const ignore = /^INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql);
  if (ignore) {
    sql = sql.replace(/^INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
    sql = `${sql.replace(/;$/, '')} ON CONFLICT DO NOTHING`;
  }
  if (/^BEGIN\s+IMMEDIATE$/i.test(sql)) sql = 'BEGIN';
  return placeholders(sql);
}

async function query(sql, params = []) {
  return (transactionClient || pool).query(normalizeSql(sql), params);
}

async function execute(action, payload) {
  if (action === 'ping') {
    const result = await pool.query('SELECT 1 AS ok');
    return result.rows[0];
  }
  if (action === 'close') {
    if (transactionClient) {
      await transactionClient.query('ROLLBACK').catch(() => null);
      transactionClient.release();
      transactionClient = null;
    }
    await pool.end();
    return true;
  }
  if (action === 'exec') {
    const command = String(payload.sql).trim().toUpperCase();
    if (/^BEGIN(?:\s+IMMEDIATE)?;?$/.test(command)) {
      transactionClient = await pool.connect();
      await transactionClient.query('BEGIN');
      return true;
    }
    if (command === 'COMMIT' || command === 'ROLLBACK') {
      if (!transactionClient) return true;
      try { await transactionClient.query(command); }
      finally { transactionClient.release(); transactionClient = null; }
      return true;
    }
    await query(payload.sql);
    return true;
  }
  if (action === 'query') {
    const result = await query(payload.sql, payload.params);
    if (payload.mode === 'all') return result.rows;
    if (payload.mode === 'get') return result.rows[0];
    let lastInsertRowid = 0;
    if (String(payload.sql).trim().toUpperCase().startsWith('INSERT') && result.rowCount) {
      try {
        const sequence = await query('SELECT LASTVAL() AS id');
        lastInsertRowid = Number(sequence.rows[0]?.id || 0);
      } catch {}
    }
    return { changes: result.rowCount, lastInsertRowid };
  }
  throw new Error(`Unsupported database worker action: ${action}`);
}

parentPort.on('message', async ({ action, payload, signalBuffer, port }) => {
  const signal = new Int32Array(signalBuffer);
  try {
    const result = await execute(action, payload || {});
    port.postMessage({ ok: true, result });
  } catch (error) {
    port.postMessage({ ok: false, error: { message: error.message, code: error.code, detail: error.detail } });
  } finally {
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
    port.close();
  }
});
