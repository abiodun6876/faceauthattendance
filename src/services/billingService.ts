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

        return {
            activeUsers: userCount || 0,
            totalAttendanceThisMonth: attendanceCount || 0,
            storageUsageBytes: (userCount || 0) * 1024 * 100, // Dummy estimation: 100KB per user
        };
    },

    /**
     * Initiate a new subscription request
     */
    async initiateSubscription(params: {
        organizationId: string;
        planType: 'pro' | 'team';
        billingCycle: 'monthly' | 'yearly';
        amount: number;
    }) {
        const invoiceNumber = `INV-${Date.now()}`;
        const subTable = supabase.from('subscriptions' as any) as any;
        return await subTable
            .insert({
                organization_id: params.organizationId,
                plan_type: params.planType,
                billing_cycle: params.billingCycle,
                amount: params.amount,
                invoice_number: invoiceNumber,
                status: 'pending'
            })
            .select()
            .single();
    },

    /**
     * Get all subscription requests (Super Admin)
     */
    async getAllSubscriptions() {
        const subTable = supabase.from('subscriptions' as any) as any;
        return await subTable
            .select(`
                *,
                organization:organizations(name)
            `)
            .order('created_at', { ascending: false });
    },

    /**
     * Get pending subscription for an organization
     */
    async getPendingSubscription(organizationId: string) {
        const subTable = supabase.from('subscriptions' as any) as any;
        return await subTable
            .select('*')
            .eq('organization_id', organizationId)
            .eq('status', 'pending')
            .maybeSingle();
    },

    /**
     * Update subscription status (Super Admin action)
     */
    async updateSubscriptionStatus(subscriptionId: string, status: 'active' | 'rejected', notes?: string) {
        try {
            const subTable = supabase.from('subscriptions' as any) as any;
            const orgTable = supabase.from('organizations' as any) as any;

            // 1. Get the subscription record
            const { data: sub, error: subError } = await subTable
                .select('*')
                .eq('id', subscriptionId)
                .single();

            if (subError || !sub) throw subError || new Error('Subscription not found');

            // 2. If activating, update organization status and expiry
            if (status === 'active') {
                const now = new Date();
                const expiry = new Date();
                if (sub.billing_cycle === 'monthly') {
                    expiry.setMonth(expiry.getMonth() + 1);
                } else {
                    expiry.setFullYear(expiry.getFullYear() + 1);
                }

                const { error: orgError } = await orgTable
                    .update({
                        subscription_plan: sub.plan_type,
                        subscription_status: 'active',
                        subscription_expiry: expiry.toISOString()
                    })
                    .eq('id', sub.organization_id);

                if (orgError) throw orgError;

                // Update subscription record
                return await subTable
                    .update({
                        status: 'active',
                        activated_at: now.toISOString(),
                        expires_at: expiry.toISOString(),
                        notes: notes || 'Activated by Admin'
                    })
                    .eq('id', subscriptionId);
            } else {
                // Reject subscription
                return await subTable
                    .update({
                        status: 'rejected',
                        notes: notes || 'Rejected by Admin'
                    })
                    .eq('id', subscriptionId);
            }
        } catch (error) {
            console.error('Error updating subscription:', error);
            throw error;
        }
    }
};
