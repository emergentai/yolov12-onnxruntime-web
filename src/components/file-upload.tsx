'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileVideo, Image as ImageIcon, X } from 'lucide-react';

interface FileUploadProps {
  onVideoSelect: (file: File) => void;
  onImageSelect: (file: File) => void;
  onClear: () => void;
  selectedVideo: File | null;
  selectedImage: File | null;
  showCompactBanner?: boolean;
}

export function FileUpload({ onVideoSelect, onImageSelect, onClear, selectedVideo, selectedImage, showCompactBanner = false }: FileUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const selectedFile = selectedVideo || selectedImage;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        onVideoSelect(file);
      } else if (file.type.startsWith('image/')) {
        onImageSelect(file);
      }
    }
  }, [onVideoSelect, onImageSelect]);

  const { getRootProps, getInputProps, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.webm', '.mov', '.avi'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    },
    multiple: false,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
    onDropRejected: () => setIsDragActive(false)
  });

  if (selectedFile && showCompactBanner) {
    const isVideo = selectedVideo !== null;
    const Icon = isVideo ? FileVideo : ImageIcon;
    const fileType = isVideo ? 'Video' : 'Image';

    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-md shadow-sm">
        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm truncate max-w-[150px]">{selectedFile.name}</p>
          <p className="text-xs text-muted-foreground">
            {fileType} • {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-6 w-6 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  if (selectedFile && !showCompactBanner) {
    const isVideo = selectedVideo !== null;
    const Icon = isVideo ? FileVideo : ImageIcon;
    const fileType = isVideo ? 'Video' : 'Image';

    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                <Icon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-bold text-foreground text-base">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground font-semibold">
                  {fileType} • {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
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
            {isDragActive ? 'Drop file here' : 'Upload Video or Image'}
          </h3>
          <p className="text-muted-foreground mb-4">
            Drag and drop a video or image file, or click to select
          </p>
          <p className="text-sm text-muted-foreground px-3 py-2 inline-block">
            Supports MP4, WebM, MOV, AVI, JPG, PNG, GIF, WebP, BMP formats
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

