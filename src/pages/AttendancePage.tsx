// src/pages/AttendancePage.tsx - HYBRID SOLUTION
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
  const [vectorFunctionAvailable, setVectorFunctionAvailable] = useState(false);
  const [useVectorMatching, setUseVectorMatching] = useState(false);
  
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markedStudentsRef = useRef<Set<string>>(new Set());

  // Test if vector function exists
  const testVectorFunction = async () => {
    try {
      // Create a test embedding
      const testEmbedding = Array.from({length: 512}, () => 
        parseFloat((Math.random() * 2 - 1).toFixed(6))
      );
      
      const { data, error } = await supabase.rpc('match_faces', {
        query_embedding: testEmbedding,
        match_threshold: 0.7,
        match_count: 1
      });
      
      if (error) {
        console.log('Vector function not available:', error.message);
        setVectorFunctionAvailable(false);
        setUseVectorMatching(false);
      } else {
        console.log('✅ Vector function is available');
        setVectorFunctionAvailable(true);
        
        // Auto-enable vector matching if available
        const { data: vectorCount } = await supabase
          .from('students')
          .select('count')
          .not('face_embedding_vector', 'is', null)
          .single();
          
        if (vectorCount?.count > 0) {
          setUseVectorMatching(true);
          message.info('Using PostgreSQL vector matching');
        }
      }
    } catch (error) {
      console.warn('Error testing vector function:', error);
      setVectorFunctionAvailable(false);
      setUseVectorMatching(false);
    }
  };

  // Generate face embedding using face-api.js
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

      // Convert Float32Array to number[] (512-dimension vector)
      const embedding = Array.from(descriptor);
      
      if (embedding.length !== 512) {
        console.warn(`Expected 512 dimensions, got ${embedding.length}. Padding/truncating...`);
        // Ensure we have exactly 512 dimensions for PostgreSQL vector
        if (embedding.length > 512) {
          return embedding.slice(0, 512);
        } else {
          return [...embedding, ...Array(512 - embedding.length).fill(0)];
        }
      }
      
      console.log('Generated embedding length:', embedding.length);
      return embedding;
      
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
  };

  // Find similar faces using vector matching
  const findSimilarFacesVector = async (embedding: number[]) => {
    try {
      const { data, error } = await supabase.rpc('match_faces', {
        query_embedding: embedding,
        match_threshold: 0.65, // Lower threshold for vector matching
        match_count: 5
      });
      
      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error in vector matching:', error);
      return [];
    }
  };

  // Find similar faces using face-api.js matching
  const findSimilarFacesTraditional = async (photoBase64: string) => {
    try {
      const matches = await faceRecognition.matchFaceForAttendance(photoBase64);
      
      // Convert to same format as vector matching
      return matches.map(match => ({
        id: match.studentId,
        student_id: match.studentId,
        name: match.name,
        matric_number: match.matric_number,
        similarity: match.confidence
      }));
    } catch (error) {
      console.error('Error in traditional matching:', error);
      return [];
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
      
      return !!data;
    } catch (error) {
      console.error('Error checking existing attendance:', error);
      return false;
    }
  };

  // Record Attendance
  const recordAttendance = async (studentData: any, similarity: number, method: string) => {
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
        level: studentData.level || selectedCourseData.level,
        attendance_date: attendanceDate,
        check_in_time: new Date().toISOString(),
        status: 'present',
        verification_method: method,
        confidence_score: similarity,
        similarity_score: similarity,
        score: 2.00,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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
      console.log('Processing face detection... Method:', useVectorMatching ? 'Vector' : 'Traditional');
      
      let matches = [];
      
      if (useVectorMatching && vectorFunctionAvailable) {
        // Use PostgreSQL vector matching
        const embedding = await generateFaceEmbedding(result.photoData.base64);
        
        if (!embedding) {
          setLastScanResult({ 
            success: false,
            type: 'no_face',
            message: 'No face detected'
          });
          return;
        }
        
        matches = await findSimilarFacesVector(embedding);
      } else {
        // Use traditional face-api.js matching
        matches = await findSimilarFacesTraditional(result.photoData.base64);
      }
      
      console.log('Found matches:', matches?.length);
      
      if (matches.length === 0) {
        setLastScanResult({ 
          success: false,
          type: 'no_match',
          message: 'No matching student found'
        });
        return;
      }
      
      const bestMatch = matches[0];
      const MATCH_THRESHOLD = useVectorMatching ? 0.65 : 0.6;
      
      if (bestMatch.similarity < MATCH_THRESHOLD) {
        setLastScanResult({ 
          success: false,
          type: 'low_confidence',
          message: `Low confidence: ${(bestMatch.similarity * 100).toFixed(1)}%`
        });
        return;
      }
      
      // Get full student data
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('matric_number', bestMatch.matric_number)
        .eq('enrollment_status', 'enrolled')
        .single();
      
      if (studentError || !studentData) {
        setLastScanResult({ 
          success: false,
          type: 'not_enrolled',
          message: 'Student not enrolled'
        });
        return;
      }
      
      // Record attendance
      const method = useVectorMatching ? 'postgres_vector' : 'faceapi_js';
      const attendanceResult = await recordAttendance(studentData, bestMatch.similarity, method);
      
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
          similarity: bestMatch.similarity,
          method: method,
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
        message: error.message || 'Processing error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle between vector and traditional matching
  const toggleMatchingMethod = () => {
    if (!vectorFunctionAvailable && !useVectorMatching) {
      message.warning('Vector matching not available');
      return;
    }
    
    const newMethod = !useVectorMatching;
    setUseVectorMatching(newMethod);
    message.info(`Switched to ${newMethod ? 'PostgreSQL Vector' : 'Face-API.js'} matching`);
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
    testVectorFunction();
    
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
      {/* Main Content */}
      <div style={{ 
        flex: 1,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Method Toggle */}
        {selectedCourse && !isCameraActive && (
          <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            zIndex: 10
          }}>
            <Button
              icon={useVectorMatching ? <Database size={16} /> : <Cpu size={16} />}
              onClick={toggleMatchingMethod}
              style={{
                backgroundColor: useVectorMatching 
                  ? 'rgba(0, 150, 255, 0.2)' 
                  : 'rgba(255, 100, 0, 0.2)',
                border: useVectorMatching 
                  ? '1px solid rgba(0, 150, 255, 0.5)' 
                  : '1px solid rgba(255, 100, 0, 0.5)',
                color: useVectorMatching ? '#00aaff' : '#ff6400',
                borderRadius: 20,
                padding: '4px 12px'
              }}
              disabled={!vectorFunctionAvailable && useVectorMatching}
            >
              {useVectorMatching ? 'PostgreSQL Vector' : 'Face-API.js'}
            </Button>
          </div>
        )}

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
            
            {!vectorFunctionAvailable && (
              <Alert
                type="info"
                message="Vector Matching Available"
                description="Run SQL setup in Supabase to enable faster PostgreSQL vector matching"
                showIcon
                style={{ maxWidth: 400, marginBottom: 16 }}
              />
            )}
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
            
            {/* Method Indicator */}
            <div style={{
              marginBottom: 24,
              padding: '8px 16px',
              backgroundColor: useVectorMatching 
                ? 'rgba(0, 150, 255, 0.1)' 
                : 'rgba(255, 100, 0, 0.1)',
              borderRadius: 8,
              border: useVectorMatching 
                ? '1px solid rgba(0, 150, 255, 0.3)' 
                : '1px solid rgba(255, 100, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              {useVectorMatching ? <Database size={16} color="#00aaff" /> : <Cpu size={16} color="#ff6400" />}
              <Text style={{ 
                fontSize: 12, 
                color: useVectorMatching ? '#00aaff' : '#ff6400' 
              }}>
                {useVectorMatching ? 'PostgreSQL Vector Matching' : 'Face-API.js Matching'}
              </Text>
            </div>
            
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
                {useVectorMatching ? 
                  <Database size={14} color="#00ffaa" /> : 
                  <Cpu size={14} color="#00ffaa" />
                }
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
                    {useVectorMatching ? 'VECTOR MATCHING...' : 'FACE MATCHING...'}
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
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: useVectorMatching ? '#00aaff' : '#ff6400',
              boxShadow: useVectorMatching ? '0 0 8px #00aaff' : '0 0 8px #ff6400'
            }} />
            <Text style={{ fontSize: 11, color: '#aaccff' }}>
              {useVectorMatching ? 'VECTOR' : 'TRADITIONAL'}
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