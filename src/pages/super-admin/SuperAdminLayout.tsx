import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet, Link } from 'react-router-dom';
import {
    Layout,
    Menu,
    Typography,
    Button,
    Space,
    Badge,
    Spin,
    message
} from 'antd';
import {
    LayoutDashboard,
    Building2,
    CreditCard,
    Users,
    ArrowLeft,
    ShieldCheck,
    LogOut,
    ClipboardList,
    Settings
} from 'lucide-react';
import { billingService } from '../../services/billingService';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const SuperAdminLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        const checkAuth = () => {
            const isVerified = sessionStorage.getItem('super_admin_verified') === 'true';
            if (isVerified) {
                setIsAuthenticated(true);
                loadPendingCount();
            } else {
                if (location.pathname !== '/super-admin/login') {
                    navigate('/super-admin/login');
                }
            }
            setLoading(false);
        };

        checkAuth();
    }, [navigate, location.pathname]);

    const loadPendingCount = async () => {
        try {
            const { data } = await billingService.getAllSubscriptions();
            const pending = data?.filter((s: any) => s.status === 'pending').length || 0;
            setPendingCount(pending);
        } catch (error) {
            console.error('Error loading pending count:', error);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('super_admin_verified');
        sessionStorage.removeItem('super_admin_password');
        sessionStorage.removeItem('super_admin_email');
        setIsAuthenticated(false);
        message.success('Logged out successfully');
        navigate('/');
    };

    const menuItems = [
        {
            key: '/super-admin/dashboard',
            icon: <LayoutDashboard size={18} />,
            label: <Link to="/super-admin/dashboard">Dashboard</Link>,
        },
        {
            key: '/super-admin/organizations',
            icon: <Building2 size={18} />,
            label: <Link to="/super-admin/organizations">Organizations</Link>,
        },
        {
            key: '/super-admin/subscriptions',
            icon: <CreditCard size={18} />,
            label: (
                <Space>
                    <Link to="/super-admin/subscriptions">Subscriptions</Link>
                    {pendingCount > 0 && <Badge count={pendingCount} size="small" />}
                </Space>
            ),
        },
        {
            key: '/super-admin/managers',
            icon: <Users size={18} />,
            label: <Link to="/super-admin/managers">Managers</Link>,
        },
        {
            key: '/super-admin/audit-logs',
            icon: <ClipboardList size={18} />,
            label: <Link to="/super-admin/audit-logs">Audit Logs</Link>,
        },
        {
            key: '/super-admin/settings',
            icon: <Settings size={18} />,
            label: <Link to="/super-admin/settings">Settings</Link>,
        },
    ];

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!isAuthenticated && location.pathname === '/super-admin/login') {
        return <Outlet />;
    }

    if (!isAuthenticated) return null;

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider width={250} theme="dark" breakpoint="lg" collapsedWidth="0">
                <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 24px' }}>
                    <ShieldCheck color="#1890ff" style={{ marginRight: 10 }} />
                    <Title level={4} style={{ color: 'white', margin: 0 }}>Super Admin</Title>
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                />
            </Sider>
            <Layout>
                <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/')}>Back To App</Button>
                    <Space size="large">
                        <Badge count={pendingCount}>
                            <CreditCard size={20} color="#666" style={{ cursor: 'pointer' }} onClick={() => navigate('/super-admin/subscriptions')} />
                        </Badge>
                        <Button type="text" icon={<LogOut size={16} />} onClick={handleLogout}>
                            Logout
                        </Button>
                    </Space>
                </Header>
                <Content style={{ margin: '24px 16px', padding: 24, background: '#f0f2f5', minHeight: 280, overflow: 'auto' }}>
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    );
};

export default SuperAdminLayout;
