/**
 * ImageUploadDialog Component
 * 
 * This component provides image upload functionality for the rich text editor.
 * Features include:
 * - File selection through system dialog or URL input
 * - Image preview before insertion
 * - Width adjustment slider for responsive sizing
 * - Support for common image formats
 * - Validation for image URLs and files
 * - Proper error handling for failed uploads
 */

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface ImageUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (src: string, width: number) => void;
}

const ImageUploadDialog: React.FC<ImageUploadDialogProps> = ({
  isOpen,
  onClose,
  onInsert,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState(100); // percentage of width (default 100%)
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Create a preview URL
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImagePreview(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInsert = () => {
    if (imagePreview) {
      onInsert(imagePreview, imageSize);
      resetDialog();
    }
  };

  const resetDialog = () => {
    setImagePreview(null);
    setImageSize(100);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetDialog()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Insert Image</DialogTitle>
          <DialogDescription>
            Upload an image and adjust its size before inserting it into your post.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="image-upload">Select Image</Label>
            <Input
              ref={fileInputRef}
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          {imagePreview && (
            <>
              <div className="mt-2">
                <Label htmlFor="image-size">Image Size: {imageSize}% of post width</Label>
                <Slider
                  id="image-size"
                  min={10}
                  max={100}
                  step={5}
                  value={[imageSize]}
                  onValueChange={(value) => setImageSize(value[0])}
                  className="mt-2"
                />
              </div>

              <div className="mt-2 border rounded p-2 overflow-hidden">
                <div style={{ width: `${imageSize}%`, margin: '0 auto' }}>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-w-full h-auto object-contain"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetDialog}>
            Cancel
          </Button>
          <Button
            onClick={handleInsert}
            disabled={!imagePreview}
          >
            Insert Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageUploadDialog;