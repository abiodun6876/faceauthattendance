// pages/EnrollmentPage.tsx - FIXED WITH REAL FACE EMBEDDINGS
import React, { useState, useEffect, useCallback } from 'react';
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
  Spin,
  Alert,
  Upload,
  Radio,
  Modal,
  Descriptions,
  Divider,
  Avatar,
  Progress,
  Image
} from 'antd';
import {
  Camera,
  User,
  CheckCircle,
  IdCard,
  Building as _Building,
  Mail,
  Phone,
  Upload as UploadIcon,
  UserPlus,
  X,
  Briefcase,
  GraduationCap,
  Shield,
  AlertCircle,
  Zap
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase, deviceService } from '../lib/supabase';
import faceService from '../utils/faceService';
import dayjs from 'dayjs';


const { Title, Text } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

interface OrganizationSettings {
  id_label?: string;
  attendance_mode?: 'shift' | 'session';
  requires_department?: boolean;
  requires_branch?: boolean;
}

interface FaceProcessingResult {
  success: boolean;
  embedding?: Float32Array;
  photoData?: string;
  quality?: number;
  error?: string;
  faceDetected?: boolean;
  faceBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Unused variables - removed or prefixed with underscore
// const enrollStudent: any = null; // Commented out as unused
// interface EnrollmentData {} // Commented out as unused

const EnrollmentPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [faceProcessing, setFaceProcessing] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [form] = Form.useForm();
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [organizationSettings, setOrganizationSettings] = useState<OrganizationSettings>({});
  const [captureMethod, setCaptureMethod] = useState<'camera' | 'upload'>('camera');
  const [_photoData, setPhotoData] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [faceProcessingResult, setFaceProcessingResult] = useState<FaceProcessingResult | null>(null);
  const [showFaceQuality, setShowFaceQuality] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  const loadDeviceInfo = useCallback(async () => {
    setLoading(true);
    try {
      // Check validation first
      const { isRegistered, device } = await deviceService.checkDeviceRegistration();

      if (!isRegistered || !device) {
        message.warning('Device not registered. Redirecting to setup...');
        setTimeout(() => window.location.href = '/device-setup', 1500);
        return;
      }

      setDeviceInfo(device);
      const settings = device.organization?.settings as OrganizationSettings;
      setOrganizationSettings(settings || {});

      if (!device.branch_id) {
        message.warning('Branch not selected. Redirecting...');
        setTimeout(() => window.location.href = '/branch-selection', 1500);
      }
    } catch (error) {
      console.error('Error loading device info:', error);
      message.error('Failed to load device information');
    } finally {
      setLoading(false);
    }
  }, []);

  const initializeForm = useCallback(() => {
    const initialValues: any = {
      gender: 'male',
      user_role: 'staff'
    };

    if (deviceInfo?.branch_id) {
      initialValues.branch_id = deviceInfo.branch_id;
    }

    form.setFieldsValue(initialValues);
  }, [form, deviceInfo?.branch_id]);

