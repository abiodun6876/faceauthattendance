// components/FaceCamera.tsx - Multi-tenant Version
import React, { useRef, useState, useEffect, useCallback } from 'react'; // Added useCallback
import Webcam from 'react-webcam';
import { Button, Spin, message, Typography, Alert, Tag } from 'antd';
import { Camera, AlertCircle, User, Zap } from 'lucide-react';

const { Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  onEnrollmentComplete?: (photoData: string) => void;
  onAttendanceComplete?: (result: {
    success: boolean;
    photoData?: { base64: string };
    user?: any;
    confidence?: number;
  }) => void;
  autoCapture?: boolean;
  captureInterval?: number;
  loading?: boolean;
  deviceInfo?: any;
  organizationName?: string;
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  onEnrollmentComplete,
  onAttendanceComplete,
  autoCapture = false,
  captureInterval = 3000,
  loading = false,
  deviceInfo,
  organizationName
}) => {
  const webcamRef = useRef<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
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
    if (autoCapture && isCameraActive && cameraReady && mode === 'attendance') {
      intervalRef.current = setInterval(() => {
        setCountdown(1);
        setTimeout(() => {
          handleCapture();
          setCountdown(null);
        }, 1000);
      }, captureInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoCapture, isCameraActive, mode, captureInterval, cameraReady, handleCapture]); // Added handleCapture

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

          {/* Device/Branch Info Overlay */}
          {(deviceInfo || organizationName) && (
            <div style={{
              position: 'absolute',
              top: 10,
              left: 10,
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              {organizationName && <Tag color="blue">{organizationName}</Tag>}
              {deviceInfo?.device_name && <Tag color="green">{deviceInfo.device_name}</Tag>}
              {deviceInfo?.branch?.name && <Tag color="purple">{deviceInfo.branch.name}</Tag>}
            </div>
          )}

          {/* Mode Overlay */}
          <div style={{
            position: 'absolute',
            top: 10,
            right: 10,
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '4px 12px',
            borderRadius: 4,
            fontSize: 12,
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            {mode === 'enrollment' ? (
              <>
                <User size={12} />
                <span>ENROLLMENT</span>
              </>
            ) : (
              <>
                <Zap size={12} />
                <span>ATTENDANCE</span>
              </>
            )}
          </div>

          {/* Auto-capture Countdown */}
          {countdown && autoCapture && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: 72,
              fontWeight: 'bold',
              color: 'white',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              zIndex: 10,
              animation: 'pulse 1s infinite'
            }}>
              {countdown}
            </div>
          )}

          {/* Face Guide Overlay */}
          {(mode === 'enrollment' || mode === 'attendance') && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '280px',
              height: '350px',
              border: `3px ${cameraReady ? 'solid' : 'dashed'} rgba(255,255,255,0.4)`,
              borderRadius: '50%',
              pointerEvents: 'none',
              zIndex: 2,
              boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.3)', // Vignette effect
              transition: 'all 0.5s ease'
            }}>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.2)',
                animation: cameraReady ? 'scan-pulse 2s infinite' : 'none'
              }} />
            </div>
          )}

          <style>{`
            @keyframes scan-pulse {
              0% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.5; }
              50% { transform: translate(-50%, -50%) scale(1.05); opacity: 0.8; }
              100% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.5; }
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
              <Spin size="large" />
              <Text style={{ color: 'white', display: 'block', marginTop: 16 }}>
                {mode === 'enrollment' ? 'Processing face...' : 'Matching face...'}
              </Text>
            </div>
          )}

          {((mode === 'enrollment' || mode === 'attendance') && !autoCapture && !loading) && (
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: 0,
              right: 0,
              textAlign: 'center',
              zIndex: 10
            }}>
              <Button
                type="primary"
                size="large"
                icon={<Camera />}
                onClick={handleCapture}
                disabled={!cameraReady}
                style={{
                  height: 60,
                  fontSize: 18,
                  padding: '0 40px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}
              >
                {mode === 'enrollment' ? 'CAPTURE FACE' : 'SCAN FACE'}
              </Button>

              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{
                  color: 'white',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  fontSize: 14
                }}>
                  Position face within the circle
                </Text>
              </div>
            </div>
          )}

          {/* Camera Status */}
          <div style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: 'white',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 10,
            zIndex: 5
          }}>
            {cameraReady ? '🟢 Camera Ready' : '🟡 Camera Initializing'}
          </div>
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