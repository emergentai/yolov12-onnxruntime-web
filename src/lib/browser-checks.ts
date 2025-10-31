/**
 * Browser capability checks for ONNX Runtime Web requirements
 */

export interface BrowserCheckResult {
  passed: boolean;
  message: string;
}

/**
 * Checks if WebGL is supported
 */
export function checkWebGL(): BrowserCheckResult {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
      return {
        passed: false,
        message: 'WebGL is not supported. Please use a modern browser like Chrome, Firefox, or Edge.'
      };
    }
    
    return {
      passed: true,
      message: 'WebGL is supported'
    };
  } catch (e) {
    return {
      passed: false,
      message: 'WebGL check failed: ' + (e instanceof Error ? e.message : 'Unknown error')
    };
  }
}

/**
 * Checks if MediaStream API is supported (for camera access)
 */
export function checkMediaStream(): BrowserCheckResult {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      passed: false,
      message: 'Camera access is not supported. Please use HTTPS or localhost.'
    };
  }
  
  return {
    passed: true,
    message: 'MediaStream API is supported'
  };
}

/**
 * Checks if FileReader API is supported (for video upload)
 */
export function checkFileReader(): BrowserCheckResult {
  if (!window.FileReader) {
      return {
        passed: false,
        message: 'File reading is not supported in this browser'
      };
  }
  
  return {
    passed: true,
    message: 'FileReader API is supported'
  };
}

/**
 * Checks if SharedArrayBuffer is available (required for ONNX Runtime Web)
 */
export function checkSharedArrayBuffer(): BrowserCheckResult {
  if (typeof SharedArrayBuffer === 'undefined') {
    return {
      passed: false,
      message: 'SharedArrayBuffer is not available. This may be due to missing security headers.'
    };
  }
  
  return {
    passed: true,
    message: 'SharedArrayBuffer is available'
  };
}

/**
 * Runs all browser compatibility checks
 */
export function checkBrowserCompatibility(): {
  allPassed: boolean;
  results: BrowserCheckResult[];
  errors: string[];
} {
  const checks = [
    { name: 'WebGL', check: checkWebGL },
    { name: 'MediaStream', check: checkMediaStream },
    { name: 'FileReader', check: checkFileReader },
    { name: 'SharedArrayBuffer', check: checkSharedArrayBuffer }
  ];
  
  const results: BrowserCheckResult[] = [];
  const errors: string[] = [];
  
  checks.forEach(({ name, check }) => {
    const result = check();
    results.push(result);
    
    if (!result.passed) {
      errors.push(`${name}: ${result.message}`);
    }
  });
  
  return {
    allPassed: errors.length === 0,
    results,
    errors
  };
}
