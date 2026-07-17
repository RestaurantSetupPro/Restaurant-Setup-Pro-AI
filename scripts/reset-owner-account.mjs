import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import pg from 'pg';
import { hashPassword, verifyPassword } from '../src/services/auth-password.mjs';

if (process.argv.length > 2) {
  console.error('This script does not accept command-line arguments. Enter the email and password interactively.');
  process.exit(2);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString || !/^postgres(?:ql)?:\/\//i.test(connectionString)) {
  console.error('Run this command in the production Render Shell where DATABASE_URL is available.');
  process.exit(2);
}
if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== 'function') {
  console.error('An interactive TTY is required. Password input through pipes or redirected input is refused.');
  process.exit(2);
}

function readSecret(label) {
  return new Promise((resolve, reject) => {
    let value = '';
    const restore = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
    };
    const onData = chunk => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          restore();
          reject(Object.assign(new Error('Owner reset cancelled.'), { cancelled: true }));
          return;
        }
        if (character === '\r' || character === '\n') {
          restore();
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    };
    stdout.write(label);
    stdin.resume();
    stdin.setRawMode(true);
    stdin.on('data', onData);
  });
}

function validatePassword(password) {
  if (password.length < 12) return 'Password must contain at least 12 characters.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include lowercase, uppercase, number, and symbol characters.';
  }
  return null;
}

const pool = new pg.Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 1,
  application_name: 'restaurant-setup-pro-owner-reset'
});

let client;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  const ownerResult = await client.query("SELECT id,email,password_hash,status FROM users WHERE role='Owner' FOR UPDATE");
  if (ownerResult.rowCount !== 1) {
    throw new Error(`Expected exactly one existing Owner account; found ${ownerResult.rowCount}. No account was changed.`);
  }
  const owner = ownerResult.rows[0];
  const prompt = createInterface({ input: stdin, output: stdout });
  const enteredEmail = (await prompt.question(`Owner email [${owner.email}]: `)).trim().toLowerCase();
  prompt.close();
  const email = enteredEmail || String(owner.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid Owner email is required.');

  const newPassword = await readSecret('New Owner password (hidden): ');
  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new Error(passwordError);
  const confirmation = await readSecret('Confirm new Owner password (hidden): ');
  if (newPassword !== confirmation) throw new Error('Password confirmation does not match.');

  const duplicate = await client.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1) AND id<>$2', [email, owner.id]);
  if (duplicate.rowCount) throw new Error('That email is already assigned to another account.');

  const passwordHash = hashPassword(newPassword);
  await client.query(
    "UPDATE users SET email=$1,password_hash=$2,status='active',updated_at=CURRENT_TIMESTAMP WHERE id=$3 AND role='Owner'",
    [email, passwordHash, owner.id]
  );
  await client.query('DELETE FROM sessions WHERE user_id=$1', [owner.id]);
  const verification = await client.query("SELECT id,email,password_hash,status,role FROM users WHERE id=$1 AND role='Owner'", [owner.id]);
  const updated = verification.rows[0];
  if (!updated || !verifyPassword(newPassword, updated.password_hash) || updated.password_hash === owner.password_hash) {
    throw new Error('The new Owner credential could not be verified. No change was committed.');
  }
  await client.query('COMMIT');
  console.log('Owner account reset completed. Exactly one existing Owner was updated, prior sessions were invalidated, and the new password hash was verified.');
} catch (error) {
  if (client) await client.query('ROLLBACK').catch(() => null);
  console.error(error.cancelled ? error.message : `Owner reset failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
