import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import RichTextEditor from '@/components/Editor';
import { Post } from '@/lib/types';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function EditPost() {
  const { id } = useParams();
  const [_, setLocation] = useLocation();
  const { currentUser, loading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  // Format date as "Month Day, Year"
  const getFormattedDate = () => {
    const date = new Date();
    return date.toLocaleDateString('en-US', { 
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const [title, setTitle] = useState(isEditing ? '' : getFormattedDate());
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  // Fetch post data if editing an existing post
  const { data: post, isLoading: postLoading } = useQuery<Post>({
    queryKey: isEditing ? ['/api/posts', parseInt(id)] : [],
    enabled: isEditing,
  });

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !currentUser) {
      toast({
        title: 'Authentication required',
        description: 'You must be signed in to create or edit posts.',
        variant: 'destructive',
      });
      setLocation('/');
    }
  }, [currentUser, loading, setLocation, toast]);

  // Populate form if editing
  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setContent(post.content);
      setTags(post.tags ? post.tags.join(', ') : '');
      
      // Verify ownership
      if (currentUser && post.authorId !== parseInt(currentUser.uid)) {
        toast({
          title: 'Unauthorized',
          description: 'You do not have permission to edit this post.',
          variant: 'destructive',
        });
        setLocation('/');
      }
    }
  }, [post, currentUser, setLocation, toast]);

  // Set page title
  useEffect(() => {
    document.title = isEditing ? 'Edit Post - The Ribbat Times' : 'Create New Post - The Ribbat Times';
  }, [isEditing]);

  const createPostMutation = useMutation({
    mutationFn: async (postData: { title: string; content: string; tags: string[] }) => {
      const response = await apiRequest('POST', '/api/posts', postData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      toast({
        title: 'Post created',
        description: 'Your post has been published successfully.',
      });
      setLocation(`/post/${data.id}`);
    },
    onError: (error) => {
      console.error('Error creating post:', error);
      toast({
        title: 'Error creating post',
        description: 'There was a problem publishing your post. Please try again.',
        variant: 'destructive',
      });
    }
  });

  const updatePostMutation = useMutation({
    mutationFn: async (postData: { id: number; title: string; content: string; tags: string[] }) => {
      const response = await apiRequest('PATCH', `/api/posts/${postData.id}`, postData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/posts', data.id] });
      toast({
        title: 'Post updated',
        description: 'Your post has been updated successfully.',
      });
      setLocation(`/post/${data.id}`);
    },
    onError: (error) => {
      console.error('Error updating post:', error);
      toast({
        title: 'Error updating post',
        description: 'There was a problem updating your post. Please try again.',
        variant: 'destructive',
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a title for your post.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!content.trim() || content === '<p></p>') {
      toast({
        title: 'Content required',
        description: 'Please enter some content for your post.',
        variant: 'destructive',
      });
      return;
    }
    
    const tagArray = tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    if (isEditing && post) {
      updatePostMutation.mutate({
        id: post.id,
        title,
        content,
        tags: tagArray,
      });
    } else {
      createPostMutation.mutate({
        title,
        content,
        tags: tagArray,
      });
    }
  };

  if (loading || (isEditing && postLoading)) {
    return (
      <div className="py-6 px-4 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-heading font-bold text-neutral-900">
            {isEditing ? 'Edit Post' : 'Create New Post'}
          </h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-neutral-200 rounded w-1/3"></div>
              <div className="h-10 bg-neutral-200 rounded"></div>
              <div className="h-6 bg-neutral-200 rounded w-1/3"></div>
              <div className="h-40 bg-neutral-200 rounded"></div>
              <div className="h-6 bg-neutral-200 rounded w-1/3"></div>
              <div className="h-10 bg-neutral-200 rounded"></div>
              <div className="h-10 bg-neutral-200 rounded w-1/4 ml-auto"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="py-6 px-4 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-heading font-bold text-neutral-900">
          {isEditing ? 'Edit Post' : 'Create New Post'}
        </h1>
        <Button variant="outline" onClick={() => setLocation('/')}>
          Cancel
        </Button>
      </div>
      
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <Label htmlFor="post-title" className="block text-sm font-medium text-neutral-700 mb-1">
                Title
              </Label>
              <Input
                id="post-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full"
                placeholder="Enter a descriptive title..."
              />
            </div>
            
            <div className="mb-4">
              <Label htmlFor="post-content" className="block text-sm font-medium text-neutral-700 mb-1">
                Content
              </Label>
              <RichTextEditor content={content} onChange={setContent} />
            </div>
            
            <div className="mb-6">
              <Label htmlFor="post-tags" className="block text-sm font-medium text-neutral-700 mb-1">
                Tags
              </Label>
              <Input
                id="post-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full"
                placeholder="Add tags separated by commas..."
              />
              <p className="mt-1 text-sm text-neutral-500">
                Example: gardening, rainwater, community projects
              </p>
            </div>
            
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={createPostMutation.isPending || updatePostMutation.isPending}
              >
                {isEditing ? 
                  (updatePostMutation.isPending ? 'Updating...' : 'Update') : 
                  (createPostMutation.isPending ? 'Publishing...' : 'Publish')
                }
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
