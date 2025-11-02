import { useState, useRef, useEffect, useCallback } from 'react';
import { FileUpload } from '@/components/file-upload';
import { DetectionOverlay } from '@/components/detection-overlay';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ObjectDetector } from '@/lib/object-detector';
import { VideoProcessor } from '@/lib/video-processor';
import { Detection } from '@/lib/types';
import { checkBrowserCompatibility } from '@/lib/browser-checks';
import { Play, Square, Info, Camera, CameraOff } from 'lucide-react';
import './globals.css';

function App() {
  // State management
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  const [imageDimensions, setImageDimensions] = useState({ width: 640, height: 480 });
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [inputType, setInputType] = useState<'upload' | 'camera'>('upload');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const detectorRef = useRef<ObjectDetector | null>(null);
  const processorRef = useRef<VideoProcessor | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check browser compatibility on mount
  useEffect(() => {
    const compatibility = checkBrowserCompatibility();
    if (!compatibility.allPassed) {
      console.error('Browser compatibility issues:', compatibility.errors.join(' '));
    }
  }, []);

  // Clear detections and file selections when changing tabs
  useEffect(() => {
    setDetections([]);
    
    // Clear video file selection
    if (selectedFile) {
      // Clean up object URL if it exists
      if (videoRef.current && videoRef.current.src && videoRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(videoRef.current.src);
      }
      setSelectedFile(null);
      if (videoRef.current) {
        videoRef.current.src = '';
        videoRef.current.srcObject = null;
      }
      if (processorRef.current) {
        processorRef.current.reset();
      }
    }
    
    // Clear image file selection
    if (selectedImage) {
      if (imageRef.current && imageRef.current.src && imageRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(imageRef.current.src);
      }
      setSelectedImage(null);
      if (imageRef.current) {
        imageRef.current.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // 1x1 transparent pixel
      }
    }
    
    // Also stop processing if it's running
    if (isProcessing) {
      setIsProcessing(false);
      if (processorRef.current) {
        processorRef.current.stopProcessing();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputType]);

  // Initialize detector
  useEffect(() => {
    const initDetector = async () => {
      try {
        console.log('Initializing AI detector...');
        const detector = new ObjectDetector();
        await detector.initialize();
        detectorRef.current = detector;
        console.log('AI detector initialized successfully');
      } catch (err) {
        console.error('Failed to initialize AI detector. Please check that the model file is available:', err);
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
        console.error('Failed to start camera preview:', err);
      });
    }
  }, [isCameraActive]);

  // Handle video file selection - set video src when selectedFile changes
  useEffect(() => {
    if (selectedFile && videoRef.current && !isCameraActive) {
      // Clear any existing stream
      videoRef.current.srcObject = null;
      
      // Create object URL and set as source
      const url = URL.createObjectURL(selectedFile);
      videoRef.current.src = url;
      
      // Load the video
      videoRef.current.load();
      
      // Cleanup function to revoke object URL when component unmounts or file changes
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [selectedFile, isCameraActive]);

  // Handle image file selection - set image src when selectedImage changes
  useEffect(() => {
    if (selectedImage && imageRef.current) {
      // Create object URL and set as source
      const url = URL.createObjectURL(selectedImage);
      imageRef.current.src = url;
      
      // Set dimensions when image loads and automatically trigger detection
      const handleImageLoad = async () => {
        if (imageRef.current && detectorRef.current) {
          const { naturalWidth, naturalHeight } = imageRef.current;
          setImageDimensions({ width: naturalWidth, height: naturalHeight });
          
          // Automatically run detection when image loads
          try {
            setIsProcessing(true);

            // Create canvas to get image data
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              setIsProcessing(false);
              return;
            }

            canvas.width = naturalWidth;
            canvas.height = naturalHeight;
            ctx.drawImage(imageRef.current, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const newDetections = await detectorRef.current.detectObjects(imageData);
            setDetections(newDetections);
          } catch (err) {
            console.error('Failed to detect objects in image:', err);
          } finally {
            setIsProcessing(false);
          }
        }
      };
      
      imageRef.current.onload = handleImageLoad;
      
      // Cleanup function to revoke object URL when component unmounts or file changes
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [selectedImage]);

  // Handle video file selection
  const handleVideoSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setSelectedImage(null);
    setIsCameraActive(false);
  }, []);

  // Handle image file selection
  const handleImageSelect = useCallback((file: File) => {
    setSelectedImage(file);
    setSelectedFile(null);
    setIsCameraActive(false);
  }, []);

  // Handle image clear
  const handleClearImage = useCallback(() => {
    if (imageRef.current && imageRef.current.src && imageRef.current.src.startsWith('blob:')) {
      URL.revokeObjectURL(imageRef.current.src);
    }
    setSelectedImage(null);
    setDetections([]);
    if (imageRef.current) {
      imageRef.current.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // 1x1 transparent pixel
    }
  }, []);

  const handleClearVideo = useCallback(() => {
    // Clean up object URL if it exists
    if (videoRef.current && videoRef.current.src && videoRef.current.src.startsWith('blob:')) {
      URL.revokeObjectURL(videoRef.current.src);
    }
    
    setSelectedFile(null);
    setDetections([]);
    
    if (videoRef.current) {
      videoRef.current.src = '';
      videoRef.current.srcObject = null;
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
              console.error('Failed to start camera preview:', err);
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
    // Stop detection if it's running
    if (isProcessing) {
      setIsProcessing(false);
      if (processorRef.current) {
        processorRef.current.stopProcessing();
      }
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsCameraActive(false);
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [isProcessing]);

  // Start/stop processing
  const startProcessing = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current) return;

    try {
      setIsProcessing(true);

      const processor = new VideoProcessor(
        (newDetections) => {
          console.log(`Displaying ${newDetections.length} detections for current frame`);
          setDetections(newDetections);
        },
        () => {} // Stats callback not needed anymore
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
      console.error('Failed to start processing:', err);
      setIsProcessing(false);
    }
  }, []);

  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    
    if (processorRef.current) {
      processorRef.current.stopProcessing();
    }
  }, []);


  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="relative text-center mb-8">
          {/* Info Button and Theme Toggle */}
          <div className="absolute top-0 right-0 flex gap-2 sm:right-4">
            <ThemeToggle />
            <Dialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
              <DialogTrigger asChild>
                  <Button
                  variant="ghost"
                  size="icon"
                  aria-label="View model information"
                >
                  <Info className="h-5 w-5 text-foreground" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-foreground mb-2">
                    Model & Technology Information
                  </DialogTitle>
                  <DialogDescription className="text-base text-muted-foreground">
                    Core information about the AI model and tech stack
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  {/* Model Information */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-foreground border-b border-border pb-2">
                      AI Model
                    </h3>
                    <div className="space-y-2 pl-4">
                      <div className="flex items-start">
                        <span className="font-semibold text-foreground min-w-[120px]">Model:</span>
                        <span className="text-muted-foreground">yolov12n.onnx</span>
                      </div>
                      <div className="flex items-start">
                        <span className="font-semibold text-foreground min-w-[120px]">Size:</span>
                        <span className="text-muted-foreground">11.9 MB</span>
                      </div>
                      <div className="flex items-start">
                        <span className="font-semibold text-foreground min-w-[120px]">Runtime:</span>
                        <span className="text-muted-foreground">ONNX Runtime through onnxruntime-web package</span>
                      </div>
                      <div className="flex items-start">
                        <span className="font-semibold text-foreground min-w-[120px]">Repository:</span>
                        <a 
                          href="https://github.com/sunsmarterjie/yolov12" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground underline"
                        >
                          https://github.com/sunsmarterjie/yolov12
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Tech Stack */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-foreground border-b border-border pb-2">
                      Technology Stack
                    </h3>
                    <div className="space-y-2 pl-4">
                      <div className="flex items-start">
                        <span className="font-semibold text-foreground min-w-[140px]">Framework:</span>
                        <span className="text-muted-foreground">React 19 with Vite</span>
                      </div>
                      <div className="flex items-start">
                        <span className="font-semibold text-foreground min-w-[140px]">Runtime:</span>
                        <span className="text-muted-foreground">Browser (Client-side)</span>
                      </div>
                      <div className="flex items-start">
                        <span className="font-semibold text-foreground min-w-[140px]">UI Library:</span>
                        <span className="text-muted-foreground">React 19</span>
                      </div>
                      <div className="flex items-start">
                        <span className="font-semibold text-foreground min-w-[140px]">Language:</span>
                        <span className="text-muted-foreground">TypeScript 5</span>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <h1 className="text-4xl font-bold text-foreground mb-4">
            YOLOv12 Object Detection
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Real-time object detection powered by YOLOv12 and ONNX Runtime Web
          </p>
        </div>

        {/* Tabs at the Top */}
        <div className="flex justify-center">
          <Tabs value={inputType} onValueChange={(v) => setInputType(v as 'upload' | 'camera')} className="w-auto">
            <TabsList className="inline-flex w-auto p-1 rounded-lg">
              <TabsTrigger 
                value="upload" 
                className="font-bold text-foreground"
              >
                Video/Image Upload
              </TabsTrigger>
              <TabsTrigger 
                value="camera"
                className="font-bold text-foreground"
              >
                Live Camera
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Main Content Area */}
        <Card>
          <CardContent className="p-6">
            <div className="w-full">
              {/* Upload Section - Unified Video and Image */}
              {inputType === 'upload' && !selectedFile && !selectedImage && (
                <FileUpload
                  onVideoSelect={handleVideoSelect}
                  onImageSelect={handleImageSelect}
                  onClear={() => {
                    if (selectedFile) {
                      handleClearVideo();
                    }
                    if (selectedImage) {
                      handleClearImage();
                    }
                  }}
                  selectedVideo={selectedFile}
                  selectedImage={selectedImage}
                />
              )}

              {inputType === 'camera' && (
                <div className="space-y-6">
                  {/* Video Preview - Always visible */}
                  <div className="relative bg-card rounded overflow-hidden min-h-[400px] max-h-[600px] flex items-center justify-center">
                    {!isCameraActive ? (
                      <div className="text-center">
                        <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg">Camera Not Started</p>
                        <p className="text-sm mt-2">Click &quot;Start Camera&quot; below to begin</p>
                      </div>
                    ) : (
                      <>
                        <video
                          ref={videoRef}
                          className="w-full h-auto max-h-[600px] object-contain"
                          muted
                          playsInline
                          autoPlay
                          preload="none"
                          onLoadedMetadata={() => {
                            if (videoRef.current) {
                              const { videoWidth, videoHeight } = videoRef.current;
                              setVideoDimensions({ width: videoWidth, height: videoHeight });
                            }
                          }}
                        />
                        <DetectionOverlay
                          detections={detections}
                          videoWidth={videoDimensions.width}
                          videoHeight={videoDimensions.height}
                          className="absolute inset-0"
                        />
                      </>
                    )}
                  </div>

                  {/* Camera and Detection Controls */}
                  <div className="flex justify-center space-x-3">
                    {/* Camera Control */}
                    {!isCameraActive ? (
                      <Button
                        onClick={async () => {
                          try {
                            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                              console.error('Camera access not supported in this browser');
                              return;
                            }
                            
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
                            } catch {
                              stream = await navigator.mediaDevices.getUserMedia({
                                video: true,
                                audio: false
                              });
                            }
                            
                            handleCameraStart(stream);
                          } catch (err) {
                            const errorMessage = err instanceof Error ? err.message : 'Failed to access camera';
                            console.error('Camera access error:', errorMessage, err);
                          }
                        }}
                        variant="outline"
                        className="px-6 py-2"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Start Camera
                      </Button>
                    ) : (
                      <Button
                        onClick={handleCameraStop}
                        variant="outline"
                        className="px-6 py-2"
                      >
                        <CameraOff className="h-4 w-4 mr-2" />
                        Stop Camera
                      </Button>
                    )}

                    {/* Detection Control */}
                    {!isProcessing ? (
                      <Button
                        onClick={startProcessing}
                        disabled={!isCameraActive}
                        variant="outline"
                        className="px-6 py-2"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Detection
                      </Button>
                    ) : (
                      <Button
                        onClick={stopProcessing}
                        variant="outline"
                        className="px-6 py-2"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Stop Detection
                      </Button>
                    )}
                  </div>
                </div>
              )}

                {/* Video Preview Section - Only show for uploaded videos, not camera */}
                {selectedFile && !isCameraActive && (
                  <div>
                    <div className="relative bg-background rounded overflow-hidden">
                      <video
                        ref={videoRef}
                        className="w-full h-auto min-h-[300px] max-h-[600px] object-contain"
                        controls={!isCameraActive}
                        muted
                        playsInline
                        autoPlay={isCameraActive}
                        preload={isCameraActive ? "none" : "metadata"}
                        onLoadedMetadata={() => {
                          if (videoRef.current) {
                            const { videoWidth, videoHeight } = videoRef.current;
                            console.log(`Video dimensions: ${videoWidth}x${videoHeight}`);
                            setVideoDimensions({ width: videoWidth, height: videoHeight });
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
                        onEnded={() => {
                          // Stop detection when uploaded video ends (not for camera streams)
                          if (!isCameraActive && selectedFile && isProcessing) {
                            console.log('Video ended, stopping detection');
                            stopProcessing();
                          }
                        }}
                      />
                      <DetectionOverlay
                        detections={detections}
                        videoWidth={videoDimensions.width}
                        videoHeight={videoDimensions.height}
                        className="absolute inset-0"
                      />
                    </div>

                    {/* Video Controls */}
                    <div className="relative flex justify-center items-center mt-6">
                      {!isProcessing ? (
                        <Button
                          onClick={startProcessing}
                          disabled={!selectedFile}
                          variant="outline"
                          className="px-6 py-2"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start Detection
                        </Button>
                      ) : (
                        <Button
                          onClick={stopProcessing}
                          variant="outline"
                          className="px-6 py-2"
                        >
                          <Square className="h-4 w-4 mr-2" />
                          Stop Detection
                        </Button>
                      )}
                      <div className="absolute right-0">
                        <FileUpload
                          onVideoSelect={handleVideoSelect}
                          onImageSelect={handleImageSelect}
                          onClear={() => {
                            if (selectedFile) {
                              handleClearVideo();
                            }
                            if (selectedImage) {
                              handleClearImage();
                            }
                          }}
                          selectedVideo={selectedFile}
                          selectedImage={selectedImage}
                          showCompactBanner={true}
                        />
                      </div>
                    </div>
                  </div>
                )}

              {/* Image Preview Section */}
              {selectedImage && (
                <>
                  <div className="flex justify-center pb-5">
                    <div className="relative inline-block max-w-full overflow-auto" >
                      <img
                        ref={imageRef}
                        alt="Uploaded image"
                        className="block max-w-full w-auto h-auto object-contain"
                        onLoad={() => {
                          if (imageRef.current) {
                            const { naturalWidth, naturalHeight } = imageRef.current;
                            setImageDimensions({ width: naturalWidth, height: naturalHeight });
                          }
                        }}
                      />
                      {imageDimensions.width > 0 && imageDimensions.height > 0 && (
                        <DetectionOverlay
                          detections={detections}
                          videoWidth={imageDimensions.width}
                          videoHeight={imageDimensions.height}
                          className="absolute top-0 left-0"
                        />
                      )}
                    </div>
                  </div>

                  {/* Image Controls */}
                  <div className="relative flex justify-center items-center mt-6">
                    {isProcessing && (
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Processing image...</p>
                      </div>
                    )}
                    <div className="absolute right-0">
                      <FileUpload
                        onVideoSelect={handleVideoSelect}
                        onImageSelect={handleImageSelect}
                        onClear={() => {
                          if (selectedFile) {
                            handleClearVideo();
                          }
                          if (selectedImage) {
                            handleClearImage();
                          }
                        }}
                        selectedVideo={selectedFile}
                        selectedImage={selectedImage}
                        showCompactBanner={true}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Remove the Tabs section from here - it's now at the top of the page */}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default App;

