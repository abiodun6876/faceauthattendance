import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs';
import { supabase } from '../lib/supabase';

class FaceRecognition {
  private static instance: FaceRecognition;
  private modelsLoaded = false;
  private useTinyModel = true; // Use tiny model for mobile
  
  // For local storage of embeddings
  private readonly EMBEDDINGS_KEY = 'face_embeddings';
  
  private constructor() {}
  
  public static getInstance(): FaceRecognition {
    if (!FaceRecognition.instance) {
      FaceRecognition.instance = new FaceRecognition();
    }
    return FaceRecognition.instance;
  }
  
  async loadModels() {
    if (this.modelsLoaded) return;
    
    try {
      console.log('Loading face recognition models for mobile...');
      
      // FOR MOBILE: Use tiny models for better performance
      if (this.useTinyModel) {
        console.log('Using tiny face detector for mobile...');
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      } else {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
      }
      
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      
      // Configure TensorFlow.js for mobile
      await this.configureTensorFlowForMobile();
      
      this.modelsLoaded = true;
      console.log('Face recognition models loaded successfully on mobile');
      
    } catch (error) {
      console.error('Failed to load models on mobile:', error);
      // Try alternative loading strategy
      await this.loadModelsAlternative();
    }
  }
  
  private async configureTensorFlowForMobile() {
    // Optimize TensorFlow for mobile
    await tf.ready();
    
    // Set backend - try WebGL first, fall back to CPU
    const backends = ['webgl', 'cpu'];
    
    for (const backend of backends) {
      try {
        await tf.setBackend(backend);
        console.log(`TensorFlow backend set to: ${backend}`);
        break;
      } catch (err) {
        console.warn(`Failed to set backend ${backend}:`, err);
        continue;
      }
    }
    
    // Optimize for mobile
    tf.ENV.set('WEBGL_PACK', true);
    tf.ENV.set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
    
    console.log('TensorFlow ready. Backend:', tf.getBackend());
  }
  
