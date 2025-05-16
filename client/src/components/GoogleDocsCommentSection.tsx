import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Comment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronRight, X } from 'lucide-react';
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
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  
  // Track accumulated scroll delta to create smoother scrolling
  const scrollState = useRef({
    lastY: 0,
    accumulator: 0,
    animating: false
  });
  
  // Function to handle wheel events to redirect scrolling to the main content
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault(); // Prevent default scrolling behavior
    
    // Smooth factor
    const smoothFactor = 0.65; // Lower number = smoother but less responsive
    
    // Add to accumulator
    scrollState.current.accumulator += e.deltaY * smoothFactor;
    
    // If we're not already animating, start animation
    if (!scrollState.current.animating) {
      scrollState.current.animating = true;
      
      const animateScroll = () => {
        // Move 25% of the remaining distance each frame
        const moveAmount = scrollState.current.accumulator * 0.25;
        
        if (Math.abs(moveAmount) < 0.1) {
          // Stop animating when the movement is very small
          scrollState.current.accumulator = 0;
          scrollState.current.animating = false;
          return;
        }
        
        window.scrollBy({
          top: moveAmount
        });
        
        // Reduce accumulator by the amount we moved
        scrollState.current.accumulator -= moveAmount;
        
        // Continue animation
        requestAnimationFrame(animateScroll);
      };
      
      requestAnimationFrame(animateScroll);
    }
  }, []);
  
  // Handle key down events to detect Ctrl key press
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Control') {
      setIsCtrlPressed(true);
    }
  }, []);

  // Handle key up events to detect Ctrl key release
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Control') {
      setIsCtrlPressed(false);
    }
  }, []);

  // Add wheel event listener on mount, remove on unmount
  useEffect(() => {
    const commentsContainer = commentsRef.current;
    
    // If Ctrl is pressed, don't add the wheel event listener so comments can scroll naturally
    if (commentsContainer && !isCtrlPressed) {
      commentsContainer.addEventListener('wheel', handleWheel, { passive: false });
    } else if (commentsContainer) {
      commentsContainer.removeEventListener('wheel', handleWheel);
    }
    
    // Add keydown and keyup event listeners to document
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    return () => {
      if (commentsContainer) {
        commentsContainer.removeEventListener('wheel', handleWheel);
      }
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleWheel, handleKeyDown, handleKeyUp, isCtrlPressed]);
  
  // Function to align a comment with its corresponding highlighted text
  const alignCommentWithHighlight = useCallback((commentId: number, providedHighlightPosition?: number) => {
    if (!commentsRef.current) return;

    const commentElement = commentsRef.current.querySelector(`[data-comment-id="${commentId}"]`) as HTMLElement;
    if (!commentElement) return;
    
    let highlightPosition: number;
    
    // If a highlight position was provided, use it
    if (providedHighlightPosition !== undefined) {
      highlightPosition = providedHighlightPosition;
    } else {
      // Otherwise, find the highlight element and get its position
      const highlightElement = document.querySelector(`.selection-highlight[data-comment-id="${commentId}"]`) as HTMLElement;
      if (!highlightElement) return;
      
      const highlightRect = highlightElement.getBoundingClientRect();
      highlightPosition = highlightRect.top; // Use the top of the highlight
    }
    
    // Get the comment element's position and dimensions
    const commentRect = commentElement.getBoundingClientRect();
    
    // Get the current scroll position of the comments container
    const container = commentsRef.current;
    const currentScrollTop = container.scrollTop;
    
    // Calculate the new scroll position to align at 80% down the comment bubble
    // This positions the comment with its lower portion near the highlighted text
    const alignmentPoint = commentRect.top + (commentRect.height * 0.8);
    const newScrollTop = currentScrollTop + (alignmentPoint - highlightPosition);
    
    // Scroll the container (not the page)
    container.scrollTo({
      top: newScrollTop,
      behavior: 'smooth'
    });
  }, []);

  // Listen for forced focus events from the toggle replies function
  useEffect(() => {
    const handleForceFocus = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.commentId) {
        const { commentId, highlightPosition } = customEvent.detail;
        alignCommentWithHighlight(commentId, highlightPosition);
      }
    };
    
    const container = commentsRef.current;
    if (container) {
      container.addEventListener('forceFocusComment', handleForceFocus);
    }
    
    return () => {
      if (container) {
        container.removeEventListener('forceFocusComment', handleForceFocus);
      }
    };
  }, [alignCommentWithHighlight]);

  // When focusedCommentId changes, scroll the comment to match the highlight position
  useEffect(() => {
    if (focusedCommentId) {
      alignCommentWithHighlight(focusedCommentId);
    }
  }, [focusedCommentId, alignCommentWithHighlight]);

  // Filter to get only top-level comments (no replies)
  const topLevelComments = comments.filter(comment => !comment.parentId);
  
  // Sort comments by selection position rather than time
  const sortedComments = [...topLevelComments].sort((a, b) => {
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

  // Prepare style for comments container with dynamic height
  // Set a minimal height that will be at least 100vh or match content height if it's taller
  const containerStyle = {
    minHeight: 'calc(100vh - 120px)', // Full viewport height minus header/margins
    height: contentHeight && contentHeight > 100 ? `${contentHeight + 100}px` : 'calc(100vh - 120px)',
    // Show webkit scrollbar when Ctrl is pressed
    WebkitScrollbarWidth: isCtrlPressed ? '8px' : '0px',
  };

  return (
    <div className="gdocs-comment-section w-full h-full flex flex-col border-l-2 border-[#444444] bg-[#161718]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#444444] bg-[#161718]">
        <h3 className="font-heading font-semibold text-lg text-[#888888]">Comments</h3>
      </div>
      
      {/* Visual indicator for independent scrolling */}
      <div className={`bg-[#444444] text-xs py-1 px-4 text-center transition-opacity duration-300 ${isCtrlPressed ? 'opacity-100 text-white animate-pulse' : 'opacity-70 text-gray-300'}`}>
        {isCtrlPressed ? (
          <>Independent scrolling <span className="font-bold">enabled</span> (Ctrl key pressed)</>
        ) : (
          <>Hold <span className="px-1 py-0.5 bg-[#333333] rounded text-white">Ctrl</span> to scroll comments independently</>
        )}
      </div>
      
      {/* Comments list with vertical scrolling */}
      <div 
        ref={commentsRef}
        className={`comments-container overflow-y-auto py-8 bg-[#161718] flex-1 px-6 overscroll-contain ${isCtrlPressed ? 'cursor-ns-resize ctrl-pressed' : ''}`}
        style={{
          ...containerStyle,
          scrollbarWidth: isCtrlPressed ? 'thin' : 'none', /* Show scrollbar when Ctrl is pressed in Firefox */
          msOverflowStyle: isCtrlPressed ? 'auto' : 'none' /* Show scrollbar when Ctrl is pressed in IE and Edge */
        }}
      >
        {isLoading ? (
          <div className="flex flex-col space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#e8e8e8]/95 backdrop-blur-sm p-4 rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.15)] border border-[#e8e8e8]/80 opacity-100 w-[280px]">
                <div className="flex items-start">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-5 w-28" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-4 w-full mt-2" />
                    <Skeleton className="h-4 w-3/4 mt-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col space-y-8">
            {sortedComments.length > 0 ? (
              <>
                {/* Extra padding at the top for scrolling */}
                <div>
                  {/* Buffer space at the top for extensive scrolling */}
                  {Array.from({ length: 100 }).map((_, index) => (
                    <div key={`top-buffer-${index}`} className="py-10 opacity-0">
                      Top buffer space {index + 1}
                    </div>
                  ))}
                  <div className="py-10"></div>
                </div>
                
                {sortedComments.map((comment, index) => (
                  <div 
                    key={`comment-${comment.id}`}
                    className="transition-all duration-300 animate-comment-enter"
                    style={{ 
                      animationDelay: `${index * 50}ms`,
                      animationFillMode: 'both'
                    }}
                    data-comment-id={comment.id}
                  >
                    <GoogleDocsComment
                      comment={comment} 
                      postId={postId}
                      onDelete={() => {
                        refetchComments();
                        queryClient.invalidateQueries({ queryKey: ['/api/posts', postId] });
                        queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
                      }}
                      onUpdate={() => {
                        refetchComments();
                      }}
                      onReply={() => {
                        refetchComments();
                        queryClient.invalidateQueries({ queryKey: ['/api/posts', postId] });
                        queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
                      }}
                      refetchComments={refetchComments}
                      focusedCommentId={focusedCommentId}
                    />
                  </div>
                ))}
                
                {/* Extra padding at the bottom for scrolling */}
                <div>
                  <div className="py-20"></div>
                  {/* Additional buffer space for extreme scrolling */}
                  {Array.from({ length: 100 }).map((_, index) => (
                    <div key={`bottom-buffer-${index}`} className="py-10 opacity-0">
                      Bottom buffer space {index + 1}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-[#e8e8e8]/95 backdrop-blur-sm p-6 rounded-lg text-center shadow-[0_4px_16px_rgba(0,0,0,0.15)] border border-[#e8e8e8]/80 opacity-100 w-[95%] min-w-[260px] mx-auto">
                <p className="text-[#444444] font-medium">No comments yet</p>
                <p className="text-sm text-[#444444]/80 mt-2">Select text and right-click to add the first comment</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleDocsCommentSection;