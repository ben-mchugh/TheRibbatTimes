import { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Heading from '@tiptap/extension-heading';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3, 
  List, ListOrdered, Quote, Image as ImageIcon, Undo, Redo 
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

interface EditorProps {
  content: string;
  onChange: (html: string) => void;
}

const RichTextEditor = ({ content, onChange }: EditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Underline,
      TextStyle,
      Color,
      Heading.configure({
        levels: [1, 2, 3],
      }),
      Placeholder.configure({
        placeholder: 'Start writing your post...',
      }),
      Image,
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

  // Generate unique ids for headings and paragraphs to enable targeted comments
  useEffect(() => {
    if (!editor) return;
    
    const originalGetHTML = editor.view.dom.innerHTML;
    
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
    
    // Set up a mutation observer to add IDs to new elements
    const observer = new MutationObserver(addIdsToNodes);
    observer.observe(editor.view.dom, { childList: true, subtree: true });
    
    return () => {
      observer.disconnect();
    };
  }, [editor]);

  const setHeading = useCallback((level: number) => {
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
            setHeading(level);
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
        <SelectTrigger className="w-[140px] h-8">
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

  const ColorSelect = () => {
    const colors = [
      { name: 'Default', value: '#000000' },
      { name: 'Primary', value: '#2E7D32' },
      { name: 'Secondary', value: '#558B2F' },
      { name: 'Accent', value: '#FFB300' },
      { name: 'Red', value: '#D32F2F' },
      { name: 'Blue', value: '#1976D2' },
    ];

    return (
      <Select
        onValueChange={(value) => {
          editor?.chain().focus().setColor(value).run();
        }}
      >
        <SelectTrigger className="w-[120px] h-8">
          <SelectValue placeholder="Text Color" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {colors.map((color) => (
              <SelectItem key={color.value} value={color.value}>
                <div className="flex items-center">
                  <div 
                    className="w-4 h-4 rounded-full mr-2" 
                    style={{ backgroundColor: color.value }}
                  ></div>
                  {color.name}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  };

  const FontSelect = () => {
    const fonts = [
      { name: 'Inter', value: 'Inter' },
      { name: 'Poppins', value: 'Poppins' },
      { name: 'Roboto', value: 'Roboto' },
      { name: 'Roboto Mono', value: 'Roboto Mono' },
    ];

    return (
      <Select
        onValueChange={(value) => {
          editor?.chain().focus().setFontFamily(value).run();
        }}
      >
        <SelectTrigger className="w-[120px] h-8">
          <SelectValue placeholder="Font" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {fonts.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                <span style={{ fontFamily: font.value }}>{font.name}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  };

  const addImage = useCallback(() => {
    const url = window.prompt('URL');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div>
      <div className="border border-neutral-300 rounded-t-md">
        <div className="flex flex-wrap items-center px-3 py-2 border-b border-neutral-300 bg-neutral-50 gap-1">
          <TooltipProvider>
            <div className="flex space-x-1 mr-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={editor.isActive('bold') ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => editor.chain().focus().toggleBold().run()}
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
            
            <div className="flex items-center mr-4">
              <ColorSelect />
            </div>
            
            <div className="flex items-center mr-4">
              <FontSelect />
            </div>
            
            <div className="flex space-x-1 mr-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
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
                  >
                    <Quote className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Quote</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={addImage}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Insert Image</TooltipContent>
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
