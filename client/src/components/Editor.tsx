import { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Heading from '@tiptap/extension-heading';
import Placeholder from '@tiptap/extension-placeholder';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Bold, Italic, Underline as UnderlineIcon, 
  List, ListOrdered, Quote, Undo, Redo,
  AlignLeft, AlignCenter, AlignRight, PaintBucket,
  Palette, Image as ImageIcon, Move
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface EditorProps {
  content: string;
  onChange: (html: string) => void;
}

// Helper function to resize selected image
const resizeSelectedImage = (editor: any, size: 'small' | 'medium' | 'large') => {
  // Get all images in the editor
  const images = document.querySelectorAll('.ProseMirror img');
  
  // If no images or editor is empty, return
  if (!editor || images.length === 0) return;
  
  // Get the selected node
  const { selection } = editor.state;
  
  // Define sizes based on width percentages
  const sizes = {
    small: '30%',
    medium: '50%',
    large: '100%'
  };
  
  // Resize all selected images
  images.forEach((img) => {
    // Cast to HTMLImageElement to access style properties
    const imgElement = img as HTMLImageElement;
    // Apply the selected size to all images - this makes it work even if selection isn't precise
    imgElement.style.width = sizes[size];
    imgElement.style.height = 'auto';
  });
  
  // Focus back to editor
  editor.commands.focus();
};

const RichTextEditor = ({ content, onChange }: EditorProps) => {
  // State for image resize slider
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [sliderValue, setSliderValue] = useState(100); // Default to 100% width
  const [sliderPosition, setSliderPosition] = useState({ top: 0, left: 0 });
  const [showSlider, setShowSlider] = useState(false);
  
  const editor = useEditor({
    extensions: [
      // Enhanced features for rich text editing
      StarterKit.configure({
        heading: false,
        history: {
          depth: 10, // Limit history depth to save memory
        },
      }),
      Underline,
      Heading.configure({
        levels: [1, 2, 3],
      }),
      Placeholder.configure({
        placeholder: 'Start writing your post...',
      }),
      // Add text styling capabilities
      TextStyle,
      Color,
      // Add text alignment capability
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      // Add image support with resizing and dragging
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'resize-handle', // For resizable images
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'border border-t-0 border-neutral-300 rounded-b-lg p-4 min-h-[400px] focus:outline-none prose prose-green max-w-none',
      },
    },
  });

  // Make sure our content stays updated if it's changed externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Simplified ID generation with throttling for better performance
  // Setup image click event handling for resize slider
  useEffect(() => {
    if (!editor) return;
    
    // Helper to throttle function calls for better performance
    const throttle = (func: Function, delay: number) => {
      let lastCall = 0;
      return function(...args: any[]) {
        const now = Date.now();
        if (now - lastCall >= delay) {
          lastCall = now;
          func(...args);
        }
      };
    };
    
    const addIdsToNodes = () => {
      // Find all headings and paragraphs
      const headings = editor.view.dom.querySelectorAll('h1, h2, h3, p, blockquote, ul, ol');
      
      headings.forEach((node, index) => {
        if (!node.id) {
          node.id = `content-block-${index}`;
        }
      });
    };
    
    // Run initially
    addIdsToNodes();
    
    // Throttled version to reduce processing load
    const throttledAddIds = throttle(addIdsToNodes, 500);
    
    // Use simpler event approach instead of MutationObserver
    editor.on('update', throttledAddIds);
    
    return () => {
      editor.off('update', throttledAddIds);
    };
  }, [editor]);
  
  // Handle image click events to show the resize slider
  useEffect(() => {
    if (!editor) return;
    
    const handleImageClick = (event: MouseEvent) => {
      // Check if the clicked element is an image
      const target = event.target as HTMLElement;
      if (target.tagName === 'IMG') {
        const imageElement = target as HTMLImageElement;
        
        // Get current image size
        const currentWidth = imageElement.style.width || '100%';
        const percentValue = parseInt(currentWidth);
        setSliderValue(!isNaN(percentValue) ? percentValue : 100);
        
        // Calculate position for the slider to appear near the image
        const rect = imageElement.getBoundingClientRect();
        const editorRect = editor.view.dom.getBoundingClientRect();
        
        setSliderPosition({
          top: rect.bottom - editorRect.top,
          left: rect.left - editorRect.left + (rect.width / 2) - 75 // Center the slider
        });
        
        // Show the slider and store selected image reference
        setSelectedImage(imageElement);
        setShowSlider(true);
        
        // Prevent further propagation
        event.stopPropagation();
      }
    };
    
    // Click outside to close the slider
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Don't close if clicking on slider or its children
      if (target.closest('.image-resize-slider')) {
        return;
      }
      // Don't close if clicking on the image itself
      if (selectedImage && target === selectedImage) {
        return;
      }
      setShowSlider(false);
    };
    
    // Add event listeners
    const editorElement = editor.view.dom;
    editorElement.addEventListener('click', handleImageClick);
    document.addEventListener('click', handleClickOutside);
    
    // Cleanup
    return () => {
      editorElement.removeEventListener('click', handleImageClick);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [editor, selectedImage]);

  const setHeading = useCallback((level: 1 | 2 | 3) => {
    if (!editor) return;
    editor.chain().focus().toggleHeading({ level }).run();
  }, [editor]);

  const HeadingSelect = () => {
    return (
      <Select
        onValueChange={(value) => {
          if (value === 'paragraph') {
            editor?.chain().focus().setParagraph().run();
          } else {
            const level = parseInt(value.replace('heading', ''));
            // Type assertion to match expected heading level type
            setHeading(level as 1 | 2 | 3);
          }
        }}
        value={
          editor?.isActive('heading', { level: 1 })
            ? 'heading1'
            : editor?.isActive('heading', { level: 2 })
            ? 'heading2'
            : editor?.isActive('heading', { level: 3 })
            ? 'heading3'
            : 'paragraph'
        }
      >
        <SelectTrigger className="w-[140px] h-8" style={{ backgroundColor: "#d3d3d3", color: "#333333", borderColor: "#999" }}>
          <SelectValue placeholder="Paragraph" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="paragraph">Paragraph</SelectItem>
            <SelectItem value="heading1">Heading 1</SelectItem>
            <SelectItem value="heading2">Heading 2</SelectItem>
            <SelectItem value="heading3">Heading 3</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  };

  // Color select function removed to improve performance

  // Remove FontSelect since the extension is not properly configured

  // Image functionality removed to improve performance

  if (!editor) {
    return null;
  }

  // Handler for slider value change
  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    setSliderValue(value);
    
    // Apply the new size to the selected image
    if (selectedImage) {
      selectedImage.style.width = `${value}%`;
      selectedImage.style.height = 'auto';
    }
  };
  
  return (
    <div className="relative">
      {/* Image resize slider - shown only when an image is selected */}
      {showSlider && selectedImage && (
        <div 
          className="image-resize-slider absolute z-50 bg-white shadow-lg rounded-lg p-3 flex flex-col gap-2"
          style={{
            top: `${sliderPosition.top + 10}px`,
            left: `${sliderPosition.left}px`,
            width: '150px',
          }}
        >
          <div className="flex justify-between text-xs text-gray-500">
            <span>Small</span>
            <span>Large</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={sliderValue}
            onChange={handleSliderChange}
            className="w-full accent-amber-700"
          />
          <div className="text-center text-xs font-medium">
            {sliderValue}%
          </div>
        </div>
      )}
      
      <div className="border border-neutral-300 rounded-t-lg">
        <div className="flex flex-wrap items-center px-3 py-2 border-b border-neutral-300 gap-1" style={{ backgroundColor: "#e8e8e8", color: "#333333" }}>
          <TooltipProvider>
            <div className="flex space-x-1 mr-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={editor.isActive('bold') ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    style={{ color: "#333333" }}
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bold</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={editor.isActive('italic') ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    style={{ color: "#333333" }}
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Italic</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={editor.isActive('underline') ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    style={{ color: "#333333" }}
                  >
                    <UnderlineIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Underline</TooltipContent>
              </Tooltip>
            </div>
            
            <div className="flex items-center mr-4">
              <HeadingSelect />
            </div>
            
            {/* Color and Font selectors removed for performance */}
            
            {/* Text alignment tools */}
            <div className="flex space-x-1 mr-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    style={{ color: "#333333" }}
                  >
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Align Left</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    style={{ color: "#333333" }}
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Align Center</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    style={{ color: "#333333" }}
                  >
                    <AlignRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Align Right</TooltipContent>
              </Tooltip>
            </div>

            {/* Text color selector */}
            <div className="flex space-x-1 mr-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    style={{ color: "#333333" }}
                  >
                    <Palette className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      '#000000', '#1a1a1a', '#505050', '#7a7a7a',
                      '#C1121F', '#FFA07A', '#FB8B24', '#3a5a40',
                      '#1e3d59', '#5c374c'
                    ].map((color) => (
                      <button
                        key={color}
                        className="h-8 w-8 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
                        style={{ backgroundColor: color }}
                        onClick={() => editor.chain().focus().setColor(color).run()}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* List formatting tools */}
            <div className="flex space-x-1 mr-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    style={{ color: "#333333" }}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bullet List</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    style={{ color: "#333333" }}
                  >
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Numbered List</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={editor.isActive('blockquote') ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    style={{ color: "#333333" }}
                  >
                    <Quote className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Quote</TooltipContent>
              </Tooltip>
            </div>
            
            {/* Image insertion tool */}
            <div className="flex space-x-1 mr-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    style={{ color: "#333333" }}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-4">
                  <div className="flex flex-col gap-4">
                    <h4 className="font-semibold text-center">Image Options</h4>
                    
                    {/* Upload button */}
                    <Button 
                      variant="outline"
                      className="w-full" 
                      onClick={() => {
                        const fileInput = document.getElementById('image-upload');
                        if (fileInput) {
                          fileInput.click();
                        }
                      }}
                    >
                      Upload Image
                      <input
                        type="file"
                        id="image-upload"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                              const result = e.target?.result;
                              if (result && typeof result === 'string') {
                                // Insert the image at the current cursor position
                                editor.chain().focus().setImage({ src: result }).run();
                              }
                            };
                            reader.readAsDataURL(file);
                            // Reset the input to allow selecting the same file again
                            event.target.value = '';
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                    </Button>
                    
                    {/* Image size buttons */}
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-gray-500">Selected image size:</p>
                      <div className="grid grid-cols-3 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => resizeSelectedImage(editor, 'small')}
                          className="text-xs"
                        >
                          Small
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => resizeSelectedImage(editor, 'medium')}
                          className="text-xs"
                        >
                          Medium
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => resizeSelectedImage(editor, 'large')}
                          className="text-xs"
                        >
                          Large
                        </Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex space-x-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    style={{ color: "#333333" }}
                  >
                    <Undo className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    style={{ color: "#333333" }}
                  >
                    <Redo className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </div>
      
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
