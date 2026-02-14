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
    Badge,
    Alert
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
    Clock,
    Users
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
    const [isSupabaseAuthenticated, setIsSupabaseAuthenticated] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [supabasePassword, setSupabasePassword] = useState('');
    const [adminEmail, setAdminEmail] = useState('nigeramventures@gmail.com');
    const [allAdmins, setAllAdmins] = useState<any[]>([]);
    const [adminModalVisible, setAdminModalVisible] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState<any>(null);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminPassword, setNewAdminPassword] = useState('');
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

            // 3. Load Admins
            const { data: admins } = await (supabase as any)
                .from('platform_admins')
                .select('*')
                .order('created_at', { ascending: false });

            setOrganizations(orgs || []);
            setSubscriptions(subs || []);
            setAllAdmins(admins || []);

            // 4. Calculate Stats
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

            if (!user) {
                setLoading(false);
                setIsSupabaseAuthenticated(false);
                return;
            }

            // Query platform_admins for this email
            const { data: adminRecord, error: adminError } = await (supabase as any)
                .from('platform_admins')
                .select('*')
                .eq('email', user.email)
                .single();

            if (adminError || !adminRecord) {
                message.error('Access Denied: You are not authorized as a platform admin.');
                // Don't sign out automatically here to allow the user to see the error, 
                // but prevent access.
                setIsSupabaseAuthenticated(false);
                setLoading(false);
                return;
            }

            setIsSupabaseAuthenticated(true);

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

    const handleSupabaseLogin = async () => {
        try {
            setLoading(true);
            const { error } = await supabase.auth.signInWithPassword({
                email: adminEmail,
                password: supabasePassword
            });

            if (error) throw error;

            // Re-check auth after login to verify they are in the platform_admins table
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: adminRecord } = await (supabase as any)
                    .from('platform_admins')
                    .select('*')
                    .eq('email', user.email)
                    .single();

                if (!adminRecord) {
                    message.error('This account is not authorized for admin access.');
                    await supabase.auth.signOut();
                    setIsSupabaseAuthenticated(false);
                    return;
                }
            }

            setIsSupabaseAuthenticated(true);
            message.success('Account Authenticated');

            // Re-check session for the secondary gate
            const sessionAuth = sessionStorage.getItem('super_admin_verified');
            if (sessionAuth === 'true') {
                setIsAuthenticated(true);
                loadData();
            } else {
                setLoading(false);
            }
        } catch (error: any) {
            message.error('Supabase Login Failed: ' + error.message);
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User session not found');

            const { data: adminRecord } = await (supabase as any)
                .from('platform_admins')
                .select('secondary_password')
                .eq('email', user.email)
                .single();

            if (adminRecord && adminPassword === adminRecord.secondary_password) {
                setIsAuthenticated(true);
                sessionStorage.setItem('super_admin_verified', 'true');
                loadData();
                message.success('Dashboard Unlocked');
            } else {
                message.error('Invalid Security Password');
            }
        } catch (error: any) {
            message.error('Verification failed: ' + error.message);
        } finally {
            setLoading(false);
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

    const adminColumns = [
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => <Tag color="purple">{role.toUpperCase()}</Tag>
        },
        {
            title: 'Security Code',
            dataIndex: 'secondary_password',
            key: 'password',
            render: (pass: string) => <Text code>{pass}</Text>
        },
        {
            title: 'Added On',
            dataIndex: 'created_at',
            key: 'created',
            render: (date: string) => dayjs(date).format('MMM D, YYYY')
        },
        {
            title: 'Action',
            key: 'action',
            render: (record: any) => (
                <Space>
                    <Button
                        size="small"
                        onClick={() => {
                            setEditingAdmin(record);
                            setNewAdminEmail(record.email);
                            setNewAdminPassword(record.secondary_password);
                            setAdminModalVisible(true);
                        }}
                    >
                        Edit
                    </Button>
                    <Button
                        danger
                        size="small"
                        onClick={() => {
                            Modal.confirm({
                                title: 'Remove Admin',
                                content: `Are you sure you want to remove ${record.email}?`,
                                onOk: async () => {
                                    await (supabase as any).from('platform_admins').delete().eq('id', record.id);
                                    message.success('Admin removed');
                                    loadData();
                                }
                            });
                        }}
                    >
                        Delete
                    </Button>
                </Space>
            )
        }
    ];

    const orgColumns = [
        {
            title: 'Organization',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: 'Subdomain',
            dataIndex: 'subdomain',
            key: 'subdomain',
            render: (text: string) => <Tag color="blue">{text}</Tag>
        },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => <Tag>{(type || 'N/A').toUpperCase()}</Tag>
        },
        {
            title: 'Plan',
            dataIndex: 'subscription_plan',
            key: 'plan',
            render: (plan: string) => (
                <Tag color={plan === 'free' ? 'default' : (plan === 'pro' ? 'gold' : 'purple')}>
                    {(plan || 'free').toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Status',
            dataIndex: 'subscription_status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'active' ? 'green' : 'red'}>
                    {(status || 'active').toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Created',
            dataIndex: 'created_at',
            key: 'created',
            render: (date: string) => dayjs(date).format('MMM D, YYYY')
        }
    ];


    const handleSaveAdmin = async () => {
        try {
            if (!newAdminEmail || !newAdminPassword) {
                message.error('Please fill all fields');
                return;
            }

            if (editingAdmin) {
                const { error } = await (supabase as any)
                    .from('platform_admins')
                    .update({
                        secondary_password: newAdminPassword
                    })
                    .eq('id', editingAdmin.id);
                if (error) throw error;
                message.success('Admin updated');
            } else {
                const { error } = await (supabase as any)
                    .from('platform_admins')
                    .insert({
                        email: newAdminEmail,
                        secondary_password: newAdminPassword
                    });
                if (error) throw error;
                message.success('Admin added successfully');
            }
            setAdminModalVisible(false);
            setEditingAdmin(null);
            setNewAdminEmail('');
            setNewAdminPassword('');
            loadData();
        } catch (error: any) {
            message.error('Error saving admin: ' + error.message);
        }
    };

    if (!isSupabaseAuthenticated) {
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
                        <Title level={3} style={{ marginTop: 16 }}>Step 1 of 2: Main Account Access</Title>
                        <Text type="secondary">Sign in with your <b>Main Supabase Account Password</b>.</Text>
                    </div>

                    <Alert
                        message="Password Clarification"
                        description={
                            <span>
                                This is <b>NOT</b> the security code <i>(Nigeram2026@?)</i>.<br />
                                Use the password you use to log into the Supabase Dashboard.
                            </span>
                        }
                        type="warning"
                        showIcon
                        style={{ marginBottom: 24 }}
                    />

                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <div>
                            <Text strong>Account Email</Text>
                            <Input
                                placeholder="nigeramventures@gmail.com"
                                style={{ marginTop: 8 }}
                                value={adminEmail}
                                onChange={(e) => setAdminEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text strong>Supabase Account Password</Text>
                                <Button type="link" size="small" onClick={() => window.open('https://app.supabase.com/project/vpliofrxoalpihmebhrk/settings/auth', '_blank')} style={{ padding: 0, height: 'auto' }}>
                                    Reset Password?
                                </Button>
                            </div>
                            <Input.Password
                                placeholder="NOT the security code"
                                style={{ marginTop: 8 }}
                                value={supabasePassword}
                                onChange={(e) => setSupabasePassword(e.target.value)}
                                onPressEnter={handleSupabaseLogin}
                            />
                        </div>
                        <Button
                            type="primary"
                            block
                            size="large"
                            onClick={handleSupabaseLogin}
                            loading={loading}
                        >
                            Authenticate Main Account
                        </Button>
                        <Button type="text" block onClick={() => navigate('/')}>
                            Return to App
                        </Button>
                    </Space>
                </Card>

            </div>
        );
    }

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
                <Card style={{ width: 450, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <ShieldCheck size={48} color="#faad14" style={{ margin: '0 auto' }} />
                        <Title level={3} style={{ marginTop: 16 }}>Step 2 of 2: Dashboard Security</Title>
                        <Text type="secondary">Enter your **Secondary Security Code** to unlock.</Text>
                    </div>
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <div>
                            <Text strong>Dashboard Security Code (Nigeram2026@?)</Text>
                            <Input.Password
                                placeholder="Enter security code"
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
                            style={{ background: '#faad14', borderColor: '#faad14' }}
                        >
                            Unlock Dashboard
                        </Button>
                        <Button type="text" block onClick={() => {
                            supabase.auth.signOut();
                            setIsSupabaseAuthenticated(false);
                        }}>
                            Sign Out and Return
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
                    <Menu.Item key="4" icon={<Users size={18} />}>Managers</Menu.Item>
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
                            <TabPane
                                tab={
                                    <span>
                                        <Users size={14} style={{ marginRight: 8 }} />
                                        Platform Admins
                                    </span>
                                }
                                key="admins"
                            >
                                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button
                                        type="primary"
                                        onClick={() => {
                                            setEditingAdmin(null);
                                            setNewAdminEmail('');
                                            setNewAdminPassword('');
                                            setAdminModalVisible(true);
                                        }}
                                        icon={<ShieldCheck size={16} />}
                                    >
                                        Add New Admin
                                    </Button>
                                </div>
                                <Table
                                    columns={adminColumns}
                                    dataSource={allAdmins}
                                    loading={loading}
                                    rowKey="id"
                                />
                            </TabPane>
                        </Tabs>
                    </Card>

                    <Modal
                        title={editingAdmin ? "Edit Admin Password" : "Add New Platform Admin"}
                        visible={adminModalVisible}
                        onOk={handleSaveAdmin}
                        onCancel={() => setAdminModalVisible(false)}
                        okText={editingAdmin ? "Update Password" : "Add Admin"}
                    >
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                            <div>
                                <Text strong>Email Address</Text>
                                <Input
                                    placeholder="email@example.com"
                                    value={newAdminEmail}
                                    onChange={(e) => setNewAdminEmail(e.target.value)}
                                    disabled={!!editingAdmin}
                                    style={{ marginTop: 8 }}
                                />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    User must already have a Supabase account to log in.
                                </Text>
                            </div>
                            <div>
                                <Text strong>Secondary Security Code</Text>
                                <Input
                                    placeholder="Security password for Stage 2"
                                    value={newAdminPassword}
                                    onChange={(e) => setNewAdminPassword(e.target.value)}
                                    style={{ marginTop: 8 }}
                                />
                            </div>
                        </Space>
                    </Modal>
                </Content>
            </Layout>
        </Layout>
    );
};

export default SuperAdminDashboard;
