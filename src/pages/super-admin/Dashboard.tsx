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
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalOrgs: 0,
        activeSubs: 0,
        totalRevenue: 0,
        pendingApprovals: 0
    });
    const [growthData, setGrowthData] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data: orgs } = await supabase.from('organizations').select('*');
            const { data: subs } = await billingService.getAllSubscriptions();

            if (orgs) {
                // Transform data for growth chart
                const groups: any = {};
                orgs.forEach((org: any) => {
                    const month = dayjs(org.created_at).format('MMM YYYY');
                    groups[month] = (groups[month] || 0) + 1;
                });

                // Convert to sorted array
                const chartData = Object.keys(groups).map(month => ({
                    month,
                    count: groups[month],
                    date: dayjs(month, 'MMM YYYY').toDate()
                })).sort((a, b) => a.date.getTime() - b.date.getTime());

                // Cumulative growth
                let cumulative = 0;
                const finalData = chartData.map(d => {
                    cumulative += d.count;
                    return { ...d, total: cumulative };
                });

                setGrowthData(finalData);
            }

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

            <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                <Col span={24}>
                    <Card title="Organization Growth" bordered={false}>
                        <div style={{ height: 350, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={growthData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#1890ff" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8c8c8c' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8c8c8c' }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        labelStyle={{ fontWeight: 'bold', marginBottom: 4 }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        name="Total Organizations"
                                        stroke="#1890ff"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorTotal)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
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
