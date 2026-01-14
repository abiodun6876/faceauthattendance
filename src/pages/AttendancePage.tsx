import React, { useState, useEffect, useRef } from 'react';
import {
  Select,
  Button,
  Typography,
  Space,
  Badge,
  Alert,
  message
} from 'antd';
import { 
  Camera, 
  CheckCircle, 
  XCircle,
  Clock,
  ArrowLeft,
  Database,
  Cpu
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import faceRecognition from '../utils/faceRecognition';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const AttendancePage: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedCourseData, setSelectedCourseData] = useState<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [successfulScans, setSuccessfulScans] = useState(0);
  const [alreadyMarkedScans, setAlreadyMarkedScans] = useState(0);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markedStudentsRef = useRef<Set<string>>(new Set());

  // Debug database
  const debugDatabaseState = async () => {
    try {
      const { data: students } = await supabase
        .from('students')
        .select('matric_number, name, enrollment_status, face_detected')
        .eq('enrollment_status', 'enrolled');
      
      console.log('Enrolled students:', students);
      
      // Check sample student
      const { data: sample } = await supabase
        .from('students')
        .select('*')
        .eq('matric_number', 'ABU/2026/3490')
        .single();
      
      console.log('Sample student:', {
        name: sample?.name,
        status: sample?.enrollment_status,
        face_detected: sample?.face_detected,
        has_face_embedding: !!sample?.face_embedding,
        has_face_embedding_vector: !!sample?.face_embedding_vector,
        face_embedding_length: sample?.face_embedding?.length || 0
      });
      
      message.info(`Found ${students?.length || 0} enrolled students`);
    } catch (error) {
      console.error('Debug error:', error);
    }
  };

  // Generate face embedding
  const generateFaceEmbedding = async (photoBase64: string): Promise<number[] | null> => {
    try {
      if (!faceModelsLoaded) {
        message.loading({ content: 'Loading face models...', key: 'models' });
        await faceRecognition.loadModels();
        setFaceModelsLoaded(true);
        message.success({ content: 'Face models loaded', key: 'models' });
      }

      const descriptor = await faceRecognition.extractFaceDescriptor(photoBase64);
      
      if (!descriptor) {
        console.log('No face detected in image');
        return null;
      }

      // Convert Float32Array to number[] (512-dimension)
      return Array.from(descriptor);
      
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
  };

  // Generate short embedding (128D) from 512D embedding
  const generateShortEmbedding = (fullEmbedding: number[]): number[] => {
    if (!fullEmbedding || fullEmbedding.length <= 128) {
      return fullEmbedding || [];
    }
    
    const result: number[] = [];
    const segmentSize = fullEmbedding.length / 128;
    
    for (let i = 0; i < 128; i++) {
      const start = Math.floor(i * segmentSize);
      const end = Math.floor((i + 1) * segmentSize);
      const segment = fullEmbedding.slice(start, end);
      const average = segment.reduce((sum, val) => sum + val, 0) / segment.length;
      result.push(parseFloat(average.toFixed(6)));
    }
    
    return result;
  };

  // Find matching students
  const findSimilarFaces = async (embedding: number[]) => {
    try {
      console.log('Looking for matches with embedding length:', embedding.length);
      
      // Generate short embedding for comparison with stored 128D embeddings
      const shortEmbedding = generateShortEmbedding(embedding);
      
      // Get all enrolled students
      const { data: students, error } = await supabase
        .from('students')
        .select('student_id, name, matric_number, face_embedding, face_embedding_vector')
        .eq('enrollment_status', 'enrolled')
        .not('face_embedding', 'is', null)
        .limit(50);
      
      if (error || !students || students.length === 0) {
        console.error('No students found:', error);
        return [];
      }
      
      console.log(`Found ${students.length} enrolled students`);
      
      const matches = [];
      const capturedDescriptor = new Float32Array(embedding);
      
      // Compare with each student
      for (const student of students) {
        try {
          let storedEmbedding: Float32Array | null = null;
          
          // Try to get embedding from student data
          if (student.face_embedding_vector && Array.isArray(student.face_embedding_vector)) {
            // Use 512D vector if available
            storedEmbedding = new Float32Array(student.face_embedding_vector);
            console.log(`Using 512D vector for ${student.name}`);
          } else if (student.face_embedding && Array.isArray(student.face_embedding)) {
            // Use 128D embedding (most common case)
            storedEmbedding = new Float32Array(student.face_embedding);
            console.log(`Using 128D embedding for ${student.name}`);
          }
          
          if (!storedEmbedding) {
            console.log(`No valid embedding for ${student.name}`);
            continue;
          }
          
          // Compare faces
          const similarity = faceRecognition.compareFaces(capturedDescriptor, storedEmbedding);
          
          console.log(`Comparing with ${student.name}: ${similarity.toFixed(3)}`);
          
          // Adjust threshold based on embedding dimensions
          const threshold = storedEmbedding.length === 512 ? 0.65 : 0.5;
          
          if (similarity > threshold) {
            matches.push({
              studentId: student.student_id,
              name: student.name,
              matric_number: student.matric_number,
              confidence: similarity,
              embeddingDimensions: storedEmbedding.length
            });
          }
        } catch (error) {
          console.error(`Error processing student ${student.student_id}:`, error);
          continue;
        }
      }
      
      // Sort by confidence and return top matches
      const sortedMatches = matches
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
      
      console.log('Total matches found:', sortedMatches.length);
      return sortedMatches;
      
    } catch (error) {
      console.error('Error in face matching:', error);
      return [];
    }
  };

  // Check existing attendance
  const checkExistingAttendance = async (studentId: string): Promise<boolean> => {
    if (!selectedCourseData) return false;
    
    try {
      const attendanceDate = dayjs().format('YYYY-MM-DD');
      
      const { data } = await supabase
        .from('student_attendance')
        .select('id')
        .eq('student_id', studentId)
        .eq('course_code', selectedCourseData.code)
        .eq('attendance_date', attendanceDate)
        .maybeSingle();
      
      return !!data;
    } catch (error) {
      console.error('Error checking existing attendance:', error);
      return false;
    }
  };

  // Record attendance
  const recordAttendance = async (studentData: any, similarity: number) => {
    try {
      const attendanceDate = dayjs().format('YYYY-MM-DD');
      
      // Check if already marked
      const alreadyMarked = await checkExistingAttendance(studentData.student_id);
      if (alreadyMarked) {
        return { success: false, alreadyMarked: true };
      }
      
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
        level: selectedCourseData.level || studentData.level,
        attendance_date: attendanceDate,
        check_in_time: new Date().toISOString(),
        status: 'present',
        verification_method: 'face_recognition',
        confidence_score: similarity,
        similarity_score: similarity,
        score: 2.00,
        created_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('student_attendance')
        .insert([attendanceData]);
      
      if (error) throw error;
      
      markedStudentsRef.current.add(studentKey);
      
      return { success: true, alreadyMarked: false };
      
    } catch (error: any) {
      console.error('Record attendance error:', error);
      throw error;
    }
  };

  // Handle face detection
  const handleFaceDetection = async (result: any) => {
    if (!result.success || !result.photoData || isProcessing || !selectedCourseData) return;
    
    setIsProcessing(true);
    setScanCount(prev => prev + 1);
    
    try {
      console.log('=== Starting face detection ===');
      
      // Extract embedding from captured photo
      const embedding = await generateFaceEmbedding(result.photoData.base64);
      
      if (!embedding) {
        setLastScanResult({ 
          success: false,
          type: 'no_face',
          message: 'No face detected'
        });
        return;
      }
      
      // Find matching students
      const matches = await findSimilarFaces(embedding);
      
      console.log('Found matches:', matches.length);
      
      if (matches.length === 0) {
        setLastScanResult({ 
          success: false,
          type: 'no_match',
          message: 'No matching student found'
        });
        return;
      }
      
      const bestMatch = matches[0];
      
      console.log('Best match:', {
        name: bestMatch.name,
        confidence: bestMatch.confidence,
        dimensions: bestMatch.embeddingDimensions
      });
      
      // Get full student data
      const { data: studentData } = await supabase
        .from('students')
        .select('*')
        .eq('matric_number', bestMatch.matric_number)
        .single();
      
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
          },
          message: 'Attendance already marked today'
        });
        setAlreadyMarkedScans(prev => prev + 1);
      } else if (attendanceResult.success) {
        setLastScanResult({
          success: true,
          student: {
            name: studentData.name,
            matric_number: studentData.matric_number
          },
          similarity: bestMatch.confidence,
          message: 'Attendance marked successfully'
        });
        setSuccessfulScans(prev => prev + 1);
        
        // Auto-reset after 1.5 seconds
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }
        scanTimeoutRef.current = setTimeout(() => {
          setLastScanResult(null);
        }, 1500);
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
    // Preload models
    try {
      message.loading({ content: 'Loading face models...', key: 'loading' });
      await faceRecognition.loadModels();
      setFaceModelsLoaded(true);
      message.success({ content: 'Models loaded', key: 'loading' });
    } catch (error) {
      message.error('Failed to load face models');
      return;
    }
    
    setIsCameraActive(true);
    setLastScanResult(null);
    markedStudentsRef.current.clear();
    message.info('Face scanning started');
  };

  // Back to course selection
  const handleBack = () => {
    setIsCameraActive(false);
    setSelectedCourse('');
    setSelectedCourseData(null);
  };

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

  useEffect(() => {
    fetchCourses();
    
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
      markedStudentsRef.current.clear();
    }
  }, [selectedCourse]);

  return (
    <div style={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0a1a35',
      color: '#ffffff'
    }}>
      <div style={{ 
        flex: 1,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Course Selection */}
        {!selectedCourse && (
          <div style={{ 
            textAlign: 'center', 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{
              width: 80,
              height: 80,
              backgroundColor: 'rgba(0, 150, 255, 0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              border: '2px solid rgba(0, 150, 255, 0.5)',
              boxShadow: '0 0 20px rgba(0, 150, 255, 0.3)'
            }}>
              <Camera size={36} color="#00aaff" />
            </div>
            
            <Title level={4} style={{ color: '#ffffff', marginBottom: 16 }}>
              Face Recognition Attendance
            </Title>
            
            <Select
              style={{ 
                width: '100%', 
                maxWidth: 400,
                marginBottom: 24
              }}
              placeholder="Choose course..."
              value={selectedCourse}
              onChange={setSelectedCourse}
              size="large"
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) => {
                const label = option?.label?.toString().toLowerCase() || '';
                return label.includes(input.toLowerCase());
              }}
              options={courses.map(course => ({
                value: course.id,
                label: `${course.code} - ${course.title}`,
              }))}
            />
            
            <Button
              onClick={debugDatabaseState}
              style={{ marginTop: 10 }}
            >
              Check Database
            </Button>
          </div>
        )}

        {/* Course Selected - Ready to Scan */}
        {selectedCourse && !isCameraActive && selectedCourseData && (
          <div style={{ 
            textAlign: 'center', 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{
              width: 100,
              height: 100,
              backgroundColor: 'rgba(0, 255, 150, 0.15)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              border: '2px solid rgba(0, 255, 150, 0.5)',
              boxShadow: '0 0 30px rgba(0, 255, 150, 0.2)',
              animation: 'pulse 2s infinite'
            }}>
              <Camera size={44} color="#00ffaa" />
            </div>
            
            <Text style={{ 
              fontSize: 24, 
              marginBottom: 8, 
              color: '#00ffaa',
              fontWeight: 700,
              textShadow: '0 0 10px rgba(0, 255, 150, 0.5)'
            }}>
              {selectedCourseData.code}
            </Text>
            
            <Text style={{ 
              fontSize: 16, 
              marginBottom: 32,
              color: '#aaccff'
            }}>
              {selectedCourseData.title}
            </Text>
            
            <Button
              type="primary"
              icon={<Camera size={20} />}
              onClick={startScanning}
              size="large"
              style={{
                height: 60,
                fontSize: 18,
                padding: '0 48px',
                borderRadius: 12,
                backgroundColor: '#00aaff',
                border: 'none',
                marginTop: 32,
                boxShadow: '0 0 20px rgba(0, 170, 255, 0.4)'
              }}
            >
              START SCANNING
            </Button>
          </div>
        )}

        {/* Active Scanning */}
        {isCameraActive && selectedCourseData && (
          <div style={{ 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}>
            {/* Header */}
            <div style={{
              position: 'absolute',
              top: 20,
              left: 20,
              right: 20,
              zIndex: 100,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Button
                icon={<ArrowLeft size={20} />}
                onClick={handleBack}
                style={{
                  backgroundColor: 'rgba(0, 150, 255, 0.2)',
                  border: '1px solid rgba(0, 150, 255, 0.5)',
                  color: '#00aaff',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)'
                }}
              />
              
              <div style={{
                backgroundColor: 'rgba(0, 150, 255, 0.2)',
                color: '#00aaff',
                padding: '8px 16px',
                borderRadius: 20,
                border: '1px solid rgba(0, 150, 255, 0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backdropFilter: 'blur(10px)'
              }}>
                <Badge status="processing" color="#00ffaa" />
                <Text style={{ fontSize: 14, fontWeight: 600 }}>
                  {selectedCourseData.code}
                </Text>
              </div>

              <div style={{
                width: 50,
                height: 50,
                backgroundColor: 'rgba(0, 255, 150, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #00ffaa',
                boxShadow: '0 0 15px rgba(0, 255, 150, 0.3)',
                backdropFilter: 'blur(10px)'
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: 'bold',
                  color: '#00ffaa'
                }}>
                  {successfulScans}
                </Text>
              </div>
            </div>

            {/* Camera Feed */}
            <div style={{ 
              flex: 1,
              minHeight: 0,
              position: 'relative',
              marginTop: 0
            }}>
              <div style={{ 
                height: '100%',
                borderRadius: 16,
                overflow: 'hidden',
                border: '2px solid rgba(0, 150, 255, 0.3)',
                boxShadow: '0 0 30px rgba(0, 150, 255, 0.2)'
              }}>
                <FaceCamera
                  mode="attendance"
                  onAttendanceComplete={handleFaceDetection}
                  autoCapture={true}
                  captureInterval={3000}
                />
              </div>

              {/* Scan Status */}
              {isProcessing && (
                <div style={{
                  position: 'absolute',
                  bottom: 20,
                  left: 0,
                  right: 0,
                  textAlign: 'center'
                }}>
                  <div style={{
                    display: 'inline-block',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: '#00ffaa',
                    padding: '8px 20px',
                    borderRadius: 20,
                    fontSize: 14,
                    fontWeight: 600,
                    backdropFilter: 'blur(10px)'
                  }}>
                    FACE MATCHING...
                  </div>
                </div>
              )}
            </div>

            {/* Scan Result */}
            {lastScanResult && (
              <div style={{
                position: 'absolute',
                bottom: 80,
                left: 0,
                right: 0,
                textAlign: 'center',
                zIndex: 100
              }}>
                <div style={{
                  display: 'inline-block',
                  backgroundColor: lastScanResult.success 
                    ? 'rgba(0, 255, 150, 0.15)' 
                    : lastScanResult.type === 'already_marked'
                    ? 'rgba(255, 200, 0, 0.15)'
                    : 'rgba(255, 50, 50, 0.15)',
                  color: lastScanResult.success 
                    ? '#00ffaa' 
                    : lastScanResult.type === 'already_marked'
                    ? '#ffcc00'
                    : '#ff3333',
                  padding: '12px 24px',
                  borderRadius: 12,
                  border: lastScanResult.success 
                    ? '1px solid rgba(0, 255, 150, 0.5)' 
                    : lastScanResult.type === 'already_marked'
                    ? '1px solid rgba(255, 200, 0, 0.5)'
                    : '1px solid rgba(255, 50, 50, 0.5)',
                  fontSize: 16,
                  fontWeight: 600,
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 0 20px rgba(0, 0, 0, 0.3)',
                  maxWidth: '80%'
                }}>
                  {lastScanResult.success ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle size={20} />
                        <span>{lastScanResult.student?.name}</span>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        Matric: {lastScanResult.student?.matric_number}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        Confidence: {(lastScanResult.similarity * 100).toFixed(1)}%
                      </div>
                    </div>
                  ) : lastScanResult.type === 'already_marked' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <XCircle size={20} />
                      <span>{lastScanResult.student?.name} - ALREADY MARKED</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <XCircle size={20} />
                      <span>{lastScanResult.message}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div style={{ 
        padding: '8px 16px',
        backgroundColor: 'rgba(10, 26, 53, 0.8)',
        borderTop: '1px solid rgba(0, 150, 255, 0.2)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Space>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: faceModelsLoaded ? '#00ffaa' : '#ffaa00',
              boxShadow: faceModelsLoaded ? '0 0 8px #00ffaa' : '0 0 8px #ffaa00'
            }} />
            <Text style={{ fontSize: 11, color: '#aaccff' }}>
              {faceModelsLoaded ? 'MODELS READY' : 'LOADING MODELS'}
            </Text>
          </Space>
          
          <Space>
            <Text style={{ fontSize: 11, color: '#aaccff' }}>
              Scans: {scanCount} | Marked: {successfulScans}
            </Text>
            <Text style={{ fontSize: 11, color: '#aaccff' }}>
              <Clock size={10} style={{ marginRight: 4 }} />
              {dayjs().format('HH:mm')}
            </Text>
          </Space>
        </div>
      </div>

      <style>
        {`
          @keyframes pulse {
            0% { box-shadow: 0 0 20px rgba(0, 255, 150, 0.2); }
            50% { box-shadow: 0 0 30px rgba(0, 255, 150, 0.4); }
            100% { box-shadow: 0 0 20px rgba(0, 255, 150, 0.2); }
          }
        `}
      </style>
    </div>
  );
};

export default AttendancePage;