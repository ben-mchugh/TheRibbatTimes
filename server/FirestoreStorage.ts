import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  increment, // For commentCount!
  writeBatch // For atomic operations like deleting comments and updating post count
} from "firebase/firestore";

import { db } from "../client/src/firebase"; // Adjust path to your firebase.ts file

import {
  type User,
  type InsertUser,
  type Post,
  type InsertPost,
  type Comment,
  type InsertComment,
} from "@shared/schema"; // Ensure these types now reflect string IDs for 'id' fields

import { IStorage } from "./storage";

// Define your collection names for clarity
const USERS_COLLECTION = "users";
const POSTS_COLLECTION = "posts";
const COMMENTS_COLLECTION = "comments";

// Helper to convert Firestore DocumentSnapshot to your type
// Assumes that 'id' in your schema types is now 'string'
const docToType = <T extends { id: string }>(docSnap: any): T | undefined => {
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as T;
  }
  return undefined;
};

// Helper to convert multiple Firestore DocumentSnapshots to your type array
const docsToTypeArray = <T extends { id: string }>(querySnapshot: any): T[] => {
  const data: T[] = [];
  querySnapshot.forEach((docSnap: any) => {
    data.push({ id: docSnap.id, ...docSnap.data() } as T);
  });
  return data;
};

export class FirestoreStorage implements IStorage {
  // --- User Operations ---

  // getUser(id: number) will now expect 'id' to be a string Firestore Document ID
  // If your SQL 'id' was a number, you need to ensure it's converted to string
  // when you use it to lookup documents.
  async getUser(id: string): Promise<User | undefined> {
    const userDocRef = doc(db, USERS_COLLECTION, id); // id is now expected to be string
    const userSnap = await getDoc(userDocRef);
    return docToType<User>(userSnap);
  }

  async getUserByUid(uid: string): Promise<User | undefined> {
    const q = query(collection(db, USERS_COLLECTION), where("uid", "==", uid), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return docToType<User>(querySnapshot.docs[0]);
    }
    return undefined;
  }

