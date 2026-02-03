// pages/UserProfilePage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Card,
    Form,
    Input,
    Button,
    Upload,
    message,
    Typography,
    Select,
    Switch,
    Avatar,
    Space,
    Divider
} from 'antd';
import {
    User,
    ArrowLeft,
    Save,
    Camera,
    Mail,
    Phone,
    IdCard
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;
const { Option } = Select;

const UserProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const { userId } = useParams();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [photoUrl, setPhotoUrl] = useState<string>('');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (userId) {
            loadUser();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const loadUser = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select(`
          *,
          branch:branches(id, name),
          organization:organizations(id, name, type)
        `)
                .eq('id', userId)
                .single();

            if (error) throw error;

            setUser(data);
            const userData: any = data;
            setPhotoUrl(userData.photo_url || '');

            form.setFieldsValue({
                full_name: data.full_name,
                email: data.email,
                phone: data.phone,
                staff_id: userData.staff_id,
                student_id: userData.student_id,
                gender: userData.gender,
                user_role: data.user_role,
                is_active: data.is_active,
                branch_id: data.branch_id
            });
        } catch (error: any) {
            console.error('Error loading user:', error);
            message.error('Failed to load user details');
        }
    };

    const handlePhotoUpload = async (file: File) => {
        try {
            setUploading(true);

            // Convert file to base64
            const reader = new FileReader();
            reader.readAsDataURL(file);

            reader.onload = async () => {
                const base64 = reader.result as string;

                // Upload to Supabase Storage
                const fileName = `${userId}_${Date.now()}.jpg`;
                const { data, error } = await supabase.storage
                    .from('user-photos')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (error) throw error;

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('user-photos')
                    .getPublicUrl(fileName);

                setPhotoUrl(urlData.publicUrl);
                message.success('Photo uploaded successfully');
            };

            reader.onerror = () => {
                message.error('Failed to read file');
            };
        } catch (error: any) {
            console.error('Error uploading photo:', error);
            message.error('Failed to upload photo');
        } finally {
            setUploading(false);
        }
    };

    const onFinish = async (values: any) => {
        try {
            setLoading(true);

            const updateData: any = {
                full_name: values.full_name,
                email: values.email,
                phone: values.phone,
                gender: values.gender,
                is_active: values.is_active,
                branch_id: values.branch_id
            };

            // Add role-specific ID
            if (values.user_role === 'staff') {
                updateData.staff_id = values.staff_id;
                updateData.student_id = null;
            } else {
                updateData.student_id = values.student_id;
                updateData.staff_id = null;
            }

            // Update photo if changed
            if (photoUrl !== user?.photo_url) {
                updateData.photo_url = photoUrl;
            }

            const { error } = await supabase
                .from('users')
                .update(updateData)
                .eq('id', userId);

            if (error) throw error;

            message.success('Profile updated successfully');
            navigate('/users');
        } catch (error: any) {
            console.error('Error updating profile:', error);
            message.error('Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const uploadButton = (
        <div style={{ textAlign: 'center' }}>
            <Camera size={32} color="#667eea" />
            <div style={{ marginTop: 8, color: '#667eea' }}>
                {uploading ? 'Uploading...' : 'Upload Photo'}
            </div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--gray-50)', padding: '16px' }}>
            {/* Header */}
            <div style={{
                background: 'white',
                padding: '16px 24px',
                borderRadius: '12px',
                marginBottom: 24,
                boxShadow: 'var(--shadow-sm)'
            }}>
                <Button
                    type="text"
                    icon={<ArrowLeft size={24} />}
                    onClick={() => navigate('/users')}
                    style={{ marginBottom: 16, color: 'var(--gray-600)' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        backgroundColor: '#667eea',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <User size={24} color="#fff" />
                    </div>
                    <div>
                        <Title level={3} style={{ margin: 0 }}>
                            Edit User Profile
                        </Title>
                        <Text type="secondary">
                            Update user information and settings
                        </Text>
                    </div>
                </div>
            </div>

            {/* Profile Form */}
            <Card>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    initialValues={{
                        is_active: true,
                        user_role: 'staff'
                    }}
                >
                    {/* Photo Upload */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <Upload
                            name="photo"
                            listType="picture-circle"
                            showUploadList={false}
                            beforeUpload={(file) => {
                                handlePhotoUpload(file);
                                return false;
                            }}
                            accept="image/*"
                        >
                            {photoUrl ? (
                                <Avatar size={120} src={photoUrl} />
                            ) : (
                                uploadButton
                            )}
                        </Upload>
                        <div style={{ marginTop: 8 }}>
                            <Text type="secondary">Click to change photo</Text>
                        </div>
                    </div>

                    <Divider />

                    {/* Basic Information */}
                    <Title level={5}>Basic Information</Title>

                    <Form.Item
                        label="Full Name"
                        name="full_name"
                        rules={[{ required: true, message: 'Please enter full name' }]}
                    >
                        <Input
                            prefix={<User size={16} />}
                            placeholder="Enter full name"
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Email"
                        name="email"
                    >
                        <Input
                            prefix={<Mail size={16} />}
                            placeholder="Enter email address"
                            type="email"
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Phone"
                        name="phone"
                    >
                        <Input
                            prefix={<Phone size={16} />}
                            placeholder="Enter phone number"
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Gender"
                        name="gender"
                    >
                        <Select size="large" placeholder="Select gender">
                            <Option value="male">Male</Option>
                            <Option value="female">Female</Option>
                            <Option value="other">Other</Option>
                        </Select>
                    </Form.Item>

                    <Divider />

                    {/* Role & ID */}
                    <Title level={5}>Role & Identification</Title>

                    <Form.Item
                        label="User Role"
                        name="user_role"
                        rules={[{ required: true, message: 'Please select role' }]}
                    >
                        <Select size="large" disabled>
                            <Option value="staff">Staff</Option>
                            <Option value="student">Student</Option>
                        </Select>
                    </Form.Item>

                    {user?.user_role === 'staff' ? (
                        <Form.Item
                            label="Staff ID"
                            name="staff_id"
                            rules={[{ required: true, message: 'Please enter staff ID' }]}
                        >
                            <Input
                                prefix={<IdCard size={16} />}
                                placeholder="Enter staff ID"
                                size="large"
                            />
                        </Form.Item>
                    ) : (
                        <Form.Item
                            label="Student ID"
                            name="student_id"
                            rules={[{ required: true, message: 'Please enter student ID' }]}
                        >
                            <Input
                                prefix={<IdCard size={16} />}
                                placeholder="Enter student ID"
                                size="large"
                            />
                        </Form.Item>
                    )}

                    <Divider />

                    {/* Status */}
                    <Title level={5}>Account Status</Title>

                    <Form.Item
                        label="Active Status"
                        name="is_active"
                        valuePropName="checked"
                    >
                        <Switch
                            checkedChildren="Active"
                            unCheckedChildren="Inactive"
                        />
                    </Form.Item>

                    <Divider />

                    {/* Action Buttons */}
                    <Form.Item>
                        <Space>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                icon={<Save size={16} />}
                                size="large"
                            >
                                Save Changes
                            </Button>
                            <Button
                                onClick={() => navigate('/users')}
                                size="large"
                            >
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default UserProfilePage;
