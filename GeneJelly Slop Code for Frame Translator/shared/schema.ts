import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  twitterHandle: text("twitter_handle").notNull(),
});

export const insights = pgTable("insights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  description: text("description").notNull(),
  lifeExperiences: jsonb("life_experiences").$type<string[]>().notNull(),
  concepts: jsonb("concepts").$type<string[]>().notNull(),
  subcultures: jsonb("subcultures").$type<string[]>().notNull(),
  writingStyle: text("writing_style").notNull(),
  lastUpdated: timestamp("last_updated").notNull(),
});

export const comparisons = pgTable("comparisons", {
  id: serial("id").primaryKey(),
  userAId: integer("user_a_id").references(() => users.id),
  userBId: integer("user_b_id").references(() => users.id),
  argumentText: text("argument_text").notNull(),
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const insertUserSchema = createInsertSchema(users);
export const insertInsightSchema = createInsertSchema(insights);
export const insertComparisonSchema = createInsertSchema(comparisons);

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Insight = typeof insights.$inferSelect;
export type InsertInsight = z.infer<typeof insertInsightSchema>;
export type Comparison = typeof comparisons.$inferSelect;
export type InsertComparison = z.infer<typeof insertComparisonSchema>;
