// src/pages/AttendancePage.tsx - WITH DUPLICATE PREVENTION
import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Select,
  Button,
  Typography,
  message,
  Grid,
  Space,
  Tag,
  Statistic,
  Badge,
  Alert
} from 'antd';
import { 
  Camera, 
  CheckCircle, 
  XCircle,
  Clock,
  UserCheck,
  UserX
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
  const [alreadyMarkedScans, setAlreadyMarkedScans] = useState(0);
  
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markedStudentsRef = useRef<Set<string>>(new Set()); // Track marked students for this session

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
    }
  };

  // Check if student already marked attendance today
  const checkExistingAttendance = async (studentId: string): Promise<boolean> => {
    if (!selectedCourseData) return false;
    
    try {
      const attendanceDate = dayjs().format('YYYY-MM-DD');
      
      const { data, error } = await supabase
        .from('student_attendance')
        .select('id')
        .eq('student_id', studentId)
        .eq('course_code', selectedCourseData.code)
        .eq('attendance_date', attendanceDate)
        .maybeSingle();
      
      if (error) throw error;
      
      return !!data; // Returns true if attendance already exists
    } catch (error) {
      console.error('Error checking existing attendance:', error);
      return false;
    }
  };

  // Record Attendance
  const recordAttendance = async (studentData: any, confidence: number) => {
    try {
      const attendanceDate = dayjs().format('YYYY-MM-DD');
      
      // Check if already marked in database
      const alreadyMarked = await checkExistingAttendance(studentData.student_id);
      if (alreadyMarked) {
        return { success: false, alreadyMarked: true };
      }
      
      // Check if already marked in this session
      const studentKey = `${studentData.student_id}-${selectedCourseData.code}-${attendanceDate}`;
      if (markedStudentsRef.current.has(studentKey)) {
        return { success: false, alreadyMarked: true };
      }

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
      
      const { error } = await supabase
        .from('student_attendance')
        .insert([attendanceData]);
      
      if (error) throw error;
      
      // Mark as recorded in this session
      markedStudentsRef.current.add(studentKey);
      
      return { success: true, alreadyMarked: false };
      
    } catch (error: any) {
      console.error('Record attendance error:', error);
      throw error;
    }
  };

  // Handle face detection
  const handleFaceDetection = async (result: any) => {
    if (!result.success || !result.photoUrl || isProcessing || !selectedCourseData) return;
    
    setIsProcessing(true);
    setScanCount(prev => prev + 1);
    
    try {
      const matches = await faceRecognition.matchFaceForAttendance(result.photoUrl);
      
      if (matches.length === 0 || matches[0].confidence < 0.60) {
        setLastScanResult({ 
          success: false,
          type: 'no_match',
          message: 'No matching student found'
        });
        return;
      }
      
      const bestMatch = matches[0];
      
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
          type: 'not_enrolled',
          message: 'Student not enrolled'
        });
        return;
      }
      
      // Record attendance
      const attendanceResult = await recordAttendance(studentData, bestMatch.confidence);
      
      if (attendanceResult.alreadyMarked) {
        setLastScanResult({
          success: false,
          type: 'already_marked',
          student: {
            name: studentData.name,
            matric_number: studentData.matric_number
          }
        });
        setAlreadyMarkedScans(prev => prev + 1);
      } else if (attendanceResult.success) {
        setLastScanResult({
          success: true,
          student: {
            name: studentData.name,
            matric_number: studentData.matric_number
          },
          confidence: bestMatch.confidence
        });
        setSuccessfulScans(prev => prev + 1);
        
        // Auto-reset after 2 seconds
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }
        scanTimeoutRef.current = setTimeout(() => {
          setLastScanResult(null);
        }, 2000);
      }
      
    } catch (error: any) {
      console.error('Face recognition error:', error);
      setLastScanResult({ 
        success: false,
        type: 'error',
        message: 'Processing error'
      });
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
        console.log('Face models loading...');
      }
    }
    setIsCameraActive(true);
    setLastScanResult(null);
    // Clear marked students for new session
    markedStudentsRef.current.clear();
  };

  // Stop scanning
  const stopScanning = () => {
    setIsCameraActive(false);
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
  };

  // Reset scanner
  const resetScanner = () => {
    setIsCameraActive(false);
    setLastScanResult(null);
    setSelectedCourse('');
    setSelectedCourseData(null);
    setScanCount(0);
    setSuccessfulScans(0);
    setAlreadyMarkedScans(0);
    markedStudentsRef.current.clear();
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
  };

  useEffect(() => {
    fetchCourses();
    
    // Load face models in background
    const loadModels = async () => {
      try {
        await faceRecognition.loadModels();
        setFaceModelsLoaded(true);
      } catch (error) {
        console.log('Face models loading...');
      }
    };
    loadModels();

    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      const course = courses.find(c => c.id === selectedCourse);
      setSelectedCourseData(course);
      // Clear marked students when course changes
      markedStudentsRef.current.clear();
    }
  }, [selectedCourse]);

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 8, fontWeight: 600 }}>
          Face Attendance
        </Title>
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
            <Title level={4} style={{ marginBottom: 16, fontWeight: 500 }}>
              Select Course
            </Title>
            
            <Select
              style={{ width: '100%', maxWidth: 400 }}
              placeholder="Select course..."
              value={selectedCourse}
              onChange={setSelectedCourse}
              size="large"
              showSearch
              options={courses.map(course => ({
                value: course.id,
                label: `${course.code} - ${course.title}`,
              }))}
            />
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
              {selectedCourseData?.code}
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
              Start Scanning
            </Button>
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
                  {selectedCourseData?.code}
                </Text>
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  {dayjs().format('DD MMM YYYY')}
                </Text>
              </div>
              
              <Space>
                <Badge status="processing" color="green" />
                <Button
                  type="default"
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
                <FaceCamera
                  mode="attendance"
                  onAttendanceComplete={handleFaceDetection}
                  autoCapture={true}
                  captureInterval={3000}
                />
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <Tag color="processing">
                    {isProcessing ? 'Processing...' : 'Ready'}
                  </Tag>
                </div>
              </div>

              {/* Results Panel */}
              <div>
                {/* Last Scan Result */}
                {lastScanResult && (
                  <div style={{ 
                    padding: '20px',
                    borderRadius: 8,
                    marginBottom: 20
                  }}>
                    {lastScanResult.success ? (
                      // Success - Attendance Marked
                      <div style={{ 
                        backgroundColor: '#f6ffed',
                        border: '1px solid #b7eb8f',
                        padding: '20px',
                        borderRadius: 8
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          marginBottom: 16
                        }}>
                          <CheckCircle size={32} color="#52c41a" />
                        </div>
                        
                        <Text strong style={{ fontSize: '18px', display: 'block', textAlign: 'center' }}>
                          {lastScanResult.student?.name}
                        </Text>
                        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 8 }}>
                          {lastScanResult.student?.matric_number}
                        </Text>
                        <Text style={{ display: 'block', textAlign: 'center', color: '#52c41a' }}>
                          ✓ Attendance Recorded
                        </Text>
                        
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'center',
                          gap: 8,
                          marginTop: 16
                        }}>
                          <Tag color="success">✓ Marked</Tag>
                          <Tag color="blue">{dayjs().format('HH:mm')}</Tag>
                        </div>
                      </div>
                    ) : lastScanResult.type === 'already_marked' ? (
                      // Already Marked
                      <div style={{ 
                        backgroundColor: '#fff7e6',
                        border: '1px solid #ffd591',
                        padding: '20px',
                        borderRadius: 8
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          marginBottom: 16
                        }}>
                          <UserCheck size={32} color="#fa8c16" />
                        </div>
                        
                        <Text strong style={{ fontSize: '18px', display: 'block', textAlign: 'center' }}>
                          {lastScanResult.student?.name}
                        </Text>
                        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 8 }}>
                          {lastScanResult.student?.matric_number}
                        </Text>
                        <Text style={{ display: 'block', textAlign: 'center', color: '#fa8c16' }}>
                          Already Marked for this Class
                        </Text>
                        
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'center',
                          gap: 8,
                          marginTop: 16
                        }}>
                          <Tag color="orange">Already Marked</Tag>
                          <Tag color="blue">{dayjs().format('HH:mm')}</Tag>
                        </div>
                      </div>
                    ) : (
                      // Other Errors
                      <div style={{ 
                        backgroundColor: '#fff2f0',
                        border: '1px solid #ffccc7',
                        padding: '20px',
                        borderRadius: 8
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          marginBottom: 16
                        }}>
                          <XCircle size={32} color="#ff4d4f" />
                        </div>
                        
                        <Text style={{ display: 'block', textAlign: 'center', color: '#ff4d4f' }}>
                          {lastScanResult.message || 'Scan Failed'}
                        </Text>
                      </div>
                    )}
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
                    title="Total"
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
                    title="Duplicates"
                    value={alreadyMarkedScans}
                    valueStyle={{ color: '#fa8c16' }}
                    prefix={<UserX size={14} />}
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
                  Continue
                </Button>
                <Button
                  onClick={resetScanner}
                >
                  New Course
                </Button>
              </Space>
            </div>
          </div>
        )}
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
            {faceModelsLoaded ? 'Ready' : 'Loading...'}
          </Tag>
          <Tag color="blue">
            <Clock size={12} style={{ marginRight: 4 }} />
            {dayjs().format('HH:mm')}
          </Tag>
        </Space>
      </div>
    </div>
  );
};

export default AttendancePage;