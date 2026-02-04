// pages/DriverTripPage.tsx
import React, { useState, useEffect } from 'react';
import {
    Card,
    Button,
    Form,
    Input,
    message,
    Typography,
    Row,
    Col,
    Statistic,
    Avatar,
    Tag,
    Space,
    Divider,
    List,
    Alert,
    Modal,
} from 'antd';
import {
    MapPin,
    Truck,
    ExternalLink,
    Copy,
    Send,
    AlertCircle,
    Play,
    StopCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const DriverTripPage: React.FC = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [driver, setDriver] = useState<any>(null);
    const [assignedVehicle, setAssignedVehicle] = useState<any>(null);
    const [activeTrip, setActiveTrip] = useState<any>(null);
    const [pastTrips, setPastTrips] = useState<any[]>([]);
    const [linkModalVisible, setLinkModalVisible] = useState(false);

    useEffect(() => {
        loadDriverData();
    }, []);

    const loadDriverData = async () => {
        try {
            const userId = localStorage.getItem('user_id');
            
            // Load driver info
            const { data: driverData } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            setDriver(driverData);

            // Load assigned vehicle
            const { data: vehicleData } = await supabase
                .from('vehicles')
                .select('*')
                .eq('current_driver_id', userId)
                .eq('status', 'active')
                .single();

            setAssignedVehicle(vehicleData || null);

            // Load trips
            const { data: tripsData } = await supabase
                .from('vehicle_trips')
                .select(`
                    *,
                    vehicle:vehicles!vehicle_trips_vehicle_id_fkey(vehicle_name, license_plate)
                `)
                .eq('driver_id', userId)
                .order('created_at', { ascending: false });

            if (tripsData) {
                const active = tripsData.find(t => t.status === 'in_progress');
                const past = tripsData.filter(t => t.status !== 'in_progress').slice(0, 5);
                setActiveTrip(active || null);
                setPastTrips(past);
            }
        } catch (error) {
            console.error('Error loading driver data:', error);
        }
    };

    const handleStartTrip = async () => {
        try {
            setLoading(true);
            const userId = localStorage.getItem('user_id');
            
            // Create a new trip
            const { data: trip, error } = await supabase
                .from('vehicle_trips')
                .insert({
                    vehicle_id: assignedVehicle.id,
                    driver_id: userId,
                    organization_id: localStorage.getItem('organization_id'),
                    trip_name: `Trip ${dayjs().format('MMM D, YYYY')}`,
                    purpose: 'Daily trip',
                    status: 'in_progress',
                    actual_start_time: new Date().toISOString(),
                    driver_check_in_time: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            setActiveTrip(trip);
            message.success('Trip started! Share your Google Maps link when ready.');
        } catch (error: any) {
            console.error('Error starting trip:', error);
            message.error('Failed to start trip');
        } finally {
            setLoading(false);
        }
    };

    const handleShareLink = async (values: any) => {
        try {
            setLoading(true);
            
            const { error } = await supabase
                .from('vehicle_trips')
                .update({
                    google_maps_link: values.google_maps_link,
                    notes: values.notes,
                    start_location: values.start_location,
                    end_location: values.end_location
                })
                .eq('id', activeTrip.id);

            if (error) throw error;
            
            message.success('Trip link shared successfully!');
            setLinkModalVisible(false);
            form.resetFields();
            loadDriverData();
        } catch (error: any) {
            console.error('Error sharing link:', error);
            message.error('Failed to share link');
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteTrip = async () => {
        try {
            setLoading(true);
            
            const { error } = await supabase
                .from('vehicle_trips')
                .update({
                    status: 'completed',
                    actual_end_time: new Date().toISOString(),
                    driver_check_out_time: new Date().toISOString()
                })
                .eq('id', activeTrip.id);

            if (error) throw error;
            
            message.success('Trip completed successfully!');
            setActiveTrip(null);
            loadDriverData();
        } catch (error: any) {
            console.error('Error completing trip:', error);
            message.error('Failed to complete trip');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        message.success('Copied to clipboard!');
    };

    const getGoogleMapsShareInstructions = () => {
        return `How to share Google Maps trip:
        1. Open Google Maps on your phone
        2. Search for your destination
        3. Tap "Directions"
        4. Choose your starting point
        5. Tap the three dots menu (⋮)
        6. Select "Share trip" or "Share directions"
        7. Copy the link
        8. Paste it in the form above`;
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', padding: 16 }}>
            {/* Header */}
            <Card style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]} align="middle">
                    <Col>
                        <Avatar
                            size={64}
                            src={driver?.face_photo_url}
                            style={{ backgroundColor: '#1890ff' }}
                        >
                            {driver?.full_name?.charAt(0)}
                        </Avatar>
                    </Col>
                    <Col flex={1}>
                        <Title level={4} style={{ margin: 0 }}>
                            {driver?.full_name}
                        </Title>
                        <Text type="secondary">
                            Driver ID: {driver?.staff_id} • {driver?.phone}
                        </Text>
                    </Col>
                    <Col>
                        <Statistic
                            title="Today's Trips"
                            value={pastTrips.filter(t => 
                                dayjs(t.created_at).isSame(dayjs(), 'day')
                            ).length}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Col>
                </Row>
            </Card>

            {/* Assigned Vehicle */}
            {assignedVehicle && (
                <Card style={{ marginBottom: 24 }}>
                    <Title level={5} style={{ marginBottom: 16 }}>
                        <Truck size={18} style={{ marginRight: 8 }} />
                        Assigned Vehicle
                    </Title>
                    <Row gutter={[16, 16]}>
                        <Col span={12}>
                            <div style={{ 
                                background: '#f0f7ff', 
                                padding: 16, 
                                borderRadius: 8 
                            }}>
                                <Text strong style={{ fontSize: 18, display: 'block' }}>
                                    {assignedVehicle.vehicle_name}
                                </Text>
                                <Tag color="blue" style={{ marginTop: 8 }}>
                                    {assignedVehicle.license_plate}
                                </Tag>
                                <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                                    {assignedVehicle.make} {assignedVehicle.model} ({assignedVehicle.year})
                                </Text>
                            </div>
                        </Col>
                        <Col span={12}>
                            <div style={{ 
                                background: '#f6ffed', 
                                padding: 16, 
                                borderRadius: 8 
                            }}>
                                <Text strong>Mileage:</Text>
                                <Text style={{ fontSize: 24, display: 'block', marginTop: 4 }}>
                                    {assignedVehicle.mileage?.toLocaleString()} km
                                </Text>
                                <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                                    Color: {assignedVehicle.color}
                                </Text>
                            </div>
                        </Col>
                    </Row>
                </Card>
            )}

            {/* Active Trip Section */}
            {activeTrip ? (
                <Card 
                    style={{ marginBottom: 24 }}
                    title={
                        <Space>
                            <MapPin size={20} />
                            <Text strong>Active Trip</Text>
                            <Tag color="green">IN PROGRESS</Tag>
                        </Space>
                    }
                >
                    <Row gutter={[16, 16]}>
                        <Col span={24}>
                            <Alert
                                message="Trip is Active"
                                description="Please share your Google Maps link so security can track your trip."
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                        </Col>
                        
                        {activeTrip.google_maps_link ? (
                            <Col span={24}>
                                <div style={{ 
                                    background: '#e6f7ff', 
                                    padding: 16, 
                                    borderRadius: 8 
                                }}>
                                    <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                        Shared Google Maps Link:
                                    </Text>
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between',
                                        background: 'white',
                                        padding: '8px 12px',
                                        borderRadius: 4,
                                        border: '1px solid #d9d9d9'
                                    }}>
                                        <Text style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {activeTrip.google_maps_link}
                                        </Text>
                                        <Space>
                                            <Button
                                                type="link"
                                                href={activeTrip.google_maps_link}
                                                target="_blank"
                                                icon={<ExternalLink size={14} />}
                                            >
                                                Open
                                            </Button>
                                            <Button
                                                type="text"
                                                icon={<Copy size={14} />}
                                                onClick={() => copyToClipboard(activeTrip.google_maps_link)}
                                            >
                                                Copy
                                            </Button>
                                        </Space>
                                    </div>
                                    <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                                        Link shared at: {dayjs().format('HH:mm')}
                                    </Text>
                                </div>
                            </Col>
                        ) : (
                            <Col span={24}>
                                <div style={{ textAlign: 'center', padding: 24 }}>
                                    <AlertCircle size={48} color="#fa8c16" style={{ marginBottom: 16 }} />
                                    <Title level={5} style={{ marginBottom: 8 }}>
                                        Share Your Trip Link
                                    </Title>
                                    <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                                        Security needs your Google Maps link to track your trip
                                    </Text>
                                    <Button
                                        type="primary"
                                        size="large"
                                        icon={<Send size={16} />}
                                        onClick={() => setLinkModalVisible(true)}
                                    >
                                        Share Google Maps Link
                                    </Button>
                                </div>
                            </Col>
                        )}

                        <Col span={24}>
                            <Divider />
                            <div style={{ textAlign: 'center' }}>
                                <Button
                                    type="primary"
                                    danger
                                    size="large"
                                    icon={<StopCircle size={20} />}
                                    onClick={handleCompleteTrip}
                                    loading={loading}
                                    style={{ minWidth: 200 }}
                                >
                                    Complete Trip
                                </Button>
                            </div>
                        </Col>
                    </Row>
                </Card>
            ) : (
                <Card style={{ marginBottom: 24 }}>
                    <div style={{ textAlign: 'center', padding: 32 }}>
                        <MapPin size={64} color="#1890ff" style={{ marginBottom: 16 }} />
                        <Title level={4} style={{ marginBottom: 8 }}>
                            No Active Trip
                        </Title>
                        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                            Start a new trip when you're ready to drive
                        </Text>
                        <Button
                            type="primary"
                            size="large"
                            icon={<Play size={20} />}
                            onClick={handleStartTrip}
                            loading={loading}
                            disabled={!assignedVehicle}
                            style={{ minWidth: 200 }}
                        >
                            Start New Trip
                        </Button>
                        {!assignedVehicle && (
                            <Alert
                                message="No Vehicle Assigned"
                                description="You need to be assigned a vehicle before starting a trip"
                                type="warning"
                                showIcon
                                style={{ marginTop: 16, textAlign: 'left' }}
                            />
                        )}
                    </div>
                </Card>
            )}

            {/* Past Trips */}
            <Card title={<Title level={5}>Recent Trips</Title>}>
                {pastTrips.length > 0 ? (
                    <List
                        dataSource={pastTrips}
                        renderItem={(trip) => (
                            <List.Item>
                                <List.Item.Meta
                                    avatar={
                                        <Avatar
                                            size={40}
                                            style={{ 
                                                backgroundColor: trip.status === 'completed' ? '#52c41a' : '#fa8c16'
                                            }}
                                        >
                                            <MapPin size={20} />
                                        </Avatar>
                                    }
                                    title={
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Text strong>{trip.trip_name}</Text>
                                            <Tag color={trip.status === 'completed' ? 'green' : 'red'}>
                                                {trip.status.toUpperCase()}
                                            </Tag>
                                        </div>
                                    }
                                    description={
                                        <div>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {dayjs(trip.created_at).format('MMM D, YYYY HH:mm')}
                                            </Text>
                                            {trip.google_maps_link && (
                                                <div style={{ marginTop: 4 }}>
                                                    <Button
                                                        type="link"
                                                        href={trip.google_maps_link}
                                                        target="_blank"
                                                        size="small"
                                                        icon={<ExternalLink size={12} />}
                                                    >
                                                        View Trip
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                ) : (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <Text type="secondary">No past trips found</Text>
                    </div>
                )}
            </Card>

            {/* Share Link Modal */}
            <Modal
                title="Share Google Maps Trip Link"
                open={linkModalVisible}
                onCancel={() => setLinkModalVisible(false)}
                width={600}
                footer={null}
            >
                <Alert
                    message="Instructions"
                    description={getGoogleMapsShareInstructions()}
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleShareLink}
                >
                    <Form.Item
                        label="Google Maps Link"
                        name="google_maps_link"
                        rules={[
                            { required: true, message: 'Please paste your Google Maps link' },
                            { type: 'url', message: 'Please enter a valid URL' }
                        ]}
                        extra="Paste the link from Google Maps"
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

                    <Form.Item
                        label="Notes"
                        name="notes"
                    >
                        <TextArea 
                            rows={3}
                            placeholder="Any additional notes about the trip..."
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                        <Space>
                            <Button onClick={() => setLinkModalVisible(false)} size="large">
                                Cancel
                            </Button>
                            <Button type="primary" htmlType="submit" loading={loading} size="large">
                                Share Link
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default DriverTripPage;