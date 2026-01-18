// pages/AttendancePage.tsx
import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Button, 
  message, 
  Modal,
  Progress,
  Badge,
  Space,
  Tag,
  Spin,
  Alert
} from 'antd';
import { Camera, CheckCircle, XCircle, User, Clock, Users, AlertCircle } from 'lucide-react';
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
  const [showCamera, setShowCamera] = useState(false); // Start false until models load
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);

  // Load face recognition models on component mount - Using your working logic
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('🔄 Loading face recognition models for attendance...');
        setShowCamera(false); // Hide camera while loading
        
        await faceRecognition.loadModels();
        
        setModelsLoaded(true);
        console.log('✅ Face models loaded successfully');
        
        // Only show camera after models are loaded
        setShowCamera(true);
        
        // Load today's attendance count
        loadTodayCount();
      } catch (error) {
        console.error('❌ Failed to load face models:', error);
        message.warning('Face recognition models not loaded. Attendance may not work properly.');
      }
    };

    loadModels();
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

    // Check if models are loaded - Using your check
    if (!modelsLoaded) {
      message.error('Face recognition models not loaded yet. Please wait...');
      return;
    }

    setLoading(true);
    setProcessing(true);
    setScanCount(prev => prev + 1);
    setBestMatch(null);
    setCurrentPhoto(result.photoData.base64);
    setShowCamera(false); // Hide camera while processing

    try {
      console.log('🔍 Finding face matches...');
      
      // Check if there's a face in the image first - Using your logic
      const faceDescriptor = await faceRecognition.extractFaceDescriptor(result.photoData.base64);
      
      if (!faceDescriptor) {
        message.warning('No face detected in the image. Please try again.');
        setTimeout(() => {
          setProcessing(false);
          setLoading(false);
          setShowCamera(true);
        }, 2000);
        return;
      }

      console.log('👤 Face detected, searching for matches...');
      const foundMatches = await faceRecognition.matchFaceForAttendance(result.photoData.base64);
      
      console.log('✅ Matches found:', foundMatches);
      
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
      console.error('❌ Error:', error);
      message.error(`Error: ${error.message}`);
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
      
      // Check if already marked today - Using your logic
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('matric_number', match.matric_number)
        .eq('date', attendanceDate)
        .maybeSingle();

      if (existingAttendance) {
        message.warning(`${match.name} already marked today at ${existingAttendance.time}`);
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

      message.success(`✅ Attendance marked for ${match.name} at ${attendanceTime}`);
      setAttendanceMarked(true);
      setPresentToday(prev => prev + 1);
      
      setTimeout(() => resetToCamera(), 3000);
      
    } catch (error: any) {
      console.error('Error marking attendance:', error);
      message.error(`Failed to mark attendance: ${error.message}`);
      resetToCamera();
    }
  };

  const resetToCamera = () => {
    setBestMatch(null);
    setAttendanceMarked(false);
    setProcessing(false);
    setLoading(false);
    setCurrentPhoto(null);
    setShowCamera(true); // Show camera again
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
      {/* Show loading screen until models are loaded */}
      {!modelsLoaded && (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0e17'
        }}>
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" style={{ marginBottom: 24, color: '#1890ff' }} />
            <Title level={2} style={{ color: 'white', marginBottom: 16 }}>
              Loading Face Recognition Models...
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 16 }}>
              Please wait while we initialize the face recognition system
            </Text>
            <Alert
              message="Face recognition models not loaded yet"
              type="warning"
              showIcon
              style={{ 
                marginTop: 24, 
                maxWidth: 400,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }}
            />
          </div>
        </div>
      )}

      {/* Full Screen Camera View - Only show after models are loaded */}
      {showCamera && modelsLoaded && (
        <div style={{ 
          height: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{ 
            padding: '16px 24px',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            zIndex: 10,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {/* Left side - Logo and Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '8px', 
                backgroundColor: '#1890ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Camera size={20} color="white" />
              </div>
              
            </div>
            
            {/* Right side - Stats */}
            <Space size="large" style={{ alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  fontSize: 12,
                  fontWeight: '500',
                  display: 'block',
                  marginBottom: 4
                }}>
                  PRESENT
                </Text>
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  fontSize: 12,
                  fontWeight: '500',
                  display: 'block'
                }}>
                  TODAY
                </Text>
                <Title level={2} style={{ margin: '4px 0 0 0', color: '#52c41a' }}>{presentToday}</Title>
              </div>
              
              
              
              <div style={{ textAlign: 'center', minWidth: 60 }}>
                <Clock size={16} color="rgba(255, 255, 255, 0.7)" style={{ marginBottom: 4 }} />
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  fontSize: 14,
                  fontWeight: '500'
                }}>
                  {currentTime}
                </Text>
              </div>
            </Space>
          </div>

          {/* Main Camera Area */}
          <div style={{ 
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000'
          }}>
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

              {/* Status Bar at Bottom */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {/* Left side - Mode Info */}
                <div>
                  
                  <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14, marginLeft: 16 }}>
                    Camera: <Tag color="green" style={{ marginLeft: 4 }}>Active</Tag>
                  </Text>
                </div>
                
                {/* Center - Status Message */}
                <div style={{ textAlign: 'center' }}>
                  <Space direction="vertical" size="small">
                    <Badge 
                      status="success"
                      text={
                        <Text style={{ 
                          color: '#52c41a',
                          fontSize: 16,
                          fontWeight: 'bold'
                        }}>
                          READY
                        </Text>
                      } 
                    />
                   
                  </Space>
                </div>
                
                
              </div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div style={{ 
            padding: '16px 24px',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div>
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                J-SCAN: <Tag color="green" style={{ marginLeft: 4 }}>ON</Tag>
              </Text>
            </div>
            
           
          </div>
        </div>
      )}

      {/* Processing/Results View */}
      {!showCamera && modelsLoaded && (
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
                Recognizing student 
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
               
                
              </Space>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendancePage;