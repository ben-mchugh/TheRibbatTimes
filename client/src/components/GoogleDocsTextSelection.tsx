import React, { useEffect, useState, useRef, useCallback } from 'react';
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

// Selection data interface
interface SelectionData {
  text: string;
  start: number;
  end: number;
  exactText: string;
}

// Memory-optimized version of the text selection component
const GoogleDocsTextSelection = ({ postId, onAddComment }: GoogleDocsTextSelectionProps) => {
  const [isContextMenuVisible, setIsContextMenuVisible] = useState(false);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [commentText, setCommentText] = useState('');
  const [selectionData, setSelectionData] = useState<SelectionData | null>(null);
  
  // Refs to avoid unnecessary re-renders
  const menuRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const postContentRef = useRef<Element | null>(null);
  const activeSelectionRef = useRef<SelectionData | null>(null);
  
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  // Optimized function to find text position with less DOM traversal
  const calculateSelectionPositions = useCallback((selection: Selection, postContent: Element): SelectionData => {
    // Get the exact text without trimming
    const exactText = selection.toString();
    const selectedText = exactText.trim();
    
    // Handle empty selection
    if (!selectedText) {
      return { text: "", exactText: "", start: 0, end: 0 };
    }
    
    // Get the range
    const range = selection.getRangeAt(0);
    
    // Find closest container that has position data
    const findClosestPositionElement = (element: Node): Element | null => {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;
      
      // Try to find an element with data-pos attribute
      const el = element as Element;
      if (el.closest('[data-pos]')) {
        return el.closest('[data-pos]');
      }
      
      return null;
    };
    
    // Try to use element position data if available
    const startElement = findClosestPositionElement(range.startContainer);
    if (startElement && startElement.getAttribute('data-pos')) {
      const startPos = parseInt(startElement.getAttribute('data-pos') || '0', 10);
      const offset = range.startOffset;
      return {
        text: selectedText,
        exactText,
        start: startPos + offset,
        end: startPos + offset + exactText.length
      };
    }
    
    // Simplified calculation for text position - using textContent instead of traversing
    // all nodes which is expensive
    const fullText = postContent.textContent || '';
    const position = fullText.indexOf(selectedText);
    
    if (position >= 0) {
      return {
        text: selectedText,
        exactText,
        start: position,
        end: position + selectedText.length
      };
    }
    
    // Fallback
    return {
      text: selectedText,
      exactText,
      start: 0,
      end: selectedText.length
    };
  }, []);
  
  // Cache the post content element on mount
  useEffect(() => {
    postContentRef.current = document.querySelector('.post-content');
  }, []);
  
  // Handle right-click context menu - optimized with useCallback
  const handleContextMenu = useCallback((e: MouseEvent) => {
    // Early exit if no selection
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return; 
    
    const selectedText = selection.toString().trim();
    if (!selectedText) return;
    
    // Use cached post content or find it
    const postContent = postContentRef.current || document.querySelector('.post-content');
    if (!postContent) return;
    
    // Verify selection is within content
    const range = selection.getRangeAt(0);
    if (!postContent.contains(range.commonAncestorContainer)) return;
    
    // Prevent default context menu
    e.preventDefault();
    
    // Calculate selection data only when needed
    const data = calculateSelectionPositions(selection, postContent);
    
    // Update state efficiently
    setMenuPosition({ top: e.clientY, left: e.clientX });
    setSelectionData(data);
    activeSelectionRef.current = data;
    setIsContextMenuVisible(true);
  }, [calculateSelectionPositions]);
  
  // Handle text selection more efficiently
  const handleTextSelection = useCallback(() => {
    // Skip if menus are open
    if (isPopupVisible || isContextMenuVisible) return;
    
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    
    const selectedText = selection.toString().trim();
    if (!selectedText) return;
    
    // Use cached post content or find it
    const postContent = postContentRef.current || document.querySelector('.post-content');
    if (!postContent) return;
    
    // Verify selection is within content
    const range = selection.getRangeAt(0);
    if (!postContent.contains(range.commonAncestorContainer)) return;
    
    // Update the reference but not state (reduces renders)
    const data = calculateSelectionPositions(selection, postContent);
    activeSelectionRef.current = data;
    setSelectionData(data);
  }, [calculateSelectionPositions, isContextMenuVisible, isPopupVisible]);
  
  // Handle clicks outside the menu/popup - optimized with useCallback
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    // Handle context menu clicks
    if (isContextMenuVisible && menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setIsContextMenuVisible(false);
    }
    
    // Handle popup clicks
    if (isPopupVisible && popupRef.current && !popupRef.current.contains(e.target as Node)) {
      const target = e.target as HTMLElement;
      // Don't close on form element clicks
      if (!['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) {
        setIsPopupVisible(false);
      }
    }
  }, [isContextMenuVisible, isPopupVisible]);
  
  // Setup event listeners with proper cleanup
  useEffect(() => {
    // Add passive event listener option for performance
    const options = { passive: true };
    const contextOptions = { passive: false };
    
    document.addEventListener('mouseup', handleTextSelection, options);
    document.addEventListener('contextmenu', handleContextMenu, contextOptions);
    document.addEventListener('mousedown', handleOutsideClick, options);
    
    // Cleanup function
    return () => {
      document.removeEventListener('mouseup', handleTextSelection);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [handleContextMenu, handleOutsideClick, handleTextSelection]);
  
  // Open comment popup - optimized with useCallback
  const handleOpenCommentPopup = useCallback(() => {
    if (!currentUser) {
      toast({
        title: 'Authentication required',
        description: 'You must be signed in to comment.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsPopupVisible(true);
    setIsContextMenuVisible(false);
    setCommentText('');
    
    // Use requestAnimationFrame instead of setTimeout for better performance
    requestAnimationFrame(() => {
      const textarea = popupRef.current?.querySelector('textarea');
      if (textarea) textarea.focus();
    });
  }, [currentUser, toast]);
  
  // Submit comment - optimized with useCallback
  const handleSubmitComment = useCallback(() => {
    // Use the referenced selection data
    const data = selectionData || activeSelectionRef.current;
    if (!data) return;
    
    if (!commentText.trim()) {
      toast({
        title: 'Empty comment',
        description: 'Please enter some text for your comment.',
        variant: 'destructive',
      });
      return;
    }
    
    // Submit with exact selection text for highlighting
    onAddComment({
      content: commentText,
      selectedText: data.exactText,
      selectionStart: data.start,
      selectionEnd: data.end
    });
    
    // Clean up
    setIsPopupVisible(false);
    setCommentText('');
    activeSelectionRef.current = null;
    
    // Clear selection
    window.getSelection()?.removeAllRanges();
  }, [commentText, onAddComment, selectionData, toast]);
  
  // Cancel comment - optimized with useCallback
  const handleCancelComment = useCallback(() => {
    setIsPopupVisible(false);
    setCommentText('');
  }, []);
  
  // Memoize the rendered elements to reduce unnecessary DOM operations
  const renderContextMenu = useCallback(() => {
    if (!isContextMenuVisible) return null;
    
    return (
      <div 
        ref={menuRef}
        className="fixed z-50 bg-white rounded-md shadow-md border border-gray-200 py-1"
        style={{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
          transform: 'translateZ(0)', // Force GPU acceleration
          willChange: 'transform' // Hint for browser optimization
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
    );
  }, [isContextMenuVisible, menuPosition.top, menuPosition.left, handleOpenCommentPopup]);
  
  // Memoize the comment popup to reduce unnecessary DOM operations
  const renderCommentPopup = useCallback(() => {
    if (!isPopupVisible) return null;
    
    const data = selectionData || activeSelectionRef.current;
    
    return (
      <div
        ref={popupRef}
        className="fixed z-50 bg-[#161718] border border-[#444444] rounded-md shadow-lg"
        style={{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
          width: '280px',
          transform: 'translateZ(0)', // Force GPU acceleration
          willChange: 'transform' // Hint for browser optimization
        }}
      >
        <div className="p-3">
          {data && (
            <div className="mb-2 p-2 bg-white border border-[#444444]/30 rounded text-xs">
              <p className="italic text-[#161718]/70 line-clamp-2">
                "{data.text}"
              </p>
            </div>
          )}
          
          <Textarea
            className="w-full min-h-[80px] px-3 py-2 text-sm border border-[#444444] bg-white text-[#161718] rounded focus:outline-none focus:ring-1 focus:ring-[#444444]"
            placeholder="Add a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            autoFocus
          />
          
          <div className="flex justify-end gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex items-center justify-center border-[#444444] text-[#444444] hover:bg-[#e0e0e0] h-8 w-8 p-0"
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
    );
  }, [
    isPopupVisible, 
    menuPosition.top, 
    menuPosition.left, 
    selectionData, 
    commentText, 
    handleCancelComment, 
    handleSubmitComment
  ]);

  return (
    <>
      {/* Memory-optimized rendering with memoization */}
      {renderContextMenu()}
      {renderCommentPopup()}
    </>
  );
};

export default React.memo(GoogleDocsTextSelection);