  const generateUserId = (userRole: string) => {
    const prefix = userRole === 'student' ? 'STU' : 'EMP';
    const year = dayjs().format('YYYY');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}${year}${random}`;
  };

  const goToFaceCapture = useCallback(async () => {
    try {
      const values = await form.validateFields();

      if (!values.staff_id) {
        const newId = generateUserId(values.user_role);
        form.setFieldValue('staff_id', newId);
        values.staff_id = newId;
      }

      if (values.email && !/\S+@\S+\.\S+/.test(values.email)) {
        throw new Error('Please enter a valid email address');
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('staff_id', values.staff_id)
        .eq('organization_id', deviceInfo?.organization_id)
        .single();

      if (existingUser) {
        throw new Error(`User with ID ${values.staff_id} already exists`);
      }

      setFormData(values);
      setCurrentStep(1);
      message.success('User information saved. Ready for face capture.');
    } catch (error: any) {
      console.error('Form validation error:', error);
      message.error(error.message || 'Please fill in all required fields correctly');
    }
  }, [form, deviceInfo?.organization_id]);

  const checkDuplicateFace = useCallback(async (embedding: Float32Array) => {
    try {
      // Convert to array for Supabase function
      const embeddingArray = Array.from(embedding);

      const { data: matches, error } = await supabase.rpc(
        'match_users_by_face',
        {
          filter_organization_id: deviceInfo?.organization_id,
          match_threshold: 0.70, // 70% similarity threshold
          query_embedding: JSON.stringify(embeddingArray)
        }
      );

      if (error) {
        console.error('Duplicate check error:', error);
        return { exists: false };
      }

      if (matches && matches.length > 0) {
        const match = matches[0];
        return {
          exists: true,
          userId: match.staff_id || match.id,
          userName: match.full_name,
          similarity: match.similarity
        };
      }

      return { exists: false };
    } catch (error) {
      console.error('Duplicate check error:', error);
      return { exists: false };
    }
  }, [deviceInfo?.organization_id]);

  const handleEnrollment = useCallback(async (photoData: string, faceResult: FaceProcessingResult) => {
    setLoading(true);

    try {
      if (!faceResult.embedding) {
        throw new Error('Face embedding not available');
      }

      // Prepare user data - BOTH staff and student go to the users table
      const userData = {
        full_name: formData.full_name,
        staff_id: formData.staff_id,
        email: formData.email || null,
        phone: formData.phone || null,
        user_role: formData.user_role, // 'staff', 'student', or 'admin'
        gender: formData.gender,
        branch_id: formData.branch_id || deviceInfo?.branch_id,
        department_id: formData.department_id || null,
        organization_id: deviceInfo?.organization_id,
        is_active: true,
        enrollment_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // For students, add extra fields if needed
      if (formData.user_role === 'student') {
        userData['level'] = formData.level || 100;
        userData['program_code'] = formData.department_name || 'General';
      }

      // 💾 SAVE DRAFT TO LOCAL STORAGE FIRST (Reliability requirement)
      const enrollmentDraft = {
        userData,
        faceResult: {
          ...faceResult,
          embedding: Array.from(faceResult.embedding) // Must convert Float32Array to regular array for JSON
        },
        photoData,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('pending_enrollment_draft', JSON.stringify(enrollmentDraft));
      console.log('📝 Enrollment draft saved to local storage');

      // Insert user into the users table
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert(userData)
        .select()
        .single();

      if (userError) throw userError;

      // Convert embedding to string for database storage
      const embeddingArray = Array.from(faceResult.embedding);
      const embeddingString = JSON.stringify(embeddingArray); // Convert to JSON string

      // Create face enrollment with STRING embedding
      const faceEnrollmentData = {
        user_id: user.id,
        organization_id: deviceInfo?.organization_id,
        photo_url: photoData,
        embedding: embeddingString, // STORE AS STRING (JSON format)
        capture_device: deviceInfo?.device_name || 'web_camera',
        enrollment_location: deviceInfo?.branch?.name || 'unknown',
        is_primary: true,
        is_active: true,
        quality_score: faceResult.quality || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: faceEnrollment, error: faceError } = await supabase
        .from('face_enrollments')
        .insert(faceEnrollmentData)
        .select()
        .single();

      if (faceError) {
        // Rollback user creation if face enrollment fails
        await supabase
          .from('users')
          .delete()
          .eq('id', user.id);
        throw faceError;
      }

      // Update user with face enrollment info
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          enrollment_status: 'enrolled',
          face_enrolled_at: new Date().toISOString(),
          face_photo_url: photoData,
          face_embedding: embeddingString,
          face_embedding_stored: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error('Final status update failed:', updateError);
        // We don't throw here to avoid rollback if the face data is already saved
        // but we should warn the user
        message.warning('User enrolled but status update failed. Please contact admin.');
      } else {
        console.log('User status successfully updated to enrolled:', updatedUser.id);
      }

      // Create log entry
      await supabase
        .from('face_match_logs')
        .insert({
          user_id: user.id,
          organization_id: deviceInfo?.organization_id,
          device_id: deviceInfo?.id,
          photo_url: photoData,
          confidence_score: faceResult.quality || 0,
          threshold_score: 70,
          is_match: true,
          verification_result: 'enrollment',
          created_at: new Date().toISOString()
        });

      const result = {
        success: true,
        user,
        faceEnrollment,
        faceDetected: faceResult.faceDetected,
        quality: faceResult.quality
      };

      setEnrollmentResult(result);
      // ✅ SUCCESS - CLEAR DRAFT
      localStorage.removeItem('pending_enrollment_draft');
      console.log('🗑️ Enrollment draft cleared');

      setCurrentStep(2);
      message.success(`${formData.user_role === 'student' ? 'Student' : 'Staff'} enrolled with biometrics!`);

    } catch (error: any) {
      console.error('Enrollment error:', error);
      const result = {
        success: false,
        error: error.message || 'Enrollment failed. Please try again.'
      };
      setEnrollmentResult(result);
      setCurrentStep(2);
    } finally {
      setLoading(false);
    }
  }, [formData, deviceInfo]);

  const processFaceImage = useCallback(async (capturedPhotoData: string) => {
    setFaceProcessing(true);
    setProcessingProgress(10);

    try {
      // Initialize face models
      setProcessingProgress(20);
      const initialized = await faceService.initializeModels();
      if (!initialized) {
        throw new Error('Face recognition models failed to load');
      }

      // Process face
      setProcessingProgress(40);
      const result = await faceService.processImage(capturedPhotoData);
      setFaceProcessingResult(result);

      if (!result.success) {
        throw new Error(result.error || 'Face processing failed');
      }

      if (!result.embedding) {
        throw new Error('Could not extract face embedding');
      }

      // Check for duplicate face
      setProcessingProgress(60);
      const duplicateCheck = await checkDuplicateFace(result.embedding);
      if (duplicateCheck.exists) {
        throw new Error(`This face is already enrolled as ${duplicateCheck.userName} (${duplicateCheck.userId})`);
      }

      setPhotoData(capturedPhotoData);
      setPhotoPreview(capturedPhotoData);
      setProcessingProgress(100);

      // Auto-proceed to enrollment after successful face capture
      if (formData.full_name) {
        await handleEnrollment(capturedPhotoData, result);
      }

    } catch (error: any) {
      console.error('Face processing error:', error);
      message.error(error.message || 'Face processing failed');
    } finally {
      setFaceProcessing(false);
      setProcessingProgress(0);
    }
  }, [formData, checkDuplicateFace, handleEnrollment]);

  const handleFaceCapture = useCallback(async (capturedPhotoData: string) => {
    console.log('Face captured, processing...');

    if (!formData.full_name) {
      message.error('Please fill in user information first');
      setCurrentStep(0);
      return;
    }

    await processFaceImage(capturedPhotoData);
  }, [formData, processFaceImage]);

  const handlePhotoUpload = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result as string;
        await processFaceImage(result);
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, [processFaceImage]);

  const syncPendingDraft = useCallback(async () => {
    const draft = localStorage.getItem('pending_enrollment_draft');
    if (!draft) return;

    try {
      const { userData, faceResult, photoData } = JSON.parse(draft);
      Modal.confirm({
        title: 'Unsynced Enrollment Found',
        content: `We found a pending enrollment for ${userData.full_name}. Would you like to try syncing it now?`,
        onOk: async () => {
          // Re-convert regular array back to Float32Array
          const reconstructedFaceResult = {
            ...faceResult,
            embedding: new Float32Array(faceResult.embedding)
          };
          setFormData(userData); // Set form data so handleEnrollment works correctly
          await handleEnrollment(photoData, reconstructedFaceResult);
        }
      });
    } catch (e) {
      console.error('Failed to parse draft:', e);
    }
  }, [handleEnrollment]);

  useEffect(() => {
    loadDeviceInfo();
    initializeForm();
    syncPendingDraft(); // Check for drafts on mount
  }, [loadDeviceInfo, initializeForm, syncPendingDraft]);

  const uploadProps = {
    beforeUpload: (file: File) => {
      handlePhotoUpload(file);
      return false;
    },
    maxCount: 1,
    accept: 'image/*',
    showUploadList: false
  };

  const getTitle = () => {
    if (!deviceInfo) return 'Biometric Enrollment';
    const orgType = deviceInfo.organization?.type;
    const idLabel = organizationSettings.id_label || 'Staff ID';

    if (orgType === 'school') {
      return 'Student Biometric Enrollment';
    } else {
      return `${idLabel} Biometric Enrollment`;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'student': return <GraduationCap size={16} />;
      case 'admin': return <Shield size={16} />;
      default: return <Briefcase size={16} />;
    }
  };

  const steps = [
    {
      title: 'User Information',
      icon: <User size={16} />,
      content: (
        <Form form={form} layout="vertical" initialValues={{ user_role: 'staff', gender: 'male' }}>
          <Alert
            message="Biometric Enrollment"
            description="Fill in user details. After this, we'll capture and process face biometrics."
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="Full Name" name="full_name" rules={[{ required: true }]}>
                <Input size="large" placeholder="Enter full name" prefix={<User size={16} />} />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item label={organizationSettings.id_label || 'ID'} name="staff_id" extra="Leave blank to auto-generate">
                <Input size="large" placeholder="Will be auto-generated" prefix={<IdCard size={16} />} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Role" name="user_role" rules={[{ required: true }]}>
                <Select size="large" optionLabelProp="label">
                  <Option value="staff" label="Staff">
                    <Space><Briefcase size={14} />Staff</Space>
                  </Option>
                  <Option value="student" label="Student">
                    <Space><GraduationCap size={14} />Student</Space>
                  </Option>
                  <Option value="admin" label="Admin">
                    <Space><Shield size={14} />Admin</Space>
                  </Option>
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Gender" name="gender">
                <Select size="large">
                  <Option value="male">Male</Option>
                  <Option value="female">Female</Option>
                  <Option value="other">Other</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Email" name="email" rules={[{ type: 'email' }]}>
                <Input size="large" placeholder="email@example.com" prefix={<Mail size={16} />} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Phone" name="phone">
                <Input size="large" placeholder="+1234567890" prefix={<Phone size={16} />} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Button
              type="primary"
              size="large"
              onClick={goToFaceCapture}
              icon={<UserPlus size={18} />}
            >
              Continue to Face Biometrics
            </Button>
          </div>
        </Form>
      )
    },
    {
      title: 'Face Biometrics',
      icon: <Camera size={16} />,
      content: (
        <div style={{ textAlign: 'center' }}>
          <Title level={4} style={{ marginBottom: 16 }}>Face Biometric Capture</Title>

          {formData.full_name && (
            <Card size="small" style={{ marginBottom: 24, backgroundColor: '#f0f9ff' }}>
              <Row align="middle" justify="space-between">
                <Col>
                  <Space align="center">
                    <Avatar size={40} style={{ backgroundColor: '#1890ff' }}>
                      {getRoleIcon(formData.user_role)}
                    </Avatar>
                    <div style={{ textAlign: 'left' }}>
                      <Text strong>{formData.full_name}</Text>
                      <div style={{ marginTop: 4 }}>
                        <Tag color="blue">{formData.staff_id}</Tag>
                        <Tag color="green" style={{ marginLeft: 8 }}>
                          {formData.user_role?.toUpperCase()}
                        </Tag>
                      </div>
                    </div>
                  </Space>
                </Col>
              </Row>
            </Card>
          )}

          {faceProcessing && (
            <Card style={{ marginBottom: 24, backgroundColor: '#f6ffed' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>Processing Face Biometrics...</Text>
                <Progress percent={processingProgress} status="active" />
                <Text type="secondary">
                  {processingProgress < 30 && 'Loading face models...'}
                  {processingProgress >= 30 && processingProgress < 50 && 'Detecting face...'}
                  {processingProgress >= 50 && processingProgress < 70 && 'Extracting features...'}
                  {processingProgress >= 70 && 'Checking database...'}
                </Text>
              </Space>
            </Card>
          )}

          {faceProcessingResult && !faceProcessingResult.success && (
            <Alert
              message="Face Detection Failed"
              description={faceProcessingResult.error}
              type="error"
              showIcon
              style={{ marginBottom: 24 }}
              action={
                <Button size="small" onClick={() => setFaceProcessingResult(null)}>
                  Try Again
                </Button>
              }
            />
          )}

          {faceProcessingResult?.success && (
            <Card style={{ marginBottom: 24, backgroundColor: '#f6ffed' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <CheckCircle size={20} color="#52c41a" />
                  <Text strong>Face Biometrics Captured Successfully!</Text>
                </Space>
                <Row gutter={16}>
                  <Col span={12}>
                    <Text>Quality Score:</Text>
                    <Progress
                      percent={faceProcessingResult.quality}
                      status={faceProcessingResult.quality > 70 ? 'success' : 'normal'}
                      size="small"
                    />
                  </Col>
                  <Col span={12}>
                    <Button
                      type="link"
                      onClick={() => setShowFaceQuality(true)}
                      icon={<AlertCircle size={14} />}
                    >
                      View Details
                    </Button>
                  </Col>
                </Row>
              </Space>
            </Card>
          )}

          <div style={{ marginBottom: 24 }}>
            <Radio.Group
              value={captureMethod}
              onChange={(e) => setCaptureMethod(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="camera">
                <Space><Camera size={14} />Use Camera</Space>
              </Radio.Button>
              <Radio.Button value="upload">
                <Space><UploadIcon size={14} />Upload Photo</Space>
              </Radio.Button>
            </Radio.Group>
          </div>

          {captureMethod === 'camera' ? (
            <div style={{ height: 400, marginBottom: 24, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' }}>
              <FaceCamera
                mode="enrollment"
                onEnrollmentComplete={handleFaceCapture}
                autoCapture={false}
                loading={faceProcessing}
              />
            </div>
          ) : (
            <Dragger {...uploadProps} style={{ marginBottom: 24, height: 300 }}>
              <div style={{ padding: '60px 20px' }}>
                <UploadIcon size={48} color="#1890ff" style={{ marginBottom: 16 }} />
                <Text style={{ display: 'block', fontSize: 16, marginBottom: 8 }}>
                  Click or drag photo to this area
                </Text>
                <Text type="secondary">
                  Upload a clear frontal face photo for biometric enrollment
                </Text>
              </div>
            </Dragger>
          )}

          {photoPreview && (
            <Card title="Biometric Preview" size="small" style={{ marginBottom: 24 }}>
              <Image
                src={photoPreview}
                alt="Face Preview"
                width={200}
                height={200}
                style={{ borderRadius: 4, objectFit: 'cover' }}
                preview={{
                  visible: false,
                  mask: <span>View Full</span>,
                }}
                onClick={() => setShowFaceQuality(true)}
              />
            </Card>
          )}

          <Divider>
            <Text type="secondary">Biometric Guidelines</Text>
          </Divider>

          <Alert
            message="For Best Results"
            description={
              <ul style={{ margin: 0, paddingLeft: 16, textAlign: 'left' }}>
                <li>Face the camera directly with neutral expression</li>
                <li>Ensure good lighting (no shadows on face)</li>
                <li>Remove glasses, hats, or masks</li>
                <li>Keep face within the frame</li>
                <li>Use high-resolution image</li>
              </ul>
            }
            type="info"
            showIcon
          />
        </div>
      )
    },
    {
      title: 'Complete',
      icon: <CheckCircle size={16} />,
      content: enrollmentResult ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }}>
          {enrollmentResult.success ? (
            <div style={{ maxWidth: 600, width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <CheckCircle size={80} color="#52c41a" style={{ marginBottom: 24 }} />
                <Title level={2} style={{ marginBottom: 8 }}>
                  Biometric Enrollment Successful!
                </Title>
                <Text type="secondary" style={{ fontSize: 16 }}>
                  User has been registered and face biometrics stored securely.
                </Text>
              </div>

              <Card
                style={{
                  borderRadius: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  marginBottom: 32,
                  border: '1px solid #f0f0f0'
                }}
              >
                <Descriptions
                  column={1}
                  size="middle"
                  bordered
                  labelStyle={{ fontWeight: 'bold', width: 150 }}
                >
                  <Descriptions.Item label="Full Name">
                    {formData.full_name}
                  </Descriptions.Item>
                  <Descriptions.Item label="ID Number">
                    <Tag color="blue" style={{ fontSize: 14 }}>{formData.staff_id}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="User Role">
                    <Tag color="green">{formData.user_role?.toUpperCase()}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Biometric Status">
                    <Space>
                      <Progress
                        percent={enrollmentResult.quality}
                        size="small"
                        style={{ width: 120 }}
                        status="success"
                      />
                      <Text strong>{enrollmentResult.quality}% Match Quality</Text>
                    </Space>
                  </Descriptions.Item>
                </Descriptions>

                <div style={{ marginTop: 24 }}>
                  <Alert
                    message="Biometric Security Active"
                    description="This user can now perform face-recognition based clock-ins and clock-outs on any authorized device."
                    type="success"
                    showIcon
                  />
                </div>
              </Card>

              <Space style={{ width: '100%', justifyContent: 'center' }} size="large">
                <Button
                  type="primary"
                  size="large"
                  onClick={() => {
                    form.resetFields();
                    setFormData({});
                    setPhotoData('');
                    setPhotoPreview('');
                    setFaceProcessingResult(null);
                    setEnrollmentResult(null);
                    setCurrentStep(0);
                    initializeForm();
                  }}
                  icon={<UserPlus size={18} />}
                >
                  Enroll Another User
                </Button>
                <Button
                  size="large"
                  onClick={() => window.location.href = '/attendance'}
                >
                  Go to Attendance
                </Button>
              </Space>
            </div>
          ) : (
            <>
              <X size={64} color="#ff4d4f" style={{ marginBottom: 24 }} />
              <Title level={3} style={{ color: '#ff4d4f', marginBottom: 24 }}>
                Enrollment Failed
              </Title>

              <Card style={{ marginBottom: 32, maxWidth: 500, margin: '0 auto', backgroundColor: '#fff2f0' }}>
                <Text style={{ color: '#ff4d4f' }}>
                  {enrollmentResult.error}
                </Text>
              </Card>

              <Space>
                <Button type="primary" onClick={() => setCurrentStep(0)}>
                  Start Over
                </Button>
                <Button onClick={() => setCurrentStep(1)}>
                  Retry Face Capture
                </Button>
              </Space>
            </>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <Text style={{ display: 'block', marginTop: 16 }}>
            Finalizing enrollment...
          </Text>
        </div>
      )
    }
  ];

  if (loading && !deviceInfo) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}>
        <Spin size="large" />
        <Text type="secondary" style={{ marginTop: 20 }}>
          Initializing biometric enrollment...
        </Text>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      padding: '40px 24px',
      background: 'var(--gray-50)' // Using design token
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'white',
            boxShadow: 'var(--shadow-md)',
            marginBottom: 24
          }}>
            <IdCard size={32} color="var(--primary-600)" />
          </div>
          <Title level={2} style={{ margin: '0 0 16px', color: 'var(--gray-900)' }}>
            {getTitle()}
          </Title>
          <Text style={{ fontSize: '1.1rem', color: 'var(--gray-500)' }}>
            {deviceInfo?.organization?.name || 'FaceAuthAttendance System'}
          </Text>
          <div style={{ marginTop: 16 }}>
            <Tag
              icon={<Zap size={12} />}
              color="blue"
              style={{
                padding: '4px 12px',
                borderRadius: 20,
                border: 'none',
                background: 'var(--primary-50)',
                color: 'var(--primary-700)'
              }}
            >
              Biometric Authentication Enabled
            </Tag>
          </div>
        </div>

        <Card
          bordered={false}
          style={{
            borderRadius: 24,
            boxShadow: 'var(--shadow-xl)',
            overflow: 'hidden'
          }}
          bodyStyle={{ padding: 48 }}
        >
          {/* FIXED: Using items prop instead of children */}
          <Steps
            current={currentStep}
            style={{ marginBottom: 48 }}
            items={steps.map((step, index) => ({
              title: step.title,
              icon: step.icon,
              description: index === currentStep ? 'In Progress' : index < currentStep ? 'Completed' : 'Pending'
            }))}
          />

          <div style={{ minHeight: 400 }}>
            {steps[currentStep].content}
          </div>
        </Card>
      </div>

      <Modal
        title="Face Quality Analysis"
        open={showFaceQuality}
        onCancel={() => setShowFaceQuality(false)}
        footer={[
          <Button key="close" onClick={() => setShowFaceQuality(false)}>
            Close
          </Button>
        ]}
        width={700}
      >
        {faceProcessingResult && (
          <Row gutter={24}>
            <Col span={12}>
              <div style={{ textAlign: 'center' }}>
                <Image
                  src={photoPreview}
                  alt="Face Analysis"
                  width={300}
                  height={300}
                  style={{ borderRadius: 8, objectFit: 'cover' }}
                />
                <div style={{ marginTop: 16 }}>
                  <Text strong>Face Detection: </Text>
                  <Tag color={faceProcessingResult.faceDetected ? 'green' : 'red'}>
                    {faceProcessingResult.faceDetected ? 'Detected' : 'Not Detected'}
                  </Tag>
                </div>
              </div>
            </Col>
            <Col span={12}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>Quality Metrics:</Text>
                <div>
                  <Text>Overall Quality:</Text>
                  <Progress
                    percent={faceProcessingResult.quality}
                    status={faceProcessingResult.quality > 70 ? 'success' : 'normal'}
                  />
                </div>
                {faceProcessingResult.faceBox && (
                  <div>
                    <Text>Position:</Text>
                    <Text type="secondary" style={{ display: 'block' }}>
                      X: {Math.round(faceProcessingResult.faceBox.x)},
                      Y: {Math.round(faceProcessingResult.faceBox.y)}
                    </Text>
                  </div>
                )}
                <div>
                  <Text>Embedding:</Text>
                  <Tag color="blue">128-dimensional vector</Tag>
                </div>
                <Alert
                  message="Quality Guidelines"
                  description="Quality score above 70 is recommended for reliable recognition."
                  type="info"
                  showIcon
                />
              </Space>
            </Col>
          </Row>
        )}
      </Modal>
    </div>
  );
};

export default EnrollmentPage;