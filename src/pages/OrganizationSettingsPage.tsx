// pages/OrganizationSettingsPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    Form,
    Input,
    Button,
    TimePicker,
    Switch,
    Typography,
    message,
    Divider,
    Row,
    Col,
    Tag,
    Table,
    Space
} from 'antd';
import {
    Settings,
    ArrowLeft,
    Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const OrganizationSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [organization, setOrganization] = useState<any>(null);
    const [lateUsers, setLateUsers] = useState<any[]>([]);

    useEffect(() => {
        loadOrganizationSettings();
        loadTodayStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadOrganizationSettings = async () => {
        try {
            const organizationId = localStorage.getItem('organization_id');
            if (!organizationId) {
                message.error('No organization found');
                return;
            }

            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', organizationId)
                .single();

            if (error) throw error;

            setOrganization(data);

            // Set form values
            const settings: any = data.settings || {};
            form.setFieldsValue({
                resume_time: settings.resume_time ? dayjs(settings.resume_time, 'HH:mm') : dayjs('09:00', 'HH:mm'),
                leaving_time: settings.leaving_time ? dayjs(settings.leaving_time, 'HH:mm') : dayjs('17:00', 'HH:mm'),
                late_threshold_minutes: settings.late_threshold_minutes || 15,
                auto_mark_absent: settings.auto_mark_absent || false,
                absent_cutoff_time: settings.absent_cutoff_time ? dayjs(settings.absent_cutoff_time, 'HH:mm') : dayjs('12:00', 'HH:mm'),
            });
        } catch (error: any) {
            console.error('Error loading settings:', error);
            message.error(`Failed to load settings: ${error.message || 'Unknown error'}`);
        }
    };

    const loadTodayStats = async () => {
        try {
            const organizationId = localStorage.getItem('organization_id');
            if (!organizationId) return;
            const today = dayjs().format('YYYY-MM-DD');

            // Get all users
            const { error: usersError } = await supabase
                .from('users')
                .select('id, full_name, staff_id, student_id')
                .eq('organization_id', organizationId)
                .eq('is_active', true);

            if (usersError) throw usersError;


            // Get today's attendance
            const { data: attendance, error: attendanceError } = await supabase
                .from('attendance')
                .select(`
          *,
          user:users(full_name, staff_id, student_id)
        `)
                .eq('organization_id', organizationId)
                .eq('date', today);

            if (attendanceError) throw attendanceError;


            // Calculate late and punctual based on resume time
            const org = await supabase
                .from('organizations')
                .select('settings')
                .eq('id', organizationId)
                .single();

            const resumeTime = (org.data?.settings as any)?.resume_time || '09:00';
            const lateThreshold = (org.data?.settings as any)?.late_threshold_minutes || 15;

            const lateUsersList: any[] = [];

            attendance?.forEach((record: any) => {
                if (record.clock_in) {
                    const clockInTime = dayjs(record.clock_in);
                    const resumeDateTime = dayjs(`${today} ${resumeTime}`);
                    const lateThresholdTime = resumeDateTime.add(lateThreshold, 'minute');

                    if (clockInTime.isAfter(lateThresholdTime)) {
                        lateUsersList.push({
                            ...record,
                            minutesLate: clockInTime.diff(resumeDateTime, 'minute')
                        });
                    }
                }
            });

            setLateUsers(lateUsersList);
        } catch (error: any) {
            console.error('Error loading stats:', error);
        }
    };

    const onFinish = async (values: any) => {
        try {
            setLoading(true);
            const organizationId = localStorage.getItem('organization_id');

            const updatedSettings = {
                ...organization.settings,
                resume_time: values.resume_time.format('HH:mm'),
                leaving_time: values.leaving_time.format('HH:mm'),
                late_threshold_minutes: values.late_threshold_minutes,
                auto_mark_absent: values.auto_mark_absent,
                absent_cutoff_time: values.absent_cutoff_time.format('HH:mm'),
            };

            const { error } = await supabase
                .from('organizations')
                .update({ settings: updatedSettings })
                .eq('id', organizationId);

            if (error) throw error;

            message.success('Settings saved successfully');
            loadOrganizationSettings();
            loadTodayStats();
        } catch (error: any) {
            console.error('Error saving settings:', error);
            message.error('Failed to save settings');
        } finally {
            setLoading(false);
        }
    };

    const lateUsersColumns = [
        {
            title: 'Name',
            key: 'name',
            render: (record: any) => record.user?.full_name || '-',
        },
        {
            title: 'ID',
            key: 'id',
            render: (record: any) => record.user?.staff_id || record.user?.student_id || '-',
        },
        {
            title: 'Clock In Time',
            dataIndex: 'clock_in',
            key: 'clock_in',
            render: (time: string) => dayjs(time).format('h:mm A'),
        },
        {
            title: 'Minutes Late',
            dataIndex: 'minutesLate',
            key: 'minutesLate',
            render: (minutes: number) => (
                <Tag color="warning">{minutes} min</Tag>
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
                        backgroundColor: '#667eea',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Settings size={24} color="#fff" />
                    </div>
                    <div>
                        <Title level={3} style={{ margin: 0 }}>
                            Organization Settings
                        </Title>
                        <Text type="secondary">
                            Configure attendance times and rules
                        </Text>
                    </div>
                </div>
            </div>



            {/* Late Users Table */}
            {lateUsers.length > 0 && (
                <Card style={{ marginBottom: 24 }} title={`Late Arrivals Today (${lateUsers.length})`}>
                    <Table
                        columns={lateUsersColumns}
                        dataSource={lateUsers}
                        rowKey="id"
                        pagination={false}
                        size="small"
                    />
                </Card>
            )}

            {/* Settings Form */}
            <Card title="Attendance Time Settings">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    initialValues={{
                        resume_time: dayjs('09:00', 'HH:mm'),
                        leaving_time: dayjs('17:00', 'HH:mm'),
                        late_threshold_minutes: 15,
                        auto_mark_absent: false,
                        absent_cutoff_time: dayjs('12:00', 'HH:mm'),
                    }}
                >
                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Daily Resume Time"
                                name="resume_time"
                                rules={[{ required: true, message: 'Please select resume time' }]}
                            >
                                <TimePicker
                                    format="HH:mm"
                                    size="large"
                                    style={{ width: '100%' }}
                                    placeholder="Select time"
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Daily Leaving Time"
                                name="leaving_time"
                                rules={[{ required: true, message: 'Please select leaving time' }]}
                            >
                                <TimePicker
                                    format="HH:mm"
                                    size="large"
                                    style={{ width: '100%' }}
                                    placeholder="Select time"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Late Threshold (minutes after resume time)"
                                name="late_threshold_minutes"
                                rules={[{ required: true, message: 'Please enter threshold' }]}
                            >
                                <Input
                                    type="number"
                                    size="large"
                                    suffix="minutes"
                                    placeholder="e.g., 15"
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Auto Mark Absent After"
                                name="absent_cutoff_time"
                            >
                                <TimePicker
                                    format="HH:mm"
                                    size="large"
                                    style={{ width: '100%' }}
                                    placeholder="Select cutoff time"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        label="Automatically Mark as Absent"
                        name="auto_mark_absent"
                        valuePropName="checked"
                    >
                        <Switch />
                    </Form.Item>

                    <Divider />

                    <Form.Item>
                        <Space>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                icon={<Save size={16} />}
                                size="large"
                            >
                                Save Settings
                            </Button>
                            <Button
                                onClick={() => navigate('/')}
                                size="large"
                            >
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default OrganizationSettingsPage;
