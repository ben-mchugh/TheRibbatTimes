import { useState, useRef, useEffect } from 'react';
import { Comment, User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';
import { Pencil, Reply, Trash, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';

interface CommentProps {
  comment: Comment;
  onCommentUpdate?: () => void;
}

const CommentItem = ({ comment, onCommentUpdate }: CommentProps) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [editedContent, setEditedContent] = useState(comment.content);
  const [replyContent, setReplyContent] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const commentRef = useRef<HTMLDivElement>(null);
  
  const formattedDate = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
  const isOwner = currentUser && comment.authorId === currentUser.id;

  // Focus the textarea when editing starts
  useEffect(() => {
    if (isEditing && commentRef.current) {
      const textarea = commentRef.current.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    }
  }, [isEditing]);

  // Scroll to the target element when the comment is clicked (for margin comments)
  const handleCommentClick = () => {
    if (comment.elementId) {
      const targetElement = document.getElementById(comment.elementId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the element temporarily
        targetElement.classList.add('bg-[#f0e9d5]');
        setTimeout(() => {
          targetElement.classList.remove('bg-[#f0e9d5]');
        }, 2000);
      }
    }
  };

  // Update comment
  const handleUpdateComment = async () => {
    if (!editedContent.trim()) {
      toast({
        title: 'Empty comment',
        description: 'Please enter some text for your comment.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedComment = await apiRequest(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: editedContent }),
      });
      
      setIsEditing(false);
      toast({
        title: 'Comment updated',
        description: 'Your comment has been updated successfully.',
      });
      
      if (onCommentUpdate) {
        onCommentUpdate();
      }
    } catch (error) {
      console.error('Failed to update comment:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to update your comment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async () => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(`/api/comments/${comment.id}`, {
        method: 'DELETE',
      });
      
      toast({
        title: 'Comment deleted',
        description: 'Your comment has been deleted successfully.',
      });
      
      if (onCommentUpdate) {
        onCommentUpdate();
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to delete your comment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit reply
  const handleSubmitReply = async () => {
    if (!replyContent.trim()) {
      toast({
        title: 'Empty reply',
        description: 'Please enter some text for your reply.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(`/api/comments/${comment.id}/replies`, {
        method: 'POST',
        body: JSON.stringify({ content: replyContent }),
      });
      
      setIsReplying(false);
      setReplyContent('');
      toast({
        title: 'Reply added',
        description: 'Your reply has been added successfully.',
      });
      
      if (onCommentUpdate) {
        onCommentUpdate();
      }
    } catch (error) {
      console.error('Failed to add reply:', error);
      toast({
        title: 'Reply failed',
        description: 'Failed to add your reply. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      ref={commentRef}
      className={`bg-[#f5f0e0] p-4 rounded-lg mb-4 relative transition-all duration-200
        ${comment.elementId ? 'cursor-pointer hover:bg-[#ebddbe]' : ''}
        ${isEditing || isReplying ? 'shadow-md' : ''}
      `}
      onClick={comment.elementId && !isEditing && !isReplying ? handleCommentClick : undefined}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start">
        <Avatar className="h-10 w-10">
          <AvatarImage src={comment.author.photoURL} alt={comment.author.displayName} />
          <AvatarFallback>{comment.author.displayName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="ml-3 flex-1">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
            <span className="text-sm font-medium text-[#161718]">{comment.author.displayName}</span>
            <span className="text-xs text-[#a67a48] mt-1 sm:mt-0">{formattedDate}</span>
          </div>
          
          {isEditing ? (
            <div className="mt-2">
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[80px] text-sm text-[#161718] border border-[#a67a48] focus:ring-[#a67a48]"
                placeholder="Edit your comment..."
              />
              <div className="flex justify-end mt-2 space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-[#a67a48] border-[#a67a48] hover:bg-[#f0e9d5]"
                  onClick={() => setIsEditing(false)}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#a67a48] text-white hover:bg-[#8a673d]"
                  onClick={handleUpdateComment}
                  disabled={isSubmitting}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#161718] mt-2 whitespace-pre-wrap break-words">{comment.content}</p>
          )}
          
          {comment.selectedText && !isEditing && (
            <div className="mt-2 text-xs text-[#a67a48] italic border-l-2 border-[#a67a48] pl-2 bg-[#ebddbe] py-1 px-1">
              "{comment.selectedText.length > 60 ? `${comment.selectedText.substring(0, 60)}...` : comment.selectedText}"
            </div>
          )}
          
          {/* Comment actions */}
          {!isEditing && !isReplying && showActions && currentUser && (
            <div className="flex mt-2 space-x-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-[#a67a48] hover:bg-[#ebddbe] hover:text-[#8a673d]"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsReplying(true);
                }}
              >
                <Reply className="h-3 w-3 mr-1" />
                Reply
              </Button>
              
              {isOwner && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-[#a67a48] hover:bg-[#ebddbe] hover:text-[#8a673d]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-[#a67a48] hover:bg-[#ebddbe] hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteComment();
                    }}
                  >
                    <Trash className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Reply form */}
      {isReplying && (
        <div className="mt-4 pl-12">
          <Textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="min-h-[80px] text-sm text-[#161718] border border-[#a67a48] focus:ring-[#a67a48]"
            placeholder="Write a reply..."
          />
          <div className="flex justify-end mt-2 space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-[#a67a48] border-[#a67a48] hover:bg-[#f0e9d5]"
              onClick={() => setIsReplying(false)}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-[#a67a48] text-white hover:bg-[#8a673d]"
              onClick={handleSubmitReply}
              disabled={isSubmitting}
            >
              <Check className="h-4 w-4 mr-1" />
              Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentItem;
