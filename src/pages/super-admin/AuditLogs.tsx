import React, { useState, useEffect } from 'react';
import { Table, Typography, Card, Tag, Space, Input, DatePicker } from 'antd';
import { ClipboardList, Search } from 'lucide-react';
import { auditService, AuditLog } from '../../services/auditService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const AuditLogs: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            setLoading(true);
            const { data, error } = await auditService.getLogs(100);
            if (error) throw error;
            setLogs(data || []);
        } catch (error: any) {
            console.error('Error loading logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Timestamp',
            dataIndex: 'created_at',
            key: 'timestamp',
            width: 180,
            render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
        },
        {
            title: 'Admin',
            dataIndex: 'admin_email',
            key: 'admin',
            render: (text: string) => <Text strong>{text}</Text>,
        },
        {
            title: 'Action',
            dataIndex: 'action',
            key: 'action',
            render: (text: string) => <Tag color="blue">{text.toUpperCase()}</Tag>,
        },
        {
            title: 'Target',
            key: 'target',
            render: (record: AuditLog) => (
                <Space>
                    <Tag color="purple">{record.target_type.toUpperCase()}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{record.target_id}</Text>
                </Space>
            )
        },
        {
            title: 'Details',
            dataIndex: 'details',
            key: 'details',
            render: (details: any) => (
                <pre style={{ fontSize: 11, margin: 0, maxHeight: 60, overflow: 'auto' }}>
                    {JSON.stringify(details, null, 2)}
                </pre>
            )
        }
    ];

    const filteredLogs = logs.filter(log =>
        log.admin_email.toLowerCase().includes(searchText.toLowerCase()) ||
        log.action.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <div>
            <Title level={3}>
                <ClipboardList size={24} style={{ marginRight: 12, verticalAlign: 'middle' }} />
                Platform Audit Logs
            </Title>

            <Card bordered={false} style={{ marginBottom: 16 }}>
                <Space size="large">
                    <Input
                        placeholder="Search logs..."
                        prefix={<Search size={16} />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        style={{ width: 300 }}
                    />
                    <RangePicker />
                </Space>
            </Card>

            <Card bordered={false}>
                <Table
                    columns={columns}
                    dataSource={filteredLogs}
                    loading={loading}
                    rowKey="id"
                    pagination={{ pageSize: 20 }}
                    size="small"
                />
            </Card>
        </div>
    );
};

export default AuditLogs;
