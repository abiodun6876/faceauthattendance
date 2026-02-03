// utils/faceService.ts
import * as faceapi from 'face-api.js';

interface FaceDetectionResult {
  success: boolean;
  embedding?: Float32Array;
  photoData?: string;
  quality?: number;
  error?: string;
  faceDetected?: boolean;
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
  private qualityThreshold = 50; // Minimum quality score (0-100)
  private minFaceSize = 100; // Minimum face size in pixels
  private blurThreshold = 100; // Lower is better quality

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
      
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
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
      const img = await this.loadImage(photoData);
      
      // Detect face
      const detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 512,
        scoreThreshold: 0.5
      });

      const detections = await faceapi.detectAllFaces(img, detectionOptions)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (!detections || detections.length === 0) {
        return {
          success: false,
          faceDetected: false,
          error: 'No face detected in the image'
        };
      }

      // Multiple faces detected
      if (detections.length > 1) {
        return {
          success: false,
          faceDetected: true,
          error: 'Multiple faces detected. Please use an image with only one face.'
        };
      }

      const detection = detections[0];
      const descriptor = detection.descriptor;
      const box = detection.detection.box;

      // Validate face quality
      const quality = this.calculateFaceQuality(box, img);
      
      if (quality < this.qualityThreshold) {
        return {
          success: false,
          faceDetected: true,
          quality,
          error: 'Face quality too low. Please use a clearer, well-lit frontal image.'
        };
      }

      // Convert to array for database storage
      // Comment out or remove the unused variable
      // const embeddingArray = Array.from(descriptor);
      // If you need to use it, uncomment and use it:
      // console.log('Embedding array length:', embeddingArray.length);

      return {
        success: true,
        embedding: descriptor,
        photoData,
        quality,
        faceDetected: true,
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