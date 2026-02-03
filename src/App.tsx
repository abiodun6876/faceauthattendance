import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Spin, Alert, Typography, ConfigProvider, theme, Card, Row, Col, Button, Layout, Avatar, Menu, Drawer, message } from 'antd';
import {
  UserPlus,
  Camera,
  Book,
  ArrowLeft,
  Building,
  Clock,
  Settings,
  Users,
  Briefcase,
  CalendarDays,
  UserCheck,
  Menu as MenuIcon,
  X,
  Layout as LayoutIcon,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import EnrollmentPage from './pages/EnrollmentPage';
import AttendancePage from './pages/AttendancePage';
import AttendanceManagementPage from './pages/AttendanceManagementPage';
import DeviceSetupPage from './pages/DeviceSetupPage';
import BranchSelectionPage from './pages/BranchSelectionPage';
import UsersManagementPage from './pages/UsersManagementPage';
import OrganizationSettingsPage from './pages/OrganizationSettingsPage';
import UserProfilePage from './pages/UserProfilePage';
import VisitorManagementPage from './pages/VisitorManagementPage';
import CustomerManagementPage from './pages/CustomerManagementPage';
import LeaveManagementPage from './pages/LeaveManagementPage';
import { supabase, deviceService } from './lib/supabase';
import './App.css';

const { Title, Text } = Typography;
const { Header, Content, Footer } = Layout;

interface ConnectionStatus {
  status: 'testing' | 'connected' | 'error';
  message: string;
  details?: any;
}

// Check if device is registered
const useDeviceRegistration = () => {
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [device, setDevice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDevice = async () => {
      const { isRegistered, device } = await deviceService.checkDeviceRegistration();
      setIsRegistered(isRegistered);
      setDevice(device);
      setLoading(false);
    };
    checkDevice();
  }, []);

  return { isRegistered, device, loading };
};

// Wrapper for protected routes
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isRegistered, loading } = useDeviceRegistration(); // Removed device since it's not used
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}>
        <Spin size="large" />
        <Text type="secondary" style={{ marginTop: 20 }}>
          Checking device registration...
        </Text>
      </div>
    );
  }

  if (!isRegistered) {
    navigate('/device-setup');
    return null;
  }

  return <>{children}</>;
};

const { Sider } = Layout;

