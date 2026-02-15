import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

export type User = Database['public']['Tables']['users']['Row'];

export const userService = {
    /**
     * Find a user by their face embedding using an RPC call.
     */
    async findByFaceEmbedding(embedding: number[], organizationId: string, threshold = 0.70) {
        try {
            const embeddingString = JSON.stringify(embedding);
            const { data, error } = await supabase.rpc('match_users_by_face', {
                query_embedding: embeddingString,
                match_threshold: threshold,
                filter_organization_id: organizationId,
            } as any);

            if (error) {
                console.error('Face matching error:', error);
                return null;
            }

            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            console.error('Face matching exception:', error);
            return null;
        }
    },

    /**
     * Fetch a single user by their ID.
     */
    async getUserById(userId: string) {
        return await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
    },

    /**
     * Fetch a single user by their staff_id.
     */
    async getUserByStaffId(staffId: string, organizationId?: string) {
        let query = supabase
            .from('users')
            .select('id, staff_id, full_name, email')
            .eq('staff_id', staffId);

        if (organizationId) {
            query = query.eq('organization_id', organizationId);
        }

        return await query.single();
    },

    /**
     * Fetch all active users for an organization, optionally filtered by branch.
     */
    async getOrganizationUsers(organizationId: string, branchId?: string) {
        let query = supabase
            .from('users')
            .select(`
        *,
        branch:branches(name),
        organization:organizations(name, type)
      `)
            .eq('organization_id', organizationId)
            .eq('is_active', true);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        return await query.order('created_at', { ascending: false });
    },

    /**
     * Enroll a new user with biometric data.
     */
    async enrollUser(params: {
        organizationId: string;
        branchId: string;
        staffId?: string;
        studentId?: string;
        fullName: string;
        photoUrl: string;
        embedding: number[];
        qualityScore?: number;
        deviceName?: string;
        locationName?: string;
        email?: string;
        phone?: string;
        gender?: string;
        userRole?: string;
        departmentId?: string | null;
        qrCode?: string | null;
        pin?: string | null;
    }) {
        try {
            const embeddingString = JSON.stringify(params.embedding);

            // 1. Create User
            const { data: user, error: userError } = await supabase
                .from('users')
                .insert({
                    organization_id: params.organizationId,
                    branch_id: params.branchId || null,
                    department_id: params.departmentId || null,
                    staff_id: params.staffId,
                    full_name: params.fullName,
                    email: params.email,
                    phone: params.phone,
                    gender: params.gender,
                    user_role: params.userRole || 'staff',
                    enrollment_status: 'enrolled',
                    face_embedding_stored: true,
                    face_enrolled_at: new Date().toISOString(),
                    face_photo_url: params.photoUrl,
                    face_embedding: embeddingString,
                    qr_code: params.qrCode,
                    pin: params.pin,
                    updated_at: new Date().toISOString()
                } as any)
                .select()
                .single();

            if (userError || !user) {
                return { user: null, faceEnrollment: null, error: userError || new Error('Failed to create user') };
            }

            // 2. Store Face Enrollment
            const { data: faceEnrollment, error: faceError } = await supabase
                .from('face_enrollments')
                .insert({
                    user_id: user.id,
                    organization_id: params.organizationId,
                    embedding: embeddingString,
                    photo_url: params.photoUrl,
                    quality_score: params.qualityScore || 0,
                    capture_device: params.deviceName || 'web_camera',
                    enrollment_location: params.locationName || 'unknown',
                    is_primary: true,
                    is_active: true,
                } as any)
                .select()
                .single();

            if (faceError) {
                // Rollback user creation
                await supabase.from('users').delete().eq('id', user.id);
                return { user: null, faceEnrollment: null, error: faceError };
            }

            return { user, faceEnrollment, error: null };
        } catch (error: any) {
            console.error('User enrollment error:', error);
            return {
                user: null,
                faceEnrollment: null,
                error: error
            };
        }
    },

    /**
     * Search for users based on multiple criteria.
     */
    async searchUsers(organizationId: string, term: string) {
        return await supabase
            .from('users')
            .select('*')
            .eq('organization_id', organizationId)
            .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,staff_id.ilike.%${term}%,qr_code.ilike.%${term}%`);
    }
};
