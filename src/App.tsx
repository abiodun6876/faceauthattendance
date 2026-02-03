import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Spin, Alert, Typography, ConfigProvider, theme, Card, Row, Col, Button, Layout, Avatar } from 'antd';
import {
  UserPlus,
  Camera,
  Book,
  ArrowLeft,
  Building,
  Clock,
  Settings,
  Users
} from 'lucide-react';
import EnrollmentPage from './pages/EnrollmentPage';
import AttendancePage from './pages/AttendancePage';
import AttendanceManagementPage from './pages/AttendanceManagementPage';
import DeviceSetupPage from './pages/DeviceSetupPage';
import BranchSelectionPage from './pages/BranchSelectionPage';
import UsersManagementPage from './pages/UsersManagementPage';
import OrganizationSettingsPage from './pages/OrganizationSettingsPage';
import UserProfilePage from './pages/UserProfilePage';
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

// Page wrapper with organization header
const OrganizationLayout = ({ children }: { children: React.ReactNode }) => {
  const { device } = useDeviceRegistration();

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <Header style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar
            size="large"
            style={{
              backgroundColor: '#fff',
              color: '#667eea',
              fontWeight: 'bold'
            }}
          >
            {device?.organization?.name?.charAt(0) || 'F'}
          </Avatar>
          <div>
            <Title level={4} style={{ margin: 0, color: '#fff' }}>
              {device?.organization?.name || 'FaceAuthAttendance'}
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
              {device?.branch?.name} • {device?.device_name}
            </Text>
          </div>
        </div>

        <Button
          type="text"
          icon={<ArrowLeft size={18} />}
          onClick={() => window.location.href = '/'}
          style={{
            color: '#fff',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14 }}>Home</Text>
        </Button>
      </Header>

      <Content style={{ padding: '24px', flex: 1 }}>
        {children}
      </Content>

      <Footer style={{
        textAlign: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff',
        padding: '12px'
      }}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
          FaceAuthAttendance Platform • {device?.organization?.settings?.id_label || 'Staff ID'} System
        </Text>
      </Footer>
    </Layout>
  );
};

// Home page with device info
const DashboardPage = () => {
  const { device } = useDeviceRegistration();
  const navigate = useNavigate();

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
      key: 'users',
      title: 'Users Management',
      description: 'View and manage all users',
      icon: <Users size={32} />,
      path: '/users',
      color: '#13c2c2',
    },
    {
      key: 'org-settings',
      title: 'Attendance Settings',
      description: 'Configure times and analytics',
      icon: <Clock size={32} />,
      path: '/org-settings',
      color: '#eb2f96',
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

        {/* Stats Section */}
        <div style={{ marginTop: 48 }}>
          <Title level={4}>Today's Summary</Title>
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Card style={{ borderRadius: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#52c41a' }}>0</div>
                  <Text type="secondary">Present Today</Text>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderRadius: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fa8c16' }}>0</div>
                  <Text type="secondary">Late Today</Text>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderRadius: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#f5222d' }}>0</div>
                  <Text type="secondary">Absent Today</Text>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderRadius: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1890ff' }}>0</div>
                  <Text type="secondary">Total Staff</Text>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
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
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;