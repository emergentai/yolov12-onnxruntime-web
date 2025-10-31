import * as ort from 'onnxruntime-web';
import { Detection, ModelMetadata } from './types';

/**
 * Object detection using YOLOv12 ONNX model via ONNX Runtime Web
 */
export class ObjectDetector {
  private session: ort.InferenceSession | null = null;
  private metadata: ModelMetadata | null = null;
  private isInitialized = false;

  /**
   * Initializes the ONNX model session and loads metadata
   */
  async initialize(): Promise<void> {
    try {
      // Load model metadata
      const metadataResponse = await fetch('/models/model-metadata.json');
      this.metadata = await metadataResponse.json();

      // Configure ONNX Runtime Web
    //   ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/';
    //   ort.env.wasm.simd = true;
    //   ort.env.wasm.proxy = false;
      
      // Try different execution providers in order of preference
      const executionProviders = [
        ['wasm'],
        // ['webgl'],
        // ['cpu'],
        // ['webgl', 'cpu']
      ];

      let lastError: Error | null = null;
      
      for (const providers of executionProviders) {
        try {
          console.log(`Trying execution providers: ${providers.join(', ')}`);
          
          this.session = await ort.InferenceSession.create('/models/yolov12n.onnx', {
            executionProviders: providers,
            graphOptimizationLevel: 'all',
            enableCpuMemArena: true,
            enableMemPattern: true
          });

          // Log model input/output names for debugging
          console.log('Model input names:', this.session.inputNames);
          console.log('Model output names:', this.session.outputNames);
          console.log('Model input metadata:', this.session.inputMetadata);
          console.log('Model output metadata:', this.session.outputMetadata);

          this.isInitialized = true;
          console.log(`Object detector initialized successfully with providers: ${providers.join(', ')}`);
          return;
        } catch (error) {
          console.warn(`Failed with providers ${providers.join(', ')}:`, error);
          lastError = error as Error;
          continue;
        }
      }

      // If all providers failed, throw the last error
      throw lastError || new Error('All execution providers failed');
      
    } catch (error) {
      console.error('Failed to initialize object detector:', error);
      throw error;
    }
  }

  /**
   * Detects objects in an image frame
   * @param imageData - Image data from video frame
   * @returns Array of detected objects with bounding boxes and confidence scores
   */
  async detectObjects(imageData: ImageData): Promise<Detection[]> {
    if (!this.session || !this.metadata || !this.isInitialized) {
      throw new Error('Detector not initialized');
    }

    try {
      // Preprocess image
      const input = this.preprocessImage(imageData);
      
      console.log(input);

      // Run inference using actual model input/output names
      const inputName = this.session.inputNames[0];
      const outputName = this.session.outputNames[0];
      
      console.log(`Using input name: ${inputName}, output name: ${outputName}`);
      
      const results = await this.session.run({ [inputName]: input });
      const output = results[outputName] as ort.Tensor;
      
      console.log('Model output results:', results);
      console.log('Output tensor:', output);
      console.log('Tensor shape:', output.dims);
      console.log('Tensor data type:', output.type);

      // Postprocess results
      const detections = this.postprocessResults(output, imageData.width, imageData.height);
      
      return detections;
    } catch (error) {
      console.error('Detection failed:', error);
      return [];
    }
  }

  /**
   * Preprocesses image for model input: resizes, pads, and normalizes to [0,1]
   */
  private preprocessImage(imageData: ImageData): ort.Tensor {
    const [inputWidth, inputHeight] = this.metadata!.inputSize;
    
    // Create canvas for padded image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = inputWidth;
    canvas.height = inputHeight;
    
    // Fill canvas with black background (padding)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, inputWidth, inputHeight);
    
    // Calculate scaling and positioning to maintain aspect ratio
    const aspectRatio = imageData.width / imageData.height;
    const targetAspectRatio = inputWidth / inputHeight;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (aspectRatio > targetAspectRatio) {
      // Image is wider - fit to width, add padding top/bottom
      drawWidth = inputWidth;
      drawHeight = inputWidth / aspectRatio;
      offsetX = 0;
      offsetY = (inputHeight - drawHeight) / 2;
    } else {
      // Image is taller - fit to height, add padding left/right
      drawHeight = inputHeight;
      drawWidth = inputHeight * aspectRatio;
      offsetX = (inputWidth - drawWidth) / 2;
      offsetY = 0;
    }
    
    // Create a temporary canvas to hold the original image data
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    
    // Put the ImageData onto the temporary canvas
    tempCtx.putImageData(imageData, 0, 0);
    
    // Draw the image centered with padding, maintaining aspect ratio
    ctx.drawImage(tempCanvas, 0, 0, imageData.width, imageData.height, 
                  offsetX, offsetY, drawWidth, drawHeight);
    
    const paddedImageData = ctx.getImageData(0, 0, inputWidth, inputHeight);
    
    // Convert to tensor (normalize to 0-1)
    const data = new Float32Array(inputWidth * inputHeight * 3);
    for (let i = 0; i < paddedImageData.data.length; i += 4) {
      const pixelIndex = i / 4;
      data[pixelIndex] = paddedImageData.data[i] / 255;         // R
      data[pixelIndex + inputWidth * inputHeight] = paddedImageData.data[i + 1] / 255;     // G
      data[pixelIndex + 2 * inputWidth * inputHeight] = paddedImageData.data[i + 2] / 255; // B
    }
    
    return new ort.Tensor('float32', data, [1, 3, inputHeight, inputWidth]);
  }

