// src/pages/EnrollmentPage.tsx - SIMPLIFIED & WORKING VERSION
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
  Modal,
  Divider
} from 'antd';
import { 
  Camera, 
  User, 
  BookOpen, 
  CheckCircle, 
  GraduationCap, 
  Upload,
  IdCard,
  Building,
  Hash
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import { compressImage } from '../utils/imageUtils';
import faceRecognition from '../utils/faceRecognition';

const { Title, Text } = Typography;


// Helper functions
const generateMatricNumber = () => {
  const currentYear = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ABU/${currentYear}/${randomNum}`;
};

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

const formatForPostgresVector = (embedding: number[]): number[] => {
  return embedding.map(val => {
    const num = parseFloat(val as any);
    return isNaN(num) ? 0 : num;
  });
};

const dataURLtoBlob = (dataURL: string): Blob => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  
  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  
  return new Blob([u8arr], { type: mime });
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
  const [programs, setPrograms] = useState<any[]>([]);

  const levels = [
    { value: 100, label: '100 Level' },
    { value: 200, label: '200 Level' },
    { value: 300, label: '300 Level' },
    { value: 400, label: '400 Level' },
    { value: 500, label: '500 Level' },
  ];

  // Load face recognition models
  const loadFaceModels = async () => {
    if (faceModelsLoaded) return;
    
    try {
      await faceRecognition.loadModels();
      setFaceModelsLoaded(true);
    } catch (error: any) {
      console.error('Failed to load face models:', error);
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
        setPrograms([
          { id: '1', code: 'CSC', name: 'Computer Science', short_name: 'CS' },
          { id: '2', code: 'EEE', name: 'Electrical Engineering', short_name: 'EE' },
          { id: '3', code: 'MED', name: 'Medicine', short_name: 'MD' },
          { id: '4', code: 'LAW', name: 'Law', short_name: 'LW' },
        ]);
        return;
      }

      setPrograms(programsData || []);
    } catch (error) {
      setPrograms([
        { id: '1', code: 'CSC', name: 'Computer Science', short_name: 'CS' },
        { id: '2', code: 'EEE', name: 'Electrical Engineering', short_name: 'EE' },
        { id: '3', code: 'MED', name: 'Medicine', short_name: 'MD' },
        { id: '4', code: 'LAW', name: 'Law', short_name: 'LW' },
      ]);
    }
  };

  // Initialize
  useEffect(() => {
    const newMatric = generateMatricNumber();
    setMatricNumber(newMatric);
    form.setFieldValue('matric_number', newMatric);
    fetchPrograms();
    
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

        setStudentData(values);
        setCurrentStep(1);
        loadFaceModels();
        
      } else if (currentStep === 1) {
        await academicForm.validateFields();
        const academicValues = await academicForm.getFieldsValue();
        setStudentData((prev: any) => ({ ...prev, ...academicValues }));
        setCurrentStep(2);
        loadFaceModels();
      }
    } catch (error: any) {
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

  // Handle face capture
  const handleFaceCapture = async (photoData: string) => {
    setCapturedPhoto(photoData);
    setShowPhotoPreview(true);
    return photoData;
  };

  // Process enrollment
  const processEnrollmentWithPhoto = async (photoData: string) => {
    console.log('Processing enrollment...');
    
    try {
      setLoading(true);
      
      const studentId = studentData.matric_number || matricNumber;
      const studentName = studentData.name;
      const studentLevel = studentData.level;
      const studentProgramId = studentData.program_id;
      
      if (!studentId || !studentName) {
        message.error('Missing student information');
        setLoading(false);
        return;
      }

      // Compress image
      const compressedImage = await compressImage(photoData, 640, 0.8);
      const fileName = `enrollment_${Date.now()}_${studentName.replace(/\s+/g, '_')}.jpg`;
      
      let photoUrl = '';
      
      // Upload to storage
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
        }
      } catch (storageError) {
        console.warn('Storage upload failed');
      }

      if (!photoUrl) {
        photoUrl = compressedImage;
      }

      // Get program name
      const selectedProgram = programs.find(p => p.id === studentProgramId);
      const programName = selectedProgram?.name || selectedProgram?.code || 'Not specified';
      
      // Extract face embeddings
      let faceEmbedding: number[] = [];
      let extractionMethod = 'fallback';
      let faceDetected = false;
      
      try {
        if (!faceModelsLoaded) {
          await loadFaceModels();
        }
        
        const descriptor = await faceRecognition.extractFaceDescriptor(photoData);
        
        if (descriptor) {
          faceDetected = true;
          extractionMethod = 'face-api.js';
          faceEmbedding = Array.from(descriptor);
          
          // Save to localStorage
          try {
            await faceRecognition.updateFaceEmbedding(studentId, descriptor);
          } catch (storageError) {
            console.warn('Failed to save embedding to localStorage');
          }
        }
      } catch (faceError) {
        console.error('Face extraction failed:', faceError);
      }
      
      // Generate short embedding (128D)
      const shortEmbedding = generateShortEmbedding(faceEmbedding, 128);
      
      // Format for PostgreSQL
      const formattedFaceEmbedding = formatForPostgresVector(faceEmbedding);
      const formattedShortEmbedding = formatForPostgresVector(shortEmbedding);
      
      // Prepare data for database
      const studentDataForDb: any = {
        student_id: studentId,
        name: studentName,
        matric_number: studentId,
        level: studentLevel,
        program: programName,
        program_id: studentProgramId,
        enrollment_status: 'enrolled',
        enrollment_date: new Date().toISOString().split('T')[0],
        last_updated: new Date().toISOString(),
        photo_url: photoUrl,
        photo_data: photoUrl,
        face_embedding: formattedShortEmbedding,
        face_embedding_vector: formattedFaceEmbedding,
        face_enrolled_at: new Date().toISOString(),
        face_match_threshold: 0.7,
        face_detected: faceDetected,
        face_extraction_method: extractionMethod
      };
      
      // Save to database
      try {
        const { error: dbError } = await supabase
          .from('students')
          .insert([studentDataForDb]);
        
        if (dbError) {
          console.error('Database error:', dbError);
          
          // Try upsert as fallback
          await supabase
            .from('students')
            .upsert([studentDataForDb], { onConflict: 'matric_number' });
        }
        
        // Save photo to student_photos table
        await supabase
          .from('student_photos')
          .insert([{
            student_id: studentId,
            photo_url: photoUrl,
            photo_data: photoUrl,
            is_primary: true,
            created_at: new Date().toISOString()
          }]);
        
      } catch (dbError) {
        console.error('Database save failed:', dbError);
        throw dbError;
      }
      
      // Set success result
      setEnrollmentResult({
        success: true,
        student: {
          name: studentName,
          matric_number: studentId
        },
        level: studentLevel,
        program: programName,
        photoUrl: photoUrl,
        faceDetected: faceDetected,
        extractionMethod: extractionMethod
      });
      
      setEnrollmentComplete(true);
      setShowPhotoPreview(false);
      message.success(`${studentName} enrolled successfully!`);
      
    } catch (error: any) {
      console.error('Enrollment failed:', error);
      
      setEnrollmentResult({
        success: false,
        message: error.message || 'Enrollment failed'
      });
      
      setEnrollmentComplete(true);
      setShowPhotoPreview(false);
      message.error('Enrollment failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle enrollment completion
  const handleEnrollmentComplete = async (result: any) => {
    if (result && result.photoData && result.photoData.base64) {
      await processEnrollmentWithPhoto(result.photoData.base64);
    } else if (result && result.imageData) {
      await processEnrollmentWithPhoto(result.imageData);
    } else {
      message.error('No photo data received');
      setLoading(false);
    }
  };

  // Manual photo upload
  const handleManualPhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const photoData = e.target?.result as string;
      if (photoData) {
        setCapturedPhoto(photoData);
        setShowPhotoPreview(true);
      }
    };
    reader.readAsDataURL(file);
  };

  // Reset form for new enrollment
  const resetForm = () => {
    const newMatric = generateMatricNumber();
    setMatricNumber(newMatric);
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
  };

  return (
    <div style={{ 
      padding: '24px', 
      maxWidth: 800, 
      margin: '0 auto',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      <Card 
        style={{ 
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8
          }}>
            <IdCard size={32} color="#1890ff" />
            <Title level={3} style={{ margin: 0 }}>
              Student Enrollment
            </Title>
          </div>
          <Text type="secondary">
            AFE Babalola University - Face Recognition System
          </Text>
        </div>

        {/* Progress Steps */}
        <Steps 
          current={currentStep} 
          style={{ marginBottom: 32 }}
          items={[
            { title: 'Basic Info', icon: <User size={16} /> },
            { title: 'Academic Info', icon: <BookOpen size={16} /> },
            { title: 'Face Capture', icon: <Camera size={16} /> },
          ]}
        />

        {/* Content Area */}
        <div style={{ minHeight: 400 }}>
          {/* Step 1: Basic Information */}
          {currentStep === 0 && (
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                marginBottom: 24 
              }}>
                <User size={20} />
                <Title level={4} style={{ margin: 0 }}>Student Information</Title>
              </div>
              
              <Form
                form={form}
                layout="vertical"
                initialValues={{ gender: 'male' }}
              >
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <Form.Item
                      label="Full Name"
                      name="name"
                      rules={[
                        { required: true, message: 'Please enter student name' },
                        { min: 3, message: 'Name must be at least 3 characters' }
                      ]}
                    >
                      <Input 
                        placeholder="Enter student full name" 
                        size="large"
                        prefix={<User size={16} />}
                      />
                    </Form.Item>
                  </Col>
                  
                  <Col span={24}>
                    <Form.Item
                      label="Matriculation Number"
                      name="matric_number"
                    >
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Input
                          value={matricNumber}
                          readOnly
                          size="large"
                          prefix={<Hash size={16} />}
                          style={{ 
                            flex: 1,
                            backgroundColor: '#fafafa'
                          }}
                        />
                        <Button
                          type="default"
                          onClick={handleRegenerateMatric}
                        >
                          New
                        </Button>
                      </div>
                    </Form.Item>
                  </Col>
                  
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
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                marginBottom: 24 
              }}>
                <Building size={20} />
                <Title level={4} style={{ margin: 0 }}>Academic Information</Title>
              </div>
              
              {programs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Spin />
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
                        label="Level" 
                        name="level"
                        rules={[{ required: true, message: 'Please select level' }]}
                      >
                        <Select 
                          placeholder="Select level" 
                          size="large"
                          options={levels}
                        />
                      </Form.Item>
                    </Col>
                    
                    <Col span={24}>
                      <Form.Item 
                        label="Program" 
                        name="program_id"
                        rules={[{ required: true, message: 'Please select program' }]}
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
                            label: `${program.code} - ${program.name}`,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  
                  {!faceModelsLoaded && (
                    <Alert
                      message="Loading Face Models"
                      description="Please wait while face recognition models are loading..."
                      type="info"
                      showIcon
                      style={{ marginTop: 16 }}
                    />
                  )}
                </Form>
              )}
            </div>
          )}

          {/* Step 3: Face Enrollment */}
          {currentStep === 2 && (
            enrollmentComplete ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                {enrollmentResult?.success ? (
                  <>
                    <CheckCircle size={48} color="#52c41a" />
                    <Title level={3} style={{ marginTop: 16 }}>
                      Enrollment Complete!
                    </Title>
                    
                    <div style={{ 
                      background: '#f6ffed', 
                      borderRadius: 8, 
                      padding: 24, 
                      margin: '24px 0',
                      textAlign: 'left'
                    }}>
                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Text strong>Name:</Text>
                          <br />
                          <Text>{enrollmentResult.student?.name}</Text>
                        </Col>
                        <Col span={12}>
                          <Text strong>Matric No:</Text>
                          <br />
                          <Tag color="blue">{enrollmentResult.student?.matric_number}</Tag>
                        </Col>
                        <Col span={12}>
                          <Text strong>Level:</Text>
                          <br />
                          <Tag color="purple">Level {enrollmentResult.level}</Tag>
                        </Col>
                        <Col span={12}>
                          <Text strong>Program:</Text>
                          <br />
                          <Text>{enrollmentResult.program}</Text>
                        </Col>
                        <Col span={12}>
                          <Text strong>Face Status:</Text>
                          <br />
                          <Tag color={enrollmentResult.faceDetected ? "green" : "orange"}>
                            {enrollmentResult.faceDetected ? 'Detected' : 'Not Detected'}
                          </Tag>
                        </Col>
                        <Col span={12}>
                          <Text strong>Method:</Text>
                          <br />
                          <Text type="secondary">
                            {enrollmentResult.extractionMethod === 'face-api.js' ? 'Real Features' : 'Fallback'}
                          </Text>
                        </Col>
                      </Row>
                      
                      {enrollmentResult.photoUrl && (
                        <div style={{ marginTop: 24, textAlign: 'center' }}>
                          <img 
                            src={enrollmentResult.photoUrl} 
                            alt="Student" 
                            style={{ 
                              width: 120,
                              height: 120,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '3px solid #52c41a'
                            }} 
                          />
                        </div>
                      )}
                    </div>
                    
                    <Space>
                      <Button
                        type="primary"
                        size="large"
                        onClick={resetForm}
                      >
                        Enroll Another Student
                      </Button>
                      <Button 
                        size="large"
                        type="default"
                        onClick={() => window.location.href = '/attendance'}
                      >
                        Take Attendance
                      </Button>
                    </Space>
                  </>
                ) : (
                  <>
                    <div style={{ color: '#ff4d4f', marginBottom: 16 }}>
                      <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
                        <circle cx="32" cy="32" r="30" stroke="#ff4d4f" strokeWidth="2"/>
                        <path d="M22 22L42 42M42 22L22 42" stroke="#ff4d4f" strokeWidth="4" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <Title level={3} style={{ marginTop: 16 }}>
                      Enrollment Failed
                    </Title>
                    <Alert
                      message="Error"
                      description={enrollmentResult?.message || 'Unknown error occurred'}
                      type="error"
                      showIcon
                      style={{ maxWidth: 400, margin: '16px auto' }}
                    />
                    <Button
                      type="primary"
                      onClick={resetForm}
                      style={{ marginTop: 16 }}
                    >
                      Try Again
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div>
                {isCameraActive ? (
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      marginBottom: 16 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Camera size={20} />
                        <Title level={4} style={{ margin: 0 }}>Face Capture</Title>
                      </div>
                      <Button onClick={() => setIsCameraActive(false)}>
                        Cancel
                      </Button>
                    </div>
                    
                    <div style={{ height: 400 }}>
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
                    </div>
                    
                    <div style={{ marginTop: 16, textAlign: 'center' }}>
                      <Text type="secondary">
                        Position face in the frame and click capture
                      </Text>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      marginBottom: 24 
                    }}>
                      <Camera size={20} />
                      <Title level={4} style={{ margin: 0 }}>Face Enrollment</Title>
                    </div>
                    
                    {/* Student Summary */}
                    {studentData.name && (
                      <div style={{ 
                        background: '#f0f5ff', 
                        padding: 16, 
                        borderRadius: 8,
                        marginBottom: 24
                      }}>
                        <Row gutter={[16, 8]}>
                          <Col span={12}>
                            <Text strong>Student:</Text>
                            <br />
                            <Text>{studentData.name}</Text>
                          </Col>
                          <Col span={12}>
                            <Text strong>Matric No:</Text>
                            <br />
                            <Tag color="blue">{matricNumber}</Tag>
                          </Col>
                          <Col span={12}>
                            <Text strong>Level:</Text>
                            <br />
                            <Tag color="purple">Level {studentData.level}</Tag>
                          </Col>
                          <Col span={12}>
                            <Text strong>Program:</Text>
                            <br />
                            <Text>{programs.find(p => p.id === studentData.program_id)?.name}</Text>
                          </Col>
                        </Row>
                      </div>
                    )}
                    
                    {/* Face Model Status */}
                    <Alert
                      type={faceModelsLoaded ? "success" : "info"}
                      message={faceModelsLoaded ? "Face Recognition Ready" : "Loading Face Models"}
                      description={faceModelsLoaded ? "Models loaded successfully" : "Please wait..."}
                      showIcon
                      style={{ marginBottom: 24 }}
                    />
                    
                    {/* Capture Options */}
                    <Row gutter={[16, 16]}>
                      <Col span={24} md={12}>
                        <div style={{ 
        border: '2px dashed #d9d9d9', 
        borderRadius: 8, 
        padding: 24,
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s',
        height: '100%'
      }} 
                          onClick={() => setIsCameraActive(true)}
                        >
                          <Camera size={32} style={{ marginBottom: 16, color: '#1890ff' }} />
                          <Title level={5} style={{ marginBottom: 8 }}>Use Web Camera</Title>
                          <Text type="secondary">
                            Capture live from your webcam
                          </Text>
                          <Button
                            type="primary"
                            style={{ marginTop: 16 }}
                            loading={!faceModelsLoaded}
                            disabled={!faceModelsLoaded}
                            block
                          >
                            Start Camera
                          </Button>
                        </div>
                      </Col>
                      
                      <Col span={24} md={12}>
                        <div style={{ 
                          border: '2px dashed #d9d9d9', 
                          borderRadius: 8, 
                          padding: 24,
                          textAlign: 'center',
                          height: '100%'
                        }}>
                          <Upload size={32} style={{ marginBottom: 16, color: '#52c41a' }} />
                          <Title level={5} style={{ marginBottom: 8 }}>Upload Photo</Title>
                          <Text type="secondary">
                            Upload an existing photo
                          </Text>
                          <div style={{ marginTop: 16 }}>
                            <input
                              type="file"
                              accept="image/*"
                              id="photo-upload"
                              style={{ display: 'none' }}
                              onChange={handleManualPhotoUpload}
                            />
                            <Button
                              type="default"
                              onClick={() => document.getElementById('photo-upload')?.click()}
                              block
                            >
                              Choose Photo
                            </Button>
                          </div>
                        </div>
                      </Col>
                    </Row>
                    
                    {/* Quick Tips */}
                    <div style={{ marginTop: 24 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        💡 Tip: Ensure good lighting and face the camera directly
                      </Text>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Navigation Buttons */}
        {!enrollmentComplete && currentStep < 2 && (
          <div style={{ marginTop: 32, textAlign: 'center' }}>
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
              >
                {currentStep === 1 ? 'Continue to Face Capture' : 'Continue'}
              </Button>
            </Space>
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
            Retake
          </Button>,
          <Button 
            key="enroll" 
            type="primary" 
            loading={loading}
            onClick={() => capturedPhoto && processEnrollmentWithPhoto(capturedPhoto)}
          >
            Use This Photo
          </Button>
        ]}
        width={500}
      >
        <div style={{ textAlign: 'center' }}>
          {capturedPhoto && (
            <>
              <img 
                src={capturedPhoto} 
                alt="Captured" 
                style={{ 
                  width: '100%',
                  maxHeight: 300,
                  borderRadius: 8,
                  objectFit: 'cover'
                }} 
              />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">
                  Review the photo before proceeding with enrollment
                </Text>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default EnrollmentPage;