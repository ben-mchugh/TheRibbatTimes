import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRoute, useLocation } from 'wouter';
import { Post, User } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import PostCard from '@/components/PostCard';
import { format } from 'date-fns';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Profile() {
  const { currentUser } = useAuth();
  const [match, params] = useRoute('/profile/:userId');
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [postToDelete, setPostToDelete] = useState<number | null>(null);
  
  // Set longer cache time for profile data
  const cacheTime = 1000 * 60 * 5; // 5 minutes
  
  // Handle post deletion
  const handleDeletePost = async (postId: number) => {
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete post');
      }
      
      // Invalidate the posts query to refresh the list
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/posts`] });
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      
      toast({
        title: 'Post deleted',
        description: 'Your post has been permanently deleted.',
      });
      
      setPostToDelete(null);
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete post. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
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

  // Separate drafts from published posts
  const { draftPosts, publishedPosts } = useMemo(() => {
    // Log posts for debugging
    console.log('All user posts:', userPosts.map(p => ({id: p.id, title: p.title, isDraft: p.isDraft})));
    
    // Let's be super explicit with our boolean checks for drafts
    const drafts = [];
    const published = [];
    
    for (const post of userPosts) {
      // Very explicit check to make sure we're getting true booleans
      if (post.isDraft === true) {
        console.log('Found draft post:', post.id, post.title);
        drafts.push(post);
      } else {
        published.push(post);
      }
    }
    
    console.log('Draft posts:', drafts.length, 'Published posts:', published.length);
    return { draftPosts: drafts, publishedPosts: published };
  }, [userPosts]);

  // Group published posts by month and year - using useMemo to prevent recalculating on every render
  const { groupedPosts, sortedMonths } = useMemo(() => {
    const grouped = publishedPosts.reduce((groups, post) => {
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
          <TabsTrigger value="posts">Published Posts</TabsTrigger>
          {isOwnProfile && (
            <TabsTrigger value="drafts" className="relative">
              Drafts
              {draftPosts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {draftPosts.length}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="saved">Saved</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
        </TabsList>
        
        {/* Published Posts tab */}
        <TabsContent value="posts">
          {postsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : publishedPosts.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-lg mb-4">No published posts yet</p>
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
                      <div key={post.id} className="relative group">
                        {isOwnProfile && (
                          <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <AlertDialog open={postToDelete === post.id} onOpenChange={(open) => !open && setPostToDelete(null)}>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  className="h-8 w-8 p-0 rounded-full bg-red-100 hover:bg-red-200"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setPostToDelete(post.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Post</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this post? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setPostToDelete(null)}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-500 hover:bg-red-600"
                                    onClick={() => handleDeletePost(post.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                        <PostCard 
                          post={post} 
                          profile={profile}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Drafts tab - only visible to the user's own profile */}
        {isOwnProfile && (
          <TabsContent value="drafts">
            {postsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : draftPosts.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-lg mb-4">No drafts saved</p>
                <Link href="/new">
                  <Button style={{ backgroundColor: '#43ac78' }}>Create New Post</Button>
                </Link>
              </Card>
            ) : (
              <div className="space-y-4">
                <h2 className="text-xl font-heading mb-4 pb-2 border-b" style={{ color: "#a67a48" }}>
                  Your Drafts
                </h2>
                <div className="space-y-4">
                  {draftPosts.map((post) => (
                    <div key={post.id} className="relative group">
                      <div className="absolute top-3 right-3 z-10 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <AlertDialog open={postToDelete === post.id} onOpenChange={(open) => !open && setPostToDelete(null)}>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              className="h-8 w-8 p-0 rounded-full bg-red-100 hover:bg-red-200"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPostToDelete(post.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Draft</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this draft? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setPostToDelete(null)}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-500 hover:bg-red-600"
                                onClick={() => handleDeletePost(post.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      
                      <Link href={`/edit/${post.id}`} className="block">
                        <Card className="post-card shadow overflow-hidden sm:rounded-lg cursor-pointer transform transition-all duration-300 ease-out hover:shadow-2xl hover:scale-[1.02] hover:shadow-[0_15px_35px_-5px_rgba(53,42,30,0.5)]" 
                          style={{ backgroundColor: "#e0d3af" }}>
                          <CardContent className="p-0">
                            <div className="px-4 py-5 sm:px-6 flex justify-between">
                              <div>
                                <h2 className="text-xl font-heading font-bold" style={{ color: "#161718" }}>{post.title}</h2>
                                <div className="mt-1 flex items-center">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage 
                                      src={post.author?.photoURL || profile?.photoURL || ''} 
                                      alt={post.author?.displayName || profile?.displayName || 'User'} 
                                    />
                                    <AvatarFallback>
                                      {(post.author?.displayName || profile?.displayName || 'U').charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="ml-2 text-sm" style={{ color: "#161718" }}>
                                    {post.author?.displayName || profile?.displayName || 'User'}
                                  </span>
                                  <span className="mx-2" style={{ color: "#444444" }}>•</span>
                                  <span className="text-sm flex items-center gap-1" style={{ color: "#161718" }}>
                                    Last edited: {format(new Date(post.updatedAt), 'MMM d, yyyy')}
                                    <span className="ml-1 inline-flex bg-amber-100 text-amber-800 p-0.5 rounded-full">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                      </svg>
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="px-4 py-4 sm:px-6 border-t" style={{ borderColor: "#a67a48" }}>
                              <p className="line-clamp-3" style={{ color: "#161718" }}>
                                {post.content.replace(/<[^>]*>/g, '').substring(0, 250)}...
                              </p>
                              <div className="mt-3 flex justify-between items-center text-sm">
                                <span style={{ color: "#a67a48" }}>
                                  {post.tags && post.tags.length > 0 ? post.tags.join(', ') : 'No tags'}
                                </span>
                                <Button size="sm" style={{ backgroundColor: '#43ac78' }}>
                                  Continue Editing
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        )}
        
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