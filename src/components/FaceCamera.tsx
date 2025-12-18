// src/components/FaceCamera.tsx - FINAL BUILD-READY VERSION
import React, { useState, useRef } from 'react';
import { Button, Card, Progress, Alert, Space, Typography, Row, Col, Modal } from 'antd';
import { Camera, CheckCircle, XCircle, RotateCw, User, Image, Trash2 } from 'lucide-react';

// Import Webcam but don't use its types directly
const Webcam = require('react-webcam').default;

const { Title, Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  student?: any;
  sessionInfo?: {
    facultyId?: string;
    departmentId?: string;
    level?: number;
    courseCode?: string;
    eventId?: string;
    sessionId?: string;
  };
  onEnrollmentComplete?: (result: any) => void;
  onAttendanceComplete?: (result: any) => void;
}

const FaceCamera: React.FC<FaceCameraProps> = ({ 
  mode, 
  student, 
  sessionInfo,
  onEnrollmentComplete,
  onAttendanceComplete 
}) => {
  // CRITICAL: Use 'any' type to avoid TypeScript errors
  const webcamRef = useRef<any>(null);
  
  const [capturing, setCapturing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [imagesCaptured, setImagesCaptured] = useState<string[]>([]);
  const [status, setStatus] = useState<'ready' | 'capturing' | 'processing' | 'complete'>('ready');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [storedImages, setStoredImages] = useState<any[]>([]);

  // Capture settings
  const CAPTURE_COUNT = mode === 'enrollment' ? 5 : 3;
  const CAPTURE_INTERVAL = 500;

  const captureImage = (): string | null => {
    if (!webcamRef.current) return null;
    
    // Safe access with optional chaining
    const imageSrc = webcamRef.current?.getScreenshot?.();
    
    if (imageSrc) {
      setImagesCaptured(prev => [...prev, imageSrc]);
    }
    return imageSrc;
  };

  const startCapture = async () => {
    if (capturing) return;
    
    setCapturing(true);
    setStatus('capturing');
    setImagesCaptured([]);
    setProgress(0);
    
    // Capture multiple images
    for (let i = 0; i < CAPTURE_COUNT; i++) {
      captureImage();
      setProgress(((i + 1) / CAPTURE_COUNT) * 100);
      await new Promise(resolve => setTimeout(resolve, CAPTURE_INTERVAL));
    }
    
    setCapturing(false);
    setStatus('processing');
    
    // Simulate processing
    setTimeout(() => {
      if (mode === 'enrollment') {
        setResult({
          success: true,
          message: 'Face enrollment completed successfully',
          studentId: student?.id || student?.matric_number || 'STUDENT_001',
          imagesCaptured: imagesCaptured.length,
          timestamp: new Date().toISOString()
        });
      } else {
        setResult({
          success: true,
          message: 'Attendance recorded successfully',
          student: { name: 'Demo Student', id: 'STUDENT_001' },
          confidence: 0.85,
          timestamp: new Date().toISOString()
        });
      }
      setStatus('complete');
    }, 1000);
  };

  const resetCamera = () => {
    setResult(null);
    setImagesCaptured([]);
    setProgress(0);
    setStatus('ready');
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const videoConstraints = {
    facingMode: facingMode,
    width: 640,
    height: 480
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card
        title={
          <Space>
            <Camera size={20} />
            <span>{mode === 'enrollment' ? 'Face Enrollment' : 'Face Attendance'}</span>
          </Space>
        }
        extra={
          <Button
            icon={<RotateCw size={16} />}
            onClick={toggleCamera}
            size="small"
          >
            Switch Camera
          </Button>
        }
      >
        {status !== 'complete' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              position: 'relative', 
              marginBottom: 20,
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: '#000'
            }}>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                style={{ 
                  width: '100%',
                  maxHeight: 400,
                  objectFit: 'cover'
                }}
              />
              {status === 'capturing' && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '20px',
                  borderRadius: '50%',
                  width: 100,
                  height: 100,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 'bold'
                }}>
                  {imagesCaptured.length}/{CAPTURE_COUNT}
                </div>
              )}
            </div>

            {status === 'capturing' && (
              <div style={{ marginBottom: 20 }}>
                <Progress percent={Math.round(progress)} status="active" />
                <Text type="secondary">
                  Capturing images... ({imagesCaptured.length}/{CAPTURE_COUNT})
                </Text>
              </div>
            )}

            {status === 'processing' && (
              <div style={{ marginBottom: 20 }}>
                <Progress percent={100} status="active" />
                <Text type="secondary">Processing face data...</Text>
              </div>
            )}

            <Button
              type="primary"
              size="large"
              icon={<Camera size={20} />}
              onClick={startCapture}
              loading={status === 'capturing' || status === 'processing'}
              disabled={status === 'capturing' || status === 'processing'}
              style={{ marginBottom: 10 }}
            >
              {mode === 'enrollment' ? 'Start Face Enrollment' : 'Capture Attendance'}
            </Button>

            {imagesCaptured.length > 0 && status !== 'capturing' && (
              <div style={{ marginTop: 20 }}>
                <Text strong>Captured Images Preview:</Text>
                <Row gutter={[8, 8]} style={{ marginTop: 10 }}>
                  {imagesCaptured.map((img, index) => (
                    <Col span={6} key={index}>
                      <img
                        src={img}
                        alt={`Capture ${index + 1}`}
                        style={{
                          width: '100%',
                          height: 80,
                          objectFit: 'cover',
                          borderRadius: 4,
                          border: '1px solid #d9d9d9'
                        }}
                      />
                      <Text type="secondary" style={{ fontSize: '10px' }}>
                        Image {index + 1}
                      </Text>
                    </Col>
                  ))}
                </Row>
              </div>
            )}
          </div>
        )}

        {status === 'complete' && result && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {result.success ? (
              <CheckCircle size={64} color="#52c41a" />
            ) : (
              <XCircle size={64} color="#ff4d4f" />
            )}
            
            <Title level={4} style={{ marginTop: 20, marginBottom: 10 }}>
              {result.success ? 'Success!' : 'Failed'}
            </Title>
            
            <Text style={{ display: 'block', marginBottom: 20 }}>
              {result.message}
            </Text>

            {result.success && mode === 'attendance' && result.student && (
              <Card style={{ marginBottom: 20, textAlign: 'left' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <User size={20} />
                    <div>
                      <Text strong>Student: </Text>
                      <Text>{result.student.name || 'Unknown'}</Text>
                    </div>
                  </Space>
                  {result.confidence && (
                    <div>
                      <Text strong>Confidence: </Text>
                      <Text>{(result.confidence * 100).toFixed(1)}%</Text>
                    </div>
                  )}
                </Space>
              </Card>
            )}

            <Space>
              <Button type="primary" onClick={resetCamera}>
                {mode === 'enrollment' ? 'Enroll Another' : 'Take Another'}
              </Button>
              <Button onClick={() => setStatus('ready')}>
                Back to Camera
              </Button>
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
};

export default FaceCamera;