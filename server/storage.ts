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
    
    // Create sample user
    const sampleUser: User = {
      id: this.userId++,
      uid: "sample-user-uid",
      displayName: "Eleanor Worthington",
      email: "eleanor@example.com",
      photoURL: "https://randomuser.me/api/portraits/women/32.jpg",
      createdAt: new Date().toISOString()
    };
    this.usersData.set(sampleUser.id, sampleUser);
    
    // Create sample post for May 2025
    const samplePost: Post = {
      id: this.postId++,
      title: "The Decline of Traditional Print Media in the Digital Age",
      content: `<h2>A Shifting Landscape</h2>
      <p>As we approach the mid-2020s, the transformation of traditional print journalism continues unabated. Newspapers and magazines that once dominated the media landscape have given way to digital platforms, social media news sources, and citizen journalism.</p>
      <p>The venerable institutions that once served as the primary sources of news and commentary have been forced to adapt or face extinction. Many have chosen hybrid models, maintaining limited print operations while focusing increasingly on their digital presence.</p>
      <h2>Economic Realities</h2>
      <p>The economic model that sustained print journalism for centuries—based on advertising revenue and subscriptions—has been upended by the internet. Classified advertising, once a reliable profit center for newspapers, has largely migrated to online platforms.</p>
      <p>Display advertising, while still present in print publications, commands a fraction of its former rates. The abundance of digital advertising space has driven down costs across the board, leaving traditional publications struggling to maintain profitability.</p>
      <h2>Quality and Trust</h2>
      <p>Perhaps the most concerning aspect of this transition is the impact on journalistic quality and public trust. The economic pressures on traditional media outlets have led to staff reductions, decreased investigative reporting, and in some cases, a shift toward more sensationalistic coverage to attract readers.</p>
      <p>While digital-native news sources have introduced innovations in reporting and presentation, the ecosystem as a whole has become more fragmented and polarized. The shared experience of consuming news from a common set of sources has given way to highly personalized information streams that often reinforce existing beliefs rather than challenging them.</p>
      <h2>The Path Forward</h2>
      <p>Yet there are reasons for optimism. Some publications have successfully reinvented themselves for the digital age, finding new revenue streams through digital subscriptions, events, and specialized content. Others have embraced nonprofit models, supported by foundations and reader contributions.</p>
      <p>The hunger for reliable information and thoughtful analysis remains strong, suggesting that the core functions of journalism will endure even as its form evolves. The challenge for the industry—and for society—is to ensure that these functions continue to be fulfilled in ways that serve the public interest.</p>`,
      authorId: sampleUser.id,
      author: sampleUser,
      createdAt: "2025-05-01T10:00:00.000Z",
      updatedAt: "2025-05-01T10:00:00.000Z",
      tags: ["Media", "Journalism", "Digital Transformation"],
      commentCount: 0
    };
    this.postsData.set(samplePost.id, samplePost);
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
