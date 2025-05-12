export interface User {
  id: number;
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

export interface Post {
  id: number;
  title: string;
  content: string;
  authorId: number;
  author: User;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  commentCount: number;
}

export interface Comment {
  id: number;
  content: string;
  authorId: number;
  author: User;
  postId: number;
  createdAt: string;
  elementId: string; // The ID of the HTML element this comment is attached to
}

export interface CommentWithPosition extends Comment {
  targetText: string;
  targetPosition: string; // Selector or position information for the target text
}
