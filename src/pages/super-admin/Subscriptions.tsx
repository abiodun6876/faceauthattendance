import React, { useState, useEffect } from 'react';
import {
    Table,
    Tag,
    Typography,
    Card,
    Space,
    Button,
    Modal,
    Input,
    message
} from 'antd';
import { CreditCard, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { auditService } from '../../services/auditService';
import { billingService } from '../../services/billingService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const Subscriptions: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [subscriptions, setSubscriptions] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data, error } = await billingService.getAllSubscriptions();
            if (error) throw error;
            setSubscriptions(data || []);
        } catch (error: any) {
            console.error('Error loading subscriptions:', error);
            message.error('Failed to load subscriptions: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (sub: any) => {
        const password = sessionStorage.getItem('super_admin_password');

        Modal.confirm({
            title: 'Approve Subscription',
            content: `Are you sure you want to activate the ${sub.plan_type.toUpperCase()} plan for ${sub.organization?.name}? This will update their expiry date.`,
            onOk: async () => {
                try {
                    const { error } = await (supabase as any).rpc('approve_subscription_admin', {
                        sub_id: sub.id,
                        admin_secret: password
                    });

                    if (error) throw error;

                    await auditService.logAction({
                        action: 'approve_subscription',
                        target_type: 'subscription',
                        target_id: sub.id,
                        details: { org: sub.organization?.name, plan: sub.plan_type }
                    });

                    message.success('Subscription activated and organization updated!');
                    loadData();
                } catch (error: any) {
                    message.error('Activation Failed: ' + error.message);
                }
            }
        });
    };

    const handleReject = async (sub: any) => {
        let reason = '';
        Modal.confirm({
            title: 'Reject Subscription',
            content: (
                <div style={{ marginTop: 16 }}>
                    <Text>Reason for rejection:</Text>
                    <Input
                        placeholder="e.g. Payment not received"
                        onChange={(e) => reason = e.target.value}
                        style={{ marginTop: 8 }}
                    />
                </div>
            ),
            onOk: async () => {
                try {
                    await billingService.updateSubscriptionStatus(sub.id, 'rejected', reason);

                    await auditService.logAction({
                        action: 'reject_subscription',
                        target_type: 'subscription',
                        target_id: sub.id,
                        details: { org: sub.organization?.name, plan: sub.plan_type, reason }
                    });

                    message.success('Subscription rejected.');
                    loadData();
                } catch (error: any) {
                    message.error('Error: ' + error.message);
                }
            }
        });
    };

    const columns = [
        {
            title: 'Organization',
            dataIndex: ['organization', 'name'],
            key: 'org_name',
        },
        {
            title: 'Plan',
            key: 'plan',
            render: (record: any) => (
                <Space>
                    <Tag color="blue">{record.plan_type.toUpperCase()}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{record.billing_cycle}</Text>
                </Space>
            )
        },
        {
            title: 'Amount',
            dataIndex: 'amount',
            key: 'amount',
            render: (val: number) => `$${val.toLocaleString()}`
        },
        {
            title: 'Invoice',
            dataIndex: 'invoice_number',
            key: 'invoice',
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'active' ? 'green' : (status === 'pending' ? 'orange' : 'red')}>
                    {status.toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Requested',
            dataIndex: 'created_at',
            key: 'created',
            render: (date: string) => dayjs(date).format('MMM D, YYYY')
        },
        {
            title: 'Action',
            key: 'action',
            render: (record: any) => (
                record.status === 'pending' ? (
                    <Space>
                        <Button
                            type="primary"
                            size="small"
                            icon={<CheckCircle size={14} />}
                            onClick={() => handleApprove(record)}
                        >
                            Approve
                        </Button>
                        <Button
                            danger
                            size="small"
                            icon={<XCircle size={14} />}
                            onClick={() => handleReject(record)}
                        >
                            Reject
                        </Button>
                    </Space>
                ) : null
            )
        }
    ];

    return (
        <div>
            <Title level={3}>
                <CreditCard size={24} style={{ marginRight: 12, verticalAlign: 'middle' }} />
                Subscription Requests
            </Title>

            <Card bordered={false}>
                <Table
                    columns={columns}
                    dataSource={subscriptions}
                    loading={loading}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>
        </div>
    );
};

export default Subscriptions;