// Page wrapper with organization header & sidebar
const OrganizationLayout = ({ children }: { children: React.ReactNode }) => {
  const { device } = useDeviceRegistration();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);
  const navigate = useNavigate();

  const menuItems = [
    { key: '/', icon: <LayoutIcon size={18} />, label: 'Dashboard' },
    { key: '/enroll', icon: <UserPlus size={18} />, label: 'Enrollment' },
    { key: '/attendance', icon: <Clock size={18} />, label: 'Mark Attendance' },
    { key: '/attendance-management', icon: <Book size={18} />, label: 'Attendance Records' },
    { key: '/visitors', icon: <UserCheck size={18} />, label: 'Visitors' },
    { key: '/users', icon: <Users size={18} />, label: 'User Management' },
    { key: '/leave', icon: <CalendarDays size={18} />, label: 'Leave' },
    { key: '/customers', icon: <Briefcase size={18} />, label: 'Customers' },
    { key: '/org-settings', icon: <Settings size={18} />, label: 'Settings' },
  ];

  const handleMenuClick = (e: any) => {
    navigate(e.key);
    setMobileVisible(false);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Desktop Sider */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        breakpoint="lg"
        collapsedWidth="0"
        trigger={null}
        style={{
          background: '#fff',
          boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
          zIndex: 100,
          position: 'fixed',
          height: '100vh',
          left: 0,
        }}
        className="desktop-sider"
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          {!collapsed && <Title level={4} style={{ margin: 0, color: '#fff', fontSize: 16 }}>FaceAuth</Title>}
        </div>
        <Menu
          mode="inline"
          defaultSelectedKeys={[window.location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0, marginTop: 16 }}
        />
      </Sider>

      {/* Mobile Drawer */}
      <Drawer
        placement="left"
        onClose={() => setMobileVisible(false)}
        open={mobileVisible}
        bodyStyle={{ padding: 0 }}
        width={250}
        closable={false}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <Title level={4} style={{ margin: 0, color: '#fff' }}>FaceAuth</Title>
          <X color="#fff" onClick={() => setMobileVisible(false)} cursor="pointer" />
        </div>
        <Menu
          mode="inline"
          defaultSelectedKeys={[window.location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </Drawer>

      <Layout
        style={{
          marginLeft: (collapsed || window.innerWidth <= 992) ? 0 : 200,
          transition: 'all 0.2s',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        className="main-layout"
      >
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 99,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={<MenuIcon size={20} />}
              onClick={() => setMobileVisible(true)}
              className="mobile-menu-btn"
              style={{ display: 'none' }} // Controlled by CSS
            />
            {/* Desktop toggle */}
            <Button
              type="text"
              icon={collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
              onClick={() => setCollapsed(!collapsed)}
              className="desktop-menu-btn"
            />

            <div style={{ display: mobileVisible ? 'none' : 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar
                size="small"
                style={{ backgroundColor: '#667eea' }}
              >
                {device?.organization?.name?.charAt(0) || 'F'}
              </Avatar>
              <Title level={5} style={{ margin: 0 }} className="header-title">
                {device?.organization?.name || 'FaceAuthAttendance'}
              </Title>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="primary"
              shape="round"
              icon={<ArrowLeft size={16} />}
              onClick={() => navigate('/')}
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}
              className="home-btn"
            >
              Dashboard
            </Button>
          </div>
        </Header>

        <Content style={{ padding: '24px', minHeight: 280, backgroundColor: '#fcfcfd' }}>
          <style>{`
            @media (max-width: 992px) {
              .desktop-sider { display: none !important; }
              .mobile-menu-btn { display: block !important; }
              .desktop-menu-btn { display: none !important; }
              .header-title { font-size: 14px !important; }
              .home-btn span { display: none; }
            }
          `}</style>
          {children}
        </Content>

        <Footer style={{ textAlign: 'center', backgroundColor: '#fff', borderTop: '1px solid #f0f0f0' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            FaceAuthAttendance Platform • v2.0 • {device?.branch?.name}
          </Text>
        </Footer>
      </Layout>
    </Layout>
  );
};

// Home page with device info
const DashboardPage = () => {
  const { device } = useDeviceRegistration();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    present: 0,
    late: 0,
    absent: 0,
    total: 0
  });

  useEffect(() => {
    if (device?.organization_id) {
      loadDashboardStats();
    }
  }, [device]);

  const loadDashboardStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const organizationId = device?.organization_id;
      const branchId = device?.branch_id;

      // Fetch attendance stats
      let attendanceQuery = supabase
        .from('attendance')
        .select('status')
        .eq('organization_id', organizationId)
        .eq('date', today);

      if (branchId) {
        attendanceQuery = attendanceQuery.eq('branch_id', branchId);
      }

      const { data: attendanceData } = await attendanceQuery;

      // Fetch total users (staff/students)
      let usersQuery = supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (branchId) {
        usersQuery = usersQuery.eq('branch_id', branchId);
      }

      const { count: totalUsers } = await usersQuery;

      const present = attendanceData?.filter(a => a.status === 'present').length || 0;
      const late = attendanceData?.filter(a => a.status === 'late').length || 0;
      const total = totalUsers || 0;
      const absent = Math.max(0, total - present);

      setStats({ present, late, absent, total });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  };

  const cards = [
    {
      key: 'enroll',
      title: device?.organization?.type === 'school' ? 'Student Enrollment' : 'Staff Enrollment',
      description: device?.organization?.type === 'school'
        ? 'Enroll new students with face recognition'
        : 'Enroll new staff with face recognition',
      icon: <UserPlus size={32} />,
      path: '/enroll',
      color: '#1890ff',
    },
    {
      key: 'attendance',
      title: device?.organization?.settings?.attendance_mode === 'shift' ? 'Clock In/Out' : 'Take Attendance',
      description: device?.organization?.settings?.attendance_mode === 'shift'
        ? 'Clock in and out using face recognition'
        : 'Mark attendance using face recognition',
      icon: device?.organization?.settings?.attendance_mode === 'shift'
        ? <Clock size={32} />
        : <Camera size={32} />,
      path: '/attendance',
      color: '#52c41a',
    },
    {
      key: 'attendance-management',
      title: 'Attendance Management',
      description: 'View, search and filter all records',
      icon: <Book size={32} />,
      path: '/attendance-management',
      color: '#722ed1',
    },
    {
      key: 'branch-selection',
      title: 'Switch Branch',
      description: 'Change your current branch/location',
      icon: <Building size={32} />,
      path: '/branch-selection',
      color: '#fa8c16',
    },
    {
      key: 'visitors',
      title: 'Visitor Management',
      description: 'Appointments & Pass Codes',
      icon: <UserCheck size={32} />,
      path: '/visitors',
      color: '#13c2c2',
    },
    {
      key: 'customers',
      title: 'Customer Management',
      description: 'Manage clients & business',
      icon: <Briefcase size={32} />,
      path: '/customers',
      color: '#eb2f96',
    },
    {
      key: 'leave',
      title: 'Leave Management',
      description: 'Schedule & Leave status',
      icon: <CalendarDays size={32} />,
      path: '/leave',
      color: '#fa541c',
    },
    {
      key: 'users',
      title: 'Users Management',
      description: 'Manage staff and students',
      icon: <Users size={32} />,
      path: '/users',
      color: '#722ed1',
    },
    {
      key: 'org-settings',
      title: 'Attendance Settings',
      description: 'Work hours & Late rules',
      icon: <Settings size={32} />,
      path: '/org-settings',
      color: '#2f54eb',
    },
    {
      key: 'settings',
      title: 'Device Settings',
      description: 'Pairing codes and configuration',
      icon: <Settings size={32} />,
      path: '/device-setup',
      color: '#595959',
    },
  ];

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f0f2f5'
    }}>
      {/* Organization Info Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '24px',
        color: '#fff',
        borderRadius: '0 0 16px 16px',
        marginBottom: 24
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ color: '#fff', margin: 0, fontSize: '1.5rem', wordBreak: 'break-word' }}>
              {device?.organization?.name || 'FaceAuthAttendance'}
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.9)', display: 'block' }}>
              {device?.branch?.name} • {device?.device_name}
            </Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text style={{ display: 'block', color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
              ID Type: {device?.organization?.settings?.id_label || 'Staff ID'}
            </Text>
            <Text style={{ display: 'block', color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
              Mode: {device?.organization?.settings?.attendance_mode === 'shift' ? 'Shift-based' : 'Session-based'}
            </Text>
          </div>
        </div>
      </div>

      <div style={{
        flex: 1,
        padding: '0 16px 24px', // Reduced side padding from 24px to 16px
        maxWidth: 1200,
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Stats Section */}
        <div style={{ marginBottom: 32 }}>
          <Row gutter={[12, 12]} justify="center" wrap={false} style={{ overflowX: 'auto', paddingBottom: 8 }}>
            {[
              { label: 'Present', value: stats.present, color: '#52c41a', path: '/attendance-management' },
              { label: 'Late', value: stats.late, color: '#fa8c16', path: '/attendance-management' },
              { label: 'Absent', value: stats.absent, color: '#f5222d', path: '/attendance-management' },
              {
                label: device?.organization?.type === 'school' ? 'Students' : 'Staff',
                value: stats.total,
                color: '#1890ff',
                path: '/users'
              }
            ].map((stat, index) => (
              <Col key={index}>
                <div
                  onClick={() => navigate(stat.path)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: 80,
                    cursor: 'pointer',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{
                    width: 70,
                    height: 70,
                    borderRadius: '50%',
                    border: `3px solid ${stat.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    marginBottom: 8,
                    position: 'relative'
                  }}>
                    <span style={{ fontSize: 20, fontWeight: 'bold', color: stat.color }}>{stat.value}</span>
                    <div style={{
                      position: 'absolute',
                      bottom: -5,
                      right: -5,
                      background: stat.color,
                      borderRadius: '50%',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <ChevronRight size={10} color="#fff" />
                    </div>
                  </div>
                  <Text style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>{stat.label}</Text>
                </div>
              </Col>
            ))}
          </Row>
        </div>

        <Title level={3} style={{ marginBottom: 24 }}>
          Dashboard
        </Title>

        <Row gutter={[16, 16]}> {/* Reduced gutter from 24 to 16 */}
          {cards.map((card) => (
            <Col xs={24} sm={12} lg={6} key={card.key}>
              <Card
                hoverable
                onClick={() => navigate(card.path)}
                style={{
                  height: '100%',
                  border: `1px solid ${card.color}20`,
                  borderRadius: 12,
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                bodyStyle={{
                  padding: '24px',
                  textAlign: 'center',
                }}
              >
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16
                }}>
                  <div style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    backgroundColor: `${card.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {React.cloneElement(card.icon, { color: card.color })}
                  </div>
                  <Title level={4} style={{ margin: 0, color: card.color }}>
                    {card.title}
                  </Title>
                  <Text type="secondary" style={{ fontSize: '14px' }}>
                    {card.description}
                  </Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

      </div>
    </div>
  );
};

function App() {
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'testing',
    message: 'Initializing...'
  });

  useEffect(() => {
    async function testConnection() {
      try {
        // Only destructure error since organizations is not used
        const { error } = await supabase
          .from('organizations')
          .select('*')
          .limit(1);

        if (error) {
          console.error('Connection test failed:', error);
          setConnectionStatus({
            status: 'error',
            message: 'Database Connection Failed',
            details: error.message
          });
        } else {
          setConnectionStatus({
            status: 'connected',
            message: 'Connected to Multi-Tenant Platform',
            details: null
          });
        }
      } catch (error: any) {
        console.error('Connection test failed:', error);
        setConnectionStatus({
          status: 'error',
          message: 'Network Error',
          details: error.message
        });
      } finally {
        setLoading(false);
      }
    }

    testConnection();
  }, []);

  if (connectionStatus.status === 'error') {
    return (
      <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          padding: 20,
          maxWidth: 500,
          margin: '0 auto'
        }}>
          <Alert
            message="Platform Connection Error"
            description={
              <div>
                <p>Failed to connect to FaceAuthAttendance platform.</p>
                <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
                  Error: {connectionStatus.details}
                </p>
                <div style={{ marginTop: 20 }}>
                  <Button
                    type="primary"
                    onClick={() => window.location.reload()}
                  >
                    Retry Connection
                  </Button>
                </div>
              </div>
            }
            type="error"
            showIcon
          />
        </div>
      </ConfigProvider>
    );
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}>
        <Spin size="large" />
        <Title level={4} style={{ marginTop: 20, color: '#1890ff' }}>
          FaceAuthAttendance Platform
        </Title>
        <Text type="secondary" style={{ marginTop: 8 }}>
          {connectionStatus.message}
        </Text>
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#667eea',
          borderRadius: 8,
        },
      }}
    >
      <Router>
        <Routes>
          {/* Device setup (public route) */}
          <Route path="/device-setup" element={<DeviceSetupPage />} />
          <Route path="/branch-selection" element={<BranchSelectionPage />} />

          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/enroll" element={
            <ProtectedRoute>
              <OrganizationLayout>
                <EnrollmentPage />
              </OrganizationLayout>
            </ProtectedRoute>
          } />
          <Route path="/attendance" element={
            <ProtectedRoute>
              <AttendancePage />
            </ProtectedRoute>
          } />
          <Route path="/attendance-management" element={
            <ProtectedRoute>
              <OrganizationLayout>
                <AttendanceManagementPage />
              </OrganizationLayout>
            </ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute>
              <UsersManagementPage />
            </ProtectedRoute>
          } />
          <Route path="/org-settings" element={
            <ProtectedRoute>
              <OrganizationSettingsPage />
            </ProtectedRoute>
          } />
          <Route path="/users/:userId/edit" element={
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          } />
          <Route path="/visitors" element={
            <ProtectedRoute>
              <VisitorManagementPage />
            </ProtectedRoute>
          } />
          <Route path="/customers" element={
            <ProtectedRoute>
              <CustomerManagementPage />
            </ProtectedRoute>
          } />
          <Route path="/leave" element={
            <ProtectedRoute>
              <LeaveManagementPage />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;