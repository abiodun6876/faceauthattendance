// pages/DeviceSetupPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
  message,
  Radio,
  Modal
} from 'antd';
import {
  Smartphone,
  Building,
  CheckCircle,
  QrCode,
  Key,
  Save,
  RefreshCw,
  ArrowLeft,
  MapPin
} from 'lucide-react';
import { supabase, deviceService, organizationService } from '../lib/supabase';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const DeviceSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [deviceCode, setDeviceCode] = useState<string>('');
  const [, setSetupMethod] = useState<'manual' | 'qr'>('manual');

  // Organization Creation State
  const [setupMode, setSetupMode] = useState<'register' | 'login'>('register');
  const [orgMode, setOrgMode] = useState<'join' | 'create'>('join');
  const [createOrgLoading, setCreateOrgLoading] = useState(false);

  // Generate a unique device code
  const generateDeviceCode = useCallback(() => {
    const prefix = 'DEV';
    const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    const code = `${prefix}-${timestamp}-${random}`;
    setDeviceCode(code);
    form.setFieldValue('device_code', code);
  }, [form]);

  // Generate a pairing code
  const generatePairingCode = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    form.setFieldValue('pairing_code', code);
  }, [form]);

  // Auto-generate codes on mount
  useEffect(() => {
    generateDeviceCode();
    generatePairingCode();

    // Subscribe to organization changes (as requested)
    const orgSubscription = supabase.channel('org-setup-watcher')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'organizations' },
        (payload) => {
          console.log('New organization detected via Realtime:', payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orgSubscription);
    };
  }, [generateDeviceCode, generatePairingCode]);

  // Handle Device Login
  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      const result = await deviceService.loginDevice(
        values.login_device_code,
        values.login_pairing_code
      );

      if (result.success && result.device) {
        message.success('Device logged in successfully!');
        // Redirect to dashboard
        setTimeout(() => window.location.href = '/', 1000);
      } else {
        message.error(result.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login exception:', error);
      message.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle Organization Creation
  const handleCreateOrganization = async () => {
    try {
      await form.validateFields(['new_org_name', 'new_org_type', 'new_branch_name']);
      const name = form.getFieldValue('new_org_name');
      const type = form.getFieldValue('new_org_type');
      const branchName = form.getFieldValue('new_branch_name');

      setCreateOrgLoading(true);
      const result = await organizationService.createOrganization({
        name,
        type,
        branchName
      });

      if (result.success && result.organization) {
        message.success('Organization and Main Branch created successfully!');
        // Set the organization code to the new subdomain AND switch to join mode
        form.setFieldValue('organization_code', result.organization.subdomain);
        setOrgMode('join');
      } else {
        if (result.error?.includes('row-level security')) {
          Modal.error({
            title: 'Database Security Violation',
            content: 'Your Supabase RLS policies are blocking branch creation.',
          });
        } else {
          message.error(result.error || 'Failed to create organization');
        }
      }
    } catch (err) {
      // Form validation error
      console.error('Validation failed:', err);
    } finally {
      setCreateOrgLoading(false);
    }
  };


  const onFinish = async (formValues: any) => {
    setLoading(true);

    const values = { ...form.getFieldsValue(true), ...formValues };

    console.log('📱 Form values:', {
      device_name: values.device_name,
      device_code: values.device_code,
      pairing_code: values.pairing_code
    });

    // If in Create mode and organization hasn't been created yet, do it now
    if (orgMode === 'create' && !values.organization_code) {
      try {
        const createResult = await organizationService.createOrganization({
          name: values.new_org_name,
          type: values.new_org_type,
          branchName: values.new_branch_name
        });

        if (createResult.success && createResult.organization) {
          values.organization_code = createResult.organization.subdomain;
          message.success('Organization created automatically!');
        } else {
          message.error(createResult.error || 'Failed to auto-create organization');
          setLoading(false);
          return;
        }
      } catch (err: any) {
        message.error('Failed to validate organization details');
        setLoading(false);
        return;
      }
    }

    try {
      // Pass organization_code if provided
      const result = await deviceService.registerDevice({
        device_name: values.device_name,
        device_code: values.device_code,
        pairing_code: values.pairing_code,
        organization_code: values.organization_code
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
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <Radio.Group
              value={orgMode}
              onChange={e => setOrgMode(e.target.value)}
              buttonStyle="solid"
              style={{ marginBottom: 24 }}
            >
              <Radio.Button value="join">Join Existing</Radio.Button>
              <Radio.Button value="create">Create New</Radio.Button>
            </Radio.Group>
          </div>

          {orgMode === 'join' ? (
            <>
              <Alert
                message="Organization Setup"
                description="If you have an organization code, enter it below. Otherwise, you'll be connected to the default organization."
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />
              <Form.Item
                name="organization_code"
                label="Organization Code (Optional)"
                extra="Leave blank to join the default organization."
              >
                <Input
                  size="large"
                  placeholder="Enter organization code or subdomain"
                  prefix={<Building size={16} />}
                />
              </Form.Item>
            </>
          ) : (
            <div style={{ padding: '0 12px' }}>
              <Alert
                message="Create New Organization"
                description="Set up a new workspace for your company or school."
                type="success"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <Form.Item
                name="new_org_name"
                label="Organization Name"
                rules={[{ required: true, message: 'Please enter organization name' }]}
              >
                <Input size="large" placeholder="e.g. Acme Corp or Springfield High" prefix={<Building size={16} />} />
              </Form.Item>

              <Form.Item
                name="new_org_type"
                label="Organization Type"
                initialValue="company"
              >
                <Select size="large">
                  <Option value="company">Company / Business</Option>
                  <Option value="school">School / Educational</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="new_branch_name"
                label="Primary Branch/Location"
                rules={[{ required: true, message: 'Please enter your first branch name' }]}
                initialValue="Main Office"
              >
                <Input size="large" placeholder="e.g. Headquarters, Lagos Branch" prefix={<MapPin size={16} />} />
              </Form.Item>

              <Button
                type="primary"
                onClick={handleCreateOrganization}
                loading={createOrgLoading}
                block
                size="large"
                style={{ marginTop: 12 }}
              >
                Create & Select Organization
              </Button>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Divider>OR</Divider>
            <QRCode
              value={JSON.stringify({
                type: 'device_registration',
                device_code: deviceCode || form.getFieldValue('device_code'),
                timestamp: new Date().toISOString()
              })}
              size={150}
              icon="/vite.svg"
            />
            <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
              Scan for mobile setup
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
        .catch(() => { });
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
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '16px',
      background: 'var(--gray-50)'
    }}>
      <Card
        style={{
          maxWidth: 900,
          width: '100%',
          border: 'none',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden'
        }}
        bodyStyle={{ padding: '24px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 48, position: 'relative' }}>
          <Button
            type="text"
            icon={<ArrowLeft size={24} />}
            onClick={() => navigate('/')}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              color: 'var(--gray-600)'
            }}
          />
          <Title level={2} style={{ color: 'var(--primary-700)', marginBottom: 8 }}>
            Device Setup
          </Title>
          <Paragraph type="secondary" style={{ fontSize: '1.1rem' }}>
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
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
              <Radio.Group
                value={setupMode}
                onChange={(e) => setSetupMode(e.target.value)}
                buttonStyle="solid"
                size="large"
              >
                <Radio.Button value="register">Register New Device</Radio.Button>
                <Radio.Button value="login">Login Existing Device</Radio.Button>
              </Radio.Group>
            </div>

            {setupMode === 'login' ? (
              <Form
                layout="vertical"
                onFinish={handleLogin}
                size="large"
              >
                <Alert
                  message="Device Login"
                  description="Enter your device credentials to reconnect this device."
                  type="info"
                  showIcon
                  style={{ marginBottom: 24 }}
                />

                <Form.Item
                  name="login_device_code"
                  label="Device Code"
                  rules={[{ required: true, message: 'Please enter device code' }]}
                >
                  <Input prefix={<Smartphone size={16} />} placeholder="e.g. DEV-XXXX-XXXX" />
                </Form.Item>

                <Form.Item
                  name="login_pairing_code"
                  label="Pairing Code"
                  rules={[{ required: true, message: 'Please enter pairing code' }]}
                >
                  <Input.Password prefix={<Key size={16} />} placeholder="Enter 6-character code" />
                </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  size="large"
                  icon={<RefreshCw size={16} />}
                >
                  Login & Sync
                </Button>
              </Form>
            ) : (
              <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                preserve={true}
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
            )}
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