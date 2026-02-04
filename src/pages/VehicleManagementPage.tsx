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
    DatePicker,
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
    Popconfirm,
    Divider,
    Tooltip,
    Tabs,
    InputNumber,
    Descriptions,
    Alert,
    Spin
} from 'antd';
import {
    Truck,
    Calendar,
    AlertTriangle,
    Plus,
    ArrowLeft,
    Eye,
    Edit,
    Delete,
    Search,
    MapPin,
    ExternalLink,
    Play,
    Copy,
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
    const [allUsers, setAllUsers] = useState<any[]>([]);
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
    const [driverLoading, setDriverLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Get current authenticated user
    useEffect(() => {
        const getCurrentUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Get user details from users table
                const { data: userData } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                setCurrentUser(userData);
                
                // Store in localStorage for compatibility
                localStorage.setItem('user_id', user.id);
                if (userData?.organization_id) {
                    localStorage.setItem('organization_id', userData.organization_id);
                }
                if (userData?.branch_id) {
                    localStorage.setItem('branch_id', userData.branch_id);
                }
            }
        };
        getCurrentUser();
    }, []);

    // Load vehicles
    const loadVehicles = useCallback(async () => {
        try {
            setLoading(true);
            
            if (!currentUser?.organization_id) {
                console.error('No organization_id found for current user');
                message.error('User is not associated with an organization');
                return;
            }

            console.log('Loading vehicles for org:', currentUser.organization_id, 'branch:', currentUser.branch_id);

            let query = supabase
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
                .eq('organization_id', currentUser.organization_id);

            if (currentUser.branch_id) {
                query = query.eq('branch_id', currentUser.branch_id);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase error loading vehicles:', error);
                throw error;
            }

            console.log('Vehicles loaded:', data?.length);
            setVehicles(data as Vehicle[] || []);
        } catch (error: any) {
            console.error('Error loading vehicles:', error);
            message.error(`Failed to load vehicles: ${error.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    // Load trips
    const loadTrips = useCallback(async () => {
        try {
            if (!currentUser?.organization_id) {
                console.error('No organization_id found for current user');
                return;
            }
            
            console.log('Loading trips for org:', currentUser.organization_id);

            const { data, error } = await supabase
                .from('vehicle_trips')
                .select(`
                    *,
                    driver:users!vehicle_trips_driver_id_fkey(full_name, phone),
                    vehicle:vehicles!vehicle_trips_vehicle_id_fkey(vehicle_name, license_plate)
                `)
                .eq('organization_id', currentUser.organization_id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase error loading trips:', error);
                throw error;
            }

            console.log('Trips loaded:', data?.length);
            setTrips(data as Trip[] || []);
        } catch (error: any) {
            console.error('Error loading trips:', error);
            message.error(`Failed to load trips: ${error.message || 'Unknown error'}`);
        }
    }, [currentUser]);

    // Load all active users (for drivers dropdown)
    const loadAllUsers = useCallback(async () => {
        try {
            setDriverLoading(true);
            
            if (!currentUser?.organization_id) {
                console.error('No organization_id found for current user');
                return;
            }

            console.log('Loading users for org:', currentUser.organization_id, 'branch:', currentUser.branch_id);

            // First, let's check what users exist
            let query = supabase
                .from('users')
                .select('id, full_name, email, phone, user_role, is_active, staff_id, face_photo_url')
                .eq('organization_id', currentUser.organization_id)
                .eq('is_active', true);

            if (currentUser.branch_id) {
                query = query.eq('branch_id', currentUser.branch_id);
            }

            const { data, error } = await query.order('full_name', { ascending: true });

            if (error) {
                console.error('Supabase error loading users:', error);
                throw error;
            }

            console.log('All users loaded:', data?.length);
            console.log('User roles:', data?.map(u => ({ name: u.full_name, role: u.user_role })));

            setAllUsers(data || []);

            // Filter to only show users with staff, admin, or supervisor roles (potential drivers)
            const driverUsers = data?.filter(user =>
                user.user_role === 'staff' || 
                user.user_role === 'admin' || 
                user.user_role === 'supervisor'
            ) || [];

            console.log('Potential drivers (staff/admin/supervisor):', driverUsers.length);
            setDrivers(driverUsers);
        } catch (error: any) {
            console.error('Error loading users:', error);
            message.error(`Failed to load users: ${error.message || 'Unknown error'}`);
        } finally {
            setDriverLoading(false);
        }
    }, [currentUser]);

    // Load stats
    const loadStats = useCallback(async () => {
        try {
            if (!currentUser?.organization_id) {
                return;
            }
            
            const today = dayjs();

            // Vehicle stats
            const { data: vehiclesData, error: vehiclesError } = await supabase
                .from('vehicles')
                .select('status, registration_expiry, insurance_expiry, inspection_expiry')
                .eq('organization_id', currentUser.organization_id);

            if (vehiclesError) throw vehiclesError;

            const totalVehicles = vehiclesData?.length || 0;
            const activeVehicles = vehiclesData?.filter(v => v.status === 'active').length || 0;

            // Count expiring documents
            let expiringDocs = 0;
            vehiclesData?.forEach(vehicle => {
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

            // Trip stats
            const { data: tripsData, error: tripsError } = await supabase
                .from('vehicle_trips')
                .select('status')
                .eq('organization_id', currentUser.organization_id);

            if (tripsError) throw tripsError;

            const totalTrips = tripsData?.length || 0;
            const activeTrips = tripsData?.filter(t => t.status === 'in_progress').length || 0;

            setStats({
                totalVehicles,
                activeVehicles,
                totalTrips,
                activeTrips,
                expiringDocs
            });
        } catch (error: any) {
            console.error('Error loading stats:', error);
        }
    }, [currentUser]);

    // Load all data when currentUser is available
    useEffect(() => {
        if (currentUser?.organization_id) {
            loadVehicles();
            loadTrips();
            loadAllUsers();
            loadStats();
        }
    }, [currentUser, loadVehicles, loadTrips, loadAllUsers, loadStats]);

    // Handle vehicle operations
    const handleVehicleSubmit = async (values: any) => {
        try {
            setLoading(true);
            
            // Get authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                throw new Error('User not authenticated');
            }
            
            if (!currentUser?.organization_id) {
                throw new Error('User is not associated with an organization');
            }

            console.log('Submitting vehicle with data:', {
                organizationId: currentUser.organization_id,
                branchId: currentUser.branch_id,
                userId: user.id,
                values
            });

            const vehicleData = {
                organization_id: currentUser.organization_id,
                branch_id: currentUser.branch_id,
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
                created_by: user.id,
                updated_by: user.id
            };

            console.log('Vehicle data to save:', vehicleData);

            if (selectedVehicle) {
                // Update
                console.log('Updating vehicle:', selectedVehicle.id);
                const { error } = await supabase
                    .from('vehicles')
                    .update(vehicleData)
                    .eq('id', selectedVehicle.id);

                if (error) {
                    console.error('Supabase update error:', error);
                    throw error;
                }
                message.success('Vehicle updated successfully');
            } else {
                // Create
                console.log('Creating new vehicle');
                const { data, error } = await supabase
                    .from('vehicles')
                    .insert(vehicleData)
                    .select();

                if (error) {
                    console.error('Supabase insert error:', error);
                    throw error;
                }
                console.log('Vehicle created:', data);
                message.success('Vehicle added successfully');
            }

            setModalVisible(false);
            setSelectedVehicle(null);
            form.resetFields();
            loadVehicles();
            loadStats();
        } catch (error: any) {
            console.error('Error saving vehicle:', error);
            message.error(`Failed to save vehicle: ${error.message || 'Check RLS policies'}`);
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
            loadStats();
        } catch (error: any) {
            console.error('Error deleting vehicle:', error);
            message.error('Failed to delete vehicle');
        }
    };

    // Handle trip operations
    const handleTripSubmit = async (values: any) => {
        try {
            setLoading(true);
            
            if (!currentUser?.organization_id) {
                throw new Error('User is not associated with an organization');
            }

            const tripData = {
                organization_id: currentUser.organization_id,
                branch_id: currentUser.branch_id,
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
            loadStats();
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
                case 'security_check_in':
                    updateData.security_check_in_time = now;
                    break;
                case 'security_check_out':
                    updateData.security_check_out_time = now;
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
            message.success(`Trip ${action.replace('_', ' ')} successfully`);
            loadTrips();
            loadStats();
        } catch (error: any) {
            console.error('Error updating trip:', error);
            message.error('Failed to update trip');
        }
    };

    const copyGoogleMapsLink = (link: string) => {
        navigator.clipboard.writeText(link);
        message.success('Google Maps link copied to clipboard');
    };

    const getExpiryStatus = (expiryDate: string) => {
        if (!expiryDate) return { color: 'default', text: 'Not set' };

        const today = dayjs();
        const expiry = dayjs(expiryDate);
        const daysUntilExpiry = expiry.diff(today, 'day');

        if (daysUntilExpiry < 0) return { color: 'red', text: 'Expired' };
        if (daysUntilExpiry <= 7) return { color: 'orange', text: 'Expiring Soon' };
        if (daysUntilExpiry <= 30) return { color: 'blue', text: 'Expiring' };
        return { color: 'green', text: 'Valid' };
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
            title: 'Documents',
            key: 'documents',
            render: (record: Vehicle) => (
                <div style={{ display: 'flex', gap: 4 }}>
                    {['registration', 'insurance', 'inspection'].map((doc) => {
                        const expiry = record[`${doc}_expiry` as keyof Vehicle] as string;
                        const status = getExpiryStatus(expiry);
                        return (
                            <Tooltip key={doc} title={`${doc}: ${expiry ? dayjs(expiry).format('MMM D, YYYY') : 'Not set'}`}>
                                <Badge
                                    status={
                                        status.color === 'red' ? 'error' :
                                            status.color === 'orange' ? 'warning' :
                                                status.color === 'blue' ? 'processing' : 'success'
                                    }
                                />
                            </Tooltip>
                        );
                    })}
                </div>
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
            title: 'Driver',
            key: 'driver',
            render: (record: Trip) => (
                <div>
                    <Text strong style={{ fontSize: 13 }}>
                        {record.driver?.full_name || 'No driver assigned'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        {record.driver?.phone || ''}
                    </Text>
                </div>
            ),
        },
        {
            title: 'Google Maps',
            key: 'maps',
            render: (record: Trip) => (
                record.google_maps_link ? (
                    <Space>
                        <Button
                            type="link"
                            href={record.google_maps_link}
                            target="_blank"
                            icon={<ExternalLink size={14} />}
                            size="small"
                        >
                            Open
                        </Button>
                        <Button
                            type="text"
                            icon={<Copy size={14} />}
                            onClick={() => copyGoogleMapsLink(record.google_maps_link)}
                            size="small"
                        />
                    </Space>
                ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>No link</Text>
                )
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

    // Show loading if user data not yet loaded
    if (!currentUser) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
                <Text style={{ marginLeft: 16 }}>Loading user data...</Text>
            </div>
        );
    }

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
                                Vehicle & Trip Management
                            </Title>
                            <Text type="secondary">
                                Track vehicles, schedule trips, and monitor Google Maps links
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
                        <Col xs={12} sm={4}>
                            <Card size="small">
                                <Statistic
                                    title="Expiring Docs"
                                    value={stats.expiringDocs}
                                    prefix={<AlertTriangle size={16} />}
                                    valueStyle={{ color: '#ff4d4f' }}
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
                        {!currentUser?.organization_id && (
                            <Alert
                                message="No Organization"
                                description="You are not associated with an organization. Please contact your administrator."
                                type="warning"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                        )}
                        {vehicles.length === 0 && !loading && currentUser?.organization_id && (
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
                                t.vehicle?.vehicle_name?.toLowerCase().includes(searchText.toLowerCase()) ||
                                t.driver?.full_name?.toLowerCase().includes(searchText.toLowerCase())
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
                width={700}
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
                                <Input placeholder="Company Van 1" size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="License Plate"
                                name="license_plate"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <Input placeholder="ABC-123" size="large" />
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
                                <Select size="large">
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
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <Input placeholder="Toyota" size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                label="Model"
                                name="model"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <Input placeholder="Corolla" size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item
                                label="Year"
                                name="year"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <InputNumber
                                    style={{ width: '100%' }}
                                    min={1900}
                                    max={new Date().getFullYear() + 1}
                                    size="large"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Color" name="color">
                                <Input placeholder="Blue" size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="VIN" name="vin">
                                <Input placeholder="Vehicle Identification Number" size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider>Document Expiry</Divider>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item
                                label="Registration Expiry"
                                name="registration_expiry"
                            >
                                <DatePicker style={{ width: '100%' }} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                label="Insurance Expiry"
                                name="insurance_expiry"
                            >
                                <DatePicker style={{ width: '100%' }} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                label="Inspection Expiry"
                                name="inspection_expiry"
                            >
                                <DatePicker style={{ width: '100%' }} size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider>Driver & Status</Divider>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Driver"
                                name="current_driver_id"
                                extra={driverLoading ? "Loading users..." : `${drivers.length} users available`}
                            >
                                <Select
                                    placeholder={driverLoading ? "Loading users..." : "Select driver"}
                                    size="large"
                                    allowClear
                                    loading={driverLoading}
                                    notFoundContent={
                                        driverLoading ? (
                                            <div style={{ padding: 16, textAlign: 'center' }}>
                                                <Spin size="small" />
                                                <div style={{ marginTop: 8 }}>Loading users...</div>
                                            </div>
                                        ) : (
                                            <div style={{ padding: 16, textAlign: 'center' }}>
                                                <Text type="secondary">No users found</Text>
                                                <div style={{ marginTop: 8 }}>
                                                    <Button
                                                        type="link"
                                                        size="small"
                                                        onClick={() => navigate('/users')}
                                                    >
                                                        Go to User Management
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    }
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
                                                        {driver.staff_id && `ID: ${driver.staff_id}`}
                                                        {driver.phone && ` • ${driver.phone}`}
                                                        {driver.user_role && ` • ${driver.user_role}`}
                                                    </div>
                                                </div>
                                            </div>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item
                                label="Mileage"
                                name="mileage"
                            >
                                <InputNumber
                                    style={{ width: '100%' }}
                                    min={0}
                                    size="large"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item
                                label="Status"
                                name="status"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <Select size="large">
                                    <Option value="active">Active</Option>
                                    <Option value="maintenance">Maintenance</Option>
                                    <Option value="out_of_service">Out of Service</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    {allUsers.length === 0 && (
                        <Alert
                            message="No Users Available"
                            description="You need to add users first before assigning drivers. Go to User Management to add users."
                            type="warning"
                            showIcon
                            style={{ marginBottom: 16 }}
                            action={
                                <Button
                                    type="link"
                                    size="small"
                                    onClick={() => navigate('/users')}
                                >
                                    Go to Users
                                </Button>
                            }
                        />
                    )}

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                        <Space>
                            <Button
                                onClick={() => {
                                    setModalVisible(false);
                                    setSelectedVehicle(null);
                                    form.resetFields();
                                }}
                                size="large"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                size="large"
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
                width={700}
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
                                    size="large"
                                    showSearch
                                    loading={vehicles.length === 0 && loading}
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
                                    size="large"
                                    showSearch
                                    loading={driverLoading}
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
                                <Input placeholder="e.g., Delivery to Client XYZ" size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Purpose"
                                name="purpose"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <Input placeholder="e.g., Product delivery" size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        label="Google Maps Link"
                        name="google_maps_link"
                        extra="Driver will share their Google Maps trip link"
                    >
                        <Input
                            placeholder="https://www.google.com/maps/dir/..."
                            size="large"
                        />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Start Location"
                                name="start_location"
                            >
                                <Input placeholder="Starting point" size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="End Location"
                                name="end_location"
                            >
                                <Input placeholder="Destination" size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Scheduled Start Time"
                                name="scheduled_start_time"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <DatePicker
                                    showTime
                                    style={{ width: '100%' }}
                                    size="large"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Scheduled End Time"
                                name="scheduled_end_time"
                            >
                                <DatePicker
                                    showTime
                                    style={{ width: '100%' }}
                                    size="large"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        label="Estimated Duration (minutes)"
                        name="estimated_duration_minutes"
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            min={1}
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                        <Space>
                            <Button
                                onClick={() => {
                                    setTripModalVisible(false);
                                    setSelectedTrip(null);
                                    tripForm.resetFields();
                                }}
                                size="large"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                size="large"
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
                            <Descriptions.Item label="Google Maps Link">
                                {selectedTrip.google_maps_link ? (
                                    <Space>
                                        <Button
                                            type="link"
                                            href={selectedTrip.google_maps_link}
                                            target="_blank"
                                            icon={<ExternalLink size={14} />}
                                        >
                                            Open in Maps
                                        </Button>
                                        <Button
                                            type="text"
                                            icon={<Copy size={14} />}
                                            onClick={() => copyGoogleMapsLink(selectedTrip.google_maps_link)}
                                        >
                                            Copy Link
                                        </Button>
                                    </Space>
                                ) : (
                                    <Text type="secondary">No link provided</Text>
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Start Location">
                                {selectedTrip.start_location || 'Not specified'}
                            </Descriptions.Item>
                            <Descriptions.Item label="End Location">
                                {selectedTrip.end_location || 'Not specified'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Distance">
                                {selectedTrip.distance_km ? `${selectedTrip.distance_km} km` : 'Not recorded'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Driver Check-in">
                                {selectedTrip.driver_check_in_time ?
                                    dayjs(selectedTrip.driver_check_in_time).format('MMM D, YYYY HH:mm') :
                                    'Not checked in'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Driver Check-out">
                                {selectedTrip.driver_check_out_time ?
                                    dayjs(selectedTrip.driver_check_out_time).format('MMM D, YYYY HH:mm') :
                                    'Not checked out'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Security Check-in">
                                {selectedTrip.security_check_in_time ?
                                    dayjs(selectedTrip.security_check_in_time).format('MMM D, YYYY HH:mm') :
                                    'Not checked'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Security Check-out">
                                {selectedTrip.security_check_out_time ?
                                    dayjs(selectedTrip.security_check_out_time).format('MMM D, YYYY HH:mm') :
                                    'Not checked'}
                            </Descriptions.Item>
                        </Descriptions>

                        <div style={{ marginTop: 24, textAlign: 'right' }}>
                            <Space>
                                {!selectedTrip.security_check_in_time && (
                                    <Button
                                        type="primary"
                                        icon={<CheckSquare size={16} />}
                                        onClick={() => handleTripAction(selectedTrip.id, 'security_check_in')}
                                    >
                                        Security Check-in
                                    </Button>
                                )}
                                {selectedTrip.security_check_in_time && !selectedTrip.security_check_out_time && (
                                    <Button
                                        type="primary"
                                        icon={<CheckSquare size={16} />}
                                        onClick={() => handleTripAction(selectedTrip.id, 'security_check_out')}
                                    >
                                        Security Check-out
                                    </Button>
                                )}
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