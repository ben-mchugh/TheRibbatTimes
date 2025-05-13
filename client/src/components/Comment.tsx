import { Comment } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

interface CommentProps {
  comment: Comment;
}

const CommentItem = ({ comment }: CommentProps) => {
  const formattedDate = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

  // Scroll to the target element when the comment is clicked (for margin comments)
  const handleCommentClick = () => {
    if (comment.elementId) {
      const targetElement = document.getElementById(comment.elementId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the element temporarily
        targetElement.classList.add('bg-primary-light', 'bg-opacity-20');
        setTimeout(() => {
          targetElement.classList.remove('bg-primary-light', 'bg-opacity-20');
        }, 2000);
      }
    }
  };

  return (
    <div 
      className={`bg-[#f5f0e0] p-4 rounded-lg mb-4 ${comment.elementId ? 'cursor-pointer hover:bg-[#ebddbe]' : ''}`}
      onClick={comment.elementId ? handleCommentClick : undefined}
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
          <p className="text-sm text-[#161718] mt-2 whitespace-pre-wrap break-words">{comment.content}</p>
          {comment.elementId && (
            <div className="mt-2 text-xs text-[#a67a48] italic">
              Comment on selected text
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentItem;
