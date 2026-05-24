import {
  pgTable,
  varchar,
  text,
  integer,
  timestamp,
  uuid,
  jsonb,
  pgEnum,
  primaryKey,
  index,
  uniqueIndex,
  numeric,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ───────────────────────────────────────────────────────
export const workspaceRoleEnum = pgEnum('workspace_role', ['owner', 'admin', 'member', 'guest']);
export const customerStatusEnum = pgEnum('customer_status', ['aktiv', 'lead', 'inaktiv']);
export const contractStatusEnum = pgEnum('contract_status', [
  'aktiv',
  'auslaufend',
  'storniert',
  'entwurf',
  'vorlage',
]);
export const vehicleStatusEnum = pgEnum('vehicle_status', [
  'frei',
  'vermietet',
  'wartung',
  'reserviert',
]);
export const vehicleKindEnum = pgEnum('vehicle_kind', [
  'sprinter',
  'transporter',
  'pkw',
  'kuehlfahrzeug',
]);
export const notificationKindEnum = pgEnum('notification_kind', [
  'mention',
  'thread_reply',
  'dm',
  'system',
  'deal',
  'task',
]);
export const calendarEventKindEnum = pgEnum('calendar_event_kind', [
  // Allgemein
  'meeting',
  'call',
  'focus',
  'task',
  'personal',
  'health',
  'travel',
  'other',
  // uRent / Vermietung
  'handover',
  'return',
  'maintenance',
  // Workspace-intern
  'internal',
]);
export const todoStatusEnum = pgEnum('todo_status', [
  'offen',
  'in_arbeit',
  'erledigt',
  'abgebrochen',
]);
export const todoPriorityEnum = pgEnum('todo_priority', [
  'niedrig',
  'mittel',
  'hoch',
  'urgent',
]);
export const todoVisibilityEnum = pgEnum('todo_visibility', [
  'private',
  'team',
  'account',
]);
export const todoActivityKindEnum = pgEnum('todo_activity_kind', [
  'created',
  'status_changed',
  'priority_changed',
  'due_changed',
  'assigned',
  'unassigned',
  'commented',
  'subtask_added',
  'subtask_completed',
  'subtask_removed',
  'snoozed',
  'claimed',
  'delegated',
  'delegation_accepted',
  'delegation_rejected',
  'auto_created',
  'completed',
  'cancelled',
]);
export const autoRuleTriggerEnum = pgEnum('auto_rule_trigger', [
  'contract_starting_tomorrow',
  'contract_ending_in_14_days',
  'contract_ending_in_30_days',
  'contract_lost_followup_90d',
  'lead_stale_10d',
  'lead_stale_30d',
  'vehicle_service_due',
  'customer_inactive_30d',
  'customer_onboarding_30d',
]);
export const todoEnergyEnum = pgEnum('todo_energy', [
  'deep',
  'light',
  'call',
  'admin',
  'quick',
]);

// ─── Users (native auth) ──────────────────────────────────────────
export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  initials: varchar('initials', { length: 4 }).notNull(),
  avatarFrom: varchar('avatar_from', { length: 32 }).notNull().default('#5eb6ff'),
  avatarTo: varchar('avatar_to', { length: 32 }).notNull().default('#0369a1'),
  passwordHash: text('password_hash'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  totpSecret: text('totp_secret'),
  totpEnabledAt: timestamp('totp_enabled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Sessions ────────────────────────────────────────────────────
export const sessions = pgTable(
  'sessions',
  {
    id: varchar('id', { length: 64 }).primaryKey(), // SHA-256 hex of token
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId, t.expiresAt),
  })
);

// ─── Email verifications ─────────────────────────────────────────
export const emailVerifications = pgTable('email_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Password resets ─────────────────────────────────────────────
export const passwordResets = pgTable('password_resets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Magic links ─────────────────────────────────────────────────
export const magicLinks = pgTable('magic_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Workspaces ──────────────────────────────────────────────────
export const workspaceActivityKindEnum = pgEnum('workspace_activity_kind', [
  'workspace_created',
  'member_joined',
  'member_left',
  'member_kicked',
  'role_changed',
  'invite_created',
  'invite_redeemed',
  'invite_revoked',
  'settings_changed',
  'ownership_transferred',
  'workspace_archived',
  'workspace_unarchived',
]);

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    short: varchar('short', { length: 4 }).notNull(),
    fromColor: varchar('from_color', { length: 32 }).notNull(),
    toColor: varchar('to_color', { length: 32 }).notNull(),
    ownerId: varchar('owner_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    description: text('description'),
    iconEmoji: varchar('icon_emoji', { length: 8 }),
    template: text('template'),
    scope: varchar('scope', { length: 16 }).notNull().default('business'),
    timezone: varchar('timezone', { length: 64 }).default('Europe/Berlin'),
    isPublic: integer('is_public').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('workspaces_slug_idx').on(t.slug),
  })
);

export const workspaceInvites = pgTable(
  'workspace_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 64 }).notNull().unique(),
    role: workspaceRoleEnum('role').notNull().default('member'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    maxUses: integer('max_uses').notNull().default(0),
    usedCount: integer('used_count').notNull().default(0),
    email: text('email'),
    createdById: varchar('created_by_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    tokenIdx: uniqueIndex('workspace_invites_token_idx').on(t.token),
    workspaceIdx: index('workspace_invites_workspace_idx').on(t.workspaceId),
  })
);

export const workspaceActivity = pgTable(
  'workspace_activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    actorId: varchar('actor_id', { length: 255 }).references(() => users.id),
    targetUserId: varchar('target_user_id', { length: 255 }).references(() => users.id),
    kind: workspaceActivityKindEnum('kind').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index('workspace_activity_workspace_idx').on(t.workspaceId, t.createdAt),
  })
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: workspaceRoleEnum('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.workspaceId, t.userId] }) })
);

// ─── Channels ────────────────────────────────────────────────────
export const channelKindEnum = pgEnum('channel_kind', [
  'general',
  'customer',
  'deal',
  'damage',
  'onboarding',
  'announcement',
]);

export const dealStageEnum = pgEnum('deal_stage', [
  'lead',
  'angebot',
  'verhandlung',
  'gewonnen',
  'verloren',
  'onboarding',
  'aktiv',
]);

export const channels = pgTable(
  'channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    topic: text('topic'),
    kind: channelKindEnum('kind').notNull().default('general'),
    dealStage: dealStageEnum('deal_stage'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugWsIdx: uniqueIndex('channels_slug_workspace_idx').on(t.workspaceId, t.slug),
  })
);

