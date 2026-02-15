import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card,
    Form,
    Input,
    Button,
    Typography,
    message,
    Steps,
    Result,
    Select,
    Divider,
    Space,
    Spin,
    Tag
} from 'antd';
import {
    User,
    Mail,
    Phone,
    Calendar,
    MapPin,
    ChevronRight,
    CheckCircle,
    Camera,
    Clock,
    Download,
    Share2,
    Check
} from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { eventService, Event } from '../services/eventService';
import { userService } from '../services/userService';
import FaceCamera from '../components/FaceCamera';
import faceService from '../utils/faceService';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

const EventRegistrationPage: React.FC = () => {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [formValues, setFormValues] = useState<any>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [faceData, setFaceData] = useState<any>(null);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    const [generatedPin, setGeneratedPin] = useState<string>('');

    const loadEvent = useCallback(async () => {
        if (!eventId) return;
        try {
            const { data, error } = await eventService.getEventById(eventId);
            if (error) throw error;
            setEvent(data as unknown as Event);
        } catch (error: any) {
            message.error('Failed to load event details');
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        loadEvent();
    }, [loadEvent]);

    const handleFormSubmit = (values: any) => {
        setFormValues(values);
        setCurrentStep(1);
    };

    const handleFaceCapture = async (photoData: string) => {
        setIsSubmitting(true);
        try {
            message.loading({ content: 'Analyzing face...', key: 'face-scan' });
            const result = await faceService.processImage(photoData);

            if (!result.success || !result.embedding) {
                message.error({ content: result.error || 'No face detected. Please try again.', key: 'face-scan' });
                setIsSubmitting(false);
                return;
            }

            setFaceData({
                photoUrl: photoData,
                embedding: Array.from(result.embedding)
            });

            message.success({ content: 'Face captured successfully!', key: 'face-scan' });
            setCurrentStep(2);
        } catch (error) {
            message.error({ content: 'Face processing failed', key: 'face-scan' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const completeRegistration = async () => {
        if (!event || !faceData) return;
        setIsSubmitting(true);
        try {
            // 1. Enroll User
            const enrollmentParams = {
                organizationId: event.organization_id,
                branchId: event.branch_id || '',
                fullName: formValues.fullName,
                email: formValues.email,
                phone: formValues.phone,
                photoUrl: faceData.photoUrl,
                embedding: faceData.embedding,
                userRole: 'guest',
                gender: formValues.gender,
                qrCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
                pin: Math.floor(1000 + Math.random() * 9000).toString()
            };

            setGeneratedPin(enrollmentParams.pin);

            const { user, error: enrollError } = await userService.enrollUser(enrollmentParams);
            if (enrollError) throw enrollError;

            // 2. Register for Event
            if (user) {
                const { error: regError } = await eventService.registerUser(event.id, user.id);
                if (regError) throw regError;
            }

            setRegistrationSuccess(true);
            setCurrentStep(3);
        } catch (error: any) {
            message.error('Registration failed: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" tip="Loading event details..." />
            </div>
        );
    }

    if (!event) {
        return (
            <Result
                status="404"
                title="Event Not Found"
                subTitle="The event you are looking for does not exist or has been removed."
                extra={<Button type="primary" onClick={() => navigate('/')}>Go Back</Button>}
            />
        );
    }

    return (
        <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
            <Card style={{ borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <Tag color="blue" style={{ marginBottom: 8 }}>{event.event_type.toUpperCase()}</Tag>
                    <Title level={2}>{event.name}</Title>
                    <Space size="large" style={{ color: '#8c8c8c' }}>
                        <span><Calendar size={16} /> {dayjs(event.start_date).format('MMMM DD, YYYY')}</span>
                        <span><Clock size={16} /> {dayjs(event.start_date).format('HH:mm')}</span>
                        <span><MapPin size={16} /> {event.location}</span>
                    </Space>
                </div>

                <Steps
                    current={currentStep}
                    style={{ marginBottom: 40 }}
                    items={[
                        { title: 'Details', icon: <User size={18} /> },
                        { title: 'Face ID', icon: <Camera size={18} /> },
                        { title: 'Review', icon: <CheckCircle size={18} /> }
                    ]}
                />

                {currentStep === 0 && (
                    <Form layout="vertical" onFinish={handleFormSubmit}>
                        <Form.Item
                            name="fullName"
                            label="Full Name"
                            rules={[{ required: true, message: 'Please enter your full name' }]}
                        >
                            <Input prefix={<User size={16} />} placeholder="Enter your full name" size="large" />
                        </Form.Item>

                        <Form.Item
                            name="email"
                            label="Email Address"
                            rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}
                        >
                            <Input prefix={<Mail size={16} />} placeholder="your@email.com" size="large" />
                        </Form.Item>

                        <Form.Item
                            name="phone"
                            label="Phone Number"
                        >
                            <Input prefix={<Phone size={16} />} placeholder="+234..." size="large" />
                        </Form.Item>

                        <Form.Item
                            name="gender"
                            label="Gender"
                            rules={[{ required: true }]}
                        >
                            <Select size="large">
                                <Select.Option value="male">Male</Select.Option>
                                <Select.Option value="female">Female</Select.Option>
                            </Select>
                        </Form.Item>

                        <Button type="primary" htmlType="submit" size="large" block icon={<ChevronRight size={18} />}>
                            Next: Setup Face ID
                        </Button>
                    </Form>
                )}

                {currentStep === 1 && (
                    <div style={{ textAlign: 'center' }}>
                        <Title level={4}>Face ID Registration</Title>
                        <Paragraph>
                            Please look at the camera to enroll your face.
                            This will be used for your event check-in.
                        </Paragraph>
                        <div style={{ height: 400, marginBottom: 24, borderRadius: 12, overflow: 'hidden' }}>
                            <FaceCamera
                                mode="enrollment"
                                onEnrollmentComplete={handleFaceCapture}
                                loading={isSubmitting}
                            />
                        </div>
                        <Button onClick={() => setCurrentStep(0)} block>Back to Details</Button>
                    </div>
                )}

                {currentStep === 2 && (
                    <div>
                        <Title level={4}>Review Your Registration</Title>
                        <Divider />
                        <div style={{ marginBottom: 24 }}>
                            <Text type="secondary">Name:</Text> <Text strong>{formValues.fullName}</Text><br />
                            <Text type="secondary">Email:</Text> <Text strong>{formValues.email}</Text><br />
                            <Text type="secondary">Gender:</Text> <Text strong>{formValues.gender}</Text>
                        </div>
                        <div style={{ textAlign: 'center', marginBottom: 32 }}>
                            <div style={{
                                width: 200,
                                height: 200,
                                margin: '0 auto',
                                borderRadius: 12,
                                overflow: 'hidden',
                                border: '4px solid #f0f0f0'
                            }}>
                                <img src={faceData.photoUrl || ''} alt="Face" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                        </div>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Button type="primary" size="large" block onClick={completeRegistration} loading={isSubmitting}>
                                Complete Registration
                            </Button>
                            <Button onClick={() => setCurrentStep(1)} block disabled={isSubmitting}>
                                Retake Photo
                            </Button>
                        </Space>
                    </div>
                )}

                {currentStep === 3 && registrationSuccess && (
                    <div id="registration-success-card">
                        <Result
                            status="success"
                            title="Successfully Registered!"
                            subTitle={
                                <Space direction="vertical">
                                    <Text>You are now registered for {event.name}.</Text>
                                    <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f', marginTop: 16 }}>
                                        <Text strong>Your Check-in PIN: </Text>
                                        <Title level={2} style={{ margin: '8px 0', color: '#52c41a' }}>{generatedPin}</Title>
                                        <Text type="secondary">Save this PIN! You will need it or your QR code for entry on the day of the event.</Text>
                                    </Card>
                                </Space>
                            }
                            extra={[
                                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                    <Button
                                        type="primary"
                                        icon={<Download size={18} />}
                                        size="large"
                                        block
                                        onClick={async () => {
                                            const element = document.getElementById('registration-success-card');
                                            if (element) {
                                                try {
                                                    const dataUrl = await htmlToImage.toPng(element);
                                                    const link = document.createElement('a');
                                                    link.download = `Event_Registration_${event.name}.png`;
                                                    link.href = dataUrl;
                                                    link.click();
                                                    message.success('Registration details saved as image!');
                                                } catch (err) {
                                                    message.error('Failed to save image');
                                                }
                                            }
                                        }}
                                    >
                                        Save as Image
                                    </Button>
                                    <Button
                                        size="large"
                                        block
                                        onClick={() => {
                                            setCurrentStep(0);
                                            setRegistrationSuccess(false);
                                            setFormValues({});
                                            setFaceData(null);
                                        }}
                                    >
                                        Register Another
                                    </Button>
                                    <Button
                                        danger
                                        size="large"
                                        block
                                        onClick={() => navigate('/thank-you')}
                                    >
                                        Close / Exit
                                    </Button>
                                </Space>
                            ]}
                        />
                    </div>
                )}
            </Card>
        </div>
    );
};

export default EventRegistrationPage;
