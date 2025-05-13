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

  // Prepare style for comments container with dynamic height
  // Only set a height if we have a valid positive height value
  const containerStyle = contentHeight && contentHeight > 100 ? {
    height: `${contentHeight}px`,
    maxHeight: `${contentHeight}px`, // Ensure it doesn't grow beyond this height
  } : {};

  return (
    <div className="gdocs-comment-section w-full h-full flex flex-col border-l border-[#a67a48] bg-transparent">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#a67a48] bg-transparent">
        <h3 className="font-heading font-semibold text-lg text-[#a67a48]">Comments</h3>
      </div>
      
      {/* Comments list with dynamic height matching content container */}
      <div 
        ref={commentsRef}
        className="comments-container overflow-y-auto px-4 py-6 space-y-6 bg-transparent"
        style={containerStyle}
      >
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#f5f0e0] p-4 rounded-lg shadow-md">
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
              <div className="bg-[#f5f0e0] p-6 rounded-lg text-center shadow-md">
                <p className="text-[#a67a48] font-medium">No comments yet</p>
                <p className="text-sm text-[#a67a48]/80 mt-2">Select text and right-click to add the first comment</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Instructions for commenting */}
      <div className="px-4 py-3 border-t border-[#a67a48] bg-[#f5f0e0]/60">
        <div className="flex items-center justify-center space-x-2">
          <p className="text-sm text-[#a67a48] font-medium">
            To add a comment, select text and right-click
          </p>
        </div>
      </div>
    </div>
  );
};

export default GoogleDocsCommentSection;