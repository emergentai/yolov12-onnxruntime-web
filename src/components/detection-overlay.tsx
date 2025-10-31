'use client';

import { useEffect, useRef } from 'react';
import { Detection } from '@/lib/types';

interface DetectionOverlayProps {
  detections: Detection[];
  videoWidth: number;
  videoHeight: number;
  className?: string;
}

export function DetectionOverlay({ 
  detections, 
  videoWidth, 
  videoHeight, 
  className = '' 
}: DetectionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw detections
    detections.forEach(detection => {
      drawDetection(ctx, detection);
    });
  }, [detections, videoWidth, videoHeight]);

  const drawDetection = (ctx: CanvasRenderingContext2D, detection: Detection) => {
    const { x, y, width, height, confidence, class: className } = detection;
    
    // Set drawing style based on class
    const color = getClassColor(className);
    const label = `${className} (${(confidence * 100).toFixed(1)}%)`;
    
    // Draw bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    
    // Draw background for label
    const labelWidth = ctx.measureText(label).width + 8;
    const labelHeight = 20;
    const labelX = x;
    const labelY = y - labelHeight;
    
    ctx.fillStyle = color;
    ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
    
    // Draw label text
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textBaseline = 'top';
    ctx.fillText(label, labelX + 4, labelY + 2);
    
    // Draw class indicator (small circle)
    const indicatorSize = 8;
    const indicatorX = x + width - indicatorSize - 2;
    const indicatorY = y + 2;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(indicatorX + indicatorSize/2, indicatorY + indicatorSize/2, indicatorSize/2, 0, 2 * Math.PI);
    ctx.fill();
  };

  // Helper function to get color based on class - vibrant color palette
  const getClassColor = (className: string): string => {
    const colorMap: Record<string, string> = {
      'person': '#3B82F6', // Blue
      'car': '#EF4444', // Red
      'truck': '#F59E0B', // Amber
      'bus': '#10B981', // Emerald
      'motorcycle': '#8B5CF6', // Purple
      'bicycle': '#EC4899', // Pink
      'traffic light': '#F97316', // Orange
      'stop sign': '#DC2626', // Red-600
      'fire hydrant': '#EF4444', // Red
      'dog': '#14B8A6', // Teal
      'cat': '#6366F1', // Indigo
      'bird': '#22C55E', // Green
      'chair': '#A855F7', // Purple-500
      'bottle': '#06B6D4', // Cyan
      'cup': '#84CC16', // Lime
      'laptop': '#64748B', // Slate
      'phone': '#6366F1', // Indigo
      'book': '#F59E0B', // Amber
      'umbrella': '#EC4899', // Pink
    };
    
    // Generate a color based on class name hash if not in map
    if (!colorMap[className]) {
      let hash = 0;
      for (let i = 0; i < className.length; i++) {
        hash = className.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash) % 360;
      return `hsl(${hue}, 70%, 55%)`;
    }
    
    return colorMap[className];
  };

  return (
    <canvas
      ref={canvasRef}
      className={`absolute top-0 left-0 pointer-events-none ${className}`}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain'
      }}
    />
  );
}
