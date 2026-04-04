import { PostgresStore } from '@mastra/pg';

// Strip Prisma-specific params (schema, connection_limit) from DATABASE_URL
// Mastra's pg pool doesn't understand these and they cause connection failures
const dbUrl = (process.env.DATABASE_URL || '').replace(/[?&]schema=[^&]+/g, '').replace(/[?&]connection_limit=[^&]+/g, '').replace(/\?$/, '');

export const pStore = new PostgresStore({
  id: 'postiz-store',
  connectionString: dbUrl || process.env.DATABASE_URL!,
});
