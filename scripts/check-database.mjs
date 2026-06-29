import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 1,
  application_name: 'restaurant-setup-pro-db-check'
});

try {
  const database = await pool.query('SELECT current_database() AS database, NOW() AS checked_at');
  const migration = await pool.query("SELECT version, applied_at FROM schema_migrations WHERE version = '001_initial_schema'");
  const products = await pool.query('SELECT COUNT(*)::int AS product_count FROM products');
  console.log(JSON.stringify({
    status: 'ok',
    database: database.rows[0].database,
    migration: migration.rows[0]?.version || null,
    productCount: products.rows[0].product_count,
    checkedAt: database.rows[0].checked_at
  }, null, 2));
} finally {
  await pool.end();
}
