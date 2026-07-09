import {
  integer,
  sqliteTable,
  text,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
import type { AdapterAccount } from '@auth/core/adapters';

// --- NextAuth.js Tables ---
export const users = sqliteTable('user', {
  id: text('id').notNull().primaryKey(),
  name: text('name'),
  email: text('email').notNull(),
  emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
  image: text('image'),
  role: text('role').default('user'), // 'admin', 'organizer', 'user'
  subscriptionPlan: text('subscriptionPlan').default('free'),
});

export const accounts = sqliteTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccount['type']>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = sqliteTable('session', {
  sessionToken: text('sessionToken').notNull().primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// --- AI SNAP Application Tables ---
export const events = sqliteTable('event', {
  id: text('id').notNull().primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  startTime: integer('startTime', { mode: 'timestamp_ms' }),
  endTime: integer('endTime', { mode: 'timestamp_ms' }),
  photoLimit: integer('photoLimit').default(-1), // -1 means unlimited
  logoUrl: text('logoUrl'),
  frameUrl: text('frameUrl'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
});

export const themes = sqliteTable('theme', {
  id: text('id').notNull().primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  coverImage: text('coverImage'),
  settings: text('settings', { mode: 'json' }), // store JSON as text in SQLite
});

export const prompts = sqliteTable('prompt', {
  id: text('id').notNull().primaryKey(),
  themeId: text('themeId')
    .notNull()
    .references(() => themes.id, { onDelete: 'cascade' }),
  systemPrompt: text('systemPrompt').notNull(),
  stylePrompt: text('stylePrompt').notNull(),
  negativePrompt: text('negativePrompt'),
});

export const images = sqliteTable('image', {
  id: text('id').notNull().primaryKey(),
  eventId: text('eventId')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  originalUrl: text('originalUrl'),
  generatedUrl: text('generatedUrl'),
  qrCode: text('qrCode'),
  status: text('status').default('pending'), // 'pending', 'completed', 'failed'
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
});

export const printers = sqliteTable('printer', {
  id: text('id').notNull().primaryKey(),
  eventId: text('eventId')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  queueStatus: text('queueStatus').default('idle'), // 'idle', 'printing', 'offline'
});
