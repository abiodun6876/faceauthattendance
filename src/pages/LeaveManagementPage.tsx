// pages/LeaveManagementPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    Table,
    Button,
    Modal,
    Form,
    Input,
    DatePicker,
    Select,
    message,
    Tag,
    Space,
    Typography,
    Row,
    Col,
    Statistic,
    Tabs
} from 'antd';
import {
    Calendar,
    Plus,
    ArrowLeft,
    CheckCircle,
    XCircle,
    Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const LeaveManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState('my-requests');
    const [stats, setStats] = useState({
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0
    });

    const loadLeaveRequests = useCallback(async () => {
        try {
            setLoading(true);
            const organizationId = localStorage.getItem('organization_id');
            const userId = localStorage.getItem('user_id');

            let query = supabase
                .from('leave_requests' as any)
                .select(`
          *,
          user:users!leave_requests_user_id_fkey(full_name, staff_id),
          approver:users!leave_requests_approved_by_fkey(full_name)
        `)
                .eq('organization_id', organizationId)
                .order('created_at', { ascending: false });

            // Filter based on active tab
            if (activeTab === 'my-requests') {
                query = query.eq('user_id', userId);
            }

            const { data, error } = await query;

            if (error) throw error;
            const leaveData = data as any[];
            setLeaveRequests(leaveData || []);

            // Calculate stats
            const pending = leaveData?.filter(l => l.status === 'pending').length || 0;
            const approved = leaveData?.filter(l => l.status === 'approved').length || 0;
            const rejected = leaveData?.filter(l => l.status === 'rejected').length || 0;
            const total = leaveData?.length || 0;

            setStats({ pending, approved, rejected, total });
        } catch (error: any) {
            console.error('Error loading leave requests:', error);
            message.error('Failed to load leave requests');
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        loadLeaveRequests();
    }, [loadLeaveRequests]);

    const handleSubmit = async (values: any) => {
        try {
            setLoading(true);
            const organizationId = localStorage.getItem('organization_id');
            const userId = localStorage.getItem('user_id');

            const startDate = values.date_range[0].format('YYYY-MM-DD');
            const endDate = values.date_range[1].format('YYYY-MM-DD');
            const totalDays = values.date_range[1].diff(values.date_range[0], 'day') + 1;

            const { error } = await supabase
                .from('leave_requests' as any)
                .insert({
                    organization_id: organizationId,
                    user_id: userId,
                    leave_type: values.leave_type,
                    start_date: startDate,
                    end_date: endDate,
                    total_days: totalDays,
                    reason: values.reason,
                    status: 'pending'
                });

            if (error) throw error;

            message.success('Leave request submitted successfully');
            setModalVisible(false);
            form.resetFields();
            loadLeaveRequests();
        } catch (error: any) {
            console.error('Error submitting leave request:', error);
            message.error('Failed to submit leave request');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (requestId: string) => {
        try {
            const userId = localStorage.getItem('user_id');

            const { error } = await supabase
                .from('leave_requests' as any)
                .update({
                    status: 'approved',
                    approved_by: userId,
                    approved_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (error) throw error;

            message.success('Leave request approved');
            loadLeaveRequests();
        } catch (error: any) {
            console.error('Error approving leave:', error);
            message.error('Failed to approve leave request');
        }
    };

    const handleReject = async (requestId: string) => {
        Modal.confirm({
            title: 'Reject Leave Request',
            content: (
                <Input.TextArea
                    id="rejection-reason"
                    placeholder="Enter reason for rejection..."
                    rows={3}
                />
            ),
            onOk: async () => {
                try {
                    const userId = localStorage.getItem('user_id');
                    const reason = (document.getElementById('rejection-reason') as HTMLTextAreaElement)?.value;

                    const { error } = await supabase
                        .from('leave_requests' as any)
                        .update({
                            status: 'rejected',
                            approved_by: userId,
                            approved_at: new Date().toISOString(),
                            rejection_reason: reason
                        })
                        .eq('id', requestId);

                    if (error) throw error;

                    message.success('Leave request rejected');
                    loadLeaveRequests();
                } catch (error: any) {
                    console.error('Error rejecting leave:', error);
                    message.error('Failed to reject leave request');
                }
            },
        });
    };

    const columns = [
        {
            title: 'Employee',
            key: 'employee',
            render: (record: any) => (
                <div>
                    <div><strong>{record.user?.full_name}</strong></div>
                    <div style={{ fontSize: 12, color: '#666' }}>{record.user?.staff_id}</div>
                </div>
            ),
        },
        {
            title: 'Leave Type',
            dataIndex: 'leave_type',
            key: 'leave_type',
            render: (type: string) => {
                const colors: any = {
                    annual: 'blue',
                    sick: 'orange',
                    personal: 'purple',
                    emergency: 'red',
                    maternity: 'pink',
                    paternity: 'cyan'
                };
                return <Tag color={colors[type]}>{type.toUpperCase()}</Tag>;
            },
        },
        {
            title: 'Start Date',
            dataIndex: 'start_date',
            key: 'start_date',
            render: (date: string) => dayjs(date).format('MMM D, YYYY'),
        },
        {
            title: 'End Date',
            dataIndex: 'end_date',
            key: 'end_date',
            render: (date: string) => dayjs(date).format('MMM D, YYYY'),
        },
        {
            title: 'Days',
            dataIndex: 'total_days',
            key: 'total_days',
            render: (days: number) => `${days} day${days > 1 ? 's' : ''}`,
        },
        {
            title: 'Reason',
            dataIndex: 'reason',
            key: 'reason',
            ellipsis: true,
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                const colors: any = {
                    pending: 'orange',
                    approved: 'green',
                    rejected: 'red',
                    cancelled: 'default'
                };
                return <Tag color={colors[status]}>{status.toUpperCase()}</Tag>;
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (record: any) => {
                if (activeTab === 'all-requests' && record.status === 'pending') {
                    return (
                        <Space>
                            <Button
                                type="text"
                                icon={<CheckCircle size={16} />}
                                onClick={() => handleApprove(record.id)}
                                style={{ color: '#52c41a' }}
                            >
                                Approve
                            </Button>
                            <Button
                                type="text"
                                icon={<XCircle size={16} />}
                                onClick={() => handleReject(record.id)}
                                style={{ color: '#ff4d4f' }}
                            >
                                Reject
                            </Button>
                        </Space>
                    );
                }
                return null;
            },
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
                        backgroundColor: '#fa8c16',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Calendar size={24} color="#fff" />
                    </div>
                    <div>
                        <Title level={3} style={{ margin: 0 }}>
                            Leave Management
                        </Title>
                        <Text type="secondary">
                            Request and manage employee leave
                        </Text>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Total Requests"
                            value={stats.total}
                            prefix={<Calendar size={20} />}
                            valueStyle={{ color: '#667eea' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Pending"
                            value={stats.pending}
                            prefix={<Clock size={20} />}
                            valueStyle={{ color: '#fa8c16' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Approved"
                            value={stats.approved}
                            prefix={<CheckCircle size={20} />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Rejected"
                            value={stats.rejected}
                            prefix={<XCircle size={20} />}
                            valueStyle={{ color: '#ff4d4f' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Actions */}
            <Card style={{ marginBottom: 24 }}>
                <Button
                    type="primary"
                    icon={<Plus size={16} />}
                    onClick={() => setModalVisible(true)}
                    size="large"
                >
                    Request Leave
                </Button>
            </Card>

            {/* Leave Requests Table */}
            <Card>
                <Tabs activeKey={activeTab} onChange={setActiveTab}>
                    <TabPane tab="My Requests" key="my-requests">
                        <Table
                            columns={columns.filter(c => c.key !== 'actions')}
                            dataSource={leaveRequests}
                            loading={loading}
                            rowKey="id"
                            pagination={{ pageSize: 10 }}
                        />
                    </TabPane>
                    <TabPane tab="All Requests (Manager)" key="all-requests">
                        <Table
                            columns={columns}
                            dataSource={leaveRequests}
                            loading={loading}
                            rowKey="id"
                            pagination={{ pageSize: 10 }}
                        />
                    </TabPane>
                </Tabs>
            </Card>

            {/* Request Leave Modal */}
            <Modal
                title="Request Leave"
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        label="Leave Type"
                        name="leave_type"
                        rules={[{ required: true, message: 'Please select leave type' }]}
                    >
                        <Select placeholder="Select leave type" size="large">
                            <Option value="annual">Annual Leave</Option>
                            <Option value="sick">Sick Leave</Option>
                            <Option value="personal">Personal Leave</Option>
                            <Option value="emergency">Emergency Leave</Option>
                            <Option value="maternity">Maternity Leave</Option>
                            <Option value="paternity">Paternity Leave</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="Date Range"
                        name="date_range"
                        rules={[{ required: true, message: 'Please select dates' }]}
                    >
                        <RangePicker style={{ width: '100%' }} size="large" />
                    </Form.Item>

                    <Form.Item
                        label="Reason"
                        name="reason"
                        rules={[{ required: true, message: 'Please enter reason' }]}
                    >
                        <TextArea rows={4} placeholder="Explain the reason for your leave request..." />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit" loading={loading} size="large">
                                Submit Request
                            </Button>
                            <Button onClick={() => setModalVisible(false)} size="large">
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default LeaveManagementPage;
