import React, { useState, useEffect } from 'react';
import {
    Card,
    Row,
    Col,
    Statistic,
    Typography,
    Divider,
    message,
    Spin
} from 'antd';
import {
    Building2,
    TrendingUp,
    Clock,
    LayoutDashboard
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { billingService } from '../../services/billingService';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalOrgs: 0,
        activeSubs: 0,
        totalRevenue: 0,
        pendingApprovals: 0
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data: orgs } = await supabase.from('organizations').select('*');
            const { data: subs } = await billingService.getAllSubscriptions();

            const active = orgs?.filter((o: any) => o.subscription_status === 'active' && o.subscription_plan !== 'free').length || 0;
            const revenue = subs?.filter((s: any) => s.status === 'active').reduce((acc: number, s: any) => acc + Number(s.amount), 0) || 0;
            const pending = subs?.filter((s: any) => s.status === 'pending').length || 0;

            setStats({
                totalOrgs: orgs?.length || 0,
                activeSubs: active,
                totalRevenue: revenue,
                pendingApprovals: pending
            });
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            message.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Spin size="large" style={{ display: 'block', margin: '50px auto' }} />;

    return (
        <div>
            <Title level={3}>
                <LayoutDashboard size={24} style={{ marginRight: 12, verticalAlign: 'middle' }} />
                Platform Overview
            </Title>
            <Divider />

            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} className="stat-card">
                        <Statistic
                            title="Total Organizations"
                            value={stats.totalOrgs}
                            prefix={<Building2 size={24} color="#1890ff" />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} className="stat-card">
                        <Statistic
                            title="Active Subscriptions"
                            value={stats.activeSubs}
                            prefix={<TrendingUp size={24} color="#52c41a" />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} className="stat-card">
                        <Statistic
                            title="Potential Revenue"
                            value={stats.totalRevenue}
                            prefix={<Text strong style={{ fontSize: 24, marginRight: 8, color: '#722ed1' }}>$</Text>}
                            precision={2}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} className="stat-card">
                        <Statistic
                            title="Pending Approvals"
                            value={stats.pendingApprovals}
                            valueStyle={{ color: stats.pendingApprovals > 0 ? '#cf1322' : 'inherit' }}
                            prefix={<Clock size={24} color={stats.pendingApprovals > 0 ? '#cf1322' : '#d9d9d9'} />}
                        />
                    </Card>
                </Col>
            </Row>

            <div style={{ marginTop: 24 }}>
                <Card title="Quick Actions" bordered={false}>
                    <Text type="secondary">Welcome to the Super Admin Dashboard. Use the sidebar to manage different aspects of the platform.</Text>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
