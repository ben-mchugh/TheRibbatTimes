import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Comment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ChevronLeft } from 'lucide-react';
import GoogleDocsComment from './GoogleDocsComment';

interface GoogleDocsCommentSectionProps {
  postId: number;
  comments: Comment[];
  isLoading: boolean;
  showComments: boolean;
  setShowComments: (show: boolean) => void;
  refetchComments: () => void;
  focusedCommentId: number | null;
}

const GoogleDocsCommentSection: React.FC<GoogleDocsCommentSectionProps> = ({
  postId,
  comments,
  isLoading,
  showComments,
  setShowComments,
  refetchComments,
  focusedCommentId
}) => {
  const [newComment, setNewComment] = useState('');
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectionData, setSelectionData] = useState<{
    start: number | null;
    end: number | null;
    text: string | null;
  }>({ start: null, end: null, text: null });
  
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const newCommentRef = useRef<HTMLTextAreaElement>(null);
  const commentsRef = useRef<HTMLDivElement>(null);
  
  // When focusedCommentId changes, scroll to that comment
  useEffect(() => {
    if (focusedCommentId && commentsRef.current) {
      const commentElement = commentsRef.current.querySelector(`[data-comment-id="${focusedCommentId}"]`);
      if (commentElement) {
        commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [focusedCommentId]);

  // Add new comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (comment: { 
      content: string; 
      selectedText?: string;
      selectionStart?: number;
      selectionEnd?: number;
    }) => {
      if (!postId) {
        throw new Error('Post ID is undefined');
      }
      
      const commentData = {
        ...comment,
        postId
      };
      
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commentData),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create comment: ${response.status} ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refetch comments and invalidate related queries
      refetchComments();
      queryClient.invalidateQueries({ queryKey: ['/api/posts', postId] });
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      
      // Reset form
      setNewComment('');
      setSelectedText(null);
      setSelectionData({ start: null, end: null, text: null });
      
      toast({
        title: 'Comment added',
        description: 'Your comment has been posted successfully.',
      });
    },
    onError: (error) => {
      console.error('Error adding comment:', error);
      toast({
        title: 'Comment failed',
        description: 'Unable to post your comment. Please try again.',
        variant: 'destructive',
      });
    }
  });

  // Listen for text selection events
  useEffect(() => {
    const handleTextSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        // Selection is empty or collapsed
        return;
      }
      
      // Get selected text
      const text = selection.toString().trim();
      if (!text) return;
      
      // Get range information
      const range = selection.getRangeAt(0);
      
      // Find the post content container
      const postContent = document.querySelector('.post-content');
      if (!postContent) return;
      
      // Calculate character positions
      const allText = postContent.textContent || '';
      const precedingRange = document.createRange();
      precedingRange.setStart(postContent, 0);
      precedingRange.setEnd(range.startContainer, range.startOffset);
      const startPos = precedingRange.toString().length;
      const endPos = startPos + text.length;
      
      // Store selection data
      setSelectedText(text);
      setSelectionData({
        start: startPos,
        end: endPos,
        text
      });
      
      // Focus the new comment input
      if (newCommentRef.current) {
        newCommentRef.current.focus();
      }
      
      // Show comment section if it's hidden
      if (!showComments) {
        setShowComments(true);
      }
    };
    
    // Add selection event listener
    document.addEventListener('mouseup', handleTextSelection);
    
    // Clean up
    return () => {
      document.removeEventListener('mouseup', handleTextSelection);
    };
  }, [showComments, setShowComments]);

  // Handle comment submission
  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      toast({
        title: 'Authentication required',
        description: 'You must be signed in to comment.',
        variant: 'destructive',
      });
      return;
    }

    if (!newComment.trim()) {
      toast({
        title: 'Empty comment',
        description: 'Please enter some text for your comment.',
        variant: 'destructive',
      });
      return;
    }

    const commentData: any = {
      content: newComment
    };
    
    // Add selection data if available
    if (selectionData.text && selectionData.start !== null && selectionData.end !== null) {
      commentData.selectedText = selectionData.text;
      commentData.selectionStart = selectionData.start;
      commentData.selectionEnd = selectionData.end;
    }

    addCommentMutation.mutate(commentData);
  };

  // Clear selection data
  const clearSelection = () => {
    setSelectedText(null);
    setSelectionData({ start: null, end: null, text: null });
  };

  // Filter to get only top-level comments (no replies)
  const topLevelComments = comments.filter(comment => !comment.parentId);

  return (
    <div className="gdocs-comment-section w-full h-full flex flex-col border-l border-[#a67a48]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#a67a48]">
        <h3 className="font-heading font-semibold text-lg text-[#a67a48]">Comments</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowComments(false)} 
          className="md:hidden text-[#161718] hover:text-[#a67a48]"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Comments list */}
      <div 
        ref={commentsRef}
        className="comments-container flex-1 overflow-y-auto p-4 space-y-4"
      >
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#f5f0e0] p-4 rounded-lg">
                <div className="flex items-start">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="ml-2 flex-1">
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-4 w-full mt-1" />
                    <Skeleton className="h-4 w-3/4 mt-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {topLevelComments && topLevelComments.length > 0 ? (
              topLevelComments.map((comment) => (
                <GoogleDocsComment 
                  key={`comment-${comment.id}`} 
                  comment={comment} 
                  postId={postId}
                  onDelete={() => {
                    refetchComments();
                    queryClient.invalidateQueries({ queryKey: ['/api/posts', postId] });
                    queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
                  }}
                  onUpdate={() => {
                    refetchComments();
                  }}
                  onReply={() => {
                    refetchComments();
                    queryClient.invalidateQueries({ queryKey: ['/api/posts', postId] });
                    queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
                  }}
                  refetchComments={refetchComments}
                  focusedCommentId={focusedCommentId}
                />
              ))
            ) : (
              <div className="bg-[#f5f0e0] p-4 rounded-lg text-center py-6 text-[#a67a48]">
                No comments yet
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* New comment form */}
      <div className="p-4 border-t border-[#a67a48]">
        {selectedText && (
          <div className="mb-2 p-2 bg-[#f5f0e0] rounded text-sm">
            <p className="text-[#161718] font-medium">Comment on selected text:</p>
            <p className="text-[#a67a48] mt-1 italic">"{selectedText}"</p>
            <Button 
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="mt-1 text-xs text-[#a67a48] hover:text-[#8a5a28] p-0 h-auto"
            >
              Clear selection
            </Button>
          </div>
        )}
        
        <form onSubmit={handleSubmitComment}>
          <Textarea
            ref={newCommentRef}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-[#a67a48] bg-[#f5f0e0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#a67a48] focus:border-[#a67a48] placeholder:text-[#a67a48]/50"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={addCommentMutation.isPending || !currentUser}
          />
          
          <div className="flex justify-end mt-3">
            <Button 
              type="submit" 
              disabled={addCommentMutation.isPending || !currentUser}
              className="inline-flex items-center px-4 py-2 text-sm bg-[#a67a48] hover:bg-[#8a5d2e] text-[#e0d3af]"
            >
              {addCommentMutation.isPending ? 'Posting...' : 'Comment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GoogleDocsCommentSection;