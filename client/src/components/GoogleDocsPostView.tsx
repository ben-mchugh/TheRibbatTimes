/**
 * GoogleDocsPostView Component
 * 
 * This component is the main post viewing experience that mimics Google Docs.
 * Key features include:
 * - Displays post content with author info and metadata
 * - Manages text selection highlighting for comments
 * - Synchronizes highlighted text with comment display
 * - Handles adding, editing, and deleting comments on text selections
 * - Manages the comment panel display and interaction
 * - Supports keyboard shortcuts for comment navigation
 * - Provides a responsive layout with adaptive behavior
 */

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
import { ChevronLeft, ChevronRight, X, MessageSquare, ChevronUp } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

// Helper function to escape special characters in string for RegExp
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface GoogleDocsPostViewProps {
  postId: number;
}

const GoogleDocsPostView: React.FC<GoogleDocsPostViewProps> = ({ postId }) => {
  const [showComments, setShowComments] = useState(true);
  const [focusedCommentId, setFocusedCommentId] = useState<number | null>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isScrollButtonHovered, setIsScrollButtonHovered] = useState(false);
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const postContentRef = useRef<HTMLDivElement>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  // Track scroll position for showing/hiding scroll controls
  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition(window.scrollY);
    };
    
    // Set initial scroll position
    handleScroll();
    
    // Add event listener
    window.addEventListener('scroll', handleScroll);
    
    // Clean up
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
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
      
      // Set the focused comment ID to auto-scroll the comment into view
      setFocusedCommentId(data.id);
      
      // Clear the "new" status after 5 seconds
      setTimeout(() => {
        setNewCommentIds(prev => prev.filter(id => id !== data.id));
      }, 5000);
      
      // Refetch comments and invalidate related queries
      refetchComments();
      queryClient.invalidateQueries({ queryKey: ['/api/posts', postId] });
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      
      // After a slight delay to allow DOM updates, scroll to the newly created highlight
      setTimeout(() => {
        const highlightElement = document.querySelector(`[data-comment-id="${data.id}"]`);
        if (highlightElement) {
          highlightElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 500);
      
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
      
      // Processing comment
      
      // Create a range key to track this exact selection
      const rangeKey = `${comment.selectionStart}-${comment.selectionEnd}`;
      
      // Skip if we already highlighted this exact range
      if (highlightedRanges.has(rangeKey)) {
        // Skip already highlighted range
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
          // Highlight successful
          
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
        } catch (error) {
          const e = error as { message: string, name: string };
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
                // Manually highlighted text
                
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
      } catch (e: any) {
        console.error(`Error processing comment ${comment.id}: ${e.message || 'Unknown error'}`);
      }
    }
    
    // Clean up any empty spans
    const emptySpans = contentDiv.querySelectorAll('span:empty');
    emptySpans.forEach(span => span.remove());
    
    // Finished processing highlights
    
    return contentDiv.innerHTML;
  }, [post?.content, comments, newCommentIds, getTextNodesIn]);
  
  // A simpler version that uses direct HTML string replacement
  const enhanceHighlights = useCallback(() => {
    // Wait for DOM to be populated using requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      try {
        // Get any highlight elements
        const highlightElements = document.querySelectorAll('.selection-highlight');
        
        if (highlightElements.length === 0) return;
        
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
          
          // Apply initial visibility based on comments panel state
          const element = highlight as HTMLElement;
          if (!showComments) {
            // Hide highlights when comments are hidden
            element.style.backgroundColor = 'transparent';
            element.style.borderBottom = 'none';
            element.style.cursor = 'text';
          }
          
          // Add event listeners with explicit event prevention
          highlight.addEventListener('click', (event) => {
            // Prevent default browser behavior and stop propagation
            event.preventDefault();
            event.stopPropagation();
            
            // Direct highlight click
            if ((event.target as Element).classList?.contains('selection-highlight')) {
              const id = (event.target as Element).getAttribute('data-comment-id');
              if (id) {
                const commentIdNum = parseInt(id, 10);
                
                // Get the highlight's position
                const highlightRect = (event.target as Element).getBoundingClientRect();
                const highlightPosition = highlightRect.top; // Use the top of the highlight
                
                // Create and dispatch a custom event for precise alignment
                const commentsContainer = document.querySelector('.comments-container');
                if (commentsContainer) {
                  // Create a custom event to notify the CommentSection component
                  const event = new CustomEvent('forceFocusComment', {
                    detail: { commentId: commentIdNum, highlightPosition }
                  });
                  
                  // Dispatch the event on the comments container
                  commentsContainer.dispatchEvent(event);
                } else {
                  // Fallback to basic focusing if custom event can't be used
                  setFocusedCommentId(commentIdNum);
                }
                return;
              }
            }
            
            // If not direct, try to find the parent highlight element
            let currentElement = event.target as Element;
            while (currentElement && currentElement !== document.body) {
              if (currentElement.classList?.contains('selection-highlight')) {
                const id = currentElement.getAttribute('data-comment-id');
                if (id) {
                  const commentIdNum = parseInt(id, 10);
                  // Get the highlight's position
                  const highlightRect = currentElement.getBoundingClientRect();
                  const highlightPosition = highlightRect.top; // Use the top of the highlight
                  
                  // Create and dispatch a custom event for precise alignment
                  const commentsContainer = document.querySelector('.comments-container');
                  if (commentsContainer) {
                    // Create a custom event to notify the CommentSection component
                    const event = new CustomEvent('forceFocusComment', {
                      detail: { commentId: commentIdNum, highlightPosition }
                    });
                    
                    // Dispatch the event on the comments container
                    commentsContainer.dispatchEvent(event);
                  } else {
                    // Fallback to basic focusing if custom event can't be used
                    setFocusedCommentId(commentIdNum);
                  }
                  
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
    });
  }, [setFocusedCommentId, showComments]);
  
  // Apply highlight enhancements after render
  useEffect(() => {
    enhanceHighlights();
  }, [post?.content, enhanceHighlights, showComments]);
  
  // Handle toggling visibility of highlights when comments panel is toggled
  useEffect(() => {
    if (!postContentRef.current) return;
    
    const highlights = postContentRef.current.querySelectorAll('.selection-highlight');
    
    // Set visibility of highlights based on comments panel state
    highlights.forEach(highlight => {
      const element = highlight as HTMLElement;
      if (showComments) {
        // Reset to original styling when comments are shown
        element.style.backgroundColor = '';
        element.style.borderBottom = '';
        element.style.cursor = '';
      } else {
        // Hide highlights when comments are hidden
        element.style.backgroundColor = 'transparent';
        element.style.borderBottom = 'none';
        element.style.cursor = 'text';
      }
    });
  }, [showComments]);
  
  // Auto-align the first comment with its highlighted text when the post loads
  useEffect(() => {
    // Only proceed if we have comments with selections and highlights are ready
    const commentsWithSelection = comments.filter(
      (c: Comment) => c.selectedText && c.selectionStart !== null && c.selectionEnd !== null
    );
    
    if (commentsWithSelection.length > 0 && !isLoadingComments && post?.content) {
      // Give the DOM time to render the highlights
      const timer = setTimeout(() => {
        try {
          // Find the first comment with selection data
          const firstComment = commentsWithSelection.sort((a: Comment, b: Comment) => {
            // Sort by selectionStart to get the earliest comment in the document
            return (a.selectionStart || 0) - (b.selectionStart || 0);
          })[0];
          
          if (firstComment && firstComment.id) {
            // Find the highlight element for this comment
            const highlightElement = document.querySelector(`.selection-highlight[data-comment-id="${firstComment.id}"]`);
            
            if (highlightElement) {
              // Get the highlight position
              const highlightRect = highlightElement.getBoundingClientRect();
              const highlightPosition = highlightRect.top;
              
              // Create and dispatch a custom event to align the comment
              const commentsContainer = document.querySelector('.comments-container');
              if (commentsContainer) {
                const event = new CustomEvent('forceFocusComment', {
                  detail: { commentId: firstComment.id, highlightPosition }
                });
                
                commentsContainer.dispatchEvent(event);
              }
            }
          }
        } catch (error) {
          console.error('Error aligning first comment:', error);
        }
      }, 500); // Small delay to ensure DOM is ready
      
      return () => clearTimeout(timer);
    }
  }, [comments, isLoadingComments, post?.content]);
  
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
    
    // Create a ResizeObserver with debounced callback for better performance
    let debounceTimeout: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      // Cancel previous timeout
      if (debounceTimeout) {
        window.clearTimeout(debounceTimeout);
      }
      
      // Set new timeout to limit how often the height is recalculated
      debounceTimeout = window.setTimeout(() => {
        updateHeight();
      }, 250); // Update at most every 250ms
    });
    
    // Start observing the post content, not the entire container
    postContentRef.current && resizeObserver.observe(postContentRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [post]);

  // Add listener for the custom setFocusedComment event from comments
  useEffect(() => {
    if (!postContentRef.current) return;
    
    // Central function to clear all highlights
    const clearAllHighlights = () => {
      document.querySelectorAll('.selection-highlight').forEach(el => {
        el.classList.remove('highlight-focus');
      });
      console.log("Cleared all highlights");
    };
    
    /**
     * Handles clearing the focused comment state
     * 
     * This function:
     * 1. Resets the focusedCommentId state to null
     * 2. Removes the highlight-focus class from all highlighted text elements
     * 3. Ensures no comment is visually selected in both the comment panel and text
     * 
     * Called when a user clicks outside of comments or when the escape key is pressed.
     */
    const handleClearFocusedComment = () => {
      setFocusedCommentId(null);
      clearAllHighlights();
      console.log("Cleared focused comment ID from clearFocusedComment event");
    };
    
    const handleSetFocusedComment = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.commentId) {
        const commentId = customEvent.detail.commentId;
        
        // Set the focused comment ID
        setFocusedCommentId(commentId);
        
        // Clear any existing highlights
        clearAllHighlights();
        
        // Find and highlight the text associated with this comment
        const highlightedEl = document.querySelector(`.selection-highlight[data-comment-id="${commentId}"]`);
        if (highlightedEl) {
          highlightedEl.classList.add('highlight-focus');
          highlightedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };
    
    // Add the event listener to the post content container
    postContentRef.current.addEventListener('setFocusedComment', handleSetFocusedComment);
    postContentRef.current.addEventListener('clearFocusedComment', handleClearFocusedComment);
    
    return () => {
      if (postContentRef.current) {
        postContentRef.current.removeEventListener('setFocusedComment', handleSetFocusedComment);
        postContentRef.current.removeEventListener('clearFocusedComment', handleClearFocusedComment);
      }
    };
  }, [setFocusedCommentId]);

  /**
   * Handles user clicks on highlighted text in the document
   * 
   * This effect:
   * 1. Sets up event listeners for text highlight interactions
   * 2. Manages the synchronization between text highlights and comment panel
   * 3. Ensures the correct comment is focused when its text is clicked
   */
  useEffect(() => {
    /**
     * Event handler for clicks on highlighted text
     * 
     * @param e - Mouse event from the click
     * 
     * This function:
     * - Identifies if a highlighted text element was clicked
     * - Gets the associated comment ID from the element
     * - Updates the UI to focus that specific comment
     * - Scrolls the comment panel to show the focused comment
     * - Removes "new" status from comments after they're clicked
     */
    const handleHighlightClick = (e: MouseEvent) => {
      // Early return for non-element targets
      if (!(e.target instanceof HTMLElement)) return;
      
      const target = e.target as HTMLElement;
      
      // Use closest() instead of manual parent traversal for better performance
      const clickedElement = target.closest('.selection-highlight');
      
      if (!clickedElement) return;
      
      const commentId = Number(clickedElement.getAttribute('data-comment-id'));
      if (isNaN(commentId)) return;
      
      // Stop event propagation to prevent handling clicks multiple times
      e.stopPropagation();
      
      // Remove the "new" marker if present - only run this code if needed
      if (clickedElement.hasAttribute('data-new')) {
        clickedElement.removeAttribute('data-new');
        setNewCommentIds(prev => prev.filter(id => id !== commentId));
      }
      
      // Remove any existing highlights first
      // Use a consistent method for clearing highlights
      const clearAllHighlights = () => {
        document.querySelectorAll('.selection-highlight').forEach(el => {
          el.classList.remove('highlight-focus');
        });
        console.log("Cleared all highlights from highlight click handler");
      };
      
      clearAllHighlights();
      
      // Always focus the comment when clicking on highlighted text
      setFocusedCommentId(commentId);
      
      // Center the clicked highlight in the viewport first
      clickedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Apply the static highlight style
      clickedElement.classList.add('highlight-focus');
      
      // Get the updated position after scrolling
      const highlightRect = clickedElement.getBoundingClientRect();
      const highlightPosition = highlightRect.top;
      
      // Also set the active comment through a custom event
      // This ensures the comment also turns white when text is clicked
      const commentsContainer = document.querySelector('.comments-container');
      if (commentsContainer) {
        // First send the activate event to turn the comment white
        const activateEvent = new CustomEvent('activateComment', {
          detail: { commentId: commentId }
        });
        commentsContainer.dispatchEvent(activateEvent);
        
        // Then send a forceFocus event to align the comment with the highlight
        const forceFocusEvent = new CustomEvent('forceFocusComment', {
          detail: { commentId: commentId, highlightPosition: highlightPosition }
        });
        commentsContainer.dispatchEvent(forceFocusEvent);
        
        console.log("Sent activateComment event with commentId:", commentId);
      }
      
      // Ensure comments panel is open on mobile
      if (isMobile) {
        setShowComments(true);
      }
      
      // Always scroll to the comment
      // Use one requestAnimationFrame instead of nesting them
      requestAnimationFrame(() => {
        const commentElement = document.querySelector(`.gdocs-comment[data-comment-id="${commentId}"]`);
        if (commentElement) {
          commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          commentElement.setAttribute('data-focused', 'true');
          
          // Use requestAnimationFrame instead of setTimeout for better performance
          const animationId = window.setTimeout(() => {
            commentElement.removeAttribute('data-focused');
          }, 1000); // Further reduced from 1500ms to 1000ms
        }
      });
    };
    
    // Handler for clicks on the document (outside highlights/comments)
    const handleDocumentClick = (e: MouseEvent) => {
      // Early return if clicked on a selection-highlight element or inside a comment
      if (e.target instanceof Element && 
         (e.target.classList.contains('selection-highlight') || 
          e.target.closest('.selection-highlight') ||
          e.target.closest('.gdocs-comment') ||
          e.target.closest('.comment-editor'))) {
        return;
      }
      
      // Clear focused comment ID
      setFocusedCommentId(null);
      
      // Clear all highlighted text
      const clearHighlights = () => {
        document.querySelectorAll('.selection-highlight').forEach(el => {
          el.classList.remove('highlight-focus');
        });
        console.log("Cleared all highlights from document click handler");
      };
      
      clearHighlights();
      
      // Also notify the comments container to deactivate comments
      const commentsContainer = document.querySelector('.comments-container');
      if (commentsContainer) {
        const deactivateEvent = new CustomEvent('deactivateComment');
        commentsContainer.dispatchEvent(deactivateEvent);
      }
    };
    
    // Add event listeners
    document.addEventListener('click', handleHighlightClick);
    document.addEventListener('click', handleDocumentClick);
    
    return () => {
      document.removeEventListener('click', handleHighlightClick);
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [focusedCommentId, setNewCommentIds, setFocusedCommentId, setShowComments, isMobile]);
  
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
      
      // Highlight enhancement complete
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
    <div 
      className="max-w-[1680px] mx-auto px-4 py-6 min-h-screen flex flex-col relative"
      onClick={(e) => {
        // Only handle direct clicks on this container, not bubbled events from children
        if (e.target === e.currentTarget) {
          // Clear focused comment
          setFocusedCommentId(null);
          
          // Clear highlights from text
          document.querySelectorAll('.selection-highlight').forEach(el => {
            el.classList.remove('highlight-focus');
          });
          
          // Clear active comment through a custom event
          const commentsContainer = document.querySelector('.comments-container');
          if (commentsContainer) {
            const deactivateEvent = new CustomEvent('deactivateComment');
            commentsContainer.dispatchEvent(deactivateEvent);
          }
        }
      }}
    >
      {/* Controls moved from fixed position */}
      
      {/* Scroll controls that appear when scrolling down */}
      <div>
        {scrollPosition > 300 && (
          <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 animate-fade-in">
            {/* Scroll to Top button */}
            <Button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="rounded-lg shadow-lg px-4 py-3 flex items-center gap-2 transition-all duration-300"
              style={{ 
                backgroundColor: isScrollButtonHovered ? '#8a5a28' : '#a67a48', 
                color: 'white',
                border: 'none',
                transform: isScrollButtonHovered ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isScrollButtonHovered 
                  ? '0 10px 25px -5px rgba(53,42,30,0.6)' 
                  : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              onMouseEnter={() => setIsScrollButtonHovered(true)}
              onMouseLeave={() => setIsScrollButtonHovered(false)}
              aria-label="Scroll to the top of the page"
            >
              <ChevronUp className="h-4 w-4" />
              Scroll to Top
            </Button>
            
            {/* Button controls as a row below the scroll button */}
            <div className="flex items-center gap-2">
              {/* Comments toggle button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowComments(!showComments)}
                className={`bg-[#e8e8e8]/80 hover:bg-[#e8e8e8] text-[#444444] hover:text-[#222222] rounded-full w-10 h-10 flex items-center justify-center p-0 shadow-md ${showComments ? 'opacity-100' : 'opacity-80'}`}
                title={showComments ? "Hide comments" : "Show comments"}
              >
                <MessageSquare className="h-5 w-5" />
              </Button>
              
              {/* Close button */}
              <a href="/">
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-[#e8e8e8]/80 hover:bg-[#e8e8e8] text-[#444444] hover:text-[#222222] rounded-full w-10 h-10 flex items-center justify-center p-0 shadow-md"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </Button>
              </a>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex flex-col md:flex-row gap-6 flex-1 max-w-[1520px] mx-auto w-full">
        {/* Main content area */}
        <div 
          ref={contentContainerRef}
          className={`${showComments ? 'md:w-3/4' : 'md:w-full'}`}
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
            <div className="bg-[#e0d3af] p-8 rounded-lg shadow-sm relative">
              {/* Top right buttons in post box - more subtle version */}
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                {/* Comments toggle button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowComments(!showComments)}
                  className={`bg-transparent hover:bg-[#d7c497]/40 text-[#666666] hover:text-[#444444] rounded-full w-9 h-9 flex items-center justify-center p-0 ${showComments ? 'opacity-100' : 'opacity-70'}`}
                  title={showComments ? "Hide comments" : "Show comments"}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
                
                {/* Close button */}
                <a href="/">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="bg-transparent hover:bg-[#d7c497]/40 text-[#666666] hover:text-[#444444] rounded-full w-9 h-9 flex items-center justify-center p-0"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </a>
              </div>
              
              <h1 className="text-2xl md:text-3xl font-semibold text-[#161718] mb-4 pr-24">
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
                className="post-content prose prose-slate max-w-none text-[#161718] relative"
              >
                <div dangerouslySetInnerHTML={{ __html: renderPostContentWithHighlights() }} />
                
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
            </div>
          )}
        </div>
        
        {/* Comments panel - collapsible on both mobile and desktop */}
        <div 
          className={`
            ${showComments ? 'block' : 'hidden'} 
            md:w-1/4 md:border-l border-[#444444]
            fixed md:relative top-0 right-0 bottom-0 md:top-auto md:right-auto md:bottom-auto
            w-full z-30 md:z-auto bg-transparent

            flex flex-col md:h-auto md:min-h-[800px]
          `}
          style={{ height: contentHeight ? `${contentHeight + 200}px` : 'auto' }}
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
    </div>
  );
};

export default GoogleDocsPostView;