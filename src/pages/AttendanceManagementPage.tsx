// src/pages/AttendanceManagementPage.tsx - COMPLETE FIXED VERSION
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Input,
  Select,
  DatePicker,
  Button,
  Typography,
  Space,
  Tag,
  Row,
  Col,
  Alert,
  message,
  Modal,
  Descriptions,
  Avatar,
  Tooltip,
  Badge,
  Spin
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  DownloadOutlined,
  EyeOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  BranchesOutlined,
  ApartmentOutlined
} from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import {
  TrendingUp,
  TrendingDown,
  Users,
  UserCheck,
  UserX,
  AlertCircle
} from 'lucide-react';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface UserRecord {
  id: string;
  staff_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  user_role: string | null;
  enrollment_status: string | null;
  is_active: boolean | null;
  organization_id: string | null;
  branch_id: string | null;
  department_id: string | null;
  // Make these optional since they might not always be selected
  face_embedding_stored?: boolean | null;
  face_enrolled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AttendanceRecord {
  id: string;
  user_id: string | null;
  user?: UserRecord;
  device_id: string | null;
  organization_id: string | null;
  branch_id: string | null;
  department_id: string | null;
  shift_id: string | null;
  date: string;
  clock_in: string;
  clock_out: string | null;
  status: string | null;
  confidence_score: number | null;
  face_match_score: number | null;
  photo_url: string | null;
  verification_method: string | null;
  synced: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

const AttendanceManagementPage: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [filteredData, setFilteredData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<{ id: string, name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string, name: string }[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    branch: '',
    department: '',
    user: '',
    status: '',
    method: '',
    dateRange: null as [Dayjs, Dayjs] | null
  });


  const [todayStats, setTodayStats] = useState({
    total: 0,
    present: 0,
    late: 0,
    absent: 0,
    punctual: 0
  });

  // Load Today's Stats (Logic from OrganizationSettingsPage)
  const loadTodayStats = useCallback(async () => {
    try {
      const organizationId = localStorage.getItem('organization_id');
      if (!organizationId) return;
      const today = dayjs().format('YYYY-MM-DD');

      // Get all users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id') // Only need count really, but logic uses length
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (usersError) throw usersError;

      const totalUsers = users?.length || 0;

      // Get today's attendance
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('clock_in')
        .eq('organization_id', organizationId)
        .eq('date', today);

      if (attendanceError) throw attendanceError;

      const presentCount = attendance?.length || 0;
      const absentCount = totalUsers - presentCount;

      // Calculate late and punctual based on resume time
      const org = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', organizationId)
        .single();

      const resumeTime = (org.data?.settings as any)?.resume_time || '09:00';
      const lateThreshold = (org.data?.settings as any)?.late_threshold_minutes || 15;

      let lateCount = 0;
      let punctualCount = 0;

      attendance?.forEach((record: any) => {
        if (record.clock_in) {
          const clockInTime = dayjs(record.clock_in);
          const resumeDateTime = dayjs(`${today} ${resumeTime}`);
          const lateThresholdTime = resumeDateTime.add(lateThreshold, 'minute');

          if (clockInTime.isAfter(lateThresholdTime)) {
            lateCount++;
          } else {
            punctualCount++;
          }
        }
      });

      setTodayStats({
        total: totalUsers,
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        punctual: punctualCount
      });

    } catch (error: any) {
      console.error('Error loading today stats:', error);
    }
  }, []);



  // Fetch attendance data for the current device's branch
  const fetchAttendanceData = useCallback(async () => {
    setLoading(true);
    try {
      // Get device info from localStorage or device registration
      const deviceInfoStr = localStorage.getItem('device_info');
      let deviceInfo: any = null;

      if (deviceInfoStr) {
        try {
          deviceInfo = JSON.parse(deviceInfoStr);
        } catch (e) {
          console.error('Error parsing device info:', e);
        }
      }

      // If no device info in localStorage, try to get current device
      if (!deviceInfo) {
        const { data: currentDevice } = await supabase
          .from('devices')
          .select('id, branch_id, organization_id, device_name')
          .eq('device_code', localStorage.getItem('device_code') || '')
          .single();

        if (currentDevice) {
          deviceInfo = currentDevice;
          localStorage.setItem('device_info', JSON.stringify(currentDevice));
        }
      }

      console.log('📊 Fetching attendance data for device:', deviceInfo);

      if (!deviceInfo?.branch_id) {
        throw new Error('Device not registered to a branch. Please setup device first.');
      }

      // Fetch attendance for this device's branch
      let query = supabase
        .from('attendance')
        .select(`
        *,
        user:users!attendance_user_id_fkey(
          id, 
          staff_id, 
          full_name, 
          email, 
          phone, 
          user_role, 
          enrollment_status,
          is_active,
          organization_id,
          branch_id,
          department_id
        )
      `)
        .eq('branch_id', deviceInfo.branch_id)
        .order('created_at', { ascending: false })
        .limit(1000);

      const { data: attendance, error: attendanceError } = await query;

      if (attendanceError) {
        console.error('Attendance query error:', attendanceError);

        // Fallback: Try without JOIN
        console.log('🔄 Trying fallback query without JOIN...');
        const { data: simpleData } = await supabase
          .from('attendance')
          .select('*')
          .eq('branch_id', deviceInfo.branch_id)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (simpleData) {
          // Manually fetch user data
          const enhancedData = await Promise.all(
            simpleData.map(async (record) => {
              const { data: userData } = await supabase
                .from('users')
                .select('id, staff_id, full_name, email, phone, user_role, enrollment_status, is_active, organization_id, branch_id, department_id')
                .eq('id', record.user_id)
                .single();

              return {
                ...record,
                user: userData || null
              } as AttendanceRecord;
            })
          );

          setAttendanceData(enhancedData);
          setFilteredData(enhancedData);
          console.log(`✅ Loaded ${enhancedData.length} attendance records`);
        }
      } else {
        if (attendance) {
          console.log(`✅ Loaded ${attendance.length} attendance records for branch ${deviceInfo.branch_id}`);

          // Fix TypeScript error by properly casting the attendance data
          const typedAttendance: AttendanceRecord[] = attendance.map((record: any) => {
            const attendanceRecord: AttendanceRecord = {
              id: record.id,
              user_id: record.user_id,
              device_id: record.device_id,
              organization_id: record.organization_id,
              branch_id: record.branch_id,
              department_id: record.department_id,
              shift_id: record.shift_id,
              date: record.date,
              clock_in: record.clock_in,
              clock_out: record.clock_out,
              status: record.status,
              confidence_score: record.confidence_score,
              face_match_score: record.face_match_score,
              photo_url: record.photo_url,
              verification_method: record.verification_method,
              synced: record.synced,
              created_at: record.created_at,
              updated_at: record.updated_at,
              user: record.user ? {
                id: record.user.id,
                staff_id: record.user.staff_id,
                full_name: record.user.full_name,
                email: record.user.email,
                phone: record.user.phone,
                user_role: record.user.user_role,
                enrollment_status: record.user.enrollment_status,
                is_active: record.user.is_active,
                organization_id: record.user.organization_id,
                branch_id: record.user.branch_id,
                department_id: record.user.department_id,
                // Add optional fields with null defaults
                face_embedding_stored: record.user.face_embedding_stored ?? null,
                face_enrolled_at: record.user.face_enrolled_at ?? null,
                created_at: record.user.created_at ?? null,
                updated_at: record.user.updated_at ?? null
              } : undefined
            };
            return attendanceRecord;
          });

          setAttendanceData(typedAttendance);
          setFilteredData(typedAttendance);
        }
      }

      // Fetch branches for filter (only current branch)
      const { data: branchesData } = await supabase
        .from('branches')
        .select('id, name')
        .eq('id', deviceInfo.branch_id);

      if (branchesData) {
        console.log(`✅ Loaded current branch:`, branchesData[0]?.name);
        setBranches(branchesData);
      }

      // Fetch departments for filter (only for current branch)
      const { data: departmentsData } = await supabase
        .from('departments')
        .select('id, name')
        .eq('branch_id', deviceInfo.branch_id)
        .eq('is_active', true);

      if (departmentsData) {
        console.log(`✅ Loaded ${departmentsData.length} departments for current branch`);
        setDepartments(departmentsData);
      }

      // Fetch users for filter (only for current branch)
      const { data: usersData } = await supabase
        .from('users')
        .select('id, staff_id, full_name, email, phone, user_role, enrollment_status, is_active, organization_id, branch_id, department_id')
        .eq('branch_id', deviceInfo.branch_id)
        .eq('is_active', true);

      if (usersData) {
        console.log(`✅ Loaded ${usersData.length} active users for current branch`);

        // Fix UserRecord type casting with all required fields
        const typedUsers: UserRecord[] = usersData.map((user: any) => ({
          id: user.id,
          staff_id: user.staff_id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          user_role: user.user_role,
          enrollment_status: user.enrollment_status,
          is_active: user.is_active,
          organization_id: user.organization_id,
          branch_id: user.branch_id,
          department_id: user.department_id,
          // Add missing optional fields
          face_embedding_stored: user.face_embedding_stored ?? null,
          face_enrolled_at: user.face_enrolled_at ?? null,
          created_at: user.created_at ?? null,
          updated_at: user.updated_at ?? null
        }));

        setUsers(typedUsers);
      }

    } catch (error: any) {
      console.error('❌ Error fetching attendance:', error);

      let errorMessage = 'Failed to fetch attendance data';
      if (error.message.includes('Device not registered')) {
        errorMessage = 'Device not setup. Please register device first.';
      } else if (error.message.includes('JWT')) {
        errorMessage = 'Authentication error. Please restart the app.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check connection.';
      }

      message.error(errorMessage);

      // Check if we need to redirect to device setup
      if (error.message.includes('Device not registered')) {
        setTimeout(() => window.location.href = '/device-setup', 2000);
      }

      setAttendanceData([]);
      setFilteredData([]);

    } finally {
      setLoading(false);
    }
  }, []);


  // Apply filters
  const applyFilters = useCallback(() => {
    let filtered = [...attendanceData];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(record =>
        record.user?.full_name?.toLowerCase().includes(searchLower) ||
        record.user?.staff_id?.toLowerCase().includes(searchLower) ||
        record.user?.email?.toLowerCase().includes(searchLower)
      );
    }

    // Branch filter
    if (filters.branch) {
      filtered = filtered.filter(record => record.branch_id === filters.branch);
    }

    // Department filter
    if (filters.department) {
      filtered = filtered.filter(record => record.department_id === filters.department);
    }

    // User filter
    if (filters.user) {
      filtered = filtered.filter(record => record.user_id === filters.user);
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(record => record.status === filters.status);
    }

    // Method filter
    if (filters.method) {
      filtered = filtered.filter(record => record.verification_method === filters.method);
    }

    // Date range filter
    if (filters.dateRange) {
      const [startDate, endDate] = filters.dateRange;
      filtered = filtered.filter(record => {
        const recordDate = dayjs(record.date);
        return recordDate.isAfter(startDate.subtract(1, 'day')) &&
          recordDate.isBefore(endDate.add(1, 'day'));
      });
    }

    setFilteredData(filtered);
  }, [attendanceData, filters]);

  // Reset filters
  const resetFilters = useCallback(() => {
    setFilters({
      search: '',
      branch: '',
      department: '',
      user: '',
      status: '',
      method: '',
      dateRange: null
    });
    setFilteredData(attendanceData);
  }, [attendanceData]);

  // View record details
  const viewRecordDetails = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };

  // Export data
  const exportToCSV = useCallback(() => {
    const headers = ['Staff ID', 'Full Name', 'Email', 'Date', 'Clock In', 'Clock Out', 'Status', 'Method', 'Confidence Score', 'Face Match Score', 'Device ID', 'Branch ID', 'Department ID'];

    const csvData = filteredData.map(record => [
      record.user?.staff_id || '',
      record.user?.full_name || '',
      record.user?.email || '',
      record.date,
      dayjs(record.clock_in).format('HH:mm:ss'),
      record.clock_out ? dayjs(record.clock_out).format('HH:mm:ss') : '',
      record.status || '',
      record.verification_method || '',
      record.confidence_score ? `${(record.confidence_score * 100).toFixed(1)}%` : '',
      record.face_match_score ? `${(record.face_match_score * 100).toFixed(1)}%` : '',
      record.device_id || '',
      record.branch_id || '',
      record.department_id || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${dayjs().format('YYYY-MM-DD_HH-mm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    message.success('Data exported successfully');
  }, [filteredData]);

  // Get branch name by ID
  const getBranchName = useCallback((branchId: string | null) => {
    if (!branchId) return 'N/A';
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || branchId.substring(0, 8) + '...';
  }, [branches]);

  // Get department name by ID
  const getDepartmentName = useCallback((deptId: string | null) => {
    if (!deptId) return 'N/A';
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || deptId.substring(0, 8) + '...';
  }, [departments]);

  // Get status color
  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'present': return 'green';
      case 'absent': return 'red';
      case 'late': return 'orange';
      default: return 'default';
    }
  };

  // Table columns
  const columns = useMemo(() => [
    {
      title: 'User',
      dataIndex: ['user', 'full_name'],
      key: 'user',
      width: 200,
      render: (text: string, record: AttendanceRecord) => (
        <Space>
          <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>
            {text?.charAt(0) || 'U'}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{text || 'Unknown User'}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.user?.staff_id || record.user_id?.substring(0, 8)}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Date & Time',
      key: 'datetime',
      width: 150,
      render: (record: AttendanceRecord) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {dayjs(record.date).format('MMM D, YYYY')}
          </div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {dayjs(record.clock_in).format('HH:mm:ss')}
            {record.clock_out && (
              <>
                <br />
                <ClockCircleOutlined style={{ marginRight: 4, marginLeft: 8 }} />
                {dayjs(record.clock_out).format('HH:mm:ss')}
              </>
            )}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string | null) => {
        const statusConfig: any = {
          present: { color: 'green', icon: <CheckCircleOutlined />, text: 'Present' },
          absent: { color: 'red', icon: <CloseCircleOutlined />, text: 'Absent' },
          late: { color: 'orange', icon: <ClockCircleOutlined />, text: 'Late' }
        };
        const config = statusConfig[status || ''] || { color: 'default', icon: null, text: status || 'Unknown' };
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: 'Method',
      dataIndex: 'verification_method',
      key: 'method',
      width: 120,
      render: (method: string | null, record: AttendanceRecord) => (
        <Tooltip title={`Confidence: ${record.confidence_score ? `${(record.confidence_score * 100).toFixed(1)}%` : 'N/A'}`}>
          <Badge
            color={method === 'face' ? 'green' : 'blue'}
            text={
              method === 'face' ? 'Face ID' :
                method === 'manual' ? 'Manual' :
                  method === 'qr' ? 'QR Code' : 'Unknown'
            }
          />
        </Tooltip>
      ),
    },
    {
      title: 'Branch/Dept',
      key: 'branch_dept',
      width: 150,
      render: (record: AttendanceRecord) => {
        const BranchDeptCell = () => {
          const branchName = getBranchName(record.branch_id);
          const deptName = getDepartmentName(record.department_id);

          return (
            <div>
              <div style={{ fontSize: '12px' }}>
                <Tooltip title={branchName}>
                  <Tag color="blue" style={{ fontSize: '11px', padding: '2px 6px' }}>
                    <BranchesOutlined /> {branchName}
                  </Tag>
                </Tooltip>
                <br />
                <Tooltip title={deptName}>
                  <Tag color="purple" style={{ fontSize: '11px', padding: '2px 6px', marginTop: 4 }}>
                    <ApartmentOutlined /> {deptName}
                  </Tag>
                </Tooltip>
              </div>
            </div>
          );
        };

        return <BranchDeptCell />;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (record: AttendanceRecord) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => viewRecordDetails(record)}
          size="small"
        />
      ),
    },
  ], [getBranchName, getDepartmentName]);

  // Initialize on component mount
  useEffect(() => {
    fetchAttendanceData();
    loadTodayStats();
  }, [fetchAttendanceData, loadTodayStats]);

  // Apply filters whenever they change
  useEffect(() => {
    applyFilters();
  }, [filters, attendanceData, applyFilters]);

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        Attendance Management
      </Title>
      <Text type="secondary">
        View, search, and filter attendance records for all users
      </Text>

      {/* Today's Stats - Compact Circular Cards */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: 24,
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: '100px'
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)',
            border: '1px solid rgba(162, 155, 254, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8
          }}>
            <Users size={28} color="#a29bfe" />
          </div>
          <Text strong style={{ fontSize: 24, color: '#a29bfe' }}>{todayStats.total}</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)' }}>Total Users</Text>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: '100px'
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8
          }}>
            <UserCheck size={28} color="#fff" />
          </div>
          <Text strong style={{ fontSize: 24, color: '#52c41a' }}>{todayStats.present}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>Present</Text>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: '100px'
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8
          }}>
            <TrendingUp size={28} color="#fff" />
          </div>
          <Text strong style={{ fontSize: 24, color: '#1890ff' }}>{todayStats.punctual}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>Punctual</Text>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: '100px'
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fa8c16 0%, #ffa940 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8
          }}>
            <TrendingDown size={28} color="#fff" />
          </div>
          <Text strong style={{ fontSize: 24, color: '#fa8c16' }}>{todayStats.late}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>Late</Text>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: '100px'
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8
          }}>
            <UserX size={28} color="#fff" />
          </div>
          <Text strong style={{ fontSize: 24, color: '#ff4d4f' }}>{todayStats.absent}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>Absent</Text>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: '100px'
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #13c2c2 0%, #5cdbd3 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8
          }}>
            <AlertCircle size={28} color="#fff" />
          </div>
          <Text strong style={{ fontSize: 24, color: '#13c2c2' }}>
            {todayStats.total > 0 ? Math.round((todayStats.present / todayStats.total) * 100) : 0}%
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>Attendance Rate</Text>
        </div>
      </div>

      {/* Filters Card */}
      <Card
        title={
          <Space>
            <FilterOutlined />
            <span>Filters & Search</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={resetFilters}
              size="middle"
            >
              Reset
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={exportToCSV}
              size="middle"
            >
              Export
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchAttendanceData}
              size="middle"
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Input
              placeholder="Search by name, staff ID, or email..."
              prefix={<SearchOutlined />}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              size="middle"
              allowClear
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              placeholder="Branch"
              style={{ width: '100%' }}
              value={filters.branch || undefined}
              onChange={(value) => setFilters({ ...filters, branch: value })}
              size="middle"
              allowClear
            >
              {branches.map(branch => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} md={4}>
            <Select
              placeholder="Department"
              style={{ width: '100%' }}
              value={filters.department || undefined}
              onChange={(value) => setFilters({ ...filters, department: value })}
              size="middle"
              allowClear
            >
              {departments.map(dept => (
                <Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} md={4}>
            <Select
              placeholder="User"
              style={{ width: '100%' }}
              value={filters.user || undefined}
              onChange={(value) => setFilters({ ...filters, user: value })}
              size="middle"
              allowClear
            >
              {users.map(user => (
                <Option key={user.id} value={user.id}>
                  {user.full_name} ({user.staff_id})
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} md={4}>
            <Select
              placeholder="Status"
              style={{ width: '100%' }}
              value={filters.status || undefined}
              onChange={(value) => setFilters({ ...filters, status: value })}
              size="middle"
              allowClear
            >
              <Option value="present">Present</Option>
              <Option value="absent">Absent</Option>
              <Option value="late">Late</Option>
            </Select>
          </Col>
          <Col xs={12} md={4}>
            <Select
              placeholder="Method"
              style={{ width: '100%' }}
              value={filters.method || undefined}
              onChange={(value) => setFilters({ ...filters, method: value })}
              size="middle"
              allowClear
            >
              <Option value="face">Face ID</Option>
              <Option value="manual">Manual</Option>
              <Option value="qr">QR Code</Option>
            </Select>
          </Col>
          <Col xs={24} md={8}>
            <RangePicker
              style={{ width: '100%' }}
              placeholder={['Start Date', 'End Date']}
              value={filters.dateRange}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates as [Dayjs, Dayjs] })}
              size="middle"
              allowClear
            />
          </Col>
        </Row>
      </Card>

      {/* Results Alert */}
      <Alert
        message={`Showing ${filteredData.length} of ${attendanceData.length} records`}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        action={
          <Button type="link" size="small" onClick={fetchAttendanceData} loading={loading}>
            Refresh
          </Button>
        }
      />

      {/* Attendance Table */}
      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>Loading attendance records...</div>
          </div>
        ) : filteredData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Alert
              message="No attendance records found"
              description={
                attendanceData.length === 0
                  ? "No attendance data has been recorded yet. Check back after some clock-ins/outs have been recorded."
                  : "No records match your current filters. Try adjusting your search criteria."
              }
              type="info"
              showIcon
            />
            {attendanceData.length === 0 && (
              <Button
                type="primary"
                style={{ marginTop: 16 }}
                onClick={fetchAttendanceData}
                loading={loading}
              >
                Try Again
              </Button>
            )}
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`,
              responsive: true
            }}
            scroll={{ x: 1200 }}
            size="middle"
            expandable={{
              expandedRowRender: (record) => (
                <Descriptions size="small" column={2} bordered>
                  <Descriptions.Item label="User ID">{record.user_id}</Descriptions.Item>
                  <Descriptions.Item label="Staff ID">{record.user?.staff_id || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Full Name">
                    {record.user?.full_name || 'Unknown User'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    {record.user?.email || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Attendance Date">
                    {dayjs(record.date).format('dddd, MMMM D, YYYY')}
                  </Descriptions.Item>
                  <Descriptions.Item label="Clock In">
                    {dayjs(record.clock_in).format('HH:mm:ss')}
                  </Descriptions.Item>
                  <Descriptions.Item label="Clock Out">
                    {record.clock_out ? dayjs(record.clock_out).format('HH:mm:ss') : 'Not clocked out'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Branch">
                    {getBranchName(record.branch_id)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Department">
                    {getDepartmentName(record.department_id)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Confidence Score">
                    {record.confidence_score ? `${(record.confidence_score * 100).toFixed(1)}%` : 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Face Match Score">
                    {record.face_match_score ? `${(record.face_match_score * 100).toFixed(1)}%` : 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Device ID">
                    {record.device_id || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Photo">
                    {record.photo_url ? (
                      <a href={record.photo_url} target="_blank" rel="noopener noreferrer">
                        View Photo
                      </a>
                    ) : 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Sync Status">
                    <Tag color={record.synced ? 'green' : 'orange'}>
                      {record.synced ? 'Synced' : 'Pending Sync'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Record Created">
                    {record.created_at ? dayjs(record.created_at).format('MMM D, YYYY h:mm A') : 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Last Updated">
                    {record.updated_at ? dayjs(record.updated_at).format('MMM D, YYYY h:mm A') : 'N/A'}
                  </Descriptions.Item>
                </Descriptions>
              ),
            }}
          />
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Attendance Record Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Close
          </Button>
        ]}
        width={700}
      >
        {selectedRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="User">
              <Space>
                <Avatar style={{ backgroundColor: '#1890ff' }}>
                  {selectedRecord.user?.full_name?.charAt(0) || 'U'}
                </Avatar>
                <div>
                  <div style={{ fontWeight: 500 }}>{selectedRecord.user?.full_name || 'Unknown User'}</div>
                  <Text type="secondary">
                    {selectedRecord.user?.staff_id || selectedRecord.user_id?.substring(0, 8)}
                  </Text>
                </div>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="User ID">
              {selectedRecord.user_id}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {selectedRecord.user?.email || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Phone">
              {selectedRecord.user?.phone || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Role">
              {selectedRecord.user?.user_role || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Attendance Date">
              {dayjs(selectedRecord.date).format('dddd, MMMM D, YYYY')}
            </Descriptions.Item>
            <Descriptions.Item label="Clock In">
              {dayjs(selectedRecord.clock_in).format('HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="Clock Out">
              {selectedRecord.clock_out ? dayjs(selectedRecord.clock_out).format('HH:mm:ss') : 'Not clocked out'}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={getStatusColor(selectedRecord.status)}>
                {selectedRecord.status?.toUpperCase() || 'UNKNOWN'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Verification Method">
              <Tag color={selectedRecord.verification_method === 'face' ? 'green' : 'blue'}>
                {selectedRecord.verification_method?.toUpperCase() || 'UNKNOWN'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Confidence Score">
              {selectedRecord.confidence_score ? (
                <div>
                  <Text strong>{(selectedRecord.confidence_score * 100).toFixed(1)}%</Text>
                  <div style={{ width: '100%', backgroundColor: '#f5f5f5', borderRadius: 4, marginTop: 4 }}>
                    <div
                      style={{
                        width: `${selectedRecord.confidence_score * 100}%`,
                        height: 8,
                        backgroundColor: selectedRecord.confidence_score > 0.8 ? '#52c41a' :
                          selectedRecord.confidence_score > 0.6 ? '#faad14' : '#ff4d4f',
                        borderRadius: 4
                      }}
                    />
                  </div>
                </div>
              ) : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Face Match Score">
              {selectedRecord.face_match_score ? `${(selectedRecord.face_match_score * 100).toFixed(1)}%` : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Branch">
              {getBranchName(selectedRecord.branch_id)}
            </Descriptions.Item>
            <Descriptions.Item label="Department">
              {getDepartmentName(selectedRecord.department_id)}
            </Descriptions.Item>
            <Descriptions.Item label="Photo">
              {selectedRecord.photo_url ? (
                <a href={selectedRecord.photo_url} target="_blank" rel="noopener noreferrer">
                  View Attendance Photo
                </a>
              ) : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Device ID">
              {selectedRecord.device_id || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Sync Status">
              <Tag color={selectedRecord.synced ? 'green' : 'orange'}>
                {selectedRecord.synced ? 'Synced to Cloud' : 'Pending Sync'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Record Created">
              {selectedRecord.created_at ? dayjs(selectedRecord.created_at).format('MMM D, YYYY h:mm:ss A') : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Last Updated">
              {selectedRecord.updated_at ? dayjs(selectedRecord.updated_at).format('MMM D, YYYY h:mm:ss A') : 'N/A'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AttendanceManagementPage;