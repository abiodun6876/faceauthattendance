// pages/EnrollmentPage.tsx - Fixed version
import React, { useState } from 'react';
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
import { Camera, User, BookOpen, CheckCircle, IdCard } from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { enrollStudent, EnrollmentData } from '../utils/enrollmentUtils';

const { Title, Text } = Typography;


const EnrollmentPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<any>(null);
  const [form] = Form.useForm();

  const handleEnrollmentComplete = async (photoData: string) => {
    setLoading(true);
    
    try {
      const formValues = form.getFieldsValue();
      
      // Generate matric number if not provided
      if (!formValues.matric_number) {
        const newMatric = generateMatricNumber();
        form.setFieldValue('matric_number', newMatric);
        formValues.matric_number = newMatric;
      }
      
      const enrollmentData: EnrollmentData = {
        student_id: formValues.matric_number,
        name: formValues.name,
        email: formValues.email,
        phone: formValues.phone,
        gender: formValues.gender,
        program: formValues.program,
        level: formValues.level,
        photoData
      };
      
      const result = await enrollStudent(enrollmentData);
      
      if (result.success) {
        setEnrollmentResult(result);
        setCurrentStep(2);
        message.success('Student enrolled successfully!');
      } else {
        message.error(`Enrollment failed: ${result.error}`);
      }
    } catch (error: any) {
      message.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateMatricNumber = () => {
    const currentYear = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ABU/${currentYear}/${randomNum}`;
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

  const steps = [
    {
      title: 'Basic Info',
      icon: <User size={16} />,
      content: (
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                label="Full Name"
                name="name"
                rules={[{ required: true, message: 'Please enter name' }]}
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
                  <Button onClick={() => {
                    const newMatric = generateMatricNumber();
                    form.setFieldValue('matric_number', newMatric);
                    message.success('New matric number generated');
                  }}>
                    Generate
                  </Button>
                </div>
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item label="Gender" name="gender" initialValue="male">
                <Select size="large">
                  <Select.Option value="male">Male</Select.Option>
                  <Select.Option value="female">Female</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item label="Level" name="level" initialValue={100}>
                <Select size="large">
                  {[100, 200, 300, 400, 500].map(level => (
                    <Select.Option key={level} value={level}>
                      Level {level}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item label="Email" name="email">
                <Input size="large" type="email" placeholder="student@email.com" />
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item label="Phone" name="phone">
                <Input size="large" placeholder="+234 XXX XXX XXXX" />
              </Form.Item>
            </Col>
            
            <Col span={24}>
              <Form.Item 
                label="Program" 
                name="program"
                rules={[{ required: true, message: 'Please enter program' }]}
              >
                <Input size="large" placeholder="e.g., Computer Science" />
              </Form.Item>
            </Col>
          </Row>
          
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Button 
              type="primary" 
              size="large"
              onClick={() => setCurrentStep(1)}
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
                  <Text>{enrollmentResult.student.program}</Text>
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