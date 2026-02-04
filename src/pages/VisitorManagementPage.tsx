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
    Statistic,
    Avatar,
    Badge,
    Divider,
    Drawer,
    List,
    Dropdown,
    Menu,
    Pagination
} from 'antd';
import {
    Users,
    UserPlus,
    ArrowLeft,
    Calendar,
    Clock,
    CheckCircle,
    Key,
    Phone,
    Mail,
    MoreVertical,
    UserCheck,
    Eye,
    FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const VisitorManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [checkInForm] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [staff, setStaff] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [checkInModalVisible, setCheckInModalVisible] = useState(false);
    const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
    const [stats, setStats] = useState({
        pending: 0,
        approved: 0,
        checkedIn: 0,
        today: 0
    });

    const getStatusColor = (status: string) => {
        const colors: any = {
            pending: '#fa8c16',
            approved: '#1890ff',
            checked_in: '#52c41a',
            checked_out: '#666',
            rejected: '#ff4d4f',
            cancelled: '#d9d9d9'
        };
        return colors[status] || '#d9d9d9';
    };

    const getStatusBadge = (status: string) => {
        const badgeStatus: any = {
            pending: 'warning',
            approved: 'processing',
            checked_in: 'success',
            checked_out: 'default',
            rejected: 'error',
            cancelled: 'default'
        };
        return badgeStatus[status] || 'default';
    };

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
                    status: 'approved'
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
            checkInForm.resetFields();
            loadAppointments();
        } catch (error: any) {
            console.error('Error checking in:', error);
            message.error('Failed to check in visitor');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = (appointment: any) => {
        setSelectedAppointment(appointment);
        setDetailDrawerVisible(true);
    };

    const columns = [
        {
            title: 'Visitor',
            key: 'visitor',
            width: 150,
            render: (record: any) => (
                <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                    onClick={() => handleViewDetails(record)}
                >
                    <Avatar
                        size={36}
                        style={{
                            backgroundColor: getStatusColor(record.status) + '20',
                            color: getStatusColor(record.status)
                        }}
                    >
                        {record.visitor?.full_name?.charAt(0) || 'V'}
                    </Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ display: 'block', fontSize: 14 }}>
                            {record.visitor?.full_name}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {record.visitor?.company || 'No company'}
                        </Text>
                    </div>
                </div>
            ),
        },
        {
            title: 'Date & Time',
            key: 'datetime',
            width: 120,
            render: (record: any) => (
                <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>
                        {dayjs(record.appointment_date).format('MMM D')}
                    </div>
                    <div style={{ fontSize: 11, color: '#666' }}>
                        {record.start_time} - {record.end_time}
                    </div>
                </div>
            ),
        },
        {
            title: 'Host',
            key: 'host',
            width: 100,
            render: (record: any) => (
                <Text style={{ fontSize: 12 }}>
                    {record.host?.full_name || '-'}
                </Text>
            ),
        },
        {
            title: 'Status',
            key: 'status',
            width: 90,
            render: (record: any) => (
                <Badge
                    status={getStatusBadge(record.status)}
                    text={
                        <span style={{ fontSize: 11 }}>
                            {record.status.replace('_', ' ')}
                        </span>
                    }
                />
            ),
        },
        {
            title: 'Code',
            dataIndex: 'pass_code',
            key: 'pass_code',
            width: 70,
            render: (code: string) => (
                <Tag
                    color="blue"
                    style={{
                        fontSize: 12,
                        padding: '2px 6px',
                        margin: 0,
                        borderRadius: 12
                    }}
                >
                    {code}
                </Tag>
            ),
        },
        {
            title: '',
            key: 'actions',
            width: 40,
            render: (record: any) => (
                <Dropdown
                    dropdownRender={() => (
                        <Menu>
                            <Menu.Item
                                key="view"
                                icon={<Eye size={14} />}
                                onClick={() => handleViewDetails(record)}
                            >
                                View Details
                            </Menu.Item>
                            <Menu.Item
                                key="checkin"
                                icon={<UserCheck size={14} />}
                                disabled={record.status === 'checked_in'}
                            >
                                Check In
                            </Menu.Item>
                        </Menu>
                    )}
                    trigger={['click']}
                >
                    <Button type="text" icon={<MoreVertical size={16} />} size="small" />
                </Dropdown>
            ),
        },
    ];

    // Mobile-friendly card view
    const renderMobileCards = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {appointments.map((appointment) => (
                <Card
                    key={appointment.id}
                    size="small"
                    hoverable
                    style={{
                        borderRadius: 12,
                        borderLeft: `4px solid ${getStatusColor(appointment.status)}`,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        marginBottom: 8
                    }}
                    onClick={() => handleViewDetails(appointment)}
                >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <Avatar
                            size={40}
                            style={{
                                backgroundColor: getStatusColor(appointment.status) + '20',
                                color: getStatusColor(appointment.status)
                            }}
                        >
                            {appointment.visitor?.full_name?.charAt(0) || 'V'}
                        </Avatar>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <Text strong style={{ fontSize: 14, display: 'block' }}>
                                        {appointment.visitor?.full_name}
                                    </Text>
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                                        {appointment.visitor?.company}
                                    </Text>
                                </div>
                                <Tag
                                    color="blue"
                                    style={{
                                        fontSize: 10,
                                        padding: '2px 6px',
                                        borderRadius: 10
                                    }}
                                >
                                    {appointment.pass_code}
                                </Tag>
                            </div>

                            <Divider style={{ margin: '8px 0' }} />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div>
                                    <Text style={{ fontSize: 11, color: '#666', display: 'block' }}>Date</Text>
                                    <Text strong style={{ fontSize: 12 }}>
                                        {dayjs(appointment.appointment_date).format('MMM D, YYYY')}
                                    </Text>
                                </div>
                                <div>
                                    <Text style={{ fontSize: 11, color: '#666', display: 'block' }}>Time</Text>
                                    <Text strong style={{ fontSize: 12 }}>
                                        {appointment.start_time} - {appointment.end_time}
                                    </Text>
                                </div>
                                <div>
                                    <Text style={{ fontSize: 11, color: '#666', display: 'block' }}>Host</Text>
                                    <Text strong style={{ fontSize: 12 }}>
                                        {appointment.host?.full_name || '-'}
                                    </Text>
                                </div>
                                <div>
                                    <Text style={{ fontSize: 11, color: '#666', display: 'block' }}>Status</Text>
                                    <Badge
                                        status={getStatusBadge(appointment.status)}
                                        text={
                                            <span style={{ fontSize: 11 }}>
                                                {appointment.status.replace('_', ' ')}
                                            </span>
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            ))}

            {/* Mobile pagination */}
            <div style={{
                marginTop: 16,
                display: 'flex',
                justifyContent: 'center'
            }}>
                <Pagination
                    simple
                    size="small"
                    total={appointments.length}
                    pageSize={10}
                    showSizeChanger={false}
                    showQuickJumper={false}
                />
            </div>
        </div>
    );

    const isMobile = window.innerWidth < 768;

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#f8f9fa',
            padding: isMobile ? '12px' : '16px'
        }}>
            {/* Header */}
            <div style={{
                background: 'white',
                padding: isMobile ? '16px' : '16px 24px',
                borderRadius: '12px',
                marginBottom: 24,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
            }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Space align="center">
                        <Button
                            type="text"
                            icon={<ArrowLeft size={isMobile ? 20 : 24} />}
                            onClick={() => navigate('/')}
                            style={{ color: '#666' }}
                        />
                        <div style={{ flex: 1 }}>
                            <Title level={isMobile ? 4 : 3} style={{ margin: 0 }}>
                                Visitor Management
                            </Title>
                            <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>
                                Manage appointments and visitor check-ins
                            </Text>
                        </div>
                    </Space>

                    {/* Stats - Mobile optimized */}
                    <Row gutter={[8, 8]} style={{ marginTop: 16 }}>
                        <Col xs={12} sm={6}>
                            <Card size="small" bodyStyle={{ padding: isMobile ? '12px' : '16px' }}>
                                <Statistic
                                    title={<Text style={{ fontSize: isMobile ? 11 : 12 }}>Today's Appointments</Text>}
                                    value={stats.today}
                                    prefix={<Calendar size={isMobile ? 14 : 16} />}
                                    valueStyle={{
                                        color: '#667eea',
                                        fontSize: isMobile ? 18 : 24
                                    }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card size="small" bodyStyle={{ padding: isMobile ? '12px' : '16px' }}>
                                <Statistic
                                    title={<Text style={{ fontSize: isMobile ? 11 : 12 }}>Pending</Text>}
                                    value={stats.pending}
                                    prefix={<Clock size={isMobile ? 14 : 16} />}
                                    valueStyle={{
                                        color: '#fa8c16',
                                        fontSize: isMobile ? 18 : 24
                                    }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card size="small" bodyStyle={{ padding: isMobile ? '12px' : '16px' }}>
                                <Statistic
                                    title={<Text style={{ fontSize: isMobile ? 11 : 12 }}>Approved</Text>}
                                    value={stats.approved}
                                    prefix={<CheckCircle size={isMobile ? 14 : 16} />}
                                    valueStyle={{
                                        color: '#1890ff',
                                        fontSize: isMobile ? 18 : 24
                                    }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card size="small" bodyStyle={{ padding: isMobile ? '12px' : '16px' }}>
                                <Statistic
                                    title={<Text style={{ fontSize: isMobile ? 11 : 12 }}>Checked In</Text>}
                                    value={stats.checkedIn}
                                    prefix={<Users size={isMobile ? 14 : 16} />}
                                    valueStyle={{
                                        color: '#52c41a',
                                        fontSize: isMobile ? 18 : 24
                                    }}
                                />
                            </Card>
                        </Col>
                    </Row>
                </Space>
            </div>

            {/* Actions - Mobile optimized */}
            <Card
                size="small"
                style={{ marginBottom: 24 }}
                bodyStyle={{ padding: isMobile ? '12px' : '16px' }}
            >
                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? 12 : 16
                }}>
                    <Button
                        type="primary"
                        icon={<UserPlus size={isMobile ? 14 : 16} />}
                        onClick={() => setModalVisible(true)}
                        size={isMobile ? 'middle' : 'large'}
                        block={isMobile}
                    >
                        Book Appointment
                    </Button>
                    <Button
                        icon={<Key size={isMobile ? 14 : 16} />}
                        onClick={() => setCheckInModalVisible(true)}
                        size={isMobile ? 'middle' : 'large'}
                        block={isMobile}
                    >
                        Check In Visitor
                    </Button>
                </div>
            </Card>

            {/* Appointments - Responsive View */}
            <Card
                title={<Text strong>Appointments</Text>}
                extra={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {appointments.length} total
                    </Text>
                }
                bodyStyle={{
                    padding: isMobile ? '12px 0' : '0'
                }}
            >
                {isMobile ? (
                    renderMobileCards()
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <Table
                            columns={columns}
                            dataSource={appointments}
                            loading={loading}
                            rowKey="id"
                            pagination={{
                                pageSize: 10,
                                showSizeChanger: true,
                                showQuickJumper: true,
                                size: 'small'
                            }}
                            size="small"
                            scroll={{ x: 800 }}
                            rowClassName="appointment-row"
                            onRow={(record) => ({
                                onClick: () => handleViewDetails(record),
                                style: { cursor: 'pointer' }
                            })}
                        />
                    </div>
                )}
            </Card>

            {/* Book Appointment Modal */}
            <Modal
                title="Book Visitor Appointment"
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={isMobile ? '90%' : 600}
                destroyOnClose
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

                    <Row gutter={isMobile ? 0 : 16}>
                        <Col span={isMobile ? 24 : 12}>
                            <Form.Item label="Email" name="visitor_email">
                                <Input type="email" placeholder="visitor@example.com" size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={isMobile ? 24 : 12}>
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

                    <Row gutter={isMobile ? 0 : 16}>
                        <Col span={isMobile ? 24 : 8}>
                            <Form.Item
                                label="Date"
                                name="appointment_date"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <DatePicker style={{ width: '100%' }} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={isMobile ? 24 : 8}>
                            <Form.Item
                                label="Start Time"
                                name="start_time"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <TimePicker format="HH:mm" style={{ width: '100%' }} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={isMobile ? 24 : 8}>
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

                    <Form.Item style={{ marginBottom: 0 }}>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={() => setModalVisible(false)} size="large">
                                Cancel
                            </Button>
                            <Button type="primary" htmlType="submit" loading={loading} size="large">
                                Book Appointment
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
                width={isMobile ? '90%' : 400}
            >
                <Form form={checkInForm} layout="vertical" onFinish={handleCheckIn}>
                    <Form.Item
                        label="Pass Code"
                        name="pass_code"
                        rules={[{ required: true, message: 'Please enter pass code' }]}
                    >
                        <Input
                            placeholder="Enter 6-digit pass code"
                            size="large"
                            maxLength={6}
                            style={{
                                fontSize: 24,
                                textAlign: 'center',
                                letterSpacing: 4,
                                height: 60
                            }}
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0 }}>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={() => setCheckInModalVisible(false)} size="large">
                                Cancel
                            </Button>
                            <Button type="primary" htmlType="submit" loading={loading} size="large">
                                Check In
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Appointment Detail Drawer */}
            <Drawer
                title="Appointment Details"
                placement="right"
                onClose={() => setDetailDrawerVisible(false)}
                open={detailDrawerVisible}
                width={isMobile ? '100%' : 400}
            >
                {selectedAppointment && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Visitor Info */}
                        <div style={{
                            background: '#f8f9fa',
                            padding: 16,
                            borderRadius: 12,
                            textAlign: 'center'
                        }}>
                            <Avatar
                                size={64}
                                style={{
                                    backgroundColor: getStatusColor(selectedAppointment.status) + '20',
                                    color: getStatusColor(selectedAppointment.status),
                                    fontSize: 24,
                                    marginBottom: 12
                                }}
                            >
                                {selectedAppointment.visitor?.full_name?.charAt(0) || 'V'}
                            </Avatar>
                            <Title level={4} style={{ marginBottom: 4 }}>
                                {selectedAppointment.visitor?.full_name}
                            </Title>
                            <Text type="secondary">
                                {selectedAppointment.visitor?.company || 'No company'}
                            </Text>
                        </div>

                        {/* Status Badge */}
                        <div style={{ textAlign: 'center' }}>
                            <Badge
                                status={getStatusBadge(selectedAppointment.status)}
                                text={
                                    <Text strong style={{ fontSize: 14 }}>
                                        {selectedAppointment.status.replace('_', ' ').toUpperCase()}
                                    </Text>
                                }
                            />
                            <div style={{ marginTop: 8 }}>
                                <Tag color="blue" style={{ fontSize: 16, padding: '4px 12px' }}>
                                    Pass Code: {selectedAppointment.pass_code}
                                </Tag>
                            </div>
                        </div>

                        {/* Details */}
                        <div>
                            <Title level={5} style={{ marginBottom: 12 }}>Appointment Details</Title>
                            <List size="small">
                                <List.Item>
                                    <List.Item.Meta
                                        avatar={<Calendar size={16} />}
                                        title="Date"
                                        description={dayjs(selectedAppointment.appointment_date).format('dddd, MMMM D, YYYY')}
                                    />
                                </List.Item>
                                <List.Item>
                                    <List.Item.Meta
                                        avatar={<Clock size={16} />}
                                        title="Time"
                                        description={`${selectedAppointment.start_time} - ${selectedAppointment.end_time}`}
                                    />
                                </List.Item>
                                <List.Item>
                                    <List.Item.Meta
                                        avatar={<Users size={16} />}
                                        title="Host"
                                        description={selectedAppointment.host?.full_name || 'Not assigned'}
                                    />
                                </List.Item>
                                <List.Item>
                                    <List.Item.Meta
                                        avatar={<FileText size={16} />}
                                        title="Purpose"
                                        description={selectedAppointment.purpose}
                                    />
                                </List.Item>
                            </List>
                        </div>

                        {/* Contact Info */}
                        <div>
                            <Title level={5} style={{ marginBottom: 12 }}>Contact Information</Title>
                            <List size="small">
                                {selectedAppointment.visitor?.email && (
                                    <List.Item>
                                        <List.Item.Meta
                                            avatar={<Mail size={16} />}
                                            title="Email"
                                            description={selectedAppointment.visitor.email}
                                        />
                                    </List.Item>
                                )}
                                {selectedAppointment.visitor?.phone && (
                                    <List.Item>
                                        <List.Item.Meta
                                            avatar={<Phone size={16} />}
                                            title="Phone"
                                            description={selectedAppointment.visitor.phone}
                                        />
                                    </List.Item>
                                )}
                            </List>
                        </div>

                        {/* Actions */}
                        <div style={{ marginTop: 'auto' }}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Button
                                    type="primary"
                                    block
                                    size="large"
                                    icon={<UserCheck size={16} />}
                                    disabled={selectedAppointment.status === 'checked_in'}
                                >
                                    Check In Visitor
                                </Button>
                                <Button
                                    block
                                    size="large"
                                    onClick={() => setDetailDrawerVisible(false)}
                                >
                                    Close
                                </Button>
                            </Space>
                        </div>
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default VisitorManagementPage;