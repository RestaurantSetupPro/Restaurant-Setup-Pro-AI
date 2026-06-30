import { Worker, MessageChannel, receiveMessageOnPort } from 'node:worker_threads';

function waitForMessage(port, signal, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const message = receiveMessageOnPort(port);
    if (message) return message.message;
    Atomics.wait(signal, 0, 0, Math.min(1_000, deadline - Date.now()));
  }
  throw new Error(`PostgreSQL worker request timed out after ${timeoutMs}ms.`);
}

export class PostgresSyncDatabase {
  constructor(connectionString, options = {}) {
    this.worker = new Worker(new URL('./postgres-worker.mjs', import.meta.url), {
      workerData: { connectionString, ssl: options.ssl !== false }
    });
    this.isTransaction = false;
    this.#request('ping');
  }

  #request(action, payload = {}) {
    const signalBuffer = new SharedArrayBuffer(4);
    const signal = new Int32Array(signalBuffer);
    const { port1, port2 } = new MessageChannel();
    this.worker.postMessage({ action, payload, signalBuffer, port: port2 }, [port2]);
    let response;
    try {
      response = waitForMessage(port1, signal);
    } finally {
      port1.close();
    }
    if (!response?.ok) {
      const error = new Error(response?.error?.message || 'PostgreSQL request failed.');
      Object.assign(error, response?.error || {});
      throw error;
    }
    return response.result;
  }

  prepare(sql) {
    return {
      all: (...params) => this.#request('query', { sql, params, mode: 'all' }),
      get: (...params) => this.#request('query', { sql, params, mode: 'get' }),
      run: (...params) => this.#request('query', { sql, params, mode: 'run' })
    };
  }

  exec(sql) {
    const normalized = String(sql).trim().toUpperCase();
    const result = this.#request('exec', { sql });
    if (normalized.startsWith('BEGIN')) this.isTransaction = true;
    if (normalized === 'COMMIT' || normalized === 'ROLLBACK') this.isTransaction = false;
    return result;
  }

  close() {
    try { this.#request('close'); } finally { this.worker.terminate(); }
  }
}
