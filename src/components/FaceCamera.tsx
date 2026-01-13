import React, { useState, useRef, useEffect } from 'react';
import { 
  Typography, 
  Progress,
  Button,
  Space 
} from 'antd';
import { VideoOff, Camera } from 'lucide-react';

const { Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  student?: any;
  onEnrollmentComplete?: (result: any) => void;
  onAttendanceComplete?: (result: any) => void;
  onFaceCapture?: (photoData: string) => void; // ADD THIS LINE
  autoCapture?: boolean;
  captureInterval?: number;
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  student,
  onEnrollmentComplete,
  onAttendanceComplete,
  onFaceCapture, // ADD THIS LINE
  autoCapture = true,
  captureInterval = 3000
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastCaptureTime, setLastCaptureTime] = useState<number>(0);
  const [captureCount, setCaptureCount] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoCaptureRef = useRef<number | null>(null);

  // Simple auto-capture function
  const startAutoCapture = () => {
    if (autoCaptureRef.current !== null) {
      window.clearInterval(autoCaptureRef.current);
    }
    
    if (autoCapture && mode === 'attendance' && isCameraActive) {
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
        
        // Start auto-capture for attendance mode if autoCapture is true
        if (mode === 'attendance' && autoCapture) {
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

  // Handle capture - MANUAL for enrollment, AUTO for attendance
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
      
      // Call onFaceCapture callback if provided
      if (onFaceCapture) {
        onFaceCapture(imageData);
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
            photoData: {
              base64: imageData,
              timestamp: new Date().toISOString()
            },
            photoUrl: imageData, // For backward compatibility
            timestamp: new Date().toISOString(),
            captureCount: captureCount + 1,
            studentData: student,
            studentId: student?.matric_number,
            studentName: student?.name,
            matricNumber: student?.matric_number
          };

          if (mode === 'enrollment') {
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

  // Auto-start camera on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      startCamera();
    }, 500);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [mode]);

  // Restart auto-capture when camera becomes active
  useEffect(() => {
    if (isCameraActive && mode === 'attendance' && autoCapture) {
      startAutoCapture();
    }
  }, [isCameraActive, autoCapture]);

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
      padding: '8px',
      backgroundColor: '#0a1a35'
    }}>
      {/* Camera Feed - Full screen */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
      }}>
        <div style={{ 
          width: '100%',
          height: '100%',
          backgroundColor: '#000',
          borderRadius: 12,
          overflow: 'hidden',
          border: isCameraActive ? '3px solid rgba(0, 255, 150, 0.5)' : '3px solid rgba(0, 150, 255, 0.3)',
          position: 'relative',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
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
              backgroundColor: '#0a1a35'
            }}>
              <VideoOff size={48} color="rgba(0, 150, 255, 0.7)" />
              <Text style={{ 
                color: 'rgba(0, 150, 255, 0.7)', 
                marginTop: 16,
                fontSize: 16,
                fontWeight: 'bold'
              }}>
                Starting Camera...
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
              alignItems: 'center',
              zIndex: 10
            }}>
              {/* Auto-scan indicator */}
              <div style={{
                backgroundColor: mode === 'enrollment' 
                  ? 'rgba(0, 150, 255, 0.2)' 
                  : 'rgba(0, 255, 150, 0.2)',
                color: mode === 'enrollment' ? '#00aaff' : '#00ffaa',
                padding: '6px 12px',
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                border: mode === 'enrollment' 
                  ? '1px solid rgba(0, 150, 255, 0.3)' 
                  : '1px solid rgba(0, 255, 150, 0.3)',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%',
                  backgroundColor: isCapturing ? '#00aaff' : mode === 'enrollment' ? '#00aaff' : '#00ffaa',
                  animation: isCapturing ? 'pulse 1s infinite' : 'none'
                }} />
                {mode === 'enrollment' ? 'ENROLLMENT MODE' : `AUTO-SCAN: ${captureCount}`}
              </div>
              
              {/* Ready status */}
              <div style={{
                backgroundColor: 'rgba(0, 150, 255, 0.2)',
                color: '#00aaff',
                padding: '6px 12px',
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 'bold',
                border: '1px solid rgba(0, 150, 255, 0.3)',
                backdropFilter: 'blur(10px)'
              }}>
                {isCapturing ? 'PROCESSING...' : 'READY'}
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
              border: '2px dashed rgba(0, 255, 150, 0.5)',
              borderRadius: 8,
              pointerEvents: 'none',
              boxShadow: '0 0 20px rgba(0, 255, 150, 0.2)'
            }}>
              <div style={{
                position: 'absolute',
                bottom: -30,
                left: '50%',
                transform: 'translateX(-50%)',
                color: 'rgba(0, 255, 150, 0.8)',
                fontSize: 12,
                fontWeight: 'bold',
                textAlign: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                padding: '4px 12px',
                borderRadius: 12,
                whiteSpace: 'nowrap'
              }}>
                Position Face Here
              </div>
            </div>
          )}

          {/* Manual Capture Button for Enrollment */}
          {isCameraActive && mode === 'enrollment' && !isCapturing && (
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20
            }}>
              <Button
                type="primary"
                size="large"
                icon={<Camera size={20} />}
                onClick={handleCapture}
                style={{
                  height: 50,
                  width: 180,
                  fontSize: 16,
                  fontWeight: 'bold',
                  backgroundColor: 'rgba(0, 150, 255, 0.9)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: 25,
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 8px 25px rgba(0, 150, 255, 0.4)'
                }}
              >
                CAPTURE FACE
              </Button>
            </div>
          )}
        </div>

        {/* Processing Bar */}
        {isCapturing && (
          <div style={{
            position: 'absolute',
            bottom: mode === 'enrollment' ? 90 : 20,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '80%',
            maxWidth: 400,
            zIndex: 10
          }}>
            <Progress 
              percent={progress} 
              status="active" 
              strokeColor={{ from: '#00aaff', to: '#00ffaa' }}
              strokeWidth={4}
              showInfo={false}
            />
            <Text style={{ 
              color: '#00ffaa', 
              fontSize: 12, 
              textAlign: 'center',
              display: 'block',
              marginTop: 4,
              fontWeight: 'bold'
            }}>
              {mode === 'enrollment' ? 'SAVING FACE DATA...' : 'SCANNING...'}
            </Text>
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div style={{ 
        padding: '8px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 6 
        }}>
          <div style={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%',
            backgroundColor: isCameraActive ? '#00ffaa' : '#ff4d4f'
          }} />
          <Text style={{ 
            fontSize: 12, 
            color: isCameraActive ? '#00ffaa' : '#ff4d4f',
            fontWeight: 'bold'
          }}>
            {isCameraActive ? 'CAMERA ACTIVE' : 'CAMERA OFF'}
          </Text>
        </div>
        
        <div style={{ 
          height: 16,
          width: 1,
          backgroundColor: 'rgba(0, 150, 255, 0.3)'
        }} />
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 6 
        }}>
          <div style={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%',
            backgroundColor: mode === 'attendance' && autoCapture ? '#00ffaa' : '#00aaff'
          }} />
          <Text style={{ 
            fontSize: 12, 
            color: mode === 'attendance' && autoCapture ? '#00ffaa' : '#00aaff',
            fontWeight: 'bold'
          }}>
            {mode === 'enrollment' ? 'MANUAL CAPTURE' : 'AUTO-SCAN: ON'}
          </Text>
        </div>
      </div>

      {/* Student Info */}
      {isCameraActive && mode === 'enrollment' && student && (
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          padding: '12px',
          borderRadius: 8,
          border: '1px solid rgba(0, 150, 255, 0.3)',
          maxWidth: 250,
          backdropFilter: 'blur(10px)',
          zIndex: 10
        }}>
          <Text style={{ 
            fontSize: 14, 
            fontWeight: 'bold',
            color: '#00ffaa',
            display: 'block',
            marginBottom: 6
          }}>
            ENROLLING STUDENT
          </Text>
          <div style={{ marginBottom: 4 }}>
            <Text strong style={{ color: '#00aaff' }}>Name: </Text>
            <Text>{student.name}</Text>
          </div>
          <div style={{ marginBottom: 4 }}>
            <Text strong style={{ color: '#00aaff' }}>Matric: </Text>
            <Text>{student.matric_number}</Text>
          </div>
          <div>
            <Text strong style={{ color: '#00aaff' }}>Level: </Text>
            <Text>Level {student.level}</Text>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          position: 'absolute',
          bottom: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: 400,
          zIndex: 100,
          backgroundColor: 'rgba(255, 50, 50, 0.15)',
          color: '#ff3333',
          padding: '12px 16px',
          borderRadius: 12,
          border: '1px solid rgba(255, 50, 50, 0.5)',
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <Text style={{ 
            fontSize: 14, 
            fontWeight: 'bold',
            color: '#ff3333'
          }}>
            {error}
          </Text>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
};

export default FaceCamera;