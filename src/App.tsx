import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Spin, Alert, Typography, ConfigProvider, theme, Card, Row, Col, Button, Layout, Menu, Drawer, Space, Tag } from 'antd';
import {
  UserPlus,
  Camera,
  Book,
  Building,
  Clock,
  Settings,
  Users,
  Briefcase,
  CalendarDays,
  UserCheck,
  Menu as MenuIcon,
  Layout as LayoutIcon,
  ChevronRight,
  Truck,
  MapPin,
  Map
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
import VehicleManagementPage from './pages/VehicleManagementPage';
import DriverTripPage from './pages/DriverTripPage';
import BillingPage from './pages/BillingPage';
import EventsManagementPage from './pages/EventsManagementPage';
// EventRegistrationPage is lazy loaded below
import SuperAdminLayout from './pages/super-admin/SuperAdminLayout';
import SuperAdminDashboardPage from './pages/super-admin/Dashboard';
import SuperAdminLogin from './pages/super-admin/Login';
import SuperAdminOrganizations from './pages/super-admin/Organizations';
import SuperAdminSubscriptions from './pages/super-admin/Subscriptions';
import SuperAdminManagers from './pages/super-admin/Managers';
import AuditLogs from './pages/super-admin/AuditLogs';
import PlatformSettings from './pages/super-admin/PlatformSettings';
import OrganizationDetail from './pages/super-admin/OrganizationDetail';
import { supabase } from './lib/supabase';
import { deviceService } from './services/deviceService';
import { billingService } from './services/billingService';

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
      const { isRegistered, device } = await deviceService.checkRegistration();
      setIsRegistered(isRegistered);
      setDevice(device);
      setLoading(false);
    };
    checkDevice();
  }, []);

  return { isRegistered, device, loading };
};

const EventRegistrationPage = lazy(() => import('./pages/EventRegistrationPage'));
const EventCheckInPage = lazy(() => import('./pages/EventCheckInPage'));
const CameraSettingsPage = lazy(() => import('./pages/CameraSettingsPage'));
const ThankYouPage = lazy(() => import('./pages/ThankYouPage'));

