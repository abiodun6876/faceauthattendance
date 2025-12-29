// src/pages/EnrollmentPage.tsx - CORRECTED VERSION
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
import { Camera, User, BookOpen, CheckCircle, GraduationCap, Calendar } from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import { compressImage } from '../utils/imageUtils';
import faceRecognition from '../utils/faceRecognition';

const { Title, Text } = Typography;

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
  
  // State for fetched data
  const [programs, setPrograms] = useState<any[]>([]);
  const [levels, setLevels] = useState([
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

  // Fetch programs
  const fetchPrograms = async () => {
    try {
      // Check if programs table exists
      const { data: programsData, error: programsError } = await supabase
        .from('programs')
        .select('id, code, name, short_name')
        .eq('is_active', true)
        .order('name');

      if (programsError) {
        console.warn('Programs table may not exist, using defaults:', programsError);
        // Use default programs
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
      // Use defaults on error
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
    
    // Fetch programs
    fetchPrograms();
  }, [form]);

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields();
        const values = form.getFieldsValue();
        
        // Ensure matric number is set
        if (!values.matric_number?.trim()) {
          const newMatric = generateMatricNumber();
          values.matric_number = newMatric;
          setMatricNumber(newMatric);
          form.setFieldValue('matric_number', newMatric);
        }

        console.log('Proceeding with values:', values);
        setStudentData(values);
        setCurrentStep(1);
      } else if (currentStep === 1) {
        // Validate academic form
        await academicForm.validateFields();
        const academicValues = await academicForm.getFieldsValue();
        setStudentData((prev: any) => ({ ...prev, ...academicValues }));
        setCurrentStep(2);
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

  // ========== ENROLLMENT HANDLER ==========
  // This is for enrollment, NOT attendance!
  const handleEnrollmentComplete = async (result: any) => {
    console.log('=== ENROLLMENT COMPLETE TRIGGERED ===');
    console.log('Full result from FaceCamera:', result);
    
    try {
      if (!result.success || !result.photoData) {
        console.error('Result missing success or photoData:', result);
        message.error('Failed to capture image');
        return;
      }

      setLoading(true);

      // Extract student information with fallbacks
      const studentId = result.matricNumber || result.studentId || matricNumber;
      const studentName = result.studentName || studentData.name || 'Unknown Student';
      const studentLevel = result.level || studentData.level || 100;
      const studentProgramId = result.program_id || studentData.program_id;
      const studentGender = result.gender || studentData.gender || 'male';
      
      console.log('Extracted student info:', {
        studentId,
        studentName,
        studentLevel,
        studentProgramId,
        studentGender
      });

      // Validate required fields
      if (!studentId || !studentName) {
        console.error('Missing required student information:', { studentId, studentName });
        message.error('Missing student information. Please complete all form steps.');
        setLoading(false);
        return;
      }

      // Compress the image
      const compressedImage = await compressImage(result.photoData.base64, 640, 0.8);
      
      // Generate a unique filename
      const fileName = `enrollment_${Date.now()}_${studentName.replace(/\s+/g, '_')}.jpg`;
      
      console.log('Processing enrollment for:', studentName, 'with ID:', studentId);
      
      // DECLARE programName at a higher scope so it's available in catch block
      let programName = 'Not specified';
      
      try {
        let photoUrl = '';
        let photoData = compressedImage;
        
        // Try to upload to Supabase Storage
        try {
          console.log('Attempting to upload to Supabase Storage...');
          const { error: storageError } = await supabase.storage
            .from('student-photos')
            .upload(fileName, dataURLtoBlob(compressedImage), {
              contentType: 'image/jpeg',
              upsert: true
            });
          
          if (!storageError) {
            // Get public URL
            const { data: publicUrlData } = supabase.storage
              .from('student-photos')
              .getPublicUrl(fileName);
            
            photoUrl = publicUrlData.publicUrl;
            console.log('✅ Photo uploaded to storage:', photoUrl);
          } else {
            console.warn('❌ Storage upload failed:', storageError);
          }
        } catch (storageError) {
          console.warn('❌ Storage bucket may not exist:', storageError);
        }

        // Get program name
        const selectedProgram = programs.find(p => p.id === studentProgramId);
        programName = selectedProgram?.name || selectedProgram?.code || 'Not specified';
        
        // Get current year for admission
        const currentYear = new Date().getFullYear();
        const enrollmentDate = new Date();
        
        // ========== STEP 1: EXTRACT FACE EMBEDDING ==========
        console.log('=== STEP 1: Extracting face embedding ===');
        let embeddingArray = null;
        let embeddingError = null;

        try {
          // Test the faceRecognition module first
          console.log('Testing faceRecognition module...');
          console.log('Module exists?', !!faceRecognition);
          console.log('extractFaceDescriptor exists?', !!faceRecognition.extractFaceDescriptor);
          
          const descriptor = await faceRecognition.extractFaceDescriptor(compressedImage);
          
          if (descriptor) {
            embeddingArray = Array.from(descriptor);
            console.log('✅ Face embedding extracted, length:', embeddingArray.length);
            console.log('First 5 values:', embeddingArray.slice(0, 5));
            
            // Save to local storage
            faceRecognition.saveEmbeddingToLocal(studentId, descriptor);
          } else {
            console.log('⚠️ No face detected - embedding not extracted');
            embeddingError = new Error('No face detected in image');
          }
        } catch (err: any) {
          console.error('❌ Could not extract face embedding:', err);
          console.error('Error details:', err.message, err.stack);
          embeddingError = err;
        }

        // If embedding failed, we can't continue with enrollment
        if (!embeddingArray) {
          throw new Error(`Face embedding extraction failed: ${embeddingError?.message || 'No face detected'}. Please ensure the face is clearly visible and try again.`);
        }

        // ========== STEP 2: SAVE STUDENT WITH EMBEDDING ==========
        console.log('=== STEP 2: Saving student with embedding ===');

        // Prepare student data WITH embedding
        const studentRecord = {
          student_id: studentId,
          matric_number: studentId,
          name: studentName,
          gender: studentGender,
          level: studentLevel,
          program: programName,
          program_id: studentProgramId,
          admission_year: currentYear,
          enrollment_status: 'enrolled' as const,
          enrollment_date: enrollmentDate.toISOString().split('T')[0], // Date only
          photo_url: photoUrl || null,
          photo_data: photoData.replace(/^data:image\/\w+;base64,/, ''), // Remove data URL prefix
          face_embedding: embeddingArray, // ← CRITICAL: Embedding is included
          face_enrolled_at: enrollmentDate.toISOString(),
          last_updated: enrollmentDate.toISOString(),
          created_at: enrollmentDate.toISOString()
        };
        
        console.log('📊 Student data for database (with embedding):', {
          ...studentRecord,
          face_embedding_length: studentRecord.face_embedding?.length,
          face_embedding_first_5: studentRecord.face_embedding?.slice(0, 5)
        });
        
        // Check if student already exists
        const { data: existingStudent, error: checkError } = await supabase
          .from('students')
          .select('matric_number, id')
          .eq('matric_number', studentId)
          .maybeSingle();
        
        let dbResult;
        
        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error checking student existence:', checkError);
          throw checkError;
        }
        
        if (!existingStudent) {
          // Student doesn't exist, INSERT with embedding
          console.log('Inserting new student with embedding...');
          const { data: insertData, error: insertError } = await supabase
            .from('students')
            .insert([studentRecord])
            .select();
          
          if (insertError) {
            console.error('Insert error:', insertError);
            throw insertError;
          }
          dbResult = insertData;
          console.log('✅ New student inserted with embedding:', dbResult);
        } else {
          // Student exists, UPDATE with all fields including embedding
          console.log('Updating existing student with embedding...');
          const { data: updateData, error: updateError } = await supabase
            .from('students')
            .update({
              ...studentRecord,
              id: existingStudent.id // Keep the existing ID
            })
            .eq('matric_number', studentId)
            .select();
          
          if (updateError) {
            console.error('Update error:', updateError);
            throw updateError;
          }
          dbResult = updateData;
          console.log('✅ Student updated with embedding:', dbResult);
        }
        
        // Store in student_photos table if it exists
        try {
          console.log('Checking for student_photos table...');
          
          // First, check if the table exists by trying to select from it
          const { error: tableCheckError } = await supabase
            .from('student_photos')
            .select('count')
            .limit(1);
          
          if (!tableCheckError) {
            // Table exists, insert photo data
            console.log('Saving to student_photos table...');
            const { data: photoResult, error: photoError } = await supabase
              .from('student_photos')
              .upsert([{
                student_id: studentId,
                photo_url: photoUrl,
                photo_data: photoData.replace(/^data:image\/\w+;base64,/, ''),
                is_primary: true,
                embedding_extracted: true,
                embedding_length: embeddingArray?.length
              }], {
                onConflict: 'student_id,is_primary'
              })
              .select();
            
            if (photoError) {
              console.error('⚠️ Photo metadata save warning:', photoError);
            } else {
              console.log('✅ Photo saved to student_photos:', photoResult);
            }
          } else {
            console.log('⚠️ student_photos table does not exist or error:', tableCheckError);
          }
        } catch (photoError) {
          console.warn('⚠️ Could not save to student_photos:', photoError);
        }

        // Save to local storage as backup
        try {
          const key = `face_image_${studentId}`;
          localStorage.setItem(key, photoData);
          console.log('✅ Image saved to localStorage:', key);
        } catch (localError) {
          console.warn('⚠️ Local storage save failed:', localError);
        }
        
        // ========== STEP 3: VERIFY ENROLLMENT ==========
        console.log('=== STEP 3: Verifying enrollment ===');
        
        // Verify the embedding was actually saved
        const { data: verifyData, error: verifyError } = await supabase
          .from('students')
          .select('student_id, name, face_embedding')
          .eq('matric_number', studentId)
          .single();
        
        if (verifyError) {
          console.error('Verification error:', verifyError);
          throw new Error(`Enrollment verification failed: ${verifyError.message}`);
        }
        
        console.log('✅ Enrollment verified:', {
          studentId: verifyData.student_id,
          name: verifyData.name,
          embeddingSaved: verifyData.face_embedding !== null,
          embeddingLength: verifyData.face_embedding?.length || 0
        });
        
        // Set enrollment result
        setEnrollmentResult({
          success: true,
          message: 'Enrollment completed successfully with face embedding!',
          student: {
            name: studentName,
            student_id: studentId,
            matric_number: studentId
          },
          level: studentLevel,
          program: programName,
          faceCaptured: true,
          localStorageSaved: true,
          photoUrl: photoUrl || photoData,
          databaseSaved: true,
          faceEmbeddingSaved: true,
          embeddingLength: embeddingArray.length,
          verification: {
            embeddingPresent: verifyData.face_embedding !== null,
            embeddingLength: verifyData.face_embedding?.length
          }
        });
        
        setEnrollmentComplete(true);
        message.success(`Enrollment complete for ${studentName}! Face embedding saved.`);
        
      } catch (uploadError: any) {
        console.error('❌ Upload/processing error:', uploadError);
        console.error('Error details:', {
          message: uploadError.message,
          code: uploadError.code,
          details: uploadError.details
        });
        
        // Fallback: Save as pending if embedding fails
        console.log('Attempting fallback save as pending...');
        const fallbackData = {
          student_id: studentId,
          name: studentName,
          matric_number: studentId,
          level: studentLevel,
          program: programName,
          program_id: studentProgramId,
          gender: studentGender,
          enrollment_status: 'pending' as const, // Set as pending, not enrolled
          enrollment_date: new Date().toISOString().split('T')[0],
          last_updated: new Date().toISOString(),
          face_embedding: null // Explicitly null since extraction failed
        };
        
        const { error: fallbackError } = await supabase
          .from('students')
          .upsert([fallbackData], {
            onConflict: 'matric_number'
          });
        
        if (fallbackError) {
          console.error('❌ Fallback save also failed:', fallbackError);
          throw fallbackError;
        }
        
        console.log('✅ Fallback save successful (status: pending)');
        
        setEnrollmentResult({
          success: false,
          message: 'Enrollment failed: Could not extract face embedding. Student saved as "pending".',
          student: {
            name: studentName,
            student_id: studentId,
            matric_number: studentId
          },
          level: studentLevel,
          program: programName,
          faceCaptured: true,
          localStorageSaved: false,
          databaseSaved: true,
          faceEmbeddingSaved: false,
          status: 'pending'
        });
        
        setEnrollmentComplete(true);
        message.warning(`Enrollment incomplete for ${studentName}. Face embedding extraction failed. Student saved as "pending".`);
      }
      
    } catch (error: any) {
      console.error('❌ Critical enrollment error:', error);
      console.error('Error stack:', error.stack);
      setEnrollmentResult({
        success: false,
        message: `Failed to complete enrollment: ${error.message}`,
        error: error
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
                  description="Level and Program information are required for attendance tracking and reporting. These cannot be changed easily after enrollment."
                  showIcon
                />
              </div>
            </Form>
          )}
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
                <p><strong>Face Data:</strong> 
                  <Tag color={enrollmentResult?.faceCaptured ? "green" : "orange"} style={{ marginLeft: 8 }}>
                    {enrollmentResult?.faceCaptured ? 'Photo Captured' : 'No Photo'}
                  </Tag>
                </p>
                <p><strong>Face Embedding:</strong> 
                  <Tag color={enrollmentResult?.faceEmbeddingSaved ? "green" : "orange"} style={{ marginLeft: 8 }}>
                    {enrollmentResult?.faceEmbeddingSaved ? `Extracted ✓ (${enrollmentResult?.embeddingLength} values)` : 'Not Extracted'}
                  </Tag>
                </p>
                <p><strong>Verification:</strong> 
                  <Tag color={enrollmentResult?.verification?.embeddingPresent ? "green" : "red"} style={{ marginLeft: 8 }}>
                    {enrollmentResult?.verification?.embeddingPresent ? `Verified (${enrollmentResult?.verification?.embeddingLength} values)` : 'Not Verified'}
                  </Tag>
                </p>
                <p><strong>Local Storage:</strong> 
                  <Tag color={enrollmentResult?.localStorageSaved ? "green" : "gray"} style={{ marginLeft: 8 }}>
                    {enrollmentResult?.localStorageSaved ? 'Backup Saved' : 'No Backup'}
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
                    />
                  </div>
                )}
              </Card>
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
                {enrollmentResult?.status === 'pending' ? 'Enrollment Incomplete' : 'Enrollment Failed'}
              </Title>
              <Alert
                message={enrollmentResult?.status === 'pending' ? 'Partial Success' : 'Error'}
                description={enrollmentResult?.message || 'Unknown error occurred'}
                type={enrollmentResult?.status === 'pending' ? 'warning' : 'error'}
                showIcon
                style={{ maxWidth: 500, margin: '20px auto' }}
              />
              {enrollmentResult?.status === 'pending' && (
                <Alert
                  message="Next Steps"
                  description="The student was saved but needs face embedding. You can retry face enrollment from the student management page."
                  type="info"
                  showIcon
                  style={{ maxWidth: 500, margin: '20px auto' }}
                />
              )}
            </>
          )}
          
          <Space style={{ marginTop: 30 }}>
            <Button
              type="primary"
              size="large"
              onClick={() => {
                // Generate new matric number for next student
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
                
                // Reset to initial values
                form.setFieldsValue({
                  gender: 'male',
                  matric_number: newMatric
                });
                
                // Reset academic form
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
                  onClick={() => window.location.href = '/students'}
                >
                  View All Students
                </Button>
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
            description="Capture facial data for biometric authentication. Ensure good lighting and face the camera directly."
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
            </Card>
          )}
          
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {isCameraActive ? (
              <FaceCamera
                mode="enrollment"
                student={{
                  id: studentData.matric_number || matricNumber,
                  name: studentData.name,
                  matric_number: studentData.matric_number || matricNumber,
                  level: studentData.level,
                  program_id: studentData.program_id
                }}
                onEnrollmentComplete={handleEnrollmentComplete}
              />
            ) : (
              <Card>
                <Camera size={48} style={{ marginBottom: 20, color: '#1890ff' }} />
                <Title level={4}>Ready for Face Capture</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
                  Ensure good lighting and face the camera directly. Click below to start.
                </Text>
                <Button
                  type="primary"
                  size="large"
                  icon={<Camera size={20} />}
                  onClick={() => setIsCameraActive(true)}
                  loading={loading}
                  style={{ marginBottom: 10 }}
                >
                  Start Face Enrollment
                </Button>
                
                <div style={{ marginTop: 20 }}>
                  <Alert
                    type="warning"
                    message="Important for Attendance"
                    description="Face data and embedding are required for biometric attendance marking. Please ensure good lighting and a clear face view."
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
              >
                {currentStep === 1 ? 'Proceed to Face Enrollment' : 'Next'}
              </Button>
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
};

export default EnrollmentPage;