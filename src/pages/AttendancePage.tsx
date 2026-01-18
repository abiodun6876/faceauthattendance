// pages/AttendancePage.tsx
import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Button, 
  message, 
  Progress,
  Badge,
  Space,
  Tag,
  Spin,
  Alert
} from 'antd';
import { Camera, CheckCircle, XCircle, Play, StopCircle, Home } from 'lucide-react';
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
  const [showCamera, setShowCamera] = useState(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // Load face recognition models
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('Loading face recognition models...');
        setShowCamera(false);
        
        await faceRecognition.loadModels();
        
        setModelsLoaded(true);
        console.log('Face models loaded successfully');
        
        setShowCamera(true);
        loadTodayCount();
      } catch (error) {
        console.error('Failed to load face models:', error);
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
    if (!autoScanEnabled) {
      return;
    }

    if (!result.success || !result.photoData) {
      message.error('Failed to capture photo');
      return;
    }

    if (!modelsLoaded) {
      message.error('Face recognition models not loaded yet');
      return;
    }

    setIsScanning(true);
    setLoading(true);
    setProcessing(true);
    setScanCount(prev => prev + 1);
    setBestMatch(null);
    setShowCamera(false);

    try {
      const faceDescriptor = await faceRecognition.extractFaceDescriptor(result.photoData.base64);
      
      if (!faceDescriptor) {
        message.warning('No face detected');
        setTimeout(() => {
          setProcessing(false);
          setLoading(false);
          setIsScanning(false);
          setShowCamera(true);
        }, 2000);
        return;
      }

      const foundMatches = await faceRecognition.matchFaceForAttendance(result.photoData.base64);
      
      if (foundMatches.length === 0) {
        message.warning('No matching student found');
        setTimeout(() => {
          setProcessing(false);
          setLoading(false);
          setIsScanning(false);
          setShowCamera(true);
        }, 2000);
        return;
      }

      const topMatch = foundMatches[0];
      setBestMatch(topMatch);
      
      if (topMatch.confidence > 0.7) {
        await autoMarkAttendance(topMatch);
      } else {
        setProcessing(false);
        setLoading(false);
        setIsScanning(false);
      }
      
    } catch (error: any) {
      console.error('Error:', error);
      message.error(`Error: ${error.message}`);
      setProcessing(false);
      setLoading(false);
      setIsScanning(false);
      setShowCamera(true);
    }
  };

  const autoMarkAttendance = async (match: MatchResult) => {
    try {
      const now = new Date();
      const attendanceDate = now.toISOString().split('T')[0];
      const attendanceTime = now.toTimeString().split(' ')[0];
      
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
      message.error(`Failed to mark attendance: ${error.message}`);
      resetToCamera();
    }
  };

  const resetToCamera = () => {
    setBestMatch(null);
    setAttendanceMarked(false);
    setProcessing(false);
    setLoading(false);
    setIsScanning(false);
    setShowCamera(true);
  };

  // Toggle auto-scan
  const toggleAutoScan = () => {
    const newState = !autoScanEnabled;
    setAutoScanEnabled(newState);
    setIsScanning(false);
    message.info(`Auto-scan ${newState ? 'enabled' : 'disabled'}`);
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
      {/* Loading Screen */}
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
            <Title level={3} style={{ color: 'white', marginBottom: 16 }}>
              Loading Face Recognition...
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 }}>
              Initializing system
            </Text>
          </div>
        </div>
      )}

      {/* Camera View */}
      {showCamera && modelsLoaded && (
        <div style={{ 
          height: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Top Bar - Minimal */}
          <div style={{ 
            padding: '12px 20px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {/* Left - Back Button */}
            <Button
              type="text"
              icon={<Home size={18} />}
              onClick={() => window.location.href = '/'}
              style={{ 
                color: 'white',
                padding: '4px 8px',
                minWidth: 'auto'
              }}
            />

            {/* Center - Time and Attendance Count */}
            <Space size="large" style={{ alignItems: 'center' }}>
              {/* Time Display */}
              <div style={{ textAlign: 'center' }}>
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  fontSize: 11,
                  fontWeight: '500',
                  display: 'block'
                }}>
                  TIME
                </Text>
                <Text style={{ 
                  color: 'white', 
                  fontSize: 16,
                  fontWeight: 'bold'
                }}>
                  {currentTime}
                </Text>
              </div>

              {/* Attendance Counter Circle */}
              <div style={{ 
                width: 70,
                height: 70,
                borderRadius: '50%',
                backgroundColor: 'rgba(82, 196, 26, 0.2)',
                border: '2px solid #52c41a',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}>
                <Text style={{ 
                  color: '#52c41a', 
                  fontSize: 22,
                  fontWeight: 'bold',
                  lineHeight: '24px'
                }}>
                  {presentToday}
                </Text>
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.6)', 
                  fontSize: 10,
                  marginTop: 2
                }}>
                  PRESENT
                </Text>
              </div>

              {/* Scan Counter Circle */}
              <div style={{ 
                width: 60,
                height: 60,
                borderRadius: '50%',
                backgroundColor: 'rgba(24, 144, 255, 0.2)',
                border: '2px solid #1890ff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}>
                <Text style={{ 
                  color: '#1890ff', 
                  fontSize: 18,
                  fontWeight: 'bold',
                  lineHeight: '20px'
                }}>
                  {scanCount}
                </Text>
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.6)', 
                  fontSize: 9,
                  marginTop: 2
                }}>
                  SCANS
                </Text>
              </div>
            </Space>

            {/* Right - Status Indicator */}
            <Badge 
              status={autoScanEnabled ? "success" : "warning"}
              text={
                <Text style={{ 
                  color: autoScanEnabled ? '#52c41a' : '#faad14',
                  fontSize: 12,
                  fontWeight: 'bold'
                }}>
                  {autoScanEnabled ? "ACTIVE" : "PAUSED"}
                </Text>
              } 
            />
          </div>

          {/* Main Camera Area */}
          <div style={{ 
            flex: 1,
            position: 'relative',
            backgroundColor: '#000',
            overflow: 'hidden'
          }}>
            <FaceCamera
              mode="attendance"
              onAttendanceComplete={handleAttendanceComplete}
              autoCapture={autoScanEnabled}
              captureInterval={2000}
              loading={loading}
            />
            
            {/* Face Guide Circle */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 280,
              height: 280,
              borderRadius: '50%',
              border: '2px dashed rgba(255, 255, 255, 0.3)',
              pointerEvents: 'none',
              boxShadow: '0 0 0 1000px rgba(0, 0, 0, 0.3)'
            }}>
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
                    fontSize: 14,
                    fontWeight: 'bold'
                  }}>
                    SCANNING...
                  </Text>
                </div>
              )}
            </div>

            {/* Bottom Status Bar */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: '12px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {/* Left - Camera Status */}
              <Space>
                <Tag color={autoScanEnabled ? "green" : "red"} style={{ margin: 0, fontSize: 11 }}>
                  CAM: {autoScanEnabled ? "ON" : "OFF"}
                </Tag>
                <Tag color={autoScanEnabled ? "green" : "red"} style={{ margin: 0, fontSize: 11 }}>
                  AUTO: {autoScanEnabled ? "ON" : "OFF"}
                </Tag>
              </Space>

              {/* Center - Instruction */}
              <Text style={{ 
                color: 'rgba(255, 255, 255, 0.7)', 
                fontSize: 13,
                fontWeight: '500'
              }}>
                {autoScanEnabled ? "Position face in circle" : "Auto-scan paused"}
              </Text>

              {/* Right - Control Buttons */}
              <Space>
                {autoScanEnabled ? (
                  <Button
                    type="primary"
                    danger
                    onClick={toggleAutoScan}
                    icon={<StopCircle size={14} />}
                    size="small"
                    style={{ 
                      padding: '4px 12px',
                      fontSize: 12,
                      height: 'auto'
                    }}
                  >
                    STOP
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    onClick={toggleAutoScan}
                    icon={<Play size={14} />}
                    size="small"
                    style={{ 
                      padding: '4px 12px',
                      fontSize: 12,
                      height: 'auto'
                    }}
                  >
                    START
                  </Button>
                )}
              </Space>
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
          padding: 20,
          backgroundColor: '#0a0e17'
        }}>
          {processing ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: 160, 
                height: 160, 
                position: 'relative',
                margin: '0 auto 24px'
              }}>
                <Progress
                  type="circle"
                  percent={75}
                  strokeColor={{
                    '0%': '#1890ff',
                    '100%': '#52c41a',
                  }}
                  size={160}
                  strokeWidth={6}
                  format={() => (
                    <div style={{ fontSize: 28, color: '#1890ff' }}>
                      <Camera size={32} />
                    </div>
                  )}
                />
              </div>
              <Title level={3} style={{ color: 'white', marginBottom: 12 }}>
                PROCESSING...
              </Title>
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 }}>
                Recognizing face
              </Text>
            </div>
          ) : attendanceMarked ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: 120, 
                height: 120, 
                borderRadius: '50%', 
                backgroundColor: '#52c41a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                boxShadow: '0 0 30px rgba(82, 196, 26, 0.4)'
              }}>
                <CheckCircle size={60} color="white" />
              </div>
              <Title level={3} style={{ color: '#52c41a', marginBottom: 8 }}>
                SUCCESS
              </Title>
              {bestMatch && (
                <>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 18, marginBottom: 4 }}>
                    {bestMatch.name}
                  </Text>
                  <Tag color="blue" style={{ fontSize: 14, padding: '6px 12px', marginBottom: 16 }}>
                    {bestMatch.matric_number}
                  </Tag>
                </>
              )}
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 }}>
                Returning in 3 seconds...
              </Text>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: 120, 
                height: 120, 
                borderRadius: '50%', 
                backgroundColor: '#ff4d4f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <XCircle size={60} color="white" />
              </div>
              <Title level={3} style={{ color: '#ff4d4f', marginBottom: 12 }}>
                NO MATCH
              </Title>
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14, marginBottom: 24 }}>
                Face not recognized
              </Text>
              
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendancePage;