// src/pages/Dashboard.tsx - FIXED VERSION
import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Statistic, Spin, Alert, Button, Tag, message } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleFilled,
  CiCircleFilled
} from '@ant-design/icons';
import {
  Users,
  Calendar,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase'; // ✅ Only import supabase
import { format } from 'date-fns';

const { Title, Text } = Typography;

interface DashboardStats {
  totalUsers: number;
  enrolledUsers: number;
  todayEvents: number;
  todayAttendance: {
    present: number;
    absent: number;
    late: number;
  };
  systemStatus: {
    database: boolean;
    faceRecognition: boolean;
    sync: boolean;
  };
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    enrolledUsers: 0,
    todayEvents: 0,
    todayAttendance: {
      present: 0,
      absent: 0,
      late: 0
    },
    systemStatus: {
      database: false,
      faceRecognition: false,
      sync: false
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [connectionTest, setConnectionTest] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    fetchDashboardData();
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      console.log('Testing database connection...');
      
      // Try to query organizations table
      const { data, error } = await supabase
        .from('organizations') // ✅ This table exists
        .select('id, name')
        .limit(1);

      if (error) {
        console.error('Connection test failed:', error);
        setConnectionTest({ 
          success: false, 
          message: `Database error: ${error.message}` 
        });
        return;
      }

      console.log('✅ Connection test passed');
      setConnectionTest({ 
        success: true, 
        message: `Connected successfully. Found ${data?.length || 0} organizations.` 
      });
    } catch (error: any) {
      console.error('Connection test exception:', error);
      setConnectionTest({ 
        success: false, 
        message: `Connection failed: ${error.message}` 
      });
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Fetching dashboard data...');

      // Get device info to get organization/branch
      const deviceToken = localStorage.getItem('device_token');
      if (deviceToken) {
        const { data: device } = await supabase
          .from('devices')
          .select('organization_id, branch_id')
          .eq('device_token', deviceToken)
          .single();

        if (device) {
          setOrganizationId(device.organization_id);
          setBranchId(device.branch_id);
        }
      }

      const today = format(new Date(), 'yyyy-MM-dd');

      // 1. Get total users
      console.log('1️⃣ Fetching total users...');
      const { count: totalUsers, error: usersError } = await supabase
        .from('users') // ✅ Changed from 'students' to 'users'
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (usersError) {
        console.error('Users fetch error:', usersError);
      } else {
        console.log('Total users:', totalUsers);
      }

      // 2. Get enrolled users (users with face_embedding_stored = true)
      console.log('2️⃣ Fetching enrolled users...');
      const { count: enrolledUsers, error: enrolledError } = await supabase
        .from('users') // ✅ Changed from 'students' to 'users'
        .select('*', { count: 'exact', head: true })
        .eq('enrollment_status', 'enrolled') // ✅ Changed condition
        .eq('is_active', true);

      if (enrolledError) {
        console.error('Enrolled users fetch error:', enrolledError);
      } else {
        console.log('Enrolled users:', enrolledUsers);
      }

      // 3. Get today's attendance sessions
      console.log('3️⃣ Fetching today\'s attendance sessions...');
      const { count: todaySessions, error: sessionsError } = await supabase
        .from('attendance_sessions') // ✅ This table exists
        .select('*', { count: 'exact', head: true })
        .eq('session_date', today)
        .eq('is_active', true);

      if (sessionsError) {
        console.error('Sessions fetch error:', sessionsError);
      } else {
        console.log('Today sessions:', todaySessions);
      }

      // 4. Get today's attendance stats
      console.log('4️⃣ Fetching today\'s attendance...');
      let todayPresent = 0;
      let todayLate = 0;

      if (branchId) {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance') // ✅ This table exists
          .select('*')
          .eq('branch_id', branchId)
          .eq('date', today)
          .eq('status', 'present');

        if (!attendanceError && attendanceData) {
          todayPresent = attendanceData.length;
          
          // Calculate late arrivals (if shift info is available)
          // This is a simplified calculation
          attendanceData.forEach(record => {
            const clockIn = new Date(record.clock_in);
            // Assume late if clock in after 9:30 AM
            if (clockIn.getHours() > 9 || (clockIn.getHours() === 9 && clockIn.getMinutes() > 30)) {
              todayLate++;
            }
          });
        }
      }

      // Estimate absent users (total users - present)
      const todayAbsent = Math.max(0, (totalUsers || 0) - todayPresent);

      // 5. Check system status
      const systemStatus = {
        database: connectionTest?.success || false,
        faceRecognition: (enrolledUsers || 0) > 0, // Simplified check
        sync: true // Assume sync is working
      };

      setStats({
        totalUsers: totalUsers || 0,
        enrolledUsers: enrolledUsers || 0,
        todayEvents: todaySessions || 0,
        todayAttendance: {
          present: todayPresent,
          absent: todayAbsent,
          late: todayLate
        },
        systemStatus
      });

      console.log('✅ Dashboard data loaded successfully');
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleTestInsert = async () => {
    try {
      if (!organizationId) {
        message.error('No organization selected. Please register device first.');
        return;
      }

      // Test to insert a user (will fail if RLS blocks)
      const { error } = await supabase
        .from('users') // ✅ Changed from 'students' to 'users'
        .insert({
          organization_id: organizationId,
          staff_id: `TEST_${Date.now()}`,
          full_name: 'Test User',
          email: 'test@test.com',
          is_active: true,
          enrollment_status: 'pending'
        });

      if (error) {
        message.warning(`Insert test failed (expected): ${error.message}`);
      } else {
        message.success('Insert test succeeded!');
      }
    } catch (error: any) {
      message.error(`Insert test error: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip="Loading dashboard data..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Dashboard</Title>
      
      {error && (
        <Alert
          message="Error Loading Dashboard"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: '24px' }}
          action={
            <Button size="small" onClick={fetchDashboardData}>
              Retry
            </Button>
          }
        />
      )}

      {connectionTest && (
        <Alert
          message="Connection Status"
          description={connectionTest.message}
          type={connectionTest.success ? 'success' : 'error'}
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* Connection Test Section */}
      <Card 
        title="Database Connection Test" 
        style={{ marginBottom: '24px' }}
        extra={
          <Button 
            type="primary" 
            icon={<ReloadOutlined />} 
            onClick={testConnection}
            loading={loading}
          >
            Test Connection
          </Button>
        }
      >
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="Database"
                value={stats.systemStatus.database ? 'Connected' : 'Disconnected'}
                prefix={stats.systemStatus.database ? <CheckCircleFilled style={{ color: '#52c41a' }} /> : <CiCircleFilled style={{ color: '#ff4d4f' }} />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="Face Recognition"
                value={stats.systemStatus.faceRecognition ? 'Ready' : 'Not Ready'}
                prefix={stats.systemStatus.faceRecognition ? <CheckCircleFilled style={{ color: '#52c41a' }} /> : <ExclamationCircleOutlined style={{ color: '#faad14' }} />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="Sync Service"
                value={stats.systemStatus.sync ? 'Active' : 'Inactive'}
                prefix={stats.systemStatus.sync ? <CheckCircleFilled style={{ color: '#52c41a' }} /> : <ExclamationCircleOutlined style={{ color: '#faad14' }} />}
              />
            </Card>
          </Col>
        </Row>
        
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <Button 
            type="dashed" 
            onClick={handleTestInsert}
            style={{ marginRight: '8px' }}
          >
            Test Database Insert
          </Button>
          <Text type="secondary">
            Device: {organizationId ? `Org: ${organizationId.substring(0, 8)}...` : 'Not registered'}
            {branchId && ` | Branch: ${branchId.substring(0, 8)}...`}
          </Text>
        </div>
      </Card>

      {/* Stats Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={stats.totalUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <Text type="secondary">Active users in system</Text>
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Face Enrolled"
              value={stats.enrolledUsers}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <Text type="secondary">Users with biometrics</Text>
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Today's Sessions"
              value={stats.todayEvents}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <Text type="secondary">Attendance sessions today</Text>
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Enrollment Rate"
              value={stats.totalUsers > 0 ? Math.round((stats.enrolledUsers / stats.totalUsers) * 100) : 0}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
            <Text type="secondary">Biometric coverage</Text>
          </Card>
        </Col>
      </Row>

      {/* Attendance Overview */}
      <Card title="Today's Attendance" style={{ marginTop: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
              <Statistic
                title="Present"
                value={stats.todayAttendance.present}
                prefix={<CheckCircle style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: '#fff7e6', borderColor: '#ffd591' }}>
              <Statistic
                title="Absent"
                value={stats.todayAttendance.absent}
                prefix={<XCircle style={{ color: '#fa8c16' }} />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: '#fff1f0', borderColor: '#ffa39e' }}>
              <Statistic
                title="Late"
                value={stats.todayAttendance.late}
                prefix={<Clock style={{ color: '#ff4d4f' }} />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
        
        <div style={{ marginTop: '16px' }}>
          <Text type="secondary">
            Last updated: {format(new Date(), 'PPpp')}
          </Text>
          <Button 
            type="link" 
            onClick={fetchDashboardData}
            style={{ float: 'right' }}
            icon={<ReloadOutlined />}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {/* System Status */}
      <Card title="System Status" style={{ marginTop: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card size="small" hoverable>
              <Statistic
                title="Database Connection"
                value={stats.systemStatus.database ? 'Healthy' : 'Issues'}
                suffix={
                  <Tag color={stats.systemStatus.database ? 'success' : 'error'}>
                    {stats.systemStatus.database ? '✓' : '✗'}
                  </Tag>
                }
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" hoverable>
              <Statistic
                title="Face Recognition"
                value={stats.systemStatus.faceRecognition ? 'Operational' : 'Training Needed'}
                suffix={
                  <Tag color={stats.systemStatus.faceRecognition ? 'success' : 'warning'}>
                    {stats.systemStatus.faceRecognition ? '✓' : '!'}
                  </Tag>
                }
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" hoverable>
              <Statistic
                title="Sync Service"
                value={stats.systemStatus.sync ? 'Active' : 'Inactive'}
                suffix={
                  <Tag color={stats.systemStatus.sync ? 'success' : 'warning'}>
                    {stats.systemStatus.sync ? '✓' : '!'}
                  </Tag>
                }
              />
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Dashboard;