// ─── Channel pinned items ──────────────────────────────────────
export const channelPinnedKindEnum = pgEnum('channel_pinned_kind', [
  'contract',
  'customer',
  'vehicle',
  'todo',
  'doc',
  'thread',
  'link',
]);

export const channelPinnedItems = pgTable(
  'channel_pinned_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    kind: channelPinnedKindEnum('kind').notNull(),
    label: text('label').notNull(),
    targetId: text('target_id'),
    url: text('url'),
    position: integer('position').notNull().default(0),
    pinnedById: varchar('pinned_by_id', { length: 255 }).references(() => users.id),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    channelIdx: index('channel_pinned_items_channel_idx').on(t.channelId, t.position),
  })
);

// ─── Channel snippets / saved-replies ─────────────────────────
export const channelSnippets = pgTable(
  'channel_snippets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    createdById: varchar('created_by_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugWsIdx: uniqueIndex('channel_snippets_slug_workspace_idx').on(t.workspaceId, t.slug),
  })
);

// ─── Channel share links ──────────────────────────────────────
export const channelShareLinks = pgTable(
  'channel_share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    onlyAnnouncements: integer('only_announcements').notNull().default(0),
    createdById: varchar('created_by_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    viewCount: integer('view_count').notNull().default(0),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
  },
  (t) => ({
    tokenIdx: uniqueIndex('channel_share_links_token_idx').on(t.token),
    channelIdx: index('channel_share_links_channel_idx').on(t.channelId),
  })
);

export const channelMembers = pgTable(
  'channel_members',
  {
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.channelId, t.userId] }) })
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    authorId: varchar('author_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    parentId: uuid('parent_id'),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    channelIdx: index('messages_channel_idx').on(t.channelId, t.createdAt),
    parentIdx: index('messages_parent_idx').on(t.parentId),
  })
);

export const reactions = pgTable(
  'reactions',
  {
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.messageId, t.userId, t.emoji] }) })
);

// ─── Customers ───────────────────────────────────────────────────
export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    industry: text('industry'),
    status: customerStatusEnum('status').notNull().default('lead'),
    initials: varchar('initials', { length: 4 }).notNull(),
    fromColor: varchar('from_color', { length: 32 }).notNull(),
    toColor: varchar('to_color', { length: 32 }).notNull(),
    cachedActiveContractCount: integer('cached_active_contract_count').notNull().default(0),
    cachedOpenTodoCount: integer('cached_open_todo_count').notNull().default(0),
    cachedLastTouchpointAt: timestamp('cached_last_touchpoint_at', { withTimezone: true }),
    notes: text('notes').default(''),
    forecastContribution: text('forecast_contribution'),
    ownerId: varchar('owner_id', { length: 255 }).references(() => users.id, {
      onDelete: 'set null',
    }),
    onboardingProgress: jsonb('onboarding_progress')
      .$type<Record<string, boolean>>()
      .notNull()
      .default({}),
    onboardingStartedAt: timestamp('onboarding_started_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugWsIdx: uniqueIndex('customers_slug_workspace_idx').on(t.workspaceId, t.slug),
    ownerIdx: index('customers_owner_idx').on(t.ownerId),
  })
);

// ─── Customer Tags ──────────────────────────────────────────────
export const customerTags = pgTable(
  'customer_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    color: varchar('color', { length: 16 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugWsIdx: uniqueIndex('customer_tags_slug_workspace_idx').on(t.workspaceId, t.slug),
  })
);

export const customersToTags = pgTable(
  'customers_to_tags',
  {
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => customerTags.id, { onDelete: 'cascade' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.customerId, t.tagId] }) })
);

// ─── Customer Share Links ───────────────────────────────────────
export const customerShareLinks = pgTable(
  'customer_share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdById: varchar('created_by_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    viewCount: integer('view_count').notNull().default(0),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
  },
  (t) => ({
    tokenIdx: uniqueIndex('customer_share_links_token_idx').on(t.token),
    customerIdx: index('customer_share_links_customer_idx').on(t.customerId),
  })
);

export const customerContacts = pgTable('customer_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  role: text('role'),
  email: text('email'),
  phone: text('phone'),
});

export const customerActivity = pgTable(
  'customer_activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    detail: text('detail'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    customerIdx: index('customer_activity_customer_idx').on(t.customerId, t.occurredAt),
  })
);

export const customerChannels = pgTable(
  'customer_channels',
  {
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.customerId, t.channelId] }) })
);

// ─── Contracts ───────────────────────────────────────────────────
export const contracts = pgTable('contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id),
  externalId: text('external_id'),
  title: text('title').notNull(),
  status: contractStatusEnum('status').notNull().default('entwurf'),
  templateOf: text('template_of'),
  valueCents: integer('value_cents').default(0),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  body: jsonb('body')
    .$type<{ heading: string; paragraphs: string[] }[]>()
    .notNull()
    .default([]),
  // Sprint additions
  ownerId: varchar('owner_id', { length: 255 }).references(() => users.id, {
    onDelete: 'set null',
  }),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptedByName: text('accepted_by_name'),
  acceptedByEmail: text('accepted_by_email'),
  discountPct: integer('discount_pct'),
  estimatedCostsCents: integer('estimated_costs_cents'),
  notes: text('notes'),
  parentContractId: uuid('parent_contract_id'), // for renewals
  renewalOfTitle: text('renewal_of_title'),
  createdBy: varchar('created_by', { length: 255 }).references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Contract revisions (snapshot history) ─────────────────────
export const contractRevisions = pgTable(
  'contract_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contractId: uuid('contract_id')
      .notNull()
      .references(() => contracts.id, { onDelete: 'cascade' }),
    body: jsonb('body')
      .$type<{ heading: string; paragraphs: string[] }[]>()
      .notNull()
      .default([]),
    title: text('title').notNull(),
    valueCents: integer('value_cents'),
    snapshotById: varchar('snapshot_by_id', { length: 255 }).references(() => users.id),
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).defaultNow().notNull(),
    note: text('note'),
  },
  (t) => ({
    contractIdx: index('contract_revisions_contract_idx').on(t.contractId, t.snapshotAt),
  })
);

