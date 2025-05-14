import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Comment, Post } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, MessageSquare } from 'lucide-react';
import GoogleDocsCommentSection from './GoogleDocsCommentSection';

interface GoogleDocsPostViewProps {
  postId: number;
}

const GoogleDocsPostView: React.FC<GoogleDocsPostViewProps> = ({ postId }) => {
  const [showComments, setShowComments] = useState(true);
  const [focusedCommentId, setFocusedCommentId] = useState<number | null>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);
  
  const postContentRef = useRef<HTMLDivElement>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  // Fetch post data
  const { 
    data: post, 
    isLoading: isLoadingPost,
    error: postError,
  } = useQuery({
    queryKey: ['/api/posts', postId],
    queryFn: async () => {
      const response = await fetch(`/api/posts/${postId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch post: ${response.status}`);
      }
      return response.json();
    },
  });
  
  // Fetch comments for this post
  const { 
    data: comments = [],
    isLoading: isLoadingComments,
    refetch: refetchComments,
  } = useQuery({
    queryKey: ['/api/posts', postId, 'comments'],
    queryFn: async () => {
      const response = await fetch(`/api/posts/${postId}/comments`);
      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!postId,
  });

  // Optimize height calculation with debouncing
  useEffect(() => {
    if (!postContentRef.current) return;
    
    // Update height function with requestAnimationFrame for better performance
    const updateHeight = () => {
      requestAnimationFrame(() => {
        if (postContentRef.current) {
          setContentHeight(postContentRef.current.offsetHeight);
        }
      });
    };
    
    // Initial calculation
    updateHeight();
    
    // Debounced resize observer
    let debounceTimeout: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (debounceTimeout) {
        window.clearTimeout(debounceTimeout);
      }
      debounceTimeout = window.setTimeout(updateHeight, 250);
    });
    
    resizeObserver.observe(postContentRef.current);
    
    return () => {
      resizeObserver.disconnect();
      if (debounceTimeout) {
        window.clearTimeout(debounceTimeout);
      }
    };
  }, [post?.content]);

  // Format the post date
  const formattedDate = post?.createdAt 
    ? format(new Date(post.createdAt), 'MMMM d, yyyy')
    : '';
  
  if (isLoadingPost) {
    return (
      <div className="p-6 bg-[#e0d3af] rounded-lg animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }
  
  if (postError) {
    return (
      <div className="p-6 bg-[#e0d3af] rounded-lg text-center">
        <h2 className="text-xl font-bold text-[#161718] mb-4">Error Loading Post</h2>
        <p className="text-[#161718]">
          We couldn't load this post. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="relative px-0 pb-8 md:pb-8 md:px-4">
      <div className="flex flex-col md:flex-row w-full bg-[#e0d3af] rounded-lg overflow-hidden shadow-md">
        {/* Main content area */}
        <div className="flex-1 min-w-0 relative" ref={contentContainerRef}>
          {/* Post content */}
          <div className="p-6 md:p-8">
            <h1 className="text-3xl font-serif font-bold text-[#161718] mb-4">
              {post?.title}
            </h1>
            
            <div className="flex items-center mb-6 text-sm text-[#444444]">
              <div className="flex items-center">
                <Avatar className="h-8 w-8 mr-2">
                  {post?.author?.photoURL ? (
                    <AvatarImage src={post.author.photoURL} alt={post.author.displayName} />
                  ) : (
                    <AvatarFallback>{post?.author?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                  )}
                </Avatar>
                <span className="font-medium">{post?.author?.displayName || 'Unknown'}</span>
              </div>
              <span className="mx-2">•</span>
              <time dateTime={post?.createdAt}>{formattedDate}</time>
            </div>
            
            {/* Memory-optimized post content */}
            <div 
              className="post-main-content prose prose-lg max-w-none text-[#161718] prose-headings:text-[#161718] prose-strong:text-[#161718]"
              ref={postContentRef}
              dangerouslySetInnerHTML={{ __html: post?.content || '' }}
            />
          </div>
        </div>
        
        {/* Comments panel with optimized height calculation */}
        <div 
          className={`
            ${showComments ? 'block' : 'hidden'} 
            md:w-1/3 md:max-w-xs md:border-l border-[#444444]
            bg-[#e0d3af] overflow-y-auto
          `}
          style={{ height: isMobile ? 'auto' : contentHeight > 0 ? `${contentHeight}px` : 'auto' }}
        >
          <GoogleDocsCommentSection 
            postId={postId}
            comments={comments}
            isLoading={isLoadingComments}
            showComments={showComments}
            setShowComments={setShowComments}
            refetchComments={refetchComments}
            focusedCommentId={focusedCommentId}
            contentHeight={contentHeight}
          />
        </div>
        
        {/* Mobile toggle button */}
        <div className="md:hidden fixed bottom-4 right-4 z-10">
          <Button
            onClick={() => setShowComments(!showComments)}
            variant="secondary"
            size="icon"
            className="h-12 w-12 rounded-full shadow-xl bg-[#161718] text-white hover:bg-[#333333]"
          >
            {showComments ? <X /> : <MessageSquare />}
          </Button>
        </div>
        
        {/* Desktop toggle button */}
        <div className="hidden md:block absolute right-0 top-1/2 transform -translate-y-1/2 z-10">
          <Button
            onClick={() => setShowComments(!showComments)}
            variant="secondary"
            size="icon"
            className="h-8 w-8 rounded-full shadow-xl bg-[#161718] text-white hover:bg-[#333333]"
          >
            {showComments ? <ChevronRight /> : <ChevronLeft />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GoogleDocsPostView;