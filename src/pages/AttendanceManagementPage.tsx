// src/pages/AttendanceManagementPage.tsx - FIXED VERSION
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
  Statistic,
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
  BookOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  TeamOutlined,
  BranchesOutlined,
  ApartmentOutlined
} from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

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
  face_embedding_stored: boolean | null;
  face_enrolled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
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
  const [branches, _setBranches] = useState<{ id: string, name: string }[]>([]);
  const [departments, _setDepartments] = useState<{ id: string, name: string }[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    today: 0,
    faceVerified: 0,
    manual: 0,
    activeUsers: 0
  });
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

  // Fetch active users count
  const fetchActiveUsers = useCallback(async () => {
    try {
      const organizationId = localStorage.getItem('organization_id');
      const branchId = localStorage.getItem('branch_id');

      let query = supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { count } = await query;
      return count || 0;
    } catch (error) {
      console.error('Error fetching active users:', error);
      return 0;
    }
  }, []);

  // Calculate statistics
  const calculateStats = useCallback(async (data: AttendanceRecord[]) => {
    const today = dayjs().format('YYYY-MM-DD');
    const present = data.filter(record => record.status === 'present').length;
    const todayCount = data.filter(record => record.date === today).length;
    const faceVerified = data.filter(record => record.verification_method === 'face').length;
    const manual = data.filter(record => record.verification_method === 'manual').length;
    const activeUsers = await fetchActiveUsers();

    setStats({
      total: data.length,
      present,
      today: todayCount,
      faceVerified,
      manual,
      activeUsers
    });
  }, [fetchActiveUsers]);

  // Fetch attendance data with user information
  const fetchAttendanceData = useCallback(async () => {
    setLoading(true);
    try {
      const organizationId = localStorage.getItem('organization_id');
      const branchId = localStorage.getItem('branch_id');

      // Fetch attendance with user data
      let query = supabase
        .from('attendance')
        .select(`
          *,
          user:users(*)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data: attendance, error: attendanceError } = await query;

      if (attendanceError) {
        throw attendanceError;
      }

      if (attendance) {
        setAttendanceData(attendance as any);
        setFilteredData(attendance as any);

        // Extract unique values for filters - store in variable that's actually used
        const uniqueUserIds = Array.from(new Set(attendance.map(record => record.user_id).filter(Boolean)));
        console.log('Unique user IDs:', uniqueUserIds.length);

        // Fetch branches for filter
        const { data: branchesData } = await supabase
          .from('branches')
          .select('id, name')
          .eq('organization_id', organizationId)
          .eq('is_active', true);

        // Fetch departments for filter
        const { data: departmentsData } = await supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', organizationId)
          .eq('is_active', true);

        // Set branches and departments (commented out setters since we're using _ prefix)
        // _setBranches(branchesData || []);
        // _setDepartments(departmentsData || []);

        // Log the data to use the variables
        console.log('Branches data:', branchesData?.length || 0);
        console.log('Departments data:', departmentsData?.length || 0);

        // In the fetchAttendanceData function, update the users query:
        let usersQuery = supabase
          .from('users')
          .select('id, staff_id, full_name, email, phone, user_role, enrollment_status, is_active, organization_id, branch_id, department_id')
          .eq('organization_id', organizationId)
          .eq('is_active', true);

        if (branchId) {
          usersQuery = usersQuery.eq('branch_id', branchId);
        }

        const { data: usersData } = await usersQuery;

        setUsers(usersData as UserRecord[]);

        // Calculate statistics
        calculateStats(attendance);
      }
    } catch (error: any) {
      console.error('Error fetching attendance:', error);
      message.error('Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  }, [calculateStats]);

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
    calculateStats(filtered);
  }, [attendanceData, filters, calculateStats]);

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
    calculateStats(attendanceData);
  }, [attendanceData, calculateStats]);

  // View record details
  const viewRecordDetails = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };

  // Export data
  const exportToCSV = useCallback(() => {
    const headers = ['Staff ID', 'Full Name', 'Email', 'Date', 'Clock In', 'Clock Out', 'Status', 'Method', 'Confidence Score', 'Branch', 'Department', 'Face Match Score', 'Device ID'];

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
      // Note: branches/departments arrays might be empty since we're not setting them
      '', // branch name placeholder
      '', // department name placeholder
      record.face_match_score ? `${(record.face_match_score * 100).toFixed(1)}%` : '',
      record.device_id || ''
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
      render: (record: AttendanceRecord) => (
        <div>
          <div style={{ fontSize: '12px' }}>
            <Tooltip title={getBranchName(record.branch_id)}>
              <Tag color="blue" style={{ fontSize: '11px', padding: '2px 6px' }}>
                <BranchesOutlined /> {getBranchName(record.branch_id)}
              </Tag>
            </Tooltip>
            <br />
            <Tooltip title={getDepartmentName(record.department_id)}>
              <Tag color="purple" style={{ fontSize: '11px', padding: '2px 6px', marginTop: 4 }}>
                <ApartmentOutlined /> {getDepartmentName(record.department_id)}
              </Tag>
            </Tooltip>
          </div>
        </div>
      ),
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

  useEffect(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData]);

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

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginTop: 24, marginBottom: 24 }}>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Total Records"
              value={stats.total}
              prefix={<BookOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Present"
              value={stats.present}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Today's Records"
              value={stats.today}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Face Verified"
              value={stats.faceVerified}
              suffix={`/ ${stats.total}`}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Active Users"
              value={stats.activeUsers}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

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
          <Button type="link" size="small" onClick={fetchAttendanceData}>
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