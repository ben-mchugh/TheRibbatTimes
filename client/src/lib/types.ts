export interface User {
  id: number;
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  createdAt?: string; // Added for Doigs on Payroll page
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
  updatedAt?: string;
  elementId?: string; // The ID of the HTML element this comment is attached to
  selectedText?: string; // The text that was selected when the comment was created
  selectionStart?: number; // The start position of the selection in the content
  selectionEnd?: number; // The end position of the selection in the content
  parentId?: number | null; // ID of the parent comment if this is a reply
  isEdited?: boolean; // Whether this comment has been edited
}

export interface CommentWithPosition extends Comment {
  targetText: string;
  targetPosition: string; // Selector or position information for the target text
}
