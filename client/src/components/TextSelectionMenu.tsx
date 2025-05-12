import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare } from 'lucide-react';

interface TextSelectionMenuProps {
  onAddComment: (text: string, start: number, end: number) => void;
}

const TextSelectionMenu = ({ onAddComment }: TextSelectionMenuProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');
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
  
  const handleAddComment = () => {
    if (!selectionInfo) {
      toast({
        title: 'Selection error',
        description: 'Unable to determine selection position.',
        variant: 'destructive',
      });
      return;
    }
    
    onAddComment(selectionInfo.text, selectionInfo.start, selectionInfo.end);
    setIsVisible(false);
  };
  
  if (!isVisible) return null;
  
  return (
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
        onClick={handleAddComment}
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        <span>Add Comment</span>
      </Button>
    </div>
  );
};

export default TextSelectionMenu;