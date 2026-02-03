// pages/UsersManagementPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    Table,
    Button,
    Input,
    Space,
    Tag,
    Avatar,
    Typography,
    Row,
    Col,
    Statistic,
    Select,
    message,
    Modal,
    Descriptions,
    Image
} from 'antd';
import {
    Users,
    Search,
    UserPlus,
    ArrowLeft,
    Eye,
    Download
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const UsersManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<any[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [detailsVisible, setDetailsVisible] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        staff: 0,
        students: 0,
        active: 0
    });

    useEffect(() => {
        loadUsers();
    }, []);

    useEffect(() => {
        filterUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [users, searchText, roleFilter]);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const organizationId = localStorage.getItem('organization_id');

            if (!organizationId) {
                message.error('No organization found');
                return;
            }

            const { data, error } = await supabase
                .from('users')
                .select(`
          *,
          branch:branches(name),
          organization:organizations(name, type)
        `)
                .eq('organization_id', organizationId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            setUsers(data || []);

            // Calculate stats
            const total = data?.length || 0;
            const staff = data?.filter(u => u.user_role === 'staff').length || 0;
            const students = data?.filter(u => u.user_role === 'student').length || 0;
            const active = data?.filter(u => u.is_active).length || 0;

            setStats({ total, staff, students, active });
        } catch (error: any) {
            console.error('Error loading users:', error);
            message.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const filterUsers = () => {
        let filtered = [...users];

        // Search filter
        if (searchText) {
            filtered = filtered.filter(user =>
                user.full_name?.toLowerCase().includes(searchText.toLowerCase()) ||
                user.email?.toLowerCase().includes(searchText.toLowerCase()) ||
                user.staff_id?.toLowerCase().includes(searchText.toLowerCase()) ||
                user.student_id?.toLowerCase().includes(searchText.toLowerCase())
            );
        }

        // Role filter
        if (roleFilter !== 'all') {
            filtered = filtered.filter(user => user.user_role === roleFilter);
        }

        setFilteredUsers(filtered);
    };

    const showUserDetails = (user: any) => {
        setSelectedUser(user);
        setDetailsVisible(true);
    };

    const exportToCSV = () => {
        const headers = ['Name', 'ID', 'Email', 'Role', 'Branch', 'Status', 'Created'];
        const rows = filteredUsers.map(user => [
            user.full_name,
            user.staff_id || user.student_id || '',
            user.email || '',
            user.user_role,
            user.branch?.name || '',
            user.is_active ? 'Active' : 'Inactive',
            dayjs(user.created_at).format('YYYY-MM-DD')
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users_${dayjs().format('YYYY-MM-DD')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        message.success('Users exported successfully');
    };

    const columns = [
        {
            title: 'Photo',
            dataIndex: 'photo_url',
            key: 'photo',
            width: 80,
            render: (photo: string, record: any) => (
                <Avatar
                    size={48}
                    src={photo}
                    style={{ backgroundColor: '#667eea' }}
                >
                    {record.full_name?.charAt(0).toUpperCase()}
                </Avatar>
            ),
        },
        {
            title: 'Name',
            dataIndex: 'full_name',
            key: 'name',
            sorter: (a: any, b: any) => a.full_name.localeCompare(b.full_name),
        },
        {
            title: 'ID',
            key: 'id',
            render: (record: any) => record.staff_id || record.student_id || '-',
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: 'Role',
            dataIndex: 'user_role',
            key: 'role',
            render: (role: string) => (
                <Tag color={role === 'staff' ? 'blue' : 'green'}>
                    {role?.toUpperCase()}
                </Tag>
            ),
        },
        {
            title: 'Branch',
            key: 'branch',
            render: (record: any) => record.branch?.name || '-',
        },
        {
            title: 'Status',
            dataIndex: 'is_active',
            key: 'status',
            render: (isActive: boolean) => (
                <Tag color={isActive ? 'success' : 'default'}>
                    {isActive ? 'Active' : 'Inactive'}
                </Tag>
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (record: any) => (
                <Space>
                    <Button
                        type="text"
                        icon={<Eye size={16} />}
                        onClick={() => showUserDetails(record)}
                    >
                        View
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--gray-50)', padding: '16px' }}>
            {/* Header */}
            <div style={{
                background: 'white',
                padding: '16px 24px',
                borderRadius: '12px',
                marginBottom: 24,
                boxShadow: 'var(--shadow-sm)'
            }}>
                <Button
                    type="text"
                    icon={<ArrowLeft size={24} />}
                    onClick={() => navigate('/')}
                    style={{ marginBottom: 16, color: 'var(--gray-600)' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        backgroundColor: '#667eea',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Users size={24} color="#fff" />
                    </div>
                    <div>
                        <Title level={3} style={{ margin: 0 }}>
                            Users Management
                        </Title>
                        <Text type="secondary">
                            View and manage all enrolled users
                        </Text>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Total Users"
                            value={stats.total}
                            valueStyle={{ color: '#667eea' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Staff"
                            value={stats.staff}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Students"
                            value={stats.students}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Active"
                            value={stats.active}
                            valueStyle={{ color: '#fa8c16' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Filters and Actions */}
            <Card style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={12} md={8}>
                        <Input
                            placeholder="Search by name, email, or ID..."
                            prefix={<Search size={16} />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            size="large"
                        />
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                        <Select
                            value={roleFilter}
                            onChange={setRoleFilter}
                            style={{ width: '100%' }}
                            size="large"
                        >
                            <Option value="all">All Roles</Option>
                            <Option value="staff">Staff</Option>
                            <Option value="student">Students</Option>
                        </Select>
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                        <Button
                            icon={<Download size={16} />}
                            onClick={exportToCSV}
                            size="large"
                            block
                        >
                            Export CSV
                        </Button>
                    </Col>
                    <Col xs={24} sm={12} md={8} style={{ textAlign: 'right' }}>
                        <Button
                            type="primary"
                            icon={<UserPlus size={16} />}
                            onClick={() => navigate('/enroll')}
                            size="large"
                        >
                            Enroll New User
                        </Button>
                    </Col>
                </Row>
            </Card>

            {/* Users Table */}
            <Card>
                <Table
                    columns={columns}
                    dataSource={filteredUsers}
                    loading={loading}
                    rowKey="id"
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `Total ${total} users`,
                    }}
                    scroll={{ x: 800 }}
                />
            </Card>

            {/* User Details Modal */}
            <Modal
                title="User Details"
                open={detailsVisible}
                onCancel={() => setDetailsVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setDetailsVisible(false)}>
                        Close
                    </Button>,
                ]}
                width={600}
            >
                {selectedUser && (
                    <div>
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            {selectedUser.photo_url ? (
                                <Image
                                    src={selectedUser.photo_url}
                                    alt={selectedUser.full_name}
                                    style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' }}
                                />
                            ) : (
                                <Avatar size={120} style={{ backgroundColor: '#667eea' }}>
                                    {selectedUser.full_name?.charAt(0).toUpperCase()}
                                </Avatar>
                            )}
                        </div>

                        <Descriptions bordered column={1}>
                            <Descriptions.Item label="Full Name">
                                {selectedUser.full_name}
                            </Descriptions.Item>
                            <Descriptions.Item label="Email">
                                {selectedUser.email || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Phone">
                                {selectedUser.phone || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Role">
                                <Tag color={selectedUser.user_role === 'staff' ? 'blue' : 'green'}>
                                    {selectedUser.user_role?.toUpperCase()}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="ID">
                                {selectedUser.staff_id || selectedUser.student_id || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Gender">
                                {selectedUser.gender || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Branch">
                                {selectedUser.branch?.name || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Organization">
                                {selectedUser.organization?.name || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Status">
                                <Tag color={selectedUser.is_active ? 'success' : 'default'}>
                                    {selectedUser.is_active ? 'Active' : 'Inactive'}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Enrolled On">
                                {dayjs(selectedUser.created_at).format('MMMM D, YYYY h:mm A')}
                            </Descriptions.Item>
                        </Descriptions>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default UsersManagementPage;