// ─── Contract Signatures (E-Sign stub) ─────────────────────────
export const contractSignatures = pgTable(
  'contract_signatures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contractId: uuid('contract_id')
      .notNull()
      .references(() => contracts.id, { onDelete: 'cascade' }),
    signerName: text('signer_name').notNull(),
    signerEmail: text('signer_email'),
    signerRole: text('signer_role'),
    signedAt: timestamp('signed_at', { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    shareToken: varchar('share_token', { length: 64 }),
  },
  (t) => ({
    contractIdx: index('contract_signatures_contract_idx').on(t.contractId),
  })
);

// ─── Contract Share Links ──────────────────────────────────────
export const contractShareLinks = pgTable(
  'contract_share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    contractId: uuid('contract_id')
      .notNull()
      .references(() => contracts.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 64 }).notNull().unique(),
    allowSignature: integer('allow_signature').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdById: varchar('created_by_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    viewCount: integer('view_count').notNull().default(0),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
  },
  (t) => ({
    tokenIdx: uniqueIndex('contract_share_links_token_idx').on(t.token),
    contractIdx: index('contract_share_links_contract_idx').on(t.contractId),
  })
);

// ─── Vehicles ────────────────────────────────────────────────────
export const damageSeverityEnum = pgEnum('damage_severity', ['minor', 'major', 'totalschaden']);
export const maintenanceKindEnum = pgEnum('maintenance_kind', [
  'service',
  'inspection',
  'reifenwechsel',
  'cleaning',
  'other',
]);

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    externalId: text('external_id'),
    plate: text('plate').notNull(),
    model: text('model').notNull(),
    kind: vehicleKindEnum('kind').notNull(),
    status: vehicleStatusEnum('status').notNull().default('frei'),
    location: text('location'),
    km: integer('km').default(0),
    nextService: text('next_service'),
    lastInspection: text('last_inspection'),
    ratingTenths: integer('rating_tenths').default(0),
    // Sprint additions
    ownerId: varchar('owner_id', { length: 255 }).references(() => users.id, {
      onDelete: 'set null',
    }),
    dailyRateCents: integer('daily_rate_cents'),
    weekendSurchargeCents: integer('weekend_surcharge_cents'),
    acquisitionCents: integer('acquisition_cents'),
    monthlyFixedCostsCents: integer('monthly_fixed_costs_cents'),
    serviceIntervalKm: integer('service_interval_km'),
    serviceIntervalDays: integer('service_interval_days'),
    lastServiceKm: integer('last_service_km'),
    lastServiceAt: timestamp('last_service_at', { withTimezone: true }),
    cachedUtilization30dPct: integer('cached_utilization_30d_pct').notNull().default(0),
    notes: text('notes').default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ownerIdx: index('vehicles_owner_idx').on(t.ownerId),
    statusIdx: index('vehicles_status_idx').on(t.workspaceId, t.status),
  })
);

// ─── Vehicle Tags ──────────────────────────────────────────────
export const vehicleTags = pgTable(
  'vehicle_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    color: varchar('color', { length: 16 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugWsIdx: uniqueIndex('vehicle_tags_slug_workspace_idx').on(t.workspaceId, t.slug),
  })
);

export const vehiclesToTags = pgTable(
  'vehicles_to_tags',
  {
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => vehicleTags.id, { onDelete: 'cascade' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.vehicleId, t.tagId] }) })
);

// ─── Vehicle Damages ──────────────────────────────────────────
export const vehicleDamages = pgTable(
  'vehicle_damages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    contractId: uuid('contract_id').references(() => contracts.id, { onDelete: 'set null' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    severity: damageSeverityEnum('severity').notNull().default('minor'),
    title: text('title').notNull(),
    description: text('description'),
    photoUrl: text('photo_url'),
    costCents: integer('cost_cents'),
    resolved: integer('resolved').notNull().default(0),
    createdById: varchar('created_by_id', { length: 255 }).references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    vehicleIdx: index('vehicle_damages_vehicle_idx').on(t.vehicleId, t.occurredAt),
    customerIdx: index('vehicle_damages_customer_idx').on(t.customerId),
  })
);

// ─── Vehicle Maintenance Schedules ────────────────────────────
export const vehicleMaintenance = pgTable(
  'vehicle_maintenance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    kind: maintenanceKindEnum('kind').notNull().default('service'),
    title: text('title').notNull(),
    intervalKm: integer('interval_km'),
    intervalDays: integer('interval_days'),
    lastDoneKm: integer('last_done_km'),
    lastDoneAt: timestamp('last_done_at', { withTimezone: true }),
    nextDueAt: timestamp('next_due_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    vehicleIdx: index('vehicle_maintenance_vehicle_idx').on(t.vehicleId, t.nextDueAt),
  })
);

// ─── Vehicle Share Links ──────────────────────────────────────
export const vehicleShareLinks = pgTable(
  'vehicle_share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'cascade' }),
    // null vehicleId = workspace-wide public catalog
    token: varchar('token', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdById: varchar('created_by_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    viewCount: integer('view_count').notNull().default(0),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
  },
  (t) => ({
    tokenIdx: uniqueIndex('vehicle_share_links_token_idx').on(t.token),
    vehicleIdx: index('vehicle_share_links_vehicle_idx').on(t.vehicleId),
  })
);

// ─── Calendar Events ─────────────────────────────────────────────
export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: calendarEventKindEnum('kind').notNull(),
    title: text('title').notNull(),
    detail: text('detail'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    linkedCustomerId: uuid('linked_customer_id').references(() => customers.id),
    linkedContractId: uuid('linked_contract_id').references(() => contracts.id),
    linkedVehicleId: uuid('linked_vehicle_id').references(() => vehicles.id),
    // Sprint additions
    location: text('location'),
    checklist: jsonb('checklist')
      .$type<{ id: string; label: string; done: boolean }[]>()
      .notNull()
      .default([]),
    recurringGroupId: uuid('recurring_group_id'),
    recurringRule: text('recurring_rule'), // simplified: weekly/monthly/daily etc.
    reminderMinutes: integer('reminder_minutes'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    autoSpawnSource: text('auto_spawn_source'), // 'contract' | 'recurring' | null
    createdById: varchar('created_by_id', { length: 255 }).references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    rangeIdx: index('calendar_events_range_idx').on(t.workspaceId, t.startsAt),
    vehicleRangeIdx: index('calendar_events_vehicle_range_idx').on(t.linkedVehicleId, t.startsAt),
    recurringIdx: index('calendar_events_recurring_idx').on(t.recurringGroupId),
  })
);

