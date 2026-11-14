import { assertIsTestDatabase, TEST_DATABASE_URL } from './test-env.js';

assertIsTestDatabase(TEST_DATABASE_URL);
process.env.DATABASE_URL = TEST_DATABASE_URL;
