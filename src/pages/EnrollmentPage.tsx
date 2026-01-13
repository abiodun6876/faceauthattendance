// src/pages/EnrollmentPage.tsx - UPDATED WITH REAL FACE EMBEDDINGS
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Select, 
  Button, 
  Typography, 
  Space,
  Alert,
  message,
  Row,
  Col,
  Steps,
  Tag,
  Spin
} from 'antd';
import { Camera, User, BookOpen, CheckCircle, GraduationCap } from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import { compressImage } from '../utils/imageUtils';
import faceRecognition from '../utils/faceRecognition'; // IMPORT FACE RECOGNITION

const { Title, Text } = Typography;

// Helper function to generate short embedding from full embedding
const generateShortEmbedding = (fullEmbedding: number[], targetDimensions: number): number[] => {
  if (!fullEmbedding || fullEmbedding.length <= targetDimensions) {
    return fullEmbedding || [];
  }
  
  const result: number[] = [];
  const segmentSize = fullEmbedding.length / targetDimensions;
  
  for (let i = 0; i < targetDimensions; i++) {
    const start = Math.floor(i * segmentSize);
    const end = Math.floor((i + 1) * segmentSize);
    const segment = fullEmbedding.slice(start, end);
    const average = segment.reduce((sum, val) => sum + val, 0) / segment.length;
    result.push(parseFloat(average.toFixed(6)));
  }
  
  return result;
};

// Fallback function for when face extraction fails
const generateFallbackEmbedding = (dimensions = 512): number[] => {
  const embedding = [];
  for (let i = 0; i < dimensions; i++) {
    embedding.push(parseFloat((Math.random() * 2 - 1).toFixed(6)));
  }
  return embedding;
};

const EnrollmentPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [studentData, setStudentData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [academicForm] = Form.useForm();
  const [enrollmentComplete, setEnrollmentComplete] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [matricNumber, setMatricNumber] = useState<string>('');
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  
  // State for fetched data
  const [programs, setPrograms] = useState<any[]>([]);
  const [levels] = useState([
    { value: 100, label: '100 Level' },
    { value: 200, label: '200 Level' },
    { value: 300, label: '300 Level' },
    { value: 400, label: '400 Level' },
    { value: 500, label: '500 Level' },
  ]);

  const generateMatricNumber = () => {
    const currentYear = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ABU/${currentYear}/${randomNum}`;
  };

  // Load face recognition models
  const loadFaceModels = async () => {
    if (faceModelsLoaded) return;
    
    try {
      message.loading({ content: 'Loading face recognition models...', key: 'loading-models', duration: 0 });
      await faceRecognition.loadModels();
      setFaceModelsLoaded(true);
      message.success({ content: 'Face models loaded successfully', key: 'loading-models' });
    } catch (error: any) {
      console.error('Failed to load face models:', error);
      message.error({ 
        content: `Face models failed to load. Enrollment will use backup system: ${error.message}`,
        key: 'loading-models',
        duration: 5
      });
    }
  };

  // Fetch programs
  const fetchPrograms = async () => {
    try {
      const { data: programsData, error: programsError } = await supabase
        .from('programs')
        .select('id, code, name, short_name')
        .eq('is_active', true)
        .order('name');

      if (programsError) {
        console.warn('Programs table may not exist, using defaults:', programsError);
        setPrograms([
          { id: '1', code: 'CSC', name: 'Computer Science', short_name: 'CS' },
          { id: '2', code: 'EEE', name: 'Electrical Engineering', short_name: 'EE' },
          { id: '3', code: 'MED', name: 'Medicine', short_name: 'MD' },
          { id: '4', code: 'LAW', name: 'Law', short_name: 'LW' },
        ]);
        return;
      }

      setPrograms(programsData || []);
      console.log('Fetched programs:', programsData?.length || 0);
    } catch (error: any) {
      console.error('Error fetching programs:', error);
      setPrograms([
        { id: '1', code: 'CSC', name: 'Computer Science', short_name: 'CS' },
        { id: '2', code: 'EEE', name: 'Electrical Engineering', short_name: 'EE' },
        { id: '3', code: 'MED', name: 'Medicine', short_name: 'MD' },
        { id: '4', code: 'LAW', name: 'Law', short_name: 'LW' },
      ]);
      message.warning('Using default program options');
    }
  };

  // Generate matric number when component mounts
  useEffect(() => {
    const newMatric = generateMatricNumber();
    setMatricNumber(newMatric);
    form.setFieldValue('matric_number', newMatric);
    fetchPrograms();
    
    // Preload face models when user reaches step 2
    if (currentStep >= 1) {
      loadFaceModels();
    }
  }, [form, currentStep]);

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields();
        const values = form.getFieldsValue();
        
        if (!values.matric_number?.trim()) {
          const newMatric = generateMatricNumber();
          values.matric_number = newMatric;
          setMatricNumber(newMatric);
          form.setFieldValue('matric_number', newMatric);
        }

        console.log('Proceeding with values:', values);
        setStudentData(values);
        setCurrentStep(1);
        
        // Preload face models when moving to step 1
        loadFaceModels();
        
      } else if (currentStep === 1) {
        await academicForm.validateFields();
        const academicValues = await academicForm.getFieldsValue();
        setStudentData((prev: any) => ({ ...prev, ...academicValues }));
        setCurrentStep(2);
        
        // Ensure face models are loaded
        loadFaceModels();
      }
    } catch (error: any) {
      console.error('Error in handleNext:', error);
      const errorMessages = error.errorFields?.map((f: any) => f.errors.join(', ')).join('; ');
      message.error(errorMessages || 'Please fix form errors');
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleRegenerateMatric = () => {
    const newMatric = generateMatricNumber();
    setMatricNumber(newMatric);
    form.setFieldValue('matric_number', newMatric);
    message.success('New matric number generated');
  };

  // Helper function to convert data URL to blob
  const dataURLtoBlob = (dataURL: string): Blob => {
    try {
      const arr = dataURL.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(arr[1]);
      const u8arr = new Uint8Array(bstr.length);
      
      for (let i = 0; i < bstr.length; i++) {
        u8arr[i] = bstr.charCodeAt(i);
      }
      
      return new Blob([u8arr], { type: mime });
    } catch (error) {
      console.error('Error converting dataURL to blob:', error);
      throw error;
    }
  };

  const handleEnrollmentComplete = async (result: any) => {
    console.log('=== ENROLLMENT COMPLETE TRIGGERED ===');
    
    try {
      if (!result.success || !result.photoData) {
        console.error('Result missing success or photoData:', result);
        message.error('Failed to capture image');
        return;
      }

      setLoading(true);

      const enrollmentStudent = result.studentData || result.student || studentData;
      const studentId = enrollmentStudent?.matric_number || result.matricNumber || matricNumber;
      const studentName = enrollmentStudent?.name || result.studentName || studentData.name;
      const studentLevel = enrollmentStudent?.level || studentData.level;
      const studentProgramId = enrollmentStudent?.program_id || studentData.program_id;
      const studentGender = enrollmentStudent?.gender || studentData.gender || 'male';
      
      if (!studentId || !studentName) {
        message.error('Missing student information. Please complete all form steps.');
        setLoading(false);
        return;
      }

      // Compress the image
      const compressedImage = await compressImage(result.photoData.base64, 640, 0.8);
      const fileName = `enrollment_${Date.now()}_${studentName.replace(/\s+/g, '_')}.jpg`;
      
      try {
        let photoUrl = '';
        
        // Upload to Supabase Storage
        try {
          const { error: storageError } = await supabase.storage
            .from('student-photos')
            .upload(fileName, dataURLtoBlob(compressedImage), {
              contentType: 'image/jpeg',
              upsert: true
            });
          
          if (!storageError) {
            const { data: publicUrlData } = supabase.storage
              .from('student-photos')
              .getPublicUrl(fileName);
            photoUrl = publicUrlData.publicUrl;
          }
        } catch (storageError) {
          console.warn('Storage upload failed:', storageError);
        }

        if (!photoUrl) {
          photoUrl = compressedImage;
        }
        
        // Get program name
        const selectedProgram = programs.find(p => p.id === studentProgramId);
        const programName = selectedProgram?.name || selectedProgram?.code || 'Not specified';
        
        // ========== EXTRACT REAL FACE EMBEDDINGS ==========
        console.log('Extracting face features from captured photo...');
        
        let faceEmbedding: number[] | null = null;
        let shortEmbedding: number[] | null = null;
        let extractionMethod = 'fallback';
        let faceDetected = false;
        
        try {
          // Ensure models are loaded
          if (!faceModelsLoaded) {
            await loadFaceModels();
          }
          
          // Extract REAL face descriptor from the captured photo
          const descriptor = await faceRecognition.extractFaceDescriptor(compressedImage);
          
          if (descriptor) {
            faceDetected = true;
            extractionMethod = 'face-api.js';
            
            // Convert Float32Array to number[] (512 dimensions)
            faceEmbedding = Array.from(descriptor);
            
            console.log('✅ REAL face embedding extracted:', {
              dimensions: faceEmbedding.length,
              sample: faceEmbedding.slice(0, 5)
            });
            
            // Generate shorter embedding (128 dimensions) for face_embedding field
            shortEmbedding = generateShortEmbedding(faceEmbedding, 128);
            
            console.log('✅ Short embedding created:', {
              dimensions: shortEmbedding.length,
              sample: shortEmbedding.slice(0, 5)
            });
            
            // Save the embedding to localStorage as backup
            await faceRecognition.updateFaceEmbedding(studentId, descriptor);
            
            message.success('Face features extracted successfully!');
            
          } else {
            console.warn('No face detected in enrollment photo');
            message.warning('No face detected. Using backup embedding system.');
            throw new Error('No face detected');
          }
          
        } catch (faceError: any) {
          console.error('Face extraction failed:', faceError.message);
          
          // Use fallback embeddings if face extraction fails
          extractionMethod = 'fallback';
          faceEmbedding = generateFallbackEmbedding(512);
          shortEmbedding = generateFallbackEmbedding(128);
          
          console.log('⚠️ Using fallback embeddings:', {
            method: extractionMethod,
            faceEmbeddingLength: faceEmbedding?.length,
            shortEmbeddingLength: shortEmbedding?.length
          });
          
          message.warning('Face extraction failed. Using backup embedding system.');
        }
        // ========== END FACE EXTRACTION ==========
        
        // Prepare data for database
        const studentDataForDb = {
          student_id: studentId,
          name: studentName,
          matric_number: studentId,
          level: studentLevel,
          program: programName,
          program_id: studentProgramId,
          gender: studentGender,
          enrollment_status: 'enrolled',
          enrollment_date: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          photo_url: photoUrl,
          photo_data: photoUrl,
          face_embedding: shortEmbedding || generateFallbackEmbedding(128),
          face_embedding_vector: faceEmbedding || generateFallbackEmbedding(512),
          face_enrolled_at: new Date().toISOString(),
          face_match_threshold: 0.7,
          academic_session: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
          year_of_entry: new Date().getFullYear(),
          face_extraction_method: extractionMethod,
          face_detected: faceDetected
        };
        
        console.log('Data being sent to database:', {
          studentName,
          studentId,
          embeddingMethod: extractionMethod,
          faceDetected,
          faceEmbeddingLength: studentDataForDb.face_embedding_vector?.length,
          shortEmbeddingLength: studentDataForDb.face_embedding?.length
        });
        
        // Insert into database
        try {
          const { data: dbResult, error: dbError } = await supabase
            .from('students')
            .upsert([studentDataForDb], { 
              onConflict: 'matric_number'
            })
            .select();
          
          if (dbError) {
            console.error('Database error:', dbError);
            
            if (dbError.message.includes('vector') || dbError.message.includes('dimension')) {
              console.log('Vector error detected. Trying alternative approach...');
              
              // Try without vector column
              const { face_embedding_vector, ...dataWithoutVector } = studentDataForDb;
              const { error: insertError } = await supabase
                .from('students')
                .upsert([dataWithoutVector], { 
                  onConflict: 'matric_number'
                });
              
              if (insertError) throw insertError;
              
              // Update vector column separately
              const { error: vectorError } = await supabase
                .from('students')
                .update({ 
                  face_embedding_vector: faceEmbedding || generateFallbackEmbedding(512),
                  face_extraction_method: extractionMethod,
                  face_detected: faceDetected
                })
                .eq('matric_number', studentId);
              
              if (vectorError) {
                console.warn('Could not update vector column:', vectorError);
              }
            } else {
              throw dbError;
            }
          } else {
            console.log('✅ Direct insert successful');
          }
        } catch (dbError: any) {
          console.error('Database operation failed:', dbError);
          throw dbError;
        }
        
        // Save photo to student_photos table
        try {
          await supabase
            .from('student_photos')
            .insert([{
              student_id: studentId,
              photo_url: photoUrl,
              is_primary: true,
              created_at: new Date().toISOString()
            }]);
          console.log('✅ Photo saved to student_photos table');
        } catch (photoError) {
          console.warn('Photo table save skipped:', photoError);
        }
        
        // Verify the data was saved
        console.log('Verifying saved data...');
        const { data: verifyData, error: verifyError } = await supabase
          .from('students')
          .select('matric_number, face_embedding, face_embedding_vector, enrollment_status, face_extraction_method, face_detected')
          .eq('matric_number', studentId)
          .single();
        
        if (!verifyError && verifyData) {
          console.log('Verified student data:', {
            face_embedding: verifyData.face_embedding ? `${verifyData.face_embedding.length} dimensions` : 'NO',
            face_embedding_vector: verifyData.face_embedding_vector ? `${verifyData.face_embedding_vector.length} dimensions` : 'NO',
            extractionMethod: verifyData.face_extraction_method,
            faceDetected: verifyData.face_detected
          });
          
          // Test vector similarity function if vector was saved
          if (verifyData.face_embedding_vector) {
            console.log('Testing vector similarity function...');
            try {
              const { data: similarityTest, error: testError } = await supabase.rpc('match_faces', {
                query_embedding: verifyData.face_embedding_vector,
                match_threshold: 0.9,
                match_count: 1
              });
              
              if (!testError && similarityTest && similarityTest.length > 0) {
                console.log('✅ Vector similarity test passed!');
              }
            } catch (testError) {
              console.warn('Vector test failed:', testError);
            }
          }
        }
        
        // Set success result
        setEnrollmentResult({
          success: true,
          message: 'Enrollment completed successfully!',
          student: {
            name: studentName,
            student_id: studentId,
            matric_number: studentId
          },
          level: studentLevel,
          program: programName,
          photoUrl: photoUrl,
          faceCaptured: true,
          faceDetected: faceDetected,
          extractionMethod: extractionMethod,
          vectorSaved: verifyData?.face_embedding_vector ? true : false,
          embeddingDimensions: verifyData?.face_embedding_vector?.length || 0
        });
        
        setEnrollmentComplete(true);
        message.success(`✅ ${studentName} enrolled successfully!`);
        
      } catch (error: any) {
        console.error('❌ Enrollment failed:', error);
        setEnrollmentResult({
          success: false,
          message: `Failed to complete enrollment: ${error.message}`,
          error: error.message
        });
        setEnrollmentComplete(true);
        message.error(`Enrollment failed: ${error.message}`);
      }
      
    } catch (error: any) {
      console.error('❌ Critical error:', error);
      setEnrollmentResult({
        success: false,
        message: `Failed to complete enrollment: ${error.message}`
      });
      setEnrollmentComplete(true);
      message.error(`Failed to complete enrollment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const stepItems = [
    {
      title: 'Basic Information',
      icon: <User />,
      content: (
        <div>
          <Alert
            message="Student Information"
            description="Fill in the student's basic details. Matric number will be auto-generated."
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
          
          <Form
            form={form}
            layout="vertical"
            style={{ maxWidth: 600, margin: '0 auto' }}
            initialValues={{ gender: 'male' }}
          >
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  label="Full Name *"
                  name="name"
                  rules={[
                    { 
                      required: true, 
                      message: 'Please enter student name',
                      whitespace: true
                    },
                    { 
                      min: 3, 
                      message: 'Name must be at least 3 characters' 
                    }
                  ]}
                  validateTrigger={['onChange', 'onBlur']}
                >
                  <Input 
                    placeholder="Enter student full name" 
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  label="Matriculation Number *"
                  name="matric_number"
                  tooltip="This will also be used as Student ID"
                >
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Input
                      value={matricNumber}
                      readOnly
                      size="large"
                      style={{ 
                        flex: 1,
                        textTransform: 'uppercase',
                        backgroundColor: '#fafafa',
                        cursor: 'not-allowed'
                      }}
                      prefix={<GraduationCap size={16} />}
                    />
                    <Button
                      type="default"
                      size="large"
                      onClick={handleRegenerateMatric}
                    >
                      Regenerate
                    </Button>
                  </div>
                  <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                    Matric number is auto-generated. Click "Regenerate" for a new number.
                  </Text>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item label="Gender" name="gender">
                  <Select placeholder="Select gender" size="large">
                    <Select.Option value="male">Male</Select.Option>
                    <Select.Option value="female">Female</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      ),
    },
    {
      title: 'Academic Details',
      icon: <BookOpen />,
      content: (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <Alert
            message="Academic Information"
            description="Select the student's academic program and level (Required for attendance tracking)"
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
          
          {programs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <Text style={{ display: 'block', marginTop: 16 }}>
                Loading programs...
              </Text>
            </div>
          ) : (
            <Form
              form={academicForm}
              layout="vertical"
              initialValues={{ level: 100 }}
            >
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Form.Item 
                    label="Level *" 
                    name="level"
                    rules={[{ required: true, message: 'Please select level' }]}
                    help="Required for course filtering in attendance"
                  >
                    <Select 
                      placeholder="Select level" 
                      size="large"
                      options={levels.map(level => ({
                        value: level.value,
                        label: level.label
                      }))}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Form.Item 
                    label="Program *" 
                    name="program_id"
                    rules={[{ required: true, message: 'Please select program' }]}
                    help="Required for attendance reporting"
                  >
                    <Select 
                      placeholder="Select program" 
                      size="large"
                      showSearch
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={programs.map(program => ({
                        value: program.id,
                        label: `${program.code} - ${program.name}${program.short_name ? ` (${program.short_name})` : ''}`,
                      }))}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ marginTop: 30, textAlign: 'center' }}>
                <Alert
                  type="warning"
                  message="Important for Attendance"
                  description="Level and Program information are required for attendance tracking and reporting."
                  showIcon
                />
              </div>
            </Form>
          )}
          
          {/* Face model loading status */}
          <div style={{ marginTop: 20 }}>
            <Alert
              type={faceModelsLoaded ? "success" : "info"}
              message="Face Recognition Status"
              description={
                faceModelsLoaded 
                  ? "✅ Face recognition models are loaded and ready for enrollment"
                  : "Loading face recognition models... (Required for face enrollment)"
              }
              showIcon
            />
          </div>
        </div>
      ),
    },
    {
      title: 'Face Enrollment',
      icon: <Camera />,
      content: enrollmentComplete ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          {enrollmentResult?.success ? (
            <>
              <CheckCircle size={64} color="#52c41a" />
              <Title level={3} style={{ marginTop: 20 }}>
                Enrollment Complete!
              </Title>
              
              <Card style={{ maxWidth: 500, margin: '20px auto', textAlign: 'left' }}>
                <Title level={4}>Student Summary</Title>
                <p><strong>Name:</strong> {enrollmentResult.student?.name}</p>
                <p><strong>Student ID:</strong> 
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    {enrollmentResult.student?.student_id}
                  </Tag>
                </p>
                <p><strong>Matric Number:</strong> 
                  <Tag color="green" style={{ marginLeft: 8 }}>
                    {enrollmentResult.student?.matric_number}
                  </Tag>
                </p>
                <p><strong>Level:</strong> 
                  <Tag color="purple" style={{ marginLeft: 8 }}>
                    Level {enrollmentResult.level}
                  </Tag>
                </p>
                <p><strong>Program:</strong> {enrollmentResult.program}</p>
                <p><strong>Status:</strong> <Tag color="success">Enrolled</Tag></p>
                <p><strong>Face Detection:</strong> 
                  <Tag color={enrollmentResult?.faceDetected ? "green" : "orange"} style={{ marginLeft: 8 }}>
                    {enrollmentResult?.faceDetected ? 'Face Detected' : 'No Face'}
                  </Tag>
                </p>
                <p><strong>Extraction Method:</strong> 
                  <Tag color={enrollmentResult?.extractionMethod === 'face-api.js' ? "blue" : "orange"} style={{ marginLeft: 8 }}>
                    {enrollmentResult?.extractionMethod === 'face-api.js' ? 'Real Face Features' : 'Backup System'}
                  </Tag>
                </p>
                <p><strong>Embedding Dimensions:</strong> 
                  <Tag style={{ marginLeft: 8 }}>
                    {enrollmentResult?.embeddingDimensions || 0}D
                  </Tag>
                </p>
                <p><strong>Vector Saved:</strong> 
                  <Tag color={enrollmentResult?.vectorSaved ? "green" : "orange"} style={{ marginLeft: 8 }}>
                    {enrollmentResult?.vectorSaved ? 'Vector Saved' : 'Vector Not Saved'}
                  </Tag>
                </p>
                <p><strong>Enrollment Date:</strong> {new Date().toLocaleDateString()}</p>
                
                {enrollmentResult.photoUrl && (
                  <div style={{ marginTop: 20, textAlign: 'center' }}>
                    <p><strong>Captured Photo:</strong></p>
                    <img 
                      src={enrollmentResult.photoUrl} 
                      alt="Student" 
                      style={{ 
                        maxWidth: '150px', 
                        borderRadius: '8px',
                        border: '2px solid #52c41a'
                      }} 
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </Card>
              
              <div style={{ marginTop: 20, maxWidth: 500, margin: '0 auto' }}>
                <Alert
                  type={enrollmentResult?.faceDetected ? "success" : "warning"}
                  message={enrollmentResult?.faceDetected ? "Ready for Attendance" : "Limited Functionality"}
                  description={
                    enrollmentResult?.faceDetected 
                      ? "This student can now be recognized by the face attendance system."
                      : "Face was not detected during enrollment. Attendance may require manual verification."
                  }
                  showIcon
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ color: '#ff4d4f', marginBottom: 20 }}>
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <circle cx="32" cy="32" r="30" stroke="#ff4d4f" strokeWidth="2"/>
                  <path d="M22 22L42 42M42 22L22 42" stroke="#ff4d4f" strokeWidth="4" strokeLinecap="round"/>
                </svg>
              </div>
              <Title level={3} style={{ marginTop: 20 }}>
                Enrollment Failed
              </Title>
              <Alert
                message="Error"
                description={enrollmentResult?.message || 'Unknown error occurred'}
                type="error"
                showIcon
                style={{ maxWidth: 500, margin: '20px auto' }}
              />
            </>
          )}
          
          <Space style={{ marginTop: 30 }}>
            <Button
              type="primary"
              size="large"
              onClick={() => {
                const newMatric = generateMatricNumber();
                setMatricNumber(newMatric);
                form.setFieldValue('matric_number', newMatric);
                
                setCurrentStep(0);
                setEnrollmentComplete(false);
                setEnrollmentResult(null);
                form.resetFields();
                academicForm.resetFields();
                setStudentData({});
                setIsCameraActive(false);
                
                form.setFieldsValue({
                  gender: 'male',
                  matric_number: newMatric
                });
                
                academicForm.setFieldsValue({
                  level: 100
                });
              }}
            >
              {enrollmentResult?.success ? 'Enroll Another Student' : 'Try Again'}
            </Button>
            {enrollmentResult?.success && (
              <>
                
                <Button 
                  size="large"
                  type="primary"
                  onClick={() => window.location.href = '/attendance'}
                >
                  Take Attendance
                </Button>
              </>
            )}
          </Space>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <Alert
            message="Face Enrollment"
            description={
              <div>
                <p>Capture facial data for biometric authentication.</p>
                <p><strong>Important:</strong> Ensure good lighting, remove glasses if possible, and face the camera directly.</p>
                <p>Face models status: 
                  <Tag color={faceModelsLoaded ? "green" : "orange"} style={{ marginLeft: 8 }}>
                    {faceModelsLoaded ? 'Ready' : 'Loading...'}
                  </Tag>
                </p>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
          
          {studentData.name && (
            <Card style={{ marginBottom: 20, maxWidth: 600, margin: '0 auto 20px' }}>
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Text strong>Student: </Text>
                  <br />
                  <Text>{studentData.name}</Text>
                </Col>
                <Col span={8}>
                  <Text strong>Student ID: </Text>
                  <br />
                  <Tag color="blue">{matricNumber}</Tag>
                </Col>
                <Col span={8}>
                  <Text strong>Status: </Text>
                  <br />
                  <Tag color="orange">Pending Face Enrollment</Tag>
                </Col>
              </Row>
              {studentData.level && (
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                  <Col span={12}>
                    <Text strong>Level: </Text>
                    <br />
                    <Tag color="purple">Level {studentData.level}</Tag>
                  </Col>
                  <Col span={12}>
                    <Text strong>Program: </Text>
                    <br />
                    <Text>
                      {programs.find(p => p.id === studentData.program_id)?.name || 'Not selected'}
                    </Text>
                  </Col>
                </Row>
              )}
              
              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                  <Text strong>Face Recognition: </Text>
                  <br />
                  <Space>
                    <Tag color={faceModelsLoaded ? "green" : "orange"}>
                      {faceModelsLoaded ? 'Models Loaded' : 'Loading Models...'}
                    </Tag>
                    {!faceModelsLoaded && (
                      <Button 
                        size="small" 
                        onClick={loadFaceModels}
                        loading={!faceModelsLoaded}
                      >
                        Reload Models
                      </Button>
                    )}
                  </Space>
                </Col>
              </Row>
            </Card>
          )}
          
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {isCameraActive ? (
              <div style={{ maxWidth: 800, margin: '0 auto', height: '600px' }}>
                <FaceCamera
                  mode="enrollment"
                  student={{
                    id: studentData.matric_number || matricNumber,
                    name: studentData.name,
                    matric_number: studentData.matric_number || matricNumber,
                    level: studentData.level,
                    program_id: studentData.program_id,
                    gender: studentData.gender || 'male'
                  }}
                  onEnrollmentComplete={handleEnrollmentComplete}
                  autoCapture={false}
                />
              </div>
            ) : (
              <Card>
                <Camera size={48} style={{ marginBottom: 20, color: '#1890ff' }} />
                <Title level={4}>Ready for Face Capture</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
                  Ensure good lighting and face the camera directly. Click below to start.
                </Text>
                
                <div style={{ marginBottom: 20 }}>
                  <Alert
                    type={faceModelsLoaded ? "success" : "warning"}
                    message={faceModelsLoaded ? "Face Recognition Ready" : "Face Recognition Loading"}
                    description={
                      faceModelsLoaded 
                        ? "Face recognition models are loaded. Real facial features will be extracted."
                        : "Models are still loading. Please wait or proceed with backup system."
                    }
                    showIcon
                  />
                </div>
                
                <Button
                  type="primary"
                  size="large"
                  icon={<Camera size={20} />}
                  onClick={() => setIsCameraActive(true)}
                  loading={loading || !faceModelsLoaded}
                  disabled={!faceModelsLoaded && loading}
                  style={{ marginBottom: 10 }}
                >
                  {faceModelsLoaded ? 'Start Face Enrollment' : 'Loading Face Models...'}
                </Button>
                
                {!faceModelsLoaded && (
                  <div style={{ marginTop: 10 }}>
                    <Button 
                      onClick={loadFaceModels}
                      loading={!faceModelsLoaded}
                    >
                      Force Load Models
                    </Button>
                  </div>
                )}
                
                <div style={{ marginTop: 20 }}>
                  <Alert
                    type="warning"
                    message="Important for Attendance"
                    description="Face data is required for biometric attendance marking. For best results: good lighting, face camera directly, neutral expression."
                    style={{ marginBottom: 20 }}
                  />
                  
                  <div style={{ marginTop: 20 }}>
                    <Button onClick={handleBack}>
                      Back to Previous Step
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Student Face Enrollment</Title>
      <Text type="secondary">
        AFE Babalola University - Biometric Face Enrollment System
      </Text>

      <Card style={{ marginTop: 20 }}>
        <Steps 
          current={currentStep} 
          style={{ marginBottom: 40 }}
          items={stepItems.map((item, index) => ({
            key: index,
            title: window.innerWidth < 768 ? '' : item.title,
            icon: item.icon,
          }))}
        />

        <div style={{ minHeight: 400 }}>
          {stepItems[currentStep].content}
        </div>

        {!enrollmentComplete && currentStep < 2 && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Space>
              {currentStep > 0 && (
                <Button onClick={handleBack} size="large">
                  Back
                </Button>
              )}
              <Button 
                type="primary" 
                onClick={handleNext} 
                size="large"
                loading={loading}
                disabled={currentStep === 1 && !faceModelsLoaded}
              >
                {currentStep === 1 ? 'Proceed to Face Enrollment' : 'Next'}
              </Button>
            </Space>
            
            {currentStep === 1 && !faceModelsLoaded && (
              <div style={{ marginTop: 10 }}>
                <Text type="warning">
                  Face models are loading. Please wait or reload models.
                </Text>
                <br />
                <Button 
                  size="small" 
                  onClick={loadFaceModels}
                  style={{ marginTop: 5 }}
                >
                  Reload Face Models
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default EnrollmentPage;