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
  
  // When focusedCommentId changes, scroll to that comment
  useEffect(() => {
    if (focusedCommentId && commentsRef.current) {
      const commentElement = commentsRef.current.querySelector(`[data-comment-id="${focusedCommentId}"]`);
      if (commentElement) {
        commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [focusedCommentId]);

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

  // No constraints to allow completely free scrolling
  const containerStyle = {
    // Remove all min/max constraints to allow unlimited scrolling
  };

  return (
    <div className="gdocs-comment-section w-full h-full flex flex-col border-l-2 border-[#444444] bg-[#161718] overflow-visible">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#444444] bg-[#161718]">
        <h3 className="font-heading font-semibold text-lg text-[#888888]">Comments</h3>
      </div>
      
      {/* Comments list with fixed height and own scrollbar */}
      <div 
        ref={commentsRef}
        className="comments-container px-4 py-6 space-y-6 bg-[#161718]"
        style={{
          position: 'relative',
          minHeight: '100%' // Ensure it fills the container
        }}
        data-infinite-scroll="true" // Mark for infinite scrolling
      >
        {isLoading ? (
          <div className="space-y-6">
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
          <div className="space-y-6">
            {/* Top spacer with absolute positioning for true infinite scrolling */}
            <div className="relative h-20 w-full overflow-visible">
              {/* Top spacers */}
              <div className="absolute top-[-1000px] left-0 w-full h-[1000px] bg-transparent"></div>
              <div className="absolute top-[-5000px] left-0 w-full h-[1000px] bg-transparent"></div>
              <div className="absolute top-[-10000px] left-0 w-full h-[1000px] bg-transparent"></div>
              <div className="absolute top-[-20000px] left-0 w-full h-[1000px] bg-transparent"></div>
              
              {/* Left spacers */}
              <div className="absolute left-[-1000px] top-0 w-[1000px] h-[1000px] bg-transparent"></div>
              <div className="absolute left-[-5000px] top-0 w-[1000px] h-[1000px] bg-transparent"></div>
              
              {/* Right spacers */}
              <div className="absolute right-[-1000px] top-0 w-[1000px] h-[1000px] bg-transparent"></div>
              <div className="absolute right-[-5000px] top-0 w-[1000px] h-[1000px] bg-transparent"></div>
            </div>
            
            {sortedComments.length > 0 ? (
              sortedComments.map((comment, index) => (
                <div 
                  key={`comment-${comment.id}`}
                  className="transition-all duration-300 animate-comment-enter"
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                    animationFillMode: 'both'
                  }}
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
              ))
            ) : (
              <div className="bg-[#e8e8e8]/95 backdrop-blur-sm p-6 rounded-lg text-center shadow-[0_4px_16px_rgba(0,0,0,0.15)] border border-[#e8e8e8]/80 opacity-100">
                <p className="text-[#444444] font-medium">No comments yet</p>
                <p className="text-sm text-[#444444]/80 mt-2">Select text and right-click to add the first comment</p>
              </div>
            )}
            
            {/* Bottom spacer with absolute positioning for truly endless scrolling */}
            <div className="relative h-20 w-full overflow-visible">
              {/* Bottom spacers */}
              <div className="absolute bottom-[-1000px] left-0 w-full h-[1000px] bg-transparent"></div>
              <div className="absolute bottom-[-5000px] left-0 w-full h-[1000px] bg-transparent"></div>
              <div className="absolute bottom-[-10000px] left-0 w-full h-[1000px] bg-transparent"></div>
              <div className="absolute bottom-[-20000px] left-0 w-full h-[1000px] bg-transparent"></div>
              
              {/* Diagonal spacers to ensure freedom in all directions */}
              <div className="absolute bottom-[-1000px] left-[-1000px] w-[1000px] h-[1000px] bg-transparent"></div>
              <div className="absolute bottom-[-1000px] right-[-1000px] w-[1000px] h-[1000px] bg-transparent"></div>
              <div className="absolute bottom-[-5000px] left-[-5000px] w-[1000px] h-[1000px] bg-transparent"></div>
              <div className="absolute bottom-[-5000px] right-[-5000px] w-[1000px] h-[1000px] bg-transparent"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleDocsCommentSection;