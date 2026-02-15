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
    message,
} from 'antd';
import { Users, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { auditService } from '../../services/auditService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const Managers: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [allAdmins, setAllAdmins] = useState<any[]>([]);
    const [adminModalVisible, setAdminModalVisible] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState<any>(null);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminPassword, setNewAdminPassword] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data, error } = await (supabase as any)
                .from('platform_admins')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAllAdmins(data || []);
        } catch (error: any) {
            console.error('Error loading admins:', error);
            message.error('Failed to load admins: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAdmin = async () => {
        try {
            if (!newAdminEmail || !newAdminPassword) {
                message.error('Please fill all fields');
                return;
            }

            if (editingAdmin) {
                const { error } = await (supabase as any)
                    .from('platform_admins')
                    .update({
                        secondary_password: newAdminPassword
                    })
                    .eq('id', editingAdmin.id);
                if (error) throw error;

                await auditService.logAction({
                    action: 'update_admin_security_code',
                    target_type: 'admin',
                    target_id: editingAdmin.id,
                    details: { email: editingAdmin.email }
                });

                message.success('Admin updated');
            } else {
                const { error } = await (supabase as any)
                    .from('platform_admins')
                    .insert({
                        email: newAdminEmail,
                        secondary_password: newAdminPassword
                    });
                if (error) throw error;

                await auditService.logAction({
                    action: 'create_admin',
                    target_type: 'admin',
                    details: { email: newAdminEmail }
                });

                message.success('Admin added successfully');
            }
            setAdminModalVisible(false);
            setEditingAdmin(null);
            setNewAdminEmail('');
            setNewAdminPassword('');
            loadData();
        } catch (error: any) {
            message.error('Error saving admin: ' + error.message);
        }
    };

    const handleDelete = (record: any) => {
        Modal.confirm({
            title: 'Remove Admin',
            content: `Are you sure you want to remove ${record.email}?`,
            onOk: async () => {
                const { error } = await (supabase as any).from('platform_admins').delete().eq('id', record.id);
                if (error) {
                    message.error('Delete failed: ' + error.message);
                } else {
                    await auditService.logAction({
                        action: 'delete_admin',
                        target_type: 'admin',
                        target_id: record.id,
                        details: { email: record.email }
                    });
                    message.success('Admin removed');
                    loadData();
                }
            }
        });
    };

    const columns = [
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => <Tag color="purple">{(role || 'admin').toUpperCase()}</Tag>
        },
        {
            title: 'Security Code',
            dataIndex: 'secondary_password',
            key: 'password',
            render: (pass: string) => <Text code>{pass}</Text>
        },
        {
            title: 'Added On',
            dataIndex: 'created_at',
            key: 'created',
            render: (date: string) => dayjs(date).format('MMM D, YYYY')
        },
        {
            title: 'Action',
            key: 'action',
            render: (record: any) => (
                <Space>
                    <Button
                        size="small"
                        onClick={() => {
                            setEditingAdmin(record);
                            setNewAdminEmail(record.email);
                            setNewAdminPassword(record.secondary_password);
                            setAdminModalVisible(true);
                        }}
                    >
                        Edit
                    </Button>
                    <Button
                        danger
                        size="small"
                        onClick={() => handleDelete(record)}
                    >
                        Delete
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>
                    <Users size={24} style={{ marginRight: 12, verticalAlign: 'middle' }} />
                    Platform Managers
                </Title>
                <Button
                    type="primary"
                    onClick={() => {
                        setEditingAdmin(null);
                        setNewAdminEmail('');
                        setNewAdminPassword('');
                        setAdminModalVisible(true);
                    }}
                    icon={<ShieldCheck size={16} />}
                >
                    Add New Admin
                </Button>
            </div>

            <Card bordered={false}>
                <Table
                    columns={columns}
                    dataSource={allAdmins}
                    loading={loading}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            <Modal
                title={editingAdmin ? "Edit Admin Password" : "Add New Platform Admin"}
                visible={adminModalVisible}
                onOk={handleSaveAdmin}
                onCancel={() => setAdminModalVisible(false)}
                okText={editingAdmin ? "Update Password" : "Add Admin"}
            >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <div>
                        <Text strong>Email Address</Text>
                        <Input
                            placeholder="email@example.com"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            disabled={!!editingAdmin}
                            style={{ marginTop: 8 }}
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            User identification email.
                        </Text>
                    </div>
                    <div>
                        <Text strong>Dashboard Password</Text>
                        <Input
                            placeholder="Secret key for dashboard access"
                            value={newAdminPassword}
                            onChange={(e) => setNewAdminPassword(e.target.value)}
                            style={{ marginTop: 8 }}
                        />
                    </div>
                </Space>
            </Modal>
        </div>
    );
};

export default Managers;
