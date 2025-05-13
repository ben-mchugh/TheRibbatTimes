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
  // This implements a pure string-based approach for maximum stability
  const renderPostContentWithHighlights = useCallback(() => {
    if (!post?.content) return post?.content || '';
    
    // If no comments with selection data, just return the content
    const commentsWithSelection = comments.filter(
      c => c.selectedText && c.selectionStart !== undefined && c.selectionEnd !== undefined
    );
    
    if (commentsWithSelection.length === 0) return post.content;
    
    // Create a map of the exact text and their context
    // This is to distinguish between multiple instances of the same text
    const textContextMap = new Map();
    
    // Get a plain text version of the post content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = post.content;
    const plainText = tempDiv.textContent || '';
    
    // Sort comments by position (to process them in order)
    const sortedComments = [...commentsWithSelection].sort((a, b) => {
      return (a.selectionStart || 0) - (b.selectionStart || 0);
    });
    
    // A simple text-based approach with HTML manipulation
    let modifiedContent = post.content;
    
    // Process each comment to add a highlight
    sortedComments.forEach(comment => {
      // Skip invalid comments
      if (!comment.selectedText || comment.selectionStart === undefined || comment.selectionEnd === undefined) {
        return;
      }
      
      console.log(`Processing comment ${comment.id}: "${comment.selectedText}" at positions ${comment.selectionStart}-${comment.selectionEnd}`);
      
      // Exact text that was selected
      const selectedText = comment.selectedText;
      
      // Calculate context to identify the precise occurrence we want to highlight
      // Get text before and after the selection (up to 20 chars)
      const contextBefore = plainText.substring(
        Math.max(0, comment.selectionStart - 20), 
        comment.selectionStart
      );
      
      const contextAfter = plainText.substring(
        comment.selectionEnd,
        Math.min(plainText.length, comment.selectionEnd + 20)
      );
      
      // The full pattern we'll search for, with context
      const fullPattern = `${contextBefore}${selectedText}${contextAfter}`;
      
      // Escape the text for use in HTML replacements
      const escapeForHtml = (text) => {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };
      
      // Escape special characters for regex
      const escapeRegExp = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      };
      
      // Escaped versions for safety
      const escapedText = escapeForHtml(selectedText);
      const escapedContextBefore = escapeRegExp(escapeForHtml(contextBefore));
      const escapedContextAfter = escapeRegExp(escapeForHtml(contextAfter));
      
      // Create the highlight HTML
      const isNew = newCommentIds.includes(comment.id);
      const highlightHtml = `<span class="selection-highlight" data-comment-id="${comment.id}" tabindex="0" role="button" ${isNew ? 'data-new="true"' : ''}>${escapedText}</span>`;
      
      // Regular expression pattern with context to find the exact instance
      // This uses lookahead and lookbehind to ensure we find the exact text with matching context
      let regexPattern;
      
      try {
        if (contextBefore && contextAfter) {
          // If we have context on both sides, be precise
          regexPattern = new RegExp(`(${escapedContextBefore})(${escapeRegExp(escapedText)})(${escapedContextAfter})`, 'g');
          modifiedContent = modifiedContent.replace(regexPattern, `$1${highlightHtml}$3`);
        } else {
          // If we don't have context or it fails, try a direct replacement
          // We'll give it a unique ID attribute so we can find and replace it properly
          const uniqueKey = `highlightmarker-${Date.now()}-${comment.id}`;
          
          // First replace the text with a special marker, making sure it's inside text nodes only 
          regexPattern = new RegExp(`(${escapeRegExp(escapedText)})(?![^<]*>)`, 'g');
          
          // Find all matches
          const matches = [];
          let match;
          let tempContent = plainText;
          let offset = 0;
          
          // Plain text search to find the position we want
          while ((match = tempContent.indexOf(selectedText, offset)) !== -1) {
            // Check if it's a match for our position
            if (match <= comment.selectionStart && match + selectedText.length >= comment.selectionEnd) {
              matches.push(match);
              break; // We found our match
            }
            offset = match + 1;
          }
          
          // If we found a match position, use it
          if (matches.length > 0) {
            const matchPos = matches[0];
            
            // Create a temporary div to parse the content
            const tempParseDiv = document.createElement('div');
            tempParseDiv.innerHTML = modifiedContent;
            
            // Find the text nodes
            const textNodes = getTextNodesIn(tempParseDiv);
            
            // Track position through text nodes
            let currentPos = 0;
            let found = false;
            
            // Loop through text nodes to find our position
            for (let i = 0; i < textNodes.length; i++) {
              const node = textNodes[i];
              const nodeText = node.textContent || '';
              const nodeLength = nodeText.length;
              
              // Check if this node contains our match
              if (currentPos <= matchPos && matchPos < currentPos + nodeLength) {
                // Found the node containing our text
                const startOffset = matchPos - currentPos;
                
                if (startOffset + selectedText.length <= nodeLength) {
                  // The selection fits within this single node - perfect!
                  const parent = node.parentNode;
                  
                  // Split the text node at the start of the selection
                  const beforeText = nodeText.substring(0, startOffset);
                  const selectedContent = nodeText.substring(startOffset, startOffset + selectedText.length);
                  const afterText = nodeText.substring(startOffset + selectedText.length);
                  
                  // Create the highlight span
                  const span = document.createElement('span');
                  span.className = 'selection-highlight';
                  span.setAttribute('data-comment-id', comment.id.toString());
                  span.setAttribute('tabindex', '0');
                  span.setAttribute('role', 'button');
                  if (isNew) {
                    span.setAttribute('data-new', 'true');
                  }
                  span.textContent = selectedContent;
                  
                  // Replace the node with our before + span + after
                  const fragment = document.createDocumentFragment();
                  if (beforeText) {
                    fragment.appendChild(document.createTextNode(beforeText));
                  }
                  fragment.appendChild(span);
                  if (afterText) {
                    fragment.appendChild(document.createTextNode(afterText));
                  }
                  
                  parent.replaceChild(fragment, node);
                  found = true;
                  break;
                }
              }
              
              currentPos += nodeLength;
            }
            
            if (found) {
              // We successfully replaced in the DOM, now get the HTML back
              modifiedContent = tempParseDiv.innerHTML;
            } else {
              // Fallback to regex if DOM manipulation failed
              let attempts = 0;
              const doReplace = () => {
                const replaceRegex = new RegExp(`(${escapeRegExp(escapedText)})(?![^<]*>)`, 'g');
                const replacedContent = modifiedContent.replace(replaceRegex, (match, capture, index) => {
                  attempts++;
                  
                  // Only replace the correct occurrence
                  const textUptToMatch = tempDiv.textContent?.substring(0, index) || '';
                  const matchPos = textUptToMatch.length;
                  
                  if (Math.abs(matchPos - comment.selectionStart) < 50 || attempts === 1) {
                    return highlightHtml;
                  }
                  return match;
                });
                
                return replacedContent;
              };
              
              modifiedContent = doReplace();
            }
          }
        }
      } catch (e) {
        console.error(`Error adding highlight for comment ${comment.id}:`, e);
      }
    });
    
    return modifiedContent;
  }, [post?.content, comments, newCommentIds, getTextNodesIn]);
  
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