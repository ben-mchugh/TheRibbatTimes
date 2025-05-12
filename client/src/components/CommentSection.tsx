import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Comment } from '@/lib/types';
import { apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import CommentItem from './Comment';
import { ChevronLeft } from 'lucide-react';

interface CommentSectionProps {
  postId: number;
  comments: Comment[];
  isLoading: boolean;
  showComments: boolean;
  setShowComments: (show: boolean) => void;
  refetchComments: () => void;
}

const CommentSection = ({ 
  postId, 
  comments, 
  isLoading, 
  showComments, 
  setShowComments,
  refetchComments
}: CommentSectionProps) => {
  const [newComment, setNewComment] = useState('');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Listen for text selection to create context-aware comments
  useEffect(() => {
    const handleTextSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      
      // Get selected text and its container element
      const selectedText = selection.toString().trim();
      if (!selectedText) return;
      
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer.parentElement;
      
      if (container && container.id) {
        setSelectedElementId(container.id);
      } else if (container && container.parentElement && container.parentElement.id) {
        setSelectedElementId(container.parentElement.id);
      }
    };

    document.addEventListener('mouseup', handleTextSelection);
    return () => document.removeEventListener('mouseup', handleTextSelection);
  }, []);

  // Add new comment
  const addCommentMutation = useMutation({
    mutationFn: async (comment: { content: string; elementId?: string }) => {
      if (!postId) {
        console.error('PostID is undefined - cannot submit comment');
        throw new Error('Post ID is undefined');
      }
      console.log(`Submitting comment to post ${postId}:`, comment);
      try {
        const response = await apiRequest('POST', `/api/posts/${postId}/comments`, comment);
        const result = await response.json();
        console.log('Comment creation response:', result);
        return result;
      } catch (error) {
        console.error('Error in comment submission:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Instead of just invalidating, directly refetch comments to ensure immediate update
      refetchComments();
      
      // Also invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['/api/posts', postId] });
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      
      setNewComment('');
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

    const commentData: { content: string; elementId?: string } = {
      content: newComment,
    };
    
    if (selectedElementId) {
      commentData.elementId = selectedElementId;
    }

    addCommentMutation.mutate(commentData);
  };

  return (
    <div className={`w-full mt-8 pt-4 border-t border-[#a67a48] ${showComments ? 'block' : 'hidden md:block'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-lg text-[#a67a48]">Comments</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowComments(false)} 
          className="md:hidden text-[#161718] hover:text-[#a67a48]"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        {!showComments && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowComments(true)} 
            className="hidden md:inline-block cursor-pointer text-[#a67a48] hover:text-[#161718] text-sm"
          >
            Show Comments
          </Button>
        )}
      </div>
      
      {isLoading ? (
        <div className="space-y-4 overflow-y-auto">
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
        <div className="space-y-4 overflow-y-auto">
          {comments && comments.length > 0 ? (
            comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))
          ) : (
            <div className="bg-[#f5f0e0] p-4 rounded-lg text-center py-6">
              <p className="text-[#161718] text-sm">No comments yet.</p>
              <p className="text-[#a67a48] text-xs mt-1">Be the first to start the conversation!</p>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-6 pt-4 border-t border-[#a67a48]">
        <h4 className="text-sm font-medium text-[#a67a48] mb-2">Add Comment</h4>
        <form onSubmit={handleSubmitComment}>
          <Textarea
            rows={3}
            className="w-full px-3 py-2 text-sm border border-[#a67a48] bg-[#f5f0e0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#a67a48] focus:border-[#a67a48] placeholder:text-[#a67a48]/50"
            placeholder="Share your thoughts..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={addCommentMutation.isPending || !currentUser}
          />
          {selectedElementId && (
            <div className="mt-2 text-xs text-[#a67a48]">
              Commenting on selected text
              <Button 
                variant="link" 
                size="sm" 
                className="px-1 h-auto text-xs text-[#a67a48] hover:text-[#161718]"
                onClick={() => setSelectedElementId(null)}
              >
                (clear)
              </Button>
            </div>
          )}
          <div className="flex justify-end mt-3">
            <Button 
              type="submit" 
              disabled={addCommentMutation.isPending || !currentUser}
              className="inline-flex items-center px-4 py-2 text-sm bg-[#a67a48] hover:bg-[#8a5d2e] text-[#e0d3af]"
            >
              {addCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CommentSection;
