// pages/DeviceSetupPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Alert,
  Steps,
  Row,
  Col,
  Select,
  Space,
  Divider,
  QRCode,
  message
} from 'antd';
import {
  Smartphone,
  Building,
  CheckCircle,
  QrCode,
  Key,
  Save,
  RefreshCw
} from 'lucide-react';
import supabase, { deviceService } from '../lib/supabase';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const DeviceSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [deviceCode, setDeviceCode] = useState<string>('');
  const [, setSetupMethod] = useState<'manual' | 'qr'>('manual');

  // Generate a unique device code
  const generateDeviceCode = () => {
    const prefix = 'DEV';
    const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    const code = `${prefix}-${timestamp}-${random}`;
    setDeviceCode(code);
    form.setFieldValue('device_code', code);
  };

  // Generate a pairing code
  const generatePairingCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    form.setFieldValue('pairing_code', code);
  };

  
  const onFinish = async (values: any) => {
  setLoading(true);
  
  console.log('📱 Form values:', {
    device_name: values.device_name,
    device_code: values.device_code,
    pairing_code: values.pairing_code
  });
  
  // Debug: Check what organizations exist
  try {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, is_active');
    console.log('📊 Available organizations:', orgs);
  } catch (err) {
    console.error('❌ Failed to fetch organizations:', err);
  }
  
  try {
    // Don't pass organization_code at all - it will use the first active org
    const result = await deviceService.registerDevice({
      device_name: values.device_name,
      device_code: values.device_code,
      pairing_code: values.pairing_code
      // No organization_code parameter
    });

    console.log('📊 Registration Result:', result);

    if (result.success) {
      console.log('🎉 Registration successful!');
      message.success('Device registered successfully!');
      
      setTimeout(() => {
        navigate('/branch-selection');
      }, 1000);
    } else {
      console.error('💥 Registration failed:', result.error);
      message.error(result.error || 'Failed to register device');
    }
  } catch (error: any) {
    console.error('🔥 Registration catch block error:', error);
    message.error(`Unexpected error: ${error.message || 'Please try again'}`);
  } finally {
    setLoading(false);
  }
};

  const steps = [
    {
      title: 'Basic Info',
      icon: <Smartphone size={16} />,
      content: (
        <>
          <Form.Item
            name="device_name"
            label="Device Name"
            rules={[{ required: true, message: 'Please enter device name' }]}
          >
            <Input 
              placeholder="e.g., Main Entrance Scanner" 
              size="large"
              prefix={<Smartphone />}
            />
          </Form.Item>
          
          <Form.Item
            name="device_code"
            label="Device Code"
            rules={[{ required: true, message: 'Please generate device code' }]}
          >
            <Input 
              value={deviceCode}
              placeholder="Click generate to create code"
              size="large"
              addonBefore={
                <Button 
                  type="text" 
                  onClick={generateDeviceCode}
                  icon={<RefreshCw size={14} />}
                >
                  Generate
                </Button>
              }
              readOnly
            />
          </Form.Item>

          <Form.Item
            name="pairing_code"
            label="Pairing Code"
            rules={[{ required: true, message: 'Please generate pairing code' }]}
          >
            <Input 
              placeholder="Click generate to create pairing code"
              size="large"
              addonBefore={
                <Button 
                  type="text" 
                  onClick={generatePairingCode}
                  icon={<Key size={14} />}
                >
                  Generate
                </Button>
              }
              readOnly
            />
          </Form.Item>
        </>
      )
    },
    {
      title: 'Organization',
      icon: <Building size={16} />,
      content: (
        <>
          <Alert
            message="Organization Setup"
            description="If you have an organization code, enter it below. Otherwise, you'll be connected to the default organization."
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
          
          


          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <QRCode
              value={JSON.stringify({
                type: 'device_registration',
                device_code: deviceCode || form.getFieldValue('device_code'),
                timestamp: new Date().toISOString()
              })}
              size={200}
              icon="/vite.svg"
            />
            <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
              Scan QR code for mobile pairing
            </Text>
          </div>
        </>
      )
    },
    {
      title: 'Complete',
      icon: <CheckCircle size={16} />,
      content: (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <CheckCircle size={64} style={{ color: '#52c41a', marginBottom: 24 }} />
          <Title level={3}>Ready to Setup</Title>
          <Paragraph type="secondary">
            Review your device information below. Click "Register Device" to complete the setup.
          </Paragraph>
          
          <Card style={{ maxWidth: 500, margin: '24px auto', textAlign: 'left' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>Device Name:</Text>
                <div>{form.getFieldValue('device_name')}</div>
              </div>
              <Divider style={{ margin: '12px 0' }} />
              <div>
                <Text strong>Device Code:</Text>
                <div>{form.getFieldValue('device_code')}</div>
              </div>
              <Divider style={{ margin: '12px 0' }} />
              <div>
                <Text strong>Pairing Code:</Text>
                <div>{form.getFieldValue('pairing_code')}</div>
              </div>
              <Divider style={{ margin: '12px 0' }} />
              <div>
                <Text strong>Organization Code:</Text>
                <div>{form.getFieldValue('organization_code') || 'Default'}</div>
              </div>
            </Space>
          </Card>
        </div>
      )
    }
  ];

  const nextStep = () => {
    if (currentStep === 0) {
      form.validateFields(['device_name', 'device_code', 'pairing_code'])
        .then(() => setCurrentStep(currentStep + 1))
        .catch(() => {});
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24
    }}>
      <Card
        style={{
          maxWidth: 800,
          width: '100%',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
        bodyStyle={{ padding: 40 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Title level={2} style={{ color: '#667eea' }}>
            Device Setup
          </Title>
          <Paragraph type="secondary">
            Register your device with the FaceAuthAttendance platform
          </Paragraph>
        </div>

        <Row gutter={[48, 48]}>
          <Col xs={24} md={8}>
            <Steps
              direction="vertical"
              current={currentStep}
              items={steps.map((step, index) => ({
                title: step.title,
                icon: step.icon,
                description: index === currentStep ? 'Current' : index < currentStep ? 'Completed' : 'Pending'
              }))}
              style={{ marginBottom: 32 }}
            />
            
            <div style={{ marginTop: 32 }}>
              <Alert
                message="Setup Instructions"
                description={
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    <li>Ensure stable internet connection</li>
                    <li>Keep pairing code secure</li>
                    <li>Place device in accessible location</li>
                    <li>Test camera and microphone</li>
                  </ul>
                }
                type="info"
                showIcon
              />
            </div>
          </Col>
          
          <Col xs={24} md={16}>
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              initialValues={{
                setup_method: 'manual'
              }}
            >
              {/* Setup Method Selection */}
              {currentStep === 0 && (
                <Form.Item
                  name="setup_method"
                  label="Setup Method"
                  style={{ marginBottom: 32 }}
                >
                  <Select
                    size="large"
                    onChange={setSetupMethod}
                  >
                    <Option value="manual">
                      <Space>
                        <Key size={16} />
                        Manual Setup
                      </Space>
                    </Option>
                    <Option value="qr">
                      <Space>
                        <QrCode size={16} />
                        QR Code Setup
                      </Space>
                    </Option>
                  </Select>
                </Form.Item>
              )}

              {/* Current Step Content */}
              {steps[currentStep].content}

              {/* Navigation Buttons */}
              <div style={{
                display: 'flex',
                justifyContent: currentStep > 0 ? 'space-between' : 'flex-end',
                marginTop: 48
              }}>
                {currentStep > 0 && (
                  <Button
                    size="large"
                    onClick={prevStep}
                    disabled={loading}
                  >
                    Previous
                  </Button>
                )}
                
                {currentStep < steps.length - 1 ? (
                  <Button
                    type="primary"
                    size="large"
                    onClick={nextStep}
                  >
                    Next Step
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    size="large"
                    htmlType="submit"
                    loading={loading}
                    icon={<Save size={18} />}
                  >
                    Register Device
                  </Button>
                )}
              </div>
            </Form>
          </Col>
        </Row>

        <Divider style={{ margin: '32px 0' }}>
          <Text type="secondary">Need Help?</Text>
        </Divider>
        
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: '#667eea15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <Smartphone size={20} color="#667eea" />
              </div>
              <Text strong>Mobile App</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Download companion app
              </Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: '#667eea15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <QrCode size={20} color="#667eea" />
              </div>
              <Text strong>QR Code</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Scan for quick setup
              </Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: '#667eea15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <Key size={20} color="#667eea" />
              </div>
              <Text strong>Manual Entry</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Enter codes manually
              </Text>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default DeviceSetupPage;