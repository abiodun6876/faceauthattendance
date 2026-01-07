// src/pages/AttendancePage.tsx - AUTO-SCAN VERSION
import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Select,
  Button,
  Typography,
  Alert,
  message,
  Grid,
  Space,
  Tag,
  Divider,
  Statistic,
  Progress,
  Badge
} from 'antd';
import { 
  Camera, 
  CheckCircle, 
  XCircle,
  User,
  Clock,
  Hash,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import faceRecognition from '../utils/faceRecognition';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const AttendancePage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedCourseData, setSelectedCourseData] = useState<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [successfulScans, setSuccessfulScans] = useState(0);
  const [failedScans, setFailedScans] = useState(0);
  
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch courses
  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('code');
      
      if (error) throw error;
      setCourses(data || []);
    } catch (error: any) {
      console.error('Error fetching courses:', error);
      message.error('Failed to load courses');
    }
  };

  // Record Attendance
  const recordAttendance = async (studentData: any, confidence: number) => {
    try {
      const attendanceDate = dayjs().format('YYYY-MM-DD');
      
      // Check existing attendance
      const { data: existingAttendance } = await supabase
        .from('student_attendance')
        .select('id, score')
        .eq('student_id', studentData.student_id)
        .eq('course_code', selectedCourseData.code)
        .eq('attendance_date', attendanceDate)
        .single();
      
      const attendanceData = {
        student_id: studentData.student_id,
        student_name: studentData.name,
        matric_number: studentData.matric_number,
        course_code: selectedCourseData.code,
        course_title: selectedCourseData.title,
        level: studentData.level || selectedCourseData.level,
        attendance_date: attendanceDate,
        check_in_time: new Date().toISOString(),
        status: 'present',
        verification_method: 'face_recognition',
        confidence_score: confidence,
        score: 2.00,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      if (existingAttendance) {
        await supabase
          .from('student_attendance')
          .update(attendanceData)
          .eq('id', existingAttendance.id);
      } else {
        await supabase
          .from('student_attendance')
          .insert([attendanceData]);
      }
      
      return true;
      
    } catch (error: any) {
      console.error('Record attendance error:', error);
      throw error;
    }
  };

  // Handle face detection and auto-scan
  const handleFaceDetection = async (result: any) => {
    if (!result.success || !result.photoUrl || isProcessing) return;
    
    setIsProcessing(true);
    setScanCount(prev => prev + 1);
    
    try {
      const matches = await faceRecognition.matchFaceForAttendance(result.photoUrl);
      
      if (matches.length === 0) {
        setLastScanResult({
          success: false,
          message: 'No face match found',
          error: true
        });
        setFailedScans(prev => prev + 1);
        return;
      }
      
      const bestMatch = matches[0];
      if (bestMatch.confidence < 0.60) {
        setLastScanResult({
          success: false,
          message: `Low confidence match (${(bestMatch.confidence * 100).toFixed(1)}%)`,
          error: true,
          confidence: bestMatch.confidence
        });
        setFailedScans(prev => prev + 1);
        return;
      }
      
      // Get student data
      const { data: studentData } = await supabase
        .from('students')
        .select('*')
        .eq('student_id', bestMatch.studentId)
        .eq('enrollment_status', 'enrolled')
        .maybeSingle();
      
      if (!studentData) {
        setLastScanResult({
          success: false,
          message: 'Student not enrolled',
          error: true
        });
        setFailedScans(prev => prev + 1);
        return;
      }
      
      // Record attendance
      await recordAttendance(studentData, bestMatch.confidence);
      
      setLastScanResult({
        success: true,
        student: {
          name: studentData.name,
          matric_number: studentData.matric_number,
          student_id: studentData.student_id
        },
        confidence: bestMatch.confidence,
        photoUrl: result.photoUrl,
        timestamp: new Date().toISOString()
      });
      
      setSuccessfulScans(prev => prev + 1);
      
      // Auto-reset after 3 seconds for next scan
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = setTimeout(() => {
        setLastScanResult(null);
      }, 3000);
      
    } catch (error: any) {
      console.error('Face recognition error:', error);
      setLastScanResult({
        success: false,
        message: 'Processing error',
        error: true
      });
      setFailedScans(prev => prev + 1);
    } finally {
      setIsProcessing(false);
    }
  };

  // Start scanning
  const startScanning = async () => {
    if (!faceModelsLoaded) {
      try {
        await faceRecognition.loadModels();
        setFaceModelsLoaded(true);
      } catch (error) {
        message.warning('Face models loading in background');
      }
    }
    setIsCameraActive(true);
    setLastScanResult(null);
    setScanCount(0);
    setSuccessfulScans(0);
    setFailedScans(0);
  };

  // Stop scanning
  const stopScanning = () => {
    setIsCameraActive(false);
    clearTimeout(scanTimeoutRef.current);
  };

  // Reset scanner
  const resetScanner = () => {
    setIsCameraActive(false);
    setLastScanResult(null);
    setSelectedCourse('');
    setSelectedCourseData(null);
    setScanCount(0);
    setSuccessfulScans(0);
    setFailedScans(0);
    clearTimeout(scanTimeoutRef.current);
  };

  useEffect(() => {
    fetchCourses();
    
    // Load face models in background
    const loadModels = async () => {
      try {
        await faceRecognition.loadModels();
        setFaceModelsLoaded(true);
      } catch (error) {
        console.warn('Face models loading deferred');
      }
    };
    loadModels();

    // Cleanup
    return () => {
      clearTimeout(scanTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      const course = courses.find(c => c.id === selectedCourse);
      setSelectedCourseData(course);
    }
  }, [selectedCourse]);

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 8, fontWeight: 600 }}>
          Continuous Face Scanner
        </Title>
        <Text type="secondary" style={{ fontSize: '14px' }}>
          Students can scan one after another - No buttons needed
        </Text>
      </div>

      {/* Main Card */}
      <Card
        style={{
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          marginBottom: 24
        }}
        bodyStyle={{ padding: isMobile ? '16px' : '24px' }}
      >
        {/* Course Selection */}
        {!selectedCourse && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 64,
              height: 64,
              backgroundColor: '#f0f9ff',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <Hash size={28} color="#1890ff" />
            </div>
            <Title level={4} style={{ marginBottom: 16, fontWeight: 500 }}>
              Select Course
            </Title>
            
            <Select
              style={{ width: '100%', maxWidth: 500, marginBottom: 24 }}
              placeholder="Choose course to scan..."
              value={selectedCourse}
              onChange={setSelectedCourse}
              size="large"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              optionFilterProp="label"
              options={courses.map(course => ({
                value: course.id,
                label: `${course.code} - ${course.title}`,
              }))}
            />
            
            <div style={{ 
              backgroundColor: '#f6f9ff', 
              padding: '16px', 
              borderRadius: 8,
              maxWidth: 500,
              margin: '0 auto'
            }}>
              <Text type="secondary">
                <AlertCircle size={16} style={{ marginRight: 8 }} />
                Once a course is selected, camera will activate automatically
              </Text>
            </div>
          </div>
        )}

        {/* Course Selected - Ready to Scan */}
        {selectedCourse && !isCameraActive && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 80,
              height: 80,
              backgroundColor: '#52c41a20',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <Camera size={36} color="#52c41a" />
            </div>
            
            <Title level={4} style={{ marginBottom: 8, color: '#52c41a' }}>
              Ready to Scan: {selectedCourseData?.code}
            </Title>
            <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
              {selectedCourseData?.title}
            </Text>
            
            <Button
              type="primary"
              icon={<Camera size={18} />}
              onClick={startScanning}
              size="large"
              style={{
                height: 48,
                fontSize: '16px',
                padding: '0 32px',
                borderRadius: 8
              }}
            >
              Start Auto-Scanning
            </Button>
            
            <div style={{ marginTop: 16 }}>
              <Tag color="blue" icon={<User size={12} />}>
                {faceModelsLoaded ? 'Face AI Ready' : 'Loading AI...'}
              </Tag>
            </div>
          </div>
        )}

        {/* Active Scanning */}
        {isCameraActive && (
          <div>
            {/* Scanner Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
              padding: '12px 16px',
              backgroundColor: '#f6ffed',
              borderRadius: 8,
              border: '1px solid #b7eb8f'
            }}>
              <div>
                <Text strong style={{ fontSize: '16px', display: 'block' }}>
                  Scanning: {selectedCourseData?.code}
                </Text>
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  Position face in camera view
                </Text>
              </div>
              
              <Space>
                <Badge 
                  status="processing" 
                  text="Active" 
                  color="green"
                />
                <Button
                  type="default"
                  icon={<RotateCcw size={14} />}
                  onClick={stopScanning}
                  size="small"
                >
                  Stop
                </Button>
              </Space>
            </div>

            {/* Camera and Results Side by Side */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 24,
              marginBottom: 24
            }}>
              {/* Camera Feed */}
              <div>
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <Text strong>Live Camera</Text>
                </div>
                <FaceCamera
                  mode="attendance"
                  onAttendanceComplete={handleFaceDetection}
                  autoCapture={true}
                  captureInterval={1000}
                />
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <Tag color="processing">
                    {isProcessing ? 'Processing...' : 'Ready for next scan'}
                  </Tag>
                </div>
              </div>

              {/* Results Panel */}
              <div>
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <Text strong>Scan Results</Text>
                </div>
                
                {/* Last Scan Result */}
                {lastScanResult && (
                  <div style={{ 
                    padding: '20px',
                    borderRadius: 8,
                    backgroundColor: lastScanResult.success ? '#f6ffed' : '#fff2f0',
                    border: `1px solid ${lastScanResult.success ? '#b7eb8f' : '#ffccc7'}`,
                    marginBottom: 20
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      marginBottom: 16
                    }}>
                      {lastScanResult.success ? (
                        <CheckCircle size={32} color="#52c41a" />
                      ) : (
                        <XCircle size={32} color="#ff4d4f" />
                      )}
                    </div>
                    
                    <Title 
                      level={5} 
                      style={{ 
                        textAlign: 'center',
                        color: lastScanResult.success ? '#52c41a' : '#ff4d4f',
                        marginBottom: 8
                      }}
                    >
                      {lastScanResult.success ? 'ATTENDANCE RECORDED' : 'SCAN FAILED'}
                    </Title>
                    
                    {lastScanResult.success && (
                      <>
                        <Text strong style={{ fontSize: '18px', display: 'block', textAlign: 'center' }}>
                          {lastScanResult.student?.name}
                        </Text>
                        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}>
                          {lastScanResult.student?.matric_number}
                        </Text>
                        
                        <div style={{ textAlign: 'center', marginBottom: 16 }}>
                          <Progress 
                            type="circle" 
                            percent={Number((lastScanResult.confidence * 100).toFixed(1))} 
                            size={80}
                            strokeColor={lastScanResult.confidence > 0.8 ? '#52c41a' : '#faad14'}
                            format={() => `${(lastScanResult.confidence * 100).toFixed(1)}%`}
                          />
                        </div>
                        
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'center',
                          gap: 8,
                          marginTop: 16
                        }}>
                          <Tag color="success">✓ Recorded</Tag>
                          <Tag color="blue">{dayjs(lastScanResult.timestamp).format('HH:mm:ss')}</Tag>
                        </div>
                      </>
                    )}
                    
                    {!lastScanResult.success && (
                      <div style={{ textAlign: 'center' }}>
                        <Text style={{ display: 'block', marginBottom: 16 }}>
                          {lastScanResult.message}
                        </Text>
                        {lastScanResult.confidence && (
                          <Text type="secondary">
                            Confidence: {(lastScanResult.confidence * 100).toFixed(1)}%
                          </Text>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Scanning Instructions */}
                {!lastScanResult && (
                  <div style={{ 
                    padding: '20px',
                    borderRadius: 8,
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #91d5ff',
                    textAlign: 'center'
                  }}>
                    <User size={48} color="#1890ff" style={{ marginBottom: 16 }} />
                    <Title level={5} style={{ marginBottom: 8 }}>
                      Waiting for Student
                    </Title>
                    <Text type="secondary" style={{ display: 'block' }}>
                      Student should look directly at camera
                    </Text>
                    <div style={{ marginTop: 16 }}>
                      <Tag color="blue">Auto-scan active</Tag>
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  marginTop: 20
                }}>
                  <Statistic
                    title="Total Scans"
                    value={scanCount}
                    prefix={<Camera size={14} />}
                  />
                  <Statistic
                    title="Success"
                    value={successfulScans}
                    valueStyle={{ color: '#52c41a' }}
                    prefix={<CheckCircle size={14} />}
                  />
                  <Statistic
                    title="Failed"
                    value={failedScans}
                    valueStyle={{ color: '#ff4d4f' }}
                    prefix={<XCircle size={14} />}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Space>
                <Button
                  type="primary"
                  onClick={startScanning}
                  disabled={isProcessing}
                >
                  Continue Scanning
                </Button>
                <Button
                  onClick={stopScanning}
                >
                  Stop Scanning
                </Button>
                <Button
                  type="default"
                  icon={<RotateCcw size={14} />}
                  onClick={resetScanner}
                >
                  New Course
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Card>

      {/* Instructions Card */}
      <Card
        style={{
          borderRadius: 12,
          backgroundColor: '#fafafa'
        }}
        bodyStyle={{ padding: isMobile ? '16px' : '20px' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <AlertCircle color="#faad14" />
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              How It Works
            </Text>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              <li><Text>Select a course to begin</Text></li>
              <li><Text>Camera activates automatically</Text></li>
              <li><Text>Students scan faces one after another</Text></li>
              <li><Text>System auto-detects and records attendance</Text></li>
              <li><Text>Results show immediately</Text></li>
              <li><Text>Camera stays active for continuous scanning</Text></li>
            </ol>
          </div>
        </div>
      </Card>

      {/* Footer */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: 24,
        padding: '16px',
        borderTop: '1px solid #f0f0f0'
      }}>
        <Space>
          <Tag color={faceModelsLoaded ? "green" : "orange"}>
            {faceModelsLoaded ? 'Face AI Ready' : 'AI Loading...'}
          </Tag>
          <Tag color="blue">
            <Clock size={12} style={{ marginRight: 4 }} />
            {dayjs().format('HH:mm')}
          </Tag>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            AFE Babalola University • Auto-Scan Mode
          </Text>
        </Space>
      </div>
    </div>
  );
};

export default AttendancePage;