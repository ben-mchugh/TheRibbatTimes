import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare } from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from '@/hooks/useAuth';

interface GoogleDocsTextSelectionProps {
  postId: number;
  onAddComment: (commentData: {
    content: string;
    selectedText: string;
    selectionStart: number;
    selectionEnd: number;
  }) => Promise<any>; // Changed to Promise to handle async response
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
  } | null>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  // Handle text selection and right-click context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return; // Let the default browser context menu handle this case
      }
      
      const selectedText = selection.toString().trim();
      if (!selectedText) {
        return; // Let the default browser context menu handle this case
      }
      
      // Find the post content container
      const postContent = document.querySelector('.post-content');
      if (!postContent) return;
      
      // Check if selection is within post content
      const range = selection.getRangeAt(0);
      if (!postContent.contains(range.commonAncestorContainer)) return;
      
      // Prevent default context menu
      e.preventDefault();
      
      // Calculate character positions
      const allText = postContent.textContent || '';
      const precedingRange = document.createRange();
      precedingRange.setStart(postContent, 0);
      precedingRange.setEnd(range.startContainer, range.startOffset);
      const startPos = precedingRange.toString().length;
      const endPos = startPos + selectedText.length;
      
      // Set custom context menu position at cursor
      setMenuPosition({
        top: e.clientY,
        left: e.clientX
      });
      
      // Store selection data
      setSelectionData({
        text: selectedText,
        start: startPos,
        end: endPos
      });
      
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
      
      // Calculate character positions
      const allText = postContent.textContent || '';
      const precedingRange = document.createRange();
      precedingRange.setStart(postContent, 0);
      precedingRange.setEnd(range.startContainer, range.startOffset);
      const startPos = precedingRange.toString().length;
      const endPos = startPos + selectedText.length;
      
      // Store selection data
      setSelectionData({
        text: selectedText,
        start: startPos,
        end: endPos
      });
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
  
  // Handle clicks outside the menu/popup
  useEffect(() => {
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
    
    setIsPopupVisible(true);
    setIsContextMenuVisible(false);
    setCommentText('');
    
    // Focus the textarea after opening
    setTimeout(() => {
      const textarea = popupRef.current?.querySelector('textarea');
      if (textarea) textarea.focus();
    }, 10);
  };
  
  // Submit comment
  const handleSubmitComment = async () => {
    if (!selectionData) return;
    
    if (!commentText.trim()) {
      toast({
        title: 'Empty comment',
        description: 'Please enter some text for your comment.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Wait for the comment to be added and get the response
      await onAddComment({
        content: commentText,
        selectedText: selectionData.text,
        selectionStart: selectionData.start,
        selectionEnd: selectionData.end
      });
      
      // Close popup and reset state
      setIsPopupVisible(false);
      setCommentText('');
      
      // Clear the selection after adding the comment
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast({
        title: 'Comment failed',
        description: 'Unable to post your comment. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Cancel comment
  const handleCancelComment = () => {
    setIsPopupVisible(false);
    setCommentText('');
  };
  
  return (
    <>
      {/* Right-click context menu for text selection */}
      {isContextMenuVisible && (
        <div 
          ref={menuRef}
          className="fixed z-50 bg-white rounded-md shadow-md border border-gray-200 py-1"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center text-[#161718] hover:bg-[#f5f5f5]"
            onClick={handleOpenCommentPopup}
          >
            <MessageSquare className="h-4 w-4 mr-1 text-[#a67a48]" />
            <span>Add comment</span>
          </Button>
        </div>
      )}
      
      {/* Comment popup */}
      {isPopupVisible && (
        <div
          ref={popupRef}
          className="fixed z-50 bg-[#f9f5e8] border border-[#a67a48] rounded-md shadow-lg"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            width: '300px'
          }}
        >
          <div className="p-3">
            {selectionData && (
              <div className="mb-2 p-2 bg-white border border-[#a67a48]/30 rounded text-xs">
                <p className="italic text-[#161718]/70 line-clamp-2">
                  "{selectionData.text}"
                </p>
              </div>
            )}
            
            <Textarea
              className="w-full min-h-[80px] px-3 py-2 text-sm border border-[#a67a48] bg-white text-[#161718] rounded focus:outline-none focus:ring-1 focus:ring-[#a67a48]"
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
                className="h-8 text-sm border-[#a67a48] text-[#a67a48] hover:bg-[#f0e9d5]"
                onClick={handleCancelComment}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                size="sm"
                className="h-8 text-sm bg-[#a67a48] text-white hover:bg-[#8a5a28]"
                onClick={handleSubmitComment}
              >
                Comment
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GoogleDocsTextSelection;