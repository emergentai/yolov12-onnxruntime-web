import { Detection, DetectionStats } from './types';

/**
 * Processes video frames for object detection
 */
export class VideoProcessor {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isProcessing = false;
  private frameRate = 10; // Process 10 frames per second
  private lastFrameTime = 0;
  private detectionCallback: (detections: Detection[]) => void;
  private statsCallback: (stats: DetectionStats) => void;
  private allDetections: Detection[] = [];
  private stats: DetectionStats = {
    totalDetections: 0,
    averageConfidence: 0,
    lastDetectionTime: 0,
    classCounts: {}
  };

  constructor(
    detectionCallback: (detections: Detection[]) => void,
    statsCallback: (stats: DetectionStats) => void
  ) {
    this.detectionCallback = detectionCallback;
    this.statsCallback = statsCallback;
    
    // Create hidden canvas for frame extraction
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Sets the video element to process
   */
  setVideo(video: HTMLVideoElement): void {
    this.video = video;
    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;
  }

  setFrameRate(fps: number): void {
    this.frameRate = fps;
  }

  /**
   * Starts frame extraction loop at configured frame rate
   */
  startProcessing(): void {
    if (!this.video) {
      throw new Error('No video element set');
    }
    
    this.isProcessing = true;
    this.processFrame();
  }

  stopProcessing(): void {
    this.isProcessing = false;
  }

  isProcessingStopped(): boolean {
    return !this.isProcessing;
  }

  private processFrame(): void {
    if (!this.isProcessing || !this.video) return;

    const now = performance.now();
    const timeSinceLastFrame = now - this.lastFrameTime;
    const targetFrameTime = 1000 / this.frameRate;

    if (timeSinceLastFrame >= targetFrameTime) {
      this.extractFrame();
      this.lastFrameTime = now;
    }

    requestAnimationFrame(() => this.processFrame());
  }

  private extractFrame(): void {
    if (!this.video || this.video.videoWidth === 0 || this.video.videoHeight === 0) {
      return;
    }

    // Update canvas size if video size changed
    if (this.canvas.width !== this.video.videoWidth || this.canvas.height !== this.video.videoHeight) {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
    }

    // Draw current video frame to canvas
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    
    // Get image data for processing
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    // Emit frame for detection (this will be handled by the detector)
    this.emitFrame(imageData);
  }

  private emitFrame(imageData: ImageData): void {
    // This method will be called by the detector when it's ready to process
    // The actual detection logic is in the PotholeDetector class
  }

  /**
   * Updates detection results and statistics
   */
  updateDetections(detections: Detection[]): void {
    // Accumulate for statistics (total counts across all frames)
    this.allDetections = [...this.allDetections, ...detections];
    this.updateStats(detections);
    
    console.log(`Frame detections: ${detections.length}, Total accumulated: ${this.allDetections.length}`);
    
    // Send current frame detections for display (replaces previous frame's detections)
    this.detectionCallback(detections);
    this.statsCallback(this.stats);
  }

  private updateStats(newDetections: Detection[]): void {
    if (newDetections.length === 0) return;

    // Update counts
    this.stats.totalDetections += newDetections.length;
    
    newDetections.forEach(detection => {
      // Count by class
      if (this.stats.classCounts[detection.class]) {
        this.stats.classCounts[detection.class]++;
      } else {
        this.stats.classCounts[detection.class] = 1;
      }
    });

    // Update average confidence
    const totalConfidence = this.allDetections.reduce((sum, d) => sum + d.confidence, 0);
    this.stats.averageConfidence = totalConfidence / this.allDetections.length;
    
    // Update last detection time
    this.stats.lastDetectionTime = Date.now();
  }

  /**
   * Extracts current video frame as ImageData
   */
  getCurrentFrame(): ImageData | null {
    if (!this.video || this.video.videoWidth === 0 || this.video.videoHeight === 0) {
      return null;
    }

    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  reset(): void {
    this.allDetections = [];
    this.stats = {
      totalDetections: 0,
      averageConfidence: 0,
      lastDetectionTime: 0,
      classCounts: {}
    };
    this.statsCallback(this.stats);
  }

  exportDetections(): Detection[] {
    return [...this.allDetections];
  }

  exportStats(): DetectionStats {
    return { ...this.stats };
  }
}
