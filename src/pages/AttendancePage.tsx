// pages/AttendancePage.tsx - Fixed version
import React, { useState, useEffect } from 'react';
import { 
  Select, 
  Button, 
  Typography, 
  Space, 
  Card, 
  message, 
  Steps,
  Badge,
  Alert,
  Spin
} from 'antd';
import { 
  Camera, 
  CheckCircle, 
  XCircle,
  Clock,
  ArrowLeft,
  BookOpen
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import { 
  markAttendance, 
  AttendanceData,
  AttendanceResult 
} from '../utils/attendanceUtils';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const AttendancePage: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ 
    totalScans: 0, 
    successfulScans: 0,
    alreadyMarked: 0 
  });
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('code');
      
      if (error) throw error;
      setCourses(data || []);
    } catch (error: any) {
      message.error('Failed to load courses');
    }
  };

  const handleFaceCapture = async (photoData: string) => {
    if (!selectedCourse || loading) return;
    
    setLoading(true);
    setStats(prev => ({ ...prev, totalScans: prev.totalScans + 1 }));
    
    try {
      const attendanceData: AttendanceData = {
        course_code: selectedCourse.code,
        course_title: selectedCourse.title,
        level: selectedCourse.level
      };
      
      const markResult = await markAttendance(photoData, attendanceData);
      
      setResult(markResult);
      
      // TypeScript now understands the discriminated union
      if (markResult.success) {
        setStats(prev => ({ 
          ...prev, 
          successfulScans: prev.successfulScans + 1 
        }));
        message.success(`✅ Attendance marked for ${markResult.student.name}`);
        
        // Auto-clear result after 3 seconds
        setTimeout(() => {
          setResult(null);
        }, 3000);
      } else if (markResult.error?.includes('already marked')) {
        setStats(prev => ({ 
          ...prev, 
          alreadyMarked: prev.alreadyMarked + 1 
        }));
        
        if (markResult.student) {
          message.warning(`⚠️ ${markResult.student.name} already marked today`);
        } else {
          message.warning(`⚠️ Student already marked today`);
        }
      } else {
        message.warning(markResult.error || 'No matching student found');
      }
    } catch (error: any) {
      message.error(`❌ Error: ${error.message}`);
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const startScanning = () => {
    if (!selectedCourse) {
      message.warning('Please select a course first');
      return;
    }
    setScanning(true);
    setCurrentStep(1);
    setResult(null);
    message.info('🎬 Face scanning started');
  };

  const stopScanning = () => {
    setScanning(false);
    setCurrentStep(0);
    setResult(null);
    message.info('⏹️ Scanning stopped');
  };

  const debugDatabase = async () => {
    try {
      const { data: students } = await supabase
        .from('students_new')
        .select('matric_number, name, face_detected')
        .eq('enrollment_status', 'enrolled')
        .limit(5);
      
      console.log('📊 Students in database:', students);
      
      const { count } = await supabase
        .from('students_new')
        .select('*', { count: 'exact', head: true })
        .eq('enrollment_status', 'enrolled');
      
      message.info(`📋 Found ${count || 0} enrolled students`);
    } catch (error) {
      console.error('Debug error:', error);
    }
  };

  return (
    <div style={{ 
      padding: '20px',
      minHeight: '100vh',
      backgroundColor: '#f0f2f5'
    }}>
      <Card style={{ 
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ marginBottom: 8 }}>
            Face Recognition Attendance
          </Title>
          <Text type="secondary">
            AFE Babalola University - Automated Attendance System
          </Text>
        </div>

        <Steps 
          current={currentStep} 
          style={{ marginBottom: 32 }}
          items={[
            { title: 'Course Selection', icon: <BookOpen size={16} /> },
            { title: 'Face Scanning', icon: <Camera size={16} /> },
          ]}
        />

        {!scanning ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 32 }}>
              <Select
                style={{ width: '100%', maxWidth: 500 }}
                placeholder="📚 Select a course"
                size="large"
                showSearch
                optionFilterProp="label"
                onChange={(value) => {
                  const course = courses.find(c => c.id === value);
                  setSelectedCourse(course);
                }}
                options={courses.map(course => ({
                  value: course.id,
                  label: `${course.code} - ${course.title} (Level ${course.level || 'N/A'})`
                }))}
              />
            </div>
            
            {selectedCourse && (
              <Card style={{ 
                marginBottom: 32,
                textAlign: 'left',
                maxWidth: 500,
                margin: '0 auto'
              }}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>Selected Course: </Text>
                  <Text>{selectedCourse.code} - {selectedCourse.title}</Text>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>Level: </Text>
                  <Badge 
                    count={`Level ${selectedCourse.level || 'N/A'}`} 
                    style={{ backgroundColor: '#1890ff' }}
                  />
                </div>
                <div>
                  <Text strong>Course Code: </Text>
                  <Text code>{selectedCourse.code}</Text>
                </div>
              </Card>
            )}
            
            <Space style={{ marginTop: 32 }}>
              <Button
                type="primary"
                size="large"
                icon={<Camera size={20} />}
                onClick={startScanning}
                disabled={!selectedCourse}
                style={{ 
                  height: 60, 
                  fontSize: 18, 
                  padding: '0 48px',
                  borderRadius: 8
                }}
              >
                START SCANNING
              </Button>
              
              <Button
                size="large"
                onClick={debugDatabase}
                style={{ height: 60 }}
              >
                Debug Database
              </Button>
            </Space>
            
            <div style={{ marginTop: 32 }}>
              <Alert
                message="Instructions"
                description="1. Select a course 2. Start scanning 3. Students will be automatically marked present when their face is detected"
                type="info"
                showIcon
                style={{ maxWidth: 500, margin: '0 auto' }}
              />
            </div>
          </div>
        ) : (
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
              flexWrap: 'wrap',
              gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Button
                  icon={<ArrowLeft size={20} />}
                  onClick={stopScanning}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                />
                
                <div>
                  <Text strong style={{ display: 'block' }}>
                    {selectedCourse?.code}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {selectedCourse?.title}
                  </Text>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <Text strong style={{ display: 'block', fontSize: 12 }}>
                    Successful
                  </Text>
                  <Badge 
                    count={stats.successfulScans}
                    style={{ 
                      backgroundColor: '#52c41a',
                      fontSize: 18,
                      padding: '8px 16px'
                    }}
                  />
                </div>
                
                <div style={{ textAlign: 'center' }}>
                  <Text strong style={{ display: 'block', fontSize: 12 }}>
                    Total Scans
                  </Text>
                  <Badge 
                    count={stats.totalScans}
                    style={{ 
                      backgroundColor: '#1890ff',
                      fontSize: 18,
                      padding: '8px 16px'
                    }}
                  />
                </div>
                
                <div style={{ textAlign: 'center' }}>
                  <Text strong style={{ display: 'block', fontSize: 12 }}>
                    Already Marked
                  </Text>
                  <Badge 
                    count={stats.alreadyMarked}
                    style={{ 
                      backgroundColor: '#faad14',
                      fontSize: 18,
                      padding: '8px 16px'
                    }}
                  />
                </div>
              </div>
            </div>

            <Card 
              style={{ 
                marginBottom: 24,
                borderRadius: 12,
                overflow: 'hidden',
                border: '2px solid #1890ff',
                boxShadow: '0 0 20px rgba(24, 144, 255, 0.1)'
              }}
            >
              <div style={{ height: 500 }}>
                <FaceCamera
                  mode="attendance"
                  onAttendanceComplete={(result: any) => {
                    if (result.success && result.photoData) {
                      handleFaceCapture(result.photoData.base64);
                    }
                  }}
                  autoCapture={true}
                  captureInterval={3000}
                  loading={loading}
                />
              </div>
              
              {loading && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 100
                }}>
                  <Spin size="large" />
                  <Text style={{ 
                    display: 'block', 
                    marginTop: 16,
                    color: 'white',
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                  }}>
                    Processing face...
                  </Text>
                </div>
              )}
            </Card>

            {result && (
              <Card style={{ 
                backgroundColor: result.success ? '#f6ffed' : 
                              result.error?.includes('already') ? '#fffbe6' : '#fff2f0',
                borderColor: result.success ? '#b7eb8f' : 
                            result.error?.includes('already') ? '#ffe58f' : '#ffccc7',
                borderRadius: 8,
                transition: 'all 0.3s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {result.success ? (
                    <CheckCircle size={32} color="#52c41a" />
                  ) : result.error?.includes('already') ? (
                    <Clock size={32} color="#faad14" />
                  ) : (
                    <XCircle size={32} color="#ff4d4f" />
                  )}
                  
                  <div style={{ flex: 1 }}>
                    {result.success ? (
                      <>
                        <Text strong style={{ fontSize: 16, display: 'block' }}>
                          {result.student.name}
                        </Text>
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ marginRight: 16 }}>
                            Matric: {result.student.matric_number}
                          </Text>
                          <Text type="secondary">
                            Confidence: {(result.confidence * 100).toFixed(1)}%
                          </Text>
                        </div>
                      </>
                    ) : (
                      <>
                        <Text 
                          strong 
                          style={{ 
                            fontSize: 16, 
                            display: 'block',
                            color: result.error?.includes('already') ? '#faad14' : '#ff4d4f'
                          }}
                        >
                          {result.error}
                        </Text>
                        {result.student && (
                          <Text type="secondary" style={{ marginTop: 4 }}>
                            Student: {result.student.name}
                          </Text>
                        )}
                      </>
                    )}
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs().format('HH:mm:ss')}
                    </Text>
                  </div>
                </div>
              </Card>
            )}

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Alert
                message="Scanning Active"
                description={
                  <div>
                    <div>• Auto-capturing every 3 seconds</div>
                    <div>• Position face in the center of the frame</div>
                    <div>• Ensure good lighting conditions</div>
                    <div>• Results auto-clear after 3 seconds</div>
                  </div>
                }
                type="success"
                showIcon
              />
            </div>
          </div>
        )}
        
        <div style={{ 
          marginTop: 32, 
          paddingTop: 16, 
          borderTop: '1px solid #f0f0f0',
          textAlign: 'center' 
        }}>
          <Space>
            <Text type="secondary">
              <Clock size={12} style={{ marginRight: 4 }} />
              {dayjs().format('DD/MM/YYYY HH:mm')}
            </Text>
            <Text type="secondary">
              System Status: {scanning ? '🟢 Active' : '⚪ Ready'}
            </Text>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default AttendancePage;