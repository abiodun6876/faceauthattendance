// utils/faceService.ts
import * as faceapi from 'face-api.js';

interface FaceDetectionResult {
  success: boolean;
  embedding?: Float32Array;
  photoData?: string;
  quality?: number;
  error?: string;
  faceDetected?: boolean;
  isEnhanced?: boolean;
  faceBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

class FaceService {
  private modelsLoaded = false;
  private isInitializing = false;
  private qualityThreshold = 25; // Minimum quality score (0-100) - lowered further for better UX
  private minFaceSize = 80; // Minimum face size in pixels
  private blurThreshold = 120; // Lower is better quality

  async initializeModels() {
    if (this.modelsLoaded) {
      return true;
    }

    if (this.isInitializing) {
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.modelsLoaded;
    }

    this.isInitializing = true;

    try {
      console.log('🚀 Initializing face recognition models...');

      // Load models (from public/models directory)
      const MODEL_URL = '/models';

      // Load only the models needed for attendance — faceExpressionNet removed (not used, wastes load time)
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);

      console.log('✅ Face models loaded successfully');
      this.modelsLoaded = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to load face models:', error);
      this.modelsLoaded = false;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async processImage(photoData: string): Promise<FaceDetectionResult> {
    try {
      // Initialize models if not loaded
      if (!this.modelsLoaded) {
        const initialized = await this.initializeModels();
        if (!initialized) {
          return {
            success: false,
            error: 'Face models failed to load'
          };
        }
      }

      // Create image element
      let img = await this.loadImage(photoData);

      // Pass 1: Standard Detection - Increased inputSize for better reliability (was 160)
      let detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.25
      });

      let detection = await faceapi.detectSingleFace(img, detectionOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();

      let isEnhanced = false;

      // Pass 2: Low-light / Quality Boost (If Pass 1 fails)
      if (!detection) {
        console.log('🔍 Pass 1 failed. Attempting Pass 2 (Enhanced Boosting)...');

        // Apply brightness/contrast enhancement
        const enhancedCanvas = await this.enhanceImage(img);

        // Pass 2 detection: Lower score threshold, higher inputSize
        detectionOptions = new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.15
        });

        detection = await faceapi.detectSingleFace(enhancedCanvas as any, detectionOptions)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          console.log('✅ Face detected in Boost Pass!');
          isEnhanced = true;
          // Note: descriptors from enhanced images are slightly different but usually good enough for matching
        }
      }

      if (!detection) {
        return {
          success: false,
          faceDetected: false,
          error: 'No face detected. Please ensure you are facing the camera directly in a well-lit area.'
        };
      }

      const descriptor = detection.descriptor;
      const box = detection.detection.box;

      // Validate face quality
      const quality = this.calculateFaceQuality(box, img);

      return {
        success: true,
        embedding: descriptor,
        photoData,
        quality,
        faceDetected: true,
        isEnhanced,
        faceBox: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height
        }
      };

    } catch (error: any) {
      console.error('Face processing error:', error);
      return {
        success: false,
        error: error.message || 'Failed to process face image'
      };
    }
  }

  async loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.crossOrigin = 'anonymous';
      img.src = src;
    });
  }

  calculateFaceQuality(box: any, img: HTMLImageElement): number {
    let score = 0;

    // 1. Face size (30%)
    const faceArea = box.width * box.height;
    const imageArea = img.width * img.height;
    const sizeRatio = (faceArea / imageArea) * 100;
    const sizeScore = Math.min(100, (sizeRatio / 20) * 100); // 20% of image is ideal

    // 2. Face position (20%)
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const distanceFromCenter = Math.sqrt(
      Math.pow(centerX - img.width / 2, 2) +
      Math.pow(centerY - img.height / 2, 2)
    );
    const maxDistance = Math.sqrt(Math.pow(img.width, 2) + Math.pow(img.height, 2)) / 2;
    const positionScore = 100 * (1 - distanceFromCenter / maxDistance);

    // 3. Aspect ratio (20%)
    const aspectRatio = box.width / box.height;
    const idealRatio = 0.75; // Typical face ratio
    const ratioScore = 100 * (1 - Math.abs(aspectRatio - idealRatio) / idealRatio);

    // 4. Face landmarks symmetry would go here (30%)
    // For now, we'll give a base score
    const symmetryScore = 70;

    score = (sizeScore * 0.3) + (positionScore * 0.2) + (ratioScore * 0.2) + (symmetryScore * 0.3);

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  async detectAndCropFace(photoData: string): Promise<string> {
    try {
      const result = await this.processImage(photoData);

      if (!result.success || !result.faceBox) {
        throw new Error('No valid face detected');
      }

      const img = await this.loadImage(photoData);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // Add padding around face
      const padding = 20;
      const x = Math.max(0, result.faceBox.x - padding);
      const y = Math.max(0, result.faceBox.y - padding);
      const width = Math.min(img.width - x, result.faceBox.width + padding * 2);
      const height = Math.min(img.height - y, result.faceBox.height + padding * 2);

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

      return canvas.toDataURL('image/jpeg', 0.9);
    } catch (error) {
      console.error('Face cropping error:', error);
      return photoData; // Return original if cropping fails
    }
  }

  compareFaces(descriptor1: Float32Array, descriptor2: any, threshold = 0.6): boolean {
    try {
      let d2 = descriptor2;
      if (typeof d2 === 'string') {
        d2 = new Float32Array(JSON.parse(d2));
      } else if (Array.isArray(d2)) {
        d2 = new Float32Array(d2);
      } else if (d2 && typeof d2 === 'object') {
        d2 = new Float32Array(Object.values(d2));
      }

      if (!d2 || d2.length !== 128) return false;

      const distance = faceapi.euclideanDistance(descriptor1, d2);
      return distance < threshold;
    } catch (e) {
      console.error('Error comparing faces:', e);
      return false;
    }
  }

  /**
   * Enhances image brightness and contrast using a virtual canvas.
   * This is used as a fallback for low-light conditions.
   */
  private async enhanceImage(img: HTMLImageElement): Promise<HTMLCanvasElement | HTMLImageElement> {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return img;

      canvas.width = img.width;
      canvas.height = img.height;

      // Apply brightness and contrast filters
      // Brightness: 1.5x, Contrast: 1.2x
      ctx.filter = 'brightness(150%) contrast(120%)';
      ctx.drawImage(img, 0, 0);

      return canvas;
    } catch (e) {
      console.warn('Image enhancement failed, falling back to original:', e);
      return img;
    }
  }

  getStatus() {
    return {
      modelsLoaded: this.modelsLoaded,
      isInitializing: this.isInitializing,
      qualityThreshold: this.qualityThreshold
    };
  }
}

// Create instance and export it
const faceService = new FaceService();
export default faceService;