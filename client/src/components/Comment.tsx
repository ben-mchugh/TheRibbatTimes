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
      className={`bg-neutral-50 p-3 rounded-lg ${comment.elementId ? 'cursor-pointer hover:bg-neutral-100' : ''}`}
      onClick={comment.elementId ? handleCommentClick : undefined}
    >
      <div className="flex items-start">
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.author.photoURL} alt={comment.author.displayName} />
          <AvatarFallback>{comment.author.displayName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="ml-2 flex-1">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-neutral-900">{comment.author.displayName}</span>
            <span className="text-xs text-neutral-500">{formattedDate}</span>
          </div>
          <p className="text-sm text-neutral-700 mt-1">{comment.content}</p>
          {comment.elementId && (
            <div className="mt-1 text-xs text-primary-dark italic">
              Comment on selected text
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentItem;
