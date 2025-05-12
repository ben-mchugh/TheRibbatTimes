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
  // State hooks
  const [showComments, setShowComments] = useState(true);
  const [marginComments, setMarginComments] = useState<Array<{
    id: number;
    top: number;
    comment: Comment;
  }>>([]);

  // Auth hook  
  const { currentUser } = useAuth();
  
  // Data fetching
  const { data: post, isLoading: postLoading, error: postError } = useQuery<Post>({
    queryKey: ['/api/posts', postId],
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<Comment[]>({
    queryKey: ['/api/posts', postId, 'comments'],
  });

  // Comment position calculation
  const updateCommentPositions = useCallback(() => {
    if (!comments.length) return;
    
    const inlineComments = comments.filter(comment => comment.elementId);
    const positions: Array<{id: number; top: number; comment: Comment}> = [];
    
    for (const comment of inlineComments) {
      const targetElement = document.getElementById(comment.elementId);
      if (!targetElement) continue;
      
      const rect = targetElement.getBoundingClientRect();
      const containerRect = document.querySelector('.post-content-container')?.getBoundingClientRect();
      
      if (!containerRect) continue;
      
      const topPosition = rect.top - containerRect.top;
      
      positions.push({
        id: comment.id,
        top: topPosition,
        comment
      });
    }
    
    setMarginComments(positions);
  }, [comments]);
  
  // Update positions when comments change
  useEffect(() => {
    if (comments.length) {
      const contentContainer = document.querySelector('.post-content-container');
      if (contentContainer) {
        updateCommentPositions();
        const handleScroll = () => updateCommentPositions();
        
        contentContainer.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleScroll);
        
        // Initial calculation after render
        const timeoutId = setTimeout(updateCommentPositions, 200);
        
        return () => {
          contentContainer.removeEventListener('scroll', handleScroll);
          window.removeEventListener('resize', handleScroll);
          clearTimeout(timeoutId);
        };
      }
    }
  }, [comments, updateCommentPositions]);
  
  // HTML content processing
  const processContent = useCallback((html: string) => {
    if (!html) return '';
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const elements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
    
    elements.forEach((el, index) => {
      if (!el.id) {
        el.id = `content-element-${index}`;
      }
      
      // Highlight elements with comments
      if (comments.some(comment => comment.elementId === el.id)) {
        el.classList.add('comment-highlight');
      }
    });
    
    return tempDiv.innerHTML;
  }, [comments]);
  
  // Render functions
  const renderMarginComments = () => {
    return marginComments.map(({ id, top, comment }) => (
      <div 
        key={id} 
        className="margin-comment" 
        style={{ top: `${top}px` }}
      >
        <div className="flex items-start">
          <Avatar className="h-6 w-6">
            <AvatarImage src={comment.author?.photoURL} alt={comment.author?.displayName || 'User'} />
            <AvatarFallback>{comment.author?.displayName?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="ml-2 flex-1">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">{comment.author?.displayName || 'Anonymous'}</span>
            </div>
            <p className="text-xs mt-1">{comment.content}</p>
          </div>
        </div>
      </div>
    ));
  };

  // Loading state
  if (postLoading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900 bg-opacity-75">
        <div className="flex items-center justify-center min-h-screen">
          <div className="relative bg-[#e0d3af] w-full max-w-5xl mx-auto rounded-lg shadow-xl max-h-[90vh] overflow-y-auto p-12">
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
              <div className="w-full md:w-1/4 mt-8 md:mt-0 border-t md:border-t-0 md:border-l pt-8 md:pt-0 md:pl-8">
                <Skeleton className="h-6 w-24 mb-4" />
                <div className="space-y-4">
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
  if (postError || !post) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900 bg-opacity-75">
        <div className="flex items-center justify-center min-h-screen">
          <div className="relative bg-[#e0d3af] w-full max-w-5xl mx-auto rounded-lg shadow-xl p-12">
            <Link href="/">
              <Button variant="ghost" className="absolute top-4 right-4 text-[#161718]">
                <X className="h-6 w-6" />
              </Button>
            </Link>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-[#a67a48] mb-4">Error Loading Post</h2>
              <p className="text-[#161718] mb-6">The post you're looking for could not be loaded.</p>
              <Link href="/">
                <Button style={{ backgroundColor: '#a67a48' }}>Return to Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Safety checks for required data
  if (!post.author) {
    post.author = {
      id: 0,
      uid: 'unknown',
      displayName: 'Unknown Author',
      email: '',
      photoURL: '',
    };
  }

  // Format post date
  const formattedDate = formatDate(post.createdAt);

  // Main render
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#161718] bg-opacity-75">
      <div className="flex items-center justify-center min-h-screen">
        <div className="relative post-card w-full max-w-5xl mx-auto rounded-lg shadow-xl max-h-[90vh] overflow-y-auto bg-[#e0d3af]">
          <Link href="/">
            <Button 
              variant="ghost" 
              className="absolute top-4 right-4 text-[#161718] hover:text-[#a67a48]"
            >
              <X className="h-6 w-6" />
            </Button>
          </Link>
          
          <div className="px-6 pt-12 pb-8 md:p-12 flex flex-col md:flex-row">
            <div className="w-full md:w-3/4 pr-0 md:pr-8 relative post-content-container">
              <h1 className="text-2xl md:text-3xl font-heading font-bold text-[#161718] mb-4">{post.title}</h1>
              <div className="mt-2 mb-6 flex items-center">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={post.author.photoURL} alt={post.author.displayName} />
                  <AvatarFallback>{post.author.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="ml-2 text-sm text-[#161718]">{post.author.displayName}</span>
                <span className="mx-2 text-[#a67a48]">•</span>
                <span className="text-sm text-[#161718]">{formattedDate}</span>
              </div>
              
              <div className="prose prose-lg max-w-none relative text-[#161718]">
                <div 
                  dangerouslySetInnerHTML={{ __html: processContent(post.content) }} 
                  className="post-main-content"
                />
              </div>
              
              {currentUser && post.authorId === parseInt(currentUser.uid) && (
                <div className="mt-6 flex">
                  <Link href={`/edit/${post.id}`}>
                    <Button 
                      variant="outline" 
                      className="mr-2 border-[#a67a48] text-[#a67a48] hover:bg-[#a67a48] hover:text-[#e0d3af]"
                    >
                      Edit Post
                    </Button>
                  </Link>
                </div>
              )}
            </div>
            
            <div className="w-full md:w-1/4 mt-8 md:mt-0">
              <div className="sticky top-8">
                <h3 className="text-lg font-bold mb-4 text-[#a67a48]">Annotations</h3>
                <div className="annotations-container">
                  {marginComments.length > 0 ? (
                    renderMarginComments()
                  ) : (
                    <p className="text-sm text-[#161718] italic">No annotations yet. Select text to add comments.</p>
                  )}
                </div>
                
                <CommentSection 
                  postId={post.id} 
                  comments={comments} 
                  isLoading={commentsLoading} 
                  showComments={showComments} 
                  setShowComments={setShowComments} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostView;