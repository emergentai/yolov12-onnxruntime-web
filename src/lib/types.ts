export interface Detection {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
}

export interface DetectionStats {
  totalDetections: number;
  averageConfidence: number;
  lastDetectionTime: number;
  classCounts: Record<string, number>;
}

export interface ModelMetadata {
  inputSize: [number, number];
  classes: string[];
  confidenceThreshold: number;
  nmsThreshold: number;
}