// ─── Calendar Event Templates ───────────────────────────────────
export const calendarEventTemplates = pgTable(
  'calendar_event_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    kind: calendarEventKindEnum('kind').notNull(),
    defaultDurationMinutes: integer('default_duration_minutes').notNull().default(60),
    defaultChecklist: jsonb('default_checklist')
      .$type<{ id: string; label: string }[]>()
      .notNull()
      .default([]),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugWsIdx: uniqueIndex('calendar_event_templates_slug_workspace_idx').on(t.workspaceId, t.slug),
  })
);

// ─── Calendar Share Links ───────────────────────────────────────
export const calendarShareLinks = pgTable(
  'calendar_share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
    // null customerId = workspace-wide calendar share
    token: varchar('token', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdById: varchar('created_by_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    viewCount: integer('view_count').notNull().default(0),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
  },
  (t) => ({
    tokenIdx: uniqueIndex('calendar_share_links_token_idx').on(t.token),
  })
);

// ─── Notifications ───────────────────────────────────────────────
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: notificationKindEnum('kind').notNull(),
    title: text('title').notNull(),
    excerpt: text('excerpt'),
    sourceUrl: text('source_url').notNull(),
    actorId: varchar('actor_id', { length: 255 }).references(() => users.id),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('notifications_user_idx').on(t.userId, t.readAt, t.createdAt),
  })
);

// ─── Todo Groups ────────────────────────────────────────────────
export const todoGroups = pgTable(
  'todo_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id'),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    emoji: varchar('emoji', { length: 8 }),
    color: varchar('color', { length: 16 }),
    position: integer('position').notNull().default(0),
    pinned: integer('pinned').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    defaultAssigneeId: varchar('default_assignee_id', { length: 255 }).references(
      () => users.id,
      { onDelete: 'set null' }
    ),
    defaultPriority: todoPriorityEnum('default_priority'),
    defaultVisibility: todoVisibilityEnum('default_visibility'),
    createdById: varchar('created_by_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugWsIdx: uniqueIndex('todo_groups_slug_workspace_idx').on(t.workspaceId, t.slug),
    positionIdx: index('todo_groups_position_idx').on(t.workspaceId, t.pinned, t.position),
  })
);

// ─── Todos ──────────────────────────────────────────────────────
export const todos = pgTable(
  'todos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => todoGroups.id, { onDelete: 'set null' }),
    /** Denormalized from group.project_id for cheap project-filter queries.
     *  Kept in sync server-side when a todo's group changes. */
    projectId: uuid('project_id'),
    createdById: varchar('created_by_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    assigneeId: varchar('assignee_id', { length: 255 }).references(() => users.id),
    title: text('title').notNull(),
    description: text('description'),
    status: todoStatusEnum('status').notNull().default('offen'),
    priority: todoPriorityEnum('priority').notNull().default('mittel'),
    visibility: todoVisibilityEnum('visibility').notNull().default('team'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    snoozeUntil: timestamp('snooze_until', { withTimezone: true }),
    snoozeTrigger: jsonb('snooze_trigger').$type<{
      kind: 'customer_reply' | 'after_event' | 'contract_active' | 'payment_received';
      ref?: string;
    }>(),
    // Entity links
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    contractId: uuid('contract_id').references(() => contracts.id, { onDelete: 'set null' }),
    vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
    channelId: uuid('channel_id').references(() => channels.id, { onDelete: 'set null' }),
    sourceMessageId: uuid('source_message_id').references(() => messages.id, {
      onDelete: 'set null',
    }),
    // Auto-rule provenance
    autoRuleSlug: text('auto_rule_slug'),
    // Done-loop hooks
    onDoneTemplate: text('on_done_template'),
    // Sprint 3 — energy / time-block
    energy: todoEnergyEnum('energy'),
    estimateMinutes: integer('estimate_minutes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    workspaceStatusIdx: index('todos_workspace_status_idx').on(
      t.workspaceId,
      t.status,
      t.dueAt
    ),
    assigneeStatusIdx: index('todos_assignee_status_idx').on(t.assigneeId, t.status, t.dueAt),
    customerIdx: index('todos_customer_idx').on(t.customerId),
    contractIdx: index('todos_contract_idx').on(t.contractId),
    vehicleIdx: index('todos_vehicle_idx').on(t.vehicleId),
    channelIdx: index('todos_channel_idx').on(t.channelId),
    groupIdx: index('todos_group_idx').on(t.groupId, t.status),
  })
);

export const todoSubtasks = pgTable(
  'todo_subtasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    todoId: uuid('todo_id')
      .notNull()
      .references(() => todos.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    done: integer('done').notNull().default(0), // 0/1
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    todoIdx: index('todo_subtasks_todo_idx').on(t.todoId, t.position),
  })
);

export const todoComments = pgTable(
  'todo_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    todoId: uuid('todo_id')
      .notNull()
      .references(() => todos.id, { onDelete: 'cascade' }),
    authorId: varchar('author_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    todoIdx: index('todo_comments_todo_idx').on(t.todoId, t.createdAt),
  })
);

export const todoActivity = pgTable(
  'todo_activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    todoId: uuid('todo_id')
      .notNull()
      .references(() => todos.id, { onDelete: 'cascade' }),
    actorId: varchar('actor_id', { length: 255 }).references(() => users.id),
    kind: todoActivityKindEnum('kind').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    todoIdx: index('todo_activity_todo_idx').on(t.todoId, t.createdAt),
  })
);

