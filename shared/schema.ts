// Keep Drizzle imports for schema definition if you still use Drizzle for migrations or other tools,
// but the actual types will be manually defined for Firestore compatibility.
import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod"; // This will become less relevant for Firestore inserts
import { z } from "zod";

// --- Drizzle Schemas (for reference/migrations, if still needed) ---
// You can keep these if you want to maintain Drizzle for other purposes (e.g., local mock DB, migrations).
// However, the types derived below (`export type User = ...`) will override the Drizzle inference for runtime.

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    uid: text("uid").notNull().unique(), // Firebase UID
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    photoURL: text("photo_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const posts = pgTable("posts", {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    authorId: integer("author_id").references(() => users.id).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    tags: text("tags").array(),
    isDraft: boolean("is_draft").default(false),
    lastSavedAt: timestamp("last_saved_at"),
    // Add commentCount here conceptually, even if not in Drizzle PG schema
    // commentCount: integer("comment_count").default(0), // Would be in PG, but here for Firestore
});

export const comments = pgTable("comments", {
    id: serial("id").primaryKey(),
    content: text("content").notNull(),
    authorId: integer("author_id").references(() => users.id).notNull(),
    postId: integer("post_id").references(() => posts.id).notNull(),
    elementId: text("element_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    selectedText: text("selected_text"),
    selectionStart: integer("selection_start"),
    selectionEnd: integer("selection_end"),
    parentId: integer("parent_id").references(() => comments.id),
    isEdited: boolean("is_edited").default(false).notNull(),
});

// --- Zod Schemas (Adjusted for Firestore insertion) ---
// For Firestore, `createInsertSchema` won't directly map because Firestore generates IDs.
// We'll define Zod schemas that align with the `Insert` types needed for Firestore.

export const userSchema = z.object({
  id: z.string(), // Firestore ID is string
  uid: z.string(),
  displayName: z.string(),
  email: z.string(),
  photoURL: z.string().optional().nullable(),
  createdAt: z.date(), // Dates will be Date objects in JS, stored as Timestamps in Firestore
  updatedAt: z.date(),
});

// For inserting, omit the Firestore-generated 'id' and auto-generated timestamps
export const insertUserSchema = userSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const postSchema = z.object({
  id: z.string(), // Firestore ID is string
  title: z.string(),
  content: z.string(),
  authorId: z.string(), // Foreign key is now string (Firestore User ID)
  createdAt: z.date(),
  updatedAt: z.date(),
  tags: z.array(z.string()).optional().nullable(), // Tags can be an array of strings
  isDraft: z.boolean().default(false),
  lastSavedAt: z.date().optional().nullable(),
  commentCount: z.number().int().min(0).default(0), // Added for Firestore
  author: userSchema.optional(), // For enriched data, not stored in DB
});

export const insertPostSchema = postSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  commentCount: true, // Will be set to 0 initially by FirestoreStorage
  author: true, // Not part of insertion payload
});

export const commentSchema = z.object({
  id: z.string(), // Firestore ID is string
  content: z.string(),
  authorId: z.string(), // Foreign key is now string (Firestore User ID)
  postId: z.string(), // Foreign key is now string (Firestore Post ID)
  elementId: z.string().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  selectedText: z.string().optional().nullable(),
  selectionStart: z.number().int().optional().nullable(),
  selectionEnd: z.number().int().optional().nullable(),
  parentId: z.string().optional().nullable(), // Foreign key is now string (Firestore Comment ID)
  isEdited: z.boolean().default(false),
  author: userSchema.optional(), // For enriched data, not stored in DB
});

export const insertCommentSchema = commentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isEdited: true, // Will be set to false initially by FirestoreStorage
  author: true, // Not part of insertion payload
});

// --- TypeScript Types for your Application ---
// These are the types your frontend and FirestoreStorage will use.

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Post = z.infer<typeof postSchema>;
export type InsertPost = z.infer<typeof insertPostSchema>;

export type Comment = z.infer<typeof commentSchema>;
export type InsertComment = z.infer<typeof insertCommentSchema>;
