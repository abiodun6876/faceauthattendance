import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Table,
    Button,
    Card,
    Modal,
    Form,
    Input,
    DatePicker,
    Select,
    Tag,
    Space,
    message,
    Typography,
    Row,
    Col,
    Statistic,
} from 'antd';
import {
    Calendar,
    Plus,
    Users,
    MapPin,
    Clock,
    Edit,
    Copy,
    UserCheck,
    Search
} from 'lucide-react';
import { eventService, Event } from '../services/eventService';
import { deviceService } from '../services/deviceService';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

const EventsManagementPage: React.FC = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [searchText, setSearchText] = useState('');
    const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const [deviceInfo, setDeviceInfo] = useState<any>(null);

    const loadDeviceInfo = useCallback(async () => {
        // 1. Try deviceService checkRegistration (most reliable for real devices)
        const { isRegistered, device: registeredDevice } = await deviceService.checkRegistration();
        if (isRegistered && registeredDevice) {
            setDeviceInfo(registeredDevice);
            return;
        }

        // 2. Try localStorage fallbacks
        const storedDevice = localStorage.getItem('attendance_device') ||
            localStorage.getItem('device_info') ||
            localStorage.getItem('cached_device_info');

        if (storedDevice) {
            try {
                setDeviceInfo(JSON.parse(storedDevice));
            } catch (e) {
                console.error('Error parsing stored device info');
            }
        } else {
            // 3. Last resort: direct ID lookup
            const directOrgId = localStorage.getItem('organization_id');
            if (directOrgId) {
                setDeviceInfo({ organization_id: directOrgId });
            }
        }
    }, []);

    const loadEvents = useCallback(async () => {
        if (!deviceInfo?.organization_id) return;
        setLoading(true);
        try {
            const { data, error } = await eventService.getEvents(deviceInfo.organization_id);
            if (error) throw error;
            setEvents((data as any) || []);
            setFilteredEvents((data as any) || []);
        } catch (error: any) {
            message.error('Failed to load events: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, [deviceInfo]);

    useEffect(() => {
        loadDeviceInfo();
    }, [loadDeviceInfo]);

    useEffect(() => {
        if (deviceInfo) {
            loadEvents();
        }
    }, [deviceInfo, loadEvents]);

    useEffect(() => {
        const filtered = events.filter(event =>
            event.name?.toLowerCase().includes(searchText.toLowerCase()) ||
            event.event_type?.toLowerCase().includes(searchText.toLowerCase()) ||
            event.location?.toLowerCase().includes(searchText.toLowerCase())
        );
        setFilteredEvents(filtered);
    }, [searchText, events]);

    const handleCreateEvent = async (values: any) => {
        try {
            const orgId = deviceInfo?.organization_id || localStorage.getItem('organization_id');
            if (!orgId) {
                message.error('No organization context found. Please setup device first.');
                return;
            }

            const newEvent = {
                ...values,
                organization_id: orgId,
                start_date: values.dateRange[0].toISOString(),
                end_date: values.dateRange[1].toISOString(),
                status: 'upcoming',
                is_active: true
            };
            delete newEvent.dateRange;

            if (editingEvent) {
                const { error } = await eventService.updateEvent(editingEvent.id, newEvent);
                if (error) throw error;
                message.success('Event updated successfully');
            } else {
                const { error } = await eventService.createEvent(newEvent);
                if (error) throw error;
                message.success('Event created successfully');
            }

            message.success('Event created successfully');
            setIsModalOpen(false);
            setEditingEvent(null);
            form.resetFields();
            loadEvents();
        } catch (error: any) {
            message.error('Failed to create event: ' + error.message);
        }
    };

    const showEditModal = (event: Event) => {
        setEditingEvent(event);
        form.setFieldsValue({
            ...event,
            dateRange: [dayjs(event.start_date), dayjs(event.end_date)]
        });
        setIsModalOpen(true);
    };

    const copyRegistrationLink = (eventId: string) => {
        const link = `${window.location.origin}/register-event/${eventId}`;
        navigator.clipboard.writeText(link).then(() => {
            message.success('Registration link copied to clipboard!');
        }).catch(err => {
            console.error('Copy failed: ', err);
            message.error('Failed to copy link');
        });
    };

    const showRegistrations = async (event: Event) => {
        setSelectedEvent(event);
        setIsDetailModalOpen(true);
        try {
            const { data, error } = await eventService.getRegistrations(event.id);
            if (error) throw error;
            setRegistrations(data || []);
        } catch (error: any) {
            message.error('Failed to load registrations');
        }
    };

    const columns = [
        {
            title: 'Event Name',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: Event) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{text}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>{record.event_type}</Text>
                </Space>
            )
        },
        {
            title: 'Date & Time',
            key: 'date',
            render: (record: Event) => (
                <Space direction="vertical" size={0}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Calendar size={14} style={{ marginRight: 4 }} />
                        {dayjs(record.start_date).format('MMM DD, YYYY')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#8c8c8c' }}>
                        <Clock size={12} style={{ marginRight: 4 }} />
                        {dayjs(record.start_date).format('HH:mm')} - {dayjs(record.end_date).format('HH:mm')}
                    </div>
                </Space>
            )
        },
        {
            title: 'Location',
            dataIndex: 'location',
            key: 'location',
            render: (location: string) => (
                <Space>
                    <MapPin size={14} />
                    {location || 'TBD'}
                </Space>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                const colors: any = {
                    upcoming: 'blue',
                    active: 'green',
                    completed: 'gray',
                    cancelled: 'red'
                };
                return <Tag color={colors[status]}>{status.toUpperCase()}</Tag>;
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (record: Event) => (
                <Space>
                    <Button
                        icon={<UserCheck size={16} />}
                        onClick={() => navigate(`/events/${record.id}/check-in`)}
                        title="Face/QR Check-In"
                        type="primary"
                        ghost
                    >
                        Check-In
                    </Button>
                    <Button
                        icon={<Users size={16} />}
                        onClick={() => showRegistrations(record)}
                    >
                        Attendees
                    </Button>
                    <Button
                        icon={<Edit size={16} />}
                        onClick={() => showEditModal(record)}
                    />
                    <Button
                        icon={<Copy size={16} />}
                        onClick={() => copyRegistrationLink(record.id)}
                        title="Copy Registration Link"
                    />
                </Space>
            )
        }
    ];

    const regColumns = [
        {
            title: 'Attendee',
            key: 'attendee',
            render: (record: any) => (
                <Space>
                    <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: '#f0f0f0',
                        overflow: 'hidden'
                    }}>
                        {record.user?.face_photo_url ? (
                            <img src={record.user.face_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <Users size={16} style={{ margin: 8 }} />
                        )}
                    </div>
                    <div>
                        <Text strong>{record.user?.full_name}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>{record.user?.email}</Text>
                    </div>
                </Space>
            )
        },
        {
            title: 'Reg. Date',
            dataIndex: 'registration_date',
            key: 'registration_date',
            render: (date: string) => dayjs(date).format('MMM DD, HH:mm')
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'checked_in' ? 'green' : 'blue'}>
                    {status.toUpperCase()}
                </Tag>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
                <Col xs={24} md={12}>
                    <Input
                        placeholder="Search events by name, type, or location..."
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        prefix={<Search size={16} />}
                        size="large"
                        allowClear
                    />
                </Col>
                <Col xs={24} md={12} style={{ textAlign: 'right' }}>
                    <Button
                        type="primary"
                        icon={<Plus size={18} />}
                        size="large"
                        onClick={() => setIsModalOpen(true)}
                    >
                        Create Event
                    </Button>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8} md={8}>
                    <Card>
                        <Statistic
                            title="Total Events"
                            value={events.length}
                            prefix={<Calendar size={20} style={{ marginRight: 8, color: '#1890ff' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={8} md={8}>
                    <Card>
                        <Statistic
                            title="Upcoming"
                            value={events.filter(e => e.status === 'upcoming').length}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={8} md={8}>
                    <Card>
                        <Statistic
                            title="Active"
                            value={events.filter(e => e.status === 'active').length}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
            </Row>

            <Card bodyStyle={{ padding: 0 }}>
                <Table
                    columns={columns}
                    dataSource={filteredEvents}
                    loading={loading}
                    rowKey="id"
                    scroll={{ x: 'max-content' }}
                />
            </Card>

            {/* Create/Edit Event Modal */}
            <Modal
                title={editingEvent ? "Edit Event" : "Create New Event"}
                open={isModalOpen}
                onCancel={() => {
                    setIsModalOpen(false);
                    setEditingEvent(null);
                    form.resetFields();
                }}
                onOk={() => form.submit()}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleCreateEvent}
                    initialValues={{ event_type: 'meeting' }}
                >
                    <Form.Item
                        name="name"
                        label="Event Name"
                        rules={[{ required: true, message: 'Please enter event name' }]}
                    >
                        <Input placeholder="e.g. Wedding Ceremony, Staff Meeting" />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="event_type"
                                label="Event Type"
                                rules={[{ required: true }]}
                            >
                                <Select>
                                    <Option value="wedding">Wedding</Option>
                                    <Option value="funeral">Funeral</Option>
                                    <Option value="party">Party</Option>
                                    <Option value="meeting">Meeting</Option>
                                    <Option value="conference">Conference</Option>
                                    <Option value="other">Other</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="location"
                                label="Location"
                            >
                                <Input placeholder="Venue name or address" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        name="dateRange"
                        label="Date and Time"
                        rules={[{ required: true, message: 'Please select date and time' }]}
                    >
                        <DatePicker.RangePicker showTime style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="Description"
                    >
                        <Input.TextArea rows={4} placeholder="About this event..." />
                    </Form.Item>

                    <Form.Item
                        name="capacity"
                        label="Capacity (Optional)"
                    >
                        <Input type="number" placeholder="Max attendees" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Attendee Details Modal */}
            <Modal
                title={`Attendees - ${selectedEvent?.name}`}
                open={isDetailModalOpen}
                onCancel={() => setIsDetailModalOpen(false)}
                footer={null}
                width={800}
            >
                <div style={{ marginBottom: 16 }}>
                    <Statistic title="Total Registered" value={registrations.length} />
                </div>
                <Table
                    columns={regColumns}
                    dataSource={registrations}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Modal>
        </div>
    );
};

export default EventsManagementPage;
