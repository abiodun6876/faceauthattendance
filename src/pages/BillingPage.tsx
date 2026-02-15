import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Card,
    Typography,
    Button,
    Row,
    Col,
    Tag,
    Alert,
    Progress,
    Divider,
    Space,
    Radio,
    message
} from 'antd';
import {
    CreditCard,
    ArrowLeft,
    CheckCircle,
    Clock,
    Users,
    HardDrive,
    Info
} from 'lucide-react';
import { billingService, SubscriptionInfo, UsageStats } from '../services/billingService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const BillingPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const reason = searchParams.get('reason');
    const isExpired = reason === 'expired' || reason === 'subscription_required';

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);
    const [usage, setUsage] = useState<UsageStats | null>(null);
    const [pendingSub, setPendingSub] = useState<any>(null);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

    const loadData = async () => {
        try {
            setLoading(true);
            const orgId = localStorage.getItem('organization_id');
            if (orgId) {
                const [info, stats, pending] = await Promise.all([
                    billingService.getSubscriptionInfo(orgId),
                    billingService.getUsageStats(orgId),
                    billingService.getPendingSubscription(orgId)
                ]);
                setSubInfo(info);
                setUsage(stats);
                setPendingSub(pending.data);
            }
        } catch (error) {
            console.error('Error loading billing data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleRequestSubscription = async (planType: 'pro' | 'team') => {
        try {
            const orgId = localStorage.getItem('organization_id');
            if (!orgId) return;

            setSubmitting(true);
            const amount = planType === 'pro'
                ? (billingCycle === 'monthly' ? 25 : 250)
                : (billingCycle === 'monthly' ? 599 : 5990);

            const { error } = await billingService.initiateSubscription({
                organizationId: orgId,
                planType,
                billingCycle,
                amount
            });

            if (error) throw error;

            message.success('Subscription request initiated! Please contact admin for payment verification.');
            loadData();
        } catch (error: any) {
            message.error('Failed to initiate request: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };


    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getRemainingDays = () => {
        if (!subInfo?.expiryDate) return 0;
        const diff = dayjs(subInfo.expiryDate).diff(dayjs(), 'day');
        return diff > 0 ? diff : 0;
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '24px' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <Button
                    type="text"
                    icon={<ArrowLeft size={20} />}
                    onClick={() => navigate('/')}
                    style={{ marginBottom: 16 }}
                >
                    Back to Dashboard
                </Button>

                {isExpired && (
                    <Alert
                        message={reason === 'subscription_required' ? "Subscription Required" : "Subscription Expired"}
                        description={reason === 'subscription_required'
                            ? "Your organization has 20 or more active users. A paid subscription is required to continue using the platform."
                            : "Your organization subscription has expired. Please renew to maintain full access."
                        }
                        type="error"
                        showIcon
                        icon={<Info />}
                        style={{ marginBottom: 24 }}
                    />
                )}

                {pendingSub && (
                    <Alert
                        message="Subscription Request Pending"
                        description={
                            <div>
                                <p>You have a pending request for the <strong>{pendingSub.plan_type.toUpperCase()} ({pendingSub.billing_cycle})</strong> plan.</p>
                                <p>Invoice: <strong>{pendingSub.invoice_number}</strong> | Amount: <strong>${pendingSub.amount}</strong></p>
                                <Divider style={{ margin: '12px 0' }} />
                                <div style={{ marginBottom: 12 }}>
                                    <Text strong>Payment Instructions:</Text>
                                    <div style={{ marginTop: 8, padding: '8px 16px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4 }}>
                                        <p style={{ margin: 0 }}>Bank: <strong>Access Bank</strong></p>
                                        <p style={{ margin: 0 }}>Account Number: <strong>1857808562</strong></p>
                                        <p style={{ margin: 0 }}>Account Name: <strong>AKINPELU ABIODUN MOSES</strong></p>
                                    </div>
                                </div>
                                <p>Please finalize your payment and send your <b>Invoice Number</b> and <b>Evidence of Payment</b> to our WhatsApp: <b>+2348102922615</b> or Email: <b>nigeramventures@gmail.com</b> for activation confirmation.</p>
                            </div>
                        }
                        type="warning"
                        showIcon
                        icon={<Clock />}
                        style={{ marginBottom: 24 }}
                    />
                )}

                <Row gutter={[24, 24]}>
                    <Col xs={24} lg={16}>
                        <Card
                            title={
                                <Space>
                                    <CreditCard size={20} />
                                    <span>Manage Subscription</span>
                                </Space>
                            }
                            extra={
                                <Radio.Group
                                    value={billingCycle}
                                    onChange={(e) => setBillingCycle(e.target.value)}
                                    buttonStyle="solid"
                                    size="small"
                                >
                                    <Radio.Button value="monthly">Monthly</Radio.Button>
                                    <Radio.Button value="yearly">Yearly (Save 15%)</Radio.Button>
                                </Radio.Group>
                            }
                            loading={loading}
                        >
                            <Row gutter={16} align="middle">
                                <Col xs={24} md={12}>
                                    <div style={{ marginBottom: 12 }}>
                                        <Text type="secondary">Current Plan</Text>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                                            <Title level={2} style={{ margin: 0, textTransform: 'capitalize', color: '#1890ff' }}>
                                                {usage && usage.activeUsers < 10 ? 'Starter (Free)' : (subInfo?.plan || 'Free')}
                                            </Title>
                                            <Tag color={(subInfo?.status === 'active' || (usage && usage.activeUsers < 10)) ? 'green' : (subInfo?.status === 'expired' ? 'red' : 'orange')}>
                                                {(usage && usage.activeUsers < 10) ? 'COMPLIMENTARY' : (subInfo?.status?.toUpperCase() || 'INACTIVE')}
                                            </Tag>
                                        </div>
                                    </div>
                                </Col>
                                <Col xs={24} md={12}>
                                    <div style={{ marginBottom: 12 }}>
                                        <Text type="secondary">Expiry Date</Text>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                            <Clock size={16} color="#666" />
                                            <Text strong>
                                                {subInfo?.expiryDate ? dayjs(subInfo.expiryDate).format('MMMM D, YYYY') : 'Lifetime Access'}
                                            </Text>
                                        </div>
                                        {subInfo?.expiryDate && (
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                ({getRemainingDays()} days remaining)
                                            </Text>
                                        )}
                                    </div>
                                </Col>
                            </Row>
                        </Card>

                        <Title level={4} style={{ marginTop: 32, marginBottom: 16 }}>Select a Package</Title>
                        <Row gutter={[16, 16]}>
                            {/* Starter Plan Card */}
                            <Col xs={24} md={8}>
                                <Card
                                    hoverable
                                    style={{ height: '100%', borderRadius: 12, border: subInfo?.plan === 'free' ? '2px solid #1890ff' : '1px solid #f0f0f0' }}
                                    bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%' }}
                                >
                                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                        <Title level={4}>Starter</Title>
                                        <div style={{ margin: '16px 0' }}>
                                            <span style={{ fontSize: 32, fontWeight: 'bold' }}>Free</span>
                                        </div>
                                        <Text type="secondary">For small teams starting out</Text>
                                    </div>
                                    <Divider style={{ margin: '0 0 24px 0' }} />
                                    <div style={{ flex: 1 }}>
                                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                            <div style={{ display: 'flex', gap: 8 }}><CheckCircle size={16} color="#52c41a" /> <Text>Up to 10 active users</Text></div>
                                            <div style={{ display: 'flex', gap: 8 }}><CheckCircle size={16} color="#52c41a" /> <Text>Face & QR Verification</Text></div>
                                            <div style={{ display: 'flex', gap: 8 }}><CheckCircle size={16} color="#52c41a" /> <Text>Shared Storage (500MB)</Text></div>
                                            <div style={{ display: 'flex', gap: 8 }}><CheckCircle size={16} color="#52c41a" /> <Text>Leave Management</Text></div>
                                        </Space>
                                    </div>
                                    <Button block disabled style={{ marginTop: 24 }}>Default Plan</Button>
                                </Card>
                            </Col>

                            {/* Pro Plan Card */}
                            <Col xs={24} md={8}>
                                <Card
                                    hoverable
                                    style={{ height: '100%', borderRadius: 12, border: subInfo?.plan === 'pro' ? '2px solid #1890ff' : '1px solid #f0f0f0' }}
                                    bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%' }}
                                >
                                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                        <div style={{ position: 'absolute', top: 12, right: 12 }}><Tag color="blue">Best Value</Tag></div>
                                        <Title level={4}>Professional</Title>
                                        <div style={{ margin: '16px 0' }}>
                                            <span style={{ fontSize: 24, fontWeight: 'bold', verticalAlign: 'top' }}>$</span>
                                            <span style={{ fontSize: 40, fontWeight: 'bold' }}>{billingCycle === 'monthly' ? '25' : '250'}</span>
                                            <span style={{ color: '#8c8c8c' }}>/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                                        </div>
                                        <Text type="secondary">Advanced tools for growth</Text>
                                    </div>
                                    <Divider style={{ margin: '0 0 24px 0' }} />
                                    <div style={{ flex: 1 }}>
                                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                            <div style={{ display: 'flex', gap: 8 }}><CheckCircle size={16} color="#52c41a" /> <Text>Up to 50 active users</Text></div>
                                            <div style={{ display: 'flex', gap: 8 }}><CheckCircle size={16} color="#52c41a" /> <Text>Full Security Suite</Text></div>
                                            <div style={{ display: 'flex', gap: 8 }}><CheckCircle size={16} color="#52c41a" /> <Text>Shared Storage (5GB)</Text></div>
                                            <div style={{ display: 'flex', gap: 8 }}><CheckCircle size={16} color="#52c41a" /> <Text>Priority Support</Text></div>
                                        </Space>
                                    </div>
                                    <Button
                                        type="primary"
                                        block
                                        style={{ marginTop: 24 }}
                                        loading={submitting}
                                        disabled={subInfo?.plan === 'pro' || subInfo?.plan === 'team' || !!pendingSub}
                                        onClick={() => handleRequestSubscription('pro')}
                                    >
                                        {subInfo?.plan === 'pro' ? 'Current Plan' : 'Select Pro'}
                                    </Button>
                                </Card>
                            </Col>

                            {/* Team Plan Card */}
                            <Col xs={24} md={8}>
                                <Card
                                    hoverable
                                    style={{ height: '100%', borderRadius: 12, border: subInfo?.plan === 'team' ? '2px solid #1890ff' : '1px solid #f0f0f0' }}
                                    bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%' }}
                                >
                                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                        <Title level={4}>Team Enterprise</Title>
                                        <div style={{ margin: '16px 0' }}>
                                            <span style={{ fontSize: 24, fontWeight: 'bold', verticalAlign: 'top' }}>$</span>
                                            <span style={{ fontSize: 40, fontWeight: 'bold' }}>{billingCycle === 'monthly' ? '599' : '5,990'}</span>
                                            <span style={{ color: '#8c8c8c' }}>/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                                        </div>
                                        <Text type="secondary">Maximum scale & storage</Text>
                                    </div>
                                    <Divider style={{ margin: '0 0 24px 0' }} />
                                    <div style={{ flex: 1 }}>
                                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                            <div style={{ display: 'flex', gap: 8 }}><CheckCircle size={16} color="#52c41a" /> <Text>Unlimited Users*</Text></div>
                                            <div style={{ display: 'flex', gap: 8 }}><CheckCircle size={16} color="#52c41a" /> <Text>Vehicle Tracking API</Text></div>
                                            <div style={{ display: 'flex', gap: 8 }}><CheckCircle size={16} color="#52c41a" /> <Text>Shared Storage (50GB)</Text></div>
                                            <div style={{ display: 'flex', gap: 8 }}><CheckCircle size={16} color="#52c41a" /> <Text>Custom Integration</Text></div>
                                        </Space>
                                    </div>
                                    <Button
                                        block
                                        style={{ marginTop: 24 }}
                                        loading={submitting}
                                        disabled={subInfo?.plan === 'team' || !!pendingSub}
                                        onClick={() => handleRequestSubscription('team')}
                                    >
                                        {subInfo?.plan === 'team' ? 'Current Plan' : 'Select Team'}
                                    </Button>
                                </Card>
                            </Col>
                        </Row>

                    </Col>

                    <Col xs={24} lg={8}>
                        <Card title="Current Usage" loading={loading}>
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Space size={4}><Users size={16} /> <Text>Active Users (MAU)</Text></Space>
                                    <Text strong>{usage?.activeUsers.toLocaleString()} / {(usage?.activeUsers || 0) < 10 ? '10' : ((usage?.activeUsers || 0) < 20 ? '20' : '50,000')}</Text>
                                </div>
                                <Progress
                                    percent={Math.min(100, (usage?.activeUsers || 0) / ((usage?.activeUsers || 0) < 10 ? 10 : 20) * 100)}
                                    showInfo={false}
                                    strokeColor={(usage?.activeUsers || 0) >= 15 ? "#ff4d4f" : "#667eea"}
                                />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {(usage?.activeUsers || 0) < 10
                                        ? "Free tier: Stay under 10 users for complimentary access."
                                        : ((usage?.activeUsers || 0) < 20
                                            ? "Approaching limit: Subscriptions are mandatory from 20 users."
                                            : "Paid tier active: Managing large organization resources.")
                                    }
                                </Text>
                            </div>

                            <Divider />

                            <div style={{ marginBottom: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Space size={4}><HardDrive size={16} /> <Text>Estimated Storage</Text></Space>
                                    <Text strong>{formatBytes(usage?.storageUsageBytes || 0)} / 500 MB</Text>
                                </div>
                                <Progress
                                    percent={Math.min(100, (usage?.storageUsageBytes || 0) / (500 * 1024 * 1024) * 100)}
                                    showInfo={false}
                                    status="active"
                                />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    Estimated space used by user profiles and face data.
                                </Text>
                            </div>

                            <Divider />

                            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                <CheckCircle size={32} color="#52c41a" style={{ marginBottom: 16 }} />
                                <Title level={5} style={{ margin: 0 }}>System is Optimized</Title>
                                <Text type="secondary">You are currently within your plan limits.</Text>
                            </div>
                        </Card>
                    </Col>
                </Row>
            </div>
        </div>
    );
};

export default BillingPage;
