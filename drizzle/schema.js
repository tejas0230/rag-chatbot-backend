import { pgTable, serial, text, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";
import * as t from "drizzle-orm/pg-core";


export const aiMode = pgEnum("ai_mode", ["platform", "byok"]);
export const providerEnum = pgEnum("provider", ["openai", "anthropic", "google"]);
export const planEnum = pgEnum("plan", ["free_trial", "pro", "pro_plus"]);
export const statusEnum = pgEnum("status", ["active", "inactive", "trialing", "past_due", "canceled", "unpaid", "expired"]);
export const billingIntervalEnum = pgEnum("billing_interval", ["month", "year"]);
export const sourceTypeEnum = pgEnum("source_type", ["url", "pdf", "docx", "txt", "csv"]);
export const sourceStatusEnum = pgEnum("source_status", ["pending", "processing", "ready", "deleting", "refreshing", "error"]);
export const jobTypeEnum = pgEnum("job_type", ["ingest", "delete", "refresh"]);
export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "done", "failed", "cancelled"]);
export const logLevelEnum = pgEnum("log_level", ["info", "warn", "error"]);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);



export const user = pgTable("user", {
	id: t.text("id").primaryKey(),
	name: t.text("name").notNull(),
	email: t.varchar("email", { length: 255 }).notNull().unique(),
	emailVerified: t.boolean("email_verified").notNull(),
	image: t.text("image"),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});

export const session = pgTable("session", {
	id: t.text("id").primaryKey(),
	userId: t.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	token: t.varchar("token", { length: 255 }).notNull().unique(),
	expiresAt: t.timestamp("expires_at", { precision: 6, withTimezone: true }).notNull(),
	ipAddress: t.text("ip_address"),
	userAgent: t.text("user_agent"),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});

export const account = pgTable("account", {
	id: t.text("id").primaryKey(),
	userId: t.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	accountId: t.text("account_id").notNull(),
	providerId: t.text("provider_id").notNull(),
	accessToken: t.text("access_token"),
	refreshToken: t.text("refresh_token"),
	accessTokenExpiresAt: t.timestamp("access_token_expires_at", { precision: 6, withTimezone: true }),
	refreshTokenExpiresAt: t.timestamp("refresh_token_expires_at", { precision: 6, withTimezone: true }),
	scope: t.text("scope"),
	idToken: t.text("id_token"),
	password: t.text("password"),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});


export const verification = pgTable("verification", {
	id: t.text("id").primaryKey(),
	identifier: t.text("identifier").notNull(),
	value: t.text("value").notNull(),
	expiresAt: t.timestamp("expires_at", { precision: 6, withTimezone: true }).notNull(),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});

export const project = pgTable("project", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: t.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	name: t.text("name").notNull(),
	description: t.text("description"),
	slug: t.text("slug").notNull().unique(),
	ai_mode: aiMode("ai_mode").notNull(),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});

export const api_keys = pgTable("api_keys", {
	id: uuid("id").defaultRandom().primaryKey(),
	projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
	provider: providerEnum("provider").notNull(),
	key_hash: t.text("key_hash").notNull(),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});

export const subscription = pgTable("subscription", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: t.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	plan: planEnum("plan").notNull(),
	planId: uuid("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
	status: statusEnum("status").notNull(),
	providerSubscriptionId: t.text("provider_subscription_id"),
	current_period_start: t.timestamp("current_period_start", { precision: 6, withTimezone: true }),
	current_period_end: t.timestamp("current_period_end", { precision: 6, withTimezone: true }),
	freeExpiresAt: t.timestamp("free_expires_at", { precision: 6, withTimezone: true }),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});

export const plans = pgTable("plans", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: t.text("name").notNull(),
	slug: t.text("slug").notNull().unique(),
	max_projects: t.integer("max_projects").notNull(),
	monthly_request_limit: t.integer("monthly_request_limit").notNull(),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});

export const plan_prices = pgTable("plan_prices", {
	id: uuid("id").defaultRandom().primaryKey(),
	planId: uuid("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
	polar_product_id: t.text("polar_product_id").notNull(),
	interval: billingIntervalEnum("interval").notNull(),
	price: t.numeric("price"),
	checkout_url: t.text("checkout_url"),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});

export const project_usage = pgTable("project_usage", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: t.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
	is_byok: t.boolean("is_byok").notNull().default(false),
	request_count: t.integer("request_count").notNull().default(0),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});

export const source = pgTable("source", {
	id:               uuid("id").defaultRandom().primaryKey(),
	projectId:        uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
  
	type:             sourceTypeEnum("type").notNull(),
	name:             t.text("name").notNull(),
  
	// URL sources
	url:              t.text("url"),
	crawlDepth:       t.integer("crawl_depth").notNull().default(1),
  
	// File sources
	filePath:         t.text("file_path"),        // path in S3/R2
	fileSizeBytes:    t.bigint("file_size_bytes", { mode: "number" }),
	mimeType:         t.text("mime_type"),
	originalFilename: t.text("original_filename"),
  
	// State
	status:           sourceStatusEnum("status").notNull().default("pending"),
	chunkCount:       t.integer("chunk_count").notNull().default(0),
	errorMessage:     t.text("error_message"),
	lastIngestedAt:   t.timestamp("last_ingested_at", { precision: 6, withTimezone: true }),
  
	createdAt:        t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt:        t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
  });

  export const chunk = pgTable("chunk", {
	id:           uuid("id").defaultRandom().primaryKey(), // this IS the vector ID
	sourceId:     uuid("source_id").notNull().references(() => source.id, { onDelete: "cascade" }),
	projectId:    uuid("project_id").notNull(),            // denormalized for fast bulk deletes
	chunkIndex:   t.integer("chunk_index").notNull(),      // position within source
	chunkText:    t.text("chunk_text").notNull(),           // stored so you can re-embed without re-parsing
	tokenCount:   t.integer("token_count"),
  
	createdAt:    t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  }, (table) => [
	t.index("idx_chunk_source_id").on(table.sourceId),
	t.index("idx_chunk_project_id").on(table.projectId),
  ]);

  export const ingestionJob = pgTable("ingestion_job", {
	id:            uuid("id").defaultRandom().primaryKey(),
	sourceId:      uuid("source_id").notNull().references(() => source.id, { onDelete: "cascade" }),
  
	jobType:       jobTypeEnum("job_type").notNull().default("ingest"),
	status:        jobStatusEnum("status").notNull().default("queued"),
  
	// Progress — pages for URL crawls and PDFs, rows for CSVs
	pagesTotal:    t.integer("pages_total").notNull().default(0),
	pagesDone:     t.integer("pages_done").notNull().default(0),
  
	// Retry logic
	errorMessage:  t.text("error_message"),
	retryCount:    t.integer("retry_count").notNull().default(0),
	maxRetries:    t.integer("max_retries").notNull().default(3),
	nextRetryAt:   t.timestamp("next_retry_at", { precision: 6, withTimezone: true }),
  
	startedAt:     t.timestamp("started_at", { precision: 6, withTimezone: true }),
	finishedAt:    t.timestamp("finished_at", { precision: 6, withTimezone: true }),
	createdAt:     t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  }, (table) => [
	t.index("idx_ingestion_job_source_id").on(table.sourceId),
	t.index("idx_ingestion_job_status").on(table.status),
  ]);