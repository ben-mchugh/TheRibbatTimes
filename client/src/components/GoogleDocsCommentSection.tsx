import React, { useEffect, useRef } from 'react';
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
  
  // Filter to get only top-level comments (no replies)
  const topLevelComments = comments.filter(comment => !comment.parentId);
  
  // When focusedCommentId changes, scroll to that comment
  useEffect(() => {
    if (!focusedCommentId || !commentsRef.current) return;
    
    const commentElement = commentsRef.current.querySelector(`[data-comment-id="${focusedCommentId}"]`);
    if (!commentElement || !(commentElement instanceof HTMLElement)) return;
    
    const highlightElement = document.querySelector(`.selection-highlight[data-comment-id="${focusedCommentId}"]`);
    if (!highlightElement || !(highlightElement instanceof HTMLElement)) return;
    
    // Get positions
    const highlightRect = highlightElement.getBoundingClientRect();
    const highlightTop = highlightRect.top;
    const commentRect = commentElement.getBoundingClientRect();
    
    // Get the container and current scroll position
    const container = commentsRef.current;
    const currentScrollTop = container.scrollTop;
    
    // Check special cases
    const isLastComment = topLevelComments.findIndex(c => c.id === focusedCommentId) === 
                          topLevelComments.length - 1;
    const hasReplies = comments.some(c => c.parentId === focusedCommentId);
    
    // Handle different scenarios
    if (isLastComment) {
      // For last comment, align bottom with highlight (special case)
      const newScrollTop = currentScrollTop + (commentRect.bottom - highlightTop);
      container.scrollTo({
        top: newScrollTop,
        behavior: 'smooth'
      });
    } else if (hasReplies) {
      // For comments with replies, try to expand them
      const repliesToggle = commentElement.querySelector('.replies-toggle');
      
      if (repliesToggle instanceof HTMLButtonElement && 
          repliesToggle.getAttribute('data-expanded') !== 'true') {
        repliesToggle.click();
        
        // Give time for DOM to update
        setTimeout(() => {
          const replies = comments.filter(c => c.parentId === focusedCommentId);
          
          if (replies.length > 0 && commentsRef.current) {
            const lastReplyId = replies[replies.length - 1].id;
            const lastReplyElement = commentsRef.current.querySelector(`[data-comment-id="${lastReplyId}"]`);
            
            if (lastReplyElement instanceof HTMLElement) {
              const lastReplyRect = lastReplyElement.getBoundingClientRect();
              // Align with highlighted text at the same position in viewport
              const newScrollTop = currentScrollTop + (lastReplyRect.top - highlightTop);
              
              commentsRef.current.scrollTo({
                top: newScrollTop,
                behavior: 'smooth'
              });
            }
          }
        }, 100);
      } else {
        // Already expanded - just align with the highlighted text
        const newScrollTop = currentScrollTop + (commentRect.top - highlightTop);
        container.scrollTo({
          top: newScrollTop,
          behavior: 'smooth'
        });
      }
    } else {
      // Default: align top of comment at same height as highlight
      const newScrollTop = currentScrollTop + (commentRect.top - highlightTop);
      container.scrollTo({
        top: newScrollTop,
        behavior: 'smooth'
      });
    }
  }, [focusedCommentId, comments, topLevelComments]);
  
  // Sort comments by selection position
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

  // Set height for comments container to match content
  const containerStyle = {
    minHeight: 'calc(100vh - 120px)', // Full viewport height minus header/margins
    height: contentHeight && contentHeight > 100 ? `${contentHeight + 100}px` : 'calc(100vh - 120px)',
  };

  return (
    <div className="gdocs-comment-section w-full h-full flex flex-col border-l-2 border-[#444444] bg-[#161718]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#444444] bg-[#161718]">
        <h3 className="font-heading font-semibold text-lg text-[#888888]">Comments</h3>
      </div>
      
      {/* Comments list with vertical scrolling */}
      <div 
        ref={commentsRef}
        className="comments-container overflow-y-auto py-8 bg-[#161718] flex-1 px-6 overscroll-contain"
        style={{
          ...containerStyle,
          scrollbarWidth: 'thin',
          scrollbarColor: '#444444 #161718'
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
          <div className="flex flex-col space-y-2">
            {/* Top buffer space with additional scrolling room */}
            <div className="py-20"></div>
            {/* Extra buffer elements at top for more scrolling space */}
            {Array.from({ length: 50 }).map((_, index) => (
              <div key={`top-buffer-${index}`} className="py-10 opacity-0">
                Top buffer space {index + 1}
              </div>
            ))}
              
            {sortedComments.length > 0 ? (
              <>
                {/* Map through comments sorted by position */}
                {sortedComments.map((comment) => (
                  <div 
                    key={comment.id} 
                    className={`gdocs-comment relative ${focusedCommentId === comment.id ? 'focused' : ''}`}
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