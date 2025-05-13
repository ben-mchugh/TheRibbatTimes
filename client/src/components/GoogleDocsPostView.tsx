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
  // This implementation uses a position-based approach to ensure we only highlight the exact instances
  const renderPostContentWithHighlights = useCallback(() => {
    if (!post?.content) return post?.content || '';
    
    // If no comments with selection data, just return the content
    const commentsWithSelection = comments.filter(
      c => c.selectedText && c.selectionStart !== undefined && c.selectionEnd !== undefined
    );
    
    if (commentsWithSelection.length === 0) return post.content;
    
    // We'll use a DOM-based approach to ensure more precision
    const container = document.createElement('div');
    container.innerHTML = post.content;
    
    // Get a plain text version of the content for position mapping
    const plainText = container.textContent || '';
    
    // Build an array of all comments to process
    // First sort by position, earlier comments first
    const sortedComments = [...commentsWithSelection].sort((a, b) => {
      return (a.selectionStart || 0) - (b.selectionStart || 0);
    });
    
    // Now we need to work with the actual HTML to insert our span tags
    // We'll create a map of where each highlight needs to go
    const highlights = [];
    
    // Process each comment to prepare highlights
    sortedComments.forEach(comment => {
      // Skip invalid selections
      if (!comment.selectedText || comment.selectionStart === undefined || comment.selectionEnd === undefined) {
        return;
      }
      
      // Log each comment's selection details for debugging
      console.log(`Processing comment ${comment.id}: "${comment.selectedText}" at positions ${comment.selectionStart}-${comment.selectionEnd}`);
      
      // Verify if the text at the specified positions matches the expected selection
      const textAtPosition = plainText.substring(comment.selectionStart, comment.selectionEnd);
      console.log(`Text at positions ${comment.selectionStart}-${comment.selectionEnd}: "${textAtPosition}"`);
      
      // Verify our selection is legitimate or try to fix it
      if (textAtPosition !== comment.selectedText) {
        // Try to find the exact position of this text
        const textToFind = comment.selectedText;
        
        // Only look for the text near where we expect it to be
        // This helps prevent highlighting every instance of common words
        const contextRange = 100; // Look at most 100 chars in either direction
        const searchStart = Math.max(0, comment.selectionStart - contextRange);
        const searchEnd = Math.min(plainText.length, comment.selectionEnd + contextRange);
        const searchArea = plainText.substring(searchStart, searchEnd);
        
        const relativePosition = searchArea.indexOf(textToFind);
        if (relativePosition >= 0) {
          // Found the text nearby - adjust the position
          const absolutePosition = searchStart + relativePosition;
          comment.selectionStart = absolutePosition;
          comment.selectionEnd = absolutePosition + textToFind.length;
          console.log(`Adjusted to positions ${comment.selectionStart}-${comment.selectionEnd}`);
        } else {
          // Can't find the text - this is a problem
          console.log(`Could not find "${comment.selectedText}" near the expected position, trying global search`);
          
          // Fall back to a global search
          const globalPosition = plainText.indexOf(comment.selectedText);
          if (globalPosition >= 0) {
            comment.selectionStart = globalPosition;
            comment.selectionEnd = globalPosition + comment.selectedText.length;
            console.log(`Found globally at positions ${comment.selectionStart}-${comment.selectionEnd}`);
          } else {
            console.log(`Could not find text "${comment.selectedText}" anywhere in the content, skipping highlight`);
            return;
          }
        }
      }
      
      // Add this highlight to our array
      highlights.push({
        id: comment.id,
        start: comment.selectionStart,
        end: comment.selectionEnd,
        text: comment.selectedText,
        isNew: newCommentIds.includes(comment.id)
      });
    });
    
    // Now convert this back to HTML with highlights
    // We'll build a completely new HTML string
    const parts = [];
    let lastIndex = 0;
    
    // Sort highlights by start position to process them in order
    highlights.sort((a, b) => a.start - b.start);
    
    // Helper function to escape HTML
    const escapeHtml = (text) => {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };
    
    // Now, let's create a more robust approach using markers in the HTML
    // First, insert special marker comments at the exact positions
    let markedHtml = post.content;
    
    // We need to process highlights from end to beginning to avoid position shifts
    const reversedHighlights = [...highlights].sort((a, b) => b.start - a.start);
    
    // Add markers for each highlight position
    reversedHighlights.forEach(highlight => {
      // Create unique markers for this highlight
      const startMarkerId = `highlight-start-${highlight.id}`;
      const endMarkerId = `highlight-end-${highlight.id}`;
      
      // Find text nodes and create proper offsets
      // This is a simplified approach - we're working with the plain text offsets
      const allTextNodes = [];
      const textWalker = document.createTreeWalker(
        container, 
        NodeFilter.SHOW_TEXT, 
        null
      );
      
      let currentNode;
      while (currentNode = textWalker.nextNode()) {
        allTextNodes.push(currentNode);
      }
      
      // Locate the exact position in text nodes
      let currentPos = 0;
      let startNodeInfo = null;
      let endNodeInfo = null;
      
      for (let i = 0; i < allTextNodes.length; i++) {
        const node = allTextNodes[i];
        const nodeLength = node.nodeValue?.length || 0;
        const nodeEndPos = currentPos + nodeLength;
        
        // Check if this node contains our start position
        if (!startNodeInfo && currentPos <= highlight.start && highlight.start < nodeEndPos) {
          const offset = highlight.start - currentPos;
          startNodeInfo = { node, offset };
        }
        
        // Check if this node contains our end position
        if (!endNodeInfo && currentPos <= highlight.end && highlight.end <= nodeEndPos) {
          const offset = highlight.end - currentPos;
          endNodeInfo = { node, offset };
        }
        
        // Move to next node
        currentPos = nodeEndPos;
        
        // If we found both positions, we can stop
        if (startNodeInfo && endNodeInfo) break;
      }
      
      // If we found valid positions, use a direct DOM approach
      if (startNodeInfo && endNodeInfo) {
        const range = document.createRange();
        range.setStart(startNodeInfo.node, startNodeInfo.offset);
        range.setEnd(endNodeInfo.node, endNodeInfo.offset);
        
        // Mark the range with a highlight span
        const span = document.createElement('span');
        span.className = 'selection-highlight';
        span.setAttribute('data-comment-id', highlight.id.toString());
        span.setAttribute('tabindex', '0');
        span.setAttribute('role', 'button');
        if (highlight.isNew) {
          span.setAttribute('data-new', 'true');
        }
        
        try {
          range.surroundContents(span);
        } catch (e) {
          console.log(`Error highlighting range: ${e.message}`);
        }
      } else {
        console.log(`Could not locate text nodes for positions ${highlight.start}-${highlight.end}`);
      }
    });
    
    // Return the modified HTML
    return container.innerHTML;
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
      
      // Debug the click event
      console.log("Click event detected:", e);
      console.log("Target element:", target);
      console.log("Target HTML:", target.outerHTML);
      
      // Improved highlight detection that handles nested elements correctly
      // First check if the target itself is a highlight element
      let clickedElement = null;
      
      if (target.classList?.contains('selection-highlight')) {
        clickedElement = target;
        console.log("Direct highlight element clicked");
      } else {
        // Then check all parent elements (for nested highlights)
        let parent = target.parentElement;
        console.log("Looking for parent highlight elements...");
        while (parent) {
          console.log("Checking parent:", parent);
          if (parent.classList?.contains('selection-highlight')) {
            clickedElement = parent;
            console.log("Found highlight element in parent chain");
            break;
          }
          parent = parent.parentElement;
        }
      }
      
      if (clickedElement) {
        console.log("Clicked highlight element:", clickedElement);
        console.log("Highlight HTML:", clickedElement.outerHTML);
        
        // Log all attributes
        console.log("Highlight attributes:");
        for (let i = 0; i < clickedElement.attributes.length; i++) {
          const attr = clickedElement.attributes[i];
          console.log(`${attr.name}: ${attr.value}`);
        }
        
        const commentId = Number(clickedElement.getAttribute('data-comment-id'));
        if (!isNaN(commentId)) {
          console.log(`Highlight clicked for comment ID: ${commentId}`);
          
          // Find the comment in our data to compare
          const matchingComment = comments.find(c => c.id === commentId);
          if (matchingComment) {
            console.log("Comment data:", matchingComment);
            console.log(`Expected text: "${matchingComment.selectedText}"`);
            console.log(`Actual text in highlight: "${clickedElement.textContent}"`);
          } else {
            console.log("No matching comment found in data");
          }
          
          // Stop event propagation to prevent handling clicks multiple times
          // This is important for nested highlights
          e.stopPropagation();
          
          // Remove the "new" marker if present
          if (clickedElement.hasAttribute('data-new')) {
            clickedElement.removeAttribute('data-new');
            console.log("Removed 'data-new' attribute");
            
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