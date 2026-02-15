import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card,
    Row,
    Col,
    Typography,
    Button,
    Input,
    Space,
    message,
    Modal,
    Result,
    Spin,
    Tabs,
    Tag
} from 'antd';
import {
    Camera,
    QrCode,
    Hash,
    ArrowLeft,
    Calendar,
    MapPin
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { eventService, Event } from '../services/eventService';
import FaceCamera from '../components/FaceCamera';
import faceService from '../utils/faceService';
import { userService } from '../services/userService';
import { speak } from '../utils/speechSynthesis';

const { Title, Text } = Typography;

const EventCheckInPage: React.FC = () => {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [event, setEvent] = useState<Event | null>(null);
    const [activeTab, setActiveTab] = useState<'face' | 'qr' | 'pin'>('face');
    const [processing, setProcessing] = useState(false);
    const [pinCode, setPinCode] = useState('');

    // Result State
    const [showResult, setShowResult] = useState(false);
    const [result, setResult] = useState<{
        success: boolean;
        userName?: string;
        message?: string;
    } | null>(null);

    useEffect(() => {
        const fetchEvent = async () => {
            if (!eventId) return;
            const { data, error } = await eventService.getEventById(eventId);
            if (error || !data) {
                message.error('Event not found');
                navigate('/events');
                return;
            }
            setEvent(data);
            setLoading(false);

            // Initialize face models
            await faceService.initializeModels();
        };
        fetchEvent();
    }, [eventId, navigate]);

    const handleCheckInSuccess = (userName: string) => {
        setResult({
            success: true,
            userName,
            message: `Check-in successful for ${userName}`
        });
        setShowResult(true);
        speak(`Welcome ${userName.split(' ')[0]}, check-in successful`);

        // Auto close after 3 seconds
        setTimeout(() => setShowResult(false), 3000);
    };

    const handleCheckInError = (errMessage: string) => {
        setResult({
            success: false,
            message: errMessage
        });
        setShowResult(true);
        speak(`Error, ${errMessage}`);

        // Auto close after 5 seconds for errors
        setTimeout(() => setShowResult(false), 5000);
    };

    const checkInUser = async (registrationId: string, userName: string) => {
        const { error } = await (supabase
            .from('event_registrations' as any)
            .update({
                status: 'checked_in',
                updated_at: new Date().toISOString()
            } as any)
            .eq('id', registrationId) as any);

        if (error) throw error;
        handleCheckInSuccess(userName);
    };

    const handleFaceCapture = async (capturedData: any) => {
        if (processing || !event || !capturedData?.photoData?.base64) return;
        setProcessing(true);

        try {
            const photoData = capturedData.photoData.base64;
            const faceResult = await faceService.processImage(photoData);
            if (!faceResult.success || !faceResult.embedding) {
                throw new Error('Face not detected');
            }

            // Find matching user in organization
            const matchedUser = await userService.findByFaceEmbedding(
                Array.from(faceResult.embedding),
                event.organization_id,
                0.65
            );

            if (!matchedUser) {
                throw new Error('Identity not recognized. Are you registered?');
            }

            // Check if registered for THIS event
            const { data: registration, error: regError } = await (supabase
                .from('event_registrations' as any)
                .select('id, status')
                .eq('event_id', event.id)
                .eq('user_id', matchedUser.id)
                .maybeSingle() as any);

            if (regError) throw regError;
            if (!registration) {
                throw new Error(`${matchedUser.full_name} is not registered for this event.`);
            }

            if (registration.status === 'checked_in') {
                handleCheckInSuccess(matchedUser.full_name);
                message.info('Already checked in.');
                return;
            }

            await checkInUser(registration.id, matchedUser.full_name);

        } catch (error: any) {
            handleCheckInError(error.message || 'Face check-in failed');
        } finally {
            setProcessing(false);
        }
    };

    const handlePinCheckIn = async () => {
        if (processing || !event || !pinCode) return;
        setProcessing(true);

        try {
            // Find user by PIN in organization
            const { data: user, error: userError } = await (supabase
                .from('users' as any)
                .select('id, full_name')
                .eq('organization_id', event.organization_id)
                .eq('pin', pinCode)
                .maybeSingle() as any);

            if (userError) throw userError;
            if (!user) throw new Error('Invalid PIN. Please check and try again.');

            // Check registration
            const { data: registration, error: regError } = await (supabase
                .from('event_registrations' as any)
                .select('id, status')
                .eq('event_id', event.id)
                .eq('user_id', user.id)
                .maybeSingle() as any);

            if (regError) throw regError;
            if (!registration) throw new Error(`${user.full_name} is not registered for this event.`);

            if (registration.status === 'checked_in') {
                handleCheckInSuccess(user.full_name);
                message.info('Already checked in.');
                return;
            }

            await checkInUser(registration.id, user.full_name);
            setPinCode('');

        } catch (error: any) {
            handleCheckInError(error.message || 'PIN check-in failed');
        } finally {
            setProcessing(false);
        }
    };

    const handleQRDetected = async (qrData: string) => {
        if (processing || !event || !qrData) return;
        setProcessing(true);
        try {
            // Find user by QR (could be qr_code or staff_id) in organization
            const { data: user, error: userError } = await (supabase
                .from('users' as any)
                .select('id, full_name')
                .eq('organization_id', event.organization_id)
                .or(`qr_code.eq.${qrData},staff_id.eq.${qrData}`)
                .maybeSingle() as any);

            if (userError) throw userError;
            if (!user) throw new Error('User not recognized or not registered.');

            // Check registration
            const { data: registration, error: regError } = await (supabase
                .from('event_registrations' as any)
                .select('id, status')
                .eq('event_id', event.id)
                .eq('user_id', user.id)
                .maybeSingle() as any);

            if (regError) throw regError;
            if (!registration) throw new Error(`${user.full_name} is not registered for this event.`);

            if (registration.status === 'checked_in') {
                handleCheckInSuccess(user.full_name);
                message.info('Already checked in.');
                return;
            }

            await checkInUser(registration.id, user.full_name);
        } catch (err: any) {
            handleCheckInError(err.message);
        } finally {
            setProcessing(false);
        }
    };

    if (loading || !event) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" tip="Loading Event..." />
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
            <Button
                icon={<ArrowLeft size={16} />}
                onClick={() => navigate('/events')}
                style={{ marginBottom: 16 }}
            >
                Back to Events
            </Button>

            <Card style={{ marginBottom: 24, borderRadius: 12 }}>
                <Row gutter={16} align="middle">
                    <Col xs={24} sm={16}>
                        <Title level={3} style={{ margin: 0 }}>{event.name}</Title>
                        <Space direction="vertical" style={{ marginTop: 8 }}>
                            <Text type="secondary"><Calendar size={14} style={{ marginRight: 4 }} /> {new Date(event.start_date).toLocaleDateString()}</Text>
                            {event.location && <Text type="secondary"><MapPin size={14} style={{ marginRight: 4 }} /> {event.location}</Text>}
                        </Space>
                    </Col>
                    <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
                        <Tag color="blue" style={{ fontSize: '14px', padding: '4px 12px' }}>Event Check-in</Tag>
                    </Col>
                </Row>
            </Card>

            <Card style={{ borderRadius: 12, overflow: 'hidden' }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={(k) => setActiveTab(k as any)}
                    centered
                    items={[
                        {
                            key: 'face',
                            label: <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Camera size={18} /> Face ID</span>,
                            children: (
                                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                    <div style={{ maxWidth: 500, margin: '0 auto' }}>
                                        <FaceCamera
                                            mode="attendance"
                                            onAttendanceComplete={handleFaceCapture}
                                            loading={processing}
                                        />
                                    </div>
                                    <div style={{ marginTop: 16 }}>
                                        <Text type="secondary">Position your face within the frame to check in automatically.</Text>
                                    </div>
                                </div>
                            )
                        },
                        {
                            key: 'qr',
                            label: <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><QrCode size={18} /> QR Code</span>,
                            children: (
                                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                    <div style={{ maxWidth: 500, margin: '0 auto' }}>
                                        <FaceCamera
                                            mode="attendance"
                                            scanningMode="qr"
                                            onQRCodeDetected={handleQRDetected}
                                            loading={processing}
                                        />
                                    </div>
                                    <div style={{ marginTop: 16 }}>
                                        <Text type="secondary">Hold your registration QR code in front of the camera.</Text>
                                    </div>
                                </div>
                            )
                        },
                        {
                            key: 'pin',
                            label: <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Hash size={18} /> PIN Entry</span>,
                            children: (
                                <div style={{ maxWidth: 300, margin: '40px auto', textAlign: 'center' }}>
                                    <Title level={4}>Enter Your 4-Digit PIN</Title>
                                    <Input
                                        size="large"
                                        placeholder="0000"
                                        maxLength={4}
                                        value={pinCode}
                                        onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                                        style={{ fontSize: '32px', textAlign: 'center', letterSpacing: '8px', height: '64px', marginBottom: 24 }}
                                    />
                                    <Button
                                        type="primary"
                                        size="large"
                                        block
                                        loading={processing}
                                        onClick={handlePinCheckIn}
                                        disabled={pinCode.length < 4}
                                    >
                                        Verify PIN
                                    </Button>
                                </div>
                            )
                        }
                    ]}
                />
            </Card>

            <Modal
                open={showResult}
                footer={null}
                onCancel={() => setShowResult(false)}
                centered
                closable={false}
                width={400}
            >
                {result?.success ? (
                    <Result
                        status="success"
                        title="Welcome!"
                        subTitle={result.userName}
                    />
                ) : (
                    <Result
                        status="error"
                        title="Check-in Failed"
                        subTitle={result?.message}
                        extra={<Button type="primary" onClick={() => setShowResult(false)}>Try Again</Button>}
                    />
                )}
            </Modal>
        </div>
    );
};

export default EventCheckInPage;