  /**
   * Converts model output to Detection objects with transformed coordinates
   */
  private postprocessResults(output: ort.Tensor, originalWidth: number, originalHeight: number): Detection[] {
    const [inputWidth, inputHeight] = this.metadata!.inputSize;
    
    // Calculate padding offsets for coordinate transformation
    const aspectRatio = originalWidth / originalHeight;
    const targetAspectRatio = inputWidth / inputHeight;
    
    let paddingX, paddingY, scaleX, scaleY;
    
    if (aspectRatio > targetAspectRatio) {
      // Image was fitted to width, padded top/bottom
      scaleX = originalWidth / inputWidth;
      scaleY = originalWidth / inputWidth; // Same scale for both dimensions
      paddingX = 0;
      paddingY = (inputHeight - (inputWidth / aspectRatio)) / 2;
    } else {
      // Image was fitted to height, padded left/right
      scaleX = originalHeight / inputHeight;
      scaleY = originalHeight / inputHeight; // Same scale for both dimensions
      paddingX = (inputWidth - (inputHeight * aspectRatio)) / 2;
      paddingY = 0;
    }
    
    const detections: Detection[] = [];
    const outputData = output.data as Float32Array;
    
    // YOLO output format: [batch, num_detections, 6] where 6 = x1, y1, x2, y2, confidence, class_id
    const numDetections = output.dims[1]; // 300
    console.log(`Processing ${numDetections} detections from tensor shape:`, output.dims);
    
    for (let i = 0; i < numDetections; i++) {
      const startIdx = i * 6; // Fixed 6 values per detection
      
      // Get bounding box coordinates (x1, y1, x2, y2)
      const x1 = outputData[startIdx];
      const y1 = outputData[startIdx + 1];
      const x2 = outputData[startIdx + 2];
      const y2 = outputData[startIdx + 3];
      const confidence = outputData[startIdx + 4];
      const classId = Math.round(outputData[startIdx + 5]); // Class ID as integer
      
      // Skip low confidence detections
      if (confidence < this.metadata!.confidenceThreshold) continue;
      
      // Debug logging for first few detections
      if (i < 5) {
        console.log(`Detection ${i}:`, {
          x1, y1, x2, y2, confidence, classId,
          className: this.metadata!.classes[classId] || `class_${classId}`
        });
      }
      
      // Transform from padded coordinates to original image coordinates
      const transformedX1 = (x1 - paddingX) * scaleX;
      const transformedY1 = (y1 - paddingY) * scaleY;
      const transformedX2 = (x2 - paddingX) * scaleX;
      const transformedY2 = (y2 - paddingY) * scaleY;
      
      // Convert to Detection format (x, y, width, height)
      const x = Math.max(0, transformedX1);
      const y = Math.max(0, transformedY1);
      const width = Math.max(0, transformedX2 - transformedX1);
      const height = Math.max(0, transformedY2 - transformedY1);
      
      // Get class name from metadata
      const className = this.metadata!.classes[classId] || `class_${classId}`;
      
      const detection: Detection = {
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: Math.min(width, originalWidth - x),
        height: Math.min(height, originalHeight - y),
        confidence: confidence,
        class: className
      };
      
      detections.push(detection);
    }
    
    console.log(`Found ${detections.length} detections after filtering`);
    
    // Apply Non-Maximum Suppression
    return this.applyNMS(detections);
  }

  /**
   * Applies Non-Maximum Suppression to remove overlapping detections
   */
  private applyNMS(detections: Detection[]): Detection[] {
    // Sort by confidence
    detections.sort((a, b) => b.confidence - a.confidence);
    
    const filtered: Detection[] = [];
    const used = new Set<number>();
    
    for (let i = 0; i < detections.length; i++) {
      if (used.has(i)) continue;
      
      const detection = detections[i];
      filtered.push(detection);
      used.add(i);
      
      // Remove overlapping detections
      for (let j = i + 1; j < detections.length; j++) {
        if (used.has(j)) continue;
        
        const other = detections[j];
        const iou = this.calculateIoU(detection, other);
        
        if (iou > this.metadata!.nmsThreshold) {
          used.add(j);
        }
      }
    }
    
    return filtered;
  }

  /**
   * Calculates Intersection over Union (IoU) between two detections
   */
  private calculateIoU(det1: Detection, det2: Detection): number {
    const x1 = Math.max(det1.x, det2.x);
    const y1 = Math.max(det1.y, det2.y);
    const x2 = Math.min(det1.x + det1.width, det2.x + det2.width);
    const y2 = Math.min(det1.y + det1.height, det2.y + det2.height);
    
    if (x2 <= x1 || y2 <= y1) return 0;
    
    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = det1.width * det1.height;
    const area2 = det2.width * det2.height;
    const union = area1 + area2 - intersection;
    
    return intersection / union;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  dispose(): void {
    if (this.session) {
      this.session.release();
      this.session = null;
    }
    this.isInitialized = false;
  }
}
