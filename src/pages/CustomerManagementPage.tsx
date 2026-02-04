// pages/CustomerManagementPage.tsx - SIMPLIFIED VERSION (FIXED)
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    Table,
    Button,
    Modal,
    Form,
    Input,
    message,
    Tag,
    Space,
    Typography,
    Row,
    Col,
    Statistic,
    Avatar,
    Tooltip,
    Select
} from 'antd';
import {
    Users,
    UserPlus,
    ArrowLeft,
    Phone,
    Edit,
    MapPin,
    FileText,
} from 'lucide-react';
import { SearchOutlined, } from '@ant-design/icons'; // Fixed import
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
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
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        individual: 0,
        corporate: 0
    });

    useEffect(() => {
        loadCustomers();
    }, []);

   

    const loadCustomers = async () => {
        try {
            setLoading(true);
            const organizationId = localStorage.getItem('organization_id');
            const branchId = localStorage.getItem('branch_id');

            let query = supabase
                .from('customers')
                .select('*')
                .eq('organization_id', organizationId)
                .order('created_at', { ascending: false });

            if (branchId) {
                // If you want branch-specific customers, add this filter
                // query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query;

            if (error) throw error;
            
            setCustomers(data || []);

            // Calculate stats
            const total = data?.length || 0;
            const active = data?.filter(c => c.status === 'active').length || 0;
            const individual = data?.filter(c => c.customer_type === 'individual').length || 0;
            const corporate = data?.filter(c => c.customer_type === 'corporate').length || 0;

            setStats({ total, active, individual, corporate });
        } catch (error: any) {
            console.error('Error loading customers:', error);
            message.error('Failed to load customers');
        } finally {
            setLoading(false);
        }
    };

    const filterCustomers = useCallback(() => {
    let filtered = [...customers];

    if (searchText) {
        filtered = filtered.filter(customer =>
            customer.full_name?.toLowerCase().includes(searchText.toLowerCase()) ||
            customer.phone?.includes(searchText) ||
            customer.email?.toLowerCase().includes(searchText.toLowerCase()) ||
            customer.address?.toLowerCase().includes(searchText.toLowerCase())
        );
    }

    setFilteredCustomers(filtered);
}, [customers, searchText]); // Add all dependencies here

useEffect(() => {
    filterCustomers();
}, [filterCustomers]); // Now filterCustomers is stable with useCallback

    const handleSubmit = async (values: any) => {
        try {
            setLoading(true);
            const organizationId = localStorage.getItem('organization_id');

            const customerData = {
                organization_id: organizationId,
                full_name: values.full_name,
                phone: values.phone,
                address: values.address,
                notes: values.notes,
                customer_type: values.customer_type || 'individual',
                status: 'active',
                updated_at: new Date().toISOString()
            };

            if (editingCustomer) {
                // Update existing customer
                const { error } = await supabase
                    .from('customers')
                    .update(customerData)
                    .eq('id', editingCustomer.id);

                if (error) throw error;
                message.success('Customer updated successfully');
            } else {
                // Create new customer
                const { error } = await supabase
                    .from('customers')
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
        form.setFieldsValue({
            full_name: customer.full_name,
            phone: customer.phone,
            address: customer.address,
            notes: customer.notes,
            customer_type: customer.customer_type || 'individual'
        });
        setModalVisible(true);
    };

    const handleAdd = () => {
        setEditingCustomer(null);
        form.resetFields();
        form.setFieldsValue({ customer_type: 'individual' });
        setModalVisible(true);
    };

    const columns = [
        {
            title: 'Customer Name',
            key: 'name',
            render: (record: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar
                        size={40}
                        style={{ 
                            backgroundColor: record.customer_type === 'corporate' ? '#1890ff' : '#52c41a',
                            fontSize: 16
                        }}
                    >
                        {record.full_name?.charAt(0).toUpperCase()}
                    </Avatar>
                    <div>
                        <div style={{ fontWeight: 500 }}>{record.full_name}</div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                            <Tag 
                                color={record.customer_type === 'corporate' ? 'blue' : 'green'}
                                style={{ fontSize: '10px', padding: '1px 6px' }} // Fixed: using style instead of size prop
                            >
                                {record.customer_type?.toUpperCase()}
                            </Tag>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: 'Phone Number',
            dataIndex: 'phone',
            key: 'phone',
            render: (phone: string) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Phone size={14} color="#666" />
                    <Text style={{ fontSize: 14 }}>{phone || '-'}</Text>
                </div>
            ),
        },
        {
            title: 'Address',
            key: 'address',
            render: (record: any) => (
                <Tooltip title={record.address}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 8,
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        <MapPin size={14} color="#666" />
                        <Text style={{ fontSize: 12 }} type="secondary">
                            {record.address ? 
                                (record.address.length > 30 ? record.address.substring(0, 30) + '...' : record.address)
                                : 'No address'}
                        </Text>
                    </div>
                </Tooltip>
            ),
        },
        {
            title: 'Description',
            key: 'notes',
            render: (record: any) => (
                <Tooltip title={record.notes}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 8,
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        <FileText size={14} color="#666" />
                        <Text style={{ fontSize: 12 }} type="secondary">
                            {record.notes ? 
                                (record.notes.length > 30 ? record.notes.substring(0, 30) + '...' : record.notes)
                                : 'No description'}
                        </Text>
                    </div>
                </Tooltip>
            ),
        },
        {
            title: 'Created',
            dataIndex: 'created_at',
            key: 'created',
            width: 120,
            render: (date: string) => (
                <div style={{ fontSize: 12 }}>
                    {dayjs(date).format('MMM D')}
                    <div style={{ color: '#999' }}>{dayjs(date).format('YYYY')}</div>
                </div>
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 100,
            render: (record: any) => (
                <Button
                    type="text"
                    icon={<Edit size={16} />}
                    onClick={() => handleEdit(record)}
                    size="small"
                >
                    Edit
                </Button>
            ),
        },
    ];

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: 16 }}>
            {/* Header */}
            <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: 8,
                marginBottom: 24,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                        <Button
                            type="text"
                            icon={<ArrowLeft size={20} />}
                            onClick={() => navigate('/')}
                            style={{ color: '#666' }}
                        />
                        <div style={{ flex: 1 }}>
                            <Title level={3} style={{ margin: 0 }}>
                                Customer Management
                            </Title>
                            <Text type="secondary">
                                Manage your customers with basic information
                            </Text>
                        </div>
                    </Space>

                    {/* Stats */}
                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        <Col xs={12} sm={6}>
                            <Card size="small" style={{ textAlign: 'center' }}>
                                <Statistic
                                    title="Total Customers"
                                    value={stats.total}
                                    prefix={<Users size={16} />}
                                    valueStyle={{ color: '#1890ff', fontSize: 24 }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card size="small" style={{ textAlign: 'center' }}>
                                <Statistic
                                    title="Active"
                                    value={stats.active}
                                    valueStyle={{ color: '#52c41a', fontSize: 24 }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card size="small" style={{ textAlign: 'center' }}>
                                <Statistic
                                    title="Individual"
                                    value={stats.individual}
                                    valueStyle={{ color: '#722ed1', fontSize: 24 }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card size="small" style={{ textAlign: 'center' }}>
                                <Statistic
                                    title="Corporate"
                                    value={stats.corporate}
                                    valueStyle={{ color: '#fa8c16', fontSize: 24 }}
                                />
                            </Card>
                        </Col>
                    </Row>
                </Space>
            </div>

            {/* Search and Add Button */}
            <Card style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={18} sm={20}>
                        <Input
                            placeholder="Search customers by name, phone, or address..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            prefix={<SearchOutlined />} 
                            size="large"
                            allowClear
                        />
                    </Col>
                    <Col xs={6} sm={4}>
                        <Button
                            type="primary"
                            icon={<UserPlus size={16} />}
                            onClick={handleAdd}
                            size="large"
                            block
                        >
                            Add
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
                    pagination={{ 
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `Total ${total} customers`
                    }}
                    scroll={{ x: 800 }}
                />
            </Card>

            {/* Add/Edit Customer Modal */}
            <Modal
                title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                open={modalVisible}
                onCancel={() => {
                    setModalVisible(false);
                    setEditingCustomer(null);
                    form.resetFields();
                }}
                footer={null}
                width={600}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{ customer_type: 'individual' }}
                >
                    <Form.Item
                        label="Customer Type"
                        name="customer_type"
                        rules={[{ required: true, message: 'Please select customer type' }]}
                    >
                        <Select size="large">
                            <Select.Option value="individual">Individual</Select.Option>
                            <Select.Option value="corporate">Corporate</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="Full Name"
                        name="full_name"
                        rules={[
                            { required: true, message: 'Please enter customer name' },
                            { min: 2, message: 'Name must be at least 2 characters' }
                        ]}
                    >
                        <Input 
                            placeholder="Enter customer full name" 
                            size="large" 
                            prefix={<Users size={16} />}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Phone Number"
                        name="phone"
                        rules={[
                            { required: true, message: 'Please enter phone number' },
                            { pattern: /^[+]?[0-9\s\-()]+$/, message: 'Please enter valid phone number' }
                        ]}
                    >
                        <Input 
                            placeholder="+1234567890 or (123) 456-7890" 
                            size="large" 
                            prefix={<Phone size={16} />}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Address"
                        name="address"
                        rules={[
                            { required: true, message: 'Please enter address' },
                            { min: 5, message: 'Address must be at least 5 characters' }
                        ]}
                    >
                        <TextArea 
                            rows={3} 
                            placeholder="Enter complete address (street, city, state, country)" 
                            size="large"
                            showCount
                            maxLength={500}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Description / Notes"
                        name="notes"
                    >
                        <TextArea 
                            rows={4} 
                            placeholder="Additional notes about the customer..." 
                            size="large"
                            showCount
                            maxLength={1000}
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                        <Space>
                            <Button 
                                onClick={() => {
                                    setModalVisible(false);
                                    setEditingCustomer(null);
                                    form.resetFields();
                                }} 
                                size="large"
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="primary" 
                                htmlType="submit" 
                                loading={loading} 
                                size="large"
                            >
                                {editingCustomer ? 'Update' : 'Add'} Customer
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default CustomerManagementPage;