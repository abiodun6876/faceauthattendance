import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Card,
    Typography,
    Button,
    Row,
    Col,
    Table,
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
    Info,
    Zap,
    FileText
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

    const planData = [
        {
            key: 'starter',
            feature: 'Active Users',
            free: 'Up to 10',
            pro: 'Up to 50',
            team: 'Unlimited*'
        },
        {
            key: 'limit',
            feature: 'Access Status',
            free: 'Free < 10 users',
            pro: 'Member Required',
            team: 'Member Required'
        },
        {
            key: 'storage',
            feature: 'Storage (Shared)',
            free: '500 MB',
            pro: '5 GB',
            team: '50 GB'
        },
        {
            key: '3',
            feature: 'File Storage',
            free: '1 GB',
            pro: '100 GB+',
            team: 'Variable'
        },
        {
            key: '4',
            feature: 'Support',
            free: 'Community',
            pro: 'Email',
            team: 'Priority Email'
        }
    ];

    const columns = [
        { title: 'Feature', dataIndex: 'feature', key: 'feature' },
        { title: 'Free ($0)', dataIndex: 'free', key: 'free' },
        {
            title: billingCycle === 'yearly' ? 'Pro ($250/yr)' : 'Pro ($25/mo)',
            dataIndex: 'pro',
            key: 'pro',
            render: (text: string) => <Text strong style={{ color: '#1890ff' }}>{text}</Text>
        },
        {
            title: billingCycle === 'yearly' ? 'Team ($5990/yr)' : 'Team ($599/mo)',
            dataIndex: 'team',
            key: 'team'
        }
    ];

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
                                <p>Please finalize your payment and contact the platform administrator for activation.</p>
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
                                    <span>Subscription Plan</span>
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
                                    <div style={{ marginBottom: 24 }}>
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

                                    <div style={{ marginBottom: 24 }}>
                                        <Text type="secondary">Expiry Date</Text>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                            <Clock size={16} color="#666" />
                                            <Text strong>
                                                {subInfo?.expiryDate ? dayjs(subInfo.expiryDate).format('MMMM D, YYYY') : 'Lifetime'}
                                            </Text>
                                        </div>
                                        {subInfo?.expiryDate && (
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                ({getRemainingDays()} days remaining)
                                            </Text>
                                        )}
                                    </div>
                                </Col>
                                <Col xs={24} md={12}>
                                    <div style={{
                                        padding: '20px',
                                        backgroundColor: '#e6f7ff',
                                        borderRadius: '12px',
                                        border: '1px solid #91d5ff'
                                    }}>
                                        <Title level={5} style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Zap size={18} fill="#1890ff" color="#1890ff" />
                                            Upgrade Selection
                                        </Title>
                                        <Text type="secondary">Select your plan and initiate an invoice for activation.</Text>
                                        <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
                                            <Button
                                                type="primary"
                                                block
                                                icon={<FileText size={16} />}
                                                disabled={subInfo?.plan === 'pro' || subInfo?.plan === 'team' || !!pendingSub}
                                                loading={submitting}
                                                onClick={() => handleRequestSubscription('pro')}
                                            >
                                                Request PRO Plan
                                            </Button>
                                            <Button
                                                block
                                                icon={<FileText size={16} />}
                                                disabled={subInfo?.plan === 'team' || !!pendingSub}
                                                loading={submitting}
                                                onClick={() => handleRequestSubscription('team')}
                                            >
                                                Request TEAM Plan
                                            </Button>
                                        </Space>
                                    </div>
                                </Col>
                            </Row>
                        </Card>

                        <Card
                            title="Plan Comparison"
                            style={{ marginTop: 24 }}
                            bodyStyle={{ padding: 0 }}
                        >
                            <Table
                                columns={columns}
                                dataSource={planData}
                                pagination={false}
                                size="middle"
                                scroll={{ x: 600 }}
                            />
                        </Card>
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
