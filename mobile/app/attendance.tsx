import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { attendanceService } from '../services/attendanceService';
import { userService } from '../services/userService';
import { faceRecognitionService, FaceDetectionResult } from '../services/faceRecognitionService';
import { ArrowLeft, RefreshCw, Camera, UserCheck, AlertCircle } from 'lucide-react-native';

export default function AttendanceScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastScan, setLastScan] = useState<any>(null);
    const [scannedPhoto, setScannedPhoto] = useState<string | null>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [modelsReady, setModelsReady] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Initializing face models...');

    useEffect(() => {
        loadResources();
    }, []);

    const loadResources = async () => {
        try {
            // 1. Initialize Face Models
            await faceRecognitionService.initialize();
            setModelsReady(true);
            setStatusMessage('Ready to scan');

            // 2. Load Users
            const orgId = params.organizationId as string;
            const branchId = params.branchId as string;

            if (orgId) {
                console.log('Loading users for matching...');
                // We load users for the specific branch to optimize matching
                const { data: userList, error } = await userService.getOrganizationUsers(orgId, branchId);

                if (userList) {
                    // Pre-process embeddings
                    const validUsers = userList
                        .filter((u: any) => u.face_embedding && u.is_active)
                        .map((u: any) => ({
                            ...u,
                            embeddingArray: typeof u.face_embedding === 'string'
                                ? JSON.parse(u.face_embedding)
                                : u.face_embedding
                        }));

                    setUsers(validUsers);
                    console.log(`Loaded ${validUsers.length} users for face matching`);
                }
            }
        } catch (error) {
            console.error('Resource load error:', error);
            setStatusMessage('Error loading resources');
        }
    };

    if (!permission) {
        return <View />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>We need your permission to show the camera</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.button}>
                    <Text style={styles.buttonText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const findMatchingUser = (embedding: Float32Array) => {
        // Simple 1:N matching
        // In production with thousands of users, this should be optimized
        let bestMatch = null;
        let minDistance = 1.0;
        const THRESHOLD = 0.6; // Same as web

        for (const user of users) {
            if (!user.embeddingArray) continue;

            const distance = faceRecognitionService.getDistance(embedding, user.embeddingArray);

            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = user;
            }
        }

        if (minDistance < THRESHOLD && bestMatch) {
            return { user: bestMatch, distance: minDistance };
        }

        return null;
    };

    const takePicture = async () => {
        if (cameraRef.current && !isProcessing && modelsReady) {
            setIsProcessing(true);
            setStatusMessage('Processing...');
            setLastScan(null);

            try {
                // 1. Capture Photo
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.7,
                    base64: false, // We use URI
                    skipProcessing: true, // Use false if you need corrected orientation
                });

                if (photo) {
                    setScannedPhoto(photo.uri);

                    // 2. Detect Face & Get Embedding
                    const result: FaceDetectionResult = await faceRecognitionService.processFace(photo.uri);

                    if (!result.success || !result.embedding) {
                        setStatusMessage(result.error || 'No face detected');
                        setIsProcessing(false);

                        // Log failure
                        if (params.organizationId && params.branchId) { // Check required params
                            await attendanceService.logFaceMatch({
                                userId: 'unknown',
                                organizationId: params.organizationId as string,
                                deviceId: 'mobile_device', // Should get real device ID
                                photoUrl: 'local_file', // TODO: Upload if needed
                                confidence: result.quality || 0,
                                isMatch: false,
                                result: result.error || 'No face detected'
                            });
                        }

                        Alert.alert('Scan Failed', result.error || 'No face detected. Please try again.');
                        return;
                    }

                    // 3. Match against loaded users
                    const match = findMatchingUser(result.embedding);

                    if (match) {
                        const { user, distance } = match;
                        console.log(`Matched user: ${user.full_name} (Distance: ${distance})`);

                        // 4. Log Attendance
                        await attendanceService.clockIn({
                            userId: user.id,
                            organizationId: params.organizationId as string,
                            branchId: params.branchId as string,
                            deviceId: 'mobile_device',
                            confidence: (1 - distance) * 100,
                            photoUrl: 'local_scan', // In a real app, upload image first
                            verificationMethod: 'face_mobile'
                        });

                        setLastScan({
                            name: user.full_name,
                            status: "Present",
                            time: new Date().toLocaleTimeString(),
                            confidence: Math.round((1 - distance) * 100)
                        });
                        setStatusMessage('Verified');
                    } else {
                        console.log('No user matched');
                        setStatusMessage('Face not recognized');

                        // Log unknown attempt
                        if (params.organizationId) {
                            await attendanceService.logFaceMatch({
                                userId: 'unknown',
                                organizationId: params.organizationId as string,
                                deviceId: 'mobile_device',
                                photoUrl: 'local_file',
                                confidence: result.quality || 0,
                                isMatch: false,
                                result: 'No match found'
                            });
                        }

                        Alert.alert('Not Recognized', 'Face not found in this branch records.');
                    }
                }
            } catch (error: any) {
                console.error('Capture error:', error);
                setStatusMessage('System error');
                Alert.alert('Error', error.message || 'Failed to process scan');
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const resetScan = () => {
        setLastScan(null);
        setScannedPhoto(null);
        setIsProcessing(false);
        setStatusMessage('Ready to scan');
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color="#fff" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Attendance</Text>
                    <Text style={styles.headerSubtitle}>{params.branchName || 'Unknown Branch'}</Text>
                </View>
                <View style={{ width: 24 }} />
            </View>

            {/* Main Content */}
            <View style={styles.content}>
                {lastScan ? (
                    <View style={styles.resultContainer}>
                        <View style={styles.successIcon}>
                            <UserCheck size={64} color="#52c41a" />
                        </View>
                        <Text style={styles.resultTitle}>Identity Verified</Text>
                        <Text style={styles.resultName}>{lastScan.name}</Text>
                        <Text style={styles.resultTime}>{lastScan.time}</Text>
                        <Text style={styles.resultConfidence}>{lastScan.confidence}% Match</Text>

                        {scannedPhoto && (
                            <Image source={{ uri: scannedPhoto }} style={styles.scannedImage} />
                        )}

                        <TouchableOpacity style={styles.nextButton} onPress={resetScan}>
                            <Text style={styles.nextButtonText}>Next Student</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.cameraContainer}>
                        <CameraView
                            style={styles.camera}
                            facing="front"
                            ref={cameraRef}
                        >
                            <View style={styles.overlay}>
                                <View style={styles.statusTag}>
                                    <Text style={styles.statusText}>{statusMessage}</Text>
                                </View>

                                <View style={styles.faceFrame} />
                                <Text style={styles.instruction}>Position face within the frame</Text>
                            </View>
                        </CameraView>

                        <TouchableOpacity
                            style={[
                                styles.captureButton,
                                (isProcessing || !modelsReady) && styles.captureButtonDisabled
                            ]}
                            onPress={takePicture}
                            disabled={isProcessing || !modelsReady}
                        >
                            {isProcessing ? (
                                <ActivityIndicator size="large" color="#fff" />
                            ) : (
                                <Camera size={32} color="#fff" />
                            )}
                        </TouchableOpacity>

                        {!modelsReady && (
                            <View style={styles.loadingOverlay}>
                                <ActivityIndicator size="large" color="#1890ff" />
                                <Text style={styles.loadingText}>Loading AI Models...</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    message: {
        textAlign: 'center',
        paddingBottom: 10,
        color: '#fff',
    },
    button: {
        backgroundColor: '#1890ff',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingTop: 50,
        backgroundColor: 'rgba(0,0,0,0.5)',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: '#ddd',
        fontSize: 14,
    },
    content: {
        flex: 1,
    },
    cameraContainer: {
        flex: 1,
        position: 'relative',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    statusTag: {
        position: 'absolute',
        top: 120,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    statusText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    instruction: {
        color: '#fff',
        fontSize: 16,
        marginTop: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 8,
        borderRadius: 4,
    },
    faceFrame: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: '#1890ff',
        borderRadius: 125, // Circle
        backgroundColor: 'transparent',
    },
    captureButton: {
        position: 'absolute',
        bottom: 50,
        alignSelf: 'center',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#1890ff',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    captureButtonDisabled: {
        backgroundColor: '#ccc',
        opacity: 0.7,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 30,
    },
    loadingText: {
        color: '#fff',
        marginTop: 16,
        fontSize: 16,
    },
    // Result styles
    resultContainer: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    successIcon: {
        marginBottom: 24,
    },
    resultTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 8,
    },
    resultName: {
        fontSize: 20,
        color: '#333',
        marginBottom: 4,
    },
    resultTime: {
        fontSize: 16,
        color: '#666',
        marginBottom: 8,
    },
    resultConfidence: {
        fontSize: 14,
        color: '#52c41a',
        fontWeight: 'bold',
        marginBottom: 32,
    },
    scannedImage: {
        width: 200,
        height: 200,
        borderRadius: 12,
        marginBottom: 32,
        backgroundColor: '#eee',
    },
    nextButton: {
        width: '100%',
        height: 50,
        backgroundColor: '#1890ff',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

