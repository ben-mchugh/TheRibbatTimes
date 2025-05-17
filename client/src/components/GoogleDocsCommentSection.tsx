import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Comment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronRight, X, MessageSquare } from 'lucide-react';
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
  const [isSKeyPressed, setIsSKeyPressed] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<number | null>(null);
  
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
  
  // Handle key down events to detect S key press
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 's' || e.key === 'S') {
      setIsSKeyPressed(true);
    }
  }, []);

  // Handle key up events to detect S key release
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 's' || e.key === 'S') {
      setIsSKeyPressed(false);
    }
  }, []);

  // Add wheel event listener on mount, remove on unmount
  useEffect(() => {
    const commentsContainer = commentsRef.current;
    
    // If S key is pressed, don't add the wheel event listener so comments can scroll naturally
    if (commentsContainer && !isSKeyPressed) {
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
  }, [handleWheel, handleKeyDown, handleKeyUp, isSKeyPressed]);
  
  // Function to align a comment with its corresponding highlighted text
  const alignCommentWithHighlight = useCallback((commentId: number, providedHighlightPosition?: number) => {
    console.log(`Aligning comment ${commentId} with highlight position:`, providedHighlightPosition);
    
    if (!commentsRef.current) {
      console.log("Comments ref is not available");
      return;
    }

    const commentElement = commentsRef.current.querySelector(`[data-comment-id="${commentId}"]`) as HTMLElement;
    if (!commentElement) {
      console.log(`Could not find comment element with ID ${commentId} in comments container`);
      return;
    }
    
    let highlightPosition: number;
    
    // If a highlight position was provided, use it
    if (providedHighlightPosition !== undefined) {
      highlightPosition = providedHighlightPosition;
      console.log(`Using provided highlight position: ${highlightPosition}`);
    } else {
      // Otherwise, find the highlight element and get its position
      const highlightElement = document.querySelector(`.selection-highlight[data-comment-id="${commentId}"]`) as HTMLElement;
      if (!highlightElement) {
        console.log(`Could not find highlight element for comment ${commentId}`);
        return;
      }
      
      const highlightRect = highlightElement.getBoundingClientRect();
      highlightPosition = highlightRect.top; // Use the top of the highlight
      console.log(`Found highlight element at position: ${highlightPosition}`);
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
        console.log("Received forceFocusComment event with commentId:", commentId, "and position:", highlightPosition);
        alignCommentWithHighlight(commentId, highlightPosition);
      } else {
        console.log("Received forceFocusComment event with missing details:", customEvent.detail);
      }
    };
    
    // Listen for activate comment events (from text selection clicks)
    const handleActivateComment = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.commentId) {
        const commentId = customEvent.detail.commentId;
        console.log("Received activateComment event, setting activeCommentId to:", commentId);
        
        // Set both active and focused comment IDs for consistent state
        setActiveCommentId(commentId);
        
        // Add this in case someone directly calls activateComment without setting focusedCommentId
        if (focusedCommentId !== commentId) {
          const focusEvent = new CustomEvent('setFocusedComment', {
            detail: { commentId: commentId }
          });
          
          // Send the event to the post content container
          const contentContainer = document.querySelector('.post-content-container');
          if (contentContainer) {
            contentContainer.dispatchEvent(focusEvent);
          }
        }
      } else {
        console.log("Received activateComment event but no commentId in detail:", customEvent.detail);
      }
    };
    
    // Listen for deactivate comment events (from background clicks)
    const handleDeactivateComment = () => {
      console.log("Deactivating comment");
      setActiveCommentId(null);
      
      // Clear all highlighted text as well
      const clearHighlights = () => {
        document.querySelectorAll('.selection-highlight').forEach(el => {
          el.classList.remove('highlight-focus');
        });
        console.log("Cleared all highlights from deactivate handler");
      };
      
      clearHighlights();
      
      // Send an event to the post content to clear the focusedCommentId
      const postContent = document.querySelector('.post-content-container');
      if (postContent) {
        const clearFocusEvent = new CustomEvent('clearFocusedComment');
        postContent.dispatchEvent(clearFocusEvent);
      }
    };
    
    const container = commentsRef.current;
    if (container) {
      container.addEventListener('forceFocusComment', handleForceFocus);
      container.addEventListener('activateComment', handleActivateComment);
      container.addEventListener('deactivateComment', handleDeactivateComment);
    }
    
    return () => {
      if (container) {
        container.removeEventListener('forceFocusComment', handleForceFocus);
        container.removeEventListener('activateComment', handleActivateComment);
        container.removeEventListener('deactivateComment', handleDeactivateComment);
      }
    };
  }, [alignCommentWithHighlight, setActiveCommentId]);

  // When focusedCommentId changes, scroll the comment to match the highlight position
  // and also set the activeCommentId to match
  useEffect(() => {
    if (focusedCommentId) {
      alignCommentWithHighlight(focusedCommentId);
      setActiveCommentId(focusedCommentId);
    }
  }, [focusedCommentId, alignCommentWithHighlight, setActiveCommentId]);

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
    // Always hide the webkit scrollbar
    WebkitScrollbarWidth: '0px',
  };

  return (
    <div className="gdocs-comment-section w-full h-full flex flex-col border-l-2 border-[#444444] bg-[#161718]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#444444] bg-[#161718]">
        <h3 className="font-heading font-semibold text-lg text-[#888888]">Comments</h3>
      </div>
      
      {/* Comments list with vertical scrolling */}
      <div 
        ref={commentsRef}
        className={`comments-container overflow-y-auto py-8 bg-[#161718] flex-1 px-6 overscroll-contain ${isSKeyPressed ? 'cursor-ns-resize' : ''}`}
        style={{
          ...containerStyle,
          scrollbarWidth: 'none', /* Always hide scrollbar in Firefox */
          msOverflowStyle: 'none' /* Always hide scrollbar in IE and Edge */
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
                    className=""
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
                      isActive={activeCommentId === comment.id}
                      setActive={(id) => setActiveCommentId(id)}
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