  private async loadModelsAlternative() {
    console.log('Trying alternative model loading...');
    
    try {
      // Try loading from CDN as alternative
      const modelPath = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
      
      if (this.useTinyModel) {
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
      } else {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath);
      }
      
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
      
      this.modelsLoaded = true;
      console.log('Models loaded from CDN successfully');
      
    } catch (error) {
      console.error('Alternative loading also failed:', error);
      throw error;
    }
  }
  
  // ========== FACE EXTRACTION METHODS ==========
  
  async extractFaceDescriptor(imageData: string): Promise<Float32Array | null> {
    try {
      if (!this.modelsLoaded) {
        await this.loadModels();
      }
      
      console.log('Extracting descriptor from image data...');
      
      // IMPORTANT: Handle base64 data URL
      let cleanBase64 = imageData;
      if (!imageData.startsWith('data:')) {
        // If it's pure base64 without data URL, add it
        cleanBase64 = `data:image/jpeg;base64,${imageData}`;
      } else if (!imageData.includes('base64')) {
        // If it's a data URL but not base64, convert
        cleanBase64 = `data:image/jpeg;base64,${imageData.split(',')[1]}`;
      }
      
      // Create image element
      const img = await this.createImageElement(cleanBase64);
      
      if (!img.width || !img.height) {
        console.error('Invalid image dimensions');
        return null;
      }
      
      // Detect face
      console.log('Detecting face...');
      let detection;
      
      if (this.useTinyModel) {
        detection = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({
            inputSize: 160,
            scoreThreshold: 0.3 // Lower threshold for better detection
          }))
          .withFaceLandmarks()
          .withFaceDescriptor();
      } else {
        detection = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
      }
      
      if (!detection) {
        console.log('No face detected');
        return null;
      }
      
      console.log('Face detected, descriptor length:', detection.descriptor.length);
      return detection.descriptor;
      
    } catch (error) {
      console.error('Error extracting face descriptor:', error);
      return null;
    }
  }

  // Helper method for creating image
  private createImageElement(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        console.log('Image loaded successfully, dimensions:', img.width, 'x', img.height);
        resolve(img);
      };
      
      img.onerror = (err) => {
        console.error('Failed to load image:', err);
        reject(new Error('Failed to load image'));
      };
      
      img.src = src;
      img.crossOrigin = 'anonymous';
    });
  }
  
  // ========== FACE COMPARISON METHODS ==========
  
  // Compare two face descriptors
  compareFaces(descriptor1: Float32Array, descriptor2: Float32Array): number {
    // Calculate Euclidean distance (lower = more similar)
    let distance = 0;
    for (let i = 0; i < descriptor1.length; i++) {
      distance += Math.pow(descriptor1[i] - descriptor2[i], 2);
    }
    distance = Math.sqrt(distance);
    
    // Convert distance to similarity score (0-1)
    const similarity = Math.max(0, 1 - (distance / 2));
    
    return similarity;
  }
  
  // Find best match from database
  async findBestMatch(
    capturedDescriptor: Float32Array, 
    storedDescriptors: Array<{userId: string, descriptor: Float32Array}> // Changed from studentId to userId
  ): Promise<{userId: string | null, confidence: number}> { // Changed from studentId to userId
    let bestMatch = { userId: null as string | null, confidence: 0 }; // Changed from studentId to userId
    const MATCH_THRESHOLD = 0.65;
    
    for (const stored of storedDescriptors) {
      const similarity = this.compareFaces(capturedDescriptor, stored.descriptor);
      
      if (similarity > MATCH_THRESHOLD && similarity > bestMatch.confidence) {
        bestMatch = {
          userId: stored.userId, // Changed from studentId to userId
          confidence: similarity
        };
      }
    }
    
    return bestMatch;
  }
  
  // ========== ATTENDANCE MATCHING METHODS ==========
  
  async matchFaceForAttendance(
    capturedImage: string,
    maxMatches: number = 5
  ): Promise<Array<{userId: string, name: string, staffId: string, confidence: number}>> { // Updated return type
    try {
      // 1. Extract face from captured image
      const capturedDescriptor = await this.extractFaceDescriptor(capturedImage);
      
      if (!capturedDescriptor) {
        console.log('No face detected in captured image');
        return [];
      }
      
      // 2. Get all enrolled users WITH face embeddings
      const { data: users, error } = await supabase
        .from('users') // ✅ CHANGED from 'students' to 'users'
        .select('id, staff_id, full_name, face_embedding, enrollment_status') // ✅ CHANGED columns
        .eq('enrollment_status', 'enrolled')
        .eq('is_active', true)
        .not('face_embedding', 'is', null)
        .limit(50);
      
      if (error) {
        console.error('Database error:', error);
        return [];
      }
      
      if (!users || users.length === 0) {
        console.log('No users with face embeddings found');
        return [];
      }
      
      const matches = [];
      const MATCH_THRESHOLD = 0.65;
      
      // 3. Compare with each user's embedding
      for (const user of users) {
        try {
          if (!user.face_embedding || user.face_embedding.length === 0) {
            continue;
          }
          
          // Convert stored array back to Float32Array
          const embeddingArray = typeof user.face_embedding === 'string' 
            ? JSON.parse(user.face_embedding) 
            : user.face_embedding;
          const storedDescriptor = new Float32Array(embeddingArray);
          
          // Compare faces
          const similarity = this.compareFaces(capturedDescriptor, storedDescriptor);
          
          console.log(`Comparing with ${user.full_name}: ${similarity.toFixed(3)}`);
          
          if (similarity > MATCH_THRESHOLD) {
            matches.push({
              userId: user.id, // ✅ CHANGED from student.student_id
              name: user.full_name, // ✅ CHANGED from student.name
              staffId: user.staff_id || '', // ✅ CHANGED from student.matric_number
              confidence: similarity
            });
          }
        } catch (error) {
          console.error(`Error processing user ${user.id}:`, error); // ✅ CHANGED from student.student_id
          continue;
        }
      }
      
      // 4. Sort by confidence and return top matches
      const sortedMatches = matches
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxMatches);
      
      console.log('Found matches:', sortedMatches.length);
      return sortedMatches;
      
    } catch (error) {
      console.error('Error in face matching:', error);
      return [];
    }
  }
  
  // ========== DATABASE METHODS ==========
  
  // Update face embedding in database
  async updateFaceEmbedding(userId: string, descriptor: Float32Array) { // ✅ CHANGED from studentId to userId
    try {
      // Convert Float32Array to array for JSON storage
      const embeddingArray = Array.from(descriptor);
      
      await supabase
        .from('users') // ✅ CHANGED from 'students' to 'users'
        .update({
          face_embedding: JSON.stringify(embeddingArray),
          face_embedding_stored: true, // ✅ ADDED this field
          updated_at: new Date().toISOString()
        })
        .eq('id', userId); // ✅ CHANGED from 'student_id' to 'id'
        
      console.log(`Face embedding updated for user ${userId}`);
    } catch (error) {
      console.error('Error updating face embedding:', error);
    }
  }
  
  // Extract and save embedding for existing user
  async processExistingUserPhoto(userId: string, photoBase64: string) { // ✅ CHANGED from student to user
    try {
      const descriptor = await this.extractFaceDescriptor(photoBase64);
      
      if (descriptor) {
        await this.updateFaceEmbedding(userId, descriptor); // ✅ CHANGED from studentId to userId
        await this.saveEmbeddingToLocal(userId, descriptor); // ✅ CHANGED from studentId to userId
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error processing existing user photo:', error);
      return false;
    }
  }
  
  // ========== LOCAL STORAGE METHODS ==========
  
  // Save an embedding to localStorage
  saveEmbeddingToLocal(userId: string, descriptor: Float32Array): void { // ✅ CHANGED from studentId to userId
    const embeddings = this.getEmbeddingsFromLocal();
    
    // Remove existing embedding for this user
    const filtered = embeddings.filter(e => e.userId !== userId); // ✅ CHANGED from studentId to userId
    
    // Add new embedding (convert Float32Array to regular array for localStorage)
    const descriptorArray = Array.from(descriptor);
    filtered.push({ 
      userId, // ✅ CHANGED from studentId to userId
      descriptor: descriptorArray,
      timestamp: new Date().toISOString() 
    });
    
    localStorage.setItem(this.EMBEDDINGS_KEY, JSON.stringify(filtered));
  }
  
  // Get all embeddings from localStorage
  getEmbeddingsFromLocal(): Array<{
    userId: string; // ✅ CHANGED from studentId to userId
    descriptor: number[];
    timestamp: string;
  }> {
    const data = localStorage.getItem(this.EMBEDDINGS_KEY);
    return data ? JSON.parse(data) : [];
  }
  
  // Convert number[] back to Float32Array
  getEmbeddingForUser(userId: string): Float32Array | null { // ✅ CHANGED from student to user
    const embeddings = this.getEmbeddingsFromLocal();
    const found = embeddings.find(e => e.userId === userId); // ✅ CHANGED from studentId to userId
    return found ? new Float32Array(found.descriptor) : null;
  }
  
  // Clear all local embeddings
  clearLocalEmbeddings(): void {
    localStorage.removeItem(this.EMBEDDINGS_KEY);
  }
  
  // Check if user has local embedding
  hasLocalEmbedding(userId: string): boolean { // ✅ CHANGED from studentId to userId
    return this.getEmbeddingForUser(userId) !== null; // ✅ CHANGED from student to user
  }
  
  // Sync local embeddings to Supabase
  async syncLocalEmbeddingsToDatabase(): Promise<Array<{
    userId: string; // ✅ CHANGED from studentId to userId
    descriptor: number[];
  }>> {
    const localEmbeddings = this.getEmbeddingsFromLocal();
    const syncedEmbeddings: Array<{userId: string; descriptor: number[]}> = []; // ✅ CHANGED from studentId to userId
    
    for (const embedding of localEmbeddings) {
      try {
        await this.updateFaceEmbedding(embedding.userId, new Float32Array(embedding.descriptor)); // ✅ CHANGED from studentId to userId
        syncedEmbeddings.push(embedding);
      } catch (error) {
        console.error(`Failed to sync embedding for user ${embedding.userId}:`, error); // ✅ CHANGED from studentId to userId
      }
    }
      
    return syncedEmbeddings;
  }
  
  // ========== UTILITY METHODS ==========
  
  // Helper: Float32Array to base64 for storage
  float32ArrayToBase64(array: Float32Array): string {
    const bytes = new Uint8Array(array.buffer);
    let binary = '';
    
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
  }
  
  // Helper: base64 to Float32Array for storage
  base64ToFloat32Array(base64: string): Float32Array {
    // Remove data URL prefix if present
    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
    const binary = atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    return new Float32Array(bytes.buffer);
  }
  
  // ========== DEBUG & STATUS METHODS ==========
  
  getStatus() {
    return {
      modelsLoaded: this.modelsLoaded,
      useTinyModel: this.useTinyModel,
      hasWebGL: tf.getBackend() === 'webgl',
      backend: tf.getBackend(),
      localEmbeddingsCount: this.getEmbeddingsFromLocal().length
    };
  }
  
  // Force reload models (useful for debugging)
  async reloadModels() {
    this.modelsLoaded = false;
    return this.loadModels();
  }
}

export default FaceRecognition.getInstance();