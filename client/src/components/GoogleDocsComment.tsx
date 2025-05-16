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
  isActive?: boolean;
  setActive?: (id: number | null) => void;
}

const GoogleDocsComment: React.FC<GoogleDocsCommentProps> = ({
  comment,
  postId,
  isReply = false,
  onDelete,
  onUpdate,
  onReply,
  refetchComments,
  focusedCommentId,
  isActive,
  setActive
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [editedContent, setEditedContent] = useState(comment.content);
  const [replyContent, setReplyContent] = useState('');
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [hasReplyComments, setHasReplyComments] = useState(false);
  // isActive and setActive are now passed as props
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
  
  // Check if comment has any replies when component mounts
  useEffect(() => {
    if (!isReply && comment.id !== undefined) {
      const checkForReplies = async () => {
        try {
          const response = await fetch(`/api/comments/${comment.id}/replies`, {
            method: 'GET',
            credentials: 'include'
          });
          if (response.ok) {
            const fetchedReplies = await response.json();
            setHasReplyComments(fetchedReplies.length > 0);
            if (fetchedReplies.length > 0) {
              setReplies(fetchedReplies);
            }
          }
        } catch (error) {
          console.error('Error checking for replies:', error);
        }
      };
      
      checkForReplies();
    }
  }, [comment.id, isReply]);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
    }
    
    if (isReplying && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [isEditing, isReplying]);

  // Scroll to the target element when the comment is clicked (for margin comments)
  const handleCommentClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); // Prevent event bubbling if event is provided
    
    // Set this comment as the active one (and deactivate all others)
    if (setActive) setActive(comment.id);
    
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
        
        // Set the flag that we now have replies
        setHasReplyComments(true);
        
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
          setHasReplyComments(fetchedReplies.length > 0);
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
    
    // Toggle the state first
    const newShowRepliesState = !showReplies;
    setShowReplies(newShowRepliesState);
    
    // If we're showing replies and this is a parent comment with selection text
    if (newShowRepliesState && comment.selectedText && comment.id && !isReply) {
      // We need to wait for DOM updates to complete after replies are shown
      setTimeout(() => {
        try {
          // First, find the highlight element in the post content
          const highlightElement = document.querySelector(`.selection-highlight[data-comment-id="${comment.id}"]`);
          if (!highlightElement) return;
          
          // Get the position of the highlight in the viewport
          const highlightRect = highlightElement.getBoundingClientRect();
          const highlightPosition = highlightRect.top; // Use the top of the highlight instead of the midpoint
          
          // Find the comment section container
          const commentsContainer = document.querySelector('.comments-container');
          if (!commentsContainer) return;
          
          // Force the comment ID to be focused in the comment section
          // This calls the existing alignment logic in GoogleDocsCommentSection.tsx
          if (typeof window !== 'undefined') {
            // Create a custom event to notify the CommentSection component
            const event = new CustomEvent('forceFocusComment', {
              detail: { commentId: comment.id, highlightPosition: highlightPosition }
            });
            
            // Dispatch the event on the comments container
            commentsContainer.dispatchEvent(event);
          }
        } catch (error) {
          console.error("Error aligning comment:", error);
        }
      }, 150); // Give DOM time to update
    }
  };

  // Handle clicks outside the comment to reset active state
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (commentRef.current && !commentRef.current.contains(event.target as Node)) {
        // Reset active state if this comment is active
        if (isActive && setActive) {
          setActive(null);
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isActive, setActive]);

  return (
    <div className={`gdocs-comment ${isReply ? 'ml-4 mt-2' : ''} ${isFocused ? 'focused' : ''} block`}>
      <div 
        ref={commentRef}
        className={`${isActive ? 'bg-white' : 'bg-[#e8e8e8]/95'} backdrop-blur-sm p-4 rounded-lg mb-2 relative group shadow-xl opacity-100 ${
          comment.selectedText ? 'cursor-pointer hover:bg-[#f0f0f0] hover:shadow-2xl' : ''
        } ${isReply ? 'w-[85%] min-w-[240px] ml-auto mr-0' : 'w-[95%] min-w-[260px]'} 
        transition duration-200 ease-in-out animate-comment-enter box-border table table-fixed
        ${isFocused ? 'ring-2 ring-[#444444]/40' : ''}`}
        onClick={handleCommentClick}
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
              className="h-6 w-6 p-0 flex items-center justify-center text-[#444444] hover:text-[#222222] hover:bg-[#d0d0d0] rounded-sm bg-[#e8e8e8] shadow-sm"
              title="Edit comment"
            >
              <Edit className="h-3 w-3" />
            </Button>
            
            <Button 
              onClick={handleDelete}
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0 flex items-center justify-center text-[#444444] hover:text-[#222222] hover:bg-[#d0d0d0] rounded-sm bg-[#e8e8e8] shadow-sm"
              title="Delete comment"
            >
              <Trash className="h-3 w-3" />
            </Button>
          </div>
        )}
        
        <div className="flex flex-col w-full">
          {/* Header with user info */}
          <div className="flex items-center mb-2">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={comment.author.photoURL} alt={comment.author.displayName} />
              <AvatarFallback>{comment.author.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="ml-2 flex flex-col">
              <span className="text-sm font-bold text-[#161718]">{comment.author.displayName}</span>
              <div className="flex text-xs text-[#444444]">
                <span>{dateFormatted}</span>
                <span className="mx-1">·</span>
                <span>{timeFormatted}</span>
                {comment.isEdited && <span className="ml-1 italic">(edited)</span>}
              </div>
            </div>
          </div>
          
          {/* Comment content - full width */}
          <div className="w-full overflow-hidden">
            
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
              <div className="overflow-hidden w-full">
                {comment.content.length > 150 && !isExpanded ? (
                  <>
                    <p className="text-sm text-[#161718] whitespace-pre-wrap hyphens-auto overflow-hidden" style={{ wordBreak: 'break-word', width: '100%', fontFamily: 'Open Sans, sans-serif' }}>
                      {comment.content.slice(0, 150)}...
                    </p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(true);
                      }}
                      className="text-xs mt-1 text-[#1a365d] hover:text-[#0f172a] font-medium flex items-center transition-colors duration-200 underline-offset-2 hover:underline"
                    >
                      Read more <ChevronDown className="h-3 w-3 ml-1 text-[#1a365d]" />
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[#161718] whitespace-pre-wrap hyphens-auto" style={{ wordBreak: 'break-word', width: '100%', fontFamily: 'Open Sans, sans-serif' }}>
                      {comment.content}
                    </p>
                    {comment.content.length > 150 && isExpanded && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsExpanded(false);
                        }}
                        className="text-xs mt-1 text-[#1a365d] hover:text-[#0f172a] font-medium flex items-center transition-colors duration-200 underline-offset-2 hover:underline"
                      >
                        Show less <ChevronUp className="h-3 w-3 ml-1 text-[#1a365d]" />
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            
            {comment.selectedText && !isEditing && (
              <div className="mt-2 text-xs text-[#888888] italic overflow-hidden" style={{ width: '100%', wordBreak: 'break-word' }}>
                <span className="whitespace-pre-wrap hyphens-auto" style={{ display: 'block', width: '100%', boxShadow: 'inset 2px 0 0 rgba(150,150,150,0.3)', paddingLeft: '8px', fontFamily: 'Open Sans, sans-serif' }}>"{comment.selectedText}"</span>
              </div>
            )}
            
            {!isEditing && !isReply && (
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleReply}
                  className="flex items-center justify-center text-[#444444] hover:text-[#222222] hover:bg-[#e0e0e0] h-6 w-6 p-0 rounded-full"
                  title="Reply to comment"
                >
                  <Reply className="h-3.5 w-3.5" />
                </Button>
                
                {hasReplies && hasReplyComments && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleReplies}
                    className="flex items-center justify-center text-[#444444] hover:text-[#222222] hover:bg-[#e0e0e0] h-6 px-2 rounded-full"
                    disabled={isLoadingReplies}
                    title={showReplies ? "Hide replies" : "Show replies"}
                  >
                    {isLoadingReplies ? (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-t-transparent border-[#444444] animate-spin mr-1" />
                    ) : (
                      <>
                        {replies.length > 0 && !showReplies && (
                          <span className="text-xs mr-1 text-gray-500">({replies.length})</span>
                        )}
                        {showReplies ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {isReplying && (
        <div className="ml-6 mb-4 w-[220px] bg-[#e8e8e8] p-3 rounded-md shadow-xl">
          <Textarea
            ref={replyInputRef}
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply... (Enter to submit, Esc to cancel)"
            className="min-h-[60px] bg-white border-0 text-[#161718] w-full text-sm rounded shadow-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitReply();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancelReply();
              }
            }}
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
        <div className="mt-1 mb-2 ml-6 pl-2 w-[95%] flex flex-col items-end">
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