import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
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
  const [params] = useParams();
  
  // If no userId is provided, use the current user's ID
  const userId = params?.userId ? parseInt(params.userId) : (currentUser?.id || 0);

  // Get profile information
  const { data: profile, isLoading: profileLoading } = useQuery<User>({
    queryKey: [userId === currentUser?.id ? '/api/profile' : `/api/users/${userId}`],
    enabled: !!userId,
  });

  // Get user's posts
  const { data: userPosts = [], isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: [`/api/users/${userId}/posts`],
    enabled: !!userId,
  });

  // Group posts by month and year
  const groupedPosts = userPosts.reduce((groups, post) => {
    const date = new Date(post.createdAt);
    const monthYear = format(date, 'MMMM yyyy');
    
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    
    groups[monthYear].push(post);
    return groups;
  }, {} as Record<string, Post[]>);

  // Sort by newest month first
  const sortedMonths = Object.keys(groupedPosts).sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateB.getTime() - dateA.getTime();
  });

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
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
        <p className="text-gray-500">{profile?.email || ''}</p>
        
        {currentUser?.id === userId && (
          <Link href="/new-post">
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
              {currentUser?.id === userId && (
                <Link href="/new-post">
                  <Button style={{ backgroundColor: '#43ac78' }}>Create Your First Post</Button>
                </Link>
              )}
            </Card>
          ) : (
            <div className="space-y-8">
              {sortedMonths.map((monthYear) => (
                <div key={monthYear}>
                  <h2 className="text-xl font-heading mb-4 pb-2 border-b monthly-header">
                    {monthYear}
                  </h2>
                  <div className="space-y-4">
                    {groupedPosts[monthYear].map((post) => (
                      <PostCard key={post.id} post={post} />
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