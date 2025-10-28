'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoUpload } from '@/components/video-upload';
import { CameraStream } from '@/components/camera-stream';
import { DetectionOverlay } from '@/components/detection-overlay';
import { StatsPanel } from '@/components/stats-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ObjectDetector } from '@/lib/object-detector';
import { VideoProcessor } from '@/lib/video-processor';
import { Detection, DetectionStats } from '@/lib/types';
import { Play, Pause, Square, AlertCircle } from 'lucide-react';

export default function Home() {
  // State management
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [stats, setStats] = useState<DetectionStats>({
    totalDetections: 0,
    averageConfidence: 0,
    lastDetectionTime: 0,
    classCounts: {}
  });
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<ObjectDetector | null>(null);
  const processorRef = useRef<VideoProcessor | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize detector
  useEffect(() => {
    const initDetector = async () => {
      try {
        console.log('Initializing AI detector...');
        const detector = new ObjectDetector();
        await detector.initialize();
        detectorRef.current = detector;
        setError(null);
        console.log('AI detector initialized successfully');
      } catch (err) {
        console.error('Failed to initialize AI detector:', err);
        setError('Failed to initialize AI detector. Please check that the model file is available.');
      }
    };

    initDetector();

    return () => {
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
    };
  }, []);

  // Handle video element becoming available when camera is active
  useEffect(() => {
    if (isCameraActive && streamRef.current && videoRef.current) {
      console.log('Video element became available, setting stream');
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => {
        console.error('Error playing video after element became available:', err);
        setError('Failed to start camera preview: ' + err.message);
      });
    }
  }, [isCameraActive]);

  // Handle video file selection
  const handleVideoSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setError(null);
    
    if (videoRef.current) {
      const url = URL.createObjectURL(file);
      videoRef.current.src = url;
    }
  }, []);

  const handleClearVideo = useCallback(() => {
    setSelectedFile(null);
    setDetections([]);
    setStats({
      totalDetections: 0,
      averageConfidence: 0,
      lastDetectionTime: 0,
      classCounts: {}
    });
    
    if (videoRef.current) {
      videoRef.current.src = '';
    }
    
    if (processorRef.current) {
      processorRef.current.reset();
    }
  }, []);

  // Handle camera stream
  const handleCameraStart = useCallback((stream: MediaStream) => {
    console.log('handleCameraStart called with stream:', stream);
    streamRef.current = stream;
    setIsCameraActive(true);
    setError(null);
    
    // Wait for the video element to be rendered after isCameraActive becomes true
    const setStreamToVideo = () => {
      if (videoRef.current) {
        console.log('Setting stream to video element');
        
        // Clear any existing source first
        videoRef.current.srcObject = null;
        
        // Set the new stream
        videoRef.current.srcObject = stream;
        
        // Wait a bit for the stream to be ready, then play
        setTimeout(() => {
          if (videoRef.current && videoRef.current.srcObject) {
            console.log('Attempting to play video');
            videoRef.current.play().catch((err) => {
              console.error('Error playing video:', err);
              setError('Failed to start camera preview: ' + err.message);
            });
          }
        }, 100);
      } else {
        console.log('Video element not ready yet, retrying...');
        setTimeout(setStreamToVideo, 50);
      }
    };
    
    // Start trying to set the stream after a short delay
    setTimeout(setStreamToVideo, 100);
  }, []);

  const handleCameraStop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsCameraActive(false);
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start/stop processing
  const startProcessing = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current) return;

    try {
      setIsProcessing(true);
      setIsPaused(false);
      setError(null);

      const processor = new VideoProcessor(
        (newDetections) => {
          console.log(`Displaying ${newDetections.length} detections for current frame`);
          setDetections(newDetections); // Replace instead of accumulate
        },
        (newStats) => {
          setStats(newStats);
        }
      );

      processor.setVideo(videoRef.current);
      processor.startProcessing();
      processorRef.current = processor;

      // Start detection loop
      const detectLoop = async () => {
        if (!detectorRef.current || !processorRef.current) return;

        const frame = processorRef.current.getCurrentFrame();
        if (frame) {
          try {
            const newDetections = await detectorRef.current.detectObjects(frame);
            processorRef.current.updateDetections(newDetections);
          } catch (err) {
            console.error('Detection error:', err);
          }
        }

        // Continue loop if processing and not paused
        if (processorRef.current && !processorRef.current.isProcessingStopped()) {
          requestAnimationFrame(detectLoop);
        }
      };

      detectLoop();
    } catch (err) {
      setError('Failed to start processing');
      console.error('Processing start failed:', err);
      setIsProcessing(false);
    }
  }, []);

  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    setIsPaused(false);
    
    if (processorRef.current) {
      processorRef.current.stopProcessing();
    }
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused(!isPaused);
  }, [isPaused]);

  // Export data
  const handleExport = useCallback(() => {
    if (!processorRef.current) return;

    const allDetections = processorRef.current.exportDetections();
    const data = {
      detections: allDetections,
      stats: processorRef.current.exportStats(),
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `object-detections-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleReset = useCallback(() => {
    setDetections([]);
    setStats({
      totalDetections: 0,
      averageConfidence: 0,
      lastDetectionTime: 0,
      classCounts: {}
    });
    
    if (processorRef.current) {
      processorRef.current.reset();
    }
  }, []);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-6 shadow-lg">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
            </div>
          </div>
          <h1 className="text-5xl font-bold text-black mb-4">
            AI Object Detection
          </h1>
          <p className="text-xl text-gray-950 max-w-2xl mx-auto leading-relaxed font-semibold">
            Real-time object detection powered by YOLOv8 and ONNX Runtime Web
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-8 border-0 shadow-lg bg-gradient-to-r from-red-50 to-red-100">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-md">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-800 text-lg">Error</h3>
                  <p className="text-red-700 font-medium">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Video Input and Preview */}
          <div className="lg:col-span-2">
            {/* Combined Video Input and Preview Box */}
            <Card className="shadow-lg border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold text-black flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Video Input & Detection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 p-1 rounded-lg">
                    <TabsTrigger 
                      value="upload" 
                      className="data-[state=active]:shadow-sm font-bold text-black"
                    >
                      Video Upload
                    </TabsTrigger>
                    <TabsTrigger 
                      value="camera"
                      className="data-[state=active]:shadow-sm font-bold text-black"
                    >
                      Live Camera
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="upload" className="mt-6">
                    <VideoUpload
                      onVideoSelect={handleVideoSelect}
                      onClear={handleClearVideo}
                      selectedFile={selectedFile}
                    />
                  </TabsContent>
                  
                  <TabsContent value="camera" className="mt-6">
                    <CameraStream
                      onStreamStart={handleCameraStart}
                      onStreamStop={handleCameraStop}
                      isActive={isCameraActive}
                    />
                  </TabsContent>
                </Tabs>

                {/* Video Preview Section - Only show when there's a video source */}
                {(selectedFile || isCameraActive) && (
                  <div className="mt-8">
                    <div className="flex items-center mb-4">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                      <h3 className="text-lg font-bold text-black">Video Preview & Detection</h3>
                    </div>
                    
                    <div className="relative bg-black rounded-xl overflow-hidden shadow-inner">
                      <video
                        ref={videoRef}
                        className="w-full h-auto min-h-[300px] object-contain"
                        controls={!isCameraActive}
                        muted
                        playsInline
                        autoPlay={isCameraActive}
                        preload="none"
                        onLoadedMetadata={() => {
                          if (videoRef.current) {
                            const { videoWidth, videoHeight } = videoRef.current;
                            console.log(`Video dimensions: ${videoWidth}x${videoHeight}`);
                          }
                        }}
                        onCanPlay={() => {
                          console.log('Video can play');
                        }}
                        onPlaying={() => {
                          console.log('Video is playing');
                        }}
                        onError={(e) => {
                          console.error('Video error:', e);
                          const error = videoRef.current?.error;
                          if (error) {
                            console.error('Video error details:', {
                              code: error.code,
                              message: error.message
                            });
                          }
                        }}
                      />
                      <DetectionOverlay
                        detections={detections}
                        videoWidth={videoRef.current?.videoWidth || 640}
                        videoHeight={videoRef.current?.videoHeight || 480}
                        className="absolute inset-0"
                      />
                    </div>

                    {/* Video Controls */}
                    <div className="flex justify-center space-x-3 mt-6">
                      <Button
                        onClick={startProcessing}
                        disabled={!selectedFile && !isCameraActive}
                        className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg hover:shadow-xl px-6 py-2 rounded-lg font-medium"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Detection
                      </Button>
                      
                      <Button
                        onClick={togglePause}
                        disabled={!isProcessing}
                        variant="outline"
                        className="border-2 hover:bg-gray-50 px-6 py-2 rounded-lg font-bold text-black"
                      >
                        {isPaused ? (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Resume
                          </>
                        ) : (
                          <>
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </>
                        )}
                      </Button>
                      
                      <Button
                        onClick={stopProcessing}
                        disabled={!isProcessing}
                        variant="destructive"
                        className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg hover:shadow-xl px-6 py-2 rounded-lg font-medium"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Stop
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Statistics */}
          <div className="space-y-6">
            <StatsPanel
              stats={stats}
              onReset={handleReset}
              onExport={handleExport}
              isProcessing={isProcessing}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-200">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
              <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"></div>
              <div className="w-2 h-2 bg-gradient-to-r from-pink-500 to-red-500 rounded-full"></div>
            </div>
            <p className="text-black font-bold">AI Object Detection Application</p>
            <p className="text-sm text-gray-950 mt-2 font-semibold">
              Built with Next.js, ONNX Runtime Web, and YOLOv8
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}