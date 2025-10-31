'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, CameraOff, AlertCircle } from 'lucide-react';

interface CameraStreamProps {
  onStreamStart: (stream: MediaStream) => void;
  onStreamStop: () => void;
  isActive: boolean;
}

export function CameraStream({ onStreamStart, onStreamStop, isActive }: CameraStreamProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Requesting camera access...');
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported in this browser');
      }

      // Try different camera constraints
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: false
        });
      } catch (firstError) {
        console.log('First attempt failed, trying with basic constraints:', firstError);
        // Fallback to basic constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      console.log('Camera stream obtained:', {
        id: stream.id,
        active: stream.active,
        tracks: stream.getTracks().map(track => ({
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          settings: track.getSettings()
        }))
      });

      // Verify the stream has video tracks
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        throw new Error('No video tracks found in camera stream');
      }

      console.log('Video track details:', videoTracks[0].getSettings());

      streamRef.current = stream;
      onStreamStart(stream);
      setHasPermission(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera';
      console.error('Camera access error:', err);
      setError(errorMessage);
      setHasPermission(false);
    } finally {
      setIsLoading(false);
    }
  }, [onStreamStart]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    onStreamStop();
    setError(null);
  }, [onStreamStop]);

  useEffect(() => {
    // Check camera permission on mount
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(() => {
        setHasPermission(true);
        // Stop the test stream immediately
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            stream.getTracks().forEach(track => track.stop());
          });
      })
      .catch(() => {
        setHasPermission(false);
      });

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (hasPermission === false) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-foreground mx-auto mb-6" />
            <h3 className="text-lg font-bold mb-3 text-foreground">Camera Access Denied</h3>
            <p className="text-muted-foreground mb-6">
              Please allow camera access to use live detection
            </p>
            <Button 
              onClick={startCamera} 
              disabled={isLoading}
              className="px-6 py-2"
            >
              {isLoading ? 'Requesting Access...' : 'Try Again'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-foreground mx-auto mb-6" />
            <h3 className="text-lg font-bold mb-3 text-foreground">Camera Error</h3>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button 
              onClick={startCamera} 
              disabled={isLoading}
              className="px-6 py-2"
            >
              {isLoading ? 'Retrying...' : 'Try Again'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
            isActive 
              ? 'bg-primary' 
              : 'bg-muted'
          }`}>
            <Camera className={`h-8 w-8 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
          </div>
          <h3 className="text-lg font-bold mb-3 text-foreground">
            {isActive ? 'Live Camera Detection' : 'Start Camera Detection'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {isActive 
              ? 'Camera is active and detecting objects in real-time'
              : 'Click to start live object detection using your camera'
            }
          </p>
          <Button 
            onClick={isActive ? stopCamera : startCamera}
            disabled={isLoading}
            variant="outline"
            className="px-6 py-2"
          >
            {isLoading ? (
              'Starting...'
            ) : isActive ? (
              <>
                <CameraOff className="h-4 w-4 mr-2" />
                Stop Camera
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                Start Camera
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
