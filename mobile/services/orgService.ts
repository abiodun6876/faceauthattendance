import { supabase } from '../lib/supabase';

export const orgService = {
    /**
     * Get organization details and settings.
     */
    async getOrganization(organizationId: string) {
        return await supabase
            .from('organizations')
            .select('*')
            .eq('id', organizationId)
            .single();
    },

    /**
     * Update organization settings.
     */
    async updateSettings(organizationId: string, settings: any) {
        return await supabase
            .from('organizations')
            .update({ settings, updated_at: new Date().toISOString() })
            .eq('id', organizationId);
    },

    /**
     * Get branches for an organization.
     */
    async getBranches(organizationId: string) {
        return await supabase
            .from('branches')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .order('name');
    },

    /**
     * Get departments for a branch.
     */
    async getDepartments(branchId: string) {
        return await supabase
            .from('departments')
            .select('*')
            .eq('branch_id', branchId)
            .eq('is_active', true)
            .order('name');
    },

    /**
     * Create a new organization and its primary branch.
     */
    async createOrganization(params: {
        name: string;
        type: string;
        branchName: string;
    }) {
        try {
            // Generate a subdomain from the name (simplified slugify)
            const subdomain = params.name
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
                .substring(0, 30);

            // 1. Create Organization
            const { data: org, error: orgError } = await supabase
                .from('organizations')
                .insert({
                    name: params.name,
                    type: params.type,
                    subdomain: subdomain,
                    is_active: true
                })
                .select()
                .single();

            if (orgError || !org) {
                console.error('Organization creation error:', orgError);
                return { success: false, error: orgError?.message || 'Failed to create organization' };
            }

            // 2. Create Primary Branch
            const branchCode = `${org.subdomain?.substring(0, 3).toUpperCase()}-MAIN`;
            const { data: branch, error: branchError } = await supabase
                .from('branches')
                .insert({
                    name: params.branchName,
                    organization_id: org.id,
                    code: branchCode,
                    is_active: true
                })
                .select()
                .single();

            if (branchError) {
                console.error('Branch creation error:', branchError);
                // Note: We don't rollback org creation here as it might be useful, 
                // but the UI will catch the error.
                return { success: false, error: branchError.message, organization: org };
            }

            return { success: true, organization: org, branch };
        } catch (error: any) {
            console.error('Organization creation exception:', error);
            return { success: false, error: error.message };
        }
    }
};
