/**
 * PostList Component
 * 
 * This component displays the chronological list of posts on the homepage.
 * Features include:
 * - Groups posts by month and year
 * - Displays posts in reverse chronological order (newest first)
 * - Shows stylized month headers with sepia-toned background
 * - Renders individual post cards with previews
 * - Supports scrolling to specific months via month navigator
 * - Handles loading states with skeleton placeholders
 */

import { useQuery } from '@tanstack/react-query';
import PostCard from './PostCard';
import { Post } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { useEffect, useRef } from 'react';

// Helper function to group posts by month
const groupPostsByMonth = (posts: Post[]) => {
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
};

interface PostListProps {
  isReturnedFromPost?: boolean;
}

const PostList = ({ isReturnedFromPost = false }: PostListProps) => {
  const scrollPositionRef = useRef<number | null>(null);
  
  const { data: posts, isLoading, error } = useQuery<Post[]>({
    queryKey: ['/api/posts'],
  });
  
  // Handle scroll position restoration
  useEffect(() => {
    // When component mounts, check if we're returning from a post
    if (isReturnedFromPost) {
      const savedPosition = sessionStorage.getItem('scrollPosition');
      if (savedPosition) {
        window.scrollTo(0, parseInt(savedPosition, 10));
        sessionStorage.removeItem('scrollPosition');
      }
    }
  }, [isReturnedFromPost]);
  
  // Handle click event listeners for post links
  useEffect(() => {
    // Save scroll position when navigating to a post
    const handleClick = () => {
      const scrollPosition = window.scrollY;
      sessionStorage.setItem('scrollPosition', scrollPosition.toString());
    };
    
    // Only add event listeners after posts have loaded
    if (posts && posts.length > 0) {
      // Use a small timeout to ensure DOM is updated with posts
      setTimeout(() => {
        const postLinks = document.querySelectorAll('a[href^="/post/"]');
        postLinks.forEach(link => {
          link.addEventListener('click', handleClick);
        });
      }, 100);
    }
    
    return () => {
      // Clean up event listeners
      const postLinks = document.querySelectorAll('a[href^="/post/"]');
      postLinks.forEach(link => {
        link.removeEventListener('click', handleClick);
      });
    };
  }, [posts]);

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
  
  // Generate grouped posts
  const groupedPosts = groupPostsByMonth(posts);

  return (
    <div className="space-y-12">
      {groupedPosts.map(([monthYear, monthPosts]) => {
        // Create a kebab-case ID from the month year for easier targeting
        const monthYearId = monthYear.toLowerCase().replace(/\s+/g, '-');
        
        return (
          <div key={monthYear} className="space-y-6" id={`month-section-${monthYearId}`}>
            <h2 id={monthYearId} className="monthly-header">
              <span id={`month-text-${monthYearId}`}>{monthYear}</span>
            </h2>
            <div className="space-y-8">
              {monthPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PostList;