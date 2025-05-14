import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Comment, Post } from '@/lib/types';
import { format } from 'date-fns';
import GoogleDocsCommentSection from './GoogleDocsCommentSection';

interface GoogleDocsPostViewProps {
  postId: number;
}

const GoogleDocsPostView: React.FC<GoogleDocsPostViewProps> = ({ postId }) => {
  const [showComments, setShowComments] = useState(true);
  const [focusedCommentId, setFocusedCommentId] = useState<number | null>(null);
  
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

  // Format the post date
  const formattedDate = post?.createdAt 
    ? format(new Date(post.createdAt), 'MMMM d, yyyy')
    : '';
  
  if (isLoadingPost) {
    return <div>Loading...</div>;
  }
  
  if (postError) {
    return <div>Error loading post</div>;
  }

  return (
    <div className="relative px-4 py-6">
      <div className="bg-[#e0d3af] rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">{post?.title}</h1>
        <div className="mb-4">
          <time dateTime={post?.createdAt}>{formattedDate}</time>
        </div>
        
        <div 
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: post?.content || '' }}
        />
        
        <div className="mt-8">
          <GoogleDocsCommentSection 
            postId={postId}
            comments={comments}
            isLoading={isLoadingComments}
            showComments={showComments}
            setShowComments={setShowComments}
            refetchComments={refetchComments}
            focusedCommentId={focusedCommentId}
          />
        </div>
      </div>
    </div>
  );
};

export default GoogleDocsPostView;