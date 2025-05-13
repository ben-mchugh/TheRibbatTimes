import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Post, Comment } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { X } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import CommentSection from './CommentSection';
import TextSelectionMenu from './TextSelectionMenu';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface PostViewProps {
  postId: number;
}

const PostView = ({ postId }: PostViewProps) => {
  console.log('PostView initialized with postId:', postId);
  
  // State hooks for margin comments
  const [marginComments, setMarginComments] = useState<Array<{
    id: number;
    comment: Comment;
    zIndex: number; // Used for stacking priority
  }>>([]);
  
  // Track which comment is currently focused (when highlighted text is clicked)
  const [focusedCommentId, setFocusedCommentId] = useState<number | null>(null);

  // Hooks
  const { currentUser } = useAuth();
  const { toast } = useToast();
  
  // Data fetching
  const { data: post, isLoading: postLoading, error: postError } = useQuery<Post>({
    queryKey: ['/api/posts', postId],
    queryFn: async () => {
      console.log(`Directly fetching post with ID ${postId}`);
      const response = await fetch(`/api/posts/${postId}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch post: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Fetched post ${postId}:`, {
        id: data.id,
        title: data.title,
        author: data.authorName,
        createdAt: data.createdAt
      });
      return data;
    },
    refetchOnWindowFocus: false,
  });

  // Comments data fetching
  const { 
    data: comments = [], 
    isLoading: commentsLoading, 
    refetch: refetchComments 
  } = useQuery<Comment[]>({
    queryKey: ['/api/posts', postId, 'comments'],
    queryFn: async () => {
      console.log(`Directly fetching comments for post ${postId}`);
      const response = await fetch(`/api/posts/${postId}/comments`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Fetched ${data.length} comments directly for post ${postId}:`, 
        data.map((c: any) => ({ id: c.id, postId: c.postId, content: c.content?.substring(0, 20) }))
      );
      return data;
    },
    refetchOnWindowFocus: true,
    staleTime: 2000 // Consider data stale after 2 seconds
  });
  
  // Effect to update focused comment highlight
  useEffect(() => {
    if (focusedCommentId !== null && comments?.length > 0) {
      const timer = setTimeout(() => {
        // Update the z-index of the focused comment
        setMarginComments(prevComments => {
          return prevComments.map(item => {
            if (item.id === focusedCommentId) {
              return { ...item, zIndex: 100 }; // Bring this comment to the front
            }
            return { ...item, zIndex: 10 }; // Reset others to default
          });
        });
      }, 50); // Small delay to ensure DOM is ready
      
      return () => clearTimeout(timer);
    }
  }, [focusedCommentId, comments]);

  // Handler for clicking on highlighted text - very simple direct approach
  const handleHighlightClick = useCallback((commentId: number) => {
    console.log(`Highlighting text clicked for comment ID ${commentId}`);
    
    // Set the focused comment to highlight it
    setFocusedCommentId(commentId);
    
    // Simply grab the comment element by its ID and scroll it into view - the simplest approach
    const commentElement = document.getElementById(`comment-${commentId}`);
    if (commentElement) {
      // This is the simplest solution - just scroll the comment into view
      commentElement.scrollIntoView({
        behavior: 'smooth', 
        block: 'center'
      });
      
      // No need to add animation here - already handled by data-focused attribute
    }
  }, []);
  
  // Organize comments by their position in the text
  const updateCommentPositions = useCallback(() => {
    if (!comments.length) return;
    
    // Sort comments by their position in the text
    const sortedComments = [...comments].sort((a, b) => {
      const aStart = a.selectionStart || 0;
      const bStart = b.selectionStart || 0;
      return aStart - bStart;
    });
    
    // Comments with selection info
    const selectionComments = sortedComments.filter(comment => 
      comment.selectionStart !== null && 
      comment.selectionEnd !== null && 
      comment.selectedText
    );
    
    // Legacy element-based comments (if any)
    const inlineComments = sortedComments.filter(comment => comment.elementId);
    
    // Will store all comment data in sequence
    const commentPositions = [];
    
    // Process element-based comments first (if any)
    for (const comment of inlineComments) {
      commentPositions.push({
        id: comment.id,
        comment,
        zIndex: comment.id === focusedCommentId ? 100 : 10
      });
    }
    
    // Process selection-based comments sorted by their position in document
    const sortedSelectionComments = [...selectionComments].sort((a, b) => {
      return (a.selectionStart || 0) - (b.selectionStart || 0);
    });
    
    // Add comments in the order they appear in the text
    for (const comment of sortedSelectionComments) {
      commentPositions.push({
        id: comment.id,
        comment,
        zIndex: comment.id === focusedCommentId ? 100 : 10
      });
    }
    
    setMarginComments(commentPositions);
  }, [comments, focusedCommentId]);

  // Update positions when comments change
  useEffect(() => {
    if (comments?.length) {
      updateCommentPositions();
    }
  }, [comments, updateCommentPositions]);
  
  // Listen for click events on highlighted text
  useEffect(() => {
    const handleFocusComment = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && detail.commentId) {
        setFocusedCommentId(detail.commentId);
      }
    };
    
    document.addEventListener('focusComment', handleFocusComment as EventListener);
    
    return () => {
      document.removeEventListener('focusComment', handleFocusComment as EventListener);
    };
  }, []);
  
  // Function to render the post content with highlighted text for comments
  const renderPostContentWithHighlights = useCallback(() => {
    if (!post?.content || !comments.length) return post?.content || '';
    
    // Create a temporary div to hold the HTML content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = post.content;
    
    // Process text selection-based comments
    comments.forEach(comment => {
      // Skip comments without selection info
      if (!comment.selectionStart || !comment.selectionEnd || !comment.selectedText) return;
      
      // Find the relevant text node containing the selection
      const textNodes = getTextNodesIn(tempDiv);
      let characterCount = 0;
      let foundNode = null;
      let beforeSelection = null;
      let afterSelection = null;
      
      // Locate the text node that contains our selection
      for (const node of textNodes) {
        const nodeLength = node.textContent?.length || 0;
        const selectionStartsInNode = characterCount <= comment.selectionStart && 
                                     (characterCount + nodeLength) >= comment.selectionStart;
        
        if (selectionStartsInNode) {
          foundNode = node;
          
          // Calculate relative offsets within this node
          const startOffset = comment.selectionStart - characterCount;
          let endOffset = startOffset + (comment.selectionEnd - comment.selectionStart);
          
          // Ensure we don't exceed the node's length
          endOffset = Math.min(endOffset, nodeLength);
          
          // Extract the text before, during, and after the selection
          const fullText = node.textContent || '';
          beforeSelection = fullText.substring(0, startOffset);
          const selectedText = fullText.substring(startOffset, endOffset);
          afterSelection = fullText.substring(endOffset);
          
          break;
        }
        
        characterCount += nodeLength;
      }
      
      // If we found the node containing the selection
      if (foundNode && beforeSelection !== null) {
        // Create the highlight span
        const span = document.createElement('span');
        span.classList.add('selection-highlight');
        span.dataset.commentId = comment.id.toString();
        span.textContent = comment.selectedText;
        span.setAttribute('tabindex', '0');
        
        // Add click handler via inline attribute (will be converted to an event listener)
        span.setAttribute('onclick', `
          // Focus this comment and update its position
          document.dispatchEvent(new CustomEvent('focusComment', { 
            detail: { commentId: ${comment.id} } 
          }));
        `);
        
        // Replace the text node with our new structure
        const fragment = document.createDocumentFragment();
        if (beforeSelection) fragment.appendChild(document.createTextNode(beforeSelection));
        fragment.appendChild(span);
        if (afterSelection) fragment.appendChild(document.createTextNode(afterSelection));
        
        foundNode.parentElement?.replaceChild(fragment, foundNode);
      }
    });
    
    return tempDiv.innerHTML;
  }, [comments, post]);
  
  // Helper function to get all text nodes in a given element
  function getTextNodesIn(node: Node): Text[] {
    const textNodes: Text[] = [];
    
    function getTextNodes(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push(node as Text);
      } else {
        const children = node.childNodes;
        for (let i = 0; i < children.length; i++) {
          getTextNodes(children[i]);
        }
      }
    }
    
    getTextNodes(node);
    return textNodes;
  }
  
  // Handler for text selection comments
  const handleSelectionComment = useCallback((commentText: string, start: number, end: number) => {
    if (!currentUser) {
      toast({
        title: 'Authentication required',
        description: 'You must be signed in to comment on text.',
        variant: 'destructive',
      });
      return;
    }
    
    // Get the text selection from selectionInfo
    const selectionData = document.querySelector('.post-main-content')?.textContent || '';
    const selectedText = selectionData.substring(start, end);
    
    // Create a new comment with the selected text info and user's comment text
    const commentData = {
      content: commentText,
      selectedText: selectedText,
      selectionStart: start,
      selectionEnd: end
    };
    
    // Use the CommentSection's addCommentMutation directly
    const commentSectionElement = document.querySelector('.comment-section') as HTMLElement;
    if (commentSectionElement) {
      // Set up a custom event to pass the selection data
      const event = new CustomEvent('addSelectionComment', { 
        detail: commentData
      });
      commentSectionElement.dispatchEvent(event);
      
      // Show a toast to confirm the comment was added
      toast({
        title: 'Comment added',
        description: 'Your comment has been added to the selected text.',
        variant: 'default',
      });
    }
  }, [currentUser, toast]);

  // Safety checks for required data
  if (!post && !postLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-[#e0d3af] p-8 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-[#161718] mb-4">Post Not Found</h1>
          <p className="text-[#161718] mb-6">The post you're looking for doesn't exist or has been removed.</p>
          <Link href="/">
            <Button variant="default" className="bg-[#a67a48] hover:bg-[#8a5a28] text-white">
              Return Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Loading state
  if (postLoading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[#161718] bg-opacity-80">
        <div className="flex items-center justify-center min-h-screen py-8">
          <div className="relative w-full max-w-6xl mx-auto rounded-lg shadow-xl max-h-[90vh] overflow-y-auto bg-[#e0d3af] p-12">
            <Skeleton className="h-12 mb-4" />
            <div className="flex items-center mb-6">
              <Skeleton className="h-8 w-8 rounded-full mr-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex">
              <div className="w-[65%] pr-6">
                <Skeleton className="h-4 mb-3 w-full" />
                <Skeleton className="h-4 mb-3 w-full" />
                <Skeleton className="h-4 mb-3 w-[90%]" />
                <Skeleton className="h-4 mb-8 w-[95%]" />
                
                <Skeleton className="h-4 mb-3 w-full" />
                <Skeleton className="h-4 mb-3 w-[88%]" />
                <Skeleton className="h-4 mb-3 w-[92%]" />
              </div>
              <div className="w-[35%]">
                <Skeleton className="h-32 mb-4 w-full rounded-md" />
                <Skeleton className="h-32 w-full rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Safety checks for required data
  if (!post.author) {
    post.author = {
      id: 0,
      uid: 'unknown',
      displayName: 'Unknown Author',
      email: '',
      photoURL: '',
    };
  }

  // Format post date
  const formattedDate = formatDate(post.createdAt);

  // Main render
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#161718] bg-opacity-80">
      <div className="flex items-center justify-center min-h-screen py-8">
        <div className="relative post-card w-full max-w-6xl mx-auto rounded-lg shadow-xl max-h-[90vh] overflow-y-auto bg-[#e0d3af]">
          {/* Add the text selection menu component */}
          <TextSelectionMenu onAddComment={handleSelectionComment} />
          <Link href="/">
            <Button 
              variant="ghost" 
              className="absolute top-4 right-4 text-[#161718] hover:text-[#a67a48] z-20"
            >
              <X className="h-6 w-6" />
            </Button>
          </Link>
          
          <div className="px-4 pt-10 pb-6 md:px-8 md:pt-12 md:pb-8 lg:p-12">
            <div className="w-full relative">
              <div className="post-content-container relative">
                <h1 className="text-2xl md:text-3xl font-heading font-bold text-[#161718] mb-4">{post.title}</h1>
                <div className="mt-2 mb-6 flex flex-wrap items-center">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={post.author.photoURL} alt={post.author.displayName} />
                    <AvatarFallback>{post.author.displayName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="ml-2 text-sm text-[#161718]">{post.author.displayName}</span>
                  <span className="mx-2 text-[#a67a48]">•</span>
                  <span className="text-sm text-[#161718]">{formattedDate}</span>
                </div>
                
                {/* Two-column layout for content and inline comments - set fixed height */}
                <div className="flex relative min-h-[500px] max-h-[calc(90vh-200px)]">
                  {/* Main content - takes 65% width */}
                  <div className="w-[65%] pr-6">
                    <div className="prose prose-headings:text-[#161718] prose-p:text-[#161718] prose-strong:text-[#161718] prose-em:text-[#161718] prose-li:text-[#161718] max-w-none relative">
                      <div 
                        dangerouslySetInnerHTML={{ __html: renderPostContentWithHighlights() }} 
                        className="post-main-content"
                      />
                    </div>
                  </div>
                  
                  {/* Inline comments appear next to the related text - takes 35% width */}
                  <div className="w-[35%] relative h-full flex flex-col">
                    {/* Fixed height comments container with scrollbar - it will always show a scrollbar when needed */}
                    <div id="commentScrollContainer" className="comments-container overflow-y-auto sticky top-0 pr-2 max-h-screen flex-1">
                      {marginComments.map(({ id, comment, zIndex }) => {
                        const isFocused = id === focusedCommentId;
                        
                        return (
                          <div 
                            key={id}
                            id={`comment-${id}`}
                            data-comment-id={id}
                            data-focused={isFocused ? "true" : "false"}
                            className={`margin-comment static mb-4 ${isFocused ? 'ring-2 ring-[#a67a48] bg-[#fdf8e9]' : ''}`}
                            style={{
                              zIndex: isFocused ? 100 : (zIndex || 10),
                            }}
                            onClick={() => setFocusedCommentId(id)}
                          >
                            {/* Connector to show which text this comment corresponds to */}
                            <div className="connector-line"></div>
                            
                            <div className="flex items-start">
                              <div className="flex-1">
                                <div className="flex items-center mb-1">
                                  <Avatar className="h-6 w-6 mr-2">
                                    <AvatarImage src={comment.author?.photoURL} alt={comment.author?.displayName || 'User'} />
                                    <AvatarFallback>{comment.author?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs font-medium text-[#161718]">{comment.author?.displayName || 'Anonymous'}</span>
                                </div>
                                <p className="text-xs text-[#161718]">{comment.content}</p>
                                {comment.selectedText && (
                                  <div className="text-xs bg-[#e9dfc8] text-[#a67a48] mt-1 p-1 rounded italic">
                                    "{comment.selectedText}"
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                {currentUser && post.authorId === parseInt(currentUser.uid) && (
                  <div className="mt-6 flex">
                    <Link href={`/edit/${post.id}`}>
                      <Button 
                        variant="outline" 
                        className="mr-2 border-[#a67a48] text-[#a67a48] hover:bg-[#a67a48] hover:text-[#e0d3af]"
                      >
                        Edit Post
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
            
            {/* Hidden comment section - used only for adding comments */}
            <div className="hidden">
              <CommentSection 
                postId={postId}
                comments={comments} 
                isLoading={commentsLoading} 
                showComments={true} 
                setShowComments={() => {}} 
                refetchComments={refetchComments}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostView;