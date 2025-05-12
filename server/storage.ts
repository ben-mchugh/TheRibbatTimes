import { users, posts, comments, type User, type InsertUser, type Post, type InsertPost, type Comment, type InsertComment } from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUid(uid: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Post operations
  getPost(id: number): Promise<Post | undefined>;
  getAllPosts(): Promise<Post[]>;
  createPost(post: InsertPost & { authorId: number }): Promise<Post>;
  updatePost(id: number, post: Partial<Post>): Promise<Post | undefined>;
  deletePost(id: number): Promise<boolean>;
  
  // Comment operations
  getComment(id: number): Promise<Comment | undefined>;
  getCommentsByPostId(postId: number): Promise<Comment[]>;
  createComment(comment: InsertComment & { authorId: number }): Promise<Comment>;
  deleteComment(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private usersData: Map<number, User>;
  private postsData: Map<number, Post>;
  private commentsData: Map<number, Comment>;
  private userId: number;
  private postId: number;
  private commentId: number;

  constructor() {
    this.usersData = new Map();
    this.postsData = new Map();
    this.commentsData = new Map();
    this.userId = 1;
    this.postId = 1;
    this.commentId = 1;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.usersData.get(id);
  }

  async getUserByUid(uid: string): Promise<User | undefined> {
    return Array.from(this.usersData.values()).find(user => user.uid === uid);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { 
      ...userData, 
      id,
      createdAt: new Date().toISOString() 
    };
    this.usersData.set(id, user);
    return user;
  }

  // Post operations
  async getPost(id: number): Promise<Post | undefined> {
    return this.postsData.get(id);
  }

  async getAllPosts(): Promise<Post[]> {
    return Array.from(this.postsData.values()).sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async createPost(postData: InsertPost & { authorId: number }): Promise<Post> {
    const id = this.postId++;
    const now = new Date().toISOString();
    const post: Post = {
      ...postData,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.postsData.set(id, post);
    return post;
  }

  async updatePost(id: number, postData: Partial<Post>): Promise<Post | undefined> {
    const post = this.postsData.get(id);
    if (!post) return undefined;

    const updatedPost: Post = {
      ...post,
      ...postData,
      updatedAt: new Date().toISOString()
    };
    this.postsData.set(id, updatedPost);
    return updatedPost;
  }

  async deletePost(id: number): Promise<boolean> {
    // Delete all comments for this post first
    for (const [commentId, comment] of this.commentsData.entries()) {
      if (comment.postId === id) {
        this.commentsData.delete(commentId);
      }
    }
    return this.postsData.delete(id);
  }

  // Comment operations
  async getComment(id: number): Promise<Comment | undefined> {
    return this.commentsData.get(id);
  }

  async getCommentsByPostId(postId: number): Promise<Comment[]> {
    return Array.from(this.commentsData.values())
      .filter(comment => comment.postId === postId)
      .sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }

  async createComment(commentData: InsertComment & { authorId: number }): Promise<Comment> {
    const id = this.commentId++;
    const comment: Comment = {
      ...commentData,
      id,
      createdAt: new Date().toISOString()
    };
    this.commentsData.set(id, comment);
    return comment;
  }

  async deleteComment(id: number): Promise<boolean> {
    return this.commentsData.delete(id);
  }
}

export const storage = new MemStorage();
