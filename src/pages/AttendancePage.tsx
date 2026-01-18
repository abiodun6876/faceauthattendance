// pages/AttendancePage.tsx
import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Button, 
  message, 
  Modal,
  Statistic,
  Progress,
  Badge,
  Space,
  Tag,
  Spin
} from 'antd';
import { Camera, CheckCircle, XCircle, User, Clock, Users } from 'lucide-react';
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
  const [processing, setProcessing] = useState(false);
  const [bestMatch, setBestMatch] = useState<MatchResult | null>(null);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [showCamera, setShowCamera] = useState(true);

  // Load face recognition models
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('Loading face recognition models...');
        await faceRecognition.loadModels();
        setModelsLoaded(true);
        console.log('Face models loaded successfully');
        loadTodayCount();
      } catch (error) {
        console.error('Failed to load face models:', error);
      }
    };

    initialize();
  }, []);

  // Load today's attendance count
  const loadTodayCount = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', today);

      setPresentToday(count || 0);
    } catch (error) {
      console.error('Error loading count:', error);
    }
  };

  const handleAttendanceComplete = async (result: { success: boolean; photoData?: { base64: string } }) => {
    if (!result.success || !result.photoData) {
      message.error('Failed to capture photo');
      return;
    }

    if (!modelsLoaded) {
      message.error('Face recognition models not loaded yet');
      return;
    }

    setLoading(true);
    setProcessing(true);
    setScanCount(prev => prev + 1);
    setBestMatch(null);
    setShowCamera(false);

    try {
      console.log('Finding face matches...');
      
      const foundMatches = await faceRecognition.matchFaceForAttendance(result.photoData.base64);
      
      if (foundMatches.length === 0) {
        message.warning('No matching student found');
        setTimeout(() => {
          setProcessing(false);
          setLoading(false);
          setShowCamera(true);
        }, 2000);
        return;
      }

      // Get the best match
      const topMatch = foundMatches[0];
      setBestMatch(topMatch);
      
      // Auto-mark attendance if confidence > 70%
      if (topMatch.confidence > 0.7) {
        await autoMarkAttendance(topMatch);
      } else {
        // Show manual confirmation for lower confidence
        setProcessing(false);
        setLoading(false);
      }
      
    } catch (error: any) {
      console.error('Error:', error);
      message.error('Recognition error');
      setProcessing(false);
      setLoading(false);
      setShowCamera(true);
    }
  };

  const autoMarkAttendance = async (match: MatchResult) => {
    try {
      const now = new Date();
      const attendanceDate = now.toISOString().split('T')[0];
      const attendanceTime = now.toTimeString().split(' ')[0];
      
      // Check if already marked today
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('matric_number', match.matric_number)
        .eq('date', attendanceDate)
        .maybeSingle();

      if (existingAttendance) {
        message.warning(`${match.name} already marked today`);
        setAttendanceMarked(true);
        setTimeout(() => resetToCamera(), 3000);
        return;
      }

      // Mark attendance
      const { error } = await supabase
        .from('attendance')
        .insert([{
          student_id: match.studentId,
          matric_number: match.matric_number,
          name: match.name,
          date: attendanceDate,
          time: attendanceTime,
          status: 'present',
          method: 'face_recognition',
          confidence: match.confidence,
          created_at: now.toISOString()
        }]);

      if (error) throw error;

      message.success(`✅ ${match.name}`);
      setAttendanceMarked(true);
      setPresentToday(prev => prev + 1);
      
      setTimeout(() => resetToCamera(), 3000);
      
    } catch (error: any) {
      console.error('Error marking attendance:', error);
      message.error('Failed to mark attendance');
      resetToCamera();
    }
  };

  const resetToCamera = () => {
    setBestMatch(null);
    setAttendanceMarked(false);
    setProcessing(false);
    setLoading(false);
    setShowCamera(true);
  };

  const manualConfirmAttendance = async () => {
    if (!bestMatch) return;
    setProcessing(true);
    await autoMarkAttendance(bestMatch);
  };

  // Get current time
  const currentTime = new Date().toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#0a0e17',
      color: 'white',
      padding: 0,
      margin: 0
    }}>
      {/* Full Screen Camera View */}
      {showCamera && (
        <div style={{ 
          height: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{ 
            padding: '16px 24px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                backgroundColor: '#1890ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Camera size={20} color="white" />
              </div>
              <div>
                <Title level={4} style={{ margin: 0, color: 'white' }}>ABUAD FACE AUTH</Title>
                <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 12 }}>
                  AFE Babalola University
                </Text>
              </div>
            </div>
            
            <Space size="large">
              <div style={{ textAlign: 'center' }}>
                <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 12 }}>PRESENT TODAY</Text>
                <Title level={3} style={{ margin: 0, color: '#52c41a' }}>{presentToday}</Title>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 12 }}>SCANS</Text>
                <Title level={3} style={{ margin: 0, color: '#1890ff' }}>{scanCount}</Title>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Clock size={20} color="rgba(255, 255, 255, 0.7)" />
                <Text style={{ color: 'rgba(255, 255, 255, 0.7)', marginLeft: 4 }}>{currentTime}</Text>
              </div>
            </Space>
          </div>

          {/* Camera Area */}
          <div style={{ 
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Camera Preview */}
            <div style={{ 
              width: '100%',
              height: '100%',
              position: 'relative'
            }}>
              <FaceCamera
                mode="attendance"
                onAttendanceComplete={handleAttendanceComplete}
                autoCapture={true}
                captureInterval={2000}
                loading={loading}
              />
              
              {/* Overlay Guides */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}>
                {/* Face Guide Circle */}
                <div style={{
                  width: 300,
                  height: 300,
                  borderRadius: '50%',
                  border: '2px dashed rgba(255, 255, 255, 0.3)',
                  position: 'relative'
                }}>
                  {/* Scan Animation */}
                  {loading && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center'
                    }}>
                      <Spin size="large" style={{ color: '#1890ff' }} />
                      <Text style={{ 
                        color: 'white', 
                        marginTop: 16,
                        fontSize: 18,
                        fontWeight: 'bold'
                      }}>
                        SCANNING...
                      </Text>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Indicators */}
              <div style={{
                position: 'absolute',
                bottom: 40,
                left: 0,
                right: 0,
                textAlign: 'center'
              }}>
                <Space direction="vertical" size="small">
                  <Badge 
                    status={modelsLoaded ? "success" : "processing"} 
                    text={
                      <Text style={{ color: 'white' }}>
                        {modelsLoaded ? "READY" : "INITIALIZING..."}
                      </Text>
                    } 
                  />
                  <Tag color="blue" style={{ fontSize: 12, border: 'none' }}>
                    AUTO-SCAN: {scanCount}
                  </Tag>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 }}>
                    Position face within the circle
                  </Text>
                </Space>
              </div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div style={{ 
            padding: '16px 24px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                J-SCAN: <Tag color="green" style={{ marginLeft: 4 }}>ON</Tag>
              </Text>
            </div>
            
            <Space>
              <Button
                type="primary"
                onClick={() => window.location.href = '/enrollment'}
                icon={<User size={16} />}
              >
                Enroll Student
              </Button>
              <Button
                onClick={async () => {
                  const today = new Date().toISOString().split('T')[0];
                  const { data: todayAttendance } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('date', today)
                    .order('time', { ascending: false });
                  
                  Modal.info({
                    title: `Today's Attendance (${todayAttendance?.length || 0})`,
                    width: 600,
                    content: (
                      <div style={{ maxHeight: 400, overflow: 'auto' }}>
                        {todayAttendance?.map((record, index) => (
                          <div key={index} style={{ 
                            padding: '12px',
                            borderBottom: '1px solid #f0f0f0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12
                          }}>
                            <div style={{ 
                              width: 32, 
                              height: 32, 
                              borderRadius: '50%', 
                              backgroundColor: '#1890ff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: 'bold'
                            }}>
                              {record.name.charAt(0)}
                            </div>
                            <div style={{ flex: 1 }}>
                              <Text strong>{record.name}</Text>
                              <div style={{ fontSize: 12, color: '#666' }}>
                                {record.matric_number} • {record.time}
                              </div>
                            </div>
                            <Tag color="success">Present</Tag>
                          </div>
                        ))}
                      </div>
                    ),
                  });
                }}
                icon={<Users size={16} />}
              >
                View Attendance
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* Processing/Results View */}
      {!showCamera && (
        <div style={{ 
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24
        }}>
          {processing ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: 200, 
                height: 200, 
                position: 'relative',
                margin: '0 auto 32px'
              }}>
                <Progress
                  type="circle"
                  percent={75}
                  strokeColor={{
                    '0%': '#1890ff',
                    '100%': '#52c41a',
                  }}
                  size={200}
                  strokeWidth={8}
                  format={() => (
                    <div style={{ fontSize: 32, color: '#1890ff' }}>
                      <Camera size={40} />
                    </div>
                  )}
                />
              </div>
              <Title level={2} style={{ color: 'white', marginBottom: 16 }}>
                PROCESSING...
              </Title>
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 16 }}>
                Recognizing face features
              </Text>
            </div>
          ) : attendanceMarked ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: 150, 
                height: 150, 
                borderRadius: '50%', 
                backgroundColor: '#52c41a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 32px',
                boxShadow: '0 0 40px rgba(82, 196, 26, 0.5)'
              }}>
                <CheckCircle size={80} color="white" />
              </div>
              <Title level={2} style={{ color: '#52c41a', marginBottom: 8 }}>
                ATTENDANCE MARKED!
              </Title>
              {bestMatch && (
                <>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 20, marginBottom: 4 }}>
                    {bestMatch.name}
                  </Text>
                  <Tag color="blue" style={{ fontSize: 16, padding: '8px 16px', marginBottom: 24 }}>
                    {bestMatch.matric_number}
                  </Tag>
                </>
              )}
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 16 }}>
                Next scan in 3 seconds...
              </Text>
            </div>
          ) : bestMatch ? (
            <div style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 20,
              padding: 40,
              maxWidth: 500,
              textAlign: 'center',
              backdropFilter: 'blur(10px)'
            }}>
              {/* Confidence Meter */}
              <div style={{ marginBottom: 32 }}>
                <Text style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: 12, display: 'block' }}>
                  RECOGNITION CONFIDENCE
                </Text>
                <Progress
                  percent={bestMatch.confidence * 100}
                  strokeColor={bestMatch.confidence > 0.8 ? '#52c41a' : '#faad14'}
                  format={percent => (
                    <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>
                      {percent?.toFixed(0)}%
                    </Text>
                  )}
                  size={['100%', 30]}
                  style={{ marginBottom: 8 }}
                />
                <Text style={{ color: bestMatch.confidence > 0.8 ? '#52c41a' : '#faad14' }}>
                  {bestMatch.confidence > 0.8 ? "High Confidence" : "Verify Identity"}
                </Text>
              </div>

              {/* Student Card */}
              <div style={{ 
                backgroundColor: 'rgba(24, 144, 255, 0.1)',
                borderRadius: 12,
                padding: 24,
                marginBottom: 32,
                border: '1px solid rgba(24, 144, 255, 0.3)'
              }}>
                <div style={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                  backgroundColor: '#1890ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: 'white',
                  fontSize: 32,
                  fontWeight: 'bold'
                }}>
                  {bestMatch.name.charAt(0)}
                </div>
                
                <Title level={3} style={{ color: 'white', marginBottom: 8 }}>
                  {bestMatch.name}
                </Title>
                
                <Tag color="blue" style={{ fontSize: 16, padding: '8px 16px' }}>
                  {bestMatch.matric_number}
                </Tag>
              </div>

              {/* Action Buttons */}
              <Space size="large" style={{ width: '100%', justifyContent: 'center' }}>
                <Button
                  size="large"
                  onClick={resetToCamera}
                  style={{ 
                    height: 50, 
                    padding: '0 32px',
                    backgroundColor: 'transparent',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    color: 'white'
                  }}
                >
                  Scan Again
                </Button>
                <Button
                  type="primary"
                  size="large"
                  onClick={manualConfirmAttendance}
                  icon={<CheckCircle size={20} />}
                  style={{ height: 50, padding: '0 32px' }}
                  loading={processing}
                >
                  Confirm Attendance
                </Button>
              </Space>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: 150, 
                height: 150, 
                borderRadius: '50%', 
                backgroundColor: '#ff4d4f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 32px'
              }}>
                <XCircle size={80} color="white" />
              </div>
              <Title level={2} style={{ color: '#ff4d4f', marginBottom: 16 }}>
                NO MATCH FOUND
              </Title>
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 16, marginBottom: 32 }}>
                Face not recognized in database
              </Text>
              <Space>
                <Button
                  type="primary"
                  size="large"
                  onClick={resetToCamera}
                  icon={<Camera size={20} />}
                >
                  Try Again
                </Button>
                <Button
                  size="large"
                  onClick={() => window.location.href = '/enrollment'}
                  icon={<User size={20} />}
                  style={{ 
                    backgroundColor: 'transparent',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    color: 'white'
                  }}
                >
                  Enroll Student
                </Button>
              </Space>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendancePage;