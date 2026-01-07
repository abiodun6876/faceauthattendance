// src/components/FaceCamera.tsx - MOBILE-KIOSK OPTIMIZED
import React, { useState, useRef, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Alert, 
  Typography, 
  Space, 
  Progress, 
  Tag
} from 'antd';
import { Camera, VideoOff } from 'lucide-react';

const { Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  student?: any;
  onEnrollmentComplete?: (result: any) => void;
  onAttendanceComplete?: (result: any) => void;
  autoCapture?: boolean;
  captureInterval?: number;
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  student,
  onEnrollmentComplete,
  onAttendanceComplete,
  autoCapture = true,
  captureInterval = 3000
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastCaptureTime, setLastCaptureTime] = useState<number>(0);
  const [captureCount, setCaptureCount] = useState(0);
  const [autoCaptureActive, setAutoCaptureActive] = useState(autoCapture);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoCaptureRef = useRef<number | null>(null);

  // Simple auto-capture function
  const startAutoCapture = () => {
    if (autoCaptureRef.current !== null) {
      window.clearInterval(autoCaptureRef.current);
    }
    
    if (autoCaptureActive && mode === 'attendance' && isCameraActive) {
      autoCaptureRef.current = window.setInterval(() => {
        if (!isCapturing && isCameraActive) {
          const now = Date.now();
          if (now - lastCaptureTime > captureInterval) {
            handleCapture();
          }
        }
      }, 1000);
    }
  };

  // Stop auto-capture
  const stopAutoCapture = () => {
    if (autoCaptureRef.current !== null) {
      window.clearInterval(autoCaptureRef.current);
      autoCaptureRef.current = null;
    }
  };

  // Start camera - Optimized for front camera
  const startCamera = async () => {
    setError(null);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera not supported');
      return;
    }

    try {
      // Front camera for kiosk mode
      const constraints = { 
        video: { 
          facingMode: 'user', // Always use front camera
          width: { ideal: 1280 }, // Higher resolution for better face recognition
          height: { ideal: 720 }
        }, 
        audio: false 
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              resolve(true);
            };
          } else {
            resolve(true);
          }
        });
        
        setIsCameraActive(true);
        
        // Start auto-capture for attendance mode
        if (mode === 'attendance' && autoCaptureActive) {
          startAutoCapture();
        }
      }
      
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please check permissions.');
      } else if (err.name === 'NotFoundError') {
        setError('Front camera not found.');
      } else {
        setError('Failed to start camera: ' + err.message);
      }
    }
  };

  const stopCamera = () => {
    stopAutoCapture();
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Capture image
  const captureImage = async (): Promise<string | null> => {
    if (!isCameraActive || !videoRef.current || !canvasRef.current) {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  // Handle capture
  const handleCapture = async () => {
    if (!isCameraActive || isCapturing) return;
    
    setIsCapturing(true);
    setLastCaptureTime(Date.now());
    setCaptureCount(prev => prev + 1);
    
    try {
      const imageData = await captureImage();
      
      if (!imageData) {
        throw new Error('Failed to capture image');
      }
      
      // Process capture
      processCapture(imageData);
      
    } catch (error) {
      console.error('Capture error:', error);
      setIsCapturing(false);
    }
  };

  // Process capture
  const processCapture = (imageData: string) => {
    setProgress(0);

    const interval = window.setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          window.clearInterval(interval);
          
          const result = {
            success: true,
            photoUrl: imageData,
            timestamp: new Date().toISOString(),
            captureCount: captureCount + 1
          };

          if (mode === 'enrollment') {
            Object.assign(result, {
              studentId: student?.id || student?.student_id || student?.matric_number,
              studentName: student?.name,
              matricNumber: student?.matric_number,
              student: student
            });
            
            setTimeout(() => {
              setIsCapturing(false);
              onEnrollmentComplete?.(result);
            }, 500);
          } else {
            setTimeout(() => {
              setIsCapturing(false);
              onAttendanceComplete?.(result);
            }, 500);
          }
          
          return 100;
        }
        return prev + 25;
      });
    }, 100);
  };

  // Toggle auto-capture
  const toggleAutoCapture = () => {
    const newState = !autoCaptureActive;
    setAutoCaptureActive(newState);
    
    if (newState && isCameraActive && mode === 'attendance') {
      startAutoCapture();
    } else {
      stopAutoCapture();
    }
  };

  // Auto-start camera on mount for attendance
  useEffect(() => {
    if (mode === 'attendance') {
      const timer = setTimeout(() => {
        startCamera();
      }, 500);

      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    }
  }, [mode]);

  // Restart auto-capture when camera becomes active
  useEffect(() => {
    if (isCameraActive && mode === 'attendance' && autoCaptureActive) {
      startAutoCapture();
    }
  }, [isCameraActive, autoCaptureActive]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      backgroundColor: '#f0f2f5'
    }}>
      {/* Camera Feed - Takes 70% of screen */}
      <div style={{
        flex: 7,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{ 
          width: '100%',
          height: '100%',
          maxHeight: '70vh',
          backgroundColor: '#000',
          borderRadius: 16,
          overflow: 'hidden',
          border: isCameraActive ? '4px solid #52c41a' : '4px solid #d9d9d9',
          position: 'relative',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: isCameraActive ? 'block' : 'none',
              transform: 'scaleX(-1)' // Mirror for selfie view
            }}
          />
          {!isCameraActive && (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              backgroundColor: '#1a1a1a'
            }}>
              <VideoOff size={64} />
              <Text style={{ 
                color: '#fff', 
                marginTop: 16,
                fontSize: 18,
                fontWeight: 'bold'
              }}>
                Camera Loading...
              </Text>
            </div>
          )}
          
          {/* Status overlay */}
          {isCameraActive && (
            <div style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{
                backgroundColor: autoCaptureActive ? 'rgba(82, 196, 26, 0.9)' : 'rgba(250, 173, 20, 0.9)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: 20,
                fontSize: 14,
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <div style={{ 
                  width: 10, 
                  height: 10, 
                  borderRadius: '50%',
                  backgroundColor: isCapturing ? '#1890ff' : '#fff',
                  animation: isCapturing ? 'pulse 1s infinite' : 'none'
                }} />
                {autoCaptureActive ? `AUTO-SCAN: ${captureCount}` : 'MANUAL MODE'}
              </div>
              
              <div style={{
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: 20,
                fontSize: 14,
                fontWeight: 'bold'
              }}>
                {isCapturing ? 'CAPTURING...' : 'READY'}
              </div>
            </div>
          )}

          {/* Guide frame for face positioning */}
          {isCameraActive && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '60%',
              height: '70%',
              border: '3px dashed rgba(255,255,255,0.5)',
              borderRadius: 8,
              pointerEvents: 'none'
            }}>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 12,
                fontWeight: 'bold',
                textAlign: 'center'
              }}>
                Position Face Here
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls Panel - Takes 30% of screen */}
      <div style={{
        flex: 3,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingTop: 16
      }}>
        {/* Status Indicators */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: 16,
          marginBottom: 16
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8 
          }}>
            <div style={{ 
              width: 16, 
              height: 16, 
              borderRadius: '50%',
              backgroundColor: isCameraActive ? '#52c41a' : '#ff4d4f'
            }} />
            <Text strong style={{ fontSize: 14 }}>
              {isCameraActive ? 'CAMERA ACTIVE' : 'CAMERA OFF'}
            </Text>
          </div>
          
          {isCapturing && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8 
            }}>
              <div style={{ 
                width: 16, 
                height: 16, 
                borderRadius: '50%',
                backgroundColor: '#1890ff',
                animation: 'pulse 1s infinite'
              }} />
              <Text strong style={{ fontSize: 14, color: '#1890ff' }}>
                PROCESSING...
              </Text>
            </div>
          )}
        </div>

        {/* Processing Bar */}
        {isCapturing && (
          <div style={{ marginBottom: 16 }}>
            <Progress 
              percent={progress} 
              status="active" 
              strokeColor={{ from: '#108ee9', to: '#87d068' }}
              strokeWidth={8}
            />
          </div>
        )}

        {/* Control Buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: 12,
          marginBottom: 16
        }}>
          <Button
            type="primary"
            icon={<Camera size={20} />}
            onClick={handleCapture}
            disabled={!isCameraActive || isCapturing}
            size="large"
            style={{
              height: 56,
              fontSize: 16,
              padding: '0 24px',
              borderRadius: 12,
              flex: 1,
              maxWidth: 180
            }}
          >
            CAPTURE NOW
          </Button>
          
          {mode === 'attendance' && (
            <Button
              type={autoCaptureActive ? "default" : "primary"}
              onClick={toggleAutoCapture}
              size="large"
              style={{
                height: 56,
                fontSize: 16,
                padding: '0 24px',
                borderRadius: 12,
                flex: 1,
                maxWidth: 180
              }}
            >
              {autoCaptureActive ? 'STOP AUTO' : 'START AUTO'}
            </Button>
          )}
        </div>

        {/* Camera Control */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center',
          marginBottom: 16
        }}>
          <Button
            type={isCameraActive ? "default" : "primary"}
            onClick={isCameraActive ? stopCamera : startCamera}
            size="large"
            style={{
              height: 48,
              fontSize: 16,
              padding: '0 32px',
              borderRadius: 12,
              width: '100%',
              maxWidth: 300
            }}
          >
            {isCameraActive ? 'STOP CAMERA' : 'START CAMERA'}
          </Button>
        </div>

        {/* Stats */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: 12 
        }}>
          <Tag 
            color="blue"
            style={{ 
              fontSize: 14,
              padding: '8px 16px',
              borderRadius: 20
            }}
          >
            Captures: {captureCount}
          </Tag>
          <Tag 
            color={autoCaptureActive ? "green" : "orange"}
            style={{ 
              fontSize: 14,
              padding: '8px 16px',
              borderRadius: 20
            }}
          >
            {autoCaptureActive ? 'Auto: ON' : 'Auto: OFF'}
          </Tag>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{ marginTop: 16 }}>
            <Alert
              message="Camera Error"
              description={error}
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              action={
                <Button
                  type="primary"
                  onClick={startCamera}
                  size="small"
                >
                  RETRY
                </Button>
              }
            />
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default FaceCamera;