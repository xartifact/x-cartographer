import {
  bigserial,
  boolean,
  pgTable,
  text,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { adrRecords } from "./adr-records";

/** Append-only review evidence. Resolutions are events, never edits to an opinion. */
export const adrReviewEvents = pgTable("adr_review_events", {
  id: text("id").primaryKey(),
  adrId: text("adr_id")
    .notNull()
    .references(() => adrRecords.id, { onDelete: "cascade" }),
  kind: text("kind").$type<"comment" | "reply" | "resolve">().notNull(),
  commentId: text("comment_id").references((): AnyPgColumn => adrReviewEvents.id, {
    onDelete: "cascade",
  }),
  target: text("target"),
  body: text("body").notNull(),
  blocking: boolean("blocking").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  seq: bigserial("seq", { mode: "number" }).notNull(),
});
