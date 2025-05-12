import { useState } from 'react';
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
}

const CommentSection = ({ 
  postId, 
  comments, 
  isLoading, 
  showComments, 
  setShowComments 
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
      const response = await apiRequest('POST', `/api/posts/${postId}/comments`, comment);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts', postId, 'comments'] });
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
    <div className={`w-full md:w-1/4 mt-8 md:mt-0 border-t md:border-t-0 md:border-l border-neutral-200 pt-8 md:pt-0 md:pl-8 ${showComments ? 'block' : 'hidden md:block'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-lg">Comments</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowComments(false)} 
          className="md:hidden text-neutral-500 hover:text-neutral-700"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        {!showComments && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowComments(true)} 
            className="hidden md:inline-block cursor-pointer text-primary hover:text-primary-dark text-sm"
          >
            Show Comments
          </Button>
        )}
      </div>
      
      {isLoading ? (
        <div className="space-y-4 max-h-[calc(90vh-200px)] overflow-y-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-neutral-50 p-3 rounded-lg">
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
        <div className="space-y-4 max-h-[calc(90vh-200px)] overflow-y-auto">
          {comments && comments.length > 0 ? (
            comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))
          ) : (
            <div className="bg-neutral-50 p-3 rounded-lg text-center py-6">
              <p className="text-neutral-600 text-sm">No comments yet.</p>
              <p className="text-neutral-500 text-xs mt-1">Be the first to start the conversation!</p>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t border-neutral-200">
        <h4 className="text-sm font-medium text-neutral-900 mb-2">Add Comment</h4>
        <form onSubmit={handleSubmitComment}>
          <Textarea
            rows={3}
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="Share your thoughts..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={addCommentMutation.isPending || !currentUser}
          />
          {selectedElementId && (
            <div className="mt-1 text-xs text-primary">
              Commenting on selected text
              <Button 
                variant="link" 
                size="sm" 
                className="px-1 h-auto text-xs"
                onClick={() => setSelectedElementId(null)}
              >
                (clear)
              </Button>
            </div>
          )}
          <div className="flex justify-end mt-2">
            <Button 
              type="submit" 
              disabled={addCommentMutation.isPending || !currentUser}
              className="inline-flex items-center px-3 py-1.5 text-sm"
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
