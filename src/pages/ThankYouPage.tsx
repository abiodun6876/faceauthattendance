import React from 'react';
import { Result, Button, Typography, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Home } from 'lucide-react';

const { Title, Text } = Typography;

const ThankYouPage: React.FC = () => {
    const navigate = useNavigate();

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
                        <Text size="large">Your registration has been completed successfully.</Text>
                        <Text type="secondary">We look forward to seeing you at the event.</Text>
                    </Space>
                }
                extra={[
                    <Button
                        type="primary"
                        key="home"
                        size="large"
                        icon={<Home size={18} />}
                        onClick={() => navigate('/')}
                    >
                        Back to Home
                    </Button>
                ]}
            />
        </div>
    );
};

export default ThankYouPage;
