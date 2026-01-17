// components/FaceCamera.tsx
import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Button, Spin, message, Typography, Alert } from 'antd';
import { Camera, AlertCircle } from 'lucide-react';

const { Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  onEnrollmentComplete?: (photoData: string) => void;
  onAttendanceComplete?: (result: { success: boolean; photoData?: { base64: string } }) => void;
  autoCapture?: boolean;
  captureInterval?: number;
  loading?: boolean;
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  onEnrollmentComplete,
  onAttendanceComplete,
  autoCapture = false,
  captureInterval = 3000,
  loading = false
}) => {
  const webcamRef = useRef<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check camera permissions on mount
  useEffect(() => {
    const checkCameraPermissions = async () => {
      try {
        console.log('Checking camera permissions...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        console.log('Camera access granted');
        
        // Stop the stream immediately
        stream.getTracks().forEach(track => track.stop());
        
        setCameraError('');
      } catch (error: any) {
        console.error('Camera permission error:', error);
        setCameraError('Camera access denied. Please allow camera permissions in your browser settings.');
        setIsCameraActive(false);
      }
    };

    checkCameraPermissions();
  }, []);

  const capturePhoto = () => {
    console.log('Attempting to capture photo...');
    
    if (!webcamRef.current) {
      console.error('Webcam ref is null');
      message.error('Camera not ready');
      return null;
    }
    
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      console.log('Photo captured:', imageSrc ? `Length: ${imageSrc.length}` : 'No image');
      
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
  };

  const handleCapture = () => {
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
      onAttendanceComplete({
        success: true,
        photoData: { base64: photoData }
      });
    }
  };

  useEffect(() => {
    if (autoCapture && isCameraActive && mode === 'attendance') {
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
  }, [autoCapture, isCameraActive, mode, captureInterval]);

  const videoConstraints = {
    width: 640,
    height: 480,
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
          onClick={() => {
            setCameraError('');
            setIsCameraActive(true);
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
            onUserMedia={() => console.log('Webcam stream started')}
            onUserMediaError={(error) => {
              console.error('Webcam error:', error);
              setCameraError('Failed to start camera. Please check your camera connection.');
              setIsCameraActive(false);
            }}
          />
          
          {/* Debug overlay - remove in production */}
          <div style={{
            position: 'absolute',
            top: 10,
            left: 10,
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            zIndex: 5
          }}>
            Mode: {mode} | Camera: {isCameraActive ? 'Active' : 'Inactive'}
          </div>
          
          {countdown && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: 72,
              fontWeight: 'bold',
              color: 'white',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              zIndex: 10
            }}>
              {countdown}
            </div>
          )}
          
          {loading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 20
            }}>
              <Spin size="large" />
            </div>
          )}
          
          {mode === 'enrollment' && !autoCapture && (
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
                loading={loading}
                style={{ 
                  height: 50, 
                  fontSize: 16,
                  padding: '0 32px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
              >
                CAPTURE FACE
              </Button>
              
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ color: 'white' }}>
                  Make sure face is clearly visible
                </Text>
              </div>
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
          gap: 16
        }}>
          <div style={{ fontSize: 48 }}>📷</div>
          <Text type="secondary">Camera is disabled</Text>
          <Button 
            type="primary" 
            onClick={() => setIsCameraActive(true)}
            size="large"
          >
            Enable Camera
          </Button>
        </div>
      )}
    </div>
  );
};

export default FaceCamera;