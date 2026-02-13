import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO, decodeJpeg } from '@tensorflow/tfjs-react-native';
import * as faceapi from '@vladmandic/face-api';

// Import model files as assets
// These require statements will resolve to asset IDs due to Metro config
const faceRecognitionModelJson = require('../assets/models/face_recognition_model-weights_manifest.json');
const faceRecognitionModelWeights1 = require('../assets/models/face_recognition_model-shard1.bin');
const faceRecognitionModelWeights2 = require('../assets/models/face_recognition_model-shard2.bin');

const tinyFaceDetectorModelJson = require('../assets/models/tiny_face_detector_model-weights_manifest.json');
const tinyFaceDetectorModelWeights = require('../assets/models/tiny_face_detector_model-shard1.bin');

const faceLandmarkModelJson = require('../assets/models/face_landmark_68_model-weights_manifest.json');
const faceLandmarkModelWeights = require('../assets/models/face_landmark_68_model-shard1.bin');

export interface FaceDetectionResult {
    success: boolean;
    embedding?: Float32Array;
    error?: string;
    faceDetected?: boolean;
    faceBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    quality?: number;
}

export const loadFaceApiModels = async () => {
    try {
        await tf.ready();
        console.log("TensorFlow Ready");

        console.warn('⚠️  Face-API.js is not compatible with React Native');
        console.warn('⚠️  Face recognition temporarily disabled on mobile');
        console.warn('⚠️  Use the web app for face recognition features');

        // TODO: Implement React Native compatible face recognition
        // Options:
        // 1. Use TensorFlow.js directly with FaceNet/MobileFaceNet models
        // 2. Use expo-face-detector (deprecated) for detection only
        // 3. Use react-native-vision-camera with ML Kit
        // 4. Use a cloud-based face recognition API

        /*
        // face-api.js doesn't work in React Native because:
        // Error: getEnv - environment is not defined, check isNodejs() and isBrowser()
        // React Native is neither Node.js nor Browser
        
        // Get the model directory path
        // In React Native, we need to use the actual file URIs
        const modelPath = '../assets/models/';

        console.log('Loading TinyFaceDetector...');
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
        console.log('✅ TinyFaceDetector loaded');

        console.log('Loading FaceLandmark68Net...');
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
        console.log('✅ FaceLandmark68Net loaded');

        console.log('Loading FaceRecognitionNet...');
        await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
        console.log('✅ FaceRecognitionNet loaded');

        console.log('Loading FaceExpressionNet...');
        await faceapi.nets.faceExpressionNet.loadFromUri(modelPath);
        console.log('✅ FaceExpressionNet loaded');

        console.log("All FaceAPI models loaded successfully");
        */

        console.log("Mobile face recognition not yet implemented");
        return; // Exit early without loading models

    } catch (error) {
        console.error("Error in loadFaceApiModels:", error);
        throw error;
    }
};

class FaceRecognitionService {
    private modelsLoaded = false;
    private isInitializing = false;

    constructor() {
        this.initialize();
    }

    async initialize() {
        if (this.modelsLoaded || this.isInitializing) return;
        this.isInitializing = true;

        try {
            console.log('Initializing Face Recognition Service...');
            await loadFaceApiModels();

            console.log('Face API models loaded successfully');
            this.modelsLoaded = true;
        } catch (error) {
            console.error('Failed to load Face API models:', error);
        } finally {
            this.isInitializing = false;
        }
    }

    async processFace(imageUri: string): Promise<FaceDetectionResult> {
        console.warn('⚠️  Face recognition is not supported on mobile');
        console.warn('⚠️  Please use the web app for face recognition');

        return {
            success: false,
            error: 'Face recognition not supported on mobile - use web app',
            faceDetected: false
        };

        // TODO: Implement React Native compatible face detection
        // face-api.js doesn't work in React Native
    }

    compareFaces(descriptor1: Float32Array | number[], descriptor2: Float32Array | number[], threshold = 0.6): boolean {
        // Temporarily disabled - face-api not compatible
        console.warn('compareFaces not supported on mobile');
        return false;
    }

    getDistance(descriptor1: Float32Array | number[], descriptor2: Float32Array | number[]): number {
        // Temporarily disabled - face-api not compatible
        console.warn('getDistance not supported on mobile');
        return 1.0; // Return max distance
    }
}

export const faceRecognitionService = new FaceRecognitionService();

