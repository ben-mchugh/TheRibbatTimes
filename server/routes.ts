import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPostSchema, insertCommentSchema, insertUserSchema } from "@shared/schema";
import * as admin from "firebase-admin";
import { initializeApp as initializeAdminApp, cert } from "firebase-admin/app";
import session from "express-session";
import MemoryStore from "memorystore";

// Define types at the top level
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Initialize Firebase Admin
const firebaseAdminConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "",
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
};

// Only initialize if we have the necessary config
let firebaseAdmin: any;
if (firebaseAdminConfig.projectId && firebaseAdminConfig.clientEmail && firebaseAdminConfig.privateKey) {
  firebaseAdmin = initializeAdminApp({
    credential: cert(firebaseAdminConfig as any),
  });
}

// Authentication middleware
const authenticateUser = async (req: Request, res: Response, next: Function) => {
  try {
    // Check if user is authenticated through session
    if (req.session.userId) {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        req.user = user;
        return next();
      }
    }

    // If no Firebase Admin, return unauthorized in production
    if (!firebaseAdmin && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // For development without Firebase Admin, create a personalized user
    if (!firebaseAdmin && process.env.NODE_ENV === 'development') {
      // Create a more personalized user experience
      let personalUser = await storage.getUserByUid('personal-user');
      if (!personalUser) {
        personalUser = await storage.createUser({
          uid: 'personal-user',
          displayName: 'Ribbat Reader',
          email: 'reader@ribbattimes.com',
          photoURL: 'https://i.pravatar.cc/150?u=ribbattimes',
        });
      }
      req.session.userId = personalUser.id;
      req.user = personalUser;
      return next();
    }

    // Otherwise, check Firebase Auth
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Invalid token format' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    
    let user = await storage.getUserByUid(uid);
    
    if (!user) {
      // User doesn't exist in our database yet, create them
      user = await storage.createUser({
        uid,
        displayName: decodedToken.name || 'Anonymous',
        email: decodedToken.email || '',
        photoURL: decodedToken.picture || '',
      });
    }
    
    req.session.userId = user.id;
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up session middleware
  const MemoryStoreSession = MemoryStore(session);
  app.use(session({
    secret: process.env.SESSION_SECRET || 'ribbattimes-secret',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStoreSession({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { uid, displayName, email, photoURL } = req.body;
      
      if (!uid || !email) {
        return res.status(400).json({ message: 'Invalid user data' });
      }
      
      let user = await storage.getUserByUid(uid);
      
      if (!user) {
        const userData = {
          uid,
          displayName: displayName || 'Anonymous',
          email,
          photoURL: photoURL || '',
        };
        
        const validatedData = insertUserSchema.parse(userData);
        user = await storage.createUser(validatedData);
      }
      
      req.session.userId = user.id;
      
      res.json({ message: 'Logged in successfully', user });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });
  
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });
  
  // Current user
  app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ message: 'Failed to get current user' });
    }
  });

  // Posts routes
  app.get('/api/posts', async (req, res) => {
    try {
      const posts = await storage.getAllPosts();
      
      // Get author details and comment counts for each post
      const postsWithAuthors = await Promise.all(posts.map(async (post) => {
        const author = await storage.getUser(post.authorId);
        const comments = await storage.getCommentsByPostId(post.id);
        
        return {
          ...post,
          author: author || { displayName: 'Unknown', email: '', photoURL: '' },
          commentCount: comments.length
        };
      }));
      
      res.json(postsWithAuthors);
    } catch (error) {
      console.error('Get posts error:', error);
      res.status(500).json({ message: 'Failed to retrieve posts' });
    }
  });

  // Get current user profile information
  app.get('/api/profile', authenticateUser, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ message: 'Failed to retrieve profile' });
    }
  });
  
  // Get user by ID (for public profiles)
  app.get('/api/users/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Don't expose sensitive information in public user profiles
      res.json({
        id: user.id,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Failed to retrieve user' });
    }
  });
  
  // Get posts by a specific author
  app.get('/api/users/:userId/posts', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const posts = await storage.getPostsByAuthor(userId);
      
      // Get author details and comment counts for each post
      const postsWithAuthors = await Promise.all(posts.map(async (post) => {
        const comments = await storage.getCommentsByPostId(post.id);
        
        return {
          ...post,
          author: {
            id: user.id,
            displayName: user.displayName,
            photoURL: user.photoURL,
            email: user.email,
            uid: user.uid
          },
          commentCount: comments.length
        };
      }));
      
      res.json(postsWithAuthors);
    } catch (error) {
      console.error('Get user posts error:', error);
      res.status(500).json({ message: 'Failed to retrieve user posts' });
    }
  });

  app.get('/api/posts/:id', async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      const post = await storage.getPost(postId);
      
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }
      
      const author = await storage.getUser(post.authorId);
      const comments = await storage.getCommentsByPostId(postId);
      
      res.json({
        ...post,
        author: author || { displayName: 'Unknown', email: '', photoURL: '' },
        commentCount: comments.length
      });
    } catch (error) {
      console.error('Get post error:', error);
      res.status(500).json({ message: 'Failed to retrieve post' });
    }
  });

  app.post('/api/posts', authenticateUser, async (req, res) => {
    try {
      const postData = req.body;
      const validatedData = insertPostSchema.parse(postData);
      
      const post = await storage.createPost({
        ...validatedData,
        authorId: req.user.id
      });
      
      res.status(201).json(post);
    } catch (error) {
      console.error('Create post error:', error);
      res.status(400).json({ message: 'Invalid post data' });
    }
  });

  app.patch('/api/posts/:id', authenticateUser, async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      const existingPost = await storage.getPost(postId);
      
      if (!existingPost) {
        return res.status(404).json({ message: 'Post not found' });
      }
      
      if (existingPost.authorId !== req.user.id) {
        return res.status(403).json({ message: 'You do not have permission to edit this post' });
      }
      
      const postData = req.body;
      const updatedPost = await storage.updatePost(postId, postData);
      
      res.json(updatedPost);
    } catch (error) {
      console.error('Update post error:', error);
      res.status(400).json({ message: 'Invalid post data' });
    }
  });

  app.delete('/api/posts/:id', authenticateUser, async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      const post = await storage.getPost(postId);
      
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }
      
      if (post.authorId !== req.user.id) {
        return res.status(403).json({ message: 'You do not have permission to delete this post' });
      }
      
      await storage.deletePost(postId);
      res.json({ message: 'Post deleted successfully' });
    } catch (error) {
      console.error('Delete post error:', error);
      res.status(500).json({ message: 'Failed to delete post' });
    }
  });

  // Comments routes
  app.get('/api/posts/:postId/comments', async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      const comments = await storage.getCommentsByPostId(postId);
      
      // Get author details for each comment
      const commentsWithAuthors = await Promise.all(comments.map(async (comment) => {
        const author = await storage.getUser(comment.authorId);
        return {
          ...comment,
          author: author || { displayName: 'Unknown', email: '', photoURL: '' }
        };
      }));
      
      res.json(commentsWithAuthors);
    } catch (error) {
      console.error('Get comments error:', error);
      res.status(500).json({ message: 'Failed to retrieve comments' });
    }
  });

  app.post('/api/posts/:postId/comments', authenticateUser, async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      const post = await storage.getPost(postId);
      
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }
      
      const commentData = {
        ...req.body,
        postId
      };
      
      const validatedData = insertCommentSchema.parse(commentData);
      
      const comment = await storage.createComment({
        ...validatedData,
        authorId: req.user.id
      });
      
      const author = await storage.getUser(comment.authorId);
      
      res.status(201).json({
        ...comment,
        author: author || { displayName: 'Unknown', email: '', photoURL: '' }
      });
    } catch (error) {
      console.error('Create comment error:', error);
      res.status(400).json({ message: 'Invalid comment data' });
    }
  });

  app.delete('/api/comments/:id', authenticateUser, async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const comment = await storage.getComment(commentId);
      
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      
      if (comment.authorId !== req.user.id) {
        return res.status(403).json({ message: 'You do not have permission to delete this comment' });
      }
      
      await storage.deleteComment(commentId);
      res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
      console.error('Delete comment error:', error);
      res.status(500).json({ message: 'Failed to delete comment' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
