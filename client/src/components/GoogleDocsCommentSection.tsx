import React, { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Comment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import GoogleDocsComment from './GoogleDocsComment';

interface GoogleDocsCommentSectionProps {
  postId: number;
  comments: Comment[];
  isLoading: boolean;
  showComments: boolean;
  setShowComments: (show: boolean) => void;
  refetchComments: () => void;
  focusedCommentId: number | null;
}

const GoogleDocsCommentSection: React.FC<GoogleDocsCommentSectionProps> = ({
  postId,
  comments,
  isLoading,
  showComments,
  setShowComments,
  refetchComments,
  focusedCommentId
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

  return (
    <div className="gdocs-comment-section w-full h-full flex flex-col border-l border-[#a67a48]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#a67a48]">
        <h3 className="font-heading font-semibold text-lg text-[#a67a48]">Comments</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowComments(false)} 
          className="md:hidden text-[#161718] hover:text-[#a67a48]"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Comments list */}
      <div 
        ref={commentsRef}
        className="comments-container flex-1 overflow-y-auto p-4 space-y-4"
      >
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#f5f0e0] p-4 rounded-lg">
                <div className="flex items-start">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="ml-2 flex-1">
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-4 w-full mt-1" />
                    <Skeleton className="h-4 w-3/4 mt-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {topLevelComments && topLevelComments.length > 0 ? (
              topLevelComments.map((comment) => (
                <GoogleDocsComment 
                  key={`comment-${comment.id}`} 
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
              ))
            ) : (
              <div className="bg-[#f5f0e0] p-4 rounded-lg text-center py-6 text-[#a67a48]">
                No comments yet
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Instructions for commenting */}
      <div className="p-4 border-t border-[#a67a48] text-center">
        <p className="text-sm text-[#a67a48]">
          To add a comment, select text and right-click
        </p>
      </div>
    </div>
  );
};

export default GoogleDocsCommentSection;