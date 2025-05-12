import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, X } from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface TextSelectionMenuProps {
  onAddComment: (text: string, start: number, end: number) => void;
}

const TextSelectionMenu = ({ onAddComment }: TextSelectionMenuProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
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
        setPosition({ top: e.clientY, left: e.clientX });
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
          className="fixed z-50 bg-white rounded-lg shadow-lg border border-[#a67a48] py-2 px-1"
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
            className="flex items-center text-[#161718] hover:bg-[#f5f0e0] hover:text-[#a67a48]"
            onClick={handleOpenCommentDialog}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            <span>Add Comment</span>
          </Button>
        </div>
      )}
      
      {/* Comment dialog */}
      <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#f5f0e0] border-[#a67a48]">
          <DialogHeader>
            <DialogTitle className="text-[#161718]">Add Comment</DialogTitle>
            <DialogDescription className="text-[#a67a48]">
              Commenting on: <span className="italic">"{selectedText.substring(0, 60)}{selectedText.length > 60 ? '...' : ''}"</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Textarea
              className="w-full min-h-[120px] px-3 py-2 text-sm text-[#161718] border border-[#a67a48] bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-[#a67a48] focus:border-[#a67a48]"
              placeholder="Write your comment here..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              autoFocus
            />
          </div>
          
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="border-[#a67a48] text-[#a67a48] hover:bg-[#a67a48] hover:text-[#f5f0e0]"
              onClick={() => setIsCommentDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button"
              className="bg-[#a67a48] text-[#f5f0e0] hover:bg-[#8a5d2e]"
              onClick={handleSubmitComment}
            >
              Submit Comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TextSelectionMenu;