export const todoWatchers = pgTable(
  'todo_watchers',
  {
    todoId: uuid('todo_id')
      .notNull()
      .references(() => todos.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.todoId, t.userId] }) })
);

// ─── Workflows (Sprint 2) ────────────────────────────────────────
export const workflows = pgTable(
  'workflows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    emoji: varchar('emoji', { length: 8 }),
    description: text('description'),
    createdById: varchar('created_by_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugWsIdx: uniqueIndex('workflows_slug_workspace_idx').on(t.workspaceId, t.slug),
  })
);

export const workflowSteps = pgTable(
  'workflow_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    titleTemplate: text('title_template').notNull(),
    description: text('description'),
    position: integer('position').notNull().default(0),
    dueOffsetMinutes: integer('due_offset_minutes'),
    defaultPriority: todoPriorityEnum('default_priority'),
    defaultEnergy: todoEnergyEnum('default_energy'),
  },
  (t) => ({
    workflowIdx: index('workflow_steps_workflow_idx').on(t.workflowId, t.position),
  })
);

// ─── Public share links (Sprint 3) ──────────────────────────────
export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => todoGroups.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdById: varchar('created_by_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    viewCount: integer('view_count').notNull().default(0),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
  },
  (t) => ({
    tokenIdx: uniqueIndex('share_links_token_idx').on(t.token),
    groupIdx: index('share_links_group_idx').on(t.groupId),
  })
);

export const todoAutoRules = pgTable(
  'todo_auto_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: autoRuleTriggerEnum('slug').notNull(),
    enabled: integer('enabled').notNull().default(1), // 0/1
    defaultAssigneeId: varchar('default_assignee_id', { length: 255 }).references(
      () => users.id,
      { onDelete: 'set null' }
    ),
    defaultPriority: todoPriorityEnum('default_priority').notNull().default('mittel'),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    workspaceSlugIdx: uniqueIndex('todo_auto_rules_workspace_slug_idx').on(t.workspaceId, t.slug),
  })
);

// ─── Relations ───────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  workspaceMemberships: many(workspaceMembers),
  messagesAuthored: many(messages),
  notifications: many(notifications),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  members: many(workspaceMembers),
  channels: many(channels),
  customers: many(customers),
  contracts: many(contracts),
  vehicles: many(vehicles),
  calendarEvents: many(calendarEvents),
  invites: many(workspaceInvites),
  activity: many(workspaceActivity),
}));

export const workspaceInvitesRelations = relations(workspaceInvites, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceInvites.workspaceId],
    references: [workspaces.id],
  }),
  createdBy: one(users, { fields: [workspaceInvites.createdById], references: [users.id] }),
}));

export const workspaceActivityRelations = relations(workspaceActivity, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceActivity.workspaceId],
    references: [workspaces.id],
  }),
  actor: one(users, { fields: [workspaceActivity.actorId], references: [users.id] }),
  targetUser: one(users, { fields: [workspaceActivity.targetUserId], references: [users.id] }),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [channels.workspaceId], references: [workspaces.id] }),
  members: many(channelMembers),
  messages: many(messages),
  pinnedItems: many(channelPinnedItems),
}));

export const channelPinnedItemsRelations = relations(channelPinnedItems, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [channelPinnedItems.workspaceId],
    references: [workspaces.id],
  }),
  channel: one(channels, {
    fields: [channelPinnedItems.channelId],
    references: [channels.id],
  }),
  pinnedBy: one(users, {
    fields: [channelPinnedItems.pinnedById],
    references: [users.id],
  }),
}));

export const channelSnippetsRelations = relations(channelSnippets, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [channelSnippets.workspaceId],
    references: [workspaces.id],
  }),
  createdBy: one(users, { fields: [channelSnippets.createdById], references: [users.id] }),
}));

export const channelShareLinksRelations = relations(channelShareLinks, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [channelShareLinks.workspaceId],
    references: [workspaces.id],
  }),
  channel: one(channels, {
    fields: [channelShareLinks.channelId],
    references: [channels.id],
  }),
  createdBy: one(users, {
    fields: [channelShareLinks.createdById],
    references: [users.id],
  }),
}));

export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
  channel: one(channels, { fields: [channelMembers.channelId], references: [channels.id] }),
  user: one(users, { fields: [channelMembers.userId], references: [users.id] }),
}));

export const customerChannelsRelations = relations(customerChannels, ({ one }) => ({
  customer: one(customers, {
    fields: [customerChannels.customerId],
    references: [customers.id],
  }),
  channel: one(channels, { fields: [customerChannels.channelId], references: [channels.id] }),
}));

export const customerContactsRelations = relations(customerContacts, ({ one }) => ({
  customer: one(customers, {
    fields: [customerContacts.customerId],
    references: [customers.id],
  }),
}));

export const customerActivityRelations = relations(customerActivity, ({ one }) => ({
  customer: one(customers, {
    fields: [customerActivity.customerId],
    references: [customers.id],
  }),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
}));

export const reactionsRelations = relations(reactions, ({ one }) => ({
  message: one(messages, { fields: [reactions.messageId], references: [messages.id] }),
  user: one(users, { fields: [reactions.userId], references: [users.id] }),
}));

export const todoGroupsRelations = relations(todoGroups, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [todoGroups.workspaceId], references: [workspaces.id] }),
  createdBy: one(users, { fields: [todoGroups.createdById], references: [users.id] }),
  todos: many(todos),
}));

export const todosRelations = relations(todos, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [todos.workspaceId], references: [workspaces.id] }),
  group: one(todoGroups, { fields: [todos.groupId], references: [todoGroups.id] }),
  createdBy: one(users, { fields: [todos.createdById], references: [users.id] }),
  assignee: one(users, { fields: [todos.assigneeId], references: [users.id] }),
  customer: one(customers, { fields: [todos.customerId], references: [customers.id] }),
  contract: one(contracts, { fields: [todos.contractId], references: [contracts.id] }),
  vehicle: one(vehicles, { fields: [todos.vehicleId], references: [vehicles.id] }),
  channel: one(channels, { fields: [todos.channelId], references: [channels.id] }),
  subtasks: many(todoSubtasks),
  comments: many(todoComments),
  activity: many(todoActivity),
  watchers: many(todoWatchers),
}));

