import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Post, Comment } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { X } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import CommentSection from './CommentSection';
import { useAuth } from '@/hooks/useAuth';

interface PostViewProps {
  postId: number;
}

const PostView = ({ postId }: PostViewProps) => {
  // All state hooks must be defined at the top in the same order every render
  const [showComments, setShowComments] = useState(true);
  const [marginComments, setMarginComments] = useState<Array<{
    id: number;
    top: number;
    comment: Comment;
  }>>([]);
  
  // Custom hooks
  const { currentUser } = useAuth();
  
  // Queries
  const { data: post, isLoading, error } = useQuery<Post>({
    queryKey: ['/api/posts', postId],
  });

  const { data: comments, isLoading: commentsLoading } = useQuery<Comment[]>({
    queryKey: ['/api/posts', postId, 'comments'],
  });

  // Memoized functions
  const updateMarginCommentPositions = useCallback(() => {
    if (!comments?.length) return;
    
    const inlineComments = comments.filter(comment => comment.elementId);
    const commentPositions: Array<{id: number; top: number; comment: Comment}> = [];
    
    for (const comment of inlineComments) {
      const targetElement = document.getElementById(comment.elementId);
      if (!targetElement) continue;
      
      const rect = targetElement.getBoundingClientRect();
      const containerRect = document.querySelector('.post-content-container')?.getBoundingClientRect();
      
      if (!containerRect) continue;
      
      const topPosition = rect.top - containerRect.top;
      
      commentPositions.push({
        id: comment.id,
        top: topPosition,
        comment
      });
    }
    
    setMarginComments(commentPositions);
  }, [comments]);
  
  // Process the HTML content to add IDs to paragraphs for targeting comments
  const processContent = useCallback((html: string) => {
    if (!html) return '';
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const elements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
    
    elements.forEach((el, index) => {
      if (!el.id) {
        el.id = `content-element-${index}`;
      }
      
      // Highlight text that has comments attached to it
      if (comments?.some(comment => comment.elementId === el.id)) {
        el.classList.add('comment-highlight');
      }
    });
    
    return tempDiv.innerHTML;
  }, [comments]);
  
  // Side effects
  useEffect(() => {
    if (comments?.length) {
      updateMarginCommentPositions();
      
      const contentContainer = document.querySelector('.post-content-container');
      if (contentContainer) {
        const handleScroll = () => updateMarginCommentPositions();
        contentContainer.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleScroll);
        
        // Initial position calculation after a small delay to ensure DOM is ready
        const timeoutId = setTimeout(updateMarginCommentPositions, 200);
        
        return () => {
          contentContainer.removeEventListener('scroll', handleScroll);
          window.removeEventListener('resize', handleScroll);
          clearTimeout(timeoutId);
        };
      }
    }
  }, [comments, updateMarginCommentPositions]);
  
  // Render functions - must be defined after all hooks
  const renderMarginComments = () => {
    return marginComments.map(({ id, top, comment }) => (
      <div 
        key={id} 
        className="margin-comment" 
        style={{ top: `${top}px` }}
      >
        <div className="flex items-start">
          <Avatar className="h-6 w-6">
            <AvatarImage src={comment.author.photoURL} alt={comment.author.displayName} />
            <AvatarFallback>{comment.author.displayName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="ml-2 flex-1">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">{comment.author.displayName}</span>
            </div>
            <p className="text-xs mt-1">{comment.content}</p>
          </div>
        </div>
      </div>
    ));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900 bg-opacity-75">
        <div className="flex items-center justify-center min-h-screen">
          <div className="relative bg-white w-full max-w-5xl mx-auto rounded-lg shadow-xl max-h-[90vh] overflow-y-auto p-12">
            <Skeleton className="absolute top-4 right-4 h-6 w-6 rounded-full" />
            <div className="flex flex-col md:flex-row">
              <div className="w-full md:w-3/4 pr-0 md:pr-8">
                <Skeleton className="h-8 w-3/4 mb-4" />
                <div className="flex items-center mb-6">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-24 ml-2" />
                  <Skeleton className="h-4 w-16 ml-4" />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
              <div className="w-full md:w-1/4 mt-8 md:mt-0 border-t md:border-t-0 md:border-l border-neutral-200 pt-8 md:pt-0 md:pl-8">
                <Skeleton className="h-6 w-24 mb-4" />
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !post) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900 bg-opacity-75">
        <div className="flex items-center justify-center min-h-screen">
          <div className="relative bg-white w-full max-w-5xl mx-auto rounded-lg shadow-xl p-12">
            <Link href="/">
              <Button variant="ghost" className="absolute top-4 right-4">
                <X className="h-6 w-6" />
              </Button>
            </Link>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-500 mb-4">Error Loading Post</h2>
              <p className="text-neutral-600 mb-6">The post you're looking for could not be loaded.</p>
              <Link href="/">
                <Button>Return to Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Format the date using our utility
  const formattedDate = formatDate(post.createdAt);

  // Make sure author data is available to prevent crashes
  if (!post.author) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900 bg-opacity-75">
        <div className="flex items-center justify-center min-h-screen">
          <div className="relative bg-white w-full max-w-5xl mx-auto rounded-lg shadow-xl p-12">
            <Link href="/">
              <Button variant="ghost" className="absolute top-4 right-4">
                <X className="h-6 w-6" />
              </Button>
            </Link>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-amber-700 mb-4">Loading Post Details...</h2>
              <p className="text-neutral-600 mb-6">Please wait while we load the complete post information.</p>
              <Link href="/">
                <Button>Return to Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900 bg-opacity-75">
      <div className="flex items-center justify-center min-h-screen">
        <div className="relative post-card w-full max-w-5xl mx-auto rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
          <Link href="/">
            <Button variant="ghost" className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-700">
              <X className="h-6 w-6" />
            </Button>
          </Link>
          
          <div className="px-6 pt-12 pb-8 md:p-12 flex flex-col md:flex-row">
            <div className="w-full md:w-3/4 pr-0 md:pr-8 relative post-content-container">
              <h1 className="text-2xl md:text-3xl font-heading font-bold">{post.title}</h1>
              <div className="mt-2 mb-6 flex items-center">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={post.author.photoURL} alt={post.author.displayName} />
                  <AvatarFallback>{post.author.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="ml-2 text-sm">{post.author.displayName}</span>
                <span className="mx-2 text-neutral-300">•</span>
                <span className="text-sm">{formattedDate}</span>
              </div>
              
              <div className="prose prose-lg max-w-none relative">
                <div 
                  dangerouslySetInnerHTML={{ __html: processContent(post.content) }} 
                />
                {renderMarginComments()}
              </div>
              
              {currentUser && post.authorId === parseInt(currentUser.uid) && (
                <div className="mt-6 flex">
                  <Link href={`/edit/${post.id}`}>
                    <Button variant="outline" className="mr-2">Edit Post</Button>
                  </Link>
                </div>
              )}
            </div>
            
            <CommentSection 
              postId={post.id} 
              comments={comments || []} 
              isLoading={commentsLoading} 
              showComments={showComments} 
              setShowComments={setShowComments} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostView;