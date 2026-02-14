import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Layout,
    Menu,
    Typography,
    Card,
    Table,
    Button,
    Tag,
    Space,
    Row,
    Col,
    Statistic,
    Modal,
    Input,
    message,
    Tabs,
    Badge
} from 'antd';
import {
    LayoutDashboard,
    Building2,
    CreditCard,
    CheckCircle,
    XCircle,
    ArrowLeft,
    TrendingUp,
    ShieldCheck,
    Clock
} from 'lucide-react';
import { billingService } from '../services/billingService';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

const SuperAdminDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [stats, setStats] = useState({
        totalOrgs: 0,
        activeSubs: 0,
        totalRevenue: 0,
        pendingApprovals: 0
    });

    const loadData = async () => {
        try {
            setLoading(true);

            // 1. Load Organizations
            const { data: orgs } = await supabase
                .from('organizations')
                .select('*')
                .order('created_at', { ascending: false });

            // 2. Load Subscriptions
            const { data: subs } = await billingService.getAllSubscriptions();

            setOrganizations(orgs || []);
            setSubscriptions(subs || []);

            // 3. Calculate Stats
            const active = orgs?.filter((o: any) => o.subscription_status === 'active' && o.subscription_plan !== 'free').length || 0;
            const revenue = subs?.filter((s: any) => s.status === 'active').reduce((acc: number, s: any) => acc + Number(s.amount), 0) || 0;
            const pending = subs?.filter((s: any) => s.status === 'pending').length || 0;

            setStats({
                totalOrgs: orgs?.length || 0,
                activeSubs: active,
                totalRevenue: revenue,
                pendingApprovals: pending
            });
        } catch (error) {
            console.error('Error loading admin data:', error);
            message.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email !== 'nigeramventures@gmail.com') {
                message.error('Access Denied: Restricted to system owner.');
                navigate('/');
                return;
            }

            // Check if already authenticated during this session
            const sessionAuth = sessionStorage.getItem('super_admin_verified');
            if (sessionAuth === 'true') {
                setIsAuthenticated(true);
                loadData();
            } else {
                setLoading(false);
            }
        };

        checkAuth();
    }, [navigate]);

    const handlePasswordSubmit = () => {
        if (adminPassword === 'Nigeram2026@?') {
            setIsAuthenticated(true);
            sessionStorage.setItem('super_admin_verified', 'true');
            loadData();
            message.success('Dashboard Unlocked');
        } else {
            message.error('Invalid Password');
        }
    };

    const handleApprove = async (sub: any) => {
        Modal.confirm({
            title: 'Approve Subscription',
            content: `Are you sure you want to activate the ${sub.plan_type.toUpperCase()} plan for ${sub.organization?.name}? This will update their expiry date.`,
            onOk: async () => {
                try {
                    await billingService.updateSubscriptionStatus(sub.id, 'active');
                    message.success('Subscription activated successfully!');
                    loadData();
                } catch (error: any) {
                    message.error('Error: ' + error.message);
                }
            }
        });
    };

    const handleReject = async (sub: any) => {
        let reason = '';
        Modal.confirm({
            title: 'Reject Subscription',
            content: (
                <div style={{ marginTop: 16 }}>
                    <Text>Reason for rejection:</Text>
                    <Input
                        placeholder="e.g. Payment not received"
                        onChange={(e) => reason = e.target.value}
                        style={{ marginTop: 8 }}
                    />
                </div>
            ),
            onOk: async () => {
                try {
                    await billingService.updateSubscriptionStatus(sub.id, 'rejected', reason);
                    message.success('Subscription rejected.');
                    loadData();
                } catch (error: any) {
                    message.error('Error: ' + error.message);
                }
            }
        });
    };

    const subColumns = [
        {
            title: 'Organization',
            dataIndex: ['organization', 'name'],
            key: 'org_name',
        },
        {
            title: 'Plan',
            key: 'plan',
            render: (record: any) => (
                <Space>
                    <Tag color="blue">{record.plan_type.toUpperCase()}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{record.billing_cycle}</Text>
                </Space>
            )
        },
        {
            title: 'Amount',
            dataIndex: 'amount',
            key: 'amount',
            render: (val: number) => `$${val.toLocaleString()}`
        },
        {
            title: 'Invoice',
            dataIndex: 'invoice_number',
            key: 'invoice',
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'active' ? 'green' : (status === 'pending' ? 'orange' : 'red')}>
                    {status.toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Requested',
            dataIndex: 'created_at',
            key: 'created',
            render: (date: string) => dayjs(date).format('MMM D, YYYY')
        },
        {
            title: 'Action',
            key: 'action',
            render: (record: any) => (
                record.status === 'pending' ? (
                    <Space>
                        <Button
                            type="primary"
                            size="small"
                            icon={<CheckCircle size={14} />}
                            onClick={() => handleApprove(record)}
                        >
                            Approve
                        </Button>
                        <Button
                            danger
                            size="small"
                            icon={<XCircle size={14} />}
                            onClick={() => handleReject(record)}
                        >
                            Reject
                        </Button>
                    </Space>
                ) : null
            )
        }
    ];

    const orgColumns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: 'Subdomain',
            dataIndex: 'subdomain',
            key: 'subdomain',
        },
        {
            title: 'Plan',
            dataIndex: 'subscription_plan',
            key: 'plan',
            render: (plan: string) => (
                <Tag color={plan === 'free' ? 'default' : 'blue'}>{plan?.toUpperCase() || 'FREE'}</Tag>
            )
        },
        {
            title: 'Status',
            dataIndex: 'subscription_status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'active' ? 'green' : 'red'}>{status?.toUpperCase() || 'ACTIVE'}</Tag>
            )
        },
        {
            title: 'Expiry',
            dataIndex: 'subscription_expiry',
            key: 'expiry',
            render: (date: string) => date ? dayjs(date).format('MMM D, YYYY') : 'Never'
        }
    ];

    if (!isAuthenticated) {
        return (
            <div style={{
                height: '100vh',
                background: '#001529',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'column'
            }}>
                <Card style={{ width: 400, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <ShieldCheck size={48} color="#1890ff" style={{ margin: '0 auto' }} />
                        <Title level={3} style={{ marginTop: 16 }}>Owner Dashboard Login</Title>
                        <Text type="secondary">Verification required to access platform data.</Text>
                    </div>
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <div>
                            <Text strong>Admin Email</Text>
                            <Input value="nigeramventures@gmail.com" disabled style={{ marginTop: 8 }} />
                        </div>
                        <div>
                            <Text strong>Enter Password</Text>
                            <Input.Password
                                placeholder="Security Password"
                                style={{ marginTop: 8 }}
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                onPressEnter={handlePasswordSubmit}
                            />
                        </div>
                        <Button
                            type="primary"
                            block
                            size="large"
                            onClick={handlePasswordSubmit}
                            icon={<ShieldCheck size={18} />}
                        >
                            Unlock Dashboard
                        </Button>
                        <Button type="text" block onClick={() => navigate('/')}>
                            Return to App
                        </Button>
                    </Space>
                </Card>
            </div>
        );
    }

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider width={250} theme="dark">
                <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 24px' }}>
                    <ShieldCheck color="#1890ff" style={{ marginRight: 10 }} />
                    <Title level={4} style={{ color: 'white', margin: 0 }}>Super Admin</Title>
                </div>
                <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline">
                    <Menu.Item key="1" icon={<LayoutDashboard size={18} />}>Dashboard</Menu.Item>
                    <Menu.Item key="2" icon={<Building2 size={18} />}>Organizations</Menu.Item>
                    <Menu.Item key="3" icon={<CreditCard size={18} />}>Subscriptions</Menu.Item>
                </Menu>
            </Sider>
            <Layout>
                <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/')}>Back To App</Button>
                    <Space size="large">
                        <Badge count={stats.pendingApprovals}>
                            <CreditCard size={20} color="#666" />
                        </Badge>
                        <Title level={5} style={{ margin: 0 }}>Administrator</Title>
                    </Space>
                </Header>
                <Content style={{ margin: '24px 16px', padding: 24, background: '#f0f2f5', minHeight: 280 }}>
                    <Row gutter={16}>
                        <Col span={6}>
                            <Card>
                                <Statistic
                                    title="Total Organizations"
                                    value={stats.totalOrgs}
                                    prefix={<Building2 size={24} color="#1890ff" />}
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card>
                                <Statistic
                                    title="Active Subscriptions"
                                    value={stats.activeSubs}
                                    prefix={<TrendingUp size={24} color="#52c41a" />}
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card>
                                <Statistic
                                    title="Potential Revenue"
                                    value={stats.totalRevenue}
                                    prefix={<Text strong style={{ fontSize: 24, marginRight: 8 }}>$</Text>}
                                    precision={2}
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card>
                                <Statistic
                                    title="Pending Approvals"
                                    value={stats.pendingApprovals}
                                    valueStyle={{ color: stats.pendingApprovals > 0 ? '#cf1322' : '#000' }}
                                    prefix={<Clock size={24} color={stats.pendingApprovals > 0 ? '#cf1322' : '#d9d9d9'} />}
                                />
                            </Card>
                        </Col>
                    </Row>

                    <Card style={{ marginTop: 24 }}>
                        <Tabs defaultActiveKey="requests">
                            <TabPane
                                tab={
                                    <span>
                                        Subscription Requests
                                        {stats.pendingApprovals > 0 && <Badge count={stats.pendingApprovals} style={{ marginLeft: 8 }} />}
                                    </span>
                                }
                                key="requests"
                            >
                                <Table
                                    columns={subColumns}
                                    dataSource={subscriptions}
                                    loading={loading}
                                    rowKey="id"
                                />
                            </TabPane>
                            <TabPane tab="All Organizations" key="orgs">
                                <Table
                                    columns={orgColumns}
                                    dataSource={organizations}
                                    loading={loading}
                                    rowKey="id"
                                />
                            </TabPane>
                        </Tabs>
                    </Card>
                </Content>
            </Layout>
        </Layout>
    );
};

export default SuperAdminDashboard;
