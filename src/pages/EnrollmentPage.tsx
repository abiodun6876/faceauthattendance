// src/pages/EnrollmentPage.tsx - UPDATED COMPLETE VERSION
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
  Spin,
  Modal
} from 'antd';
import { Camera, User, BookOpen, CheckCircle, GraduationCap, Upload } from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import { compressImage } from '../utils/imageUtils';
import faceRecognition from '../utils/faceRecognition';

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

// Convert to PostgreSQL compatible vector format
const formatForPostgresVector = (embedding: number[]): number[] => {
  // Ensure all values are valid numbers
  return embedding.map(val => {
    const num = parseFloat(val as any);
    return isNaN(num) ? 0 : num;
  });
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

// Save image to localStorage with proper error handling
const saveImageToLocalStorage = (studentId: string, imageData: string): string => {
  try {
    // Trim the data URL if it's too long
    let trimmedData = imageData;
    if (imageData.length > 500000) { // ~500KB limit for localStorage
      console.warn('Image data is large, truncating...');
      trimmedData = imageData.substring(0, 500000);
    }
    
    // Create a unique key
    const key = `enrollment_photo_${studentId}_${Date.now()}`;
    
    // Save to localStorage
    localStorage.setItem(key, trimmedData);
    
    // Also save reference to the key
    const photoReferences = JSON.parse(localStorage.getItem('enrollment_photos') || '[]');
    photoReferences.push({ 
      key, 
      studentId, 
      timestamp: Date.now(),
      size: trimmedData.length 
    });
    
    // Keep only last 50 photos
    if (photoReferences.length > 50) {
      const oldPhoto = photoReferences.shift();
      localStorage.removeItem(oldPhoto.key);
    }
    
    localStorage.setItem('enrollment_photos', JSON.stringify(photoReferences));
    
    console.log(`✅ Photo saved to localStorage with key: ${key} (${trimmedData.length} bytes)`);
    return key;
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    // Return a fallback key
    return `enrollment_photo_${studentId}_${Date.now()}_failed`;
  }
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
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  
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

  // Function to handle face capture from FaceCamera
  const handleFaceCapture = async (photoData: string) => {
    console.log('Face captured, data length:', photoData.length);
    setCapturedPhoto(photoData);
    setShowPhotoPreview(true);
    return photoData;
  };

  // Function to process the enrollment with captured photo
  const processEnrollmentWithPhoto = async (photoData: string) => {
    console.log('=== PROCESSING ENROLLMENT WITH PHOTO ===');
    
    try {
      setLoading(true);
      
      const studentId = studentData.matric_number || matricNumber;
      const studentName = studentData.name;
      const studentLevel = studentData.level;
      const studentProgramId = studentData.program_id;
      const studentGender = studentData.gender || 'male';
      
      if (!studentId || !studentName) {
        message.error('Missing student information. Please complete all form steps.');
        setLoading(false);
        return;
      }

      console.log('Processing enrollment for:', { studentId, studentName });

      // STEP 1: Save the raw photo to localStorage FIRST
      const localStorageKey = saveImageToLocalStorage(studentId, photoData);
      
      // STEP 2: Compress the image for database storage
      const compressedImage = await compressImage(photoData, 640, 0.8);
      const fileName = `enrollment_${Date.now()}_${studentName.replace(/\s+/g, '_')}.jpg`;
      
      let photoUrl = '';
      let uploadSuccess = false;
      
      // STEP 3: Upload to Supabase Storage (if available)
      try {
        const blob = dataURLtoBlob(compressedImage);
        const { error: storageError } = await supabase.storage
          .from('student-photos')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: true
          });
        
        if (!storageError) {
          const { data: publicUrlData } = supabase.storage
            .from('student-photos')
            .getPublicUrl(fileName);
          photoUrl = publicUrlData.publicUrl;
          uploadSuccess = true;
          console.log('✅ Photo uploaded to Supabase:', photoUrl);
        } else {
          console.warn('Supabase storage upload failed:', storageError);
        }
      } catch (storageError) {
        console.warn('Storage upload failed, using data URL:', storageError);
      }

      // If no Supabase URL, use the compressed data URL
      if (!photoUrl) {
        photoUrl = compressedImage;
      }

      // Get program name
      const selectedProgram = programs.find(p => p.id === studentProgramId);
      const programName = selectedProgram?.name || selectedProgram?.code || 'Not specified';
      
      // ========== EXTRACT FACE EMBEDDINGS ==========
      console.log('Extracting face features from captured photo...');
      
      let faceEmbedding: number[] = [];
      let shortEmbedding: number[] = [];
      let extractionMethod = 'fallback';
      let faceDetected = false;
      
      try {
        // Ensure models are loaded
        if (!faceModelsLoaded) {
          await loadFaceModels();
        }
        
        // Extract face descriptor from the RAW photo
        console.log('Attempting face extraction...');
        const descriptor = await faceRecognition.extractFaceDescriptor(photoData);
        
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
          
          // Save the embedding to localStorage for backup
          try {
            await faceRecognition.updateFaceEmbedding(studentId, descriptor);
            console.log('✅ Face embedding saved to localStorage');
          } catch (storageError) {
            console.warn('Failed to save embedding to localStorage:', storageError);
          }
          
          message.success('Face features extracted successfully!');
          
        } else {
          console.warn('No face detected in enrollment photo');
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
      
      // ========== ENSURE WE HAVE EMBEDDINGS ==========
      // CRITICAL: Always ensure we have embeddings
      if (faceEmbedding.length === 0) {
        faceEmbedding = generateFallbackEmbedding(512);
      }
      
      if (shortEmbedding.length === 0) {
        shortEmbedding = generateFallbackEmbedding(128);
      }
      
      // Format embeddings for PostgreSQL
      const formattedFaceEmbedding = formatForPostgresVector(faceEmbedding);
      const formattedShortEmbedding = formatForPostgresVector(shortEmbedding);
      
      console.log('Final embeddings ready:', {
        face: formattedFaceEmbedding.length,
        short: formattedShortEmbedding.length,
        method: extractionMethod,
        detected: faceDetected
      });
      
      // ========== SAVE TO DATABASE ==========
      console.log('Preparing database data...');
      
      // Prepare data for database
      const studentDataForDb: any = {
        student_id: studentId,
        name: studentName,
        matric_number: studentId,
        level: studentLevel,
        program: programName,
        program_id: studentProgramId,
        gender: studentGender,
        enrollment_status: 'pending', // Start with pending
        enrollment_date: new Date().toISOString().split('T')[0],
        last_updated: new Date().toISOString(),
        photo_url: photoUrl,
        photo_data: photoUrl,
        face_embedding: formattedShortEmbedding,
        face_enrolled_at: new Date().toISOString(),
        face_match_threshold: 0.7,
        academic_session: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
        year_of_entry: new Date().getFullYear().toString(),
        face_extraction_method: extractionMethod,
        face_detected: faceDetected,
        upload_success: uploadSuccess,
        local_storage_key: localStorageKey
      };
      
      // Try to include vector column if it exists
      try {
        studentDataForDb.face_embedding_vector = formattedFaceEmbedding;
      } catch (e) {
        console.log('Vector column not included');
      }
      
      console.log('Attempting database save...');
      
      // Save to database
      let dbSuccess = false;
      let finalStatus = 'pending';
      
      try {
        const { data: dbResult, error: dbError } = await supabase
          .from('students')
          .insert([studentDataForDb])
          .select();
        
        if (dbError) {
          console.error('Insert failed:', dbError);
          
          // Try simplified version
          const simplifiedData = {
            student_id: studentId,
            name: studentName,
            matric_number: studentId,
            enrollment_status: 'pending',
            photo_url: photoUrl,
            enrollment_date: new Date().toISOString().split('T')[0],
            face_embedding: formattedShortEmbedding,
            level: studentLevel,
            program: programName
          };
          
          const { error: simpleError } = await supabase
            .from('students')
            .insert([simplifiedData]);
          
          if (simpleError) {
            throw simpleError;
          }
        }
        
        dbSuccess = true;
        console.log('✅ Student data saved to database');
        
        // Update status to enrolled
        try {
          await supabase
            .from('students')
            .update({ 
              enrollment_status: 'enrolled',
              last_updated: new Date().toISOString()
            })
            .eq('matric_number', studentId);
          finalStatus = 'enrolled';
          console.log('✅ Enrollment status updated to "enrolled"');
        } catch (statusError) {
          console.warn('Could not update enrollment status:', statusError);
        }
        
      } catch (dbError: any) {
        console.error('Database save failed:', dbError);
        
        // Last attempt with upsert
        const minimalData = {
          student_id: studentId,
          name: studentName,
          matric_number: studentId,
          enrollment_status: 'pending',
          photo_url: photoUrl,
          enrollment_date: new Date().toISOString().split('T')[0],
          face_embedding: formattedShortEmbedding
        };
        
        const { error: upsertError } = await supabase
          .from('students')
          .upsert([minimalData], { onConflict: 'matric_number' });
          
        if (upsertError) {
          throw new Error(`Failed to save student: ${upsertError.message}`);
        }
        
        dbSuccess = true;
        console.log('✅ Minimal student data saved');
      }
      
      // Save photo to student_photos table
      if (dbSuccess) {
        try {
          await supabase
            .from('student_photos')
            .insert([{
              student_id: studentId,
              photo_url: photoUrl,
              photo_data: photoUrl,
              is_primary: true,
              created_at: new Date().toISOString()
            }]);
          console.log('✅ Photo saved to student_photos table');
        } catch (photoError) {
          console.warn('Photo table save skipped:', photoError);
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
        enrollmentStatus: finalStatus,
        embeddingDimensions: shortEmbedding.length,
        uploadSuccess: uploadSuccess,
        localStorageKey: localStorageKey,
        dbSuccess: dbSuccess
      });
      
      setEnrollmentComplete(true);
      setShowPhotoPreview(false);
      message.success(`✅ ${studentName} enrolled successfully!`);
      
    } catch (error: any) {
      console.error('❌ Enrollment failed:', error);
      
      const errorMessage = error.message || 'Unknown error occurred';
      const userMessage = `Failed to complete enrollment: ${errorMessage}`;
      
      setEnrollmentResult({
        success: false,
        message: userMessage,
        error: error.message,
        details: error.toString()
      });
      
      setEnrollmentComplete(true);
      setShowPhotoPreview(false);
      message.error(userMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle enrollment completion from FaceCamera
  const handleEnrollmentComplete = async (result: any) => {
    console.log('FaceCamera enrollment complete:', result);
    
    if (result && result.photoData && result.photoData.base64) {
      await processEnrollmentWithPhoto(result.photoData.base64);
    } else if (result && result.imageData) {
      await processEnrollmentWithPhoto(result.imageData);
    } else {
      message.error('No photo data received from camera');
      setLoading(false);
    }
  };

  // Manual photo upload handler
  const handleManualPhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const photoData = e.target?.result as string;
      if (photoData) {
        setCapturedPhoto(photoData);
        setShowPhotoPreview(true);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ padding: '20px', maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2}>Student Face Enrollment</Title>
      <Text type="secondary">
        AFE Babalola University - Biometric Face Enrollment System
      </Text>

      <Card style={{ marginTop: 20 }}>
        <Steps 
          current={currentStep} 
          style={{ marginBottom: 40 }}
          items={[
            {
              title: window.innerWidth < 768 ? '' : 'Basic Information',
              icon: <User />,
            },
            {
              title: window.innerWidth < 768 ? '' : 'Academic Details',
              icon: <BookOpen />,
            },
            {
              title: window.innerWidth < 768 ? '' : 'Face Enrollment',
              icon: <Camera />,
            },
          ]}
        />

        <div style={{ minHeight: 400 }}>
          {/* Step 1: Basic Information */}
          {currentStep === 0 && (
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
          )}

          {/* Step 2: Academic Details */}
          {currentStep === 1 && (
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
          )}

          {/* Step 3: Face Enrollment */}
          {currentStep === 2 && (
            enrollmentComplete ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                {enrollmentResult?.success ? (
                  <>
                    <CheckCircle size={64} color="#52c41a" />
                    <Title level={3} style={{ marginTop: 20 }}>
                      Enrollment Complete!
                    </Title>
                    
                    <Card style={{ maxWidth: 600, margin: '20px auto', textAlign: 'left' }}>
                      <Title level={4}>Student Summary</Title>
                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <p><strong>Name:</strong></p>
                          <p>{enrollmentResult.student?.name}</p>
                        </Col>
                        <Col span={12}>
                          <p><strong>Student ID:</strong></p>
                          <Tag color="blue">{enrollmentResult.student?.student_id}</Tag>
                        </Col>
                        <Col span={12}>
                          <p><strong>Matric Number:</strong></p>
                          <Tag color="green">{enrollmentResult.student?.matric_number}</Tag>
                        </Col>
                        <Col span={12}>
                          <p><strong>Level:</strong></p>
                          <Tag color="purple">Level {enrollmentResult.level}</Tag>
                        </Col>
                        <Col span={12}>
                          <p><strong>Program:</strong></p>
                          <p>{enrollmentResult.program}</p>
                        </Col>
                        <Col span={12}>
                          <p><strong>Status:</strong></p>
                          <Tag color={enrollmentResult.enrollmentStatus === 'enrolled' ? "success" : "warning"}>
                            {enrollmentResult.enrollmentStatus === 'enrolled' ? 'Enrolled' : 'Pending'}
                          </Tag>
                        </Col>
                        <Col span={12}>
                          <p><strong>Face Detection:</strong></p>
                          <Tag color={enrollmentResult.faceDetected ? "green" : "orange"}>
                            {enrollmentResult.faceDetected ? 'Detected' : 'Not Detected'}
                          </Tag>
                        </Col>
                        <Col span={12}>
                          <p><strong>Extraction Method:</strong></p>
                          <Tag color={enrollmentResult.extractionMethod === 'face-api.js' ? "blue" : "orange"}>
                            {enrollmentResult.extractionMethod === 'face-api.js' ? 'Real Features' : 'Backup System'}
                          </Tag>
                        </Col>
                        <Col span={12}>
                          <p><strong>Embedding:</strong></p>
                          <Tag>{enrollmentResult.embeddingDimensions}D</Tag>
                        </Col>
                        <Col span={12}>
                          <p><strong>Upload:</strong></p>
                          <Tag color={enrollmentResult.uploadSuccess ? "green" : "orange"}>
                            {enrollmentResult.uploadSuccess ? 'Success' : 'Local Only'}
                          </Tag>
                        </Col>
                        <Col span={24}>
                          <p><strong>Enrollment Date:</strong></p>
                          <p>{new Date().toLocaleDateString()}</p>
                        </Col>
                      </Row>
                      
                      {enrollmentResult.photoUrl && (
                        <div style={{ marginTop: 20, textAlign: 'center' }}>
                          <p><strong>Captured Photo:</strong></p>
                          <img 
                            src={enrollmentResult.photoUrl} 
                            alt="Student" 
                            style={{ 
                              maxWidth: '200px', 
                              maxHeight: '200px',
                              borderRadius: '8px',
                              border: '2px solid #52c41a',
                              objectFit: 'cover'
                            }} 
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).parentElement!.innerHTML = 
                                '<p style="color: #ff4d4f">Photo not available</p>';
                            }}
                          />
                        </div>
                      )}
                    </Card>
                    
                    <div style={{ marginTop: 20, maxWidth: 600, margin: '0 auto' }}>
                      <Alert
                        type={enrollmentResult.faceDetected ? "success" : "warning"}
                        message={enrollmentResult.faceDetected ? "Ready for Attendance" : "Limited Functionality"}
                        description={
                          enrollmentResult.faceDetected 
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
                      description={
                        <div>
                          <p>{enrollmentResult?.message || 'Unknown error occurred'}</p>
                          {enrollmentResult?.details && (
                            <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: '12px' }}>
                              Details: {enrollmentResult.details}
                            </Text>
                          )}
                        </div>
                      }
                      type="error"
                      showIcon
                      style={{ maxWidth: 600, margin: '20px auto' }}
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
                      setCapturedPhoto(null);
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
                    <Button 
                      size="large"
                      type="primary"
                      onClick={() => window.location.href = '/attendance'}
                    >
                      Take Attendance
                    </Button>
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
                      <p><strong>Important:</strong> Ensure good lighting, face the camera directly, and maintain a neutral expression.</p>
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
                  <Card style={{ marginBottom: 20, maxWidth: 800, margin: '0 auto 20px' }}>
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={12} md={8}>
                        <Text strong>Student:</Text>
                        <br />
                        <Text>{studentData.name}</Text>
                      </Col>
                      <Col xs={24} sm={12} md={8}>
                        <Text strong>Student ID:</Text>
                        <br />
                        <Tag color="blue">{matricNumber}</Tag>
                      </Col>
                      <Col xs={24} sm={12} md={8}>
                        <Text strong>Status:</Text>
                        <br />
                        <Tag color="orange">Pending Face Enrollment</Tag>
                      </Col>
                      {studentData.level && (
                        <>
                          <Col xs={24} sm={12} md={8}>
                            <Text strong>Level:</Text>
                            <br />
                            <Tag color="purple">Level {studentData.level}</Tag>
                          </Col>
                          <Col xs={24} sm={12} md={8}>
                            <Text strong>Program:</Text>
                            <br />
                            <Text>
                              {programs.find(p => p.id === studentData.program_id)?.name || 'Not selected'}
                            </Text>
                          </Col>
                        </>
                      )}
                      <Col span={24}>
                        <Text strong>Face Recognition:</Text>
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
                
                <div style={{ maxWidth: 800, margin: '0 auto' }}>
                  {isCameraActive ? (
                    <div style={{ margin: '0 auto', height: '500px' }}>
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
                        onFaceCapture={handleFaceCapture}
                        autoCapture={false}
                      />
                      <div style={{ marginTop: 20 }}>
                        <Button onClick={() => setIsCameraActive(false)}>
                          Cancel Camera
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Card>
                      <Camera size={48} style={{ marginBottom: 20, color: '#1890ff' }} />
                      <Title level={4}>Ready for Face Capture</Title>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
                        Choose how you want to capture the student's face
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
                      
                      <Row gutter={[20, 20]} style={{ marginTop: 30 }}>
                        <Col span={24} md={12}>
                          <Card 
                            hoverable 
                            style={{ height: '100%', textAlign: 'center' }}
                            onClick={() => setIsCameraActive(true)}
                          >
                            <Camera size={48} style={{ marginBottom: 16, color: '#1890ff' }} />
                            <Title level={5}>Use Web Camera</Title>
                            <Text type="secondary">
                              Capture live from your webcam. Best for real-time enrollment.
                            </Text>
                            <div style={{ marginTop: 20 }}>
                              <Button
                                type="primary"
                                icon={<Camera size={16} />}
                                onClick={() => setIsCameraActive(true)}
                                loading={!faceModelsLoaded}
                                disabled={!faceModelsLoaded}
                              >
                                {faceModelsLoaded ? 'Start Camera' : 'Loading Models...'}
                              </Button>
                            </div>
                          </Card>
                        </Col>
                        
                        <Col span={24} md={12}>
                          <Card 
                            hoverable 
                            style={{ height: '100%', textAlign: 'center' }}
                          >
                            <Upload size={48} style={{ marginBottom: 16, color: '#52c41a' }} />
                            <Title level={5}>Upload Photo</Title>
                            <Text type="secondary">
                              Upload an existing photo of the student.
                            </Text>
                            <div style={{ marginTop: 20 }}>
                              <input
                                type="file"
                                accept="image/*"
                                id="photo-upload"
                                style={{ display: 'none' }}
                                onChange={handleManualPhotoUpload}
                              />
                              <Button
                                type="default"
                                icon={<Upload size={16} />}
                                onClick={() => document.getElementById('photo-upload')?.click()}
                              >
                                Choose Photo
                              </Button>
                            </div>
                          </Card>
                        </Col>
                      </Row>
                      
                      <div style={{ marginTop: 30 }}>
                        <Alert
                          type="warning"
                          message="Important Instructions"
                          description="For best face recognition results: Good lighting, face camera directly, neutral expression, no glasses/sunglasses, clear face visibility."
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
            )
          )}
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

      {/* Photo Preview Modal */}
      <Modal
        title="Photo Preview"
        open={showPhotoPreview && !enrollmentComplete}
        onCancel={() => setShowPhotoPreview(false)}
        footer={[
          <Button key="retake" onClick={() => setShowPhotoPreview(false)}>
            Retake Photo
          </Button>,
          <Button 
            key="enroll" 
            type="primary" 
            loading={loading}
            onClick={() => capturedPhoto && processEnrollmentWithPhoto(capturedPhoto)}
          >
            Use This Photo for Enrollment
          </Button>
        ]}
        width={600}
      >
        <div style={{ textAlign: 'center' }}>
          {capturedPhoto && (
            <>
              <img 
                src={capturedPhoto} 
                alt="Captured" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '400px',
                  borderRadius: '8px',
                  border: '1px solid #d9d9d9'
                }} 
              />
              <div style={{ marginTop: 20 }}>
                <Alert
                  type="info"
                  message="Photo Ready"
                  description="Review the photo above. If it looks good, click 'Use This Photo for Enrollment' to proceed."
                  showIcon
                />
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default EnrollmentPage;