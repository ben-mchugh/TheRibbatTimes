import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Check, X } from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from '@/hooks/useAuth';

interface GoogleDocsTextSelectionProps {
  postId: number;
  onAddComment: (commentData: {
    content: string;
    selectedText: string;
    selectionStart: number;
    selectionEnd: number;
  }) => void;
}

const GoogleDocsTextSelection = ({ postId, onAddComment }: GoogleDocsTextSelectionProps) => {
  const [isContextMenuVisible, setIsContextMenuVisible] = useState(false);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [commentText, setCommentText] = useState('');
  const [selectionData, setSelectionData] = useState<{
    text: string;
    start: number;
    end: number;
    exactText: string; // Stores the exact selected text without trimming
  } | null>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  // Handle text selection and right-click context menu
  useEffect(() => {
    // Get all text nodes in an element
    function getTextNodesIn(node: Node): Text[] {
      const textNodes: Text[] = [];
      
      function getTextNodes(node: Node) {
        if (node.nodeType === Node.TEXT_NODE) {
          textNodes.push(node as Text);
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            getTextNodes(node.childNodes[i]);
          }
        }
      }
      
      getTextNodes(node);
      return textNodes;
    }
    
    // Calculate selection position in text
    const calculateSelectionPositions = (selection: Selection, postContent: Element) => {
      // Always capture the exact selected text before trimming
      const exactText = selection.toString();
      
      // Get the selected text
      const selectedText = exactText.trim();
      if (!selectedText) {
        console.log("Empty selection detected");
        return { text: "", exactText: "", start: 0, end: 0 };
      }
      
      console.log(`User selected text: "${selectedText}"`);
      
      // Use all text nodes for precise calculation
      const allTextNodes = getTextNodesIn(postContent);
      let cumulativeLength = 0;
      let startPosition = -1;
      
      // Get the range from the selection
      const range = selection.getRangeAt(0);
      
      // Find the exact position by scanning text nodes
      for (let i = 0; i < allTextNodes.length; i++) {
        const node = allTextNodes[i];
        const nodeLength = node.textContent?.length || 0;
        
        // Check if this node contains the selection start
        if (startPosition === -1 && node === range.startContainer) {
          startPosition = cumulativeLength + range.startOffset;
        }
        
        // Move to next node
        cumulativeLength += nodeLength;
      }
      
      // If we found a valid start position
      if (startPosition !== -1) {
        const endPosition = startPosition + exactText.length;
        
        console.log(`Found selection at positions ${startPosition}-${endPosition}`);
        return {
          text: selectedText,
          exactText,
          start: startPosition,
          end: endPosition
        };
      }
      
      // Fallback method if above fails
      console.log("Using fallback method for selection positions");
      
      // Get the full text content
      const fullText = postContent.textContent || '';
      
      // Find the text in the content
      const position = fullText.indexOf(selectedText);
      if (position >= 0) {
        return {
          text: selectedText,
          exactText,
          start: position,
          end: position + selectedText.length
        };
      }
      
      // Last resort fallback
      return {
        text: selectedText,
        exactText,
        start: 0,
        end: selectedText.length
      };
    };
    
    const handleContextMenu = (e: MouseEvent) => {
      // Get the current selection
      const selection = window.getSelection();
      
      // If no selection, or selection is collapsed (just a cursor), use default browser behavior
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return;
      }
      
      // Check if there's actually text selected
      const selectedText = selection.toString().trim();
      if (!selectedText) {
        return;
      }
      
      // Find the post content container
      const postContent = document.querySelector('.post-content');
      if (!postContent) return;
      
      // Check if selection is within post content
      const selectionRange = selection.getRangeAt(0);
      if (!postContent.contains(selectionRange.commonAncestorContainer)) return;
      
      // Prevent default context menu
      e.preventDefault();
      
      // Calculate accurate selection positions
      const selectionData = calculateSelectionPositions(selection, postContent);
      
      // Position the menu at the end of the selected text
      const rects = selectionRange.getClientRects();
      
      // Get the post content's position for relative positioning
      const postContentRect = postContent.getBoundingClientRect();
      
      if (rects.length > 0) {
        // Use the last rect (end of selection)
        const lastRect = rects[rects.length - 1];
        
        // Calculate position relative to the post content element
        const relativeTop = lastRect.bottom - postContentRect.top + 5;
        const relativeLeft = lastRect.right - postContentRect.left;
        
        setMenuPosition({
          top: relativeTop,  // Position below the text with a small gap
          left: relativeLeft // Position at the right end of the selection
        });
      } else {
        // Fallback to cursor position if no rects available
        const relativeTop = e.clientY - postContentRect.top;
        const relativeLeft = e.clientX - postContentRect.left;
        
        setMenuPosition({
          top: relativeTop,
          left: relativeLeft
        });
      }
      
      // Store the selection data for comment creation
      setSelectionData(selectionData);
      
      // Show the context menu
      setIsContextMenuVisible(true);
    };
    
    // Handle text selection (keeping track of the current selection)
    const handleTextSelection = () => {
      const selection = window.getSelection();
      
      // If there's no selection or popup is already open, ignore
      if (
        !selection || 
        selection.isCollapsed || 
        isPopupVisible || 
        isContextMenuVisible
      ) return;
      
      const selectedText = selection.toString().trim();
      if (!selectedText) return;
      
      // Find the post content container
      const postContent = document.querySelector('.post-content');
      if (!postContent) return;
      
      // Check if selection is within post content
      const range = selection.getRangeAt(0);
      if (!postContent.contains(range.commonAncestorContainer)) return;
      
      // Use the helper function to get accurate positions
      const accurateSelection = calculateSelectionPositions(selection, postContent);
      
      // Store selection data
      setSelectionData(accurateSelection);
    };
    
    // Add event listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('mouseup', handleTextSelection);
    
    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('mouseup', handleTextSelection);
    };
  }, [isPopupVisible, isContextMenuVisible]);
  
  // Handle clicks outside the menu/popup and scroll adjustments
  useEffect(() => {
    // Function to handle clicks outside the menu or popup
    const handleOutsideClick = (e: MouseEvent) => {
      // Context menu handling
      if (isContextMenuVisible && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsContextMenuVisible(false);
      }
      
      // Comment popup handling
      if (isPopupVisible && popupRef.current && !popupRef.current.contains(e.target as Node)) {
        // Only close if click is not in a form element (to allow text entry)
        const target = e.target as HTMLElement;
        if (!['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) {
          setIsPopupVisible(false);
        }
      }
    };
    
    document.addEventListener('mousedown', handleOutsideClick);
    
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isContextMenuVisible, isPopupVisible]);
  
  // Open comment popup
  const handleOpenCommentPopup = () => {
    if (!currentUser) {
      toast({
        title: 'Authentication required',
        description: 'You must be signed in to comment.',
        variant: 'destructive',
      });
      return;
    }
    
    // Add temporary highlight to selected text
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      try {
        // Get the current selection range
        const range = selection.getRangeAt(0);
        
        // Create a temporary highlight span
        const tempHighlight = document.createElement('span');
        tempHighlight.className = 'temp-selection-highlight';
        tempHighlight.setAttribute('data-temp-highlight', 'true');
        
        // Apply the highlight to the selection
        range.surroundContents(tempHighlight);
      } catch (error) {
        console.error("Couldn't apply temporary highlight:", error);
        // Continue even if highlighting fails
      }
    }
    
    setIsPopupVisible(true);
    setIsContextMenuVisible(false);
    setCommentText('');
    
    // Focus the textarea after opening and initialize auto-height
    setTimeout(() => {
      const textarea = popupRef.current?.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        
        // Initialize height calculation
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight + 5, 300);
        textarea.style.height = `${newHeight}px`;
      }
    }, 10);
  };
  
  // Submit comment
  const handleSubmitComment = () => {
    if (!selectionData) return;
    
    // Check for empty comment
    if (!commentText.trim()) {
      toast({
        title: 'Empty comment',
        description: 'Please enter some text for your comment.',
        variant: 'destructive',
      });
      return;
    }
    
    // Use the exact selection text rather than the trimmed version for highlighting
    onAddComment({
      content: commentText,
      selectedText: selectionData.exactText, // Use exact text for proper highlighting
      selectionStart: selectionData.start,
      selectionEnd: selectionData.end
    });
    
    // Remove any temporary highlights
    removeTempHighlights();
    
    setIsPopupVisible(false);
    setCommentText('');
    
    // Clear the selection after adding the comment
    window.getSelection()?.removeAllRanges();
  };
  
  // Cancel comment
  const handleCancelComment = () => {
    setIsPopupVisible(false);
    setCommentText('');
    
    // Remove any temporary highlights
    removeTempHighlights();
  };
  
  // Helper function to remove temporary highlights
  const removeTempHighlights = () => {
    // Find and remove all temporary highlights
    const tempHighlights = document.querySelectorAll('.temp-selection-highlight');
    tempHighlights.forEach(highlight => {
      // Get the parent node
      const parent = highlight.parentNode;
      // Move all children out of the highlight and into the parent
      while (highlight.firstChild) {
        parent?.insertBefore(highlight.firstChild, highlight);
      }
      // Remove the highlight element
      parent?.removeChild(highlight);
    });
  };
  
  return (
    <>
      {/* Right-click context menu for text selection */}
      {isContextMenuVisible && (
        <div 
          ref={menuRef}
          className="absolute z-50 bg-white rounded-md shadow-md border border-gray-200 py-1"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center justify-center text-[#161718] hover:bg-[#f5f5f5] h-8 w-8 p-0 rounded-full"
            onClick={handleOpenCommentPopup}
            title="Add comment"
          >
            <MessageSquare className="h-4 w-4 text-[#444444]" />
          </Button>
        </div>
      )}
      
      {/* Comment popup */}
      {isPopupVisible && (
        <div
          ref={popupRef}
          className="absolute z-50 bg-[#e8e8e8] border border-[#444444] rounded-md shadow-lg"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            width: '280px'
          }}
          onKeyDown={(e) => {
            // Global keydown handler for the popup
            if (e.key === 'Escape') {
              e.preventDefault();
              handleCancelComment();
            }
          }}
        >
          <div className="p-3">
            {selectionData && (
              <div className="mb-2 p-2 bg-white border border-[#444444]/30 rounded text-xs">
                <p className="italic text-[#161718]/70 line-clamp-2">
                  "{selectionData.text}"
                </p>
              </div>
            )}
            
            <Textarea
              className="w-full min-h-[80px] max-h-[300px] px-3 py-2 text-sm border-0 bg-white text-[#161718] rounded focus:outline-none focus:ring-0 resize-none overflow-y-auto shadow-sm"
              placeholder="Add a comment... (Press Enter to submit, Esc to cancel)"
              value={commentText}
              onChange={(e) => {
                setCommentText(e.target.value);
                
                // Auto-expand the textarea as user types
                const textarea = e.target as HTMLTextAreaElement;
                
                // Reset height to auto to get the correct scrollHeight
                textarea.style.height = 'auto';
                
                // Add extra padding to avoid scrollbar when text just fits
                const newHeight = Math.min(textarea.scrollHeight + 5, 300);
                
                // Set the height to accommodate content without showing scrollbar unnecessarily
                textarea.style.height = `${newHeight}px`;
              }}
              onKeyDown={(e) => {
                // Submit on Enter (without shift key)
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitComment();
                }
                // Cancel on Escape
                else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancelComment();
                }
              }}
              autoFocus
            />
            
            <div className="flex justify-end gap-2 mt-2">
              <Button
                type="button"
                size="sm"
                className="flex items-center justify-center bg-[#444444] text-white hover:bg-[#222222] h-8 w-8 p-0"
                onClick={handleCancelComment}
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button 
                type="button"
                size="sm"
                className="flex items-center justify-center bg-[#444444] text-white hover:bg-[#222222] h-8 w-8 p-0"
                onClick={handleSubmitComment}
                title="Add comment"
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GoogleDocsTextSelection;