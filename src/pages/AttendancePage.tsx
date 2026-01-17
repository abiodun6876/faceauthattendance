// pages/AttendancePage.tsx
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Typography, 
  Button, 
  message, 
  Row, 
  Col, 
  Tag, 
  Spin,
  List,
  Avatar,
  Space,
  Alert,
  Modal
} from 'antd';
import { Camera, Users, Clock, UserCheck, AlertCircle } from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import faceRecognition from '../utils/faceRecognition';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;

interface MatchResult {
  studentId: string;
  name: string;
  matric_number: string;
  confidence: number;
}

const AttendancePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [captureMode, setCaptureMode] = useState<'manual' | 'auto'>('manual');

  // Load face recognition models on component mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('Loading face recognition models for attendance...');
        await faceRecognition.loadModels();
        setModelsLoaded(true);
        console.log('Face models loaded successfully');
      } catch (error) {
        console.error('Failed to load face models:', error);
        message.warning('Face recognition models not loaded. Attendance may not work properly.');
      }
    };

    loadModels();
  }, []);

  const handleAttendanceComplete = async (result: { success: boolean; photoData?: { base64: string } }) => {
    if (!result.success || !result.photoData) {
      message.error('Failed to capture photo');
      return;
    }

    // Check if models are loaded
    if (!modelsLoaded) {
      message.error('Face recognition models not loaded yet. Please wait...');
      return;
    }

    setLoading(true);
    setCurrentPhoto(result.photoData.base64);
    setMatches([]); // Clear previous matches
    
    try {
      console.log('Finding face matches...');
      
      // Check if there's a face in the image first
      const faceDescriptor = await faceRecognition.extractFaceDescriptor(result.photoData.base64);
      
      if (!faceDescriptor) {
        message.warning('No face detected in the image. Please try again.');
        setLoading(false);
        return;
      }

      console.log('Face detected, searching for matches...');
      const foundMatches = await faceRecognition.matchFaceForAttendance(result.photoData.base64);
      
      console.log('Matches found:', foundMatches);
      setMatches(foundMatches);
      
      if (foundMatches.length === 0) {
        message.warning('No matching student found. Try again or enroll the student.');
      } else {
        message.success(`Found ${foundMatches.length} potential match(es)`);
      }
    } catch (error: any) {
      console.error('Error matching face:', error);
      message.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (studentId: string, studentName: string, matricNumber: string) => {
    try {
      setLoading(true);
      
      // 1. Get current date and time
      const now = new Date();
      const attendanceDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const attendanceTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
      
      // 2. Save attendance to database
      const { data, error } = await supabase
        .from('attendance')
        .insert([{
          student_id: studentId,
          matric_number: matricNumber,
          name: studentName,
          date: attendanceDate,
          time: attendanceTime,
          status: 'present',
          method: 'face_recognition',
          confidence: matches.find(m => m.studentId === studentId)?.confidence || 0
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      message.success(`Attendance marked for ${studentName} at ${attendanceTime}`);
      setAttendanceMarked(true);
      
      // 3. Reset after 3 seconds
      setTimeout(() => {
        setMatches([]);
        setAttendanceMarked(false);
        setCurrentPhoto(null);
        setLoading(false);
      }, 3000);
      
    } catch (error: any) {
      console.error('Error marking attendance:', error);
      message.error(`Failed to mark attendance: ${error.message}`);
      setLoading(false);
    }
  };

  const retryCapture = () => {
    setMatches([]);
    setCurrentPhoto(null);
    message.info('Ready for new capture');
  };

  const showMatchDetails = (match: MatchResult) => {
    Modal.info({
      title: 'Match Details',
      content: (
        <div>
          <p><strong>Name:</strong> {match.name}</p>
          <p><strong>Matric Number:</strong> {match.matric_number}</p>
          <p><strong>Confidence:</strong> {(match.confidence * 100).toFixed(1)}%</p>
          <p><strong>Status:</strong> {match.confidence > 0.8 ? 'High Confidence' : 'Medium Confidence'}</p>
        </div>
      ),
    });
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8
          }}>
            <UserCheck size={32} color="#52c41a" />
            <Title level={3} style={{ margin: 0 }}>
              Attendance System
            </Title>
          </div>
          <Text type="secondary">
            AFE Babalola University - Face Recognition Attendance
          </Text>
          
          {!modelsLoaded && (
            <Alert
              message="Loading face recognition models..."
              type="warning"
              showIcon
              style={{ marginTop: 16, maxWidth: 500, margin: '16px auto 0' }}
            />
          )}
        </div>

        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Card 
              title={
                <Space>
                  <Camera size={20} />
                  <span>Face Capture</span>
                  <Tag color={modelsLoaded ? "success" : "warning"}>
                    {modelsLoaded ? "Ready" : "Loading..."}
                  </Tag>
                </Space>
              }
              style={{ height: '100%' }}
              extra={
                <Space>
                  <Button 
                    size="small" 
                    type={captureMode === 'manual' ? 'primary' : 'default'}
                    onClick={() => setCaptureMode('manual')}
                  >
                    Manual
                  </Button>
                  <Button 
                    size="small"
                    type={captureMode === 'auto' ? 'primary' : 'default'}
                    onClick={() => setCaptureMode('auto')}
                  >
                    Auto
                  </Button>
                </Space>
              }
            >
              <div style={{ height: 400, borderRadius: 8, overflow: 'hidden' }}>
                <FaceCamera
                  mode="attendance"
                  onAttendanceComplete={handleAttendanceComplete}
                  autoCapture={captureMode === 'auto'}
                  captureInterval={5000}
                  loading={loading}
                />
              </div>
              
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Text type="secondary">
                  {captureMode === 'auto' 
                    ? 'Auto-capture every 5 seconds' 
                    : 'Click the camera button to capture'}
                </Text>
                
                {currentPhoto && !loading && (
                  <div style={{ marginTop: 8 }}>
                    <Button 
                      size="small" 
                      onClick={retryCapture}
                    >
                      Capture Again
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </Col>
          
          <Col xs={24} md={12}>
            <Card 
              title={
                <Space>
                  <Users size={20} />
                  <span>Recognition Results</span>
                  {matches.length > 0 && (
                    <Tag color="blue">{matches.length} match(es)</Tag>
                  )}
                </Space>
              }
              style={{ height: '100%' }}
              extra={
                matches.length > 0 && (
                  <Button 
                    size="small" 
                    onClick={retryCapture}
                    disabled={attendanceMarked}
                  >
                    Clear Results
                  </Button>
                )
              }
            >
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Spin size="large" />
                  <Text style={{ display: 'block', marginTop: 16 }}>
                    Processing face recognition...
                  </Text>
                </div>
              ) : matches.length > 0 ? (
                <div>
                  <Alert
                    message={
                      <Space>
                        <AlertCircle size={16} />
                        <span>Select the correct student to mark attendance</span>
                      </Space>
                    }
                    type="info"
                    showIcon={false}
                    style={{ marginBottom: 16 }}
                  />
                  
                  <List
                    dataSource={matches}
                    renderItem={(match, index) => (
                      <List.Item
                        key={match.studentId}
                        actions={[
                          <Space direction="vertical" size="small">
                            <Button
                              type="primary"
                              onClick={() => markAttendance(match.studentId, match.name, match.matric_number)}
                              disabled={attendanceMarked}
                              loading={loading}
                            >
                              Mark Attendance
                            </Button>
                            <Button
                              size="small"
                              onClick={() => showMatchDetails(match)}
                            >
                              Details
                            </Button>
                          </Space>
                        ]}
                      >
                        <List.Item.Meta
                          avatar={
                            <Avatar 
                              size="large"
                              style={{ 
                                backgroundColor: index === 0 ? '#1890ff' : '#d9d9d9',
                                color: 'white',
                                cursor: 'pointer'
                              }}
                              onClick={() => showMatchDetails(match)}
                            >
                              {match.name.charAt(0)}
                            </Avatar>
                          }
                          title={
                            <Space>
                              <Text strong style={{ cursor: 'pointer' }} onClick={() => showMatchDetails(match)}>
                                {match.name}
                              </Text>
                              <Tag color={index === 0 ? "green" : "default"}>
                                {index === 0 ? "Best Match" : "Alternative"}
                              </Tag>
                            </Space>
                          }
                          description={
                            <>
                              <div>
                                <Text strong>Matric: </Text>
                                <Tag color="blue">{match.matric_number}</Tag>
                              </div>
                              <div style={{ marginTop: 4 }}>
                                <Text strong>Confidence: </Text>
                                <Tag color={
                                  match.confidence > 0.8 ? "success" : 
                                  match.confidence > 0.65 ? "warning" : "default"
                                }>
                                  {(match.confidence * 100).toFixed(1)}%
                                </Tag>
                                <Text type="secondary" style={{ marginLeft: 8 }}>
                                  {match.confidence > 0.8 ? 'High' : 
                                   match.confidence > 0.65 ? 'Medium' : 'Low'}
                                </Text>
                              </div>
                            </>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </div>
              ) : currentPhoto && !loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
                  <Title level={4}>No Match Found</Title>
                  <Text type="secondary" style={{ marginBottom: 24 }}>
                    The face was not recognized in our database.
                  </Text>
                  <Space>
                    <Button onClick={retryCapture}>
                      Try Again
                    </Button>
                    <Button type="dashed" onClick={() => window.location.href = '/enrollment'}>
                      Enroll Student
                    </Button>
                  </Space>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
                  <Title level={4}>Ready for Attendance</Title>
                  <Text type="secondary" style={{ marginBottom: 24 }}>
                    {modelsLoaded 
                      ? 'Capture a photo to begin face recognition' 
                      : 'Waiting for face recognition models to load...'}
                  </Text>
                  {!modelsLoaded && (
                    <Spin size="large" style={{ marginBottom: 16 }} />
                  )}
                </div>
              )}
            </Card>
          </Col>
        </Row>
        
        {/* Status Footer */}
        <div style={{ 
          marginTop: 24, 
          padding: 16, 
          backgroundColor: '#fafafa', 
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <Text type="secondary">System Status: </Text>
            <Tag color={modelsLoaded ? "success" : "processing"}>
              {modelsLoaded ? "Face Recognition Ready" : "Loading Models..."}
            </Tag>
          </div>
          <div>
            <Button 
              type="link" 
              onClick={() => window.location.href = '/enrollment'}
            >
              Go to Enrollment
            </Button>
            <Button 
              type="link" 
              onClick={() => {
                const status = faceRecognition.getStatus();
                console.log('Face recognition status:', status);
                Modal.info({
                  title: 'System Status',
                  content: (
                    <div>
                      <p><strong>Models Loaded:</strong> {status.modelsLoaded ? 'Yes' : 'No'}</p>
                      <p><strong>Backend:</strong> {status.backend}</p>
                      <p><strong>WebGL Support:</strong> {status.hasWebGL ? 'Yes' : 'No'}</p>
                      <p><strong>Local Embeddings:</strong> {status.localEmbeddingsCount}</p>
                    </div>
                  ),
                });
              }}
            >
              View Details
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AttendancePage;