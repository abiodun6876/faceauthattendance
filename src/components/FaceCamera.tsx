// components/FaceCamera.tsx
import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Button, Spin, message } from 'antd';
import { Camera } from 'lucide-react';

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  onEnrollmentComplete?: (photoData: string) => void;
  onAttendanceComplete?: (result: any) => void;
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
  const webcamRef = useRef<Webcam>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const capturePhoto = () => {
    if (!webcamRef.current) return null;
    
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      message.error('Failed to capture photo');
      return null;
    }
    
    return imageSrc;
  };

  const handleCapture = () => {
    const photoData = capturePhoto();
    if (!photoData) return;
    
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
    facingMode: "user"
  };

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
              borderRadius: 8
            }}
          />
          
          {countdown && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: 72,
              fontWeight: 'bold',
              color: 'white',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)'
            }}>
              {countdown}
            </div>
          )}
          
          {loading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
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
              textAlign: 'center'
            }}>
              <Button
                type="primary"
                size="large"
                icon={<Camera />}
                onClick={handleCapture}
                loading={loading}
                style={{ height: 50, fontSize: 16 }}
              >
                CAPTURE FACE
              </Button>
            </div>
          )}
        </>
      ) : (
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f0f0f0',
          borderRadius: 8
        }}>
          <Button onClick={() => setIsCameraActive(true)}>
            Enable Camera
          </Button>
        </div>
      )}
    </div>
  );
};

export default FaceCamera;