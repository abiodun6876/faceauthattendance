// pages/EnrollmentPage.tsx
import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Select, 
  Button, 
  Card, 
  Typography, 
  message, 
  Steps, 
  Row, 
  Col,
  Tag,
  Space,
  Spin
} from 'antd';
import { Camera, User, CheckCircle, IdCard } from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { enrollStudent, EnrollmentData } from '../utils/enrollmentUtils';
import { fetchPrograms, Program } from '../utils/api';

const { Title, Text } = Typography;

const EnrollmentPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchingPrograms, setFetchingPrograms] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollmentResult, setEnrollmentResult] = useState<any>(null);
  const [form] = Form.useForm();

  // Fetch programs from database on component mount
  useEffect(() => {
    const loadPrograms = async () => {
      setFetchingPrograms(true);
      try {
        const programsData = await fetchPrograms();
        console.log('Programs loaded:', programsData);
        setPrograms(programsData);
        
        if (programsData.length === 0) {
          message.warning('No programs found in the database. Please add programs first.');
        }
      } catch (error: any) {
        console.error('Failed to fetch programs:', error);
        message.error(`Failed to load programs: ${error.message}`);
      } finally {
        setFetchingPrograms(false);
      }
    };

    loadPrograms();
  }, []);

  const handleEnrollmentComplete = async (photoData: string) => {
    setLoading(true);
    
    try {
      const formValues = form.getFieldsValue();
      
      // Validate required fields
      if (!formValues.name || !formValues.program_id) {
        throw new Error('Please fill in all required fields');
      }
      
      // Find the selected program details
      const selectedProgram = programs.find(p => p.id === formValues.program_id);
      
      if (!selectedProgram) {
        throw new Error('Selected program not found');
      }
      
      // Generate matric number if not provided
      if (!formValues.matric_number) {
        const newMatric = generateMatricNumber(selectedProgram);
        form.setFieldValue('matric_number', newMatric);
        formValues.matric_number = newMatric;
      }
      
      const enrollmentData: EnrollmentData = {
        student_id: formValues.matric_number,
        name: formValues.name,
        gender: formValues.gender,
        program_id: formValues.program_id,
        program_name: selectedProgram.name,
        program_code: selectedProgram.code,
        level: formValues.level,
        photoData
      };
      
      console.log('Enrollment data:', enrollmentData);
      
      const result = await enrollStudent(enrollmentData);
      
      if (result.success) {
        setEnrollmentResult(result);
        setCurrentStep(2);
        message.success('Student enrolled successfully!');
      } else {
        message.error(`Enrollment failed: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Enrollment error:', error);
      message.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateMatricNumber = (program?: Program) => {
    const currentYear = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const programCode = program?.code ? program.code.substring(0, 3).toUpperCase() : 'GEN';
    return `${programCode}/${currentYear}/${randomNum}`;
  };

  const resetForm = () => {
    form.resetFields();
    setCurrentStep(0);
    setEnrollmentResult(null);
    
    // Set default values
    form.setFieldsValue({
      gender: 'male',
      level: 100
    });
  };

  // Prepare program options for the Select component
  const programOptions = programs
    .filter(program => program.is_active !== false)
    .map(program => ({
      label: `${program.name} (${program.code})`,
      value: program.id,
    }));

  const steps = [
    {
      title: 'Basic Info',
      icon: <User size={16} />,
      content: (
        <Form form={form} layout="vertical" initialValues={{ gender: 'male', level: 100 }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                label="Full Name"
                name="name"
                rules={[{ required: true, message: 'Please enter student name' }]}
              >
                <Input size="large" placeholder="Enter student full name" />
              </Form.Item>
            </Col>
            
            <Col span={24}>
              <Form.Item label="Matric Number" name="matric_number">
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input 
                    size="large" 
                    placeholder="Will be auto-generated" 
                    readOnly 
                    style={{ flex: 1 }}
                  />
                  <Button 
                    onClick={() => {
                      const programId = form.getFieldValue('program_id');
                      const selectedProgram = programs.find(p => p.id === programId);
                      const newMatric = generateMatricNumber(selectedProgram);
                      form.setFieldValue('matric_number', newMatric);
                      message.success('New matric number generated');
                    }}
                    disabled={!form.getFieldValue('program_id')}
                  >
                    Generate
                  </Button>
                </div>
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item label="Gender" name="gender">
                <Select size="large">
                  <Select.Option value="male">Male</Select.Option>
                  <Select.Option value="female">Female</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item label="Level" name="level">
                <Select size="large">
                  {[100, 200, 300, 400, 500].map(level => (
                    <Select.Option key={level} value={level}>
                      Level {level}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            
            <Col span={24}>
              <Form.Item 
                label="Program" 
                name="program_id"
                rules={[{ required: true, message: 'Please select a program' }]}
              >
                <Select
                  size="large"
                  placeholder={fetchingPrograms ? "Loading programs..." : "Select program"}
                  loading={fetchingPrograms}
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) => 
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={programOptions}
                  notFoundContent={
                    fetchingPrograms ? 
                      <Spin size="small" /> : 
                      programs.length === 0 ? 
                        "No programs available. Please add programs first." : 
                        "No matching programs found"
                  }
                />
              </Form.Item>
            </Col>
          </Row>
          
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Button 
              type="primary" 
              size="large"
              onClick={() => {
                form.validateFields()
                  .then(() => {
                    if (programs.length === 0) {
                      message.error('No programs available. Please add programs first.');
                      return;
                    }
                    setCurrentStep(1);
                  })
                  .catch(() => message.error('Please fill in all required fields'));
              }}
              disabled={fetchingPrograms || programs.length === 0}
            >
              Continue to Face Capture
            </Button>
          </div>
        </Form>
      )
    },
    {
      title: 'Face Capture',
      icon: <Camera size={16} />,
      content: (
        <div style={{ textAlign: 'center' }}>
          <Title level={4} style={{ marginBottom: 16 }}>Face Enrollment</Title>
          <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
            Capture student's face for recognition. Ensure good lighting and face the camera directly.
          </Text>
          
          <div style={{ height: 400, margin: '24px 0', borderRadius: 8, overflow: 'hidden' }}>
            <FaceCamera
              mode="enrollment"
              onEnrollmentComplete={handleEnrollmentComplete}
              autoCapture={false}
              loading={loading}
            />
          </div>
          
          <Space>
            <Button onClick={() => setCurrentStep(0)}>
              Back
            </Button>
            <Text type="secondary">
              Click the capture button when ready
            </Text>
          </Space>
        </div>
      )
    },
    {
      title: 'Complete',
      icon: <CheckCircle size={16} />,
      content: enrollmentResult ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          {enrollmentResult.success ? (
            <>
              <CheckCircle size={64} color="#52c41a" style={{ marginBottom: 24 }} />
              <Title level={3} style={{ marginBottom: 24 }}>
                Enrollment Successful!
              </Title>
              
              <Card style={{ 
                textAlign: 'left', 
                marginBottom: 32,
                maxWidth: 500,
                margin: '0 auto 32px'
              }}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Name: </Text>
                  <Text>{enrollmentResult.student.name}</Text>
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Matric Number: </Text>
                  <Tag color="blue">{enrollmentResult.student.matric_number}</Tag>
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Level: </Text>
                  <Tag color="purple">Level {enrollmentResult.student.level}</Tag>
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Program: </Text>
                  <Text>{enrollmentResult.student.program_name}</Text>
                  <Text type="secondary"> ({enrollmentResult.student.program_code})</Text>
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Face Detection: </Text>
                  <Tag color={enrollmentResult.faceDetected ? "green" : "orange"}>
                    {enrollmentResult.faceDetected ? '✅ Detected' : '⚠️ Fallback'}
                  </Tag>
                </div>
                
                {enrollmentResult.embeddingDimensions && (
                  <div>
                    <Text strong>Embedding: </Text>
                    <Text>{enrollmentResult.embeddingDimensions} dimensions</Text>
                  </div>
                )}
              </Card>
              
              <Space>
                <Button type="primary" size="large" onClick={resetForm}>
                  Enroll Another Student
                </Button>
                <Button size="large" onClick={() => window.location.href = '/attendance'}>
                  Go to Attendance
                </Button>
              </Space>
            </>
          ) : (
            <>
              <div style={{ 
                width: 64, 
                height: 64, 
                borderRadius: '50%', 
                backgroundColor: '#ff4d4f20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="#ff4d4f" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              
              <Title level={3} style={{ color: '#ff4d4f', marginBottom: 24 }}>
                Enrollment Failed
              </Title>
              
              <Card style={{ 
                marginBottom: 32,
                maxWidth: 500,
                margin: '0 auto',
                backgroundColor: '#fff2f0',
                borderColor: '#ffccc7'
              }}>
                <Text style={{ color: '#ff4d4f' }}>
                  {enrollmentResult.error || 'Unknown error occurred'}
                </Text>
              </Card>
              
              <Button type="primary" onClick={resetForm}>
                Try Again
              </Button>
            </>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <Text style={{ display: 'block', marginTop: 16 }}>
            Processing enrollment...
          </Text>
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      <Card>
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

        <Steps 
          current={currentStep} 
          style={{ marginBottom: 32 }}
          items={steps.map((step, index) => ({
            title: step.title,
            icon: step.icon
          }))}
        />

        <div style={{ minHeight: 400 }}>
          {steps[currentStep].content}
        </div>
      </Card>
    </div>
  );
};

export default EnrollmentPage;