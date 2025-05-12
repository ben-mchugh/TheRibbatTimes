import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import PostCard from './PostCard';
import { Post } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';

const PostList = () => {
  const { data: posts, isLoading, error } = useQuery<Post[]>({
    queryKey: ['/api/posts'],
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="px-4 sm:px-0">
          <Skeleton className="h-10 w-3/4 mb-2" />
          <Skeleton className="h-6 w-1/2" />
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-white shadow overflow-hidden sm:rounded-lg">
            <CardContent className="p-0">
              <div className="px-4 py-5 sm:px-6">
                <Skeleton className="h-6 w-2/3 mb-3" />
                <div className="flex items-center">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-24 ml-2" />
                  <Skeleton className="h-4 w-16 ml-4" />
                </div>
              </div>
              <div className="px-4 py-4 sm:px-6 border-t border-neutral-200">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
                <div className="mt-3 flex items-center">
                  <Skeleton className="h-4 w-24 mr-2" />
                  <Skeleton className="h-4 w-48 ml-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-white shadow overflow-hidden sm:rounded-lg">
        <CardContent className="p-6 text-center">
          <h3 className="text-xl font-medium text-red-500 mb-2">Error Loading Posts</h3>
          <p className="text-neutral-600">
            Unable to load posts. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <Card className="post-card shadow overflow-hidden sm:rounded-lg">
        <CardContent className="p-6 text-center">
          <h3 className="text-xl font-medium mb-2">No Posts Yet</h3>
          <p>
            Be the first to contribute to the monthly newsletter!
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // Group posts by month and year
  const groupedPosts = useMemo(() => {
    const groups: Record<string, Post[]> = {};
    
    posts.forEach(post => {
      const date = parseISO(post.createdAt);
      const monthYear = format(date, 'MMMM yyyy');
      
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      
      groups[monthYear].push(post);
    });
    
    // Sort the monthYear keys in reverse chronological order
    return Object.entries(groups)
      .sort((a, b) => {
        const dateA = new Date(a[0]);
        const dateB = new Date(b[0]);
        return dateB.getTime() - dateA.getTime();
      });
  }, [posts]);

  return (
    <div className="space-y-12">
      {groupedPosts.map(([monthYear, monthPosts]) => (
        <div key={monthYear} className="space-y-6">
          <h2 className="monthly-header">{monthYear}</h2>
          <div className="space-y-8">
            {monthPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PostList;
