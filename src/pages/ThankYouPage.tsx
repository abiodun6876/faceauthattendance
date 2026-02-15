import React from 'react';
import { Result, Button, Typography, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Home } from 'lucide-react';

const { Title, Text } = Typography;

const ThankYouPage: React.FC = () => {
    const navigate = useNavigate();

    React.useEffect(() => {
        const timer = setTimeout(() => {
            window.close();
            // Fallback for browsers
            window.location.href = "about:blank";
        }, 10000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#f0f2f5'
        }}>
            <Result
                icon={<CheckCircle size={72} color="#52c41a" />}
                title={<Title level={2}>Thank You!</Title>}
                subTitle={
                    <Space direction="vertical">
                        <Text strong style={{ fontSize: '18px' }}>Your registration has been completed successfully.</Text>
                        <Text type="secondary" style={{ fontSize: '14px' }}>We look forward to seeing you at the event.</Text>
                        <Text type="secondary" style={{ fontSize: '12px', marginTop: '16px', display: 'block' }}>
                            This window will attempt to close automatically in 10 seconds.
                        </Text>
                    </Space>
                }
                extra={[
                    <Button
                        type="primary"
                        key="close"
                        size="large"
                        icon={<Home size={18} />}
                        onClick={() => {
                            window.close();
                            // Fallback if window.close() is blocked
                            setTimeout(() => {
                                window.location.href = "about:blank";
                            }, 500);
                        }}
                    >
                        Close Window
                    </Button>,
                    <Button
                        key="home"
                        size="large"
                        onClick={() => navigate('/')}
                    >
                        Return to Dashboard
                    </Button>
                ]}
            />
        </div>
    );
};

export default ThankYouPage;
