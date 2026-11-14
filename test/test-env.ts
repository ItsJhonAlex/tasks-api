export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/tasks_test?schema=public';

export function assertIsTestDatabase(url: string): void {
  const database = new URL(url).pathname.replace(/^\//, '');
  if (!database.endsWith('_test')) {
    throw new Error(
      `Refusing to run e2e tests against "${database}": the database name must end with "_test".`,
    );
  }
}
