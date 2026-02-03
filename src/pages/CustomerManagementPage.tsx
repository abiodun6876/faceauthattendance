// pages/CustomerManagementPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    Table,
    Button,
    Modal,
    Form,
    Input,
    Select,
    message,
    Tag,
    Space,
    Typography,
    Row,
    Col,
    Statistic,
    Avatar
} from 'antd';
import {
    Users,
    UserPlus,
    ArrowLeft,
    Building,
    Mail,
    Phone,
    MapPin,
    Eye,
    Edit
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const CustomerManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState<any[]>([]);
    const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<any>(null);
    const [searchText, setSearchText] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [stats, setStats] = useState({
        total: 0,
        individual: 0,
        corporate: 0,
        active: 0
    });

    useEffect(() => {
        loadCustomers();
    }, []);

    useEffect(() => {
        filterCustomers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customers, searchText, typeFilter]);

    const loadCustomers = async () => {
        try {
            setLoading(true);
            const organizationId = localStorage.getItem('organization_id');

            const { data, error } = await supabase
                .from('customers' as any)
                .select('*')
                .eq('organization_id', organizationId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            const customerData = data as any[];
            setCustomers(customerData || []);

            // Calculate stats
            const total = customerData?.length || 0;
            const individual = customerData?.filter(c => c.customer_type === 'individual').length || 0;
            const corporate = customerData?.filter(c => c.customer_type === 'corporate').length || 0;
            const active = customerData?.filter(c => c.status === 'active').length || 0;

            setStats({ total, individual, corporate, active });
        } catch (error: any) {
            console.error('Error loading customers:', error);
            message.error('Failed to load customers');
        } finally {
            setLoading(false);
        }
    };

    const filterCustomers = () => {
        let filtered = [...customers];

        if (searchText) {
            filtered = filtered.filter(customer =>
                customer.full_name?.toLowerCase().includes(searchText.toLowerCase()) ||
                customer.company_name?.toLowerCase().includes(searchText.toLowerCase()) ||
                customer.email?.toLowerCase().includes(searchText.toLowerCase()) ||
                customer.phone?.includes(searchText)
            );
        }

        if (typeFilter !== 'all') {
            filtered = filtered.filter(customer => customer.customer_type === typeFilter);
        }

        setFilteredCustomers(filtered);
    };

    const handleSubmit = async (values: any) => {
        try {
            setLoading(true);
            const organizationId = localStorage.getItem('organization_id');

            const customerData = {
                organization_id: organizationId,
                ...values
            };

            if (editingCustomer) {
                // Update existing customer
                const { error } = await supabase
                    .from('customers' as any)
                    .update(customerData)
                    .eq('id', editingCustomer.id);

                if (error) throw error;
                message.success('Customer updated successfully');
            } else {
                // Create new customer
                const { error } = await supabase
                    .from('customers' as any)
                    .insert(customerData);

                if (error) throw error;
                message.success('Customer added successfully');
            }

            setModalVisible(false);
            setEditingCustomer(null);
            form.resetFields();
            loadCustomers();
        } catch (error: any) {
            console.error('Error saving customer:', error);
            message.error('Failed to save customer');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (customer: any) => {
        setEditingCustomer(customer);
        form.setFieldsValue(customer);
        setModalVisible(true);
    };

    const handleAdd = () => {
        setEditingCustomer(null);
        form.resetFields();
        form.setFieldsValue({ customer_type: 'individual', status: 'active' });
        setModalVisible(true);
    };

    const columns = [
        {
            title: 'Customer',
            key: 'customer',
            render: (record: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar
                        size={48}
                        src={record.photo_url}
                        style={{ backgroundColor: '#667eea' }}
                    >
                        {record.full_name?.charAt(0).toUpperCase()}
                    </Avatar>
                    <div>
                        <div><strong>{record.full_name}</strong></div>
                        {record.company_name && (
                            <div style={{ fontSize: 12, color: '#666' }}>{record.company_name}</div>
                        )}
                    </div>
                </div>
            ),
        },
        {
            title: 'Type',
            dataIndex: 'customer_type',
            key: 'type',
            render: (type: string) => (
                <Tag color={type === 'corporate' ? 'blue' : 'green'}>
                    {type?.toUpperCase()}
                </Tag>
            ),
        },
        {
            title: 'Contact',
            key: 'contact',
            render: (record: any) => (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Mail size={14} />
                        <span style={{ fontSize: 12 }}>{record.email || '-'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={14} />
                        <span style={{ fontSize: 12 }}>{record.phone}</span>
                    </div>
                </div>
            ),
        },
        {
            title: 'Location',
            key: 'location',
            render: (record: any) => (
                <div style={{ fontSize: 12 }}>
                    {record.city && record.country ? `${record.city}, ${record.country}` : '-'}
                </div>
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'active' ? 'success' : 'default'}>
                    {status?.toUpperCase()}
                </Tag>
            ),
        },
        {
            title: 'Created',
            dataIndex: 'created_at',
            key: 'created',
            render: (date: string) => dayjs(date).format('MMM D, YYYY'),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (record: any) => (
                <Space>
                    <Button
                        type="text"
                        icon={<Edit size={16} />}
                        onClick={() => handleEdit(record)}
                    >
                        Edit
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--gray-50)', padding: '16px' }}>
            {/* Header */}
            <div style={{
                background: 'white',
                padding: '16px 24px',
                borderRadius: '12px',
                marginBottom: 24,
                boxShadow: 'var(--shadow-sm)'
            }}>
                <Button
                    type="text"
                    icon={<ArrowLeft size={24} />}
                    onClick={() => navigate('/')}
                    style={{ marginBottom: 16, color: 'var(--gray-600)' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        backgroundColor: '#52c41a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Building size={24} color="#fff" />
                    </div>
                    <div>
                        <Title level={3} style={{ margin: 0 }}>
                            Customer Management
                        </Title>
                        <Text type="secondary">
                            Manage your customers and clients
                        </Text>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Total Customers"
                            value={stats.total}
                            prefix={<Users size={20} />}
                            valueStyle={{ color: '#667eea' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Individual"
                            value={stats.individual}
                            prefix={<Users size={20} />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Corporate"
                            value={stats.corporate}
                            prefix={<Building size={20} />}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card>
                        <Statistic
                            title="Active"
                            value={stats.active}
                            valueStyle={{ color: '#fa8c16' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Filters and Actions */}
            <Card style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={12} md={8}>
                        <Input
                            placeholder="Search customers..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            prefix={<Users size={16} />}
                            size="large"
                        />
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                        <Select
                            value={typeFilter}
                            onChange={setTypeFilter}
                            style={{ width: '100%' }}
                            size="large"
                        >
                            <Option value="all">All Types</Option>
                            <Option value="individual">Individual</Option>
                            <Option value="corporate">Corporate</Option>
                        </Select>
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                        <Button
                            type="primary"
                            icon={<UserPlus size={16} />}
                            onClick={handleAdd}
                            size="large"
                            block
                        >
                            Add Customer
                        </Button>
                    </Col>
                </Row>
            </Card>

            {/* Customers Table */}
            <Card>
                <Table
                    columns={columns}
                    dataSource={filteredCustomers}
                    loading={loading}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            {/* Add/Edit Customer Modal */}
            <Modal
                title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                open={modalVisible}
                onCancel={() => {
                    setModalVisible(false);
                    setEditingCustomer(null);
                }}
                footer={null}
                width={700}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{ customer_type: 'individual', status: 'active' }}
                >
                    <Form.Item
                        label="Customer Type"
                        name="customer_type"
                        rules={[{ required: true }]}
                    >
                        <Select size="large">
                            <Option value="individual">Individual</Option>
                            <Option value="corporate">Corporate</Option>
                        </Select>
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Full Name"
                                name="full_name"
                                rules={[{ required: true, message: 'Please enter name' }]}
                            >
                                <Input placeholder="John Doe" size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Company Name" name="company_name">
                                <Input placeholder="Company Inc." size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Email" name="email">
                                <Input type="email" placeholder="customer@example.com" size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Phone"
                                name="phone"
                                rules={[{ required: true, message: 'Please enter phone' }]}
                            >
                                <Input placeholder="+1234567890" size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item label="Address" name="address">
                        <TextArea rows={2} placeholder="Street address" />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item label="City" name="city">
                                <Input placeholder="City" size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="State/Province" name="state">
                                <Input placeholder="State" size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Country" name="country">
                                <Input placeholder="Country" size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Postal Code" name="postal_code">
                                <Input placeholder="12345" size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Tax ID" name="tax_id">
                                <Input placeholder="Tax ID / VAT Number" size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item label="Status" name="status">
                        <Select size="large">
                            <Option value="active">Active</Option>
                            <Option value="inactive">Inactive</Option>
                            <Option value="blocked">Blocked</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item label="Notes" name="notes">
                        <TextArea rows={3} placeholder="Additional notes..." />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit" loading={loading} size="large">
                                {editingCustomer ? 'Update' : 'Add'} Customer
                            </Button>
                            <Button onClick={() => setModalVisible(false)} size="large">
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default CustomerManagementPage;
