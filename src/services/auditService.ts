import { supabase } from '../lib/supabase';

export interface AuditLog {
    id: string;
    admin_email: string;
    action: string;
    target_type: 'organization' | 'subscription' | 'admin' | 'setting' | 'other';
    target_id?: string;
    details: any;
    created_at: string;
}

export const auditService = {
    /**
     * Log an administrative action
     */
    async logAction(params: {
        action: string;
        target_type: AuditLog['target_type'];
        target_id?: string;
        details?: any;
    }) {
        try {
            const adminEmail = sessionStorage.getItem('super_admin_email') || 'system';

            const { error } = await (supabase.from('platform_audit_logs' as any) as any)
                .insert({
                    admin_email: adminEmail,
                    action: params.action,
                    target_type: params.target_type,
                    target_id: params.target_id,
                    details: params.details || {}
                });

            if (error) {
                console.error('Failed to log admin action:', error);
                // We don't throw here to avoid breaking the main operation if logging fails
            }
        } catch (e) {
            console.error('Audit skip:', e);
        }
    },

    /**
     * Get recent audit logs
     */
    async getLogs(limit = 50) {
        return await (supabase.from('platform_audit_logs' as any) as any)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
    }
};
