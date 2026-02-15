import React, { useState, useEffect, useCallback } from 'react';
import { Card, Select, Button, Typography, Space, Alert, Row, Col, message } from 'antd';
import { Camera, CheckCircle, RefreshCcw, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';

const { Title, Text } = Typography;
const { Option } = Select;

const CameraSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [loading, setLoading] = useState(true);

    const handleDevices = useCallback(
        (mediaDevices: MediaDeviceInfo[]) => {
            const videoDevices = mediaDevices.filter(({ kind }) => kind === "videoinput");
            setDevices(videoDevices);

            // Check if we have a saved preference
            const savedId = localStorage.getItem('preferred_camera_id');
            if (savedId && videoDevices.find(d => d.deviceId === savedId)) {
                setSelectedDeviceId(savedId);
            } else if (videoDevices.length > 0) {
                setSelectedDeviceId(videoDevices[0].deviceId);
            }
            setLoading(false);
        },
        [setSelectedDeviceId]
    );

    const refreshDevices = useCallback(() => {
        setLoading(true);
        navigator.mediaDevices.enumerateDevices().then(handleDevices);
    }, [handleDevices]);

    useEffect(() => {
        refreshDevices();
    }, [refreshDevices]);

    const handleSave = () => {
        localStorage.setItem('preferred_camera_id', selectedDeviceId);
        message.success('Camera preference saved successfully');
    };

    const videoConstraints = {
        deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
        width: 1280,
        height: 720
    };

    return (
        <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
            <Button
                icon={<ArrowLeft size={16} />}
                onClick={() => navigate('/')}
                style={{ marginBottom: 16 }}
            >
                Back to Dashboard
            </Button>

            <Card style={{ borderRadius: 12 }}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Title level={3} style={{ margin: 0 }}>Camera Settings</Title>
                            <Text type="secondary">Select your preferred camera for face recognition</Text>
                        </div>
                        <Camera size={24} color="#1890ff" />
                    </div>

                    <Alert
                        message="External Camera Support"
                        description="If you have connected an external webcam, it should appear in the list below. Select it to make it the default for all check-ins."
                        type="info"
                        showIcon
                    />

                    <Row gutter={24}>
                        <Col xs={24} md={12}>
                            <div style={{ marginBottom: 24 }}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>Available Cameras</Text>
                                <Select
                                    style={{ width: '100%' }}
                                    value={selectedDeviceId}
                                    onChange={setSelectedDeviceId}
                                    placeholder="Select building camera"
                                    size="large"
                                    loading={loading}
                                >
                                    {devices.map((device, index) => (
                                        <Option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Camera ${index + 1}`}
                                        </Option>
                                    ))}
                                </Select>
                            </div>

                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Button
                                    type="primary"
                                    size="large"
                                    block
                                    icon={<CheckCircle size={18} />}
                                    onClick={handleSave}
                                >
                                    Set as Default Camera
                                </Button>
                                <Button
                                    icon={<RefreshCcw size={16} />}
                                    block
                                    onClick={refreshDevices}
                                >
                                    Refresh Device List
                                </Button>
                            </Space>
                        </Col>

                        <Col xs={24} md={12}>
                            <Text strong style={{ display: 'block', marginBottom: 8 }}>Camera Preview</Text>
                            <div style={{
                                width: '100%',
                                aspectRatio: '16/9',
                                backgroundColor: '#000',
                                borderRadius: 8,
                                overflow: 'hidden',
                                border: '2px solid #f0f0f0'
                            }}>
                                {selectedDeviceId && (
                                    <Webcam
                                        audio={false}
                                        videoConstraints={videoConstraints}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                )}
                            </div>
                        </Col>
                    </Row>
                </Space>
            </Card>
        </div>
    );
};

export default CameraSettingsPage;