// Wrapper for protected routes
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isRegistered, loading } = useDeviceRegistration();
  const navigate = useNavigate();
  const [checkingSub, setCheckingSub] = useState(true);

  useEffect(() => {
    const checkSub = async () => {
      const orgId = localStorage.getItem('organization_id');
      if (isRegistered && orgId) {
        const { hasAccess, reason } = await billingService.checkAccess(orgId);

        // Handle blocked access
        if (!hasAccess && window.location.pathname !== '/billing') {
          navigate('/billing?reason=' + reason);
        }

        // Handle warnings (10-19 users) - stored in state to show in layout
        if (reason === 'approaching_limit') {
          (window as any).__billing_warning = true;
        } else {
          (window as any).__billing_warning = false;
        }
      }
      setCheckingSub(false);
    };

    if (!loading) {
      checkSub();
    }
  }, [isRegistered, loading, navigate, setCheckingSub]);

  if (loading || checkingSub) {
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
          {loading ? 'Checking device registration...' : 'Verifying subscription...'}
        </Text>
      </div>
    );
  }

  if (!isRegistered && window.location.pathname !== '/super-admin') {
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
    { key: '/vehicles', icon: <Truck size={18} />, label: 'Vehicle Management' },
    { key: '/events', icon: <CalendarDays size={18} />, label: 'Events Management' },
    { key: '/events', icon: <UserCheck size={18} />, label: 'Event Check-In' },
    { key: 'https://trackmycar.netlify.app/', icon: <Map size={18} />, label: 'Track Vehicles' },
    { key: '/org-settings', icon: <Settings size={18} />, label: 'Settings' },
    { key: '/camera-settings', icon: <Camera size={18} />, label: 'Camera Settings' },
  ];

  const handleMenuClick = (e: any) => {
    if (e.key.startsWith('http')) {
      window.open(e.key, '_blank');
    } else {
      navigate(e.key);
    }
    setMobileVisible(false);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Mobile Drawer */}
      <Drawer
        title="Menu"
        placement="left"
        onClose={() => setMobileVisible(false)}
        open={mobileVisible}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '16px', background: '#001529', color: 'white', textAlign: 'center' }}>
          <Title level={4} style={{ color: 'white', margin: 0 }}>Face Attendance</Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[window.location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Drawer>

      {/* Desktop Sider */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        breakpoint="lg"
        collapsedWidth="0"
        trigger={null}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          zIndex: 100,
          background: '#001529'
        }}
      >
        <div style={{
          height: 64,
          margin: 16,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          {!collapsed && <Title level={4} style={{ color: 'white', margin: 0 }}>{device?.organizations?.name || 'Face Attendance'}</Title>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[window.location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 0 : (window.innerWidth < 992 ? 0 : 250), transition: 'margin 0.2s' }}>
        <Header style={{
          padding: '0 16px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 99,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={<MenuIcon size={20} />}
              onClick={() => setMobileVisible(true)}
              style={{ display: window.innerWidth < 992 ? 'flex' : 'none', alignItems: 'center' }}
            />
            <Text strong style={{ fontSize: 18 }}>
              {menuItems.find(item => item.key === window.location.pathname)?.label || 'Dashboard'}
            </Text>
          </div>
          <Space>
            {device?.branches?.name && <Tag color="blue">{device.branches.name}</Tag>}
            <Text type="secondary">{device?.name}</Text>
          </Space>
        </Header>

        <Content style={{ margin: '16px', minHeight: 280 }}>
          {(window as any).__billing_warning && window.location.pathname !== '/billing' && (
            <Alert
              message="Subscription Recommended"
              description="Your organization has reached 10+ users. The free tier is for small teams (<10). Please consider upgrading to avoid service interruption when you reach 20 users."
              type="warning"
              showIcon
              closable
              action={
                <Button size="small" type="primary" onClick={() => navigate('/billing')}>
                  View Plans
                </Button>
              }
              style={{ marginBottom: 16 }}
            />
          )}
          {children}
        </Content>

        <Footer style={{ textAlign: 'center', backgroundColor: '#fff', borderTop: '1px solid #f0f0f0' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            FaceAuthAttendance Platform • v2.0 • {device?.branches?.name}
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

  const loadDashboardStats = useCallback(async () => {
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
  }, [device, setStats]);

  useEffect(() => {
    if (device?.organization_id) {
      loadDashboardStats();
    }
  }, [device, loadDashboardStats]);

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
      key: 'vehicles',
      title: 'Vehicle Management',
      description: 'Track vehicles & document expiry',
      icon: <Truck size={32} />,
      path: '/vehicles',
      color: '#1890ff',
    },
    {
      key: 'track-vehicles',
      title: 'Track Vehicles',
      description: 'Real-time vehicle tracking via mobile',
      icon: <Map size={32} />,
      path: 'https://trackmycar.netlify.app/',
      color: '#faad14',
    },
    {
      key: 'driver-trip',
      title: 'Driver Trip',
      description: 'Share Google Maps trip links',
      icon: <MapPin size={32} />,
      path: '/driver-trip',
      color: '#52c41a',
      show: device?.current_user?.user_role === 'driver'
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
      key: 'events',
      title: 'Events Management',
      description: 'Create & track organization events',
      icon: <CalendarDays size={32} />,
      path: '/events',
      color: '#1890ff',
    },
    {
      key: 'event-checkin',
      title: 'Event Check-In',
      description: 'Face/QR check-in for event attendees',
      icon: <UserCheck size={32} />,
      path: '/events',
      color: '#52c41a',
    },
    {
      key: 'settings',
      title: 'Device Settings',
      description: 'Pairing codes and configuration',
      icon: <Settings size={32} />,
      path: '/device-setup',
      color: '#595959',
    },
    {
      key: 'camera-settings',
      title: 'Camera Settings',
      description: 'Choose external/inbuilt camera',
      icon: <Camera size={32} />,
      path: '/camera-settings',
      color: '#13c2c2',
    },
  ];

  // Filter cards based on user role
  const filteredCards = cards.filter(card => card.show !== false);

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
            <Text style={{ display: 'block', color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
              Role: {device?.current_user?.user_role || 'User'}
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
          {filteredCards.map((card) => (
            <Col xs={24} sm={12} lg={6} key={card.key}>
              <Card
                hoverable
                onClick={() => {
                  if (card.path.startsWith('http')) {
                    window.open(card.path, '_blank');
                  } else {
                    navigate(card.path);
                  }
                }}
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
          {/* Add new routes for vehicle management */}
          <Route path="/vehicles" element={
            <ProtectedRoute>
              <OrganizationLayout>
                <VehicleManagementPage />
              </OrganizationLayout>
            </ProtectedRoute>
          } />
          <Route path="/events" element={
            <ProtectedRoute>
              <OrganizationLayout>
                <EventsManagementPage />
              </OrganizationLayout>
            </ProtectedRoute>
          } />
          <Route path="/events/:eventId/check-in" element={
            <ProtectedRoute>
              <Suspense fallback={<div style={{ padding: 20, textAlign: 'center' }}><Spin /></div>}>
                <EventCheckInPage />
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/camera-settings" element={
            <ProtectedRoute>
              <OrganizationLayout>
                <Suspense fallback={<div style={{ padding: 20, textAlign: 'center' }}><Spin /></div>}>
                  <CameraSettingsPage />
                </Suspense>
              </OrganizationLayout>
            </ProtectedRoute>
          } />
          <Route path="/register-event/:eventId" element={
            <Suspense fallback={<Spin size="large" spinning />}>
              <EventRegistrationPage />
            </Suspense>
          } />
          <Route path="/thank-you" element={
            <Suspense fallback={<Spin size="large" spinning />}>
              <ThankYouPage />
            </Suspense>
          } />
          <Route path="/event-checkin/:eventId" element={
            <Suspense fallback={<Spin size="large" spinning />}>
              <EventCheckInPage />
            </Suspense>
          } />
          <Route path="/driver-trip" element={
            <ProtectedRoute>
              <DriverTripPage />
            </ProtectedRoute>
          } />
          <Route path="/billing" element={
            <ProtectedRoute>
              <BillingPage />
            </ProtectedRoute>
          } />
          {/* Super Admin Routes */}
          <Route path="/super-admin" element={<SuperAdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="login" element={<SuperAdminLogin />} />
            <Route path="dashboard" element={<SuperAdminDashboardPage />} />
            <Route path="organizations" element={<SuperAdminOrganizations />} />
            <Route path="organizations/:id" element={<OrganizationDetail />} />
            <Route path="subscriptions" element={<SuperAdminSubscriptions />} />
            <Route path="managers" element={<SuperAdminManagers />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="settings" element={<PlatformSettings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;