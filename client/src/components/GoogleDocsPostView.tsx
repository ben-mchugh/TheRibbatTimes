import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Comment, Post } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import GoogleDocsCommentSection from './GoogleDocsCommentSection';
import GoogleDocsTextSelection from './GoogleDocsTextSelection';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface GoogleDocsPostViewProps {
  postId: number;
}

const GoogleDocsPostView: React.FC<GoogleDocsPostViewProps> = ({ postId }) => {
  const [showComments, setShowComments] = useState(true);
  const [focusedCommentId, setFocusedCommentId] = useState<number | null>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const postContentRef = useRef<HTMLDivElement>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
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
  
  // Track newly added comment IDs to highlight them
  const [newCommentIds, setNewCommentIds] = useState<number[]>([]);

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (commentData: {
      content: string;
      selectedText?: string;
      selectionStart?: number;
      selectionEnd?: number;
    }) => {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...commentData,
          postId
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create comment: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Track the new comment ID for highlighting
      setNewCommentIds(prev => [...prev, data.id]);
      
      // Clear the "new" status after 5 seconds
      setTimeout(() => {
        setNewCommentIds(prev => prev.filter(id => id !== data.id));
      }, 5000);
      
      // Refetch comments and invalidate related queries
      refetchComments();
      queryClient.invalidateQueries({ queryKey: ['/api/posts', postId] });
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      
      toast({
        title: 'Comment added',
        description: 'Your comment has been posted successfully.',
      });
    },
    onError: (error) => {
      console.error('Error adding comment:', error);
      toast({
        title: 'Comment failed',
        description: 'Unable to post your comment. Please try again.',
        variant: 'destructive',
      });
    }
  });
  
  // Process text selection-based comments and add highlight spans
  const renderPostContentWithHighlights = useCallback(() => {
    if (!post?.content) return post?.content || '';
    
    // If no comments with selection data, just return the content
    const commentsWithSelection = comments.filter(
      c => c.selectedText && c.selectionStart !== undefined && c.selectionEnd !== undefined
    );
    
    if (commentsWithSelection.length === 0) return post.content;
    
    // Completely new approach: Avoid DOM manipulations and use HTML string replacements
    // This will handle overlapping comments better
    
    // Step 1: Build a map of all the positions that need highlighting
    // We'll track the start and end of each comment's selection
    const highlightPositions: {
      position: number;
      type: 'start' | 'end';
      commentId: number;
      isNew: boolean;
    }[] = [];
    
    // Add all comment boundaries to the positions array
    commentsWithSelection.forEach(comment => {
      if (comment.selectionStart === undefined || comment.selectionEnd === undefined || !comment.selectedText) {
        return;
      }
      
      highlightPositions.push({
        position: comment.selectionStart,
        type: 'start',
        commentId: comment.id,
        isNew: newCommentIds.includes(comment.id)
      });
      
      highlightPositions.push({
        position: comment.selectionEnd,
        type: 'end',
        commentId: comment.id,
        isNew: newCommentIds.includes(comment.id)
      });
    });
    
    // Sort the positions by their index in the text
    // This ensures we process everything in the right order
    highlightPositions.sort((a, b) => {
      // If positions are equal, prioritize end tags before start tags
      // This handles nested or overlapping tags correctly
      if (a.position === b.position) {
        return a.type === 'end' ? -1 : 1;
      }
      return a.position - b.position;
    });
    
    // If there are no positions to highlight, return the original content
    if (highlightPositions.length === 0) {
      return post.content;
    }
    
    // Step 2: Extract the raw text content (without HTML tags)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = post.content;
    
    // Create a text-to-html position mapping by parsing the HTML
    // We'll track character positions in the plain text vs positions in the HTML
    const textToHtmlMapping: {textPos: number, htmlPos: number}[] = [];
    
    // Initialize with position 0
    textToHtmlMapping.push({ textPos: 0, htmlPos: 0 });
    
    // Use a regex to find all text nodes in the HTML
    const htmlContent = post.content;
    let plainText = '';
    let inTag = false;
    
    // Process each character in the HTML to build the mapping
    for (let i = 0; i < htmlContent.length; i++) {
      const char = htmlContent[i];
      
      if (char === '<') {
        inTag = true;
      } else if (char === '>') {
        inTag = false;
      } else if (!inTag) {
        // This is a text character (not in a tag)
        plainText += char;
        textToHtmlMapping.push({ textPos: plainText.length, htmlPos: i + 1 });
      }
    }
    
    // Step 3: Use the mapping to insert highlight spans
    // We'll work backward to avoid position shifts
    const resultParts: string[] = [];
    let lastPos = htmlContent.length;
    
    // Reverse both arrays to work from the end
    const reversedPositions = [...highlightPositions].reverse();
    const reversedMapping = [...textToHtmlMapping].reverse();
    
    // For each highlight position, find the corresponding HTML position
    reversedPositions.forEach(pos => {
      // Find the closest mapping entry for this text position
      const mappingEntry = reversedMapping.find(entry => entry.textPos <= pos.position);
      
      if (mappingEntry) {
        // Calculate HTML position
        const htmlPos = mappingEntry.htmlPos;
        
        // Insert the appropriate tag
        if (pos.type === 'end') {
          // End tag - closing span
          const part = htmlContent.substring(htmlPos, lastPos);
          resultParts.unshift('</span>');
          resultParts.unshift(part);
        } else {
          // Start tag - opening span with comment ID
          const part = htmlContent.substring(htmlPos, lastPos);
          resultParts.unshift(`<span class="selection-highlight" data-comment-id="${pos.commentId}" ${pos.isNew ? 'data-new="true"' : ''} tabindex="0" role="button">`);
          resultParts.unshift(part);
        }
        
        lastPos = htmlPos;
      }
    });
    
    // Add any remaining content at the beginning
    if (lastPos > 0) {
      resultParts.unshift(htmlContent.substring(0, lastPos));
    }
    
    return resultParts.join('');
  }, [post?.content, comments, newCommentIds]);
  
  // Utility function to escape regex special characters
  function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  // Get all text nodes in an element
  function getTextNodesIn(node: Node): Text[] {
    const textNodes: Text[] = [];
    
    function getTextNodes(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        // This is a text node
        textNodes.push(node as Text);
      } else {
        // Recursively check child nodes
        for (let i = 0; i < node.childNodes.length; i++) {
          getTextNodes(node.childNodes[i]);
        }
      }
    }
    
    getTextNodes(node);
    return textNodes;
  }
  
  // Listen for click events on highlighted text
  // Track content container height for comments section
  useEffect(() => {
    if (!contentContainerRef.current || !postContentRef.current) return;
    
    // Function to calculate and set the content height
    const updateHeight = () => {
      // Get the height of the post content element rather than the container
      const height = postContentRef.current?.offsetHeight || 0;
      // Add a small buffer to account for padding
      const adjustedHeight = height > 0 ? height + 32 : 0;
      setContentHeight(adjustedHeight);
    };
    
    // Initial height calculation
    updateHeight();
    
    // Create a ResizeObserver to track height changes
    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });
    
    // Start observing the post content, not the entire container
    resizeObserver.observe(postContentRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [post]);

  // Effect to add click handler to highlighted text spans
  useEffect(() => {
    const handleHighlightClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Improved highlight detection that handles nested elements correctly
      // First check if the target itself is a highlight element
      let clickedElement = null;
      
      if (target.classList?.contains('selection-highlight')) {
        clickedElement = target;
      } else {
        // Then check all parent elements (for nested highlights)
        let parent = target.parentElement;
        while (parent) {
          if (parent.classList?.contains('selection-highlight')) {
            clickedElement = parent;
            break;
          }
          parent = parent.parentElement;
        }
      }
      
      if (clickedElement) {
        const commentId = Number(clickedElement.getAttribute('data-comment-id'));
        if (!isNaN(commentId)) {
          console.log(`Highlight clicked for comment ID: ${commentId}`);
          
          // Stop event propagation to prevent handling clicks multiple times
          // This is important for nested highlights
          e.stopPropagation();
          
          // Remove the "new" marker if present
          if (clickedElement.hasAttribute('data-new')) {
            clickedElement.removeAttribute('data-new');
            
            // Also remove the comment ID from the newCommentIds array
            setNewCommentIds(prev => prev.filter(id => id !== commentId));
          }
          
          // Focus the associated comment
          setFocusedCommentId(commentId);
          
          // Find all highlights with the same ID and add pulse effects
          const allHighlights = document.querySelectorAll(`.selection-highlight[data-comment-id="${commentId}"]`);
          allHighlights.forEach(highlight => {
            highlight.classList.remove('highlight-focus-pulse');
            // Trigger a reflow to restart the animation
            void highlight.offsetWidth;
            highlight.classList.add('highlight-focus-pulse');
          });
          
          // Ensure comments panel is open on mobile
          if (isMobile) {
            setShowComments(true);
          }
          
          // Scroll the comment into view in the sidebar
          setTimeout(() => {
            const commentElement = document.querySelector(`.gdocs-comment[data-comment-id="${commentId}"]`);
            if (commentElement) {
              commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              commentElement.setAttribute('data-focused', 'true');
              setTimeout(() => {
                commentElement.removeAttribute('data-focused');
              }, 3000);
            }
          }, 100); // Small delay to ensure comment section is open
        }
      }
    };
    
    // Add event listener to capture clicks on highlighted text
    document.addEventListener('click', handleHighlightClick);
    
    return () => {
      document.removeEventListener('click', handleHighlightClick);
    };
  }, [setNewCommentIds, setFocusedCommentId, setShowComments, isMobile]);
  
  // Effect to re-apply event handlers after content rendering
  useEffect(() => {
    if (postContentRef.current) {
      // Find all highlight spans and ensure they have proper tabindex and role attributes
      const highlights = postContentRef.current.querySelectorAll('.selection-highlight');
      
      highlights.forEach((span) => {
        const element = span as HTMLElement;
        element.setAttribute('tabindex', '0');
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', 'Comment on this text');
        
        // Apply special handling for new highlights
        const commentId = Number(element.getAttribute('data-comment-id'));
        if (!isNaN(commentId) && newCommentIds.includes(commentId)) {
          // This is a new comment, add a visual indicator
          element.setAttribute('data-new', 'true');
          
          // Scroll to and focus on the new highlight
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.focus();
          }, 500);
        }
      });
      
      console.log(`Found and enhanced ${highlights.length} text highlights in the content`);
    }
  }, [post?.content, comments, newCommentIds]);
  
  // Format the post date
  const formattedDate = post?.createdAt 
    ? format(new Date(post.createdAt), 'MMMM d, yyyy')
    : '';
  
  if (postError) {
    return (
      <div className="p-6 bg-[#e0d3af] rounded-lg text-center">
        <h2 className="text-xl font-bold text-[#161718] mb-4">Error Loading Post</h2>
        <p className="text-[#161718]">
          We couldn't load this post. Please try again later.
        </p>
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 min-h-screen flex flex-col">
      <div className="flex flex-col md:flex-row gap-6 flex-1">
        {/* Main content area */}
        <div 
          ref={contentContainerRef}
          className={`flex-1 ${showComments ? 'md:w-2/3' : 'md:w-full'}`}
        >
          {isLoadingPost ? (
            <div className="bg-[#e0d3af] p-6 rounded-lg">
              <Skeleton className="h-10 w-3/4 mb-4" />
              <div className="flex items-center mb-6">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="ml-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24 mt-1" />
                </div>
              </div>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3 mb-6" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-4/5 mb-2" />
            </div>
          ) : (
            <div className="bg-[#e0d3af] p-6 rounded-lg shadow-sm">
              <h1 className="text-2xl md:text-3xl font-semibold text-[#161718] mb-4">
                {post?.title}
              </h1>
              
              <div className="flex items-center mb-6">
                <Avatar className="h-10 w-10">
                  <AvatarImage 
                    src={post?.author?.photoURL} 
                    alt={post?.author?.displayName} 
                  />
                  <AvatarFallback>
                    {post?.author?.displayName?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-[#161718]">
                    {post?.author?.displayName}
                  </h3>
                  <p className="text-xs text-[#161718]">
                    {formattedDate}
                  </p>
                </div>
              </div>
              
              <div 
                ref={postContentRef}
                className="post-content prose prose-slate max-w-none text-[#161718]"
                dangerouslySetInnerHTML={{ __html: renderPostContentWithHighlights() }}
              />
            </div>
          )}
          
          {/* Comments toggle button - mobile only */}
          {isMobile && (
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowComments(!showComments)}
                className="flex items-center text-[#a67a48] border-[#a67a48]"
              >
                {showComments ? (
                  <>
                    <ChevronRight className="h-4 w-4 mr-1" />
                    Hide Comments
                  </>
                ) : (
                  <>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Show Comments
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
        
        {/* Comments panel - slide in/out on mobile */}
        <div 
          className={`
            ${showComments ? 'block' : 'hidden md:block'} 
            md:w-1/3 md:max-w-xs md:border-l border-[#a67a48]
            fixed md:relative top-0 right-0 bottom-0 md:top-auto md:right-auto md:bottom-auto
            w-full md:w-auto z-30 md:z-auto bg-[#f9f5e8] md:bg-transparent
            transition-transform duration-300 ease-in-out
            ${showComments ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
            flex flex-col md:h-full
          `}
        >
          <GoogleDocsCommentSection
            postId={postId}
            comments={comments}
            isLoading={isLoadingComments}
            showComments={showComments}
            setShowComments={setShowComments}
            refetchComments={refetchComments}
            focusedCommentId={focusedCommentId}
            contentHeight={contentHeight}
          />
        </div>
      </div>
      
      {/* Text selection menu component */}
      <GoogleDocsTextSelection 
        postId={postId}
        onAddComment={(commentData) => {
          if (!currentUser) {
            toast({
              title: 'Sign in required',
              description: 'Please sign in to add comments.',
              variant: 'destructive'
            });
            return;
          }
          
          addCommentMutation.mutate(commentData);
        }}
      />
    </div>
  );
};

export default GoogleDocsPostView;