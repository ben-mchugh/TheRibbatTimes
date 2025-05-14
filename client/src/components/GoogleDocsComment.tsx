import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Comment } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Trash, Edit, Reply, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface GoogleDocsCommentProps {
  comment: Comment;
  postId: number;
  isReply?: boolean;
  onDelete?: (commentId: number) => void;
  onUpdate?: (commentId: number, content: string) => void;
  onReply?: (commentId: number, content: string) => void;
  refetchComments?: () => void;
  focusedCommentId?: number | null;
}

const GoogleDocsComment: React.FC<GoogleDocsCommentProps> = ({
  comment,
  postId,
  isReply = false,
  onDelete,
  onUpdate,
  onReply,
  refetchComments,
  focusedCommentId
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [editedContent, setEditedContent] = useState(comment.content);
  const [replyContent, setReplyContent] = useState('');
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const commentRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  
  const dateFormatted = format(new Date(comment.createdAt), 'MMM d, yyyy');
  const timeFormatted = format(new Date(comment.createdAt), 'h:mm a');
  
  // Check if the current user is the author of this comment
  const isAuthor = Boolean(currentUser?.uid && comment.author?.uid && currentUser.uid === comment.author.uid);
  const hasReplies = !isReply && comment.id !== undefined; // Only top-level comments can have replies
  const isFocused = focusedCommentId === comment.id;

  // Apply highlight effect when comment is focused from text selection
  useEffect(() => {
    if (isFocused && commentRef.current) {
      commentRef.current.classList.add('comment-focus-pulse');
      setTimeout(() => {
        if (commentRef.current) {
          commentRef.current.classList.remove('comment-focus-pulse');
        }
      }, 2000);
    }
  }, [isFocused]);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
    }
    
    if (isReplying && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [isEditing, isReplying]);

  // Scroll to the target element when the comment is clicked (for margin comments)
  const handleCommentClick = () => {
    if (comment.selectedText && !isEditing && !isReplying) {
      // Find the selection in the document
      const selection = comment.selectedText;
      const selectionStart = comment.selectionStart;
      const selectionEnd = comment.selectionEnd;
      
      if (selection && selectionStart !== null && selectionEnd !== null) {
        // Find and highlight the text
        const highlightedEl = document.querySelector(`.selection-highlight[data-comment-id="${comment.id}"]`);
        
        if (highlightedEl) {
          highlightedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          highlightedEl.classList.add('highlight-focus-pulse');
          setTimeout(() => {
            highlightedEl.classList.remove('highlight-focus-pulse');
          }, 2000);
        }
      }
    }
  };
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditedContent(comment.content);
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent(comment.content);
  };
  
  const handleSaveEdit = async () => {
    if (editedContent.trim() === '') {
      toast({
        title: "Error",
        description: "Comment cannot be empty",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: editedContent }),
        credentials: 'include'
      });
      
      if (response.ok) {
        const updatedComment = await response.json();
        setIsEditing(false);
        
        toast({
          title: "Success",
          description: "Comment updated successfully"
        });
        
        if (onUpdate) {
          onUpdate(comment.id, editedContent);
        }
        
        if (refetchComments) {
          refetchComments();
        }
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: "Error",
        description: "Failed to update comment",
        variant: "destructive"
      });
    }
  };
  
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this comment?')) {
      try {
        const response = await fetch(`/api/comments/${comment.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        if (response.ok) {
          toast({
            title: "Success",
            description: "Comment deleted successfully"
          });
          
          if (onDelete) {
            onDelete(comment.id);
          }
          
          if (refetchComments) {
            refetchComments();
          }
        }
      } catch (error) {
        console.error('Error deleting comment:', error);
        toast({
          title: "Error",
          description: "Failed to delete comment",
          variant: "destructive"
        });
      }
    }
  };
  
  const handleReply = () => {
    setIsReplying(true);
    setReplyContent('');
  };
  
  const handleCancelReply = () => {
    setIsReplying(false);
    setReplyContent('');
  };
  
  const handleSubmitReply = async () => {
    if (replyContent.trim() === '') {
      toast({
        title: "Error",
        description: "Reply cannot be empty",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          content: replyContent,
          postId,
          parentId: comment.id
        }),
        credentials: 'include'
      });
      
      if (response.ok) {
        const newReply = await response.json();
        setIsReplying(false);
        setReplyContent('');
        
        toast({
          title: "Success",
          description: "Reply added successfully"
        });
        
        if (onReply) {
          onReply(comment.id, replyContent);
        }
        
        // If replies are already showing, add this to the list
        if (showReplies) {
          setReplies(prev => [...prev, newReply]);
        } else {
          // Otherwise show replies now
          toggleReplies();
        }
      }
    } catch (error) {
      console.error('Error adding reply:', error);
      toast({
        title: "Error",
        description: "Failed to add reply",
        variant: "destructive"
      });
    }
  };
  
  const toggleReplies = async () => {
    if (!hasReplies) return;
    
    if (!showReplies && replies.length === 0) {
      // Fetch replies
      setIsLoadingReplies(true);
      try {
        const response = await fetch(`/api/comments/${comment.id}/replies`, {
          method: 'GET',
          credentials: 'include'
        });
        if (response.ok) {
          const fetchedReplies = await response.json();
          setReplies(fetchedReplies);
        }
      } catch (error) {
        console.error('Error fetching replies:', error);
        toast({
          title: "Error",
          description: "Failed to load replies",
          variant: "destructive"
        });
      } finally {
        setIsLoadingReplies(false);
      }
    }
    
    setShowReplies(!showReplies);
  };

  return (
    <div className={`gdocs-comment ${isReply ? 'ml-4 mt-2' : ''} ${isFocused ? 'focused' : ''}`}>
      <div 
        ref={commentRef}
        className={`bg-[#e8e8e8]/95 backdrop-blur-sm p-4 rounded-lg mb-2 relative group shadow-[0_4px_16px_rgba(0,0,0,0.15)] opacity-100 ${
          comment.selectedText ? 'cursor-pointer hover:bg-[#f0f0f0] hover:shadow-[0_6px_20px_rgba(0,0,0,0.18)]' : ''
        } ${isReply ? 'border-l-2 border-[#444444]' : ''} 
        transition-all duration-300 ease-in-out animate-comment-enter w-[300px]
        ${isFocused ? 'animate-comment-focus border-2 border-[#444444] ring-2 ring-[#444444]/30 shadow-[0_8px_24px_rgba(0,0,0,0.25)]' : 'border border-[#444444]/80'}`}
        onClick={comment.selectedText ? handleCommentClick : undefined}
        data-comment-id={comment.id}
        data-focused={isFocused ? "true" : "false"}
      >
        
        {/* Add action buttons below the header in a fixed position */}
        {isAuthor && (
          <div className="flex absolute top-10 right-4 space-x-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button 
              onClick={handleEdit}
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0 flex items-center justify-center text-[#444444] hover:text-[#222222] hover:bg-[#d0d0d0] border border-[#444444] rounded-sm bg-[#e8e8e8]"
              title="Edit comment"
            >
              <Edit className="h-3 w-3" />
            </Button>
            
            <Button 
              onClick={handleDelete}
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0 flex items-center justify-center text-[#444444] hover:text-[#222222] hover:bg-[#d0d0d0] border border-[#444444] rounded-sm bg-[#e8e8e8]"
              title="Delete comment"
            >
              <Trash className="h-3 w-3" />
            </Button>
          </div>
        )}
        
        <div className="flex items-start">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={comment.author.photoURL} alt={comment.author.displayName} />
            <AvatarFallback>{comment.author.displayName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="ml-2 flex-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-[#161718]">{comment.author.displayName}</span>
              <div className="flex flex-col items-end">
                <span className="text-xs text-[#444444]">{dateFormatted}</span>
                <span className="text-xs text-[#444444]">{timeFormatted}</span>
                {comment.isEdited && <span className="text-xs text-[#444444] italic">(edited)</span>}
              </div>
            </div>
            
            {isEditing ? (
              <div className="mt-2 w-full">
                <Textarea 
                  ref={editInputRef}
                  value={editedContent} 
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[80px] bg-white border-[#444444] text-[#161718] w-full"
                />
                <div className="flex justify-end mt-2 space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCancelEdit}
                    className="flex items-center justify-center text-[#444444] border-[#444444] h-8 w-8 p-0"
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleSaveEdit}
                    className="flex items-center justify-center bg-[#444444] hover:bg-[#222222] h-8 w-8 p-0"
                    title="Save"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#161718] mt-1 whitespace-pre-wrap break-words">{comment.content}</p>
            )}
            
            {comment.selectedText && !isEditing && (
              <div className="mt-2 text-xs text-[#888888] italic">
                <span>"{comment.selectedText}"</span>
              </div>
            )}
            
            {!isEditing && !isReply && (
              <div className="mt-2 flex space-x-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleReply}
                  className="flex items-center justify-center text-[#444444] hover:text-[#222222] hover:bg-[#e0e0e0] h-7 w-7 p-0 rounded-full"
                  title="Reply to comment"
                >
                  <Reply className="h-3.5 w-3.5" />
                </Button>
                
                {hasReplies && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleReplies}
                    className="flex items-center justify-center text-[#444444] hover:text-[#222222] hover:bg-[#e0e0e0] h-7 w-7 p-0 rounded-full"
                    disabled={isLoadingReplies}
                    title={showReplies ? "Hide replies" : `Show replies${replies.length > 0 ? ` (${replies.length})` : ''}`}
                  >
                    {isLoadingReplies ? (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-t-transparent border-[#444444] animate-spin" />
                    ) : (
                      showReplies ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {isReplying && (
        <div className="ml-6 mb-4 w-[300px]">
          <Textarea
            ref={replyInputRef}
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            className="min-h-[60px] bg-white border-[#444444] text-[#161718] w-full"
          />
          <div className="flex justify-end mt-2 space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCancelReply}
              className="flex items-center justify-center text-[#444444] border-[#444444] h-8 w-8 p-0"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleSubmitReply}
              className="flex items-center justify-center bg-[#444444] hover:bg-[#222222] h-8 w-8 p-0"
              title="Submit reply"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {showReplies && replies.length > 0 && (
        <div className="mt-1 mb-2 ml-4 border-l-2 border-[#444444] pl-2">
          {replies.map((reply) => (
            <GoogleDocsComment
              key={`reply-${reply.id}`}
              comment={reply}
              postId={postId}
              isReply={true}
              onDelete={onDelete}
              onUpdate={onUpdate}
              refetchComments={refetchComments}
              focusedCommentId={focusedCommentId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default GoogleDocsComment;