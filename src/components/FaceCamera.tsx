// components/FaceCamera.tsx - Multi-tenant Version
import React, { useRef, useState, useEffect, useCallback } from 'react'; // Added useCallback
import Webcam from 'react-webcam';
import { Button, message, Typography, Alert } from 'antd';
import { Camera, AlertCircle } from 'lucide-react';

import jsQR from 'jsqr';

const { Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  scanningMode?: 'face' | 'qr';
  onEnrollmentComplete?: (photoData: string) => void;
  onAttendanceComplete?: (result: {
    success: boolean;
    photoData?: { base64: string };
    user?: any;
    confidence?: number;
  }) => void;
  onQRCodeDetected?: (data: string) => void;
  autoCapture?: boolean;
  captureInterval?: number;
  loading?: boolean;
  deviceInfo?: any;
  organizationName?: string;
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  scanningMode = 'face',
  onEnrollmentComplete,
  onAttendanceComplete,
  onQRCodeDetected,
  autoCapture = false,
  captureInterval = 3000,
  loading = false,
  deviceInfo,
  organizationName
}) => {
  const webcamRef = useRef<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);

  const [cameraError, setCameraError] = useState<string>('');
  const [cameraReady, setCameraReady] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkCameraPermissions = async () => {
      try {
        console.log('Checking camera permissions...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }
        });
        console.log('Camera access granted');

        // Stop the stream immediately
        stream.getTracks().forEach(track => track.stop());

        setCameraError('');
        setCameraReady(true);
      } catch (error: any) {
        console.error('Camera permission error:', error);
        setCameraError('Camera access denied. Please allow camera permissions in your browser settings.');
        setIsCameraActive(false);
      }
    };

    checkCameraPermissions();
  }, []);

  const capturePhoto = useCallback(() => {
    console.log('Attempting to capture photo...');

    if (!webcamRef.current || !cameraReady) {
      console.error('Webcam not ready');
      message.error('Camera not ready');
      return null;
    }

    try {
      const imageSrc = webcamRef.current.getScreenshot({
        width: 640,
        height: 480
      });

      console.log('Photo captured successfully');

      if (!imageSrc) {
        console.error('getScreenshot returned null/undefined');
        message.error('Failed to capture photo');
        return null;
      }

      return imageSrc;
    } catch (error) {
      console.error('Error capturing photo:', error);
      message.error('Camera error occurred');
      return null;
    }
  }, [webcamRef, cameraReady]);

  const handleCapture = useCallback(() => {
    console.log('Capture button clicked');
    const photoData = capturePhoto();

    if (!photoData) {
      message.error('Failed to capture photo');
      return;
    }

    console.log('Photo captured successfully, calling callback...');

    if (mode === 'enrollment' && onEnrollmentComplete) {
      onEnrollmentComplete(photoData);
    } else if (mode === 'attendance' && onAttendanceComplete) {
      // For attendance mode, we'll handle face matching elsewhere
      onAttendanceComplete({
        success: true,
        photoData: { base64: photoData }
      });
    }
  }, [capturePhoto, mode, onEnrollmentComplete, onAttendanceComplete]);

  useEffect(() => {
    if (autoCapture && isCameraActive && cameraReady && mode === 'attendance' && scanningMode === 'face') {
      intervalRef.current = setInterval(() => {
        handleCapture();
      }, captureInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoCapture, isCameraActive, mode, captureInterval, cameraReady, handleCapture, scanningMode]);

  // QR Code Scanning Logic
  useEffect(() => {
    if (scanningMode !== 'qr' || !cameraReady || !isCameraActive) return;

    let requestRef: number;

    const scanQRCode = () => {
      if (!webcamRef.current || !webcamRef.current.video) {
        requestRef = requestAnimationFrame(scanQRCode);
        return;
      }

      const video = webcamRef.current.video;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && onQRCodeDetected) {
            onQRCodeDetected(code.data);
            // Throttle detection to avoid multiple triggers
            setTimeout(() => {
              requestRef = requestAnimationFrame(scanQRCode);
            }, 2000);
            return;
          }
        }
      }
      requestRef = requestAnimationFrame(scanQRCode);
    };

    requestRef = requestAnimationFrame(scanQRCode);
    return () => cancelAnimationFrame(requestRef);
  }, [scanningMode, cameraReady, isCameraActive, onQRCodeDetected]);

  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: "user" as const
  };

  // Show camera error message
  if (cameraError) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        padding: 24
      }}>
        <AlertCircle size={48} color="#ff4d4f" style={{ marginBottom: 16 }} />
        <Alert
          message="Camera Permission Required"
          description={cameraError}
          type="error"
          showIcon
          style={{ marginBottom: 24, maxWidth: 400 }}
        />
        <Button
          type="primary"
          onClick={async () => {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true });
              stream.getTracks().forEach(track => track.stop());
              setCameraError('');
              setIsCameraActive(true);
              setCameraReady(true);
            } catch (error) {
              message.error('Still cannot access camera. Please check browser settings.');
            }
          }}
          size="large"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {isCameraActive ? (
        <>
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: 8,
              backgroundColor: '#000'
            }}
            onUserMedia={() => {
              console.log('Webcam stream started');
              setCameraReady(true);
            }}
            onUserMediaError={(error) => {
              console.error('Webcam error:', error);
              setCameraError('Failed to start camera. Please check your camera connection.');
              setIsCameraActive(false);
            }}
            mirrored={true}
          />

          {/* Sci-Fi HUD Overlay */}
          {(mode === 'enrollment' || mode === 'attendance') && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 2
            }}>
              {/* Corner Brackets */}
              <div style={{
                position: 'absolute',
                top: '15%',
                left: '20%',
                width: '60%',
                height: '70%',
                border: '1px solid rgba(0, 243, 255, 0.2)',
                borderTop: 'none',
                borderBottom: 'none',
                borderRadius: '40px'
              }} />

              {/* Central Target - Cleaner */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: scanningMode === 'qr' ? '250px' : '300px',
                height: scanningMode === 'qr' ? '250px' : '400px',
                border: `2px solid ${scanningMode === 'qr' ? 'rgba(0, 243, 255, 0.8)' : 'rgba(0, 243, 255, 0.4)'}`,
                borderRadius: scanningMode === 'qr' ? '12px' : '24px',
                boxShadow: scanningMode === 'qr' ? '0 0 40px rgba(0, 243, 255, 0.3)' : '0 0 30px rgba(0, 243, 255, 0.1)'
              }}>
                {/* Scanning Line */}
                <div style={{
                  width: '100%',
                  height: '2px',
                  background: scanningMode === 'qr'
                    ? 'linear-gradient(90deg, transparent, #00f3ff, transparent)'
                    : 'linear-gradient(90deg, transparent, #0aff60, transparent)',
                  boxShadow: scanningMode === 'qr' ? '0 0 15px #00f3ff' : '0 0 15px #0aff60',
                  position: 'absolute',
                  animation: 'scanner 3s ease-in-out infinite'
                }} />

                {scanningMode === 'qr' && (
                  <div style={{
                    position: 'absolute',
                    bottom: -40,
                    width: '100%',
                    textAlign: 'center',
                    color: '#00f3ff',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    letterSpacing: '2px',
                    textShadow: '0 0 10px rgba(0, 243, 255, 0.5)'
                  }}>
                    SCAN QR CODE
                  </div>
                )}
              </div>
            </div>
          )}

          <style>{`
            @keyframes scanner {
              0% { top: 0%; opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { top: 100%; opacity: 0; }
            }
          `}</style>

          {loading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 20,
              textAlign: 'center'
            }}>
              <div style={{
                width: 100,
                height: 100,
                border: '4px solid transparent',
                borderTopColor: '#00f3ff',
                borderRightColor: '#bc13fe',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
          )}

          {/* Holographic Controls */}
          {((mode === 'enrollment' || mode === 'attendance') && !autoCapture && !loading) && (
            <div style={{
              position: 'absolute',
              bottom: 40,
              left: 0,
              right: 0,
              textAlign: 'center',
              zIndex: 10
            }}>
              <button
                onClick={handleCapture}
                disabled={!cameraReady}
                style={{
                  background: 'rgba(0, 243, 255, 0.1)',
                  border: '1px solid #00f3ff',
                  color: '#00f3ff',
                  padding: '12px 40px',
                  fontSize: '18px',
                  fontFamily: 'monospace',
                  letterSpacing: '4px',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 0 30px rgba(0, 243, 255, 0.2)',
                  transition: 'all 0.3s ease',
                  borderRadius: '4px'
                }}
              >
                {mode === 'enrollment' ? 'ENROLL' : 'SCAN'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f0f0f0',
          borderRadius: 8,
          gap: 16,
          padding: 24
        }}>
          <div style={{
            fontSize: 48,
            animation: 'pulse 2s infinite'
          }}>
            📷
          </div>
          <Text type="secondary" style={{ textAlign: 'center' }}>
            Camera is disabled or not accessible
          </Text>
          <Button
            type="primary"
            onClick={async () => {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach(track => track.stop());
                setIsCameraActive(true);
                setCameraReady(true);
                message.success('Camera enabled');
              } catch (error) {
                message.error('Cannot access camera');
              }
            }}
            size="large"
            icon={<Camera />}
          >
            Enable Camera
          </Button>
        </div>
      )}
    </div>
  );
};

export default FaceCamera;