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

const { Title, Text } = Typography;

const EnrollmentPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<any>(null);
  const [form] = Form.useForm();

  // Initialize form values
  useEffect(() => {
    form.setFieldsValue({
      gender: 'male',
      level: 100,
      program_code: 'CSC' // Default program code
    });
  }, [form]);

  const handleEnrollmentComplete = async (photoData: string) => {
    console.log('Enrollment photo captured, starting enrollment...');
    setLoading(true);
    
    try {
      const formValues = form.getFieldsValue();
      console.log('Form values:', formValues);
      
      // Validate required fields
      if (!formValues.name) {
        throw new Error('Please enter student name');
      }
      
      // Generate matric number if not provided
      if (!formValues.matric_number) {
        const newMatric = generateMatricNumber(formValues.program_code);
        form.setFieldValue('matric_number', newMatric);
        formValues.matric_number = newMatric;
      }
      
      const enrollmentData: EnrollmentData = {
        student_id: formValues.matric_number,
        name: formValues.name,
        gender: formValues.gender,
        program_id: formValues.program_code || 'CSC', // Use program code as ID
        program_name: getProgramName(formValues.program_code),
        program_code: formValues.program_code || 'CSC',
        level: formValues.level,
        photoData
      };
      
      console.log('Enrollment data prepared:', enrollmentData);
      
      const result = await enrollStudent(enrollmentData);
      console.log('Enrollment result:', result);
      
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

  const generateMatricNumber = (programCode: string = 'GEN') => {
    const currentYear = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const code = programCode.substring(0, 3).toUpperCase();
    return `${code}/${currentYear}/${randomNum}`;
  };

  const getProgramName = (programCode: string): string => {
    const programMap: Record<string, string> = {
      'CSC': 'Computer Science',
      'EEE': 'Electrical Engineering',
      'LAW': 'Law',
      'MED': 'Medicine',
      'MSC-CS': 'Master of Science in Computer Science',
      'BSC-CS': 'Bachelor of Science in Computer Science',
      'MBA': 'Master of Business Administration',
      'PHD-CS': 'Doctor of Philosophy in Computer Science',
      'BSC-EE': 'Bachelor of Science in Electrical Engineering',
      'BSC-ME': 'Bachelor of Science in Mechanical Engineering'
    };
    return programMap[programCode] || programCode;
  };

  const resetForm = () => {
    form.resetFields();
    // Reset to default values
    form.setFieldsValue({
      gender: 'male',
      level: 100,
      program_code: 'CSC'
    });
    setCurrentStep(0);
    setEnrollmentResult(null);
  };

  // Available program codes
  const programOptions = [
    { label: 'Computer Science (CSC)', value: 'CSC' },
    { label: 'Electrical Engineering (EEE)', value: 'EEE' },
    { label: 'Law (LAW)', value: 'LAW' },
    { label: 'Medicine (MED)', value: 'MED' },
    { label: 'Computer Science - BSc (BSC-CS)', value: 'BSC-CS' },
    { label: 'Computer Science - MSc (MSC-CS)', value: 'MSC-CS' },
    { label: 'Computer Science - PhD (PHD-CS)', value: 'PHD-CS' },
    { label: 'Electrical Engineering - BSc (BSC-EE)', value: 'BSC-EE' },
    { label: 'Mechanical Engineering - BSc (BSC-ME)', value: 'BSC-ME' },
    { label: 'Business Administration - MBA (MBA)', value: 'MBA' },
  ];

  const steps = [
    {
      title: 'Student Info',
      icon: <User size={16} />,
      content: (
        <Form 
          form={form} 
          layout="vertical" 
          initialValues={{ gender: 'male', level: 100, program_code: 'CSC' }}
          onFinish={() => {
            setCurrentStep(1);
          }}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                label="Full Name"
                name="name"
                rules={[{ required: true, message: 'Please enter student name' }]}
              >
                <Input 
                  size="large" 
                  placeholder="Enter student full name" 
                />
              </Form.Item>
            </Col>
            
            <Col span={24}>
              <Form.Item label="Matric Number" name="matric_number">
                <Input.Group compact style={{ display: 'flex' }}>
                  <Input 
                    size="large" 
                    placeholder="Will be auto-generated" 
                    readOnly 
                    style={{ flex: 1 }}
                  />
                  <Button 
                    onClick={() => {
                      const programCode = form.getFieldValue('program_code');
                      const newMatric = generateMatricNumber(programCode);
                      form.setFieldValue('matric_number', newMatric);
                      message.success('New matric number generated');
                    }}
                  >
                    Generate
                  </Button>
                </Input.Group>
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
                name="program_code"
                rules={[{ required: true, message: 'Please select a program' }]}
              >
                <Select
                  size="large"
                  placeholder="Select program"
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) => 
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={programOptions}
                />
              </Form.Item>
            </Col>
          </Row>
          
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Button 
              type="primary" 
              size="large"
              htmlType="submit"
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
            Position student's face in the frame and click Capture Face
          </Text>
          
          <div style={{ 
            height: 400, 
            margin: '24px 0', 
            borderRadius: 8, 
            overflow: 'hidden',
            backgroundColor: '#000'
          }}>
            <FaceCamera
              mode="enrollment"
              onEnrollmentComplete={handleEnrollmentComplete}
              autoCapture={false}
              loading={loading}
            />
          </div>
          
          {/* Debug button - can remove later */}
          <div style={{ marginTop: 16 }}>
            <Button
              type="dashed"
              onClick={async () => {
                const formValues = form.getFieldsValue();
                if (!formValues.name) {
                  message.error('Please fill in name first');
                  return;
                }
                
                setLoading(true);
                // Create a test photo for debugging
                const testPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
                await handleEnrollmentComplete(testPhoto);
              }}
              loading={loading}
            >
              Test Enrollment (No Camera)
            </Button>
          </div>
          
          <Space style={{ marginTop: 16 }}>
            <Button onClick={() => setCurrentStep(0)}>
              Back
            </Button>
            <Text type="secondary">
              Make sure face is clearly visible
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
                maxWidth: 500,
                margin: '0 auto 32px'
              }}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Name: </Text>
                  <Text>{enrollmentResult.student?.name}</Text>
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Matric Number: </Text>
                  <Tag color="blue">{enrollmentResult.student?.matric_number}</Tag>
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Level: </Text>
                  <Tag color="purple">Level {enrollmentResult.student?.level}</Tag>
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Program: </Text>
                  <Text>{enrollmentResult.student?.program_name}</Text>
                  <Text type="secondary"> ({enrollmentResult.student?.program_code})</Text>
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Face Enrollment: </Text>
                  <Tag color={enrollmentResult.faceDetected ? "green" : "orange"}>
                    {enrollmentResult.faceDetected ? '✅ Face Recorded' : '⚠️ No Face Detected'}
                  </Tag>
                </div>
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
              
              <Space>
                <Button type="primary" onClick={() => setCurrentStep(0)}>
                  Start Over
                </Button>
                <Button onClick={resetForm}>
                  Try Again
                </Button>
              </Space>
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