export const todoSubtasksRelations = relations(todoSubtasks, ({ one }) => ({
  todo: one(todos, { fields: [todoSubtasks.todoId], references: [todos.id] }),
}));

export const todoCommentsRelations = relations(todoComments, ({ one }) => ({
  todo: one(todos, { fields: [todoComments.todoId], references: [todos.id] }),
  author: one(users, { fields: [todoComments.authorId], references: [users.id] }),
}));

export const todoActivityRelations = relations(todoActivity, ({ one }) => ({
  todo: one(todos, { fields: [todoActivity.todoId], references: [todos.id] }),
  actor: one(users, { fields: [todoActivity.actorId], references: [users.id] }),
}));

export const todoWatchersRelations = relations(todoWatchers, ({ one }) => ({
  todo: one(todos, { fields: [todoWatchers.todoId], references: [todos.id] }),
  user: one(users, { fields: [todoWatchers.userId], references: [users.id] }),
}));

export const todoAutoRulesRelations = relations(todoAutoRules, ({ one }) => ({
  workspace: one(workspaces, { fields: [todoAutoRules.workspaceId], references: [workspaces.id] }),
  defaultAssignee: one(users, {
    fields: [todoAutoRules.defaultAssigneeId],
    references: [users.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [workflows.workspaceId], references: [workspaces.id] }),
  createdBy: one(users, { fields: [workflows.createdById], references: [users.id] }),
  steps: many(workflowSteps),
}));

export const workflowStepsRelations = relations(workflowSteps, ({ one }) => ({
  workflow: one(workflows, { fields: [workflowSteps.workflowId], references: [workflows.id] }),
}));

export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  workspace: one(workspaces, { fields: [shareLinks.workspaceId], references: [workspaces.id] }),
  group: one(todoGroups, { fields: [shareLinks.groupId], references: [todoGroups.id] }),
  createdBy: one(users, { fields: [shareLinks.createdById], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  channel: one(channels, { fields: [messages.channelId], references: [channels.id] }),
  author: one(users, { fields: [messages.authorId], references: [users.id] }),
  reactions: many(reactions),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [customers.workspaceId], references: [workspaces.id] }),
  owner: one(users, { fields: [customers.ownerId], references: [users.id] }),
  contacts: many(customerContacts),
  activity: many(customerActivity),
  linkedChannels: many(customerChannels),
  contracts: many(contracts),
  tagAssignments: many(customersToTags),
}));

export const customerTagsRelations = relations(customerTags, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [customerTags.workspaceId], references: [workspaces.id] }),
  assignments: many(customersToTags),
}));

export const customersToTagsRelations = relations(customersToTags, ({ one }) => ({
  customer: one(customers, {
    fields: [customersToTags.customerId],
    references: [customers.id],
  }),
  tag: one(customerTags, {
    fields: [customersToTags.tagId],
    references: [customerTags.id],
  }),
}));

export const customerShareLinksRelations = relations(customerShareLinks, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [customerShareLinks.workspaceId],
    references: [workspaces.id],
  }),
  customer: one(customers, {
    fields: [customerShareLinks.customerId],
    references: [customers.id],
  }),
  createdBy: one(users, {
    fields: [customerShareLinks.createdById],
    references: [users.id],
  }),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [contracts.workspaceId], references: [workspaces.id] }),
  customer: one(customers, { fields: [contracts.customerId], references: [customers.id] }),
  vehicle: one(vehicles, { fields: [contracts.vehicleId], references: [vehicles.id] }),
  owner: one(users, { fields: [contracts.ownerId], references: [users.id] }),
  createdByUser: one(users, { fields: [contracts.createdBy], references: [users.id] }),
  revisions: many(contractRevisions),
  signatures: many(contractSignatures),
}));

export const contractRevisionsRelations = relations(contractRevisions, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractRevisions.contractId],
    references: [contracts.id],
  }),
  snapshotBy: one(users, {
    fields: [contractRevisions.snapshotById],
    references: [users.id],
  }),
}));

export const contractSignaturesRelations = relations(contractSignatures, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractSignatures.contractId],
    references: [contracts.id],
  }),
}));

export const contractShareLinksRelations = relations(contractShareLinks, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [contractShareLinks.workspaceId],
    references: [workspaces.id],
  }),
  contract: one(contracts, {
    fields: [contractShareLinks.contractId],
    references: [contracts.id],
  }),
  createdBy: one(users, {
    fields: [contractShareLinks.createdById],
    references: [users.id],
  }),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [vehicles.workspaceId], references: [workspaces.id] }),
  owner: one(users, { fields: [vehicles.ownerId], references: [users.id] }),
  tagAssignments: many(vehiclesToTags),
  damages: many(vehicleDamages),
  maintenance: many(vehicleMaintenance),
}));

export const vehicleTagsRelations = relations(vehicleTags, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [vehicleTags.workspaceId], references: [workspaces.id] }),
  assignments: many(vehiclesToTags),
}));

export const vehiclesToTagsRelations = relations(vehiclesToTags, ({ one }) => ({
  vehicle: one(vehicles, { fields: [vehiclesToTags.vehicleId], references: [vehicles.id] }),
  tag: one(vehicleTags, { fields: [vehiclesToTags.tagId], references: [vehicleTags.id] }),
}));

export const vehicleDamagesRelations = relations(vehicleDamages, ({ one }) => ({
  workspace: one(workspaces, { fields: [vehicleDamages.workspaceId], references: [workspaces.id] }),
  vehicle: one(vehicles, { fields: [vehicleDamages.vehicleId], references: [vehicles.id] }),
  customer: one(customers, { fields: [vehicleDamages.customerId], references: [customers.id] }),
  contract: one(contracts, { fields: [vehicleDamages.contractId], references: [contracts.id] }),
  createdBy: one(users, { fields: [vehicleDamages.createdById], references: [users.id] }),
}));

