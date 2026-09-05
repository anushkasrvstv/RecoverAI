import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const payments = mysqlTable("payments", {
  id: varchar("id", { length: 32 }).primaryKey(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  amount: int("amount").notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("INR"),
  paymentMethod: varchar("paymentMethod", { length: 100 }).notNull(),
  failureCode: varchar("failureCode", { length: 64 }).notNull(),
  failureReason: varchar("failureReason", { length: 120 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  priorityScore: int("priorityScore").notNull(),
  recommendedAction: varchar("recommendedAction", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["PENDING", "RECOVERED", "FAILED_AGAIN", "REVIEWED"]).default("PENDING").notNull(),
  retryCount: int("retryCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const decisions = mysqlTable("decisions", {
  id: int("id").autoincrement().primaryKey(),
  paymentId: varchar("paymentId", { length: 32 }).notNull(),
  matchedRule: varchar("matchedRule", { length: 64 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  priority: int("priority").notNull(),
  reason: text("reason").notNull(),
  aiUsed: int("aiUsed").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  paymentId: varchar("paymentId", { length: 32 }).notNull(),
  message: text("message").notNull(),
  tone: varchar("tone", { length: 32 }).notNull(),
  language: varchar("language", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  paymentId: varchar("paymentId", { length: 32 }).notNull(),
  event: varchar("event", { length: 120 }).notNull(),
  details: text("details").notNull(),
  aiUsed: int("aiUsed").default(0).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const recoveryAttempts = mysqlTable("recoveryAttempts", {
  id: int("id").autoincrement().primaryKey(),
  paymentId: varchar("paymentId", { length: 32 }).notNull(),
  attemptNumber: int("attemptNumber").notNull(),
  kind: varchar("kind", { length: 32 }).notNull(),
  outcome: varchar("outcome", { length: 32 }).notNull(),
  details: text("details").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const messageTemplates = mysqlTable("messageTemplates", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  failureCode: varchar("failureCode", { length: 64 }).notNull(),
  tone: varchar("tone", { length: 32 }).notNull(),
  language: varchar("language", { length: 32 }).notNull(),
  body: text("body").notNull(),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
