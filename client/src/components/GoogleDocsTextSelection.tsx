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
  }) => void;
}

const GoogleDocsTextSelection = ({ postId, onAddComment }: GoogleDocsTextSelectionProps) => {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
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
  
  // Handle text selection
  useEffect(() => {
    const handleTextSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        if (!popupRef.current?.contains(document.activeElement)) {
          setIsMenuVisible(false);
        }
        return;
      }
      
      const selectedText = selection.toString().trim();
      if (!selectedText) {
        if (!popupRef.current?.contains(document.activeElement)) {
          setIsMenuVisible(false);
        }
        return;
      }
      
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Find the post content container
      const postContent = document.querySelector('.post-content');
      if (!postContent) return;
      
      // Check if selection is within post content
      if (!postContent.contains(range.commonAncestorContainer)) return;
      
      // Calculate character positions
      const allText = postContent.textContent || '';
      const precedingRange = document.createRange();
      precedingRange.setStart(postContent, 0);
      precedingRange.setEnd(range.startContainer, range.startOffset);
      const startPos = precedingRange.toString().length;
      const endPos = startPos + selectedText.length;
      
      // Set menu position to appear at the end of the selection
      setMenuPosition({
        top: rect.bottom + window.scrollY + 5, // Position below the selection
        left: rect.right + window.scrollX - 20 // Align with right edge of selection
      });
      
      // Store selection data
      setSelectionData({
        text: selectedText,
        start: startPos,
        end: endPos
      });
      
      // Show the menu
      setIsMenuVisible(true);
    };
    
    // Add event listeners
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('keyup', handleTextSelection);
    
    // Cleanup
    return () => {
      document.removeEventListener('mouseup', handleTextSelection);
      document.removeEventListener('keyup', handleTextSelection);
    };
  }, []);
  
  // Handle clicks outside the menu/popup
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      
      // Check if click is outside both menu and popup
      if (
        menuRef.current && 
        !menuRef.current.contains(target) && 
        popupRef.current && 
        !popupRef.current.contains(target)
      ) {
        setIsMenuVisible(false);
        
        // Only hide popup if click isn't inside a text field
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
          setIsPopupVisible(false);
        }
      }
    };
    
    document.addEventListener('mousedown', handleOutsideClick);
    
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);
  
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
    setIsMenuVisible(false);
    setCommentText('');
    
    // Focus the textarea after opening
    setTimeout(() => {
      const textarea = popupRef.current?.querySelector('textarea');
      if (textarea) textarea.focus();
    }, 10);
  };
  
  // Submit comment
  const handleSubmitComment = () => {
    if (!selectionData) return;
    
    if (!commentText.trim()) {
      toast({
        title: 'Empty comment',
        description: 'Please enter some text for your comment.',
        variant: 'destructive',
      });
      return;
    }
    
    onAddComment({
      content: commentText,
      selectedText: selectionData.text,
      selectionStart: selectionData.start,
      selectionEnd: selectionData.end
    });
    
    setIsPopupVisible(false);
    setCommentText('');
  };
  
  // Cancel comment
  const handleCancelComment = () => {
    setIsPopupVisible(false);
    setCommentText('');
  };
  
  return (
    <>
      {/* Google Docs style floating menu on text selection */}
      {isMenuVisible && (
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
            <span>Comment</span>
          </Button>
        </div>
      )}
      
      {/* Google Docs style comment popup */}
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
            <Textarea
              className="w-full min-h-[80px] px-3 py-2 text-sm border border-[#a67a48] bg-white rounded focus:outline-none focus:ring-1 focus:ring-[#a67a48]"
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