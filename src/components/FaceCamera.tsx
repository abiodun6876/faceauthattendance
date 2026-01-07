// src/components/FaceCamera.tsx - ULTRA SIMPLIFIED
import React, { useState, useRef, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Alert, 
  Typography, 
  Space, 
  Progress, 
  Row, 
  Col,
  Tag
} from 'antd';
import { Camera, CheckCircle, VideoOff } from 'lucide-react';

const { Title, Text } = Typography;

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
  autoCapture = true, // Always auto-capture for attendance
  captureInterval = 2000
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [lastCaptureTime, setLastCaptureTime] = useState<number>(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const captureIntervalRef = useRef<number | null>(null);

  // Simple face detection
  const checkForFace = () => {
    if (!videoRef.current || !isCameraActive || isCapturing) return;
    
    const video = videoRef.current;
    const now = Date.now();
    
    // Simple check: if video is playing and has dimensions
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      setFaceDetected(true);
      
      // Auto-capture logic for attendance mode
      if (mode === 'attendance' && !isCapturing) {
        const timeSinceLastCapture = now - lastCaptureTime;
        if (timeSinceLastCapture > captureInterval) {
          handleCapture();
        }
      }
    } else {
      setFaceDetected(false);
    }
  };

  // Start face detection interval
  const startFaceDetection = () => {
    if (detectionIntervalRef.current !== null) {
      window.clearInterval(detectionIntervalRef.current);
    }
    
    detectionIntervalRef.current = window.setInterval(() => {
      checkForFace();
    }, 500); // Check every 500ms
  };

  // Start auto-capture interval
  const startAutoCaptureInterval = () => {
    if (captureIntervalRef.current !== null) {
      window.clearInterval(captureIntervalRef.current);
    }
    
    if (mode === 'attendance') {
      captureIntervalRef.current = window.setInterval(() => {
        if (faceDetected && !isCapturing) {
          const now = Date.now();
          if (now - lastCaptureTime > captureInterval) {
            handleCapture();
          }
        }
      }, 1000); // Check every second
    }
  };

  // Start camera
  const startCamera = async () => {
    console.log('Starting camera...');
    setError(null);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera not supported');
      return;
    }

    const isSecure = window.location.protocol === 'https:' || 
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
    
    if (!isSecure) {
      setError('HTTPS or localhost required');
      return;
    }

    try {
      const constraints = { video: true, audio: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve(true);
          }
        });
        
        setIsCameraActive(true);
        startFaceDetection();
        startAutoCaptureInterval();
      }
      
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied');
      } else {
        setError('Camera error');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    
    if (detectionIntervalRef.current !== null) {
      window.clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (captureIntervalRef.current !== null) {
      window.clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
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
    
    try {
      const imageData = await captureImage();
      
      if (!imageData) {
        throw new Error('Capture failed');
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
            timestamp: new Date().toISOString()
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
            }, 1000);
          } else {
            setTimeout(() => {
              setIsCapturing(false);
              onAttendanceComplete?.(result);
            }, 1000);
          }
          
          return 100;
        }
        return prev + 20;
      });
    }, 200);
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

  // Cleanup
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Card style={{ margin: '0 auto' }} bodyStyle={{ padding: '16px' }}>
      {/* Camera Feed */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ 
          width: '100%',
          height: 300,
          backgroundColor: '#000',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 16,
          border: isCameraActive ? '3px solid #52c41a' : '3px solid #d9d9d9',
          position: 'relative'
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
              display: isCameraActive ? 'block' : 'none'
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
              color: '#fff'
            }}>
              <VideoOff size={48} />
            </div>
          )}
          
          {/* Status indicators */}
          {isCameraActive && (
            <div style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <div style={{ 
                width: 10, 
                height: 10, 
                borderRadius: '50%',
                backgroundColor: faceDetected ? '#52c41a' : '#faad14',
                animation: faceDetected ? 'pulse 1s infinite' : 'none'
              }} />
              <span style={{ 
                color: 'white', 
                fontSize: '12px',
                fontWeight: 'bold',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
              }}>
                {faceDetected ? 'READY' : 'WAITING'}
              </span>
            </div>
          )}
        </div>

        {/* Status */}
        <div style={{ marginTop: 12 }}>
          <Space>
            <div style={{ 
              width: 10, 
              height: 10, 
              borderRadius: '50%',
              backgroundColor: isCameraActive ? '#52c41a' : '#ff4d4f'
            }} />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {isCameraActive ? 'ACTIVE' : 'OFF'}
            </Text>
          </Space>
        </div>
      </div>

      {/* Processing */}
      {isCapturing && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Progress 
            percent={progress} 
            status="active" 
            strokeColor={{ from: '#108ee9', to: '#87d068' }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Alert
            message="Camera Error"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Button
            type="primary"
            onClick={startCamera}
            size="small"
          >
            Retry Camera
          </Button>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </Card>
  );
};

export default FaceCamera;