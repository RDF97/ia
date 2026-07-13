import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ── Núcleo multi-tenant ────────────────────────────────────────────────

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull().default("Europe/Madrid"),
  locale: text("locale").notNull().default("es"),
  currency: text("currency").notNull().default("EUR"),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    role: text("role", { enum: ["owner", "admin", "staff"] }).notNull().default("staff"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("memberships_org_user").on(t.orgId, t.userId)],
);

// ── Cuentas de correo conectadas ───────────────────────────────────────

export const emailAccounts = pgTable("email_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  provider: text("provider", { enum: ["gmail"] }).notNull().default("gmail"),
  emailAddress: text("email_address").notNull(),
  // refresh token cifrado con AES-256-GCM (clave en TOKEN_ENCRYPTION_KEY)
  refreshTokenEnc: text("refresh_token_enc"),
  lastHistoryId: text("last_history_id"),
  syncStatus: text("sync_status", { enum: ["active", "error", "revoked"] })
    .notNull()
    .default("active"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Configuración operativa: playas, productos, franjas ────────────────

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  locationId: uuid("location_id").notNull().references(() => locations.id),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["tour", "private"] }).notNull().default("tour"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const timeSlots = pgTable("time_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  locationId: uuid("location_id").notNull().references(() => locations.id),
  productId: uuid("product_id").references(() => products.id),
  startTime: time("start_time").notNull(),
  defaultCapacity: integer("default_capacity").notNull().default(12),
  active: boolean("active").notNull().default(true),
});

// Instancia materializada franja+fecha; se crea al asignar la primera
// reserva del día o al abrir el cuadro (lazy).
export const departures = pgTable(
  "departures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    timeSlotId: uuid("time_slot_id").notNull().references(() => timeSlots.id),
    locationId: uuid("location_id").notNull().references(() => locations.id),
    productId: uuid("product_id").references(() => products.id),
    date: date("date").notNull(),
    startTime: time("start_time").notNull(),
    capacityOverride: integer("capacity_override"),
    isDouble: boolean("is_double").notNull().default(false),
    status: text("status", { enum: ["scheduled", "cancelled"] }).notNull().default("scheduled"),
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("departures_org_date_slot").on(t.orgId, t.date, t.timeSlotId),
    index("departures_org_date").on(t.orgId, t.date),
  ],
);

// ── Emails crudos ──────────────────────────────────────────────────────

export const rawEmails = pgTable(
  "raw_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    emailAccountId: uuid("email_account_id").references(() => emailAccounts.id),
    gmailMessageId: text("gmail_message_id").notNull(),
    gmailThreadId: text("gmail_thread_id"),
    fromAddress: text("from_address"),
    subject: text("subject"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    bodyHtml: text("body_html"),
    bodyText: text("body_text"),
    detectedSource: text("detected_source", {
      enum: ["getyourguide", "bokun_viator", "unknown"],
    }),
    detectedKind: text("detected_kind", {
      enum: ["new", "cancellation", "amendment", "other"],
    }),
    parseStatus: text("parse_status", {
      enum: ["pending", "parsed", "failed", "ignored", "manual_resolved"],
    })
      .notNull()
      .default("pending"),
    parseError: text("parse_error"),
    parsedPayload: jsonb("parsed_payload"),
    bookingId: uuid("booking_id"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("raw_emails_org_gmail_id").on(t.orgId, t.gmailMessageId),
    index("raw_emails_org_status").on(t.orgId, t.parseStatus),
  ],
);

// ── Reservas (unificadas: email + manual) ──────────────────────────────

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    departureId: uuid("departure_id").references(() => departures.id),
    source: text("source", { enum: ["getyourguide", "bokun_viator", "manual"] }).notNull(),
    channel: text("channel"),
    externalRef: text("external_ref"),
    externalRefSecondary: text("external_ref_secondary"),
    status: text("status", {
      enum: ["confirmed", "cancelled", "amended", "pending_review"],
    })
      .notNull()
      .default("confirmed"),
    // Fecha/hora de la actividad en hora LOCAL de la org (no UTC).
    activityDate: date("activity_date").notNull(),
    activityTime: time("activity_time"),
    productId: uuid("product_id").references(() => products.id),
    locationId: uuid("location_id").references(() => locations.id),
    rawProductName: text("raw_product_name"),
    paxAdults: integer("pax_adults").notNull().default(0),
    paxChildren: integer("pax_children").notNull().default(0),
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    customerCountry: text("customer_country"),
    customerLanguage: text("customer_language"),
    priceAmount: numeric("price_amount", { precision: 10, scale: 2 }),
    priceCurrency: text("price_currency").default("EUR"),
    paymentKind: text("payment_kind", { enum: ["platform", "cash", "pending"] })
      .notNull()
      .default("platform"),
    cashAmount: numeric("cash_amount", { precision: 10, scale: 2 }),
    cashConfirmed: boolean("cash_confirmed").notNull().default(false),
    pickupHotel: text("pickup_hotel"),
    notes: text("notes"),
    sourceEmailId: uuid("source_email_id").references(() => rawEmails.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("bookings_org_source_ref").on(t.orgId, t.source, t.externalRef),
    index("bookings_org_date").on(t.orgId, t.activityDate),
  ],
);

// ── Motor de mapeo: producto parseado → producto/playa/franja ──────────

export const mappingRules = pgTable(
  "mapping_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    priority: integer("priority").notNull().default(100),
    source: text("source", { enum: ["getyourguide", "bokun_viator"] }),
    matchField: text("match_field", {
      enum: ["raw_product_name", "subject"],
    })
      .notNull()
      .default("raw_product_name"),
    matchType: text("match_type", { enum: ["contains", "regex", "equals"] })
      .notNull()
      .default("contains"),
    matchValue: text("match_value").notNull(),
    timeMatch: time("time_match"),
    targetProductId: uuid("target_product_id").notNull().references(() => products.id),
    targetLocationId: uuid("target_location_id").notNull().references(() => locations.id),
    targetTimeSlotId: uuid("target_time_slot_id").references(() => timeSlots.id),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("mapping_rules_org_priority").on(t.orgId, t.priority)],
);

// ── Caja del día ───────────────────────────────────────────────────────

export const cashEntries = pgTable(
  "cash_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    date: date("date").notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id),
    concept: text("concept").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }),
    kind: text("kind", { enum: ["booking_cash", "adjustment", "expense"] })
      .notNull()
      .default("booking_cash"),
    confirmed: boolean("confirmed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cash_entries_org_date").on(t.orgId, t.date)],
);

// ── Suscripciones de notificaciones push (Web Push / PWA) ──────────────

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    userId: uuid("user_id").references(() => users.id),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint").on(t.endpoint)],
);

export type Org = typeof orgs.$inferSelect;
export type User = typeof users.$inferSelect;
export type EmailAccount = typeof emailAccounts.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Product = typeof products.$inferSelect;
export type TimeSlot = typeof timeSlots.$inferSelect;
export type Departure = typeof departures.$inferSelect;
export type RawEmail = typeof rawEmails.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type MappingRule = typeof mappingRules.$inferSelect;
export type CashEntry = typeof cashEntries.$inferSelect;
