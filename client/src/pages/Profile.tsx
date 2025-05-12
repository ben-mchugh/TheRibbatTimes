import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRoute } from 'wouter';
import { Post, User } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import PostCard from '@/components/PostCard';
import { format } from 'date-fns';

export default function Profile() {
  const { currentUser } = useAuth();
  const [match, params] = useRoute('/profile/:userId');
  const queryClient = useQueryClient();
  
  // Set longer cache time for profile data
  const cacheTime = 1000 * 60 * 5; // 5 minutes
  
  // We need to fetch the user info from the backend first since Firebase user doesn't have our DB ID
  const { data: userInfo, isLoading: userInfoLoading } = useQuery<User>({
    queryKey: ['/api/profile'],
    enabled: !!currentUser,
    staleTime: cacheTime,
    gcTime: cacheTime,
  });
  
  // Determine if we're viewing our own profile or someone else's
  const isOwnProfile = !params?.userId || (userInfo && params.userId === userInfo.id.toString());
  
  // Get the user ID to fetch - ensure we have a valid ID
  const userId = isOwnProfile 
    ? (userInfo?.id || 0) 
    : (params?.userId ? parseInt(params.userId) : 0);

  // For non-own profiles, we need to fetch the user profile separately
  const { data: otherUserProfile, isLoading: otherProfileLoading } = useQuery<User>({
    queryKey: [!isOwnProfile ? `/api/users/${userId}` : null],
    enabled: !isOwnProfile && !!userId,
    staleTime: cacheTime,
    gcTime: cacheTime,
  });
  
  // Use the appropriate profile data based on whose profile we're viewing
  const profile = isOwnProfile ? userInfo : otherUserProfile;
  const profileLoading = isOwnProfile ? userInfoLoading : otherProfileLoading;

  // Get user's posts with the apiRequest utility to ensure proper fetching
  const { data: userPosts = [], isLoading: postsLoading, error } = useQuery<Post[]>({
    queryKey: [`/api/users/${userId}/posts`],
    enabled: !!userId && !!profile,
    staleTime: cacheTime,
    gcTime: cacheTime,
  });
  
  if (error) console.error('Error fetching posts:', error);

  // Group posts by month and year - using useMemo to prevent recalculating on every render
  const { groupedPosts, sortedMonths } = useMemo(() => {
    const grouped = userPosts.reduce((groups, post) => {
      const date = new Date(post.createdAt);
      const monthYear = format(date, 'MMMM yyyy');
      
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      
      groups[monthYear].push(post);
      return groups;
    }, {} as Record<string, Post[]>);

    // Sort by newest month first
    const sorted = Object.keys(grouped).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateB.getTime() - dateA.getTime();
    });
    
    return { groupedPosts: grouped, sortedMonths: sorted };
  }, [userPosts]);

  // Show simple loading state initially
  if (profileLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col items-center space-y-4 mb-8">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Profile header */}
      <div className="flex flex-col items-center space-y-4 mb-8">
        <Avatar className="h-24 w-24">
          <AvatarImage src={profile?.photoURL || ''} alt={profile?.displayName || 'User'} />
          <AvatarFallback>{profile?.displayName?.charAt(0) || 'U'}</AvatarFallback>
        </Avatar>
        <h1 className="text-2xl font-bold">{profile?.displayName || 'User Profile'}</h1>
        <p className="text-gray-500">{isOwnProfile ? profile?.email || '' : ''}</p>
        
        {isOwnProfile && (
          <Link href="/new">
            <Button style={{ backgroundColor: '#43ac78' }} className="font-medium">
              Create New Post
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs for different sections */}
      <Tabs defaultValue="posts">
        <TabsList className="w-full justify-start mb-6">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="saved">Saved</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
        </TabsList>
        
        {/* Posts tab */}
        <TabsContent value="posts">
          {postsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : userPosts.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-lg mb-4">No posts yet</p>
              {isOwnProfile && (
                <Link href="/new">
                  <Button style={{ backgroundColor: '#43ac78' }}>Create Your First Post</Button>
                </Link>
              )}
            </Card>
          ) : (
            <div className="space-y-8">
              {sortedMonths.map((monthYear) => (
                <div key={monthYear}>
                  <h2 className="text-xl font-heading mb-4 pb-2 border-b monthly-header" style={{ color: "#a67a48" }}>
                    {monthYear}
                  </h2>
                  <div className="space-y-4">
                    {groupedPosts[monthYear].map((post) => (
                      <PostCard 
                        key={post.id} 
                        post={post} 
                        profile={profile}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Saved tab (placeholder) */}
        <TabsContent value="saved">
          <Card className="p-8 text-center">
            <p className="text-gray-500">Saved posts will appear here</p>
          </Card>
        </TabsContent>
        
        {/* Comments tab (placeholder) */}
        <TabsContent value="comments">
          <Card className="p-8 text-center">
            <p className="text-gray-500">Your comments will appear here</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}