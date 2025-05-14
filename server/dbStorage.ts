import { users, posts, comments, type User, type InsertUser, type Post, type InsertPost, type Comment, type InsertComment } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // User operations
  async getAllUsers(): Promise<User[]> {
    // Get all users for the Doigs on Payroll page
    const allUsers = await db.select()
      .from(users)
      .orderBy(desc(users.createdAt));
      
    return allUsers;
  }
  
  // Comment replies operations - needed for Google Docs functionality
  async getCommentReplies(commentId: number): Promise<Comment[]> {
    const commentReplies = await db.select()
      .from(comments)
      .where(eq(comments.parentId, commentId))
      .orderBy(comments.createdAt);
      
    // Enrich with author data
    const repliesWithAuthors = await Promise.all(commentReplies.map(async (reply) => {
      const [author] = await db.select()
        .from(users)
        .where(eq(users.id, reply.authorId));
        
      return {...reply, author};
    }));
    
    return repliesWithAuthors;
  }
  
  // Update comment - needed for Google Docs functionality
  async updateComment(id: number, commentData: Partial<Comment>): Promise<Comment | undefined> {
    // First check if the comment exists
    const [existingComment] = await db.select()
      .from(comments)
      .where(eq(comments.id, id));
      
    if (!existingComment) {
      return undefined;
    }
    
    // Set isEdited to true if updating content
    if (commentData.content) {
      commentData.isEdited = true;
    }
    
    // Update the comment
    const [updatedComment] = await db.update(comments)
      .set({ 
        ...commentData,
        updatedAt: new Date() 
      })
      .where(eq(comments.id, id))
      .returning();
      
    // Get author data
    const [author] = await db.select()
      .from(users)
      .where(eq(users.id, updatedComment.authorId));
      
    return {...updatedComment, author};
  }
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUid(uid: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.uid, uid));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    // Find the user first to make sure it exists
    const existingUser = await this.getUser(id);
    if (!existingUser) {
      return undefined;
    }
    
    // Update the user in the database
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
      
    return updatedUser;
  }

  // Post operations
  async getPost(id: number): Promise<Post | undefined> {
    const [post] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, id));
    
    if (post) {
      // Get the author information
      const [author] = await db
        .select()
        .from(users)
        .where(eq(users.id, post.authorId));
      
      return {
        ...post,
        author
      } as Post;
    }
    
    return undefined;
  }

  async getAllPosts(): Promise<Post[]> {
    const allPosts = await db
      .select()
      .from(posts)
      .orderBy(desc(posts.createdAt));
    
    // Get all author ids
    const authorIds = [...new Set(allPosts.map(post => post.authorId))];
    
    // Fetch all authors in one query
    const authors = await db
      .select()
      .from(users)
      .where(
        authorIds.length > 0
          ? (users.id, "in", authorIds)
          : undefined
      );
    
    // Create a map of author ids to author objects
    const authorMap = new Map();
    authors.forEach(author => {
      authorMap.set(author.id, author);
    });
    
    // Add author to each post
    return allPosts.map(post => ({
      ...post,
      author: authorMap.get(post.authorId) || {
        id: 0,
        uid: 'unknown',
        displayName: 'Unknown',
        email: '',
        photoURL: ''
      }
    }));
  }

  async getPostsByAuthor(authorId: number): Promise<Post[]> {
    const authorPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.authorId, authorId))
      .orderBy(desc(posts.createdAt));
    
    // Get the author information once
    const [author] = await db
      .select()
      .from(users)
      .where(eq(users.id, authorId));
    
    // Add author to each post
    return authorPosts.map(post => ({
      ...post,
      author: author || {
        id: 0,
        uid: 'unknown',
        displayName: 'Unknown',
        email: '',
        photoURL: ''
      }
    }));
  }

  async createPost(postData: InsertPost & { authorId: number }): Promise<Post> {
    const [post] = await db
      .insert(posts)
      .values(postData)
      .returning();
    
    // Get the author information
    const [author] = await db
      .select()
      .from(users)
      .where(eq(users.id, post.authorId));
    
    return {
      ...post,
      author
    } as Post;
  }

  async updatePost(id: number, postData: Partial<Post>): Promise<Post | undefined> {
    const [updatedPost] = await db
      .update(posts)
      .set({ 
        ...postData,
        updatedAt: new Date()
      })
      .where(eq(posts.id, id))
      .returning();
    
    if (updatedPost) {
      // Get the author information
      const [author] = await db
        .select()
        .from(users)
        .where(eq(users.id, updatedPost.authorId));
      
      return {
        ...updatedPost,
        author
      } as Post;
    }
    
    return undefined;
  }

  async deletePost(id: number): Promise<boolean> {
    const [deletedPost] = await db
      .delete(posts)
      .where(eq(posts.id, id))
      .returning();
    
    return !!deletedPost;
  }

  // Comment operations
  async getComment(id: number): Promise<Comment | undefined> {
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, id));
    
    if (comment) {
      // Get the author information
      const [author] = await db
        .select()
        .from(users)
        .where(eq(users.id, comment.authorId));
      
      return {
        ...comment,
        author
      } as Comment;
    }
    
    return undefined;
  }

  async getCommentsByPostId(postId: number): Promise<Comment[]> {
    const postComments = await db
      .select()
      .from(comments)
      .where(eq(comments.postId, postId));
    
    // Get all author ids
    const authorIds = [...new Set(postComments.map(comment => comment.authorId))];
    
    // Fetch all authors in one query
    const authors = await db
      .select()
      .from(users)
      .where(
        authorIds.length > 0
          ? (users.id, "in", authorIds)
          : undefined
      );
    
    // Create a map of author ids to author objects
    const authorMap = new Map();
    authors.forEach(author => {
      authorMap.set(author.id, author);
    });
    
    // Add author to each comment
    return postComments.map(comment => ({
      ...comment,
      author: authorMap.get(comment.authorId) || {
        id: 0,
        uid: 'unknown',
        displayName: 'Unknown',
        email: '',
        photoURL: ''
      }
    }));
  }

  async createComment(commentData: InsertComment & { authorId: number }): Promise<Comment> {
    // Create the comment
    const [comment] = await db
      .insert(comments)
      .values(commentData)
      .returning();
    
    // Increment the comment count on the post
    await db
      .update(posts)
      .set({
        commentCount: (posts) => posts.commentCount ? posts.commentCount + 1 : 1
      })
      .where(eq(posts.id, comment.postId));
    
    // Get the author information
    const [author] = await db
      .select()
      .from(users)
      .where(eq(users.id, comment.authorId));
    
    return {
      ...comment,
      author
    } as Comment;
  }

  async deleteComment(id: number): Promise<boolean> {
    // Get the comment to get its post id
    const [commentToDelete] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, id));
    
    if (!commentToDelete) {
      return false;
    }
    
    // Delete the comment
    const [deletedComment] = await db
      .delete(comments)
      .where(eq(comments.id, id))
      .returning();
    
    if (deletedComment) {
      // Decrement the comment count on the post
      await db
        .update(posts)
        .set({
          commentCount: (posts) => posts.commentCount ? posts.commentCount - 1 : 0
        })
        .where(eq(posts.id, commentToDelete.postId));
      
      return true;
    }
    
    return false;
  }
}