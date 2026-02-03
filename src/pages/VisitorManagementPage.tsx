// pages/VisitorManagementPage.tsx
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
    TimePicker,
    Select,
    message,
    Tag,
    Space,
    Typography,
    Row,
    Col,
    Statistic
} from 'antd';
import {
    Users,
    UserPlus,
    ArrowLeft,
    Calendar,
    Clock,
    CheckCircle,
    Key
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const VisitorManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [staff, setStaff] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [checkInModalVisible, setCheckInModalVisible] = useState(false);
    const [stats, setStats] = useState({
        pending: 0,
        approved: 0,
        checkedIn: 0,
        today: 0
    });

    const loadAppointments = useCallback(async () => {
        try {
            setLoading(true);
            const organizationId = localStorage.getItem('organization_id');

            const branchId = localStorage.getItem('branch_id');

            let query = supabase
                .from('appointments' as any)
                .select(`
          *,
          visitor:visitors(full_name, email, phone, company),
          host:users!appointments_host_user_id_fkey(full_name),
          approved_by_user:users!appointments_approved_by_fkey(full_name)
        `)
                .eq('organization_id', organizationId);

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query
                .order('appointment_date', { ascending: false })
                .order('start_time', { ascending: false });

            if (error) throw error;
            const appData = data as any[];
            setAppointments(appData || []);

            // Calculate stats
            const today = dayjs().format('YYYY-MM-DD');
            const pending = appData?.filter(a => a.status === 'pending').length || 0;
            const approved = appData?.filter(a => a.status === 'approved').length || 0;
            const checkedIn = appData?.filter(a => a.status === 'checked_in').length || 0;
            const todayCount = appData?.filter(a => a.appointment_date === today).length || 0;

            setStats({ pending, approved, checkedIn, today: todayCount });
        } catch (error: any) {
            console.error('Error loading appointments:', error);
            message.error('Failed to load appointments');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadStaff = useCallback(async () => {
        try {
            const organizationId = localStorage.getItem('organization_id');
            const branchId = localStorage.getItem('branch_id');
            let query = supabase
                .from('users')
                .select('id, full_name, user_role')
                .eq('organization_id', organizationId)
                .eq('user_role', 'staff');

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query;

            if (error) throw error;
            setStaff(data || []);
        } catch (error: any) {
            console.error('Error loading staff:', error);
        }
    }, []);

    const loadData = useCallback(async () => {
        await Promise.all([
            loadAppointments(),
            loadStaff()
        ]);
    }, [loadAppointments, loadStaff]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleBookAppointment = async (values: any) => {
        try {
            setLoading(true);
            const organizationId = localStorage.getItem('organization_id');
            const branchId = localStorage.getItem('branch_id');

            // Create new visitor
            const { data: newVisitor, error: visitorError } = await supabase
                .from('visitors' as any)
                .insert({
                    organization_id: organizationId,
                    full_name: values.visitor_name,
                    email: values.visitor_email,
                    phone: values.visitor_phone,
                    company: values.visitor_company
                })
                .select()
                .single();

            if (visitorError) throw visitorError;
            const v = newVisitor as any;
            const visitorId = v.id;

            // Create appointment
            const { data: appointment, error } = await supabase
                .from('appointments' as any)
                .insert({
                    organization_id: organizationId,
                    branch_id: branchId,
                    visitor_id: visitorId,
                    host_user_id: values.host_user_id,
                    appointment_date: values.appointment_date.format('YYYY-MM-DD'),
                    start_time: values.start_time.format('HH:mm'),
                    end_time: values.end_time.format('HH:mm'),
                    purpose: values.purpose,
                    status: 'approved' // Auto-approve for now
                })
                .select()
                .single();

            if (error) throw error;
            const app = appointment as any;

            message.success(`Appointment booked! Pass Code: ${app.pass_code}`);
            Modal.info({
                title: 'Appointment Confirmed',
                content: (
                    <div>
                        <p><strong>Pass Code:</strong> <span style={{ fontSize: 24, color: '#52c41a' }}>{app.pass_code}</span></p>
                        <p>Please share this code with the visitor. They will need it to check in.</p>
                    </div>
                ),
            });

            setModalVisible(false);
            form.resetFields();
            loadAppointments();
        } catch (error: any) {
            console.error('Error booking appointment:', error);
            message.error('Failed to book appointment');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async (values: any) => {
        try {
            setLoading(true);
            const userId = localStorage.getItem('user_id');

            const { data: appointment, error: fetchError } = await supabase
                .from('appointments' as any)
                .select('*')
                .eq('pass_code', values.pass_code)
                .single();

            if (fetchError || !appointment) {
                message.error('Invalid pass code');
                return;
            }

            const app = appointment as any;
            if (app.status === 'checked_in') {
                message.warning('Visitor already checked in');
                return;
            }

            const { error } = await supabase
                .from('appointments' as any)
                .update({
                    status: 'checked_in',
                    checked_in_at: new Date().toISOString(),
                    checked_in_by: userId
                })
                .eq('id', app.id);

            if (error) throw error;

            message.success('Visitor checked in successfully');
            setCheckInModalVisible(false);
            form.resetFields();
            loadAppointments();
        } catch (error: any) {
            console.error('Error checking in:', error);
            message.error('Failed to check in visitor');
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Date',
            dataIndex: 'appointment_date',
            key: 'date',
            render: (date: string) => dayjs(date).format('MMM D, YYYY'),
            sorter: (a: any, b: any) => dayjs(a.appointment_date).unix() - dayjs(b.appointment_date).unix(),
        },
        {
            title: 'Time',
            key: 'time',
            render: (record: any) => `${record.start_time} - ${record.end_time}`,
        },
        {
            title: 'Visitor',
            key: 'visitor',
            render: (record: any) => (
                <div>
                    <div><strong>{record.visitor?.full_name}</strong></div>
                    <div style={{ fontSize: 12, color: '#666' }}>{record.visitor?.company}</div>
                </div>
            ),
        },
        {
            title: 'Host',
            key: 'host',
            render: (record: any) => record.host?.full_name || '-',
        },
        {
            title: 'Purpose',
            dataIndex: 'purpose',
            key: 'purpose',
            ellipsis: true,
        },
        {
            title: 'Pass Code',
            dataIndex: 'pass_code',
            key: 'pass_code',
            render: (code: string) => (
                <Tag color="blue" style={{ fontSize: 16, padding: '4px 8px' }}>
                    {code}
                </Tag>
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                const colors: any = {
                    pending: 'orange',
                    approved: 'blue',
                    checked_in: 'green',
                    checked_out: 'default',
                    rejected: 'red',
                    cancelled: 'default'
                };
                return <Tag color={colors[status]}>{status.replace('_', ' ').toUpperCase()}</Tag>;
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
                        backgroundColor: '#667eea',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Users size={24} color="#fff" />
                    </div>
                    <div>
                        <Title level={3} style={{ margin: 0 }}>
                            Visitor Management
                        </Title>
                        <Text type="secondary">
                            Manage appointments and visitor check-ins
                        </Text>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Today's Appointments"
                            value={stats.today}
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
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Checked In"
                            value={stats.checkedIn}
                            prefix={<Users size={20} />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Actions */}
            <Card style={{ marginBottom: 24 }}>
                <Space>
                    <Button
                        type="primary"
                        icon={<UserPlus size={16} />}
                        onClick={() => setModalVisible(true)}
                        size="large"
                    >
                        Book Appointment
                    </Button>
                    <Button
                        icon={<Key size={16} />}
                        onClick={() => setCheckInModalVisible(true)}
                        size="large"
                    >
                        Check In Visitor
                    </Button>
                </Space>
            </Card>

            {/* Appointments Table */}
            <Card>
                <Table
                    columns={columns}
                    dataSource={appointments}
                    loading={loading}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            {/* Book Appointment Modal */}
            <Modal
                title="Book Visitor Appointment"
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleBookAppointment}
                >
                    <Form.Item
                        label="Visitor Name"
                        name="visitor_name"
                        rules={[{ required: true, message: 'Please enter visitor name' }]}
                    >
                        <Input placeholder="Enter visitor's full name" size="large" />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Email" name="visitor_email">
                                <Input type="email" placeholder="visitor@example.com" size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Phone"
                                name="visitor_phone"
                                rules={[{ required: true, message: 'Please enter phone' }]}
                            >
                                <Input placeholder="+1234567890" size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item label="Company" name="visitor_company">
                        <Input placeholder="Company name" size="large" />
                    </Form.Item>

                    <Form.Item
                        label="Host (Staff Member)"
                        name="host_user_id"
                        rules={[{ required: true, message: 'Please select host' }]}
                    >
                        <Select placeholder="Select staff member" size="large">
                            {staff.map(s => (
                                <Option key={s.id} value={s.id}>{s.full_name}</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item
                                label="Date"
                                name="appointment_date"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <DatePicker style={{ width: '100%' }} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                label="Start Time"
                                name="start_time"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <TimePicker format="HH:mm" style={{ width: '100%' }} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                label="End Time"
                                name="end_time"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <TimePicker format="HH:mm" style={{ width: '100%' }} size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        label="Purpose of Visit"
                        name="purpose"
                        rules={[{ required: true, message: 'Please enter purpose' }]}
                    >
                        <TextArea rows={3} placeholder="Describe the purpose of visit" />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit" loading={loading} size="large">
                                Book Appointment
                            </Button>
                            <Button onClick={() => setModalVisible(false)} size="large">
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Check In Modal */}
            <Modal
                title="Check In Visitor"
                open={checkInModalVisible}
                onCancel={() => setCheckInModalVisible(false)}
                footer={null}
            >
                <Form form={form} layout="vertical" onFinish={handleCheckIn}>
                    <Form.Item
                        label="Pass Code"
                        name="pass_code"
                        rules={[{ required: true, message: 'Please enter pass code' }]}
                    >
                        <Input
                            placeholder="Enter 6-digit pass code"
                            size="large"
                            maxLength={6}
                            style={{ fontSize: 24, textAlign: 'center', letterSpacing: 4 }}
                        />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit" loading={loading} size="large">
                                Check In
                            </Button>
                            <Button onClick={() => setCheckInModalVisible(false)} size="large">
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default VisitorManagementPage;
