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

        const loadModelManually = async (net: any, modelJson: any, modelWeights: any) => {
            try {
                // Ensure modelWeights is always an array for bundleResourceIO
                const weightsArray = Array.isArray(modelWeights) ? modelWeights : [modelWeights];
                const ioHandler = bundleResourceIO(modelJson, weightsArray);

                // Try loading as layers model (standard for face-api models)
                const model = await tf.loadLayersModel(ioHandler);

                const weightMap: tf.NamedTensorMap = {};
                model.weights.forEach(w => {
                    const name = w.name.endsWith(':0') ? w.name.replace(/:0$/, '') : w.name;
                    // LayerVariable.read() returns the tensor
                    weightMap[name] = (w as any).read();
                });

                // Extract params using the protected method (casting to any to access)
                const { params, paramMappings } = (net as any).extractParamsFromWeightMap(weightMap);

                // Inject params into the network instance
                (net as any)._params = params;
                (net as any)._paramMappings = paramMappings;

                console.log(`✅ Loaded ${net.constructor.name} manually`);
            } catch (e) {
                console.error(`❌ Failed to manually load ${net.constructor.name}:`, e);
                throw e;
            }
        };

        // Load TinyFaceDetector
        await loadModelManually(
            faceapi.nets.tinyFaceDetector,
            require('../assets/models/tiny_face_detector_model-weights_manifest.json'),
            require('../assets/models/tiny_face_detector_model-shard1.bin')
        );

        // Load FaceLandmark68Net
        await loadModelManually(
            faceapi.nets.faceLandmark68Net,
            require('../assets/models/face_landmark_68_model-weights_manifest.json'),
            require('../assets/models/face_landmark_68_model-shard1.bin')
        );

        // Load FaceRecognitionNet (2 shards)
        await loadModelManually(
            faceapi.nets.faceRecognitionNet,
            require('../assets/models/face_recognition_model-weights_manifest.json'),
            [
                require('../assets/models/face_recognition_model-shard1.bin'),
                require('../assets/models/face_recognition_model-shard2.bin')
            ]
        );

        // Load FaceExpressionNet
        await loadModelManually(
            faceapi.nets.faceExpressionNet,
            require('../assets/models/face_expression_model-weights_manifest.json'),
            require('../assets/models/face_expression_model-shard1.bin')
        );

        console.log("All FaceAPI models loaded successfully");
    } catch (error) {
        console.error("Error loading FaceAPI models:", error);
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
        if (!this.modelsLoaded) {
            await this.initialize();
            if (!this.modelsLoaded) {
                return { success: false, error: 'Models not loaded' };
            }
        }

        try {
            // Read image as base64 and decode to tensor
            // Wait, face-api.js in RN needs specific image handling.
            // Using fetch to get blob, then tf.browser.fromPixels is for web.
            // For RN, we use decodeJpeg from tfjs-react-native

            // @ts-ignore
            const response = await fetch(imageUri);
            const rawImageData = await response.arrayBuffer();
            const imageTensor = tf.tidy(() => {
                return decodeJpeg(new Uint8Array(rawImageData));
            });

            // Or better, using fetch and tf.tensor directly via decodeJpeg is standard.
            // However, face-api.js expects an HTMLImageElement or Canvas or Tensor.

            // Detect face
            const detection = await faceapi.detectSingleFace(
                imageTensor as any,
                new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5, inputSize: 320 })
            )
                .withFaceLandmarks()
                .withFaceDescriptor();

            // Clean up tensor memory
            imageTensor.dispose();

            if (!detection) {
                return {
                    success: false,
                    faceDetected: false,
                    error: 'No face detected'
                };
            }

            return {
                success: true,
                faceDetected: true,
                embedding: detection.descriptor,
                faceBox: detection.detection.box,
                quality: detection.detection.score * 100 // Rough estimate from detection score
            };

        } catch (error: any) {
            console.error('Face processing error:', error);
            return { success: false, error: error.message };
        }
    }

    compareFaces(descriptor1: Float32Array | number[], descriptor2: Float32Array | number[], threshold = 0.6): boolean {
        const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
        console.log(`Face match distance: ${distance} (threshold: ${threshold})`);
        return distance < threshold;
    }

    getDistance(descriptor1: Float32Array | number[], descriptor2: Float32Array | number[]): number {
        return faceapi.euclideanDistance(descriptor1, descriptor2);
    }
}

export const faceRecognitionService = new FaceRecognitionService();
