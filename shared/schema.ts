/**
 * Database Schema Definitions
 * 
 * This module defines the database structure for the entire application.
 * It includes:
 * - Table definitions for users, posts, and comments
 * - Schema validation using Zod for data integrity
 * - Type definitions used throughout the application
 * - Relationship definitions between tables
 * - Special fields for Google Docs-style comment functionality
 */

import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase UID
  displayName: text("display_name").notNull(),
  email: text("email").notNull(),
  photoURL: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

// Posts table
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: integer("author_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  tags: text("tags").array(), // Array of tags
  isDraft: boolean("is_draft").default(false), // Whether the post is a draft
  lastSavedAt: timestamp("last_saved_at"), // When the draft was last auto-saved
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  lastSavedAt: true,
});

// Comments table
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  authorId: integer("author_id").references(() => users.id).notNull(),
  postId: integer("post_id").references(() => posts.id).notNull(),
  elementId: text("element_id"), // The ID of the HTML element this comment is attached to
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // New fields for Google Docs-style comments
  selectedText: text("selected_text"), // The text that was selected when the comment was created
  selectionStart: integer("selection_start"), // The start position of the selection in the content
  selectionEnd: integer("selection_end"), // The end position of the selection in the content
  // Fields for threaded replies
  parentId: integer("parent_id").references(() => comments.id), // If this is a reply, the ID of the parent comment
  isEdited: boolean("is_edited").default(false).notNull(), // Track if a comment has been edited
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  isEdited: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