export const vehicleMaintenanceRelations = relations(vehicleMaintenance, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [vehicleMaintenance.workspaceId],
    references: [workspaces.id],
  }),
  vehicle: one(vehicles, {
    fields: [vehicleMaintenance.vehicleId],
    references: [vehicles.id],
  }),
}));

export const vehicleShareLinksRelations = relations(vehicleShareLinks, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [vehicleShareLinks.workspaceId],
    references: [workspaces.id],
  }),
  vehicle: one(vehicles, {
    fields: [vehicleShareLinks.vehicleId],
    references: [vehicles.id],
  }),
  createdBy: one(users, {
    fields: [vehicleShareLinks.createdById],
    references: [users.id],
  }),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [calendarEvents.workspaceId],
    references: [workspaces.id],
  }),
  customer: one(customers, {
    fields: [calendarEvents.linkedCustomerId],
    references: [customers.id],
  }),
  contract: one(contracts, {
    fields: [calendarEvents.linkedContractId],
    references: [contracts.id],
  }),
  vehicle: one(vehicles, {
    fields: [calendarEvents.linkedVehicleId],
    references: [vehicles.id],
  }),
  createdBy: one(users, {
    fields: [calendarEvents.createdById],
    references: [users.id],
  }),
}));

export const calendarEventTemplatesRelations = relations(calendarEventTemplates, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [calendarEventTemplates.workspaceId],
    references: [workspaces.id],
  }),
}));

export const calendarShareLinksRelations = relations(calendarShareLinks, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [calendarShareLinks.workspaceId],
    references: [workspaces.id],
  }),
  customer: one(customers, {
    fields: [calendarShareLinks.customerId],
    references: [customers.id],
  }),
  createdBy: one(users, {
    fields: [calendarShareLinks.createdById],
    references: [users.id],
  }),
}));

// ─── Notes (Notion-style block editor) ─────────────────────────
export const noteScopeEnum = pgEnum('note_scope', ['private', 'workspace', 'public']);

export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    parentNoteId: uuid('parent_note_id'),
    title: text('title').notNull().default('Unbenannt'),
    icon: varchar('icon', { length: 8 }),
    coverImageUrl: text('cover_image_url'),
    scope: noteScopeEnum('scope').notNull().default('workspace'),
    shareToken: varchar('share_token', { length: 64 }),
    document: jsonb('document').notNull().default([]),
    isTemplate: boolean('is_template').notNull().default(false),
    templateKey: text('template_key'),
    position: numeric('position', { precision: 20, scale: 10 }).notNull().default('0'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdById: varchar('created_by_id', { length: 255 }).references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index('notes_workspace_idx').on(t.workspaceId, t.position),
    parentIdx: index('notes_parent_idx').on(t.parentNoteId),
    shareTokenIdx: uniqueIndex('notes_share_token_idx').on(t.shareToken),
  })
);

export const notesRelations = relations(notes, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [notes.workspaceId], references: [workspaces.id] }),
  parent: one(notes, {
    fields: [notes.parentNoteId],
    references: [notes.id],
    relationName: 'note_children',
  }),
  children: many(notes, { relationName: 'note_children' }),
  createdBy: one(users, { fields: [notes.createdById], references: [users.id] }),
}));

export const noteMentionTypeEnum = pgEnum('note_mention_type', [
  'customer',
  'contract',
  'vehicle',
  'channel',
  'event',
  'todo',
  'user',
]);

export const noteMentions = pgTable(
  'note_mentions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    noteId: uuid('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    mentionType: noteMentionTypeEnum('mention_type').notNull(),
    mentionId: text('mention_id').notNull(),
    label: text('label').notNull(),
    blockId: text('block_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    noteIdx: index('note_mentions_note_idx').on(t.noteId),
    targetIdx: index('note_mentions_target_idx').on(t.mentionType, t.mentionId),
  })
);

export const noteMentionsRelations = relations(noteMentions, ({ one }) => ({
  note: one(notes, { fields: [noteMentions.noteId], references: [notes.id] }),
}));

export const noteRevisions = pgTable(
  'note_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    noteId: uuid('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    document: jsonb('document').notNull(),
    createdById: varchar('created_by_id', { length: 255 }).references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    noteIdx: index('note_revisions_note_idx').on(t.noteId, t.createdAt),
  })
);

export const noteRevisionsRelations = relations(noteRevisions, ({ one }) => ({
  note: one(notes, { fields: [noteRevisions.noteId], references: [notes.id] }),
  createdBy: one(users, { fields: [noteRevisions.createdById], references: [users.id] }),
}));

// ─── Tags (workspace-scoped) ─────────────────────────────────────
// Single tag pool per workspace. Tags are reusable across attachments —
// note_tags is the only junction today, but the pattern fits todos,
// contacts, etc. later. (workspace_id, slug) is the dedup key so
// "Work" and "work" collapse on insert.
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: varchar('slug', { length: 64 }).notNull(),
    color: varchar('color', { length: 16 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    workspaceSlugIdx: uniqueIndex('tags_workspace_slug_idx').on(t.workspaceId, t.slug),
    workspaceIdx: index('tags_workspace_idx').on(t.workspaceId, t.name),
  })
);

export const noteTags = pgTable(
  'note_tags',
  {
    noteId: uuid('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: uniqueIndex('note_tags_pk').on(t.noteId, t.tagId),
    tagIdx: index('note_tags_tag_idx').on(t.tagId),
  })
);

export const tagsRelations = relations(tags, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [tags.workspaceId], references: [workspaces.id] }),
  noteTags: many(noteTags),
}));

export const noteTagsRelations = relations(noteTags, ({ one }) => ({
  note: one(notes, { fields: [noteTags.noteId], references: [notes.id] }),
  tag: one(tags, { fields: [noteTags.tagId], references: [tags.id] }),
}));

// ─── User Settings (BYOK AI keys, prefs) ───────────────────────
export const userSettings = pgTable('user_settings', {
  userId: varchar('user_id', { length: 255 })
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  // AES-256-GCM encrypted blob: "<iv-base64>:<authTag-base64>:<ciphertext-base64>"
  openaiKeyEnc: text('openai_key_enc'),
  preferredAiModel: text('preferred_ai_model'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, { fields: [userSettings.userId], references: [users.id] }),
}));

