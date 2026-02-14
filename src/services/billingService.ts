import { supabase } from '../lib/supabase';

export interface SubscriptionInfo {
    plan: 'free' | 'pro' | 'team';
    status: 'active' | 'expired' | 'suspended';
    expiryDate: string;
    isGracePeriod: boolean;
}

export interface UsageStats {
    activeUsers: number;
    totalAttendanceThisMonth: number;
    storageUsageBytes: number;
}

export const billingService = {
    /**
     * Get basic subscription details for an organization
     */
    async getSubscriptionInfo(organizationId: string): Promise<SubscriptionInfo | null> {
        const { data, error } = await supabase
            .from('organizations')
            .select('subscription_plan, subscription_status, subscription_expiry')
            .eq('id', organizationId)
            .single();

        if (error || !data) return null;

        const orgData = data as any;

        return {
            plan: orgData.subscription_plan || 'free',
            status: orgData.subscription_status || 'active',
            expiryDate: orgData.subscription_expiry,
            isGracePeriod: false // Logic can be added later
        };
    },

    /**
     * Check if the organization currently has access to the platform
     */
    async checkAccess(organizationId: string): Promise<{ hasAccess: boolean; reason?: string }> {
        const info = await this.getSubscriptionInfo(organizationId);

        if (!info) return { hasAccess: false, reason: 'Organization not found' };

        if (info.status === 'suspended') {
            return { hasAccess: false, reason: 'Subscription suspended' };
        }

        const expiry = new Date(info.expiryDate);
        if (expiry < new Date()) {
            return { hasAccess: false, reason: 'Subscription expired' };
        }

        return { hasAccess: true };
    },

    /**
     * Get usage metrics (MAUs, storage, etc)
     */
    async getUsageStats(organizationId: string): Promise<UsageStats> {
        // MAUs: Count of active users in the organization
        const { count: userCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('is_active', true);

        // Attendance stats for current month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: attendanceCount } = await supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .gte('date', startOfMonth.toISOString().split('T')[0]);

        // Storage usage (simplified calculation based on user profiles/images)
        // In a real app, we'd query Supabase Storage API or track this in a table.
        // For now, we estimate based on user count if needed, or return 0.

        return {
            activeUsers: userCount || 0,
            totalAttendanceThisMonth: attendanceCount || 0,
            storageUsageBytes: (userCount || 0) * 1024 * 100, // Dummy estimation: 100KB per user
        };
    }
};
