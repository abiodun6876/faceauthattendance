// src/components/FaceCamera.tsx - FIXED VERSION WITH BETTER ERROR HANDLING
import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Alert, Typography, Space, Progress, Row, Col, Modal } from 'antd';
import { Camera, RefreshCw, CheckCircle, User, Video, VideoOff, HelpCircle } from 'lucide-react';

const { Title, Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  student?: any;
  onEnrollmentComplete?: (result: any) => void;
  onAttendanceComplete?: (result: any) => void;
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  student,
  onEnrollmentComplete,
  onAttendanceComplete
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize camera with better error handling
  const startCamera = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if we're on HTTPS or localhost (required for camera)
      const isSecure = window.location.protocol === 'https:' || 
                      window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
      
      if (!isSecure) {
        setError('Camera access requires HTTPS or localhost. Current URL: ' + window.location.protocol + '//' + window.location.host);
        setIsLoading(false);
        return;
      }

      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera API not supported in this browser. Try Chrome, Firefox, or Edge.');
        setIsLoading(false);
        return;
      }

      // Request camera access with multiple fallback options
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user' // Front camera
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be ready
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              resolve(true);
            };
          }
        });
        setIsCameraActive(true);
      }
      
      setError(null);
      
    } catch (err: any) {
      console.error('Camera error:', err);
      
      let errorMessage = 'Camera access failed: ';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage += 'Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage += 'No camera found. Please connect a camera.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage += 'Camera is already in use by another application.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage += 'Camera constraints could not be satisfied.';
      } else {
        errorMessage += err.message || 'Unknown error occurred.';
      }
      
      setError(errorMessage);
      setIsCameraActive(false);
      
      // Try fallback simulation if camera fails
      if (mode === 'enrollment') {
        setTimeout(() => {
          setError('Using simulation mode since camera is unavailable. ' + errorMessage);
          simulateFaceCapture();
        }, 2000);
      }
      
    } finally {
      setIsLoading(false);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setCapturedImage(null);
  };

  // Capture image from webcam
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('Video or canvas not available');
      return null;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) {
      console.error('Canvas context not available');
      return null;
    }
    
    // Check if video is ready
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Video not ready for capture');
      return null;
    }
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to data URL
    try {
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (err) {
      console.error('Failed to convert canvas to image:', err);
      return null;
    }
  };

  const handleCapture = async () => {
    if (!isCameraActive) {
      setError('Please start the camera first');
      return;
    }

    setIsCapturing(true);
    setProgress(0);
    setCapturedImage(null);

    // Capture image
    const imageData = captureImage();
    
    if (!imageData) {
      setError('Failed to capture image. Please try again.');
      setIsCapturing(false);
      return;
    }

    setCapturedImage(imageData);

    // Simulate processing
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          
          // Generate result based on mode
          const result = {
            success: true,
            message: mode === 'enrollment' 
              ? 'Face enrolled successfully!' 
              : 'Attendance recorded successfully!',
            timestamp: new Date().toISOString(),
            photoUrl: imageData,
            quality: 0.85 + Math.random() * 0.1
          };

          if (mode === 'enrollment') {
            // For enrollment, add student data and embedding
            Object.assign(result, {
              studentId: student?.id || `student_${Date.now()}`,
              studentName: student?.name || 'Unknown Student',
              embedding: Array.from({ length: 128 }, () => Math.random()),
            });
            
            setTimeout(() => {
              setIsCapturing(false);
              onEnrollmentComplete?.(result);
            }, 500);
          } else {
            // For attendance, add student recognition data
            Object.assign(result, {
              student: {
                id: student?.id || `student_${Math.floor(Math.random() * 1000)}`,
                name: student?.name || 'Demo Student',
                matric_number: student?.matric_number || `20/ABC${Math.floor(Math.random() * 1000)}`
              },
              confidence: 0.85 + Math.random() * 0.1,
            });
            
            setTimeout(() => {
              setIsCapturing(false);
              onAttendanceComplete?.(result);
            }, 500);
          }
          
          return 100;
        }
        return prev + 20;
      });
    }, 300);
  };

  // Fallback simulation function
  const simulateFaceCapture = () => {
    setIsCapturing(true);
    setProgress(0);
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          
          const result = {
            success: true,
            message: 'Face captured successfully (Simulation Mode)',
            timestamp: new Date().toISOString(),
            photoUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${student?.matric_number || 'student'}`,
            quality: 0.85
          };

          if (mode === 'enrollment') {
            Object.assign(result, {
              studentId: student?.id || `student_${Date.now()}`,
              studentName: student?.name || 'Unknown Student',
              embedding: Array.from({ length: 128 }, () => Math.random()),
            });
            
            setTimeout(() => {
              setIsCapturing(false);
              onEnrollmentComplete?.(result);
            }, 500);
          } else {
            Object.assign(result, {
              student: {
                id: student?.id || `student_${Math.floor(Math.random() * 1000)}`,
                name: student?.name || 'Demo Student',
                matric_number: student?.matric_number || `20/ABC${Math.floor(Math.random() * 1000)}`
              },
              confidence: 0.85,
            });
            
            setTimeout(() => {
              setIsCapturing(false);
              onAttendanceComplete?.(result);
            }, 500);
          }
          
          return 100;
        }
        return prev + 20;
      });
    }, 300);
  };

  const handleRetry = () => {
    stopCamera();
    setIsCapturing(false);
    setProgress(0);
    setCapturedImage(null);
    setError(null);
    setTimeout(() => {
      startCamera();
    }, 500);
  };

  // Start camera on component mount
  useEffect(() => {
    startCamera();
    
    // Cleanup on unmount
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Card style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          {mode === 'enrollment' ? 'Face Enrollment' : 'Face Attendance'}
        </Title>
        <Button 
          type="text" 
          icon={<HelpCircle size={20} />}
          onClick={() => setShowHelp(true)}
        >
          Help
        </Button>
      </div>
      
      {mode === 'enrollment' && student && (
        <Alert
          message={`Enrolling: ${student.name || 'Student'}`}
          description={`Matric: ${student.matric_number || 'Not assigned'}`}
          type="info"
          showIcon
          icon={<User />}
          style={{ marginBottom: 20 }}
        />
      )}

      {error && (
        <Alert
          message="Camera Error"
          description={
            <div>
              <p>{error}</p>
              <Button 
                type="link" 
                onClick={handleRetry}
                style={{ padding: 0, height: 'auto' }}
              >
                Click here to retry
              </Button>
            </div>
          }
          type="error"
          showIcon
          style={{ marginBottom: 20 }}
        />
      )}

      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <div style={{ textAlign: 'center' }}>
            <Title level={5}>Live Camera Feed</Title>
            
            <div style={{ 
              position: 'relative',
              width: '100%',
              height: 300,
              backgroundColor: '#000',
              borderRadius: 8,
              overflow: 'hidden',
              marginBottom: 16,
              border: isCameraActive ? '3px solid #52c41a' : '3px solid #ff4d4f'
            }}>
              {isCameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  padding: 20
                }}>
                  <VideoOff size={48} />
                  <Text style={{ color: '#fff', marginTop: 10, textAlign: 'center' }}>
                    {isLoading ? 'Initializing camera...' : 'Camera inactive'}
                  </Text>
                </div>
              )}
            </div>

            <Space wrap style={{ marginBottom: 16 }}>
              {!isCameraActive ? (
                <Button
                  type="primary"
                  icon={<Video size={16} />}
                  onClick={startCamera}
                  loading={isLoading}
                  disabled={isLoading}
                >
                  {isLoading ? 'Starting...' : 'Start Camera'}
                </Button>
              ) : (
                <Button
                  icon={<VideoOff size={16} />}
                  onClick={stopCamera}
                >
                  Stop Camera
                </Button>
              )}
              
              {isCameraActive && !isCapturing && (
                <Button
                  type="primary"
                  icon={<Camera size={16} />}
                  onClick={handleCapture}
                >
                  Capture Face
                </Button>
              )}
              
              {!isCameraActive && !isLoading && (
                <Button
                  type="dashed"
                  icon={<Camera size={16} />}
                  onClick={simulateFaceCapture}
                >
                  Use Simulation
                </Button>
              )}
              
              <Button
                icon={<RefreshCw size={16} />}
                onClick={handleRetry}
              >
                Retry
              </Button>
            </Space>
            
            <div style={{ textAlign: 'left', backgroundColor: '#f6ffed', padding: 12, borderRadius: 6 }}>
              <Text type="secondary">
                <small>
                  <strong>Status:</strong> {isCameraActive ? 'Camera Active ✓' : 'Camera Inactive ✗'} | 
                  <strong> HTTPS:</strong> {window.location.protocol === 'https:' ? 'Yes ✓' : 'No ✗'} | 
                  <strong> Localhost:</strong> {['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'Yes ✓' : 'No ✗'}
                </small>
              </Text>
            </div>
          </div>
        </Col>

        <Col xs={24} md={12}>
          <div style={{ textAlign: 'center' }}>
            <Title level={5}>Capture Result</Title>
            
            {isCapturing ? (
              <div style={{ padding: '40px 20px' }}>
                <div style={{ 
                  width: 200, 
                  height: 200, 
                  margin: '0 auto 20px',
                  borderRadius: '50%',
                  backgroundColor: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '3px solid #1890ff'
                }}>
                  <Camera size={48} color="#1890ff" />
                </div>
                
                <Text style={{ display: 'block', marginBottom: 20 }}>
                  {progress < 100 
                    ? 'Processing face data...' 
                    : 'Processing complete!'
                  }
                </Text>
                
                <Progress percent={progress} status="active" />
                
                {progress >= 100 && (
                  <Alert
                    message="Success!"
                    description="Face data has been captured and processed"
                    type="success"
                    showIcon
                    style={{ marginTop: 20 }}
                  />
                )}
              </div>
            ) : capturedImage ? (
              <div style={{ padding: '20px 0' }}>
                <img
                  src={capturedImage}
                  alt="Captured Face"
                  style={{
                    width: 200,
                    height: 200,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid #52c41a',
                    marginBottom: 16
                  }}
                />
                <Alert
                  message="Face Captured"
                  description="Face image has been successfully captured"
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Button onClick={handleRetry}>
                  <RefreshCw size={16} style={{ marginRight: 8 }} />
                  Capture Again
                </Button>
              </div>
            ) : (
              <div style={{ 
                padding: '60px 20px',
                backgroundColor: '#f5f5f5',
                borderRadius: 8,
                marginBottom: 16,
                height: 340,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Camera size={48} color="#666" />
                <Text style={{ display: 'block', marginTop: 16, textAlign: 'center' }}>
                  {isCameraActive 
                    ? 'Click "Capture Face" to take a photo' 
                    : 'Start camera to begin face capture'
                  }
                </Text>
              </div>
            )}
          </div>
        </Col>
      </Row>

      <div style={{ marginTop: 24 }}>
        <Alert
          message="Instructions for Camera Access"
          description={
            <div>
              <p><strong>If camera doesn't work:</strong></p>
              <ol style={{ margin: '8px 0', paddingLeft: 20 }}>
                <li>Ensure you're on <strong>HTTPS</strong> or <strong>localhost</strong></li>
                <li>Click "Allow" when browser asks for camera permission</li>
                <li>Check browser settings if camera is blocked</li>
                <li>Try "Use Simulation" button as fallback</li>
                <li>Make sure no other app is using the camera</li>
              </ol>
              <p>Current URL: <code>{window.location.href}</code></p>
            </div>
          }
          type="info"
          showIcon
        />
      </div>

      {/* Hidden canvas for capturing images */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />

      {/* Help Modal */}
      <Modal
        title="Camera Help Guide"
        open={showHelp}
        onCancel={() => setShowHelp(false)}
        footer={[
          <Button key="close" onClick={() => setShowHelp(false)}>
            Close
          </Button>
        ]}
      >
        <div>
          <Title level={5}>Common Camera Issues & Solutions:</Title>
          <ul>
            <li><strong>Camera inactive:</strong> Make sure you're on HTTPS or localhost</li>
            <li><strong>Permission denied:</strong> Check browser settings → Site permissions → Camera</li>
            <li><strong>No camera found:</strong> Ensure webcam is connected and not in use by other apps</li>
            <li><strong>On Chrome:</strong> Click the camera icon in address bar to manage permissions</li>
            <li><strong>On Firefox:</strong> Go to Preferences → Privacy & Security → Permissions → Camera</li>
          </ul>
          <p><strong>Testing URL:</strong> Your current URL is: {window.location.href}</p>
          <p><strong>Required:</strong> HTTPS:// or http://localhost or http://127.0.0.1</p>
        </div>
      </Modal>
    </Card>
  );
};

export default FaceCamera;