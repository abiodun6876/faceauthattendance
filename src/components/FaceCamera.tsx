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
  const [showManualButton] = useState(mode === 'enrollment'); // Show manual button for enrollment
  
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
          width: { ideal: 1920 }, // Higher resolution for better face recognition
          height: { ideal: 1080 }
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
            photoData: {
              base64: imageData,
              timestamp: new Date().toISOString()
            },
            captureCount: captureCount + 1,
            studentData: student
          };

          if (mode === 'enrollment') {
            Object.assign(result, {
              studentId: student?.id || student?.student_id || student?.matric_number,
              studentName: student?.name,
              matricNumber: student?.matric_number,
              student: student,
              photoData: {
                base64: imageData,
                timestamp: new Date().toISOString()
              }
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

  // Auto-start camera on mount for attendance
  useEffect(() => {
    if (mode === 'attendance') {
      const timer = setTimeout(() => {
        startCamera();
      }, 500);
    } else if (mode === 'enrollment') {
      // Auto-start camera for enrollment as well
      const timer = setTimeout(() => {
        startCamera();
      }, 500);
    }

    return () => {
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
      height: '100vh', // Full viewport height
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0a1a35'
    }}>
      {/* Camera Feed - Full screen */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        padding: '10px'
      }}>
        <div style={{ 
          width: '100%',
          height: '100%',
          maxHeight: '80vh',
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
              <VideoOff size={64} color="rgba(0, 150, 255, 0.7)" />
              <Text style={{ 
                color: 'rgba(0, 150, 255, 0.7)', 
                marginTop: 16,
                fontSize: 20,
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
              top: 16,
              left: 16,
              right: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 10,
              pointerEvents: 'none'
            }}>
              {/* Mode indicator */}
              <div style={{
                backgroundColor: mode === 'enrollment' 
                  ? 'rgba(0, 150, 255, 0.2)' 
                  : 'rgba(0, 255, 150, 0.2)',
                color: mode === 'enrollment' ? '#00aaff' : '#00ffaa',
                padding: '8px 16px',
                borderRadius: 20,
                fontSize: 14,
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: mode === 'enrollment' 
                  ? '1px solid rgba(0, 150, 255, 0.3)' 
                  : '1px solid rgba(0, 255, 150, 0.3)',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ 
                  width: 10, 
                  height: 10, 
                  borderRadius: '50%',
                  backgroundColor: mode === 'enrollment' ? '#00aaff' : '#00ffaa',
                  animation: isCapturing ? 'pulse 1s infinite' : 'none'
                }} />
                {mode === 'enrollment' ? 'ENROLLMENT MODE' : 'ATTENDANCE MODE'}
              </div>
              
              {/* Ready status */}
              <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: isCapturing ? '#00aaff' : '#00ffaa',
                padding: '8px 16px',
                borderRadius: 20,
                fontSize: 14,
                fontWeight: 'bold',
                border: isCapturing 
                  ? '1px solid rgba(0, 170, 255, 0.3)' 
                  : '1px solid rgba(0, 255, 170, 0.3)',
                backdropFilter: 'blur(10px)'
              }}>
                {isCapturing ? 'PROCESSING...' : 'READY'}
              </div>
            </div>
          )}

          {/* Guide frame for face positioning - LARGER */}
          {isCameraActive && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '70%', // Larger frame
              height: '80%', // Larger frame
              border: '3px dashed rgba(0, 255, 150, 0.6)',
              borderRadius: 12,
              pointerEvents: 'none',
              boxShadow: '0 0 30px rgba(0, 255, 150, 0.3)'
            }}>
              <div style={{
                position: 'absolute',
                bottom: -40,
                left: '50%',
                transform: 'translateX(-50%)',
                color: 'rgba(0, 255, 150, 0.9)',
                fontSize: 16,
                fontWeight: 'bold',
                textAlign: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: '8px 24px',
                borderRadius: 20,
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(10px)'
              }}>
                ⬆️ POSITION FACE HERE ⬆️
              </div>
            </div>
          )}

          {/* Manual Capture Button for Enrollment - CENTERED */}
          {isCameraActive && mode === 'enrollment' && !isCapturing && (
            <div style={{
              position: 'absolute',
              bottom: 40,
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
                  height: 60,
                  width: 200,
                  fontSize: 18,
                  fontWeight: 'bold',
                  backgroundColor: 'rgba(0, 150, 255, 0.9)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: 30,
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 8px 25px rgba(0, 150, 255, 0.4)'
                }}
              >
                CAPTURE FACE
              </Button>
            </div>
          )}

          {/* Auto-scan indicator for Attendance */}
          {isCameraActive && mode === 'attendance' && (
            <div style={{
              position: 'absolute',
              bottom: 30,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(0, 255, 150, 0.2)',
              color: '#00ffaa',
              padding: '10px 20px',
              borderRadius: 20,
              fontSize: 14,
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              border: '1px solid rgba(0, 255, 150, 0.3)',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ 
                width: 12, 
                height: 12, 
                borderRadius: '50%',
                backgroundColor: isCapturing ? '#00aaff' : '#00ffaa',
                animation: isCapturing ? 'pulse 1s infinite' : 'none'
              }} />
              AUTO-SCAN: {captureCount} DETECTIONS
            </div>
          )}
        </div>

        {/* Processing Bar - Minimal */}
        {isCapturing && (
          <div style={{
            position: 'absolute',
            bottom: mode === 'enrollment' ? 120 : 80,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '80%',
            maxWidth: 500,
            zIndex: 10
          }}>
            <Progress 
              percent={progress} 
              status="active" 
              strokeColor={{ from: '#00aaff', to: '#00ffaa' }}
              strokeWidth={6}
              showInfo={false}
            />
            <Text style={{ 
              color: '#00ffaa', 
              fontSize: 14, 
              textAlign: 'center',
              display: 'block',
              marginTop: 8,
              fontWeight: 'bold'
            }}>
              PROCESSING FACE DATA...
            </Text>
          </div>
        )}
      </div>

      {/* Stats Footer - Minimal */}
      <div style={{ 
        padding: '16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
        backgroundColor: 'rgba(10, 26, 53, 0.8)',
        borderTop: '1px solid rgba(0, 150, 255, 0.2)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8 
        }}>
          <div style={{ 
            width: 12, 
            height: 12, 
            borderRadius: '50%',
            backgroundColor: isCameraActive ? '#00ffaa' : '#ff4d4f'
          }} />
          <Text style={{ 
            fontSize: 14, 
            color: isCameraActive ? '#00ffaa' : '#ff4d4f',
            fontWeight: 'bold'
          }}>
            {isCameraActive ? 'CAMERA ACTIVE' : 'CAMERA OFF'}
          </Text>
        </div>
        
        <div style={{ 
          height: 20,
          width: 1,
          backgroundColor: 'rgba(0, 150, 255, 0.3)'
        }} />
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8 
        }}>
          <div style={{ 
            width: 12, 
            height: 12, 
            borderRadius: '50%',
            backgroundColor: mode === 'attendance' && autoCapture ? '#00ffaa' : '#00aaff'
          }} />
          <Text style={{ 
            fontSize: 14, 
            color: mode === 'attendance' && autoCapture ? '#00ffaa' : '#00aaff',
            fontWeight: 'bold'
          }}>
            {mode === 'enrollment' ? 'MANUAL CAPTURE' : 'AUTO-SCAN: ON'}
          </Text>
        </div>

        <div style={{ 
          height: 20,
          width: 1,
          backgroundColor: 'rgba(0, 150, 255, 0.3)'
        }} />

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8 
        }}>
          <Text style={{ 
            fontSize: 14, 
            color: '#fff',
            fontWeight: 'bold'
          }}>
            STUDENT: <span style={{ color: '#00ffaa' }}>
              {student?.name || 'N/A'}
            </span>
          </Text>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          position: 'absolute',
          top: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: 500,
          zIndex: 100,
          backgroundColor: 'rgba(255, 50, 50, 0.2)',
          color: '#ff3333',
          padding: '16px 20px',
          borderRadius: 12,
          border: '1px solid rgba(255, 50, 50, 0.5)',
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <Text style={{ 
            fontSize: 16, 
            fontWeight: 'bold',
            color: '#ff3333'
          }}>
            ⚠️ {error}
          </Text>
          <Button
            type="primary"
            danger
            size="small"
            onClick={startCamera}
            style={{ marginTop: 12 }}
          >
            Retry Camera
          </Button>
        </div>
      )}

      {/* Student Info Overlay for Enrollment */}
      {isCameraActive && mode === 'enrollment' && student && (
        <div style={{
          position: 'absolute',
          top: 100,
          right: 20,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          padding: '16px',
          borderRadius: 12,
          border: '1px solid rgba(0, 150, 255, 0.3)',
          maxWidth: 300,
          backdropFilter: 'blur(10px)',
          zIndex: 10
        }}>
          <Text style={{ 
            fontSize: 16, 
            fontWeight: 'bold',
            color: '#00ffaa',
            display: 'block',
            marginBottom: 8
          }}>
            CURRENT STUDENT
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

      {/* Instructions */}
      {isCameraActive && (
        <div style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: 20,
          border: '1px solid rgba(0, 255, 150, 0.3)',
          backdropFilter: 'blur(10px)',
          zIndex: 10,
          textAlign: 'center'
        }}>
          <Text style={{ 
            fontSize: 14, 
            fontWeight: 'bold',
            color: '#00ffaa'
          }}>
            {mode === 'enrollment' 
              ? '📸 CENTER YOUR FACE IN THE FRAME AND CLICK "CAPTURE FACE"' 
              : '👁️ LOOK DIRECTLY AT THE CAMERA FOR ATTENDANCE'}
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
          
          body {
            margin: 0;
            overflow: hidden;
          }
        `}
      </style>
    </div>
  );
};

export default FaceCamera;