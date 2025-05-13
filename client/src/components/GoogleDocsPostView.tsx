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
import { ChevronLeft, ChevronRight, X, MessageSquare } from 'lucide-react';
import { useLocation } from 'wouter';
import { useIsMobile } from '@/hooks/use-mobile';

// Helper function to escape special characters in string for RegExp
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface GoogleDocsPostViewProps {
  postId: number;
}

const GoogleDocsPostView: React.FC<GoogleDocsPostViewProps> = ({ postId }) => {
  const [showComments, setShowComments] = useState(false);
  const [focusedCommentId, setFocusedCommentId] = useState<number | null>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const postContentRef = useRef<HTMLDivElement>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  
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
  // Uses position-based approach to ensure exact text selection is highlighted
  const renderPostContentWithHighlights = useCallback(() => {
    if (!post?.content) return post?.content || '';
    
    // If no comments with selection data, just return the content
    const commentsWithSelection = comments.filter(
      (c: Comment) => c.selectedText && c.selectionStart !== null && c.selectionEnd !== null
    );
    
    if (commentsWithSelection.length === 0) return post.content;
    
    // Start with the original content
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = post.content;
    
    // Get all text nodes for accurate processing
    const allTextNodes = getTextNodesIn(contentDiv);
    if (allTextNodes.length === 0) return post.content;
    
    // Calculate the absolute position of each text node
    const nodePositions = [];
    let currentPosition = 0;
    
    for (const node of allTextNodes) {
      const nodeText = node.textContent || '';
      const nodeLength = nodeText.length;
      
      nodePositions.push({
        node: node,
        start: currentPosition,
        end: currentPosition + nodeLength
      });
      
      currentPosition += nodeLength;
    }
    
    // Process each comment's selection
    let highlightCount = 0;
    
    // Sort comments from oldest to newest to process them in order
    const sortedComments = [...commentsWithSelection].sort((a, b) => {
      // First sort by start position to handle overlaps properly
      if (a.selectionStart !== b.selectionStart) {
        return a.selectionStart - b.selectionStart;
      }
      // Then by ID if positions are the same (older comments get priority)
      if (a.id && b.id) return a.id - b.id;
      return 0;
    });
    
    // Create a new list of nodes as we process (since we'll modify the DOM)
    let currentNodes = [...nodePositions];
    
    // Track which segments of text we've already highlighted to avoid duplicates
    const highlightedRanges = new Set();
    
    for (const comment of sortedComments) {
      if (!comment.selectedText || comment.selectionStart === null || comment.selectionEnd === null) {
        continue;
      }
      
      console.log(`Processing comment ${comment.id}: "${comment.selectedText}"`);
      
      // Create a range key to track this exact selection
      const rangeKey = `${comment.selectionStart}-${comment.selectionEnd}`;
      
      // Skip if we already highlighted this exact range
      if (highlightedRanges.has(rangeKey)) {
        console.log(`Range ${rangeKey} already highlighted, skipping`);
        continue;
      }
      
      // Otherwise, mark this range as processed
      highlightedRanges.add(rangeKey);
      
      // Find nodes that contain the start and end of this selection
      let startNodeInfo = null;
      let endNodeInfo = null;
      
      // Find start node
      for (const nodeInfo of currentNodes) {
        if (nodeInfo.start <= comment.selectionStart && comment.selectionStart < nodeInfo.end) {
          startNodeInfo = nodeInfo;
          break;
        }
      }
      
      // Find end node
      for (const nodeInfo of currentNodes) {
        if (nodeInfo.start < comment.selectionEnd && comment.selectionEnd <= nodeInfo.end) {
          endNodeInfo = nodeInfo;
          break;
        }
      }
      
      // Skip if we couldn't find valid nodes
      if (!startNodeInfo || !endNodeInfo) {
        console.log(`Could not find nodes for selection range: ${comment.selectionStart}-${comment.selectionEnd}`);
        continue;
      }
      
      try {
        // Calculate offsets within the nodes
        const startOffset = comment.selectionStart - startNodeInfo.start;
        const endOffset = comment.selectionEnd - endNodeInfo.start;
        
        // Create a range to surround with a highlight span
        const range = document.createRange();
        range.setStart(startNodeInfo.node, startOffset);
        range.setEnd(endNodeInfo.node, endOffset);
        
        // Create highlight span
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'selection-highlight';
        highlightSpan.setAttribute('data-comment-id', String(comment.id));
        highlightSpan.setAttribute('tabindex', '0');
        highlightSpan.setAttribute('role', 'button');
        highlightSpan.setAttribute('aria-label', 'View comment on this text');
        
        if (newCommentIds.includes(comment.id)) {
          highlightSpan.setAttribute('data-new', 'true');
        }
        
        // Apply the highlight
        try {
          range.surroundContents(highlightSpan);
          highlightCount++;
          console.log(`Successfully highlighted text: "${comment.selectedText}" at positions ${comment.selectionStart}-${comment.selectionEnd}`);
          
          // Update our node positions after modifying the DOM
          // This is important for the next iterations to work correctly
          const newTextNodes = getTextNodesIn(contentDiv);
          
          // Rebuild the node positions
          currentNodes = [];
          let position = 0;
          
          for (const node of newTextNodes) {
            const nodeText = node.textContent || '';
            const nodeLength = nodeText.length;
            
            currentNodes.push({
              node: node,
              start: position,
              end: position + nodeLength
            });
            
            position += nodeLength;
          }
        } catch (e) {
          console.error(`Error highlighting text: ${e.message}`);
          
          // Special case for when surroundContents fails (usually due to DOM structure)
          // Attempt a direct string replacement approach for the current content
          if (e.name === 'InvalidStateError' || e.name === 'HierarchyRequestError') {
            console.log('Falling back to manual DOM manipulation');
            
            // If we're in a single node, we can try manual node splitting
            if (startNodeInfo.node === endNodeInfo.node) {
              const node = startNodeInfo.node;
              const nodeText = node.textContent || '';
              
              // Split text into before, selected, and after
              const beforeText = nodeText.substring(0, startOffset);
              const selectedText = nodeText.substring(startOffset, endOffset);
              const afterText = nodeText.substring(endOffset);
              
              // Replace with highlighted version
              const newFragment = document.createDocumentFragment();
              if (beforeText) newFragment.appendChild(document.createTextNode(beforeText));
              
              highlightSpan.textContent = selectedText;
              newFragment.appendChild(highlightSpan);
              
              if (afterText) newFragment.appendChild(document.createTextNode(afterText));
              
              // Replace the original node
              if (node.parentNode) {
                node.parentNode.replaceChild(newFragment, node);
                highlightCount++;
                console.log(`Manually highlighted text: "${selectedText}"`);
                
                // Update our node positions again
                const newNodes = getTextNodesIn(contentDiv);
                currentNodes = [];
                let pos = 0;
                
                for (const n of newNodes) {
                  const text = n.textContent || '';
                  currentNodes.push({
                    node: n,
                    start: pos,
                    end: pos + text.length
                  });
                  pos += text.length;
                }
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error processing comment ${comment.id}: ${e.message}`);
      }
    }
    
    // Clean up any empty spans
    const emptySpans = contentDiv.querySelectorAll('span:empty');
    emptySpans.forEach(span => span.remove());
    
    console.log(`Found and enhanced ${highlightCount} text highlights in the content`);
    
    return contentDiv.innerHTML;
  }, [post?.content, comments, newCommentIds, getTextNodesIn]);
  
  // A simpler version that uses direct HTML string replacement
  const enhanceHighlights = useCallback(() => {
    // Wait for DOM to be populated
    setTimeout(() => {
      try {
        // Get any highlight elements
        const highlightElements = document.querySelectorAll('.selection-highlight');
        
        if (highlightElements.length === 0) {
          console.log('No highlights found in the document');
          return;
        }
        
        console.log(`Found ${highlightElements.length} highlight elements to enhance`);
        
        // Remove any existing event listeners by cloning and replacing each element
        const elementsArray = Array.from(highlightElements);
        elementsArray.forEach(highlight => {
          const clone = highlight.cloneNode(true);
          if (highlight.parentNode) {
            highlight.parentNode.replaceChild(clone, highlight);
          }
        });
        
        // Get fresh references after replacement
        const freshHighlights = document.querySelectorAll('.selection-highlight');
        
        // Add event listeners to each fresh highlight
        freshHighlights.forEach(highlight => {
          const commentId = highlight.getAttribute('data-comment-id');
          
          if (!commentId) return;
          
          // Make sure highlight has accessibility attributes
          highlight.setAttribute('tabindex', '0');
          highlight.setAttribute('role', 'button');
          highlight.setAttribute('aria-label', 'View comment on this text');
          
          // Add event listeners with explicit event prevention
          highlight.addEventListener('click', (event) => {
            // Prevent default browser behavior and stop propagation
            event.preventDefault();
            event.stopPropagation();
            
            // Log click event for debugging
            console.log('Click event detected:', event);
            console.log('Target element:', event.target);
            console.log('Target HTML:', (event.target as Element).outerHTML);
            
            // Direct highlight click
            if ((event.target as Element).classList?.contains('selection-highlight')) {
              console.log('Direct highlight element clicked');
              const id = (event.target as Element).getAttribute('data-comment-id');
              if (id) {
                const commentIdNum = parseInt(id, 10);
                setFocusedCommentId(commentIdNum);
                return;
              }
            }
            
            // If not direct, try to find the parent highlight element
            console.log('Looking for parent highlight elements...');
            let currentElement = event.target as Element;
            while (currentElement && currentElement !== document.body) {
              console.log('Checking parent:', currentElement);
              if (currentElement.classList?.contains('selection-highlight')) {
                const id = currentElement.getAttribute('data-comment-id');
                if (id) {
                  // Found the highlight - focus the matching comment
                  setFocusedCommentId(parseInt(id, 10));
                  break;
                }
              }
              currentElement = currentElement.parentElement as Element;
            }
          });
          
          // Add keyboard accessibility
          highlight.addEventListener('keydown', (event) => {
            if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
              event.preventDefault();
              const id = highlight.getAttribute('data-comment-id');
              if (id) {
                setFocusedCommentId(parseInt(id, 10));
              }
            }
          });
        });
      } catch (err) {
        console.error('Error enhancing highlights:', err);
      }
    }, 100);
  }, [setFocusedCommentId]);
  
  // Apply highlight enhancements after render
  useEffect(() => {
    enhanceHighlights();
  }, [post?.content, enhanceHighlights]);
  
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
          
          // Make sure comments pane is shown when a highlight is clicked
          if (!showComments) {
            setShowComments(true);
          }
          
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
      {/* Top bar with controls */}
      <div className="flex justify-between items-center mb-4">
        <Button
          variant="ghost"
          size="sm" 
          onClick={() => setLocation('/')}
          className="flex items-center text-[#a67a48] hover:text-[#8a5a28]"
        >
          <X className="h-4 w-4 mr-1" />
          <span>Close</span>
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center ${showComments ? 'bg-[#f5f0e0] text-[#a67a48]' : 'text-[#a67a48]'} border-[#a67a48]`}
        >
          <MessageSquare className="h-4 w-4 mr-1" />
          <span>{showComments ? 'Hide Comments' : 'Show Comments'}</span>
        </Button>
      </div>
      
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
        </div>
        
        {/* Comments panel - slide in/out based on showComments state */}
        <div 
          className={`
            ${showComments ? 'block' : 'hidden'} 
            transition-all duration-300 ease-in-out
            w-full md:w-1/3 max-w-sm border-l border-[#a67a48]
            flex flex-col h-full bg-[#f9f5e8] rounded-l-lg shadow-md
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