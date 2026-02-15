import React, { useState, useEffect } from 'react';
import {
    Table,
    Tag,
    Typography,
    Card,
    message
} from 'antd';
import { Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const Organizations: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [organizations, setOrganizations] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrganizations(data || []);
        } catch (error: any) {
            console.error('Error loading organizations:', error);
            message.error('Failed to load organizations: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Organization',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: 'Subdomain',
            dataIndex: 'subdomain',
            key: 'subdomain',
            render: (text: string) => <Tag color="blue">{text}</Tag>
        },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => <Tag>{(type || 'N/A').toUpperCase()}</Tag>
        },
        {
            title: 'Plan',
            dataIndex: 'subscription_plan',
            key: 'plan',
            render: (plan: string) => (
                <Tag color={plan === 'free' ? 'default' : (plan === 'pro' ? 'gold' : 'purple')}>
                    {(plan || 'free').toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Status',
            dataIndex: 'subscription_status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'active' ? 'green' : 'red'}>
                    {(status || 'active').toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Created',
            dataIndex: 'created_at',
            key: 'created',
            render: (date: string) => dayjs(date).format('MMM D, YYYY')
        }
    ];

    return (
        <div>
            <Title level={3}>
                <Building2 size={24} style={{ marginRight: 12, verticalAlign: 'middle' }} />
                Organizations
            </Title>

            <Card bordered={false}>
                <Table
                    columns={columns}
                    dataSource={organizations}
                    loading={loading}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>
        </div>
    );
};

export default Organizations;
