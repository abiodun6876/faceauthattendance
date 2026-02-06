// pages/VehicleManagementPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    Table,
    Button,
    Modal,
    Form,
    Input,
    Select,
    message,
    Tag,
    Space,
    Typography,
    Row,
    Col,
    Statistic,
    Avatar,
    Popconfirm,
    Divider,
    Tooltip,
    Tabs,
    InputNumber,
    Descriptions,
    Alert
} from 'antd';
import {
    Truck,
    Calendar,
    Plus,
    ArrowLeft,
    Eye,
    Edit,
    Delete,
    Search,
    MapPin,
    Play,
    CheckSquare,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

interface Vehicle {
    id: string;
    vehicle_name: string;
    license_plate: string;
    vehicle_type: string;
    make: string;
    model: string;
    year: number;
    color: string;
    registration_expiry: string;
    insurance_expiry: string;
    inspection_expiry: string;
    status: string;
    current_driver_id: string;
    current_driver?: {
        id: string;
        full_name: string;
        phone: string;
        email: string;
        staff_id: string;
        face_photo_url: string;
    };
    mileage: number;
    created_at: string;
}

interface Trip {
    id: string;
    trip_name: string;
    purpose: string;
    google_maps_link: string;
    status: string;
    scheduled_start_time: string;
    scheduled_end_time: string;
    actual_start_time: string;
    actual_end_time: string;
    driver_check_in_time: string;
    driver_check_out_time: string;
    security_check_in_time: string;
    security_check_out_time: string;
    start_location: string;
    end_location: string;
    distance_km: number;
    driver?: {
        full_name: string;
        phone: string;
    };
    vehicle?: {
        vehicle_name: string;
        license_plate: string;
    };
}

const VehicleManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [tripForm] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [trips, setTrips] = useState<Trip[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [tripModalVisible, setTripModalVisible] = useState(false);
    const [tripDetailModalVisible, setTripDetailModalVisible] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState('vehicles');
    const [stats, setStats] = useState({
        totalVehicles: 0,
        activeVehicles: 0,
        totalTrips: 0,
        activeTrips: 0,
        expiringDocs: 0
    });

    // Fix for CSP issue - bypass font loading
    useEffect(() => {
        // Add a fallback font style
        const style = document.createElement('style');
        style.textContent = `
            * {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 
                           'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 
                           'Helvetica Neue', sans-serif !important;
            }
        `;
        document.head.appendChild(style);

        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // Load vehicles
    const loadVehicles = useCallback(async () => {
        try {
            setLoading(true);

            // Get organization from local storage
            const organizationId = localStorage.getItem('organization_id');

            if (!organizationId) {
                // Try to get from user if not in local storage (fallback)
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('organization_id')
                        .eq('id', user.id)
                        .single();

                    if (userData?.organization_id) {
                        // found it
                    } else {
                        message.error('No organization found');
                        return;
                    }
                } else {
                    message.error('No organization found. Please register device.');
                    return;
                }
            }

            // Using the organizationId from local storage or fallback logic would be complex. 
            // Let's simplify: Prefer local storage, if not, try auth user.

            let targetOrgId = localStorage.getItem('organization_id');

            if (!targetOrgId) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('organization_id')
                        .eq('id', user.id)
                        .single();
                    targetOrgId = userData?.organization_id;
                }
            }

            if (!targetOrgId) {
                // message.error('Organization ID missing');
                // navigate('/'); 
                // If this page "shouldn't need login", maybe just show empty or return
                return;
            }

            console.log('Loading vehicles for org:', targetOrgId);

            const { data, error } = await supabase
                .from('vehicles')
                .select(`
                    *,
                    current_driver:users!vehicles_current_driver_id_fkey(
                        id,
                        full_name,
                        email,
                        phone,
                        staff_id,
                        face_photo_url,
                        user_role,
                        is_active
                    )
                `)
                .eq('organization_id', targetOrgId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading vehicles:', error);
                message.error('Failed to load vehicles');
                return;
            }

            console.log('Vehicles loaded:', data?.length);
            setVehicles(data as Vehicle[] || []);

            // Load stats
            const totalVehicles = data?.length || 0;
            const activeVehicles = data?.filter(v => v.status === 'active').length || 0;

            // Count expiring documents
            const today = dayjs();
            let expiringDocs = 0;
            data?.forEach(vehicle => {
                const expiries = [vehicle.registration_expiry, vehicle.insurance_expiry, vehicle.inspection_expiry];
                expiries.forEach(expiry => {
                    if (expiry) {
                        const daysUntilExpiry = dayjs(expiry).diff(today, 'day');
                        if (daysUntilExpiry >= 0 && daysUntilExpiry <= 30) {
                            expiringDocs++;
                        }
                    }
                });
            });

            // Load trips for stats
            const { data: tripsData } = await supabase
                .from('vehicle_trips')
                .select('status')
                .eq('organization_id', targetOrgId);

            const totalTrips = tripsData?.length || 0;
            const activeTrips = tripsData?.filter(t => t.status === 'in_progress').length || 0;

            setStats({
                totalVehicles,
                activeVehicles,
                totalTrips,
                activeTrips,
                expiringDocs
            });

            // Load drivers for dropdown
            const { data: usersData } = await supabase
                .from('users')
                .select('id, full_name, email, phone, user_role, is_active, staff_id, face_photo_url')
                .eq('organization_id', targetOrgId)
                .eq('is_active', true)
                .in('user_role', ['staff', 'admin', 'supervisor']);

            setDrivers(usersData || []);

        } catch (error: any) {
            console.error('Error loading data:', error);
            message.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, []);

    // Load trips
    const loadTrips = useCallback(async () => {
        try {
            // Get organization from local storage or auth
            let targetOrgId = localStorage.getItem('organization_id');

            if (!targetOrgId) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('organization_id')
                        .eq('id', user.id)
                        .single();
                    targetOrgId = userData?.organization_id;
                }
            }

            if (!targetOrgId) return;

            const { data, error } = await supabase
                .from('vehicle_trips')
                .select(`
                    *,
                    driver:users!vehicle_trips_driver_id_fkey(full_name, phone),
                    vehicle:vehicles!vehicle_trips_vehicle_id_fkey(vehicle_name, license_plate)
                `)
                .eq('organization_id', targetOrgId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading trips:', error);
                return;
            }

            setTrips(data as Trip[] || []);
        } catch (error) {
            console.error('Error loading trips:', error);
        }
    }, []);

    // Load all data on component mount
    useEffect(() => {
        loadVehicles();
        loadTrips();
    }, [loadVehicles, loadTrips]);

    // Handle vehicle operations
    const handleVehicleSubmit = async (values: any) => {
        try {
            setLoading(true);

            // Use device org/branch logic
            const organizationId = localStorage.getItem('organization_id');
            const branchId = localStorage.getItem('branch_id');

            // Get optional user text for auditing
            const { data: { user } } = await supabase.auth.getUser();

            if (!organizationId) {
                message.error('Organization info missing. Please register device.');
                return;
            }

            const vehicleData = {
                organization_id: organizationId,
                branch_id: branchId || null,
                vehicle_name: values.vehicle_name,
                license_plate: values.license_plate,
                vehicle_type: values.vehicle_type,
                make: values.make,
                model: values.model,
                year: values.year,
                color: values.color,
                vin: values.vin,
                registration_expiry: values.registration_expiry?.format('YYYY-MM-DD'),
                insurance_expiry: values.insurance_expiry?.format('YYYY-MM-DD'),
                inspection_expiry: values.inspection_expiry?.format('YYYY-MM-DD'),
                current_driver_id: values.current_driver_id || null,
                status: values.status || 'active',
                mileage: values.mileage || 0,
                created_by: user?.id || null,
                updated_by: user?.id || null
            };

            if (selectedVehicle) {
                // Update
                const { error } = await supabase
                    .from('vehicles')
                    .update(vehicleData)
                    .eq('id', selectedVehicle.id);

                if (error) throw error;
                message.success('Vehicle updated successfully');
            } else {
                // Create
                const { error } = await supabase
                    .from('vehicles')
                    .insert(vehicleData);

                if (error) throw error;
                message.success('Vehicle added successfully');
            }

            setModalVisible(false);
            setSelectedVehicle(null);
            form.resetFields();
            loadVehicles();
        } catch (error: any) {
            console.error('Error saving vehicle:', error);
            message.error(`Failed to save vehicle: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteVehicle = async (id: string) => {
        try {
            const { error } = await supabase
                .from('vehicles')
                .delete()
                .eq('id', id);

            if (error) throw error;
            message.success('Vehicle deleted successfully');
            loadVehicles();
        } catch (error: any) {
            console.error('Error deleting vehicle:', error);
            message.error('Failed to delete vehicle');
        }
    };

    // Handle trip operations
    const handleTripSubmit = async (values: any) => {
        try {
            setLoading(true);

            // Get authenticated user's organization
            // Use device org/branch logic
            const organizationId = localStorage.getItem('organization_id');
            const branchId = localStorage.getItem('branch_id');

            if (!organizationId) {
                message.error('Organization ID missing');
                return;
            }

            const tripData = {
                organization_id: organizationId,
                branch_id: branchId || null,
                vehicle_id: values.vehicle_id,
                driver_id: values.driver_id,
                trip_name: values.trip_name,
                purpose: values.purpose,
                google_maps_link: values.google_maps_link,
                scheduled_start_time: values.scheduled_start_time?.format('YYYY-MM-DD HH:mm:ss'),
                scheduled_end_time: values.scheduled_end_time?.format('YYYY-MM-DD HH:mm:ss'),
                status: 'scheduled',
                start_location: values.start_location,
                end_location: values.end_location,
                estimated_duration_minutes: values.estimated_duration_minutes
            };

            if (selectedTrip) {
                // Update trip
                const { error } = await supabase
                    .from('vehicle_trips')
                    .update(tripData)
                    .eq('id', selectedTrip.id);

                if (error) throw error;
                message.success('Trip updated successfully');
            } else {
                // Create new trip
                const { error } = await supabase
                    .from('vehicle_trips')
                    .insert(tripData);

                if (error) throw error;
                message.success('Trip created successfully');
            }

            setTripModalVisible(false);
            setSelectedTrip(null);
            tripForm.resetFields();
            loadTrips();
            loadVehicles();
        } catch (error: any) {
            console.error('Error saving trip:', error);
            message.error('Failed to save trip');
        } finally {
            setLoading(false);
        }
    };

    const handleTripAction = async (tripId: string, action: string) => {
        try {
            const updateData: any = {};
            const now = new Date().toISOString();

            switch (action) {
                case 'start':
                    updateData.status = 'in_progress';
                    updateData.actual_start_time = now;
                    updateData.driver_check_in_time = now;
                    break;
                case 'complete':
                    updateData.status = 'completed';
                    updateData.actual_end_time = now;
                    updateData.driver_check_out_time = now;
                    break;
                case 'cancel':
                    updateData.status = 'cancelled';
                    break;
            }

            const { error } = await supabase
                .from('vehicle_trips')
                .update(updateData)
                .eq('id', tripId);

            if (error) throw error;
            message.success(`Trip ${action} successfully`);
            loadTrips();
            loadVehicles();
        } catch (error: any) {
            console.error('Error updating trip:', error);
            message.error('Failed to update trip');
        }
    };



    const getTripStatusColor = (status: string) => {
        const colors: any = {
            scheduled: 'blue',
            in_progress: 'green',
            completed: 'green',
            cancelled: 'red'
        };
        return colors[status] || 'default';
    };

    // Vehicle columns
    const vehicleColumns = [
        {
            title: 'Vehicle',
            key: 'vehicle',
            render: (record: Vehicle) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar
                        size={40}
                        style={{
                            backgroundColor: record.status === 'active' ? '#52c41a20' : '#fa8c1620',
                            fontSize: 16
                        }}
                    >
                        {record.vehicle_type === 'car' ? '🚗' :
                            record.vehicle_type === 'truck' ? '🚚' :
                                record.vehicle_type === 'van' ? '🚐' : '🚌'}
                    </Avatar>
                    <div>
                        <Text strong style={{ display: 'block' }}>
                            {record.vehicle_name}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {record.license_plate} • {record.make} {record.model}
                        </Text>
                    </div>
                </div>
            ),
        },
        {
            title: 'Driver',
            key: 'driver',
            render: (record: Vehicle) => (
                record.current_driver ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar size={32} src={record.current_driver.face_photo_url}>
                            {record.current_driver.full_name?.charAt(0)}
                        </Avatar>
                        <div>
                            <Text strong style={{ fontSize: 13 }}>
                                {record.current_driver.full_name}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                {record.current_driver.phone}
                            </Text>
                        </div>
                    </div>
                ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>No driver</Text>
                )
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'active' ? 'green' : 'orange'}>
                    {status.toUpperCase()}
                </Tag>
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (record: Vehicle) => (
                <Space>
                    <Tooltip title="Schedule Trip">
                        <Button
                            type="text"
                            icon={<Calendar size={16} />}
                            onClick={() => {
                                setSelectedVehicle(record);
                                tripForm.setFieldsValue({
                                    vehicle_id: record.id,
                                    driver_id: record.current_driver_id
                                });
                                setTripModalVisible(true);
                            }}
                            size="small"
                        />
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button
                            type="text"
                            icon={<Edit size={16} />}
                            onClick={() => {
                                setSelectedVehicle(record);
                                form.setFieldsValue({
                                    ...record,
                                    registration_expiry: record.registration_expiry ? dayjs(record.registration_expiry) : null,
                                    insurance_expiry: record.insurance_expiry ? dayjs(record.insurance_expiry) : null,
                                    inspection_expiry: record.inspection_expiry ? dayjs(record.inspection_expiry) : null,
                                });
                                setModalVisible(true);
                            }}
                            size="small"
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Delete this vehicle?"
                        onConfirm={() => handleDeleteVehicle(record.id)}
                        okText="Delete"
                        cancelText="Cancel"
                    >
                        <Tooltip title="Delete">
                            <Button
                                type="text"
                                danger
                                icon={<Delete size={16} />}
                                size="small"
                            />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    // Trip columns
    const tripColumns = [
        {
            title: 'Trip Details',
            key: 'trip',
            render: (record: Trip) => (
                <div>
                    <Text strong style={{ display: 'block' }}>
                        {record.trip_name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {record.purpose}
                    </Text>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                        <Text>{record.vehicle?.vehicle_name} ({record.vehicle?.license_plate})</Text>
                    </div>
                </div>
            ),
        },
        {
            title: 'Status',
            key: 'status',
            render: (record: Trip) => (
                <Tag color={getTripStatusColor(record.status)}>
                    {record.status.replace('_', ' ').toUpperCase()}
                </Tag>
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (record: Trip) => (
                <Space>
                    {record.status === 'scheduled' && (
                        <Button
                            type="primary"
                            icon={<Play size={14} />}
                            onClick={() => handleTripAction(record.id, 'start')}
                            size="small"
                        >
                            Start
                        </Button>
                    )}
                    {record.status === 'in_progress' && (
                        <Button
                            type="primary"
                            icon={<CheckSquare size={14} />}
                            onClick={() => handleTripAction(record.id, 'complete')}
                            size="small"
                        >
                            Complete
                        </Button>
                    )}
                    <Button
                        type="text"
                        icon={<Eye size={14} />}
                        onClick={() => {
                            setSelectedTrip(record);
                            setTripDetailModalVisible(true);
                        }}
                        size="small"
                    />
                </Space>
            ),
        },
    ];

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', padding: 16 }}>
            {/* Header */}
            <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: 12,
                marginBottom: 24,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
            }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                        <Button
                            type="text"
                            icon={<ArrowLeft size={20} />}
                            onClick={() => navigate('/')}
                            style={{ color: '#666' }}
                        />
                        <div style={{ flex: 1 }}>
                            <Title level={3} style={{ margin: 0 }}>
                                Vehicle Management
                            </Title>
                            <Text type="secondary">
                                Track vehicles and schedule trips
                            </Text>
                        </div>
                    </Space>

                    {/* Stats */}
                    <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                        <Col xs={12} sm={4}>
                            <Card size="small">
                                <Statistic
                                    title="Total Vehicles"
                                    value={stats.totalVehicles}
                                    prefix={<Truck size={16} />}
                                    valueStyle={{ color: '#1890ff' }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={4}>
                            <Card size="small">
                                <Statistic
                                    title="Active Vehicles"
                                    value={stats.activeVehicles}
                                    valueStyle={{ color: '#52c41a' }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={4}>
                            <Card size="small">
                                <Statistic
                                    title="Total Trips"
                                    value={stats.totalTrips}
                                    prefix={<MapPin size={16} />}
                                    valueStyle={{ color: '#722ed1' }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={4}>
                            <Card size="small">
                                <Statistic
                                    title="Active Trips"
                                    value={stats.activeTrips}
                                    valueStyle={{ color: '#fa8c16' }}
                                />
                            </Card>
                        </Col>
                    </Row>
                </Space>
            </div>

            {/* Tabs and Actions */}
            <Card style={{ marginBottom: 24 }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    tabBarExtraContent={
                        <Space>
                            <Input
                                placeholder={`Search ${activeTab === 'vehicles' ? 'vehicles' : 'trips'}...`}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                prefix={<Search size={16} />}
                                style={{ width: 200 }}
                                allowClear
                            />
                            {activeTab === 'vehicles' ? (
                                <Button
                                    type="primary"
                                    icon={<Plus size={16} />}
                                    onClick={() => {
                                        setSelectedVehicle(null);
                                        form.resetFields();
                                        form.setFieldsValue({
                                            vehicle_type: 'car',
                                            status: 'active'
                                        });
                                        setModalVisible(true);
                                    }}
                                >
                                    Add Vehicle
                                </Button>
                            ) : (
                                <Button
                                    type="primary"
                                    icon={<Plus size={16} />}
                                    onClick={() => {
                                        setSelectedTrip(null);
                                        tripForm.resetFields();
                                        setTripModalVisible(true);
                                    }}
                                >
                                    Schedule Trip
                                </Button>
                            )}
                        </Space>
                    }
                >
                    <TabPane tab="Vehicles" key="vehicles">
                        {vehicles.length === 0 && !loading && (
                            <Alert
                                message="No Vehicles Found"
                                description="Add your first vehicle by clicking the 'Add Vehicle' button"
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                        )}
                        <Table
                            columns={vehicleColumns}
                            dataSource={vehicles.filter(v =>
                                !searchText ||
                                v.vehicle_name.toLowerCase().includes(searchText.toLowerCase()) ||
                                v.license_plate.toLowerCase().includes(searchText.toLowerCase()) ||
                                v.current_driver?.full_name?.toLowerCase().includes(searchText.toLowerCase())
                            )}
                            loading={loading}
                            rowKey="id"
                            pagination={{ pageSize: 10 }}
                        />
                    </TabPane>
                    <TabPane tab="Trips" key="trips">
                        {trips.length === 0 && !loading && (
                            <Alert
                                message="No Trips Found"
                                description="Schedule your first trip by clicking the 'Schedule Trip' button"
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                        )}
                        <Table
                            columns={tripColumns}
                            dataSource={trips.filter(t =>
                                !searchText ||
                                t.trip_name.toLowerCase().includes(searchText.toLowerCase()) ||
                                t.vehicle?.vehicle_name?.toLowerCase().includes(searchText.toLowerCase())
                            )}
                            loading={loading}
                            rowKey="id"
                            pagination={{ pageSize: 10 }}
                        />
                    </TabPane>
                </Tabs>
            </Card>

            {/* Add/Edit Vehicle Modal */}
            <Modal
                title={selectedVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
                open={modalVisible}
                onCancel={() => {
                    setModalVisible(false);
                    setSelectedVehicle(null);
                    form.resetFields();
                }}
                footer={null}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleVehicleSubmit}
                >
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Vehicle Name"
                                name="vehicle_name"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <Input placeholder="Company Van 1" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="License Plate"
                                name="license_plate"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <Input placeholder="ABC-123" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item
                                label="Vehicle Type"
                                name="vehicle_type"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <Select>
                                    <Option value="car">Car</Option>
                                    <Option value="truck">Truck</Option>
                                    <Option value="van">Van</Option>
                                    <Option value="bus">Bus</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                label="Make"
                                name="make"
                            >
                                <Input placeholder="Toyota" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                label="Model"
                                name="model"
                            >
                                <Input placeholder="Corolla" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item
                                label="Year"
                                name="year"
                            >
                                <InputNumber
                                    style={{ width: '100%' }}
                                    min={1900}
                                    max={new Date().getFullYear() + 1}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Color" name="color">
                                <Input placeholder="Blue" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                label="Status"
                                name="status"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <Select>
                                    <Option value="active">Active</Option>
                                    <Option value="maintenance">Maintenance</Option>
                                    <Option value="out_of_service">Out of Service</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider>Driver Assignment</Divider>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Driver"
                                name="current_driver_id"
                            >
                                <Select
                                    placeholder="Select driver"
                                    allowClear
                                >
                                    {drivers.map(driver => (
                                        <Option key={driver.id} value={driver.id}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Avatar size={24} src={driver.face_photo_url}>
                                                    {driver.full_name?.charAt(0)}
                                                </Avatar>
                                                <div>
                                                    <div>{driver.full_name}</div>
                                                    <div style={{ fontSize: 12, color: '#666' }}>
                                                        {driver.phone && `${driver.phone}`}
                                                        {driver.user_role && ` • ${driver.user_role}`}
                                                    </div>
                                                </div>
                                            </div>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Mileage"
                                name="mileage"
                            >
                                <InputNumber
                                    style={{ width: '100%' }}
                                    min={0}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                        <Space>
                            <Button
                                onClick={() => {
                                    setModalVisible(false);
                                    setSelectedVehicle(null);
                                    form.resetFields();
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                            >
                                {selectedVehicle ? 'Update' : 'Add'} Vehicle
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Add/Edit Trip Modal */}
            <Modal
                title={selectedTrip ? 'Edit Trip' : 'Schedule New Trip'}
                open={tripModalVisible}
                onCancel={() => {
                    setTripModalVisible(false);
                    setSelectedTrip(null);
                    tripForm.resetFields();
                }}
                footer={null}
                width={600}
            >
                <Form
                    form={tripForm}
                    layout="vertical"
                    onFinish={handleTripSubmit}
                >
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Vehicle"
                                name="vehicle_id"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <Select
                                    placeholder="Select vehicle"
                                    showSearch
                                >
                                    {vehicles.map(vehicle => (
                                        <Option key={vehicle.id} value={vehicle.id}>
                                            {vehicle.vehicle_name} ({vehicle.license_plate})
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Driver"
                                name="driver_id"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <Select
                                    placeholder="Select driver"
                                    showSearch
                                >
                                    {drivers.map(driver => (
                                        <Option key={driver.id} value={driver.id}>
                                            {driver.full_name} ({driver.phone})
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Trip Name"
                                name="trip_name"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <Input placeholder="e.g., Delivery to Client XYZ" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Purpose"
                                name="purpose"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <Input placeholder="e.g., Product delivery" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        label="Google Maps Link"
                        name="google_maps_link"
                    >
                        <Input
                            placeholder="https://www.google.com/maps/dir/..."
                        />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Start Location"
                                name="start_location"
                            >
                                <Input placeholder="Starting point" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="End Location"
                                name="end_location"
                            >
                                <Input placeholder="Destination" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                        <Space>
                            <Button
                                onClick={() => {
                                    setTripModalVisible(false);
                                    setSelectedTrip(null);
                                    tripForm.resetFields();
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                            >
                                {selectedTrip ? 'Update' : 'Schedule'} Trip
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Trip Detail Modal */}
            <Modal
                title="Trip Details"
                open={tripDetailModalVisible}
                onCancel={() => setTripDetailModalVisible(false)}
                width={600}
                footer={null}
            >
                {selectedTrip && (
                    <div>
                        <Descriptions column={1} bordered>
                            <Descriptions.Item label="Trip Name">
                                {selectedTrip.trip_name}
                            </Descriptions.Item>
                            <Descriptions.Item label="Purpose">
                                {selectedTrip.purpose}
                            </Descriptions.Item>
                            <Descriptions.Item label="Vehicle">
                                {selectedTrip.vehicle?.vehicle_name} ({selectedTrip.vehicle?.license_plate})
                            </Descriptions.Item>
                            <Descriptions.Item label="Driver">
                                {selectedTrip.driver?.full_name} ({selectedTrip.driver?.phone})
                            </Descriptions.Item>
                            <Descriptions.Item label="Status">
                                <Tag color={getTripStatusColor(selectedTrip.status)}>
                                    {selectedTrip.status.replace('_', ' ').toUpperCase()}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Start Location">
                                {selectedTrip.start_location || 'Not specified'}
                            </Descriptions.Item>
                            <Descriptions.Item label="End Location">
                                {selectedTrip.end_location || 'Not specified'}
                            </Descriptions.Item>
                        </Descriptions>

                        <div style={{ marginTop: 24, textAlign: 'right' }}>
                            <Space>
                                <Button onClick={() => setTripDetailModalVisible(false)}>
                                    Close
                                </Button>
                            </Space>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default VehicleManagementPage;