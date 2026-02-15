import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card,
    Row,
    Col,
    Typography,
    Button,
    Tag,
    Divider,
    Space,
    Tabs,
    Statistic,
    message,
    Spin
} from 'antd';
import {
    ArrowLeft,
    Building2,
    Users,
    CreditCard,
    History,
    Calendar,
    Globe,
    CheckCircle2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const OrganizationDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [org, setOrg] = useState<any>(null);
    const [counts, setCounts] = useState({ users: 0, attendance: 0 });

    const loadData = useCallback(async () => {
        try {
            setLoading(true);

            // 1. Get Org Info
            const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', id)
                .single();

            if (orgError) throw orgError;
            setOrg(orgData);

            // 2. Get Counts
            const { count: userCount } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', id);

            const { count: attCount } = await supabase
                .from('attendance')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', id);

            setCounts({ users: userCount || 0, attendance: attCount || 0 });

        } catch (error: any) {
            console.error('Error loading org detail:', error);
            message.error('Failed to load organization details');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
    if (!org) return <div>Organization not found</div>;

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/super-admin/organizations')}>
                    Back to Organizations
                </Button>
            </div>

            <Row gutter={[24, 24]}>
                <Col span={24} lg={16}>
                    <Card bordered={false}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ background: '#e6f7ff', padding: 16, borderRadius: 12 }}>
                                <Building2 size={48} color="#1890ff" />
                            </div>
                            <div>
                                <Title level={2} style={{ margin: 0 }}>{org.name}</Title>
                                <Space style={{ marginTop: 8 }}>
                                    <Tag color="blue">{org.subscription_plan?.toUpperCase()}</Tag>
                                    <Tag color={org.subscription_status === 'active' ? 'green' : 'red'}>
                                        {org.subscription_status?.toUpperCase()}
                                    </Tag>
                                    <Text type="secondary"><Globe size={14} style={{ verticalAlign: 'middle' }} /> {org.subdomain}.faceauth.pro</Text>
                                </Space>
                            </div>
                        </div>

                        <Divider />

                        <Tabs defaultActiveKey="1">
                            <TabPane tab={<span><History size={16} style={{ marginRight: 8 }} /> Overview</span>} key="1">
                                <Row gutter={16}>
                                    <Col span={8}>
                                        <Statistic title="Total Staff" value={counts.users} prefix={<Users size={18} />} />
                                    </Col>
                                    <Col span={8}>
                                        <Statistic title="Attendance This Month" value={counts.attendance} prefix={<CheckCircle2 size={18} />} />
                                    </Col>
                                    <Col span={8}>
                                        <Statistic title="Days Since Signup" value={dayjs().diff(dayjs(org.created_at), 'day')} prefix={<Calendar size={18} />} />
                                    </Col>
                                </Row>

                                <div style={{ marginTop: 24 }}>
                                    <Title level={5}>Registration Details</Title>
                                    <Space direction="vertical" style={{ width: '100%' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Text type="secondary">Joined Date</Text>
                                            <Text>{dayjs(org.created_at).format('MMMM D, YYYY')}</Text>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Text type="secondary">Admin Email</Text>
                                            <Text copyable>{org.admin_email || 'N/A'}</Text>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Text type="secondary">Organization ID</Text>
                                            <Text code>{org.id}</Text>
                                        </div>
                                    </Space>
                                </div>
                            </TabPane>
                            <TabPane tab={<span><CreditCard size={16} style={{ marginRight: 8 }} /> Billing</span>} key="2">
                                <div style={{ padding: '24px 0' }}>
                                    <Text type="secondary">Detailed billing history for this organization will be implemented in the next phase.</Text>
                                </div>
                            </TabPane>
                        </Tabs>
                    </Card>
                </Col>

                <Col span={24} lg={8}>
                    <Card title="Quick Actions" bordered={false}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Button block type="primary">Manage Subscription</Button>
                            <Button block>Reset Subdomain</Button>
                            <Button block danger>Suspend Organization</Button>
                        </Space>
                    </Card>

                    <Card title="Current Plan" bordered={false} style={{ marginTop: 16 }}>
                        <Title level={4} style={{ margin: 0, color: '#1890ff' }}>{org.subscription_plan?.toUpperCase()}</Title>
                        <Text type="secondary">Expires: {org.subscription_expiry ? dayjs(org.subscription_expiry).format('MMM D, YYYY') : 'Lifetime'}</Text>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default OrganizationDetail;
