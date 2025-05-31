/**
 * API Routes Configuration
 *
 * This module defines all backend API endpoints for the application.
 * It handles:
 * - User authentication and session management
 * - Post creation, retrieval, updating, and deletion
 * - Comment functionality including text selection comments
 * - Firebase admin integration for token verification
 * - Request validation using schema definitions
 * - Error handling and appropriate HTTP responses
 */

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import path from "path"; // <--- Ensure this is here
import { fileURLToPath } from 'url'; // <--- Ensure this is here
import express from 'express'; // <--- Ensure this is here for the production block

import { insertPostSchema, insertCommentSchema, insertUserSchema } from "@shared/schema";
import * as admin from "firebase-admin";
import { cert } from "firebase-admin/app";
import session from "express-session";
import MemoryStore from "memorystore";

import { IStorage } from './storage';
import type { Alias } from 'vite'; // <--- ADD THIS IMPORT for the Alias type

// Define types at the top level
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Define __dirname for ES module context (needed for path.resolve)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseAdminConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "",
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
};

// Only initialize if we have the necessary config
let firebaseAdminApp: admin.app.App | undefined; // Use a more specific type
if (firebaseAdminConfig.projectId && firebaseAdminConfig.clientEmail && firebaseAdminConfig.privateKey) {
  try {
    // Check if an app is already initialized to avoid re-initialization errors in hot-reloading dev environments
    firebaseAdminApp = admin.app('default');
  } catch (error) {
    // If no app is found, initialize a new one
    firebaseAdminApp = admin.initializeApp({
      credential: cert(firebaseAdminConfig as any),
    }, 'default'); // Name the app to prevent conflicts if you have multiple
  }
} else {
  console.warn("Firebase Admin credentials not fully configured. Some authentication features may be disabled in production.");
}

// Get the auth service from the initialized admin app
const adminAuth = firebaseAdminApp ? admin.auth(firebaseAdminApp) : undefined;


// Authentication middleware
// This authenticateUser now takes 'storage' as an argument
const authenticateUser = async (req: Request, res: Response, next: Function, storage: IStorage) => { // <<< ADD storage here
  try {
    // IMPORTANT: Review session-based authentication if you're fully moving to Firebase Auth tokens.
    // If you plan to rely solely on Firebase ID tokens from the frontend,
    // the `req.session.userId` logic here might be redundant or could be simplified.
    // For now, I'm keeping it largely as is, but be aware of the implications.

    // If there's a session with a userId, use that
    // NOTE: user.id is now string in Firestore
    if (req.session.userId) {
      const user = await storage.getUser(req.session.userId); // userId is now string
      if (user) {
        req.user = user;
        return next();
      }
    }

    // Return unauthorized in production if no Firebase Admin is configured
    if (!adminAuth && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ message: 'Authentication required: Firebase Admin not configured.' });
    }
    if (!adminAuth) { // In development, allow bypass if admin isn't configured, or return error
      console.warn("Firebase Admin Auth not initialized. Bypassing authentication in development.");
      // For development, you might want a dummy user or just let it pass
      // return res.status(401).json({ message: 'Authentication required' }); // Or uncomment this for strict dev auth
      // Dummy user for dev if you allow bypassing:
      req.user = { id: "dev-user-id", uid: "dev-uid", displayName: "Dev User", email: "dev@example.com", photoURL: "" };
      return next();
    }


    // Otherwise, check Firebase Auth token from headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Invalid token format' });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
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

    // Store the Firestore-generated user ID (string) in the session
    req.session.userId = user.id; // user.id is now string
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
};

