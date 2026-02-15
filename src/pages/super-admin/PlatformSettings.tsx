import React, { useState } from 'react';
import { Card, Typography, Switch, Form, Input, Button, Divider, Space, Alert, message, Row, Col, Tag } from 'antd';
import { Settings, Save, AlertTriangle, Bell } from 'lucide-react';
import { auditService } from '../../services/auditService';

const { Title, Text } = Typography;

const PlatformSettings: React.FC = () => {
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        // Simulate save
        setTimeout(async () => {
            await auditService.logAction({
                action: 'update_platform_settings',
                target_type: 'setting',
                details: { status: 'simulated_update' }
            });
            message.success('Platform settings updated successfully');
            setLoading(false);
        }, 1000);
    };

    return (
        <div>
            <Title level={3}>
                <Settings size={24} style={{ marginRight: 12, verticalAlign: 'middle' }} />
                Platform Settings
            </Title>

            <Row gutter={[16, 16]}>
                <Col span={24} lg={16}>
                    <Card title="Global Configuration" bordered={false}>
                        <Form layout="vertical">
                            <Form.Item label="Platform Name" extra="The name displayed throughout the admin and emails.">
                                <Input defaultValue="FaceAuth Pro" />
                            </Form.Item>

                            <Divider />

                            <Title level={5}><Bell size={18} style={{ marginRight: 8 }} /> Announcements</Title>
                            <Form.Item label="Global Banner Text" extra="Display a message to all users on every page.">
                                <Input.TextArea placeholder="Maintenance scheduled for Sunday..." />
                            </Form.Item>
                            <Form.Item label="Show Banner">
                                <Switch />
                            </Form.Item>

                            <Divider />

                            <Title level={5} className="ant-typography-danger"><AlertTriangle size={18} style={{ marginRight: 8 }} /> Master Controls</Title>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <Text strong>Maintenance Mode</Text>
                                        <br />
                                        <Text type="secondary">Prevents all organizations and devices from interacting with the API.</Text>
                                    </div>
                                    <Switch />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                                    <div>
                                        <Text strong>New Registrations</Text>
                                        <br />
                                        <Text type="secondary">Toggle whether new organizations can sign up.</Text>
                                    </div>
                                    <Switch defaultChecked />
                                </div>
                            </Space>

                            <div style={{ marginTop: 32 }}>
                                <Button type="primary" icon={<Save size={16} />} onClick={handleSave} loading={loading}>
                                    Save Platform Changes
                                </Button>
                            </div>
                        </Form>
                    </Card>
                </Col>

                <Col span={24} lg={8}>
                    <Card title="System Information" bordered={false}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Text type="secondary">Platform Version</Text>
                                <Text strong>2.1.0-alpha</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Text type="secondary">Environment</Text>
                                <Tag color="green">PRODUCTION</Tag>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Text type="secondary">API Status</Text>
                                <Tag color="blue">HEALTHY</Tag>
                            </div>
                            <Divider />
                            <Alert
                                message="Action Required"
                                description="Your Supabase session token is set to expire in 4 days. Remember to rotate keys."
                                type="warning"
                                showIcon
                            />
                        </Space>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default PlatformSettings;
