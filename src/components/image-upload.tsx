'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Image as ImageIcon, X } from 'lucide-react';

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  onClear: () => void;
  selectedFile: File | null;
}

export function ImageUpload({ onImageSelect, onClear, selectedFile }: ImageUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type.startsWith('image/')) {
      onImageSelect(file);
    }
  }, [onImageSelect]);

  const { getRootProps, getInputProps, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    },
    multiple: false,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
    onDropRejected: () => setIsDragActive(false)
  });

  if (selectedFile) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-bold text-foreground text-base">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground font-semibold">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
              className="px-4 py-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed border-border p-8 text-center cursor-pointer
            ${isDragActive && !isDragReject 
              ? 'border-foreground bg-muted' 
              : isDragReject 
              ? 'border-foreground bg-muted' 
              : 'hover:border-foreground/50'
            }
          `}
        >
          <input {...getInputProps()} />
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold mb-3 text-foreground">
            {isDragActive ? 'Drop image here' : 'Upload Image File'}
          </h3>
          <p className="text-muted-foreground mb-4">
            Drag and drop an image file, or click to select
          </p>
          <p className="text-sm text-muted-foreground px-3 py-2 inline-block">
            Supports JPG, PNG, GIF, WebP, BMP formats
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