// ─── Billing / Subscriptions ─────────────────────────────────
export const planTierEnum = pgEnum('plan_tier', ['free', 'solo', 'team']);

export const subscriptions = pgTable(
  'subscriptions',
  {
    workspaceId: uuid('workspace_id')
      .primaryKey()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    plan: planTierEnum('plan').notNull().default('free'),
    seats: integer('seats').notNull().default(1),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    stripeIdx: index('subscriptions_stripe_idx').on(t.stripeSubscriptionId),
  })
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [subscriptions.workspaceId],
    references: [workspaces.id],
  }),
}));

// ─── Projects ──────────────────────────────────────────────────
// Workspace-level grouping that spans modules. A Project might be
// "Fleet OS" or "Studio" — todo-groups, note-books, etc. can be
// assigned to a project for cross-module filtering. Optional: groups
// without a project show as "Workspace-weit" in the UI.
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    color: varchar('color', { length: 16 }),
    position: integer('position').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdById: varchar('created_by_id', { length: 255 }).references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index('projects_workspace_idx').on(t.workspaceId, t.position),
    slugWsIdx: uniqueIndex('projects_slug_workspace_idx').on(t.workspaceId, t.slug),
  })
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
  createdBy: one(users, { fields: [projects.createdById], references: [users.id] }),
  todoGroups: many(todoGroups),
}));

// ─── OAuth identities ────────────────────────────────────────────
// One row per (provider, providerAccountId) pair. A single user may have
// multiple oauth rows if they link several providers.
export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    email: text('email'),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    // OAuth API tokens — populated only when the user opted into a flow
    // that requested offline access (gmail.readonly etc.). Login-only
    // OAuth (openid email profile) leaves these null; we never need
    // a long-lived token for "who is this person" verification.
    accessTokenEnc: text('access_token_enc'),
    refreshTokenEnc: text('refresh_token_enc'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    scopes: text('scopes'),
    // Gmail incremental-sync cursor. Captured at the end of every sync
    // pass; the next pass asks Google for changes "since X" instead of
    // re-listing the whole inbox. Nullable = no Gmail sync ever ran.
    gmailHistoryId: text('gmail_history_id'),
    gmailSyncedAt: timestamp('gmail_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    providerIdx: uniqueIndex('oauth_accounts_provider_idx').on(t.provider, t.providerAccountId),
    userIdx: index('oauth_accounts_user_idx').on(t.userId),
  })
);

// ─── Universal Inbox ─────────────────────────────────────────────
// External messages that landed somewhere the user cares about:
// Gmail today, Outlook/Slack/Teams later. Internal app notifications
// keep living in the `notifications` table — these two systems will
// eventually feed the same "Inbox" page, but we keep them separate
// at the schema layer so each source can evolve its own dedup rules.
export const inboxSourceTypeEnum = pgEnum('inbox_source_type', [
  'email_gmail',
  'email_outlook',
  'slack',
  'calendar_invite',
]);

export const inboxItems = pgTable(
  'inbox_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceType: inboxSourceTypeEnum('source_type').notNull(),
    // Dedup key — Gmail message id, Slack ts, etc. Unique with sourceType
    // so the same string from two sources doesn't collide.
    sourceId: text('source_id').notNull(),
    sourceThreadId: text('source_thread_id'),
    senderName: text('sender_name').notNull(),
    senderEmail: text('sender_email'),
    subject: text('subject'),
    preview: text('preview'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    isRead: boolean('is_read').notNull().default(false),
    isArchived: boolean('is_archived').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    // Snooze is local-only — Gmail's native snooze requires user-chooser
    // dialogs we don't want to reproduce. Items with snoozed_until in the
    // future are hidden from the foyer stack; when the timestamp passes,
    // the next foyer query naturally surfaces them again. No cron needed.
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    // Forward-looking semantic threading — fill when we can resolve
    // the message to a known entity (customer, project, todo).
    relatedEntityType: varchar('related_entity_type', { length: 32 }),
    relatedEntityId: uuid('related_entity_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sourceDedup: uniqueIndex('inbox_items_source_dedup_idx').on(
      t.sourceType,
      t.sourceId
    ),
    workspaceListIdx: index('inbox_items_workspace_list_idx').on(
      t.workspaceId,
      t.receivedAt
    ),
    unreadIdx: index('inbox_items_unread_idx').on(
      t.workspaceId,
      t.isRead,
      t.isArchived
    ),
  })
);

export const inboxItemsRelations = relations(inboxItems, ({ one }) => ({
  workspace: one(workspaces, { fields: [inboxItems.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [inboxItems.userId], references: [users.id] }),
}));

// ─── OAuth pending states ────────────────────────────────────────
// Holds the PKCE verifier + nonce + redirect target between /start and
// /callback. Rows are short-lived (10 minutes) and one-time-use — the
// callback deletes the row regardless of outcome.
export const oauthStates = pgTable(
  'oauth_states',
  {
    state: varchar('state', { length: 64 }).primaryKey(),
    provider: varchar('provider', { length: 32 }).notNull(),
    codeVerifier: varchar('code_verifier', { length: 128 }).notNull(),
    nonce: varchar('nonce', { length: 64 }).notNull(),
    redirectTo: text('redirect_to').notNull().default('/'),
    origin: text('origin').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    expiresIdx: index('oauth_states_expires_idx').on(t.expiresAt),
  })
);

// ─── Marketing waitlist (ctrlk.de landing) ───────────────────────
// Pre-launch waitlist signups. Not linked to workspaces/users yet —
// people sign up before they have either.
export const waitlistSignups = pgTable(
  'waitlist_signups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    source: text('source'),
    ipHash: varchar('ip_hash', { length: 32 }),
    userAgent: text('user_agent'),
    confirmToken: varchar('confirm_token', { length: 64 }),
    tokenSentAt: timestamp('token_sent_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex('waitlist_email_idx').on(t.email),
    ipHashIdx: index('waitlist_iphash_idx').on(t.ipHash, t.createdAt),
    tokenIdx: uniqueIndex('waitlist_token_idx').on(t.confirmToken),
  })
);
