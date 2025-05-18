/**
 * EditPost Page
 * 
 * This page provides the interface for creating new posts or editing existing ones.
 * Features include:
 * - Rich text editor with formatting, font selection, and image upload
 * - Auto-populates with existing post data when editing
 * - Pre-fills the date in the title field for new posts
 * - Tag management for post categorization
 * - Draft saving and auto-saving functionality
 * - Validation before submission
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import RichTextEditor from '@/components/Editor';
import { Post } from '@/lib/types';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

// Debounce utility function to prevent excessive saving
function debounce(func: Function, wait: number) {
  let timeout: number | null = null;
  
  const debouncedFn = function(...args: any[]) {
    const context = this;
    if (timeout) clearTimeout(timeout);
    timeout = window.setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
  
  debouncedFn.cancel = function() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  
  return debouncedFn;
}

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

  // Initialize with default values for new posts
  const [title, setTitle] = useState(isEditing ? '' : getFormattedDate());
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [isDraft, setIsDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const autoSaveTimerRef = useRef<number | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if post data has been loaded

  // Fetch post data if editing an existing post
  const { data: post, isLoading: postLoading } = useQuery<Post>({
    queryKey: isEditing && id ? ['/api/posts', parseInt(id)] : [],
    enabled: isEditing && !!id,
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

  // Manual load of post data when editing
  useEffect(() => {
    if (isEditing && id && !dataLoaded) {
      // Directly fetch the post data using the fetch API
      fetch(`/api/posts/${id}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to load post');
          }
          return response.json();
        })
        .then(postData => {
          console.log('Loaded post data directly:', postData);
          
          // Set form fields with post data
          setTitle(postData.title || '');
          setContent(postData.content || '');
          setTags(postData.tags ? postData.tags.join(', ') : '');
          setIsDraft(postData.isDraft || false);
          setLastSaved(postData.lastSavedAt ? new Date(postData.lastSavedAt) : null);
          setDataLoaded(true);
          
          // Verify ownership
          const userProfileData = queryClient.getQueryData<any>(['/api/profile']);
          console.log('Post authorId:', postData.authorId, 'Current user ID:', userProfileData?.id);
          
          if (userProfileData && postData.authorId !== userProfileData.id) {
            toast({
              title: 'Unauthorized',
              description: 'You do not have permission to edit this post.',
              variant: 'destructive',
            });
            setLocation('/');
          }
        })
        .catch(error => {
          console.error('Error loading post:', error);
          toast({
            title: 'Error',
            description: 'Failed to load the post. Please try again.',
            variant: 'destructive',
          });
        });
    }
  }, [isEditing, id, currentUser, setLocation, toast, dataLoaded]);

  // Set page title
  useEffect(() => {
    document.title = isEditing ? 'Edit Post - Ribbat Meat CO.' : 'Create New Post - Ribbat Meat CO.';
  }, [isEditing]);
  
  // Modified auto-save functionality
  const autoSaveDraft = useCallback(async () => {
    if (!title.trim() || (!content.trim() || content === '<p></p>')) {
      return;
    }
    
    try {
      const tagArray = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      if (isEditing && id) {
        console.log('Auto-saving existing post with ID:', id);
        // Use direct fetch for more reliable saving
        const response = await fetch(`/api/posts/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            content,
            tags: tagArray,
            isDraft: true
          })
        });
        
        if (response.ok) {
          const savedPost = await response.json();
          setLastSaved(new Date());
          console.log('Post auto-saved:', savedPost.id);
          
          // Invalidate queries to keep UI in sync
          queryClient.invalidateQueries({ 
            queryKey: [`/api/users/${savedPost.author.id}/posts`] 
          });
        }
      } else if (!isEditing) {
        // For new posts, create a new post
        console.log('Auto-creating new post as draft');
        const response = await fetch('/api/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            content,
            tags: tagArray,
            isDraft: true
          })
        });
        
        if (response.ok) {
          const newPost = await response.json();
          // Update URL to edit mode now that we have a post ID
          setLocation(`/edit/${newPost.id}`);
          setLastSaved(new Date());
          console.log('New post created through auto-save:', newPost.id);
          
          // Get the current user's profile to update their posts
          const userProfile = queryClient.getQueryData<any>(['/api/profile']);
          if (userProfile && userProfile.id) {
            queryClient.invalidateQueries({ 
              queryKey: [`/api/users/${userProfile.id}/posts`] 
            });
          }
        }
      }
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  }, [title, content, tags, isEditing, id, setLocation, queryClient]);
  
  // Save whenever content changes (debounced)
  const debouncedSave = useCallback(
    debounce(() => {
      console.log('Debounced save triggered');
      if (autoSaveEnabled && dataLoaded) {
        autoSaveDraft();
      }
    }, 2000), // 2 second debounce
    [autoSaveEnabled, dataLoaded, autoSaveDraft]
  );
  
  // Call debounced save when content changes
  useEffect(() => {
    if (autoSaveEnabled && dataLoaded && content.length > 0 && title.length > 0) {
      console.log('Content changed, triggering debounced save');
      debouncedSave();
    }
    // Clean up the debouncer on unmount
    return () => {
      debouncedSave.cancel();
    };
  }, [content, title, autoSaveEnabled, debouncedSave, dataLoaded]);

  const createPostMutation = useMutation({
    mutationFn: async (postData: { title: string; content: string; tags: string[]; isDraft: boolean }) => {
      const response = await apiRequest('POST', '/api/posts', postData);
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate both general posts query and user-specific posts query
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      
      // If we have the current user's id from the returned post data
      if (data && data.authorId) {
        // Invalidate the user posts query to refresh profile page
        queryClient.invalidateQueries({ 
          queryKey: [`/api/users/${data.authorId}/posts`] 
        });
      } else if (currentUser) {
        // Try to get user profile from the cache
        const userProfile = queryClient.getQueryData<any>(['/api/profile']);
        if (userProfile && userProfile.id) {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/users/${userProfile.id}/posts`] 
          });
        }
      }
      
      toast({
        title: 'Post created',
        description: 'Your post has been published successfully.',
      });
      // Redirect to home page after creating a post
      setLocation('/');
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
    mutationFn: async (postData: { id: number; title: string; content: string; tags: string[]; isDraft: boolean }) => {
      const response = await apiRequest('PATCH', `/api/posts/${postData.id}`, postData);
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate general posts queries
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${data.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${data.id}/comments`] });
      
      // Invalidate user-specific posts queries
      if (data && data.authorId) {
        // Invalidate the user posts query to refresh profile page
        queryClient.invalidateQueries({ 
          queryKey: [`/api/users/${data.authorId}/posts`] 
        });
      } else if (currentUser) {
        // Try to get user profile from the cache
        const userProfile = queryClient.getQueryData<any>(['/api/profile']);
        if (userProfile && userProfile.id) {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/users/${userProfile.id}/posts`] 
          });
        }
      }
      
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

  // Manual save function - can be triggered by user
  const handleManualSave = () => {
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
    
    console.log('Saving as draft with isDraft explicitly set to true');
    
    // Save as draft
    if (isEditing && post && post.id) {
      console.log('Updating existing draft with ID:', post.id);
      
      // Direct API call without using the mutation to have more control
      fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
          tags: tagArray,
          isDraft: true
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to save draft');
        }
        return response.json();
      })
      .then(data => {
        console.log('Draft updated successfully:', data);
        setLastSaved(new Date());
        
        // Manually invalidate queries
        queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
        queryClient.invalidateQueries({ queryKey: ['/api/posts', post.id] });
        
        // Get the current user's profile to update their posts
        const userProfile = queryClient.getQueryData<any>(['/api/profile']);
        if (userProfile && userProfile.id) {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/users/${userProfile.id}/posts`] 
          });
        }
        
        toast({
          title: 'Draft saved',
          description: 'Your draft has been saved successfully.',
        });
      })
      .catch(error => {
        console.error('Error saving draft:', error);
        toast({
          title: 'Error saving draft',
          description: 'There was a problem saving your draft. Please try again.',
          variant: 'destructive',
        });
      });
    } else {
      console.log('Creating new draft with isDraft=true');
      
      // Direct API call for new draft
      fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
          tags: tagArray,
          isDraft: true
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to create draft');
        }
        return response.json();
      })
      .then(data => {
        console.log('New draft created successfully:', data);
        setLastSaved(new Date());
        
        // Update the URL to show we're now editing an existing post
        setLocation(`/edit/${data.id}`);
        
        // Manually invalidate queries
        queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
        
        // Get the current user's profile to update their posts
        const userProfile = queryClient.getQueryData<any>(['/api/profile']);
        if (userProfile && userProfile.id) {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/users/${userProfile.id}/posts`] 
          });
        }
        
        toast({
          title: 'Draft saved',
          description: 'Your draft has been saved successfully.',
        });
      })
      .catch(error => {
        console.error('Error creating draft:', error);
        toast({
          title: 'Error creating draft',
          description: 'There was a problem creating your draft. Please try again.',
          variant: 'destructive',
        });
      });
    }
  };

  // We're now handling submissions through the Save Draft and Publish buttons
  // This form handler is just a fallback for browser submit events
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Just prevent default form submission - we're using our buttons instead
  };

  if (loading || (isEditing && postLoading)) {
    return (
      <div className="py-6 px-4 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-heading font-bold text-neutral-900">
            {isEditing ? 'Edit Post' : 'Create New Post'}
          </h1>
        </div>
        <Card style={{ backgroundColor: "#e0d3af" }}>
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
      
      <Card style={{ backgroundColor: "#e0d3af" }}>
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
                style={{ 
                  backgroundColor: "#d3d3d3", 
                  color: "#333333", 
                  borderColor: "#999",
                  height: "38px"
                }}
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
                style={{ 
                  backgroundColor: "#d3d3d3", 
                  color: "#333333", 
                  borderColor: "#999",
                  height: "38px"
                }}
              />
              <p className="mt-1 text-sm text-neutral-500">
                Example: gardening, rainwater, community projects
              </p>
            </div>
            
            {/* Draft Status */}
            {isDraft && (
              <div className="mb-6 mt-2 flex items-center">
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-md font-medium">
                  DRAFT
                </span>
              </div>
            )}
            
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handleManualSave}
                disabled={createPostMutation.isPending || updatePostMutation.isPending}
              >
                Save
              </Button>
              
              <Button
                type="button"
                onClick={() => {
                  // Publish function - converts draft to published post
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
                  
                  if (isEditing && id) {
                    // Update existing post and set isDraft to false
                    fetch(`/api/posts/${id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title, content, tags: tagArray, isDraft: false
                      })
                    })
                    .then(response => {
                      if (!response.ok) throw new Error('Failed to publish');
                      return response.json();
                    })
                    .then(data => {
                      toast({
                        title: 'Post published',
                        description: 'Your post has been published successfully.'
                      });
                      
                      // Invalidate queries to refresh UI
                      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
                      const userProfile = queryClient.getQueryData<any>(['/api/profile']);
                      if (userProfile?.id) {
                        queryClient.invalidateQueries({ 
                          queryKey: [`/api/users/${userProfile.id}/posts`] 
                        });
                      }
                      
                      // Go to posts page
                      setLocation('/');
                    })
                    .catch(error => {
                      console.error('Error publishing:', error);
                      toast({
                        title: 'Error',
                        description: 'Failed to publish post. Please try again.',
                        variant: 'destructive'
                      });
                    });
                  } else {
                    // Create new published post
                    fetch('/api/posts', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title, content, tags: tagArray, isDraft: false
                      })
                    })
                    .then(response => {
                      if (!response.ok) throw new Error('Failed to publish');
                      return response.json();
                    })
                    .then(data => {
                      toast({
                        title: 'Post published',
                        description: 'Your post has been published successfully.'
                      });
                      
                      // Invalidate queries to refresh UI
                      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
                      const userProfile = queryClient.getQueryData<any>(['/api/profile']);
                      if (userProfile?.id) {
                        queryClient.invalidateQueries({ 
                          queryKey: [`/api/users/${userProfile.id}/posts`] 
                        });
                      }
                      
                      // Go to posts page
                      setLocation('/');
                    })
                    .catch(error => {
                      console.error('Error publishing:', error);
                      toast({
                        title: 'Error',
                        description: 'Failed to publish post. Please try again.',
                        variant: 'destructive'
                      });
                    });
                  }
                }}
                disabled={createPostMutation.isPending || updatePostMutation.isPending}
                className="bg-amber-700 hover:bg-amber-800"
              >
                Publish
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
