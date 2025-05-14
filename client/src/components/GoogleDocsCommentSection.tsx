import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Comment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronRight, X, RefreshCw } from 'lucide-react';
import GoogleDocsComment from './GoogleDocsComment';

interface GoogleDocsCommentSectionProps {
  postId: number;
  comments: Comment[];
  isLoading: boolean;
  showComments: boolean;
  setShowComments: (show: boolean) => void;
  refetchComments: () => void;
  focusedCommentId: number | null;
  contentHeight?: number; // Optional height to match content container
}

// Memory-optimized version with virtual rendering for large comment counts
const GoogleDocsCommentSection: React.FC<GoogleDocsCommentSectionProps> = ({
  postId,
  comments,
  isLoading,
  showComments,
  setShowComments,
  refetchComments,
  focusedCommentId,
  contentHeight
}) => {
  const queryClient = useQueryClient();
  const commentsRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 15 });
  const [isScrolling, setIsScrolling] = useState(false);
  
  // Filter to get only top-level comments (no replies) with memoization
  const topLevelComments = useMemo(() => 
    comments.filter(comment => !comment.parentId),
    [comments]
  );
  
  // Sort comments by selection position rather than time (memoized)
  const sortedComments = useMemo(() => {
    return [...topLevelComments].sort((a, b) => {
      // If both comments have selection positions, sort by position
      if (a.selectionStart !== undefined && a.selectionStart !== null && 
          b.selectionStart !== undefined && b.selectionStart !== null) {
        return a.selectionStart - b.selectionStart;
      }
      // If only one has a selection position, prioritize it
      if (a.selectionStart !== undefined && a.selectionStart !== null) return -1;
      if (b.selectionStart !== undefined && b.selectionStart !== null) return 1;
      // Otherwise, fall back to creation time (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [topLevelComments]);

  // Calculate visible comments for virtual rendering
  const calculateVisibleRange = useCallback(() => {
    if (!commentsRef.current) return;
    
    const container = commentsRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    
    // Estimate average comment height (with some margin for variety)
    const estimatedItemHeight = 180;
    const bufferCount = 3; // Extra items to render above/below viewport
    
    // Calculate visible range with buffer
    const startIndex = Math.max(0, Math.floor(scrollTop / estimatedItemHeight) - bufferCount);
    const endIndex = Math.min(
      sortedComments.length,
      Math.ceil((scrollTop + containerHeight) / estimatedItemHeight) + bufferCount
    );
    
    setVisibleRange({ start: startIndex, end: endIndex });
  }, [sortedComments.length]);
  
  // Set up scroll handler with throttling
  useEffect(() => {
    if (!commentsRef.current) return;
    
    const container = commentsRef.current;
    let scrollTimeoutId: number | null = null;
    let isThrottled = false;
    
    const handleScroll = () => {
      // Show "is scrolling" visual cue
      setIsScrolling(true);
      
      // Clear any existing timeouts
      if (scrollTimeoutId) {
        window.clearTimeout(scrollTimeoutId);
      }
      
      // Only recalculate visible range if not throttled
      if (!isThrottled) {
        calculateVisibleRange();
        
        // Throttle updates to reduce strain during fast scrolling
        isThrottled = true;
        setTimeout(() => {
          isThrottled = false;
          // Recalculate once more when throttle ends
          if (commentsRef.current) {
            calculateVisibleRange();
          }
        }, 100);
      }
      
      // Reset scrolling state after scrolling stops
      scrollTimeoutId = window.setTimeout(() => {
        setIsScrolling(false);
        calculateVisibleRange(); // Final calculation when scroll ends
      }, 200);
    };
    
    // Initial calculation
    calculateVisibleRange();
    
    // Add event listener
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // Clean up
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutId) {
        window.clearTimeout(scrollTimeoutId);
      }
    };
  }, [calculateVisibleRange]);
  
  // When focusedCommentId changes, scroll to that comment
  useEffect(() => {
    if (focusedCommentId && commentsRef.current) {
      // Find position of focused comment
      const commentIndex = sortedComments.findIndex(c => c.id === focusedCommentId);
      
      if (commentIndex >= 0) {
        // Update visible range to include this comment
        setVisibleRange(prev => ({
          start: Math.max(0, Math.min(prev.start, commentIndex - 2)),
          end: Math.max(prev.end, commentIndex + 5)
        }));
        
        // Wait for render, then scroll
        requestAnimationFrame(() => {
          if (commentsRef.current) {
            const commentElement = commentsRef.current.querySelector(
              `[data-comment-id="${focusedCommentId}"]`
            );
            
            if (commentElement) {
              commentElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              });
            }
          }
        });
      }
    }
  }, [focusedCommentId, sortedComments]);

  // Prepare style for comments container with dynamic height
  const containerStyle = contentHeight && contentHeight > 100 ? {
    height: `${contentHeight}px`,
    maxHeight: `${contentHeight}px`,
  } : {};

  // Get visible comments for rendering
  const visibleComments = useMemo(() => 
    sortedComments.slice(visibleRange.start, visibleRange.end),
    [sortedComments, visibleRange]
  );
  
  // Calculate spacers for virtual scrolling
  const topSpacerHeight = visibleRange.start * 180; // 180px estimated height per comment
  const bottomSpacerHeight = (sortedComments.length - visibleRange.end) * 180;

  // Handle API calls efficiently with useCallback
  const handleDelete = useCallback((commentId: number) => {
    refetchComments();
    queryClient.invalidateQueries({ queryKey: ['/api/posts', postId] });
    queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
  }, [queryClient, postId, refetchComments]);
  
  const handleUpdate = useCallback(() => {
    refetchComments();
  }, [refetchComments]);
  
  const handleReply = useCallback(() => {
    refetchComments();
    queryClient.invalidateQueries({ queryKey: ['/api/posts', postId] });
    queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
  }, [queryClient, postId, refetchComments]);
  
  // Add a refresh button for better UX
  const refreshButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={refetchComments}
      className="h-8 w-8 bg-transparent text-[#888888] hover:text-[#e0d3af] hover:bg-transparent"
    >
      <RefreshCw className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="gdocs-comment-section w-full h-full flex flex-col border-l-2 border-[#444444] bg-[#161718]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#444444] bg-[#161718] sticky top-0 z-10">
        <h3 className="font-heading font-semibold text-lg text-[#888888]">
          Comments {!isLoading && `(${topLevelComments.length})`}
        </h3>
        <div className="flex space-x-1">
          {refreshButton}
        </div>
      </div>
      
      {/* Comments list with virtual rendering */}
      <div 
        ref={commentsRef}
        className="comments-container overflow-y-auto px-4 py-6 space-y-0 bg-[#161718]"
        style={containerStyle}
      >
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div key={i} className="bg-[#e8e8e8]/95 backdrop-blur-sm p-4 rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.15)] border border-[#e8e8e8]/80 opacity-100 w-[280px]">
                <div className="flex items-start">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-3 w-full mt-2" />
                    <Skeleton className="h-3 w-3/4 mt-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative">
            {/* Top spacer for virtual scrolling */}
            {topSpacerHeight > 0 && (
              <div style={{ height: `${topSpacerHeight}px` }} />
            )}
            
            {/* Only render visible comments */}
            <div className="space-y-6">
              {visibleComments.length > 0 ? (
                visibleComments.map((comment, index) => (
                  <div 
                    key={`comment-${comment.id}`}
                    data-comment-id={comment.id}
                    className="transition-opacity duration-200 will-change-auto"
                    style={{ opacity: isScrolling ? 0.8 : 1 }}
                  >
                    <GoogleDocsComment
                      comment={comment} 
                      postId={postId}
                      onDelete={handleDelete}
                      onUpdate={handleUpdate}
                      onReply={handleReply}
                      refetchComments={refetchComments}
                      focusedCommentId={focusedCommentId}
                    />
                  </div>
                ))
              ) : (
                sortedComments.length === 0 && (
                  <div className="bg-[#e8e8e8]/95 backdrop-blur-sm p-6 rounded-lg text-center shadow-[0_4px_16px_rgba(0,0,0,0.15)] border border-[#e8e8e8]/80 opacity-100">
                    <p className="text-[#444444] font-medium">No comments yet</p>
                    <p className="text-sm text-[#444444]/80 mt-2">Select text and right-click to add the first comment</p>
                  </div>
                )
              )}
            </div>
            
            {/* Bottom spacer for virtual scrolling */}
            {bottomSpacerHeight > 0 && (
              <div style={{ height: `${bottomSpacerHeight}px` }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Prevent unnecessary re-renders
export default React.memo(GoogleDocsCommentSection);