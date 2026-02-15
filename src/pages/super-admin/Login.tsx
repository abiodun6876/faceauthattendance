import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    Typography,
    Space,
    Input,
    Button,
    message
} from 'antd';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const { Title, Text } = Typography;

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [password, setPassword] = useState('');

    const handleLogin = async () => {
        try {
            setLoading(true);

            // Call the secure RPC function to verify password
            const { data, error } = await (supabase as any).rpc('verify_platform_admin', {
                input_password: password
            });

            if (error) throw error;

            const adminRecord = Array.isArray(data) && data.length > 0 ? data[0] : null;

            if (!adminRecord) {
                message.error('Invalid Credentials: Access Denied');
                setLoading(false);
                return;
            }

            sessionStorage.setItem('super_admin_verified', 'true');
            sessionStorage.setItem('super_admin_password', password); // Store for later RPC calls
            message.success('Authorized Access Granted');
            navigate('/super-admin/dashboard');
        } catch (error: any) {
            message.error('Login Failed: ' + error.message);
            setLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh',
            background: '#001529',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column'
        }}>
            <Card style={{ width: 450, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <ShieldCheck size={48} color="#1890ff" style={{ margin: '0 auto' }} />
                    <Title level={3} style={{ marginTop: 16 }}>Super Admin Access</Title>
                    <Text type="secondary">Enter your credentials to manage the platform.</Text>
                </div>

                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <div>
                        <Text strong>Dashboard Password</Text>
                        <Input.Password
                            placeholder="Enter your secret key"
                            style={{ marginTop: 8 }}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onPressEnter={handleLogin}
                        />
                    </div>
                    <Button
                        type="primary"
                        block
                        size="large"
                        onClick={handleLogin}
                        loading={loading}
                    >
                        Log In to Dashboard
                    </Button>
                    <Button type="text" block onClick={() => navigate('/')}>
                        Return to App
                    </Button>
                </Space>
            </Card>
        </div>
    );
};

export default Login;
