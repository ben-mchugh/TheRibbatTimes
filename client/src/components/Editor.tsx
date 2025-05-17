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
import { Node } from '@tiptap/core';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Bold, Italic, Underline as UnderlineIcon, 
  List, ListOrdered, Quote, Undo, Redo,
  AlignLeft, AlignCenter, AlignRight, PaintBucket,
  Image as ImageIcon, Palette
} from 'lucide-react';
import ImageUploadDialog from './ImageUploadDialog';
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

const RichTextEditor = ({ content, onChange }: EditorProps) => {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
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
      // Extended image node with draggable resize handle
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            width: {
              default: '100%',
              parseHTML: element => {
                const width = element.style.width;
                return width || '100%';
              },
              renderHTML: attributes => {
                return {
                  style: `width: ${attributes.width}; margin: 0 auto; display: block;`,
                  class: 'resizable-image',
                  'data-resizable': 'true',
                };
              },
            },
          };
        },
        addNodeView() {
          return ({ node, editor, getPos }) => {
            const dom = document.createElement('div');
            dom.classList.add('image-wrapper');
            dom.style.width = node.attrs.width;
            dom.style.margin = '0 auto';
            
            const img = document.createElement('img');
            img.src = node.attrs.src;
            img.alt = node.attrs.alt || '';
            img.classList.add('resizable-image');
            img.style.width = '100%'; // Image fills the wrapper
            
            const handle = document.createElement('div');
            handle.classList.add('resize-handle');
            
            dom.appendChild(img);
            dom.appendChild(handle);
            
            // Add resize functionality
            let startWidth = 0;
            let startX = 0;
            let startPercentWidth = 0;
            
            const onMouseDown = (e: MouseEvent) => {
              e.preventDefault();
              
              // Calculate starting values
              startWidth = img.offsetWidth;
              startX = e.clientX;
              startPercentWidth = parseInt(img.style.width) || 100;
              
              // Add event listeners for dragging
              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
            };
            
            const onMouseMove = (e: MouseEvent) => {
              // Calculate how far the mouse has moved
              const dx = e.clientX - startX;
              
              // Calculate new width as a percentage
              const containerWidth = dom.parentElement ? dom.parentElement.offsetWidth : startWidth;
              const newWidthPx = Math.max(50, Math.min(startWidth + dx, containerWidth));
              const newPercentage = Math.round((newWidthPx / containerWidth) * 100);
              
              // Apply new width to the wrapper div
              dom.style.width = `${newPercentage}%`;
            };
            
            const onMouseUp = () => {
              // Remove event listeners
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
              
              // Update the node attributes with the wrapper width
              if (typeof getPos === 'function') {
                const transaction = editor.view.state.tr.setNodeMarkup(getPos(), undefined, {
                  ...node.attrs,
                  width: dom.style.width
                });
                editor.view.dispatch(transaction);
              }
            };
            
            // Add event listener to resize handle
            handle.addEventListener('mousedown', onMouseDown);
            
            return {
              dom,
              destroy: () => {
                handle.removeEventListener('mousedown', onMouseDown);
              },
            };
          };
        },
      }).configure({
        inline: false,
        allowBase64: true,
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
    
    // Initialize storage for image observers if needed
    editor.storage.imageObservers = editor.storage.imageObservers || [];
    
    return () => {
      editor.off('update', throttledAddIds);
      
      // Clean up any image observers when the editor is destroyed
      if (editor.storage.imageObservers) {
        editor.storage.imageObservers.forEach((observer: MutationObserver) => {
          observer.disconnect();
        });
        editor.storage.imageObservers = [];
      }
    };
  }, [editor]);

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

  // Handle inserting images
  const insertImage = (url: string, width: number) => {
    if (url && editor) {
      // Insert a paragraph before the image if needed
      if (!editor.isActive('paragraph')) {
        editor.chain().focus().setNode('paragraph').run();
      }
      
      // Insert the image with proper attributes using the Image extension
      editor.chain()
        .focus()
        .setNode('paragraph')
        .insertContent({
          type: 'image',
          attrs: {
            src: url,
            alt: 'Uploaded image',
            width: `${width}%` // Store width as a percentage
          }
        })
        .setNode('paragraph') // Add a paragraph after the image
        .focus()
        .run();
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <div>
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
            
            {/* Image upload button */}
            <div className="flex space-x-1 mr-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setImageDialogOpen(true)}
                    style={{ color: "#333333" }}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Insert Image</TooltipContent>
              </Tooltip>
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
      
      {/* Image Upload Dialog */}
      <ImageUploadDialog
        isOpen={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        onInsert={insertImage}
      />
    </div>
  );
};

export default RichTextEditor;