  async getAllUsers(): Promise<User[]> {
    const usersCol = collection(db, USERS_COLLECTION);
    const q = query(usersCol, orderBy("createdAt", "desc")); // Assuming createdAt field
    const userSnapshot = await getDocs(q);
    return docsToTypeArray<User>(userSnapshot);
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUserRef = await addDoc(collection(db, USERS_COLLECTION), {
      ...user,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const createdUserSnap = await getDoc(newUserRef);
    if (!createdUserSnap.exists()) {
      throw new Error("Failed to create user: document not found after creation.");
    }
    return { id: createdUserSnap.id, ...createdUserSnap.data() } as User;
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User | undefined> {
    const userDocRef = doc(db, USERS_COLLECTION, id);
    await updateDoc(userDocRef, {
      ...userData,
      updatedAt: new Date(),
    });
    const updatedUserSnap = await getDoc(userDocRef);
    return docToType<User>(updatedUserSnap);
  }

  // --- Post Operations ---

  async getPost(id: string): Promise<Post | undefined> {
    const postDocRef = doc(db, POSTS_COLLECTION, id);
    const postSnap = await getDoc(postDocRef);
    const post = docToType<Post>(postSnap);

    if (post) {
      // Enrich with author data - NoSQL equivalent of a join
      const author = await this.getUser(post.authorId); // authorId is now expected to be a string
      return {
        ...post,
        author: author || { id: 'unknown', uid: 'unknown', displayName: 'Unknown', email: '', photoURL: '' }
      } as Post;
    }
    return undefined;
  }

  async getAllPosts(): Promise<Post[]> {
    const postsCol = collection(db, POSTS_COLLECTION);
    const q = query(postsCol, orderBy("createdAt", "desc"));
    const postSnapshot = await getDocs(q);
    const allPosts = docsToTypeArray<Post>(postSnapshot);

    // Get all unique author IDs for batch lookup
    const authorIds = [...new Set(allPosts.map(post => post.authorId))];

    // Fetch authors in one go (or multiple if many)
    // Firestore `in` query has a limit of 10. If you have more, you need multiple queries.
    // For simplicity, assuming a reasonable number of authors per page/query.
    let authors: User[] = [];
    if (authorIds.length > 0) {
        const authorQuery = query(collection(db, USERS_COLLECTION), where("id", "in", authorIds));
        const authorSnapshot = await getDocs(authorQuery);
        authors = docsToTypeArray<User>(authorSnapshot);
    }
    const authorMap = new Map<string, User>();
    authors.forEach(author => authorMap.set(author.id, author));

    // Add author to each post
    return allPosts.map(post => ({
      ...post,
      author: authorMap.get(post.authorId) || { id: 'unknown', uid: 'unknown', displayName: 'Unknown', email: '', photoURL: '' }
    }));
  }

  async getPostsByAuthor(authorId: string): Promise<Post[]> { // authorId is now string
    const q = query(
      collection(db, POSTS_COLLECTION),
      where("authorId", "==", authorId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    const authorPosts = docsToTypeArray<Post>(querySnapshot);

    // Get the author information once
    const author = await this.getUser(authorId);

    return authorPosts.map(post => ({
      ...post,
      author: author || { id: 'unknown', uid: 'unknown', displayName: 'Unknown', email: '', photoURL: '' }
    }));
  }

  async createPost(postData: InsertPost & { authorId: string }): Promise<Post> { // authorId is now string
    const newPostRef = await addDoc(collection(db, POSTS_COLLECTION), {
      ...postData,
      createdAt: new Date(),
      updatedAt: new Date(),
      commentCount: 0 // Initialize comment count
    });
    const createdPostSnap = await getDoc(newPostRef);
    if (!createdPostSnap.exists()) {
      throw new Error("Failed to create post: document not found after creation.");
    }
    const createdPost = { id: createdPostSnap.id, ...createdPostSnap.data() } as Post;

    // Get the author information
    const author = await this.getUser(createdPost.authorId);

    return {
      ...createdPost,
      author: author || { id: 'unknown', uid: 'unknown', displayName: 'Unknown', email: '', photoURL: '' }
    } as Post;
  }

  async updatePost(id: string, postData: Partial<Post>): Promise<Post | undefined> {
    const postDocRef = doc(db, POSTS_COLLECTION, id);
    await updateDoc(postDocRef, {
      ...postData,
      updatedAt: new Date(),
    });
    const updatedPostSnap = await getDoc(postDocRef);
    const updatedPost = docToType<Post>(updatedPostSnap);

    if (updatedPost) {
      // Get the author information
      const author = await this.getUser(updatedPost.authorId);
      return {
        ...updatedPost,
        author: author || { id: 'unknown', uid: 'unknown', displayName: 'Unknown', email: '', photoURL: '' }
      } as Post;
    }
    return undefined;
  }

  async deletePost(id: string): Promise<boolean> {
    try {
      // You might want to delete associated comments here using a batch write for atomicity
      // (This will involve another query for comments by postId, then batch.delete them)
      // For now, simple delete:
      await deleteDoc(doc(db, POSTS_COLLECTION, id));
      return true;
    } catch (error) {
      console.error("Error deleting post:", error);
      return false;
    }
  }

  // --- Comment Operations ---

  async getComment(id: string): Promise<Comment | undefined> {
    const commentDocRef = doc(db, COMMENTS_COLLECTION, id);
    const commentSnap = await getDoc(commentDocRef);
    const comment = docToType<Comment>(commentSnap);

    if (comment) {
      const author = await this.getUser(comment.authorId);
      return {
        ...comment,
        author: author || { id: 'unknown', uid: 'unknown', displayName: 'Unknown', email: '', photoURL: '' }
      } as Comment;
    }
    return undefined;
  }

  async getCommentsByPostId(postId: string): Promise<Comment[]> { // postId is now string
    const q = query(
      collection(db, COMMENTS_COLLECTION),
      where("postId", "==", postId),
      orderBy("createdAt", "asc")
    );
    const querySnapshot = await getDocs(q);
    const postComments = docsToTypeArray<Comment>(querySnapshot);

    // Get all unique author IDs for batch lookup
    const authorIds = [...new Set(postComments.map(comment => comment.authorId))];

    let authors: User[] = [];
    if (authorIds.length > 0) {
        const authorQuery = query(collection(db, USERS_COLLECTION), where("id", "in", authorIds));
        const authorSnapshot = await getDocs(authorQuery);
        authors = docsToTypeArray<User>(authorSnapshot);
    }
    const authorMap = new Map<string, User>();
    authors.forEach(author => authorMap.set(author.id, author));

    return postComments.map(comment => ({
      ...comment,
      author: authorMap.get(comment.authorId) || { id: 'unknown', uid: 'unknown', displayName: 'Unknown', email: '', photoURL: '' }
    }));
  }

  async getCommentReplies(commentId: string): Promise<Comment[]> { // commentId is now string
    const q = query(
      collection(db, COMMENTS_COLLECTION),
      where("parentId", "==", commentId),
      orderBy("createdAt", "asc")
    );
    const querySnapshot = await getDocs(q);
    const commentReplies = docsToTypeArray<Comment>(querySnapshot);

    // Enrich with author data for replies
    const authorIds = [...new Set(commentReplies.map(reply => reply.authorId))];
    let authors: User[] = [];
    if (authorIds.length > 0) {
        const authorQuery = query(collection(db, USERS_COLLECTION), where("id", "in", authorIds));
        const authorSnapshot = await getDocs(authorQuery);
        authors = docsToTypeArray<User>(authorSnapshot);
    }
    const authorMap = new Map<string, User>();
    authors.forEach(author => authorMap.set(author.id, author));

    return commentReplies.map(reply => ({
      ...reply,
      author: authorMap.get(reply.authorId) || { id: 'unknown', uid: 'unknown', displayName: 'Unknown', email: '', photoURL: '' }
    }));
  }

  async createComment(commentData: InsertComment & { authorId: string }): Promise<Comment> { // authorId is now string
    const batch = writeBatch(db); // Use batch for atomicity

    const newCommentRef = doc(collection(db, COMMENTS_COLLECTION)); // Get a new doc ref with auto-generated ID
    batch.set(newCommentRef, {
      ...commentData,
      createdAt: new Date(),
      updatedAt: new Date(),
      isEdited: false // Initialize
    });

    // Increment the comment count on the post
    const postRef = doc(db, POSTS_COLLECTION, commentData.postId); // postId is now string
    batch.update(postRef, {
      commentCount: increment(1)
    });

    await batch.commit(); // Commit both operations atomically

    const createdCommentSnap = await getDoc(newCommentRef);
    if (!createdCommentSnap.exists()) {
        throw new Error("Failed to create comment: document not found after creation.");
    }
    const createdComment = { id: createdCommentSnap.id, ...createdCommentSnap.data() } as Comment;

    // Get the author information
    const author = await this.getUser(createdComment.authorId);

    return {
      ...createdComment,
      author: author || { id: 'unknown', uid: 'unknown', displayName: 'Unknown', email: '', photoURL: '' }
    } as Comment;
  }

  async updateComment(id: string, commentData: Partial<Comment>): Promise<Comment | undefined> {
    const commentDocRef = doc(db, COMMENTS_COLLECTION, id);
    const existingCommentSnap = await getDoc(commentDocRef); // Get existing to check if it exists
    if (!existingCommentSnap.exists()) {
        return undefined;
    }

    const updatePayload: Partial<Comment> & { updatedAt: Date, isEdited?: boolean } = {
        ...commentData,
        updatedAt: new Date()
    };

    // Set isEdited to true if updating content, mimicking your SQL logic
    if (commentData.content !== undefined && commentData.content !== existingCommentSnap.data()?.content) {
        updatePayload.isEdited = true;
    }

    await updateDoc(commentDocRef, updatePayload);
    const updatedCommentSnap = await getDoc(commentDocRef);
    const updatedComment = docToType<Comment>(updatedCommentSnap);

    if (updatedComment) {
      const author = await this.getUser(updatedComment.authorId);
      return {
        ...updatedComment,
        author: author || { id: 'unknown', uid: 'unknown', displayName: 'Unknown', email: '', photoURL: '' }
      } as Comment;
    }
    return undefined;
  }

  async deleteComment(id: string): Promise<boolean> {
    const commentDocRef = doc(db, COMMENTS_COLLECTION, id);
    const commentSnap = await getDoc(commentDocRef);

    if (!commentSnap.exists()) {
      return false; // Comment doesn't exist
    }

    const commentToDelete = docToType<Comment>(commentSnap);
    if (!commentToDelete) return false;

    const batch = writeBatch(db);

    // Delete the comment
    batch.delete(commentDocRef);

    // Decrement the comment count on the post
    if (commentToDelete.postId) {
        const postRef = doc(db, POSTS_COLLECTION, commentToDelete.postId);
        batch.update(postRef, {
            commentCount: increment(-1)
        });
    }

    try {
      await batch.commit(); // Commit both operations atomically
      return true;
    } catch (error) {
      console.error("Error deleting comment and updating post count:", error);
      return false;
    }
  }
}