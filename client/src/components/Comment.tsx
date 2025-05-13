import { useState, useRef, useEffect } from 'react';
import { Comment } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash, Reply, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CommentProps {
  comment: Comment;
  isReply?: boolean;
  postId: number;
  onDelete?: (commentId: number) => void;
  onUpdate?: (commentId: number, content: string) => void;
  onReply?: (commentId: number, content: string) => void;
  refetchComments?: () => void;
}

const CommentItem = ({ 
  comment, 
  isReply = false, 
  postId,
  onDelete,
  onUpdate,
  onReply,
  refetchComments 
}: CommentProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [editedContent, setEditedContent] = useState(comment.content);
  const [replyContent, setReplyContent] = useState('');
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  
  const formattedDate = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
  const isAuthor = currentUser?.id === comment.authorId;
  const hasReplies = !isReply && comment.id !== undefined; // Only top-level comments can have replies

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
  
  const handleEdit = () => {
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
      const response = await apiRequest(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: editedContent })
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
  
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      try {
        const response = await apiRequest(`/api/comments/${comment.id}`, {
          method: 'DELETE'
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
      const response = await apiRequest(`/api/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ 
          content: replyContent,
          postId,
          parentId: comment.id
        })
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
        const response = await apiRequest(`/api/comments/${comment.id}/replies`);
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
    <div className={`${isReply ? 'ml-8 mt-2' : ''}`}>
      <div 
        className={`bg-[#f5f0e0] p-4 rounded-lg mb-2 relative ${
          comment.selectedText ? 'cursor-pointer hover:bg-[#ebddbe]' : ''
        } ${isReply ? 'border-l-2 border-[#a67a48]' : ''}`}
        onClick={comment.selectedText ? handleCommentClick : undefined}
      >
        <div className="flex items-start">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={comment.author.photoURL} alt={comment.author.displayName} />
            <AvatarFallback>{comment.author.displayName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="ml-3 flex-1">
            <div className="flex flex-row justify-between items-center">
              <span className="text-sm font-medium text-[#161718]">{comment.author.displayName}</span>
              <div className="flex items-center">
                <span className="text-xs text-[#a67a48] mr-2">{formattedDate}</span>
                {comment.isEdited && <span className="text-xs text-[#a67a48] italic mr-2">(edited)</span>}
                {isAuthor && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleEdit}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDelete}>
                        <Trash className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
            
            {isEditing ? (
              <div className="mt-2">
                <Textarea 
                  ref={editInputRef}
                  value={editedContent} 
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[100px] bg-white"
                />
                <div className="flex justify-end mt-2 space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCancelEdit}
                    className="flex items-center"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleSaveEdit}
                    className="flex items-center bg-[#a67a48] hover:bg-[#8a5a28]"
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
              <div className="mt-2 text-xs text-[#a67a48] italic flex items-center">
                <span>Comment on: "{comment.selectedText}"</span>
              </div>
            )}
            
            {!isEditing && !isReply && (
              <div className="mt-2 flex space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleReply}
                  className="flex items-center text-xs text-[#a67a48] hover:text-[#8a5a28] p-0 h-6"
                >
                  <Reply className="h-3 w-3 mr-1" />
                  Reply
                </Button>
                
                {hasReplies && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleReplies}
                    className="flex items-center text-xs text-[#a67a48] hover:text-[#8a5a28] p-0 h-6"
                    disabled={isLoadingReplies}
                  >
                    {isLoadingReplies ? (
                      <span>Loading...</span>
                    ) : (
                      <>
                        {showReplies ? (
                          <ChevronUp className="h-3 w-3 mr-1" />
                        ) : (
                          <ChevronDown className="h-3 w-3 mr-1" />
                        )}
                        {showReplies ? 'Hide Replies' : 'Show Replies'}
                        {replies.length > 0 && !showReplies && ` (${replies.length})`}
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
        <div className="ml-8 mb-4">
          <Textarea
            ref={replyInputRef}
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            className="min-h-[80px] bg-white border-[#a67a48]"
          />
          <div className="flex justify-end mt-2 space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCancelReply}
              className="flex items-center"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleSubmitReply}
              className="flex items-center bg-[#a67a48] hover:bg-[#8a5a28]"
            >
              <Check className="h-4 w-4 mr-1" />
              Reply
            </Button>
          </div>
        </div>
      )}
      
      {showReplies && replies.length > 0 && (
        <div className="mt-1 mb-4">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              isReply={true}
              onDelete={onDelete}
              onUpdate={onUpdate}
              refetchComments={refetchComments}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentItem;
