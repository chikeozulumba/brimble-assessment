import { pgTable, uuid, text, integer, timestamp, bigserial, index, json } from 'drizzle-orm/pg-core';

export const deployments = pgTable('deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  source: text('source').notNull(),
  status: text('status').notNull(),
  imageTag: text('image_tag'),
  containerId: text('container_id'),
  internalPort: integer('internal_port'),
  publicUrl: text('public_url'),
  errorMessage: text('error_message'),
  envVars: json('env_vars').$type<Record<string, string>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const deploymentLogs = pgTable('deployment_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  deploymentId: uuid('deployment_id').notNull().references(() => deployments.id, { onDelete: 'cascade' }),
  ts: timestamp('ts').defaultNow().notNull(),
  stream: text('stream').notNull(),
  line: text('line').notNull(),
}, (table) => ({
  deploymentIdIdx: index('deployment_logs_deployment_id_idx').on(table.deploymentId, table.id),
}));
