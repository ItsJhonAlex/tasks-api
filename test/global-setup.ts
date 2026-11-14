import { execSync } from 'node:child_process';
import pg from 'pg';
import { assertIsTestDatabase, TEST_DATABASE_URL } from './test-env.js';

export default async function setup(): Promise<void> {
  assertIsTestDatabase(TEST_DATABASE_URL);

  const url = new URL(TEST_DATABASE_URL);
  const database = url.pathname.replace(/^\//, '');
  url.pathname = '/postgres';

  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database],
    );
    if (!rowCount) {
      await admin.query(`CREATE DATABASE "${database}"`);
    }
  } finally {
    await admin.end();
  }

  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
