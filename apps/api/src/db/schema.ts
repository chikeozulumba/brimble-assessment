import { pgTable, uuid, text, integer, timestamp, json } from 'drizzle-orm/pg-core';

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
  logPath: text('log_path'),
  envVars: json('env_vars').$type<Record<string, string>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