// registerRoutes now accepts the storage instance
export async function registerRoutes(app: Express, storage: IStorage): Promise<Server> {
  // Set up session middleware
  const MemoryStoreSession = MemoryStore(session);
  app.use(session({
    secret: process.env.SESSION_SECRET || 'ribbattimes-secret',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStoreSession({
      checkPeriod: 86400000
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  }));

  // *** ADD VITE DEVELOPMENT SERVER MIDDLEWARE HERE ***
  if (process.env.NODE_ENV === 'development') {
    const vite = await import('vite'); // Dynamically import vite

    // Define aliases explicitly here, matching your vite.config.ts
    // These paths are relative to the *project root* where the aliases conceptually map to.
    const aliases: Alias[] = [
      { find: '@', replacement: path.resolve(__dirname, '..', 'client', 'src') },
      { find: '@shared', replacement: path.resolve(__dirname, '..', 'shared') },
    ];

    const viteDevServer = await vite.createServer({
      root: path.resolve(__dirname, '..', 'client'), // Vite's root for client-side assets
      server: {
        middlewareMode: true, // Let Express handle middleware
      },
      // Explicitly pass the resolve.alias configuration to the Vite dev server
      resolve: {
        alias: aliases,
      },
    });

    app.use(viteDevServer.middlewares);

    // Serve HTML for all non-API requests (catch-all for SPA)
    // This must come AFTER your API routes.
    app.use('*', async (req, res, next) => {
      // If the request is for an API route, let it pass to the next middleware (your API handlers)
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }

      // Handle all other requests by serving the client's index.html
      try {
        const url = req.originalUrl;
        let html = await viteDevServer.transformIndexHtml(url, path.resolve(__dirname, '..', 'client', 'index.html'));
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e: any) {
        // If an error occurs (e.g., during HMR), Vite can fix the stacktrace
        viteDevServer.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    // Production build serving
    app.use(express.static(path.resolve(__dirname, '..', 'dist', 'public')));

    // Catch-all to serve index.html for any unhandled routes (SPA fallback)
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, '..', 'dist', 'public', 'index.html'));
    });
  }
  // *** END VITE INTEGRATION ***

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { uid, displayName, email, photoURL } = req.body;
      if (!uid || !email) {
        return res.status(400).json({ message: 'Invalid user data' });
      }

      let user = await storage.getUserByUid(uid);

      if (!user) {
        const userData = { uid, displayName: displayName || 'Anonymous', email, photoURL: photoURL || '' };
        const validatedData = insertUserSchema.parse(userData);
        user = await storage.createUser(validatedData);
        console.log('Created new user with Google profile:', user);
      } else {
        const updatedData = {
          displayName: displayName || user.displayName,
          email: email || user.email,
          photoURL: photoURL || user.photoURL,
        };
        if (updatedData.displayName !== user.displayName || updatedData.email !== user.email || updatedData.photoURL !== user.photoURL) {
          user = await storage.updateUser(user.id, updatedData) || user;
          console.log('User profile information updated from Google:', user.displayName, user.photoURL);
        }
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
      const user = await storage.getUser(req.session.userId); // userId is now string
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ message: 'Failed to get current user' });
    }
  });

  // Get all users for the Doigs on Payroll page
  app.get('/api/users', async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      console.log(`Returning ${users.length} users`);

      res.status(200).json(users);
    } catch (error) {
      console.error('Error fetching all users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Posts routes
  app.get('/api/posts', async (req, res) => {
    try {
      const posts = await storage.getAllPosts();

      console.log('All posts with draft status:', posts.map(p => ({ id: p.id, title: p.title, isDraft: p.isDraft })));

      // Filter out drafts for the main posts listing - ensure boolean comparison works
      const publishedPosts = posts.filter(post => post.isDraft !== true);

      console.log('Published posts after filtering:', publishedPosts.map(p => ({ id: p.id, title: p.title, isDraft: p.isDraft })));

      // Get author details and comment counts for each post
      const postsWithAuthors = await Promise.all(publishedPosts.map(async (post) => {
        const author = await storage.getUser(post.authorId); // authorId is now string
        // In Firestore, commentCount is directly on the post document
        return {
          ...post,
          author: author || { displayName: 'Unknown', email: '', photoURL: '' },
          // The commentCount should now come from the post object itself, not a separate query
          // If a post doesn't have commentCount, default to 0
          commentCount: post.commentCount ?? 0
        };
      }));

      res.json(postsWithAuthors);
    } catch (error) {
      console.error('Get posts error:', error);
      res.status(500).json({ message: 'Failed to retrieve posts' });
    }
  });

  // Get current user profile information
  app.get('/api/profile', (req, res, next) => authenticateUser(req, res, next, storage), async (req, res) => { // <<< PASS storage to middleware
    try {
      const user = await storage.getUser(req.user.id); // req.user.id is string
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
      const userId = req.params.userId; // userId is now string
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
      const userId = req.params.userId; // userId is now string
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const posts = await storage.getPostsByAuthor(userId);

      console.log('User posts before processing:', posts.map(p => ({id: p.id, title: p.title, isDraft: p.isDraft})));

      // Get author details and comment counts for each post
      const postsWithAuthors = await Promise.all(posts.map(async (post) => {
        // Comment count should be directly on the post for Firestore
        // const comments = await storage.getCommentsByPostId(post.id); // No longer needed
        const normalizedPost = {
          ...post,
          isDraft: post.isDraft === true, // Normalize to boolean
          author: {
            id: user.id, // user.id is string
            displayName: user.displayName,
            photoURL: user.photoURL,
            email: user.email,
            uid: user.uid
          },
          commentCount: post.commentCount ?? 0 // Get from post object
        };

        return normalizedPost;
      }));

      res.json(postsWithAuthors);
    } catch (error) {
      console.error('Get user posts error:', error);
      res.status(500).json({ message: 'Failed to retrieve user posts' });
    }
  });

  app.get('/api/posts/:id', async (req, res) => {
    try {
      const postId = req.params.id; // postId is now string
      console.log(`Workspaceing post with ID: ${postId}`);

      const post = await storage.getPost(postId);
      console.log('Post retrieved from storage:', post ? 'Found' : 'Not found');

      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      const author = await storage.getUser(post.authorId); // authorId is string
      console.log('Author retrieved:', author ? author.displayName : 'Not found');

      // The commentCount should now come from the post object itself, not a separate query
      // const comments = await storage.getCommentsByPostId(postId); // No longer needed
      // console.log(`Retrieved ${comments.length} comments for the post`); // No longer needed

      // Make sure we have complete author data
      let authorData;
      if (author) {
        authorData = {
          id: author.id,
          uid: author.uid,
          displayName: author.displayName,
          email: author.email,
          photoURL: author.photoURL
        };
      } else {
        // Provide default values matching the User type for consistency
        authorData = {
          id: '', // Firestore IDs are strings
          uid: '',
          displayName: 'Unknown Author',
          email: '',
          photoURL: ''
        };
      }

      const responseData = {
        ...post,
        author: authorData,
        commentCount: post.commentCount ?? 0 // Get from post object
      };

      console.log('Responding with post data:', {
        id: responseData.id,
        title: responseData.title,
        authorName: responseData.author?.displayName,
        createdAt: responseData.createdAt,
        contentLength: responseData.content?.length || 0
      });

      res.json(responseData);
    } catch (error) {
      console.error('Get post error:', error);
      res.status(500).json({ message: 'Failed to retrieve post' });
    }
  });

  app.post('/api/posts', (req, res, next) => authenticateUser(req, res, next, storage), async (req, res) => { // <<< PASS storage to middleware
    try {
      const postData = req.body;
      console.log('Creating post with data:', {
        title: postData.title,
        isDraft: postData.isDraft,
        body_length: postData.content?.length || 0
      });

      const validatedData = insertPostSchema.parse(postData);

      // Ensure we're storing a proper boolean for isDraft
      const isDraftValue = postData.isDraft === true;

      // Create post with the current user as author
      const post = await storage.createPost({
        ...validatedData,
        authorId: req.user.id, // req.user.id is string
        isDraft: isDraftValue,
        lastSavedAt: isDraftValue ? new Date() : null
      });

      console.log('Post created with isDraft:', isDraftValue);

      // Comment count is initialized by FirestoreStorage.createPost to 0
      // Return complete post with author and comment count, ensuring isDraft is a proper boolean
      res.status(201).json({
        ...post,
        isDraft: isDraftValue,
        author: {
          id: req.user.id, // req.user.id is string
          displayName: req.user.displayName,
          email: req.user.email,
          photoURL: req.user.photoURL,
          uid: req.user.uid
        },
        commentCount: post.commentCount // Should be 0
      });
    } catch (error) {
      console.error('Create post error:', error);
      res.status(400).json({ message: 'Invalid post data' });
    }
  });

  app.patch('/api/posts/:id', (req, res, next) => authenticateUser(req, res, next, storage), async (req, res) => { // <<< PASS storage to middleware
    try {
      const postId = req.params.id; // postId is now string
      const existingPost = await storage.getPost(postId);

      if (!existingPost) {
        return res.status(404).json({ message: 'Post not found' });
      }

      if (existingPost.authorId !== req.user.id) { // authorId and req.user.id are strings
        return res.status(403).json({ message: 'You do not have permission to edit this post' });
      }

      const postData = req.body;

      // Update lastSavedAt if this is a draft
      if (postData.isDraft) {
        postData.lastSavedAt = new Date();
      }

      const updatedPost = await storage.updatePost(postId, postData);

      // The commentCount should now come from the updatedPost object itself
      if (!updatedPost) {
        return res.status(500).json({ message: 'Failed to update post' });
      }
      res.json({
        ...updatedPost,
        author: {
          id: req.user.id, // req.user.id is string
          displayName: req.user.displayName,
          email: req.user.email,
          photoURL: req.user.photoURL,
          uid: req.user.uid
        },
        commentCount: updatedPost.commentCount ?? 0
      });
    } catch (error) {
      console.error('Update post error:', error);
      res.status(400).json({ message: 'Invalid post data' });
    }
  });

  // Special endpoint for auto-saving drafts
  app.post('/api/posts/:id/autosave', (req, res, next) => authenticateUser(req, res, next, storage), async (req, res) => { // <<< PASS storage to middleware
    try {
      const postId = req.params.id; // postId is string
      const existingPost = await storage.getPost(postId);

      if (!existingPost) {
        return res.status(404).json({ message: 'Post not found' });
      }

      if (existingPost.authorId !== req.user.id) { // authorId and req.user.id are strings
        return res.status(403).json({ message: 'You do not have permission to edit this post' });
      }

      const postData = req.body;

      console.log('Autosaving post:', postId, 'setting isDraft=true');

      // Always set draft flag and update lastSavedAt for autosaves
      const updatedPost = await storage.updatePost(postId, {
        ...postData,
        isDraft: true,
        lastSavedAt: new Date()
      });

      if (!updatedPost) {
        return res.status(500).json({ message: 'Failed to save draft' });
      }

      res.json({
        ...updatedPost,
        isDraft: true, // Ensure it's explicitly set in the response
        author: {
          id: req.user.id, // req.user.id is string
          displayName: req.user.displayName,
          email: req.user.email,
          photoURL: req.user.photoURL,
          uid: req.user.uid
        },
        commentCount: updatedPost.commentCount ?? 0 // Get from updatedPost
      });
    } catch (error) {
      console.error('Autosave draft error:', error);
      res.status(400).json({ message: 'Failed to save draft' });
    }
  });

  // Get drafts for the current user
  app.get('/api/drafts', (req, res, next) => authenticateUser(req, res, next, storage), async (req, res) => { // <<< PASS storage to middleware
    try {
      const posts = await storage.getPostsByAuthor(req.user.id); // req.user.id is string

      // Filter to only include drafts
      const drafts = posts.filter(post => post.isDraft);

      // Transform to include author info
      const draftsWithAuthor = await Promise.all(drafts.map(async (draft) => {
        // Comment count should be directly on the post for Firestore
        // const comments = await storage.getCommentsByPostId(draft.id); // No longer needed
        return {
          ...draft,
          author: {
            id: req.user.id, // req.user.id is string
            displayName: req.user.displayName,
            email: req.user.email,
            photoURL: req.user.photoURL,
            uid: req.user.uid
          },
          commentCount: draft.commentCount ?? 0 // Get from draft object
        };
      }));

      res.json(draftsWithAuthor);
    } catch (error) {
      console.error('Get drafts error:', error);
      res.status(500).json({ message: 'Failed to retrieve drafts' });
    }
  });

  app.delete('/api/posts/:id', (req, res, next) => authenticateUser(req, res, next, storage), async (req, res) => { // <<< PASS storage to middleware
    try {
      const postId = req.params.id; // postId is string
      const post = await storage.getPost(postId);

      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      if (post.authorId !== req.user.id) { // authorId and req.user.id are strings
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

  app.post('/api/posts/:postId/comments', (req, res, next) => authenticateUser(req, res, next, storage), async (req, res) => { // <<< PASS storage to middleware
    try {
      const postId = req.params.postId; // postId is string
      const post = await storage.getPost(postId);

      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      const commentData = {
        ...req.body,
        postId // postId is string
      };

      const validatedData = insertCommentSchema.parse(commentData);

      const comment = await storage.createComment({
        ...validatedData,
        authorId: req.user.id // req.user.id is string
      });

      const author = await storage.getUser(comment.authorId); // comment.authorId is string

      res.status(201).json({
        ...comment,
        author: author || { displayName: 'Unknown', email: '', photoURL: '' }
      });
    } catch (error) {
      console.error('Create comment error:', error);
      res.status(400).json({ message: 'Invalid comment data' });
    }
  });

  // Get comments for a specific post
  app.get('/api/posts/:postId/comments', async (req, res) => {
    try {
      const postId = req.params.postId; // postId is string
      console.log(`Workspaceing comments for post ID: ${postId}`);

      // Verify the post exists
      const post = await storage.getPost(postId);
      if (!post) {
        console.log(`Post ${postId} not found, cannot fetch comments`);
        return res.status(404).json({ message: 'Post not found' });
      }

      // Get comments for this post only
      const comments = await storage.getCommentsByPostId(postId);
      console.log(`Retrieved ${comments.length} comments for post ${postId}`);

      // Enrich with author information
      const enrichedComments = await Promise.all(comments.map(async (comment) => {
        const author = await storage.getUser(comment.authorId); // comment.authorId is string
        return {
          ...comment,
          author: author || { displayName: 'Unknown', email: '', photoURL: '' }
        };
      }));

      res.json(enrichedComments);
    } catch (error) {
      console.error(`Error fetching comments for post ${req.params.postId}:`, error);
      res.status(500).json({ message: 'Failed to retrieve comments' });
    }
  });

  // Get replies for a specific comment
  app.get('/api/comments/:id/replies', async (req, res) => {
    try {
      const commentId = req.params.id; // commentId is string
      const comment = await storage.getComment(commentId);

      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      const replies = await storage.getCommentReplies(commentId);

      // Enrich with author information
      const enrichedReplies = await Promise.all(replies.map(async (reply) => {
        const author = await storage.getUser(reply.authorId); // reply.authorId is string
        return {
          ...reply,
          author: author || { displayName: 'Unknown', email: '', photoURL: '' }
        };
      }));

      res.json(enrichedReplies);
    } catch (error) {
      console.error(`Error fetching replies for comment ${req.params.id}:`, error);
      res.status(500).json({ message: 'Failed to retrieve replies' });
    }
  });

  // Update a comment
  app.patch('/api/comments/:id', (req, res, next) => authenticateUser(req, res, next, storage), async (req, res) => { // <<< PASS storage to middleware
    try {
      const commentId = req.params.id; // commentId is string
      const comment = await storage.getComment(commentId);

      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      if (comment.authorId !== req.user.id) { // authorId and req.user.id are strings
        return res.status(403).json({ message: 'You do not have permission to edit this comment' });
      }

      const { content } = req.body;
      const updatedComment = await storage.updateComment(commentId, { content });

      // Get the author to include in the response
      const author = await storage.getUser(req.user.id); // req.user.id is string

      res.json({
        ...updatedComment,
        author: author || { displayName: 'Unknown', email: '', photoURL: '' }
      });
    } catch (error) {
      console.error('Update comment error:', error);
      res.status(500).json({ message: 'Failed to update comment' });
    }
  });

  // Delete a comment
  app.delete('/api/comments/:id', (req, res, next) => authenticateUser(req, res, next, storage), async (req, res) => { // <<< PASS storage to middleware
    try {
      const commentId = req.params.id; // commentId is string
      const comment = await storage.getComment(commentId);

      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      if (comment.authorId !== req.user.id) { // authorId and req.user.id are strings
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
