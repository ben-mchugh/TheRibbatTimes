import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, X } from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";

interface TextSelectionMenuProps {
  onAddComment: (text: string, start: number, end: number) => void;
}

const TextSelectionMenu = ({ onAddComment }: TextSelectionMenuProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [commentPosition, setCommentPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [selectionInfo, setSelectionInfo] = useState<{
    start: number;
    end: number;
    text: string;
  } | null>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setIsVisible(false);
        return;
      }
      
      const selectedText = selection.toString().trim();
      if (!selectedText || selectedText.length < 3) {
        setIsVisible(false);
        return;
      }
      
      // Store the selected text and range information
      const range = selection.getRangeAt(0);
      const postContent = document.querySelector('.post-main-content');
      if (!postContent) {
        console.error('Post content element not found');
        return;
      }
      
      // Get indices relative to the post content
      const postContentText = postContent.textContent || '';
      const selectionOffset = range.startOffset;
      const contentBeforeSelection = postContentText.substring(0, postContentText.indexOf(selectedText));
      const selectionStart = contentBeforeSelection.length;
      const selectionEnd = selectionStart + selectedText.length;
      
      setSelectionInfo({
        start: selectionStart,
        end: selectionEnd,
        text: selectedText
      });
      
      setSelectedText(selectedText);
    };
    
    const handleContextMenu = (e: MouseEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return;
      }
      
      const selectedText = selection.toString().trim();
      if (!selectedText || selectedText.length < 3) {
        return;
      }
      
      // Only show our custom menu if text is selected in the post content
      const target = e.target as Node;
      const postContent = document.querySelector('.post-main-content');
      if (postContent && postContent.contains(target)) {
        e.preventDefault();
        
        // Get the range and compute a good position for both menu and dialog
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Position for the context menu
        setPosition({ top: e.clientY, left: e.clientX });
        
        // Position for the comment dialog
        // Always place it to the right of the content area, not covering any text
        const postContentElement = document.querySelector('.post-main-content');
        const postContentRect = postContentElement?.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const dialogWidth = 350; // Estimated width of our dialog
        const dialogHeight = 300; // Estimated height of our dialog
        
        // Default position - to the right of the content area
        let commentLeft = postContentRect ? postContentRect.right + 30 : rect.right + 20;
        let commentTop = rect.top; // Align with the selection vertically
        
        // Check if dialog would go off-screen to the right
        if (commentLeft + dialogWidth > viewportWidth - 20) {
          // If not enough space on right, try using left side of content
          commentLeft = Math.max(20, (postContentRect?.left || 0) - dialogWidth - 30);
          
          // If still not enough space, put below the selection
          if (commentLeft < 20) {
            commentLeft = rect.left;
            commentTop = rect.bottom + 10;
          }
        }
        
        // Ensure dialog stays within viewport vertically
        const viewportHeight = window.innerHeight;
        if (commentTop + dialogHeight > viewportHeight - 20) {
          commentTop = Math.max(20, viewportHeight - dialogHeight - 20);
        }
        
        setCommentPosition({ top: commentTop, left: commentLeft });
        setIsVisible(true);
        handleSelection();
      }
    };
    
    const handleDocumentClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      }
    };
    
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('selectionchange', handleSelection);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('selectionchange', handleSelection);
    };
  }, []);
  
  const handleOpenCommentDialog = () => {
    if (!selectionInfo) {
      toast({
        title: 'Selection error',
        description: 'Unable to determine selection position.',
        variant: 'destructive',
      });
      return;
    }
    
    // Pre-populate the comment text with a reference to the selected text
    const previewText = selectionInfo.text.length > 40 
      ? selectionInfo.text.substring(0, 40) + '...' 
      : selectionInfo.text;
    
    setCommentText('');
    setIsCommentDialogOpen(true);
    setIsVisible(false);
  };
  
  const handleSubmitComment = () => {
    if (!selectionInfo) return;
    
    if (!commentText.trim()) {
      toast({
        title: 'Empty comment',
        description: 'Please enter some text for your comment.',
        variant: 'destructive',
      });
      return;
    }
    
    onAddComment(commentText, selectionInfo.start, selectionInfo.end);
    setIsCommentDialogOpen(false);
    setCommentText('');
  };
  
  if (!isVisible && !isCommentDialogOpen) return null;
  
  return (
    <>
      {/* Right-click menu */}
      {isVisible && (
        <div 
          ref={menuRef}
          className="fixed z-50 bg-[#e8e8e8] rounded shadow-md border border-[#444444] py-1 px-1"
          style={{ 
            top: `${position.top}px`, 
            left: `${position.left}px`,
            transform: 'translate(-50%, -100%)',
            marginTop: '-10px'
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center text-[#161718] hover:bg-[#d0d0d0] hover:text-[#444444] transition-colors"
            onClick={handleOpenCommentDialog}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            <span>Add Comment</span>
          </Button>
        </div>
      )}
      
      {/* Floating comment box */}
      {isCommentDialogOpen && (
        <div 
          className="fixed z-50 bg-[#e8e8e8] border border-[#444444] rounded shadow-lg"
          style={{
            top: `${commentPosition.top}px`,
            left: `${commentPosition.left}px`,
            width: '320px',
            maxHeight: '350px',
          }}
          ref={menuRef}
        >
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[#161718] font-semibold">Add Comment</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 rounded-full text-[#161718] hover:bg-[#f0e9d5] hover:text-[#a67a48] transition-colors"
                onClick={() => setIsCommentDialogOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="bg-[#e9dfc8] p-3 mb-3 rounded text-sm text-[#161718] border-l-2 border-[#a67a48]">
              <span className="text-[#a67a48] font-medium">Selected text:</span> <span className="italic">"{selectedText.substring(0, 60)}{selectedText.length > 60 ? '...' : ''}"</span>
            </div>
            
            <Textarea
              className="w-full min-h-[100px] px-3 py-2 text-sm text-[#161718] border border-[#a67a48] bg-white rounded focus:outline-none focus:ring-1 focus:ring-[#a67a48] focus:border-[#a67a48]"
              placeholder="Write your comment here..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              autoFocus
            />
            
            <div className="flex justify-end gap-2 mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-[#a67a48] text-[#a67a48] hover:bg-[#f0e9d5] transition-colors"
                onClick={() => setIsCommentDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                size="sm"
                className="bg-[#444444] text-white hover:bg-[#333333] transition-colors"
                onClick={handleSubmitComment}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TextSelectionMenu;